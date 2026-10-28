# Project structure

Select a project root that already contains `scenes/` and `entities/`. Opening a project does not create these required directories.

```text
project-root/
├── scenes/                 # Required: scene files
├── entities/               # Required: entity templates, texture atlases, images
├── prefabs/                # Optional: editor-only prefabs
│   └── .thumbnails/        # Optional: prefab preview images
└── particles/              # Optional: particle images
```

`prefabs/` and `particles/` may be absent when opening a project. **Refresh** scans resources added outside the editor, including a `prefabs/` directory added later. Exporting a prefab can create `prefabs/` and its `.thumbnails/` directory.

## Files the editor scans

| Location | Files used | Scan depth |
| --- | --- | --- |
| `scenes/` | `.esc` scene files | Direct children only; listed first, then read when opened. |
| `entities/` | `.ent` entity templates, `.xml` texture atlases, and `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp` images | Recursive, including subdirectories. |
| `prefabs/` | `.prf` prefab files | Direct children only; read and parsed during the scan. |
| `prefabs/.thumbnails/` | `.jpg` prefab preview images | Direct children only. |
| `particles/` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp` images | Recursive; available for image lookup, but not listed as entity sprites. |

Extensions are matched without regard to case. Other file types are ignored by these scans. An `.xml` file in `entities/` is treated as a texture atlas; its image is matched using the XML filename with `.png` in place of `.xml`, so keep atlas and image names consistent.

## Asset lookup

Image references are normalized for lookup: backslashes become forward slashes, surrounding whitespace and leading `./` or `../` segments are removed, and an `entities/` prefix can be used. The editor registers images under their path relative to the scanned directory, their filename, and `entities/` aliases; lookup also tries case-insensitive keys. Entity templates in subdirectories can resolve a sprite filename relative to the template when that image exists there.

Use consistent relative paths in XML references and keep image filenames unique where possible. If multiple directories contain the same filename, lookup by filename or a broad alias can select a different image; a specific relative path is more reliable. Texture atlas lookup also uses path and filename aliases, so duplicate atlas or image names can be ambiguous.

## Text encoding and scan errors

The web and desktop builds use the same decoder for project text. Reading supports valid UTF-8 with or without a BOM, plus UTF-16LE or UTF-16BE with a BOM. UTF-16 without a BOM and other encodings are not supported. Saving a scene or prefab writes UTF-8 text; it does not preserve the source file's encoding.

Read and parse errors for `.ent` templates appear as project scan issues, while other valid resources can still load. A scene is read when opened: failure to read or parse the first scene prevents that project from opening, and failure in a later scene is reported as an open-scene error. Invalid `.prf` files and unreadable or invalid atlas `.xml` files are skipped with console warnings, rather than appearing in the scan issue list. Image load failures are logged to the console.

## Compatibility limits

- `.prf` files are editor-only resources. Placing a prefab copies its entities into the scene; the game does not use the `.prf` file directly.
- Existing XML element names, structure, value encoding, and editor metadata form the format contract. This document does not introduce format changes.
- The parser and serializer are tested with small synthetic fixtures, not every game format variant. Unknown variants may not round-trip without loss. Keep a backup before opening and overwriting important files, especially files that use unfamiliar XML or a non-UTF-8 source encoding.
- The repository contains no game-extracted scenes or assets.

