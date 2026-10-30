# Running and building on macOS

Tagged releases include unsigned macOS disk images (`.dmg`), built separately for each kind of Mac (see [Status](../README.md#status)):

- Apple Silicon (M1 and later): `magic-rampage-scene-editor-<tag>-macos-arm64.dmg`
- Intel: `magic-rampage-scene-editor-<tag>-macos-x64.dmg`

Each image has an adjacent `.sha256` file. To install one, skip to [Open an unsigned build](#5-open-an-unsigned-build). To run or build the editor from source, follow the steps below. They have been tested on macOS with Apple Silicon.

## 1. Install the prerequisites

1. **Xcode Command Line Tools**: needed by Rust to compile and link the desktop app.

   ```sh
   xcode-select --install
   ```

   If `xcode-select -p` already prints a path, they are installed.

2. **Node.js 24.x**: the scripts use Vite's native config loader, which fails on older Node versions with `Unknown file extension ".ts"`. With [nvm](https://github.com/nvm-sh/nvm):

   ```sh
   nvm install 24
   nvm use 24
   ```

   Run `nvm use 24` in every new terminal, or make it the default with `nvm alias default 24`.

3. **pnpm 10.33.2**: provided by Corepack, which ships with Node.js:

   ```sh
   corepack enable
   ```

   Corepack is enabled per Node.js version, so run it again after switching to a newly installed Node.js version.

4. **Rust stable**: needed for the desktop app only:

   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

Check the toolchain:

```sh
node -v     # v24.x
pnpm -v     # 10.33.2
rustc -V
```

## 2. Install dependencies

From the repository root:

```sh
pnpm install --frozen-lockfile
```

## 3. Run the editor

**Desktop app**:

```sh
pnpm tauri dev
```

The first run compiles the Rust dependencies and takes a few minutes; later runs start in seconds. Frontend changes under `src/` reload in the window, and changes under `src-tauri/` rebuild and restart the app.

**Web app**:

```sh
pnpm dev
```

Then open <http://localhost:5173> in Chrome or Edge. Safari and Firefox do not support the File System Access API that the web build uses to open project folders.

Shortcuts listed with `Ctrl` also work with `Cmd` on macOS, for example `Cmd+Z` to undo.

## 4. Build the app

Build a `.dmg` for the Mac you are on. The macOS configuration (`src-tauri/tauri.macos.conf.json`) selects the DMG bundle and a minimum of macOS 10.15:

```sh
pnpm tauri build
```

The output is in `src-tauri/target/release/bundle/`:

- `macos/Unofficial Magic Rampage Scene Editor.app`
- `dmg/Unofficial Magic Rampage Scene Editor_<version>_aarch64.dmg` (or `_x64` on an Intel Mac)

### Match a release build

The release workflow builds each architecture on its own native runner. To reproduce one locally, pass its target explicitly:

```sh
pnpm tauri build --bundles dmg --target aarch64-apple-darwin   # Apple Silicon
pnpm tauri build --bundles dmg --target x86_64-apple-darwin    # Intel
```

Building for the other architecture requires its Rust target, for example `rustup target add x86_64-apple-darwin`. The output is in `src-tauri/target/<target>/release/bundle/dmg/`.

## 5. Open an unsigned build

Download the DMG for your Mac and verify its checksum first:

```sh
shasum -a 256 -c magic-rampage-scene-editor-<tag>-macos-arm64.dmg.sha256
```

Local and release builds are ad-hoc signed only. They are not signed with an Apple Developer ID or notarized. An app you built yourself opens normally on the same Mac. When the app is downloaded on another Mac, Gatekeeper blocks the first launch:

1. Open the `.dmg` and drag the app to **Applications**.
2. Open the app. When macOS reports that it cannot verify the developer, select **Done**.
3. Open **System Settings > Privacy & Security**, scroll to **Security**, and select **Open Anyway** for the editor. Confirm with your password.

If macOS reports that the app "is damaged and can't be opened", the download quarantine flag is the cause. Remove it only for a build whose checksum you have verified:

```sh
xattr -dr com.apple.quarantine "/Applications/Unofficial Magic Rampage Scene Editor.app"
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Unknown file extension ".ts" for .../vite.config.ts` | Node.js is older than 24. Run `nvm use 24`. |
| `command not found: pnpm` after switching Node.js | Run `corepack enable` again for that Node.js version. |
| `command not found: cargo` | Run `source "$HOME/.cargo/env"` or open a new terminal. |
| `failed to open icon .../icons/icon.icns` | The macOS icon is missing from `src-tauri/icons/`. Regenerate the icons from a square PNG with `pnpm tauri icon <source.png>`. This also rewrites the Windows and Linux icons. |
| macOS reports the app "is not supported on this type of Mac" | You downloaded the image for the other architecture. Use `macos-arm64` on Apple Silicon or `macos-x64` on Intel. |
| `Port 5173 is already in use` | Another `pnpm dev` or `pnpm tauri dev` is still running. Stop it first. |
| The **Open Project** button in the browser does nothing | Use Chrome or Edge; see [Run the editor](#3-run-the-editor). |
