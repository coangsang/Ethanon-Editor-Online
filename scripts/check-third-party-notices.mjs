import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const update = process.argv.includes('--update');
const fixture = process.argv.find((arg) => arg.startsWith('--fixture='))?.split('=')[1];
const inventoryPath = join(root, 'third-party-inventory.json');
const licensesPath = join(root, 'THIRD_PARTY_LICENSES.md');
const missing = [];

function command(program, args) {
  return execFileSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function licensesIn(folder) {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^(LICENSE|LICENCE|COPYING|NOTICE)([._-]|$)/i.test(entry.name))
    .map((entry) => ({ name: entry.name, text: readFileSync(join(folder, entry.name), 'utf8').replace(/\r\n/g, '\n').trim() }))
    .filter((entry) => entry.text);
}

function sourceReference(license, source, authors = []) {
  if (!license || !source) throw new Error(`Missing license metadata or upstream source: ${source || '(unknown)'}`);
  return [{ name: 'UPSTREAM-LICENSE-REFERENCE', text: `The installed package does not contain a license file.\nDeclared license: ${license}\nUpstream source: ${source}\nAuthors in package metadata: ${authors.length ? authors.join(', ') : '(not specified)'}` }];
}

function npmPackages() {
  const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const found = new Map();
  function walk(folder, dependencies = {}) {
    let packageModules = folder;
    while (packageModules !== root && packageModules.split(/[\\/]/).at(-1) !== 'node_modules') packageModules = dirname(packageModules);
    for (const name of Object.keys(dependencies)) {
      const candidates = folder === root
        ? [join(root, 'node_modules', name)]
        : [join(folder, 'node_modules', name), join(packageModules, name), join(root, 'node_modules', name)];
      const path = candidates.find((candidate) => existsSync(candidate));
      if (!path) {
        if (folder === root || !(name in (JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')).optionalDependencies || {}))) {
          throw new Error(`npm:${name}: installed package missing; run pnpm install --frozen-lockfile`);
        }
        continue;
      }
      const packageRoot = realpathSync(path);
      const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
      const key = `npm:${name}@${manifest.version}`;
      if (!found.has(key)) {
        const files = licensesIn(packageRoot);
        if (!manifest.license) missing.push(`${key}: missing license metadata`);
        const source = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
        const coveredFiles = files.length ? files : sourceReference(manifest.license, source, manifest.author ? [manifest.author] : []);
        found.set(key, { id: key, license: manifest.license, files: coveredFiles });
        walk(packageRoot, { ...manifest.dependencies, ...manifest.optionalDependencies });
      }
    }
  }
  walk(root, project.dependencies);
  return [...found.values()];
}

function cargoPackages() {
  const metadataText = process.env.LICENSE_CARGO_METADATA
    ? readFileSync(process.env.LICENSE_CARGO_METADATA, 'utf8')
    : command('cargo', ['metadata', '--locked', '--format-version', '1', '--manifest-path', 'src-tauri/Cargo.toml']);
  const metadata = JSON.parse(metadataText.replace(/^\uFEFF/, ''));
  const treeText = process.env.LICENSE_CARGO_TREE
    ? readFileSync(process.env.LICENSE_CARGO_TREE, 'utf8')
    : command('cargo', ['tree', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', '--target', 'x86_64-pc-windows-msvc', '--edges', 'normal', '--format', '{p}', '--prefix', 'none']);
  const used = new Set([...treeText.matchAll(/^([^\s]+) v([^\s]+)/gm)].map((match) => `${match[1]}@${match[2]}`));
  return metadata.packages.filter((entry) => entry.id !== metadata.resolve.root && used.has(`${entry.name}@${entry.version}`)).map((entry) => {
    const key = `cargo:${entry.name}@${entry.version}`;
    const files = licensesIn(dirname(entry.manifest_path));
    if (!entry.license) missing.push(`${key}: missing license metadata`);
    return { id: key, license: entry.license, files: files.length ? files : sourceReference(entry.license, entry.repository, entry.authors) };
  });
}

function collect() {
  const packages = [...npmPackages(), ...cargoPackages()].sort((a, b) => a.id.localeCompare(b.id));
  if (missing.length) throw new Error(missing.join('\n'));
  return packages;
}

function inventory(packages) {
  const entries = packages.map(({ id, license, files }) => ({
    id,
    license,
    files: files.map(({ name, text }) => ({ name, sha256: createHash('sha256').update(text).digest('hex') })),
  }));
  for (const path of ['pnpm-lock.yaml', 'src-tauri/Cargo.lock']) {
    entries.push({ id: `lock:${path}`, license: `sha256:${createHash('sha256').update(readFileSync(join(root, path))).digest('hex')}`, files: [] });
  }
  return entries;
}

function licenseDocument(packages) {
  const sections = ['# Third-party license texts', '', 'Generated from the installed packages pinned by `pnpm-lock.yaml` and `src-tauri/Cargo.lock`. See `THIRD_PARTY_NOTICES.md` for context.', ''];
  for (const entry of packages) {
    sections.push(`## ${entry.id} — ${entry.license}`, '');
    for (const file of entry.files) sections.push(`### ${file.name}`, '', '```text', file.text.replace(/^```/gm, ' ```'), '```', '');
  }
  return sections.join('\n').trimEnd() + '\n';
}

try {
  const packages = collect();
  const referenced = packages.filter((entry) => entry.files.some((file) => file.name === 'UPSTREAM-LICENSE-REFERENCE')).length;
  const actual = inventory(packages);
  if (fixture === 'license') actual[0].license = 'CHANGED-FOR-TEST';
  else if (fixture === 'version') actual[0].id = actual[0].id.replace(/@[^@]+$/, '@0.0.0');
  else if (fixture) throw new Error(`Unknown fixture: ${fixture}`);
  const snapshot = JSON.stringify(actual, null, 2) + '\n';
  const document = licenseDocument(packages);
  if (update) {
    if (fixture) throw new Error('--fixture cannot be used with --update');
    writeFileSync(inventoryPath, snapshot);
    writeFileSync(licensesPath, document);
    console.log(`Updated notices for ${packages.length} packages (${referenced} upstream license references).`);
  } else {
    const expected = JSON.parse(readFileSync(inventoryPath, 'utf8'));
    const old = new Map(expected.map((item) => [item.id, item]));
    const current = new Map(actual.map((item) => [item.id, item]));
    const changed = [...new Set([...old.keys(), ...current.keys()])].filter((id) => JSON.stringify(old.get(id)) !== JSON.stringify(current.get(id)));
    if (changed.length) throw new Error(`Third-party inventory changed: ${changed.join(', ')}. Review licenses and run pnpm notices:update.`);
    if (readFileSync(licensesPath, 'utf8') !== document) throw new Error('THIRD_PARTY_LICENSES.md differs from installed package license files. Review and run pnpm notices:update.');
    console.log(`Third-party notices verified for ${packages.length} packages (${referenced} upstream license references).`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
