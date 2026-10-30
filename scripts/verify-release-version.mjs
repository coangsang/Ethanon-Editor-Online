import { readFile } from 'node:fs/promises';

const tag = process.argv[2];

if (!tag || !/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`Expected a semantic release tag beginning with "v", received: ${tag ?? '<none>'}`);
}

const [packageJson, tauriConfig, cargoManifest] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8'),
]);

const cargoPackage = cargoManifest.match(/^\[package\]\s*$([\s\S]*?)(?=^\[|\Z)/m)?.[1];
const cargoVersion = cargoPackage?.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
const expectedVersion = tag.slice(1);
const versions = {
  package: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersion,
};

const mismatches = Object.entries(versions).filter(([, version]) => version !== expectedVersion);
if (mismatches.length > 0) {
  const details = Object.entries(versions)
    .map(([source, version]) => `${source}=${version ?? '<missing>'}`)
    .join(', ');
  throw new Error(`Release tag ${tag} does not match the project versions (${details}).`);
}

console.log(`Release version ${expectedVersion} is consistent across package.json, Tauri, and Cargo.`);
