import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [bundleRoot, tag, platform, architecture, extensionList] = process.argv.slice(2);
if (!bundleRoot || !tag || !platform || !architecture || !extensionList) {
  throw new Error(
    'Usage: node scripts/prepare-release-assets.mjs <bundle-root> <tag> <platform> <architecture> <extensions>',
  );
}

const extensions = extensionList.split(',').map((value) => value.trim()).filter(Boolean);
const outputDirectory = path.resolve('release-assets');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const bundleFiles = await walk(path.resolve(bundleRoot));
for (const extension of extensions) {
  const matches = bundleFiles.filter((file) => file.toLowerCase().endsWith(extension.toLowerCase()));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${extension} bundle under ${bundleRoot}, found ${matches.length}.`);
  }

  const qualifier = extension.toLowerCase() === '.exe' ? '-setup' : '';
  const artifactName = `magic-rampage-scene-editor-${tag}-${platform}-${architecture}${qualifier}${extension}`;
  const artifactPath = path.join(outputDirectory, artifactName);
  await cp(matches[0], artifactPath);

  const hash = createHash('sha256').update(await readFile(artifactPath)).digest('hex');
  await writeFile(`${artifactPath}.sha256`, `${hash}  ${artifactName}\n`, 'ascii');
  console.log(`Prepared ${artifactName}`);
}
