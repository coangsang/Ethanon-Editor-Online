# Getting started

## Before you begin

The editor writes directly to the project folder you open. Make a copy of the project or put it under version control before editing, and try your first save on a copy. This repository does not include a sample game project or game assets.

A valid project root already contains `scenes/` for `.esc` scene files and `entities/` for `.ent` entity templates and their assets. The editor does not create these required directories. `prefabs/` is optional. See [Project structure](project-structure.md) for the full folder layout and file compatibility notes.

In a browser, use a Chromium-based browser with File System Access API support and grant read/write access to the selected folder. The desktop build uses native Tauri folder access.

## Start the editor

Install Node.js 24.x and pnpm 10.33.2 before running these commands.

From the repository root, start the web editor:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

To start the Tauri desktop version, first install the [desktop development prerequisites](../README.md#desktop-development) for Windows, Linux, or macOS (on macOS, see also [Running and building on macOS](macos.md)):

```powershell
pnpm tauri dev
```

To create an unsigned package for the current operating system, run `pnpm tauri build`. The default platform configuration produces an NSIS installer on Windows, AppImage and deb packages on Linux, or a DMG image on macOS. Release DMGs are built separately for Intel and Apple Silicon. Because the packages are unsigned, Windows SmartScreen or macOS Gatekeeper may display a warning; verify the published SHA-256 checksum before installing a release download.

## Open a project and scene

1. Select **Open Project** in the toolbar and choose the project root containing `scenes/` and `entities/`.
2. In a browser, grant read/write permission when prompted.
3. If the project contains `.esc` files, the first scene opens automatically. To open another, select the **Scenes** tab in **Project** and click its scene.

If there are no `.esc` files, no scene is active; use **Save As** to create one after editing. Scan issues appear in the toolbar with the affected path. Other valid resources can still load; inspect the issue and fix the affected file before relying on it. Use **Refresh** in Project after adding files outside the editor.

## Edit the scene

- **Hierarchy** shows entities and parent-child relationships. Click an entity here or in the **Viewport** to select it; use **Inspector** to edit its exact values and entity data. The **Scene** tab beside Inspector edits scene-level properties.
- To select multiple entities, `Shift`-click a range in **Hierarchy**, or `Ctrl`/`Cmd`-click individual rows to toggle them. In the **Viewport**, `Shift`-click toggles one entity at a time.
- **Project** provides **Scenes**, **Entities**, **Sprites**, and **Prefabs** tabs. Select an entity template in **Entities**, then click in the viewport to place it.
- In the **Viewport**, scroll to zoom around the pointer. Drag with the middle mouse button to pan, or press `Q` and drag with the left button. Press `S` to select, `W` to move, or `E` to rotate. The same tools are available in the toolbar.
- Use **Settings** to show the grid (`G` toggles it), enable **Snap to Grid**, choose the snap step, and toggle the live scene-coordinate readout beside the viewport cursor. When snapping is enabled, the readout shows the nearest grid point. The toolbar also has a **Snap** toggle.

Use `Ctrl+Z` and `Ctrl+Y` on Windows/Linux, or `Cmd+Z` and `Cmd+Y` on macOS, to undo and redo entity edits. The same platform modifier with `D`, `C`, and `V` duplicates, copies, and pastes the selection; `Delete` or `Backspace` removes it. Editor shortcuts do not run while focus is in a text input or textarea. They may still run while a dropdown is focused; this input-handling issue remains unresolved. Panel sizes and collapsed states are stored locally in the current browser profile.

## Save the scene

Select **Save Scene** in the toolbar to write the active `.esc` file in the project folder. Save regularly after editing. If no scene is active, use **Save As** instead.

**Save As** asks for a filename, adds `.esc` if needed, writes it in `scenes/`, and makes that file the active scene. A name that already exists can be overwritten directly: the toolbar does **not** ask for a separate overwrite confirmation. Check the name and keep a backup before using it.

When **Clean Scene File** is enabled in **Settings**, **Clean Save** overwrites the active `.esc` file without editor metadata. Try it on a copy of the project and review the saved output before using it in production, especially if the source uses an unfamiliar format variant.

The editor asks before discarding unsaved changes when you open another project or scene. The desktop app also offers Save, Discard, and Cancel when you close it with pending changes.

## Prefabs: editor-only reuse

Prefabs are a new feature of this editor for reusing an entity and its descendants. A `.prf` file in the optional `prefabs/` directory is an editor resource, not a game feature; the game does not use prefab files directly. Placing a prefab adds copies of its entities to the current scene, which are then saved in the scene's `.esc` file. The placed entities are not linked to the `.prf` file.

To create one, select a single entity, click **Prefab** in **Inspector**, enter a filename, and choose **Keep Entity Reference** to retain references to `.ent` templates or **Unpack Entity (Inline Data)** to include their attributes in the prefab. Export writes under `prefabs/`, creating that directory if needed. To reuse it, open **Prefabs** in **Project**, click the prefab, then click in the viewport to place it. Right-click in the viewport to cancel placement.

## Backup and recovery

The editor has no autosave, automatic project backup, or scene recovery after a crash. Undo/redo covers entity edits in the current session; it is not a backup and does not restore every scene property.

If a scene was overwritten or damaged, close the editor, restore the affected file from your project copy or version-control history, then reopen the project. If no backup exists, the editor cannot reconstruct a previous saved version. Save before closing a browser tab or window: do not rely on a browser close warning to preserve unsaved changes.

