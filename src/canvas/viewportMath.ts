import * as PIXI from 'pixi.js';
import type { EntityInstance, EntityTemplate, EntityType, ParticleSystemConfig, SpriteAtlas } from '../types';
import type { Bounds, DrawSortKey, RenderFrame } from './viewportTypes';

export const ALLOWED_SNAP_SIZES = [8, 16, 32, 64, 128, 256, 512, 1024] as const;
export type SnapSize = typeof ALLOWED_SNAP_SIZES[number];

export const GRID_SIZE = 16;
export const PLACEHOLDER_SIZE = 24;
export const DEFAULT_PARALLAX_ORIGIN = { x: 0.5, y: 0.5 };
export const PARTICLE_SYSTEM_UPDATE_TIME_MS = 50; // Target particle update interval in ms (~30 FPS: 33ms, ~24 FPS: 41ms)( 1/FPS * 1000 -> n ms )
export const PARTICLE_VIEWPORT_PADDING_PX = 128;
const PARTICLE_DEPTH_SHIFT = 10.0;

const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 1, 3, 2]);
const VERTICAL_UVS = new Float32Array([0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1]);
const VERTICAL_INDICES = new Uint16Array([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);

export const HORIZONTAL_POINTS = [
  { u: 0, v: 0 },
  { u: 1, v: 0 },
  { u: 0, v: 1 },
  { u: 1, v: 1 },
] as const;

export const VERTICAL_POINTS = [
  { u: 0, v: 0 },
  { u: 1, v: 0 },
  { u: 0, v: 0.5 },
  { u: 1, v: 0.5 },
  { u: 0, v: 1 },
  { u: 1, v: 1 },
] as const;

export function screenToWorld(sx: number, sy: number, camera: { x: number; y: number; zoom: number }) {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  };
}

type ParticleViewport = { width: number; height: number };

export function getParticleEmitterBounds(
  entity: EntityInstance,
  particleSystem: ParticleSystemConfig,
  zAxisDirection: { x: number; y: number },
) {
  const angle = -entity.angle * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const startX = particleSystem.startPoint.x * cos - particleSystem.startPoint.y * sin;
  const startY = particleSystem.startPoint.x * sin + particleSystem.startPoint.y * cos;
  const zTotal = entity.position.z + particleSystem.startPoint.z;
  const centerX = entity.position.x + startX + zAxisDirection.x * zTotal;
  const centerY = entity.position.y + startY + zAxisDirection.y * zTotal;
  const radius = Math.max(0, particleSystem.boundingSphere);
  return {
    x: centerX - radius,
    y: centerY - radius,
    width: radius * 2,
    height: radius * 2,
  };
}

/**
 * Tests the configured particle bounding sphere against the viewport plus a
 * small screen-space prewarm margin. The centre follows the same start-point,
 * rotation, and Z projection used by ParticleSystemRuntime.
 */
export function isParticleEmitterInViewport(
  entity: EntityInstance,
  particleSystem: ParticleSystemConfig,
  camera: { x: number; y: number; zoom: number },
  viewport: ParticleViewport,
  zAxisDirection: { x: number; y: number },
) {
  const zoom = Math.max(camera.zoom, 0.001);
  const padding = PARTICLE_VIEWPORT_PADDING_PX / zoom;
  const left = -camera.x / zoom - padding;
  const top = -camera.y / zoom - padding;
  const right = left + Math.max(viewport.width, 1) / zoom + padding * 2;
  const bottom = top + Math.max(viewport.height, 1) / zoom + padding * 2;

  const bounds = getParticleEmitterBounds(entity, particleSystem, zAxisDirection);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radius = bounds.width / 2;
  const closestX = Math.max(left, Math.min(centerX, right));
  const closestY = Math.max(top, Math.min(centerY, bottom));
  const dx = centerX - closestX;
  const dy = centerY - closestY;

  return dx * dx + dy * dy <= radius * radius;
}

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function snapVal(v: number, active: boolean, step: number = 16): number {
  return active ? Math.round(v / step) * step : Math.round(v);
}

export function computeDragDelta(
  start: { x: number; y: number },
  rawDelta: { x: number; y: number },
  axisConstraint: 'x' | 'y' | 'free',
  snapToGrid: boolean,
  gridSize: number,
) {
  return {
    x: axisConstraint === 'y'
      ? 0
      : snapVal(start.x + rawDelta.x, snapToGrid, gridSize) - start.x,
    y: axisConstraint === 'x'
      ? 0
      : snapVal(start.y + rawDelta.y, snapToGrid, gridSize) - start.y,
  };
}

export interface AdaptiveGridInfo {
  majorStep: number;
  minorStep: number | null;
}

export function computeAdaptiveGridStep(gridSize: number, zoom: number): AdaptiveGridInfo {
  const baseStep = gridSize > 0 ? gridSize : 16;
  const safeZoom = Math.max(0.001, zoom);
  const minScreenSpacing = 14;

  let majorStep = baseStep;
  while (majorStep * safeZoom < minScreenSpacing) {
    majorStep *= 2;
  }

  let minorStep: number | null = null;
  if (baseStep * safeZoom >= 28) {
    minorStep = baseStep / 2;
    if (minorStep * safeZoom >= 28) {
      minorStep = baseStep / 4;
    }
  } else if (majorStep > baseStep) {
    if (baseStep * safeZoom >= 7) {
      minorStep = baseStep;
    }
  }

  return { majorStep, minorStep };
}

export function computeEntityDrawSortKey(entity: EntityInstance, type: EntityType): DrawSortKey {
  return {
    depth: type === 'overall' ? 999999 + entity.position.z : entity.position.z,
    pieceOrder:
      type === 'ground_decal' ? -20 :
      type === 'opaque_decal' ? -10 :
      0,
    yOrder: type === 'vertical' ? entity.position.y : 0,
    entityUid: entity.editorEntityUID,
  };
}

function computeParticleDepth(
  type: EntityType,
  ownerDepth: number,
  entityZ: number,
  particleZ: number,
) {
  if (type === 'layerable' || type === 'overall') {
    return ownerDepth;
  }
  if (type === 'vertical') {
    return entityZ + particleZ + PARTICLE_DEPTH_SHIFT;
  }
  return entityZ + particleZ;
}

export function computeParticleDrawSortKey(
  entity: EntityInstance,
  type: EntityType,
  particleSystem: ParticleSystemConfig,
  particleIndex: number,
  ownerKey: DrawSortKey,
): DrawSortKey {
  return {
    depth: computeParticleDepth(type, ownerKey.depth, entity.position.z, particleSystem.startPoint.z),
    pieceOrder: 10 + particleIndex,
    yOrder: ownerKey.yOrder,
    entityUid: entity.editorEntityUID,
  };
}

export function compareDrawSortKeys(a: DrawSortKey, b: DrawSortKey) {
  if (a.depth !== b.depth) return a.depth - b.depth;
  if (a.pieceOrder !== b.pieceOrder) return a.pieceOrder - b.pieceOrder;
  if (a.yOrder !== b.yOrder) return a.yOrder - b.yOrder;
  return a.entityUid.localeCompare(b.entityUid);
}

export function drawSortKeySignature(key: DrawSortKey) {
  return `${key.depth}:${key.pieceOrder}:${key.yOrder}:${key.entityUid}`;
}

export function particleRuntimeSignature(config: ParticleSystemConfig, textureKey: string, revision: number) {
  return `${textureKey}:${revision}:${JSON.stringify(config)}`;
}

export function createEntityMesh(texture: PIXI.Texture, useVerticalGeometry: boolean): PIXI.Mesh {
  const vertices = new Float32Array(useVerticalGeometry ? 12 : 8);
  const uvs = useVerticalGeometry ? VERTICAL_UVS : QUAD_UVS;
  const indices = new Uint32Array(useVerticalGeometry ? VERTICAL_INDICES : QUAD_INDICES);
  const geometry = new PIXI.MeshGeometry({
    positions: vertices,
    uvs,
    indices,
  });
  const mesh = new PIXI.Mesh({
    texture,
    geometry,
  });
  mesh.eventMode = 'static';
  return mesh;
}

export function calculateBounds(vertices: Float32Array): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < vertices.length; i += 2) {
    if (minX > vertices[i]) minX = vertices[i];
    if (maxX < vertices[i]) maxX = vertices[i];
    if (minY > vertices[i + 1]) minY = vertices[i + 1];
    if (maxY < vertices[i + 1]) maxY = vertices[i + 1];
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface ParallaxContext {
  globalParallaxIntensity: number;
  screenWidth: number;
  originPxX: number;
  originPxY: number;
}

export function computeParallaxContext(
  parallaxIntensity: number | undefined,
  parallaxOriginNormalized: { x: number; y: number } | undefined,
  parallaxPreviewActive: boolean,
  app: PIXI.Application | null,
): ParallaxContext {
  const globalParallaxIntensity = parallaxIntensity ?? 0;
  if (!app || !app.renderer) {
    return {
      globalParallaxIntensity,
      screenWidth: 1,
      originPxX: 0,
      originPxY: 0,
    };
  }
  const origin = parallaxPreviewActive
    ? (parallaxOriginNormalized ?? DEFAULT_PARALLAX_ORIGIN)
    : DEFAULT_PARALLAX_ORIGIN;
  const screenWidth = Math.max(app.renderer.width, 1);
  const screenHeight = Math.max(app.renderer.height, 1);
  return {
    globalParallaxIntensity,
    screenWidth,
    originPxX: origin.x * screenWidth,
    originPxY: origin.y * screenHeight,
  };
}

export function applyEntityTransformToMesh(
  mesh: PIXI.Mesh,
  entity: EntityInstance,
  template: EntityTemplate | null,
  renderFrame: RenderFrame,
  camera: { x: number; y: number; zoom: number },
  useVerticalGeometry: boolean,
  parallaxContext: ParallaxContext,
) {
  const { globalParallaxIntensity, screenWidth, originPxX, originPxY } = parallaxContext;
  const textureWidth = renderFrame.layoutWidth;
  const textureHeight = renderFrame.layoutHeight;
  const templateScale = template?.scale ?? { x: 1, y: 1 };
  const pivotAdjust = template?.pivotAdjust ?? { x: 0, y: 0 };
  const anchorX = renderFrame.pivotX + pivotAdjust.x / Math.max(textureWidth, 1);
  const anchorY = renderFrame.pivotY + pivotAdjust.y / Math.max(textureHeight, 1);
  const flipX = entity.flipX ? -1 : 1;
  const flipY = entity.flipY ? -1 : 1;
  const angle = -entity.angle * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const effectiveIntensity = globalParallaxIntensity * (template?.parallaxIntensity ?? 1);
  const baseZ = entity.position.z;
  const bottomLocalY = (renderFrame.offsetY + renderFrame.frameHeight - anchorY * textureHeight) * templateScale.y * flipY;
  const vertices = mesh.geometry.positions;
  const points = useVerticalGeometry ? VERTICAL_POINTS : HORIZONTAL_POINTS;
  const isParallaxActive = effectiveIntensity !== 0 && baseZ !== 0;

  if (isParallaxActive) {
    mesh.position.set(0, 0);
    mesh.rotation = 0;
    mesh.scale.set(1, 1);

    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const localX = (renderFrame.offsetX + point.u * renderFrame.frameWidth - anchorX * textureWidth) * templateScale.x * flipX;
      const localY = (renderFrame.offsetY + point.v * renderFrame.frameHeight - anchorY * textureHeight) * templateScale.y * flipY;
      const worldX = entity.position.x + localX * cos - localY * sin;
      const worldY = entity.position.y + localX * sin + localY * cos;
      const verticalOffset = useVerticalGeometry ? Math.max(0, bottomLocalY - localY) : 0;
      const effectiveZ = baseZ + verticalOffset;
      let screenX = camera.x + worldX * camera.zoom;
      let screenY = camera.y + worldY * camera.zoom;
      screenX += ((screenX - originPxX) / screenWidth) * effectiveZ * effectiveIntensity;
      screenY += ((screenY - originPxY) / screenWidth) * effectiveZ * effectiveIntensity;
      const vertexX = (screenX - camera.x) / camera.zoom;
      const vertexY = (screenY - camera.y) / camera.zoom;

      vertices[index * 2] = vertexX;
      vertices[index * 2 + 1] = vertexY;
    }

    mesh.geometry.getBuffer('aPosition').update();
    return {
      parallaxGeometryActive: true,
      bounds: calculateBounds(vertices),
    };
  }

  // Standard non-parallax transform: use Pixi node transform + update local vertices only if changed
  mesh.position.set(entity.position.x, entity.position.y);
  mesh.rotation = angle;
  mesh.scale.set(1, 1);

  let localChanged = false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const localX = (renderFrame.offsetX + point.u * renderFrame.frameWidth - anchorX * textureWidth) * templateScale.x * flipX;
    const localY = (renderFrame.offsetY + point.v * renderFrame.frameHeight - anchorY * textureHeight) * templateScale.y * flipY;

    if (vertices[index * 2] !== localX || vertices[index * 2 + 1] !== localY) {
      vertices[index * 2] = localX;
      vertices[index * 2 + 1] = localY;
      localChanged = true;
    }

    const worldX = entity.position.x + localX * cos - localY * sin;
    const worldY = entity.position.y + localX * sin + localY * cos;
    if (worldX < minX) minX = worldX;
    if (worldX > maxX) maxX = worldX;
    if (worldY < minY) minY = worldY;
    if (worldY > maxY) maxY = worldY;
  }

  if (localChanged) {
    mesh.geometry.getBuffer('aPosition').update();
  }

  return {
    parallaxGeometryActive: false,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}

export function transformBounds(bounds: Bounds, camera: { x: number; y: number; zoom: number }): Bounds {
  return {
    x: camera.x + bounds.x * camera.zoom,
    y: camera.y + bounds.y * camera.zoom,
    width: bounds.width * camera.zoom,
    height: bounds.height * camera.zoom,
  };
}

export function normalizeSpriteCut(cut: EntityTemplate['spriteCut']) {
  return {
    x: Math.max(1, Math.floor(Number.isFinite(cut.x) ? cut.x : 1)),
    y: Math.max(1, Math.floor(Number.isFinite(cut.y) ? cut.y : 1)),
  };
}

export function clampSpriteFrame(spriteFrame: number, spriteCut: EntityTemplate['spriteCut']) {
  const cut = normalizeSpriteCut(spriteCut);
  const maxFrame = cut.x * cut.y - 1;
  const frame = Number.isFinite(spriteFrame) ? Math.floor(spriteFrame) : 0;
  return Math.max(0, Math.min(maxFrame, frame));
}

export function clampFrameIndex(spriteFrame: number, frameCount: number) {
  const maxFrame = Math.max(0, frameCount - 1);
  const frame = Number.isFinite(spriteFrame) ? Math.floor(spriteFrame) : 0;
  return Math.max(0, Math.min(maxFrame, frame));
}

export function getAtlasForTemplate(template: EntityTemplate, atlases: Record<string, SpriteAtlas>) {
  const basename = template.spriteFile.split('/').pop() ?? template.spriteFile;
  return atlases[template.spriteFile]
    || atlases[`entities/${basename}`]
    || atlases[basename]
    || null;
}
