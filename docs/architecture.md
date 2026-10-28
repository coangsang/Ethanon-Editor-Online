# Architecture

The web application is the main editor. Tauri provides a desktop project-file adapter around the same React application.

## At a glance

```text
React panels and toolbar ── actions ──┐
                                      ▼
PixiJS viewport ─── committed edits ── Zustand scene store
       ▲                              │                 │
       └──── scene and resources ─────┘                 ├── scene/prefab parser and serializer
                                                      └── project-folder I/O
                                                            ├── Web File System Access API
                                                            └── Tauri project adapter
```

The store is the source of truth for the active scene. The viewport renders that scene and sends completed edits back to the store. A separate transform event bus carries live previews between editing surfaces without making preview values another scene owner.

## Responsibilities

| Part | Responsibility |
| --- | --- |
| [React workspace](../src/App.tsx), [panels](../src/panels/), and [components](../src/components/) | Present the Hierarchy, Project panel, Inspector, toolbar, and dialogs; dispatch editor actions. UI-only preferences such as panel sizes use browser-local storage. |
| [Zustand scene store](../src/store/sceneStore.ts) | Own the active scene, selection, project resources and handles, tools, edit actions, save status, and entity undo/redo history. Coordinate loading and saving. |
| [PixiJS viewport](../src/canvas/Viewport.tsx) and [canvas modules](../src/canvas/) | Set up the stage, manage textures, render entities and effects, handle pointer selection and transforms, and draw temporary interaction previews. |
| [XML readers](../src/io/parseScene.ts) and [scene writer](../src/io/serializeScene.ts) | Convert between scene XML and the shared scene model. Related I/O modules handle entity templates, texture atlases, and prefabs. |
| [Project-folder I/O](../src/io/projectFolder.ts) and [Tauri adapter](../src/io/tauriProjectFolder.ts) | Expose project directories and files through common handle operations. The browser uses the File System Access API; the desktop adapter invokes project-scoped commands in [Tauri](../src-tauri/src/project_io.rs). |

## Data flows

1. **Open a project or scene:** A store action calls project-folder I/O. The browser directory picker or Tauri adapter supplies file handles; the shared [text decoder](../src/io/decodeProjectText.ts) reads project text. The parser turns scene XML into the scene model, which the store publishes to the UI and viewport. Opening a project also scans its scene, template, sprite, and prefab resources.
2. **Edit and save:** Panels and viewport interactions call store actions to commit changes. On save, the store serializes the active scene and passes the XML to project-folder I/O, which writes through the selected adapter. The same parser/serializer and scene model serve both platforms.

## History and live transforms

The store records snapshots of **entities** for undo/redo when an entity edit is committed. A new edit after undo discards the redo branch. Undo and redo restore entities and clear selection; they do not restore every scene property or UI setting. Pending Inspector edits are flushed before history-sensitive actions. Separately, unsaved-change detection compares the **whole scene** with its last loaded or saved snapshot.

During an Inspector preview or viewport drag, [TransformEventBus](../src/store/TransformEventBus.ts) delivers live updates to subscribers. [Viewport interactions](../src/canvas/useViewportInteractions.ts) also update Pixi meshes directly while dragging and batch bus updates by animation frame. On drag completion, they commit the final transform through a store action, creating a history entry. The bus carries previews; committed scene values remain in Zustand.

## Compatibility and verification

The parser and serializer must preserve the existing XML format contract, including editor metadata; architecture documentation does not imply a format change. The web and desktop paths share text decoding. See [Project structure](project-structure.md) for directory and encoding expectations.

Vitest tests live beside the relevant store, I/O, canvas, panel, and utility modules. Format compatibility tests use minimal synthetic fixtures; changes to reading or writing should verify parsing and serialization where applicable.

