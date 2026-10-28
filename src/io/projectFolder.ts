import type { EntityTemplate, ProjectPrefabEntry, ProjectSpriteItem, SpriteAtlas } from '../types';
import { parseEntityTemplate } from './parseScene';
import { parsePrefab } from './parsePrefab';
import { parseTextureAtlas } from './parseTextureAtlas';
import { normalizeImageLookupKey, resolveImageUrl } from '../utils/resolveImageUrl';
import { prefabNameFromThumbnailFile } from '../utils/generatePrefabThumbnail';
import { isTauri } from '@tauri-apps/api/core';
import { openTauriProjectFolder, releaseTauriProjectFolder } from './tauriProjectFolder';
import { decodeProjectText } from './decodeProjectText';

export interface ProjectFileHandle {
  kind: 'file';
  name: string;
  path?: string;
  assetUrl?: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: string | Blob | BufferSource) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export interface ProjectDirectoryHandle {
  kind: 'directory';
  name: string;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<ProjectDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<ProjectFileHandle>;
  entries: () => AsyncIterableIterator<[string, ProjectFileHandle | ProjectDirectoryHandle]>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export interface ProjectSceneEntry {
  name: string;
  handle: ProjectFileHandle;
}

export interface ProjectFolderData {
  rootHandle: ProjectDirectoryHandle;
  scenesHandle: ProjectDirectoryHandle;
  entitiesHandle: ProjectDirectoryHandle;
  prefabsHandle: ProjectDirectoryHandle | null;
  scenes: ProjectSceneEntry[];
  prefabs: ProjectPrefabEntry[];
  templates: Record<string, EntityTemplate>;
  templateImageUrls: Record<string, string>;
  templateAtlases: Record<string, SpriteAtlas>;
  sprites: ProjectSpriteItem[];
  prefabThumbnailUrls: Record<string, string>;
  scanIssues: ProjectScanIssue[];
  folderPath?: string;
}

export interface ProjectScanIssue {
  path: string;
  stage: 'read' | 'parse';
  message: string;
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<ProjectDirectoryHandle>;
};

const PROJECT_IMAGE_RE = /\.(png|jpg|jpeg|gif|webp|bmp)$/i;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function readProjectText(handle: ProjectFileHandle): Promise<string> {
  return decodeProjectText(await (await handle.getFile()).arrayBuffer());
}

export function supportsProjectFolders(): boolean {
  return isTauri() || typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function';
}

export function isUserAbortError(e: unknown): boolean {
  if (e && typeof e === 'object') {
    const err = e as { name?: string; message?: string };
    if (err.name === 'AbortError') return true;
    if (typeof err.message === 'string') {
      const msg = err.message.toLowerCase();
      if (
        msg.includes('user aborted') ||
        msg.includes('aborted a request') ||
        msg.includes('the user aborted') ||
        msg.includes('aborterror')
      ) {
        return true;
      }
    }
  }
  return false;
}

async function ensureReadWritePermission(handle: ProjectDirectoryHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return;

  const descriptor = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(descriptor)) === 'granted') return;
  if ((await handle.requestPermission(descriptor)) !== 'granted') {
    throw new Error('Project folder permission was not granted.');
  }
}

async function getRequiredDirectory(root: ProjectDirectoryHandle, name: string) {
  try {
    return await root.getDirectoryHandle(name);
  } catch {
    throw new Error(`Project folder must contain a "${name}" subfolder.`);
  }
}

async function scanScenes(scenesHandle: ProjectDirectoryHandle): Promise<ProjectSceneEntry[]> {
  const scenes: ProjectSceneEntry[] = [];

  for await (const [name, handle] of scenesHandle.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.esc')) {
      scenes.push({ name, handle: handle as ProjectFileHandle });
    }
  }

  return scenes.sort((a, b) => a.name.localeCompare(b.name));
}

async function scanPrefabs(prefabsHandle: ProjectDirectoryHandle | null): Promise<ProjectPrefabEntry[]> {
  if (!prefabsHandle) return [];
  const prefabs: ProjectPrefabEntry[] = [];

  for await (const [name, handle] of prefabsHandle.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.prf')) {
      try {
        const fileHandle = handle as ProjectFileHandle;
        const text = await readProjectText(fileHandle);
        const entities = parsePrefab(text);
        prefabs.push({ name, handle: fileHandle, entities });
      } catch (e) {
        console.warn('[ProjectFolder] Failed to parse prefab file:', name, e);
      }
    }
  }

  return prefabs.sort((a, b) => a.name.localeCompare(b.name));
}


async function collectAllFiles(
  dirHandle: ProjectDirectoryHandle,
  prefix = ''
): Promise<Array<[string, ProjectFileHandle]>> {
  const files: Array<[string, ProjectFileHandle]> = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const relativePath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      files.push([relativePath, handle as ProjectFileHandle]);
    } else if (handle.kind === 'directory') {
      const subFiles = await collectAllFiles(handle as ProjectDirectoryHandle, relativePath);
      files.push(...subFiles);
    }
  }
  return files;
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  const settled = await Promise.allSettled(workers);
  const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}

function addLookupAlias<T>(target: Record<string, T>, key: string, value: T) {
  const normalized = normalizeImageLookupKey(key);
  if (!normalized) return;

  target[normalized] = value;
  target[normalized.toLowerCase()] = value;
}

function registerImageAliases(
  templateImageUrls: Record<string, string>,
  relativePath: string,
  url: string,
) {
  const normalizedPath = normalizeImageLookupKey(relativePath);
  const basename = normalizedPath.split('/').pop() ?? normalizedPath;

  [
    normalizedPath,
    basename,
    `entities/${basename}`,
    `entities/${normalizedPath}`,
    `particles/${basename}`,
    `particles/${normalizedPath}`,
    `Particles/${basename}`,
    `Particles/${normalizedPath}`,
  ].forEach(alias => addLookupAlias(templateImageUrls, alias, url));
}

function directoryName(relativePath: string) {
  const normalized = normalizeImageLookupKey(relativePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
}

function isAbsoluteOrProjectRootPath(path: string) {
  const normalized = normalizeImageLookupKey(path);
  return (
    path.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(path) ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(path) ||
    normalized.toLowerCase().startsWith('entities/')
  );
}

function registerAtlasAliases(
  templateAtlases: Record<string, SpriteAtlas>,
  xmlRelativePath: string,
  atlas: SpriteAtlas,
) {
  const imagePath = normalizeImageLookupKey(xmlRelativePath).replace(/\.xml$/i, '.png');
  const xmlDir = directoryName(xmlRelativePath);
  const resolvedImagePath =
    xmlDir && !isAbsoluteOrProjectRootPath(imagePath)
      ? `${xmlDir}/${imagePath}`
      : imagePath;
  const basename = imagePath.split('/').pop() ?? imagePath;

  [
    imagePath,
    resolvedImagePath,
    basename,
    `entities/${basename}`,
    `entities/${imagePath}`,
    `entities/${resolvedImagePath}`,
  ].forEach(alias => addLookupAlias(templateAtlases, alias, atlas));
}

function createImagePathLookup(fileEntries: Array<[string, ProjectFileHandle]>) {
  const imagePaths = new Set<string>();
  for (const [relativePath] of fileEntries) {
    const filename = relativePath.split('/').pop() ?? relativePath;
    if (PROJECT_IMAGE_RE.test(filename)) {
      imagePaths.add(normalizeImageLookupKey(relativePath).toLowerCase());
    }
  }
  return imagePaths;
}

function resolveTemplateSpriteFile(
  spriteFile: string,
  templateRelativePath: string,
  imagePaths: Set<string>,
) {
  const normalizedSprite = normalizeImageLookupKey(spriteFile);
  if (!normalizedSprite || imagePaths.has(normalizedSprite.toLowerCase())) {
    return normalizedSprite;
  }

  const templateDir = directoryName(templateRelativePath);
  if (!templateDir || isAbsoluteOrProjectRootPath(normalizedSprite)) {
    return normalizedSprite;
  }

  const templateRelativeSprite = `${templateDir}/${normalizedSprite}`;
  return imagePaths.has(templateRelativeSprite.toLowerCase())
    ? templateRelativeSprite
    : normalizedSprite;
}

async function getProjectImageUrl(handle: ProjectFileHandle) {
  return URL.createObjectURL(await handle.getFile());
}

async function scanEntities(entitiesHandle: ProjectDirectoryHandle) {
  const templates: Record<string, EntityTemplate> = {};
  const templateImageUrls: Record<string, string> = {};
  const templateAtlases: Record<string, SpriteAtlas> = {};
  const scannedTemplates: Array<{ relativePath: string; template: EntityTemplate }> = [];
  const scannedAtlases: Array<{ relativePath: string; atlas: SpriteAtlas }> = [];
  const scannedImages: Array<{ filename: string; relativePath: string; url: string }> = [];
  const scanIssues: ProjectScanIssue[] = [];

  const fileEntries = await collectAllFiles(entitiesHandle);
  const imagePaths = createImagePathLookup(fileEntries);

  await mapConcurrent(fileEntries, 10, async ([relativePath, handle]) => {
    const lowerName = relativePath.toLowerCase();
    const filename = relativePath.split('/').pop() ?? relativePath;

    if (lowerName.endsWith('.ent')) {
      let text: string;
      try {
        text = await readProjectText(handle);
      } catch (error) {
        const message = errorMessage(error);
        scanIssues.push({ path: relativePath, stage: 'read', message });
        console.warn('[ProjectFolder] Failed to read entity template:', relativePath, error);
        return;
      }

      try {
        const templateName = relativePath.replace(/\.ent$/i, '');
        const template = parseEntityTemplate(templateName, text);
        template.spriteFile = resolveTemplateSpriteFile(template.spriteFile, relativePath, imagePaths);
        scannedTemplates.push({ relativePath, template });
      } catch (error) {
        const message = errorMessage(error);
        scanIssues.push({ path: relativePath, stage: 'parse', message });
        console.warn('[ProjectFolder] Failed to parse entity template:', relativePath, error);
      }
      return;
    }

    if (lowerName.endsWith('.xml')) {
      try {
        const text = await readProjectText(handle);
        const atlas = parseTextureAtlas(text);
        scannedAtlases.push({ relativePath, atlas });
      } catch (e) {
        console.warn('[ProjectFolder] Failed to parse texture atlas:', relativePath, e);
      }
      return;
    }

    if (PROJECT_IMAGE_RE.test(filename)) {
      try {
        const url = await getProjectImageUrl(handle);
        scannedImages.push({ filename, relativePath, url });
      } catch (e) {
        console.error('[ProjectFolder] Failed to load image file:', relativePath, e);
      }
    }
  }).catch(error => {
    revokeObjectUrls(templateImageUrls, scannedImages.map(image => image.url));
    throw error;
  });

  scannedTemplates.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  for (const { relativePath, template } of scannedTemplates) {
    templates[relativePath.replace(/\.ent$/i, '')] = template;
  }
  for (const { relativePath, template } of scannedTemplates) {
    if (!relativePath.includes('/')) continue;
    const baseName = (relativePath.split('/').pop() ?? relativePath).replace(/\.ent$/i, '');
    if (!templates[baseName]) templates[baseName] = template;
  }
  scannedAtlases.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  for (const { relativePath, atlas } of scannedAtlases) {
    registerAtlasAliases(templateAtlases, relativePath, atlas);
  }
  scannedImages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  for (const { relativePath, url } of scannedImages) {
    registerImageAliases(templateImageUrls, relativePath, url);
  }

  const parsedTemplateNames = Object.keys(templates);
  const loadedImageKeysCount = Object.keys(templateImageUrls).length;
  console.info(
    `[ProjectFolder] 📦 Scanned ${fileEntries.length} files in entities directory: ` +
    `${parsedTemplateNames.length} templates, ${Object.keys(templateAtlases).length} atlases, ${loadedImageKeysCount} image entries.`
  );

  const missingImageTemplates: Array<{ name: string; spriteFile: string }> = [];
  for (const [tmplName, tmpl] of Object.entries(templates)) {
    if (tmpl.spriteFile) {
      const resolved = resolveImageUrl(templateImageUrls, tmpl.spriteFile);
      if (!resolved) {
        missingImageTemplates.push({ name: tmplName, spriteFile: tmpl.spriteFile });
      }
    }
  }

  if (missingImageTemplates.length > 0) {
    console.warn(
      `[ProjectFolder] ⚠️ WARNING: ${missingImageTemplates.length} / ${parsedTemplateNames.length} entity templates could NOT find their image file:`
    );
    missingImageTemplates.forEach(({ name, spriteFile }) => {
      console.warn(`   ❌ Entity: "${name}" => expected spriteFile: "${spriteFile}"`);
    });
  } else if (parsedTemplateNames.length > 0) {
    console.info(`[ProjectFolder] ✅ All ${parsedTemplateNames.length} entity templates successfully matched their image files!`);
  }

  const templatesByImageName = new Map<string, string[]>();
  for (const [name, template] of Object.entries(templates)) {
    if (!template.spriteFile) continue;
    const normalized = normalizeImageLookupKey(template.spriteFile).toLowerCase();
    const imageName = normalized.split('/').pop() ?? normalized;
    const names = templatesByImageName.get(imageName) ?? [];
    names.push(name);
    templatesByImageName.set(imageName, names);
  }

  // Build ProjectSpriteItem list
  const sprites: ProjectSpriteItem[] = scannedImages.map(img => {
    const normKey = normalizeImageLookupKey(img.relativePath);
    const atlas = templateAtlases[normKey]
      ?? templateAtlases[normKey.toLowerCase()]
      ?? templateAtlases[img.filename]
      ?? templateAtlases[img.filename.toLowerCase()];

    const lowerFilename = img.filename.toLowerCase();

    return {
      name: img.filename,
      relativePath: img.relativePath,
      url: img.url,
      hasAtlas: Boolean(atlas),
      atlasFrameCount: atlas?.frames?.length,
      usedByTemplates: [...(templatesByImageName.get(lowerFilename) ?? [])].sort(),
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  scanIssues.sort((a, b) => a.path.localeCompare(b.path));
  return { templates, templateImageUrls, templateAtlases, sprites, scanIssues };
}

export function revokeObjectUrls(urls: Record<string, string>, additionalUrls: string[] = []) {
  const seen = new Set<string>();
  for (const url of [...Object.values(urls), ...additionalUrls]) {
    if (url.startsWith('blob:') && !seen.has(url)) {
      URL.revokeObjectURL(url);
      seen.add(url);
    }
  }
}

async function tryGetDirectory(root: ProjectDirectoryHandle, name: string): Promise<ProjectDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(name);
  } catch {
    try {
      for await (const [entryName, handle] of root.entries()) {
        if (handle.kind === 'directory' && entryName.toLowerCase() === name.toLowerCase()) {
          return handle as ProjectDirectoryHandle;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

async function scanParticlesFolder(particlesHandle: ProjectDirectoryHandle, templateImageUrls: Record<string, string>) {
  try {
    const fileEntries = await collectAllFiles(particlesHandle);
    const scannedImages: Array<{ relativePath: string; url: string }> = [];
    await mapConcurrent(fileEntries, 10, async ([relativePath, handle]) => {
      const filename = relativePath.split('/').pop() ?? relativePath;
      if (PROJECT_IMAGE_RE.test(filename)) {
        try {
          const url = await getProjectImageUrl(handle);
          scannedImages.push({ relativePath, url });
        } catch (e) {
          console.error('[ProjectFolder] Failed to load particle image:', relativePath, e);
        }
      }
    });
    scannedImages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    for (const { relativePath, url } of scannedImages) {
      registerImageAliases(templateImageUrls, relativePath, url);
    }
  } catch (e) {
    console.warn('[ProjectFolder] Failed to scan Particles directory:', e);
  }
}

export async function openProjectFolder(): Promise<ProjectFolderData> {
  let rootHandle: ProjectDirectoryHandle;
  if (isTauri()) {
    rootHandle = await openTauriProjectFolder();
  } else {
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (!picker) throw new Error('Open Project requires Chrome/Edge File System Access API support.');
    rootHandle = await picker({ mode: 'readwrite' });
    await ensureReadWritePermission(rootHandle);
  }

  try {
    const scenesHandle = await getRequiredDirectory(rootHandle, 'scenes');
    const entitiesHandle = await getRequiredDirectory(rootHandle, 'entities');
    const prefabsHandle = await tryGetDirectory(rootHandle, 'prefabs');
    const rescanned = await rescanProject(rootHandle, scenesHandle, entitiesHandle, prefabsHandle);
    return { rootHandle, scenesHandle, entitiesHandle, ...rescanned };
  } catch (error) {
    await releaseTauriProjectFolder(rootHandle).catch(console.warn);
    throw error;
  }
}

export async function rescanProject(
  rootHandle: ProjectDirectoryHandle,
  scenesHandle: ProjectDirectoryHandle,
  entitiesHandle: ProjectDirectoryHandle,
  prefabsHandle: ProjectDirectoryHandle | null,
): Promise<{
  prefabsHandle: ProjectDirectoryHandle | null;
  scenes: ProjectSceneEntry[];
  prefabs: ProjectPrefabEntry[];
  templates: Record<string, EntityTemplate>;
  templateImageUrls: Record<string, string>;
  templateAtlases: Record<string, SpriteAtlas>;
  sprites: ProjectSpriteItem[];
  prefabThumbnailUrls: Record<string, string>;
  scanIssues: ProjectScanIssue[];
}> {
  const resolvedPrefabsHandle = prefabsHandle ?? await tryGetDirectory(rootHandle, 'prefabs');
  const scenes = await scanScenes(scenesHandle);
  const prefabs = await scanPrefabs(resolvedPrefabsHandle);
  const { templates, templateImageUrls, templateAtlases, sprites, scanIssues } = await scanEntities(entitiesHandle);
  let prefabThumbnailUrls: Record<string, string> = {};
  try {
    const particlesHandle = await tryGetDirectory(rootHandle, 'particles');
    if (particlesHandle) {
      await scanParticlesFolder(particlesHandle, templateImageUrls);
    }

    if (resolvedPrefabsHandle) {
      const thumbsHandle = await tryGetDirectory(resolvedPrefabsHandle, '.thumbnails');
      prefabThumbnailUrls = await scanPrefabThumbnails(thumbsHandle);
    }

    return {
      prefabsHandle: resolvedPrefabsHandle,
      scenes,
      prefabs,
      templates,
      templateImageUrls,
      templateAtlases,
      sprites,
      prefabThumbnailUrls,
      scanIssues,
    };
  } catch (error) {
    revokeObjectUrls(templateImageUrls, sprites.map(sprite => sprite.url));
    revokeObjectUrls(prefabThumbnailUrls);
    throw error;
  }
}


export async function refreshProjectScenes(scenesHandle: ProjectDirectoryHandle): Promise<ProjectSceneEntry[]> {
  return scanScenes(scenesHandle);
}

export async function refreshProjectPrefabs(prefabsHandle: ProjectDirectoryHandle | null): Promise<ProjectPrefabEntry[]> {
  return scanPrefabs(prefabsHandle);
}

export async function readSceneFile(handle: ProjectFileHandle): Promise<string> {
  return readProjectText(handle);
}

export async function readPrefabFile(handle: ProjectFileHandle): Promise<string> {
  return readProjectText(handle);
}

export async function writeSceneFile(handle: ProjectFileHandle, xml: string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(xml);
  } finally {
    await writable.close();
  }
}

export async function writePrefabFile(handle: ProjectFileHandle, xml: string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(xml);
  } finally {
    await writable.close();
  }
}

export async function writeSceneAs(
  scenesHandle: ProjectDirectoryHandle,
  filename: string,
  xml: string,
): Promise<ProjectSceneEntry> {
  const normalized = filename.toLowerCase().endsWith('.esc') ? filename : `${filename}.esc`;
  const handle = await scenesHandle.getFileHandle(normalized, { create: true });
  await writeSceneFile(handle, xml);
  return { name: normalized, handle };
}

export async function writePrefabAs(
  prefabsHandle: ProjectDirectoryHandle,
  filename: string,
  xml: string,
): Promise<ProjectPrefabEntry> {
  const normalized = filename.toLowerCase().endsWith('.prf') ? filename : `${filename}.prf`;
  const handle = await prefabsHandle.getFileHandle(normalized, { create: true });
  await writePrefabFile(handle, xml);
  const entities = parsePrefab(xml);
  return { name: normalized, handle, entities };
}

export async function findEntityFileHandle(
  entitiesHandle: ProjectDirectoryHandle | null,
  name: string,
): Promise<ProjectFileHandle | null> {
  if (!entitiesHandle) return null;
  const normalizedName = name.replace(/\.ent$/i, '');
  const fileName = `${normalizedName}.ent`;
  try {
    const fileEntries = await collectAllFiles(entitiesHandle);
    for (const [relativePath, handle] of fileEntries) {
      if (
        relativePath === fileName ||
        relativePath.endsWith(`/${fileName}`) ||
        relativePath.replace(/\.ent$/i, '') === normalizedName
      ) {
        return handle;
      }
    }
  } catch {
    // ignore lookup error
  }
  return null;
}

// ─── Prefab Thumbnail IO ──────────────────────────────────────────────────────

/**
 * Gets or creates the hidden `.thumbnails` subdirectory inside the prefabs folder.
 * Returns null if the operation fails (e.g. no permission).
 */
export async function getOrCreateThumbnailsHandle(
  prefabsHandle: ProjectDirectoryHandle,
): Promise<ProjectDirectoryHandle | null> {
  try {
    return await prefabsHandle.getDirectoryHandle('.thumbnails', { create: true });
  } catch {
    return null;
  }
}

/**
 * Writes a JPEG blob to prefabs/.thumbnails/.{prefabName}.jpg
 * prefabName should be e.g. "myprefab.prf"
 */
export async function writePrefabThumbnail(
  thumbnailsHandle: ProjectDirectoryHandle,
  prefabName: string,
  blob: Blob,
): Promise<void> {
  const base = prefabName.replace(/\.prf$/i, '');
  const fileName = `.${base}.jpg`;
  const fileHandle = await thumbnailsHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/**
 * Scans the `.thumbnails` directory and returns a map of
 * { "myprefab.prf": "blob:..." } for all found thumbnail files.
 */
export async function scanPrefabThumbnails(
  thumbnailsHandle: ProjectDirectoryHandle | null,
): Promise<Record<string, string>> {
  if (!thumbnailsHandle) return {};
  const result: Record<string, string> = {};
  try {
    for await (const [name, handle] of thumbnailsHandle.entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.jpg')) {
        try {
          const fileHandle = handle as ProjectFileHandle;
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          const prefabName = prefabNameFromThumbnailFile(name);
          result[prefabName] = url;
        } catch {
          // ignore individual file errors
        }
      }
    }
  } catch {
    // ignore scan errors
  }
  return result;
}
