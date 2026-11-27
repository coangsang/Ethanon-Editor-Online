/* eslint react-hooks/immutability: off, react-hooks/preserve-manual-memoization: off */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { EntityTemplate, SpriteAtlas } from '../types';
import { resolveExternalTemplate } from '../utils/entityTemplate';
import { resolveEntityRenderTemplate, type EntityCustomRenderContext } from './entityCustomRender';
import type { RenderTemplate } from './renderTemplate';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { measurePerformanceMetric } from '../utils/performanceProfiler';
import {
  clampFrameIndex,
  clampSpriteFrame,
  getAtlasForTemplate,
  normalizeSpriteCut,
  PLACEHOLDER_SIZE,
} from './viewportMath';
import type { RenderFrame, ViewportRefs } from './viewportTypes';
import { computeCompositeLayout } from './compositeLayout';
import { ViewportTextureAssetManager, type AssetLoadResult } from './ViewportTextureAssetManager';

async function releaseLease(lease: AssetLoadResult<PIXI.Texture>, reason: string) {
  try {
    await lease.release();
  } catch (error) {
    console.warn(`[Viewport] Failed to release texture lease (${reason}):`, error);
  }
}

function destroyFrameTextures(textures: Iterable<PIXI.Texture>) {
  for (const texture of textures) {
    try {
      texture.destroy(false);
    } catch {
      // Continue disposing independent frame wrappers.
    }
  }
}

/** Composite textures own their canvas source, so it is destroyed with them. */
function destroyCompositeTextures(textures: Iterable<PIXI.Texture>) {
  for (const texture of textures) {
    try {
      texture.destroy(true);
    } catch {
      // Continue disposing independent composites.
    }
  }
}

type DeferredTextureCleanup = {
  lease: AssetLoadResult<PIXI.Texture> | null;
  frameTextures: PIXI.Texture[];
  compositeTextures: PIXI.Texture[];
};

/** A cache swap can finish before meshes (including particle frames) stop using it. */
function stageUsesRetiredTextures(
  stage: PIXI.Container | undefined,
  cleanup: DeferredTextureCleanup,
  activeLease: AssetLoadResult<PIXI.Texture> | null,
): boolean {
  if (!stage) return false;
  const retiredTextures = new Set([...cleanup.frameTextures, ...cleanup.compositeTextures]);
  const activeTextures = new Set(activeLease?.assets.values());
  const activeSources = new Set([...activeTextures].map(texture => texture.source));
  const retiredSources = new Set<PIXI.TextureSource>();
  for (const texture of cleanup.lease?.assets.values() ?? []) {
    // Shared assets remain retained by the current lease and can be released safely.
    if (activeTextures.has(texture)) continue;
    retiredTextures.add(texture);
    if (texture.source && !activeSources.has(texture.source)) retiredSources.add(texture.source);
  }
  const pending: PIXI.Container[] = [stage];
  while (pending.length > 0) {
    const object = pending.pop()!;
    const texture = 'texture' in object ? object.texture as PIXI.Texture | null : null;
    if (texture && (retiredTextures.has(texture) || retiredSources.has(texture.source))) return true;
    pending.push(...object.children);
  }
  return false;
}

type UseViewportTexturesParams = {
  refs: ViewportRefs;
  sceneEntities: ReturnType<typeof import('../store/sceneStore').useSceneStore.getState>['scene']['entities'];
  templates: Record<string, EntityTemplate>;
  templateAtlases: Record<string, SpriteAtlas>;
  templateImageUrls: Record<string, string>;
  placingTemplate?: string | null;
  customRenderContext?: EntityCustomRenderContext;
};

export function useViewportTextures({
  refs,
  sceneEntities,
  templates,
  templateAtlases,
  templateImageUrls,
  placingTemplate,
  customRenderContext,
}: UseViewportTexturesParams) {
  const [textureRevision, setTextureRevision] = useState(0);
  const [assetManager] = useState(() => new ViewportTextureAssetManager<PIXI.Texture>(
    url => PIXI.Assets.load<PIXI.Texture>({ src: url, parser: 'loadTextures' }),
    url => PIXI.Assets.unload(url),
  ));
  const activeLeaseRef = useRef<AssetLoadResult<PIXI.Texture> | null>(null);
  const deferredCleanupRef = useRef(new Map<number, DeferredTextureCleanup>());
  // Composite render frames keyed by their layers' frame textures.
  const compositeFrameMapRef = useRef(new Map<string, RenderFrame>());
  const committedSignatureRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const { keyToUrl, signature } = measurePerformanceMetric('texture.scan', sceneEntities.length, () => {
      const templateValuesBySprite = new Map<string, EntityTemplate>();
      for (const template of Object.values(templates)) {
        if (template.spriteFile) templateValuesBySprite.set(template.spriteFile, template);
        for (const particleSystem of template.particleSystems ?? []) {
          if (particleSystem.bitmap) {
            templateValuesBySprite.set(
              particleSystem.bitmap,
              { name: particleSystem.bitmap, spriteFile: particleSystem.bitmap } as EntityTemplate,
            );
          }
        }
      }
      for (const entity of sceneEntities) {
        const template = resolveEntityRenderTemplate(entity, templates, customRenderContext);
        if (template?.spriteFile) templateValuesBySprite.set(template.spriteFile, template);
        for (const layer of template?.compositeLayers ?? []) {
          templateValuesBySprite.set(
            layer.spriteFile,
            { name: layer.spriteFile, spriteFile: layer.spriteFile } as EntityTemplate,
          );
        }
        for (const particleSystem of template?.particleSystems ?? []) {
          if (particleSystem.bitmap) {
            templateValuesBySprite.set(
              particleSystem.bitmap,
              { name: particleSystem.bitmap, spriteFile: particleSystem.bitmap } as EntityTemplate,
            );
          }
        }
      }
      if (placingTemplate) {
        const template = resolveExternalTemplate(placingTemplate, templates);
        if (template?.spriteFile) {
          templateValuesBySprite.set(template.spriteFile, template);
        } else {
          templateValuesBySprite.set(
            placingTemplate,
            { name: placingTemplate, spriteFile: placingTemplate } as EntityTemplate,
          );
        }
      }

      const nextKeyToUrl = new Map<string, string>();
      for (const template of templateValuesBySprite.values()) {
        const key = template.spriteFile;
        if (!key) continue;
        const imageUrl = resolveImageUrl(templateImageUrls, key);
        if (imageUrl) {
          nextKeyToUrl.set(key, imageUrl);
        } else {
          console.warn(`[Viewport] Image not found for template "${template.name}" (expected spriteFile: "${key}").`);
        }
      }

      return {
        keyToUrl: nextKeyToUrl,
        signature: JSON.stringify(
          [...nextKeyToUrl.entries()].sort(([left], [right]) => left.localeCompare(right)),
        ),
      };
    });
    if (signature === committedSignatureRef.current) return;

    let cancelled = false;
    const generation = ++generationRef.current;
    const load = async () => {
      const lease = await assetManager.acquire(keyToUrl.values());
      if (cancelled || generation !== generationRef.current) {
        await releaseLease(lease, 'stale generation');
        return;
      }

      for (const [url, error] of lease.errors) {
        console.error(`[Viewport] Failed to load Pixi texture "${url}":`, error);
      }

      const { previousFrameTextures, previousCompositeTextures, previousLease } = measurePerformanceMetric(
        'texture.commit',
        sceneEntities.length,
        () => {
          const previousFrames = [...refs.frameTextureMapRef.current.values()];
          const previousComposites = [...compositeFrameMapRef.current.values()].map(frame => frame.texture);
          refs.frameTextureMapRef.current.clear();
          compositeFrameMapRef.current.clear();
          refs.baseTextureMapRef.current.clear();
          refs.textureUrlMapRef.current.clear();

          for (const [key, url] of keyToUrl) {
            const texture = lease.assets.get(url);
            if (!texture) continue;
            refs.baseTextureMapRef.current.set(key, texture);
            refs.textureUrlMapRef.current.set(key, url);
          }

          const previous = activeLeaseRef.current;
          activeLeaseRef.current = lease;
          committedSignatureRef.current = signature;
          refs.boundsMapRef.current.clear();
          refs.drawSortSignatureRef.current = '';
          setTextureRevision(revision => revision + 1);
          return {
            previousFrameTextures: previousFrames,
            previousCompositeTextures: previousComposites,
            previousLease: previous,
          };
        },
      );

      const cleanup: DeferredTextureCleanup = {
        lease: previousLease,
        frameTextures: previousFrameTextures,
        compositeTextures: previousCompositeTextures,
      };
      const disposeWhenUnused = () => {
        deferredCleanupRef.current.delete(cleanupFrame);
        if (stageUsesRetiredTextures(refs.appRef?.current?.stage, cleanup, activeLeaseRef.current)) {
          cleanupFrame = requestAnimationFrame(disposeWhenUnused);
          deferredCleanupRef.current.set(cleanupFrame, cleanup);
          return;
        }
        destroyFrameTextures(previousFrameTextures);
        destroyCompositeTextures(previousCompositeTextures);
        if (previousLease) void releaseLease(previousLease, 'cache swap');
      };
      let cleanupFrame = requestAnimationFrame(disposeWhenUnused);
      deferredCleanupRef.current.set(cleanupFrame, cleanup);
    };

    void load();
    return () => { cancelled = true; };
  }, [assetManager, refs, templateImageUrls, templates, sceneEntities, placingTemplate, customRenderContext]);

  useEffect(() => () => {
    generationRef.current++;
    for (const [frameId, cleanup] of deferredCleanupRef.current) {
      cancelAnimationFrame(frameId);
      destroyFrameTextures(cleanup.frameTextures);
      destroyCompositeTextures(cleanup.compositeTextures);
      if (cleanup.lease) void releaseLease(cleanup.lease, 'viewport cleanup');
    }
    deferredCleanupRef.current.clear();
    if (activeLeaseRef.current) {
      void releaseLease(activeLeaseRef.current, 'viewport cleanup');
    }
    activeLeaseRef.current = null;
    committedSignatureRef.current = null;

    destroyFrameTextures(refs.frameTextureMapRef.current.values());
    refs.frameTextureMapRef.current.clear();
    destroyCompositeTextures([...compositeFrameMapRef.current.values()].map(frame => frame.texture));
    compositeFrameMapRef.current.clear();
    refs.baseTextureMapRef.current.clear();
    refs.textureUrlMapRef.current.clear();
  }, [assetManager, refs]);

  const getSingleRenderFrame = useCallback((template: RenderTemplate, requestedFrame: number): RenderFrame => {
    const spriteFrame = template.renderFirstFrameOnly ? 0 : requestedFrame;
    const key = template.spriteFile;
    const fullTexture = refs.baseTextureMapRef.current.get(key);

    if (!fullTexture) {
      if (!refs.placeholderTextureRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = PLACEHOLDER_SIZE;
        canvas.height = PLACEHOLDER_SIZE;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#8844aa';
          context.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
          context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          context.lineWidth = 1;
          context.strokeRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
        }
        refs.placeholderTextureRef.current = PIXI.Texture.from(canvas);
      }
      return {
        texture: refs.placeholderTextureRef.current,
        layoutWidth: PLACEHOLDER_SIZE,
        layoutHeight: PLACEHOLDER_SIZE,
        frameWidth: PLACEHOLDER_SIZE,
        frameHeight: PLACEHOLDER_SIZE,
        offsetX: 0,
        offsetY: 0,
        pivotX: 0.5,
        pivotY: template.type === 'vertical' ? 1 : 0.5,
      };
    }

    const atlas = getAtlasForTemplate(template, templateAtlases);
    if (atlas && atlas.frames.length > 0) {
      const safeFrame = clampFrameIndex(spriteFrame, atlas.frames.length);
      const atlasFrame = atlas.frames[safeFrame];
      const x = Math.max(0, Math.min(fullTexture.width - 1, atlasFrame.x));
      const y = Math.max(0, Math.min(fullTexture.height - 1, atlasFrame.y));
      const width = Math.max(1, Math.min(atlasFrame.width, fullTexture.width - x));
      const height = Math.max(1, Math.min(atlasFrame.height, fullTexture.height - y));
      const frameKey = `${key}:atlas:${safeFrame}:${x}:${y}:${width}:${height}`;
      let texture = refs.frameTextureMapRef.current.get(frameKey);
      if (!texture) {
        texture = new PIXI.Texture({
          source: fullTexture.source,
          frame: new PIXI.Rectangle(x, y, width, height),
        });
        refs.frameTextureMapRef.current.set(frameKey, texture);
      }

      return {
        texture,
        layoutWidth: atlasFrame.originalWidth,
        layoutHeight: atlasFrame.originalHeight,
        frameWidth: width,
        frameHeight: height,
        offsetX: atlasFrame.offsetX,
        offsetY: atlasFrame.offsetY,
        pivotX: atlasFrame.pivotX,
        pivotY: atlasFrame.pivotY,
      };
    }

    const spriteCut = normalizeSpriteCut(template.spriteCut);
    if (spriteCut.x <= 1 && spriteCut.y <= 1) {
      return {
        texture: fullTexture,
        layoutWidth: fullTexture.width,
        layoutHeight: fullTexture.height,
        frameWidth: fullTexture.width,
        frameHeight: fullTexture.height,
        offsetX: 0,
        offsetY: 0,
        pivotX: 0.5,
        pivotY: template.type === 'vertical' ? 1 : 0.5,
      };
    }

    const safeFrame = clampSpriteFrame(spriteFrame, spriteCut);
    const frameKey = `${key}:${spriteCut.x}x${spriteCut.y}:${safeFrame}`;
    const cachedTexture = refs.frameTextureMapRef.current.get(frameKey);
    const frameWidth = fullTexture.width / spriteCut.x;
    const frameHeight = fullTexture.height / spriteCut.y;
    const column = safeFrame % spriteCut.x;
    const row = Math.floor(safeFrame / spriteCut.x);
    const texture = cachedTexture ?? new PIXI.Texture({
      source: fullTexture.source,
      frame: new PIXI.Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight),
    });
    if (!cachedTexture) refs.frameTextureMapRef.current.set(frameKey, texture);
    return {
      texture,
      layoutWidth: frameWidth,
      layoutHeight: frameHeight,
      frameWidth,
      frameHeight,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: template.type === 'vertical' ? 1 : 0.5,
    };
  }, [refs, templateAtlases]);

  /**
   * First frame of the template's sprite with its `compositeLayers` drawn over it
   * (or under it, for `behind` layers),
   * all pivots aligned (a layer's `offset` and `angle` move and rotate it around
   * its pivot), as one texture. Pivots of atlas-less sprites are centered.
   * Null when the base sprite or every layer is not loaded yet.
   */
  const getCompositeRenderFrame = useCallback((template: RenderTemplate): RenderFrame | null => {
    const base = { spriteFile: template.spriteFile, spriteCut: template.spriteCut, offset: undefined, angle: undefined };
    if (!refs.baseTextureMapRef.current.has(base.spriteFile)) return null;
    const isLoaded = (layer: { spriteFile: string }) => refs.baseTextureMapRef.current.has(layer.spriteFile);
    const overlays = template.compositeLayers ?? [];
    // Bottom to top: layers behind the base sprite, the base sprite, layers over it.
    const layers = [
      ...overlays.filter(layer => layer.behind && isLoaded(layer)),
      base,
      ...overlays.filter(layer => !layer.behind && isLoaded(layer)),
    ];
    if (layers.length < 2 && template.compositeBaseColor === undefined && !template.compositeBaseHidden) return null;

    const frames = layers.map(layer => ({
      ...getSingleRenderFrame(
        { ...template, spriteFile: layer.spriteFile, spriteCut: layer.spriteCut, type: 'horizontal', compositeLayers: undefined },
        0,
      ),
      position: layer.offset,
      hidden: layer === base && template.compositeBaseHidden === true,
      color: layer === base ? template.compositeBaseColor : ('color' in layer ? layer.color : undefined),
      blendMode: 'blendMode' in layer ? layer.blendMode : undefined,
      // A layer's angle (the weapon's `equippedAngle`) is clockwise on screen, unlike an entity angle.
      rotation: (layer.angle ?? 0) * (Math.PI / 180),
    }));
    const cacheKey = frames
      .map(frame => `${frame.texture.uid}:${frame.offsetX},${frame.offsetY},${frame.pivotX},${frame.pivotY}`
        + `:${frame.position?.x ?? 0},${frame.position?.y ?? 0},${frame.rotation},${frame.blendMode ?? 0},${frame.color ?? ''},${frame.hidden}`)
      .join('|');
    const cached = compositeFrameMapRef.current.get(cacheKey);
    if (cached) return cached;

    const layout = computeCompositeLayout(frames);
    if (!layout) return null;
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    frames.forEach((frame, index) => {
      if (frame.hidden) return;
      const image = frame.texture.source.resource as CanvasImageSource | undefined;
      if (!image) return;
      const { x, y, width, height } = frame.texture.frame;
      const placement = layout.placements[index];
      context.save();
      // Same mapping as entity meshes: 1 is screen, 4 is multiply.
      if (frame.blendMode === 1) context.globalCompositeOperation = 'screen';
      else if (frame.blendMode === 4) context.globalCompositeOperation = 'multiply';
      context.translate(placement.x, placement.y);
      if (placement.rotation !== 0) context.rotate(placement.rotation);
      if (frame.color !== undefined) {
        // Multiply the color into the sprite only (alpha kept), like a diffuse color.
        const tinted = document.createElement('canvas');
        tinted.width = Math.max(1, Math.round(frame.frameWidth));
        tinted.height = Math.max(1, Math.round(frame.frameHeight));
        const tintedContext = tinted.getContext('2d');
        if (tintedContext) {
          tintedContext.drawImage(image, x, y, width, height, 0, 0, tinted.width, tinted.height);
          tintedContext.globalCompositeOperation = 'multiply';
          tintedContext.fillStyle = `#${frame.color.toString(16).padStart(6, '0')}`;
          tintedContext.fillRect(0, 0, tinted.width, tinted.height);
          tintedContext.globalCompositeOperation = 'destination-in';
          tintedContext.drawImage(image, x, y, width, height, 0, 0, tinted.width, tinted.height);
          context.drawImage(tinted, placement.frameX, placement.frameY, frame.frameWidth, frame.frameHeight);
        }
      } else {
        context.drawImage(image, x, y, width, height, placement.frameX, placement.frameY, frame.frameWidth, frame.frameHeight);
      }
      context.restore();
    });

    const composite: RenderFrame = {
      texture: PIXI.Texture.from(canvas),
      layoutWidth: layout.width,
      layoutHeight: layout.height,
      frameWidth: layout.width,
      frameHeight: layout.height,
      offsetX: 0,
      offsetY: 0,
      pivotX: layout.pivotX,
      pivotY: layout.pivotY,
    };
    compositeFrameMapRef.current.set(cacheKey, composite);
    return composite;
  }, [getSingleRenderFrame, refs]);

  const getRenderFrame = useCallback((template: RenderTemplate, requestedFrame: number): RenderFrame => {
    if (template.compositeLayers?.length || template.compositeBaseColor !== undefined || template.compositeBaseHidden) {
      const composite = getCompositeRenderFrame(template);
      if (composite) return composite;
    }
    if (template.compositeBaseHidden) {
      return { ...getSingleRenderFrame(template, requestedFrame), texture: PIXI.Texture.EMPTY };
    }
    return getSingleRenderFrame(template, requestedFrame);
  }, [getCompositeRenderFrame, getSingleRenderFrame]);

  return { textureRevision, getRenderFrame };
}
