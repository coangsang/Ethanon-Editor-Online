# Third-party notices

This project uses third-party software. The project [MIT license](LICENSE) covers original project code; it does not replace third-party licenses. The versioned license texts, copyright notices, and upstream references for the installed packages are in [Third-party license texts](THIRD_PARTY_LICENSES.md). The corresponding package inventory is recorded in `third-party-inventory.json`.

## Ethanon Engine

Source: <https://github.com/asantee/ethanon>

This editor was developed with reference to the open-source Ethanon engine, its editor concepts, and its XML resource format. Ethanon's README publishes the following MIT terms:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Direct application dependencies

| Project | Locked version | Declared license |
| --- | --- | --- |
| React / React DOM | 19.2.8 / 19.2.8 | MIT |
| PixiJS | 8.20.1 | MIT |
| Zustand | 5.0.14 | MIT |
| TanStack React Virtual | 3.14.9 | MIT |
| fast-xml-parser | 5.10.1 | MIT |
| Lucide React | 1.47.0 | ISC; some icons derive from Feather under MIT |
| Tauri | 2.11.5 | Apache-2.0 OR MIT |
| Tauri plugin dialog / opener | 2.7.2 / 2.5.4 | Apache-2.0 OR MIT |
| Serde / serde_json | 1.0.229 / 1.0.151 | MIT OR Apache-2.0 |
| tempfile | 3.27.0 | MIT OR Apache-2.0 |

The [license-text appendix](THIRD_PARTY_LICENSES.md) includes the complete license file shipped with `lucide-react` 1.47.0, including its Feather-derived icon list and Feather MIT notice. It also includes the installed license files for PixiJS, fast-xml-parser, and the other packages in the inventory. Where an installed package has no license file, the appendix marks that case explicitly and gives its declared license and upstream source for further review.

The inventory covers installed production npm dependencies and normal Rust dependency edges selected for the Windows x64 target. Explicit Rust build-dependency edges and npm development dependencies are excluded. The inventory is intentionally conservative: type packages and procedural macros can be listed even when their code is absent from the final binary, and bundling can remove other listed code. `pnpm notices:check` compares the current installed dependency tree, license metadata and files, and both lockfiles with the reviewed inventory. A changed dependency requires a new review of this notice and the appendix.
