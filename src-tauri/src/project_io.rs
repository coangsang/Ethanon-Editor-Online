use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct ProjectSessions {
    next_id: AtomicU64,
    roots: Mutex<HashMap<u64, PathBuf>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSession {
    session_id: u64,
    name: String,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
pub struct DirectoryEntry {
    name: String,
    kind: &'static str,
}

fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[cfg(windows)]
fn is_symlink_or_junction(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::FileTypeExt;

    let file_type = metadata.file_type();
    file_type.is_symlink_dir() || file_type.is_symlink_file()
}

#[cfg(not(windows))]
fn is_symlink_or_junction(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

async fn run_blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(error)?
}

fn root_for(sessions: &ProjectSessions, session_id: u64) -> Result<PathBuf, String> {
    sessions
        .roots
        .lock()
        .map_err(error)?
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Project session has expired.".to_string())
}

fn relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("Invalid project-relative path.".into());
    }
    Ok(path.to_path_buf())
}

fn existing_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative = relative_path(relative)?;
    let mut candidate = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err("Invalid project-relative path.".into());
        };
        candidate.push(name);
        let metadata = fs::symlink_metadata(&candidate).map_err(error)?;
        if is_symlink_or_junction(&metadata) {
            return Err("Symbolic links are not supported in projects.".into());
        }
    }

    let path = fs::canonicalize(candidate).map_err(error)?;
    if !path.starts_with(root) {
        return Err("Path leaves the selected project.".into());
    }
    Ok(path)
}

fn list_entries(root: &Path, path: &str) -> Result<Vec<DirectoryEntry>, String> {
    let directory = existing_path(root, path)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(directory).map_err(error)? {
        let entry = entry.map_err(error)?;
        let metadata = fs::symlink_metadata(entry.path()).map_err(error)?;
        if is_symlink_or_junction(&metadata) {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        let relative = if path.is_empty() {
            name.clone()
        } else {
            format!("{path}/{name}")
        };
        let resolved = existing_path(root, &relative)?;
        let kind = if resolved.is_dir() {
            "directory"
        } else if resolved.is_file() {
            "file"
        } else {
            continue;
        };
        result.push(DirectoryEntry { name, kind });
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

fn new_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = relative_path(relative)?;
    let name = path
        .file_name()
        .ok_or("A file or directory name is required.")?;
    let parent = path.parent().ok_or("Invalid project-relative path.")?;
    let parent = existing_path(root, &parent.to_string_lossy())?;
    if !parent.is_dir() {
        return Err("Parent is not a directory.".into());
    }
    let target = parent.join(name);
    if fs::symlink_metadata(&target).is_ok() {
        let metadata = fs::symlink_metadata(&target).map_err(error)?;
        if is_symlink_or_junction(&metadata) {
            return Err("Writing through a symbolic link is not allowed.".into());
        }
        let canonical = fs::canonicalize(&target).map_err(error)?;
        if !canonical.starts_with(root) {
            return Err("Path leaves the selected project.".into());
        }
    }
    Ok(target)
}

fn write_atomic(root: &Path, relative: &str, bytes: &[u8]) -> Result<(), String> {
    let target = new_path(root, relative)?;
    if target.is_dir() {
        return Err("Cannot write to a directory.".into());
    }
    let parent = target.parent().ok_or("Invalid project-relative path.")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(error)?;
    temporary.write_all(bytes).map_err(error)?;
    if target.exists() {
        let permissions = fs::metadata(&target).map_err(error)?.permissions();
        if permissions.readonly() {
            return Err("Project file is read-only.".into());
        }
        temporary
            .as_file()
            .set_permissions(permissions)
            .map_err(error)?;
    }
    temporary.as_file().sync_all().map_err(error)?;
    temporary.persist(&target).map_err(error)?;
    Ok(())
}

#[tauri::command]
pub async fn open_project_session(
    app: AppHandle,
    sessions: State<'_, ProjectSessions>,
) -> Result<Option<ProjectSession>, String> {
    let selected =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_folder())
            .await
            .map_err(error)?;
    let Some(selected) = selected else {
        return Ok(None);
    };
    let selected = selected.into_path().map_err(error)?;
    let root = run_blocking(move || fs::canonicalize(selected).map_err(error)).await?;
    if !root.is_dir() {
        return Err("Selected project is not a directory.".into());
    }
    let name = root
        .file_name()
        .unwrap_or(root.as_os_str())
        .to_string_lossy()
        .into_owned();
    let session_id = sessions.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    sessions
        .roots
        .lock()
        .map_err(error)?
        .insert(session_id, root);
    Ok(Some(ProjectSession { session_id, name }))
}

#[tauri::command]
pub fn release_project_session(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
) -> Result<(), String> {
    sessions.roots.lock().map_err(error)?.remove(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn project_list_entries(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
) -> Result<Vec<DirectoryEntry>, String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || list_entries(&root, &path)).await
}

#[tauri::command]
pub async fn project_create_directory(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
) -> Result<(), String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || {
        let target = new_path(&root, &path)?;
        fs::create_dir(&target)
            .or_else(|e| if target.is_dir() { Ok(()) } else { Err(e) })
            .map_err(error)
    })
    .await
}

#[tauri::command]
pub async fn project_file_exists(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
) -> Result<bool, String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || {
        let relative = relative_path(&path)?;
        match fs::symlink_metadata(root.join(relative)) {
            Ok(_) => Ok(existing_path(&root, &path)?.is_file()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(error.to_string()),
        }
    })
    .await
}

#[tauri::command]
pub async fn project_read_binary(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
) -> Result<Response, String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || {
        Ok(Response::new(
            fs::read(existing_path(&root, &path)?).map_err(error)?,
        ))
    })
    .await
}

#[tauri::command]
pub async fn project_write_text(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
    contents: String,
) -> Result<(), String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || write_atomic(&root, &path, contents.as_bytes())).await
}

#[tauri::command]
pub async fn project_write_binary(
    sessions: State<'_, ProjectSessions>,
    session_id: u64,
    path: String,
    contents: Vec<u8>,
) -> Result<(), String> {
    let root = root_for(&sessions, session_id)?;
    run_blocking(move || write_atomic(&root, &path, &contents)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_stay_inside_selected_project() {
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        assert!(relative_path("../outside").is_err());
        assert!(relative_path("/outside").is_err());
        assert!(relative_path("scenes/test.esc").is_ok());
        assert!(new_path(&root_path, "../outside").is_err());
    }

    #[test]
    fn directory_listing_returns_only_regular_files_and_directories() {
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        fs::create_dir(root_path.join("entities")).unwrap();
        fs::write(root_path.join("hero.ent"), "hero").unwrap();

        assert_eq!(
            list_entries(&root_path, "").unwrap(),
            vec![
                DirectoryEntry {
                    name: "entities".into(),
                    kind: "directory",
                },
                DirectoryEntry {
                    name: "hero.ent".into(),
                    kind: "file",
                },
            ]
        );
    }

    #[test]
    fn blocking_task_errors_are_propagated() {
        let result = tauri::async_runtime::block_on(run_blocking(|| {
            Err::<(), String>("disk failure".into())
        }));
        assert_eq!(result.unwrap_err(), "disk failure");
    }

    #[test]
    fn failed_write_preserves_previous_file() {
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        fs::write(root_path.join("scene.esc"), "original").unwrap();
        assert!(write_atomic(&root_path, "missing/scene.esc", b"new").is_err());
        assert_eq!(
            fs::read_to_string(root_path.join("scene.esc")).unwrap(),
            "original"
        );
    }

    #[test]
    fn write_replaces_existing_file() {
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        fs::write(root_path.join("scene.esc"), "original").unwrap();
        write_atomic(&root_path, "scene.esc", b"updated").unwrap();
        assert_eq!(
            fs::read_to_string(root_path.join("scene.esc")).unwrap(),
            "updated"
        );
    }

    #[test]
    fn read_only_file_is_not_replaced() {
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        let file = root_path.join("scene.esc");
        fs::write(&file, "original").unwrap();
        let mut permissions = fs::metadata(&file).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&file, permissions.clone()).unwrap();
        assert!(write_atomic(&root_path, "scene.esc", b"updated").is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), "original");
        permissions.set_readonly(false);
        fs::set_permissions(&file, permissions).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_rejected_and_omitted_from_listings() {
        use std::os::unix::fs::symlink;
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        let entities = root_path.join("entities");
        fs::create_dir(&entities).unwrap();
        fs::write(entities.join("hero.ent"), "hero").unwrap();
        symlink(entities.join("hero.ent"), entities.join("linked.ent")).unwrap();
        symlink(&entities, entities.join("loop")).unwrap();

        assert!(existing_path(&root_path, "entities/linked.ent").is_err());
        assert!(existing_path(&root_path, "entities/loop").is_err());
        assert!(new_path(&root_path, "entities/loop/new.ent").is_err());
        assert_eq!(
            list_entries(&root_path, "entities").unwrap(),
            vec![DirectoryEntry {
                name: "hero.ent".into(),
                kind: "file",
            }]
        );
    }

    #[cfg(windows)]
    #[test]
    fn symlinks_are_rejected_and_omitted_when_creation_is_allowed() {
        use std::os::windows::fs::{symlink_dir, symlink_file};
        let root = tempfile::tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        let entities = root_path.join("entities");
        fs::create_dir(&entities).unwrap();
        fs::write(entities.join("hero.ent"), "hero").unwrap();
        if symlink_file(entities.join("hero.ent"), entities.join("linked.ent")).is_err()
            || symlink_dir(&entities, entities.join("loop")).is_err()
        {
            return; // Creating symlinks requires Developer Mode or elevated privileges.
        }

        assert!(existing_path(&root_path, "entities/linked.ent").is_err());
        assert!(existing_path(&root_path, "entities/loop").is_err());
        assert!(new_path(&root_path, "entities/loop/new.ent").is_err());
        assert_eq!(
            list_entries(&root_path, "entities").unwrap(),
            vec![DirectoryEntry {
                name: "hero.ent".into(),
                kind: "file",
            }]
        );
    }

    #[test]
    fn released_session_is_invalid() {
        let sessions = ProjectSessions::default();
        sessions
            .roots
            .lock()
            .unwrap()
            .insert(1, PathBuf::from("project"));
        sessions.roots.lock().unwrap().remove(&1);
        assert!(root_for(&sessions, 1).is_err());
    }
}
