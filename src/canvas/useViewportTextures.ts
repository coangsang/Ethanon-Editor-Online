/* eslint react-hooks/immutability: off, react-hooks/preserve-manual-memoization: off */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { EntityTemplate, SpriteAtlas } from '../types';
import { resolveEntityTemplate, resolveExternalTemplate } from '../utils/entityTemplate';
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

type DeferredTextureCleanup = {
  lease: AssetLoadResult<PIXI.Texture> | null;
  frameTextures: PIXI.Texture[];
};

type UseViewportTexturesParams = {
  refs: ViewportRefs;
  sceneEntities: ReturnType<typeof import('../store/sceneStore').useSceneStore.getState>['scene']['entities'];
  templates: Record<string, EntityTemplate>;
  templateAtlases: Record<string, SpriteAtlas>;
  templateImageUrls: Record<string, string>;
  placingTemplate?: string | null;
};

export function useViewportTextures({
  refs,
  sceneEntities,
  templates,
  templateAtlases,
  templateImageUrls,
  placingTemplate,
}: UseViewportTexturesParams) {
  const [textureRevision, setTextureRevision] = useState(0);
  const [assetManager] = useState(() => new ViewportTextureAssetManager<PIXI.Texture>(
    url => PIXI.Assets.load<PIXI.Texture>({ src: url, parser: 'loadTextures' }),
    url => PIXI.Assets.unload(url),
  ));
  const activeLeaseRef = useRef<AssetLoadResult<PIXI.Texture> | null>(null);
  const deferredCleanupRef = useRef(new Map<number, DeferredTextureCleanup>());
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
        const template = resolveEntityTemplate(entity, templates);
        if (template?.spriteFile) templateValuesBySprite.set(template.spriteFile, template);
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

      const { previousFrameTextures, previousLease } = measurePerformanceMetric(
        'texture.commit',
        sceneEntities.length,
        () => {
          const previousFrames = [...refs.frameTextureMapRef.current.values()];
          refs.frameTextureMapRef.current.clear();
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
          return { previousFrameTextures: previousFrames, previousLease: previous };
        },
      );

      const cleanupFrame = requestAnimationFrame(() => {
        deferredCleanupRef.current.delete(cleanupFrame);
        destroyFrameTextures(previousFrameTextures);
        if (previousLease) void releaseLease(previousLease, 'cache swap');
      });
      deferredCleanupRef.current.set(cleanupFrame, {
        lease: previousLease,
        frameTextures: previousFrameTextures,
      });
    };

    void load();
    return () => { cancelled = true; };
  }, [assetManager, refs, templateImageUrls, templates, sceneEntities, placingTemplate]);

  useEffect(() => () => {
    generationRef.current++;
    for (const [frameId, cleanup] of deferredCleanupRef.current) {
      cancelAnimationFrame(frameId);
      destroyFrameTextures(cleanup.frameTextures);
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
    refs.baseTextureMapRef.current.clear();
    refs.textureUrlMapRef.current.clear();
  }, [assetManager, refs]);

  const getRenderFrame = useCallback((template: EntityTemplate, spriteFrame: number): RenderFrame => {
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

  return { textureRevision, getRenderFrame };
}
