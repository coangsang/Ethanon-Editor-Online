import type { EntityInstance, EntityTemplate, SpriteAtlas } from '../types';
import { resolveImageUrl } from './resolveImageUrl';
import { getAllDescendantIds } from './sceneHierarchy';
import { resolveEntityTemplate } from './entityTemplate';

const THUMBNAIL_SIZE = 128;
const PADDING_RATIO = 0.10; // 10% padding around bounding box
const BACKGROUND_COLOR = '#1a1a2e';

interface ResolvedSpriteItem {
  entity: EntityInstance;
  template: EntityTemplate;
  url: string;
  img: HTMLImageElement;
  pw: number;
  ph: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Load an image from a URL, returning null on failure. */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    // Do NOT set crossOrigin for blob: URLs as Chromium can fail with CORS error
    if (!url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function getAtlasForTemplate(template: EntityTemplate, atlases: Record<string, SpriteAtlas>): SpriteAtlas | null {
  if (!template.spriteFile) return null;
  return atlases[template.spriteFile]
    ?? atlases[template.spriteFile.toLowerCase()]
    ?? atlases[template.spriteFile.split('/').pop() ?? '']
    ?? null;
}

/**
 * Generates a 128×128 JPEG thumbnail for a prefab.
 *
 * @returns Blob (image/jpeg) or null if no sprites could be resolved.
 */
export async function generatePrefabThumbnail(
  rootEntity: EntityInstance,
  allEntities: EntityInstance[],
  templates: Record<string, EntityTemplate>,
  templateImageUrls: Record<string, string>,
  templateAtlases: Record<string, SpriteAtlas>,
  size = THUMBNAIL_SIZE,
): Promise<Blob | null> {
  // Collect all entities in this prefab tree (root entity + descendants)
  const descendantIds = getAllDescendantIds(allEntities, new Set([rootEntity.id]));
  const prefabEntities = allEntities.filter(e => descendantIds.has(e.id));

  // Step 1: Collect candidates (skipping hidden entities and those without sprite)
  const candidateList: Array<{ entity: EntityInstance; template: EntityTemplate; url: string }> = [];

  for (const entity of prefabEntities) {
    if (entity.hide) continue;

    const template = resolveEntityTemplate(entity, templates);
    if (!template || !template.spriteFile) continue;

    const url = resolveImageUrl(templateImageUrls, template.spriteFile);
    if (!url) continue;

    candidateList.push({ entity, template, url });
  }

  if (candidateList.length === 0) {
    return null;
  }

  // Step 2: Load all unique image assets concurrently
  const imageMap = new Map<string, HTMLImageElement | null>();
  const uniqueUrls = [...new Set(candidateList.map(c => c.url))];
  await Promise.all(uniqueUrls.map(async url => {
    imageMap.set(url, await loadImage(url));
  }));

  // Step 3: Compute exact frame sizes, scales, and rotated bounding boxes
  const resolvedItems: ResolvedSpriteItem[] = [];

  for (const item of candidateList) {
    const img = imageMap.get(item.url);
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) continue;

    const { entity, template } = item;
    const scaleX = Math.abs(template.scale?.x ?? 1);
    const scaleY = Math.abs(template.scale?.y ?? 1);
    const frameIndex = entity.spriteFrame ?? 0;

    let sx: number;
    let sy: number;
    let sw: number;
    let sh: number;

    const atlas = getAtlasForTemplate(template, templateAtlases);
    if (atlas && atlas.frames.length > 0) {
      const safeFrame = Math.max(0, Math.min(frameIndex, atlas.frames.length - 1));
      const atlasFrame = atlas.frames[safeFrame];
      sx = atlasFrame.x;
      sy = atlasFrame.y;
      sw = atlasFrame.width;
      sh = atlasFrame.height;
    } else {
      const cutX = Math.max(1, Math.floor(template.spriteCut?.x || 1));
      const cutY = Math.max(1, Math.floor(template.spriteCut?.y || 1));
      const totalFrames = cutX * cutY;
      const safeFrame = Math.max(0, Math.min(frameIndex, totalFrames - 1));

      const fw = img.naturalWidth / cutX;
      const fh = img.naturalHeight / cutY;
      const col = safeFrame % cutX;
      const row = Math.floor(safeFrame / cutX);

      sx = col * fw;
      sy = row * fh;
      sw = fw;
      sh = fh;
    }

    const pw = sw * scaleX;
    const ph = sh * scaleY;

    // Compute bounding box taking rotation into account to prevent clipping
    const rad = (entity.angle || 0) * (Math.PI / 180);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const bbw = pw * cos + ph * sin;
    const bbh = pw * sin + ph * cos;

    const minX = entity.position.x - bbw / 2;
    const maxX = entity.position.x + bbw / 2;
    const minY = entity.position.y - bbh / 2;
    const maxY = entity.position.y + bbh / 2;

    resolvedItems.push({
      entity,
      template,
      url: item.url,
      img,
      pw,
      ph,
      sx,
      sy,
      sw,
      sh,
      minX,
      minY,
      maxX,
      maxY,
    });
  }

  if (resolvedItems.length === 0) {
    return null;
  }

  // Step 4: Calculate combined world-space bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of resolvedItems) {
    minX = Math.min(minX, item.minX);
    minY = Math.min(minY, item.minY);
    maxX = Math.max(maxX, item.maxX);
    maxY = Math.max(maxY, item.maxY);
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return null;

  // Step 5: Fit all entities into thumbnail size with padding
  const padded = size * (1 - 2 * PADDING_RATIO);
  const scale = Math.min(padded / bw, padded / bh);
  const drawW = bw * scale;
  const drawH = bh * scale;
  const offsetX = (size - drawW) / 2;
  const offsetY = (size - drawH) / 2;

  // Step 6: Create OffscreenCanvas and configure rendering context
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Step 7: Sort by Z-Index (lower Z draws first, higher Z draws on top)
  resolvedItems.sort((a, b) => (a.entity.position.z ?? 0) - (b.entity.position.z ?? 0));

  // Step 8: Draw each sprite onto the canvas
  for (const item of resolvedItems) {
    const { entity, template, img, pw, ph, sx, sy, sw, sh } = item;

    const cx = offsetX + (entity.position.x - minX) * scale;
    const cy = offsetY + (entity.position.y - minY) * scale;
    const dw = pw * scale;
    const dh = ph * scale;

    ctx.save();
    ctx.translate(cx, cy);

    if (entity.angle) {
      ctx.rotate((entity.angle * Math.PI) / 180);
    }

    const flipX = entity.flipX ? -1 : 1;
    const flipY = entity.flipY ? -1 : 1;
    if (flipX !== 1 || flipY !== 1) {
      ctx.scale(flipX, flipY);
    }

    // Color tinting (DiffuseColor)
    const color = entity.diffuseColor ?? entity.color ?? template.diffuseColor;
    if (color?.a !== undefined) {
      ctx.globalAlpha = color.a;
    }

    const hasTint = color && (color.r < 0.99 || color.g < 0.99 || color.b < 0.99);

    if (hasTint && sw > 0 && sh > 0) {
      try {
        const tintCanvas = new OffscreenCanvas(Math.ceil(sw), Math.ceil(sh));
        const tintCtx = tintCanvas.getContext('2d');
        if (tintCtx) {
          tintCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          tintCtx.globalCompositeOperation = 'multiply';
          tintCtx.fillStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
          tintCtx.fillRect(0, 0, sw, sh);
          tintCtx.globalCompositeOperation = 'destination-atop';
          tintCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          ctx.drawImage(tintCanvas, -dw / 2, -dh / 2, dw, dh);
        } else {
          ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        }
      } catch {
        ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
      }
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    }

    ctx.restore();
  }

  // Step 9: Export to JPEG Blob
  try {
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  } catch {
    return null;
  }
}

/** Returns the thumbnail filename for a prefab name. e.g. "myprefab.prf" → ".myprefab.jpg" */
export function prefabThumbnailFileName(prefabName: string): string {
  const base = prefabName.replace(/\.prf$/i, '');
  return `.${base}.jpg`;
}

/** Returns the prefab name from a thumbnail filename. e.g. ".myprefab.jpg" → "myprefab.prf" */
export function prefabNameFromThumbnailFile(thumbnailName: string): string {
  const withoutDot = thumbnailName.startsWith('.') ? thumbnailName.slice(1) : thumbnailName;
  const withoutExt = withoutDot.replace(/\.jpg$/i, '');
  return `${withoutExt}.prf`;
}
