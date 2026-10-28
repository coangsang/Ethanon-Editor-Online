/* eslint react-hooks/immutability: off */
import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { EntityInstance, EntityTemplate, SceneData, SpriteAtlas } from '../types';
import { resolveEntityTemplate } from '../utils/entityTemplate';
import { ParticleSystemRuntime } from './particleSystem';
import {
  applyEntityTransformToMesh,
  compareDrawSortKeys,
  computeEntityDrawSortKey,
  computeParallaxContext,
  computeParticleDrawSortKey,
  createEntityMesh,
  drawSortKeySignature,
  getParticleEmitterBounds,
  isParticleEmitterInViewport,
  PARTICLE_VIEWPORT_PADDING_PX,
  particleRuntimeSignature,
  PLACEHOLDER_SIZE,
} from './viewportMath';
import { computeAmbientColor, rgbToTint } from './ambientLighting';
import type { DrawSortKey, RenderFrame, ViewportRefs } from './viewportTypes';
import { BucketManager, bucketManager } from '../utils/BucketManager';
import { useSceneStore } from '../store/sceneStore';
import { transformEventBus, type TransformUpdate } from '../store/TransformEventBus';
import { startPerformanceMetric } from '../utils/performanceProfiler';

type UseEntityMeshRendererParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  scene: SceneData;
  templates: Record<string, EntityTemplate>;
  templateAtlases: Record<string, SpriteAtlas>;
  textureRevision: number;
  appReadyRevision?: number;
  getRenderFrame: (template: EntityTemplate, spriteFrame: number) => RenderFrame;
  parallaxOriginNormalized: { x: number; y: number };
  parallaxPreviewActive: boolean;
  showParticles: boolean;
  viewportSize: { width: number; height: number };
  onEntityPointerDown: (entityUid: string, e: PIXI.FederatedPointerEvent) => void;
};

const particleBucketManager = new BucketManager();

function syncParticleRuntimeVisibility(
  refs: ViewportRefs,
  entity: EntityInstance,
  particleSystem: NonNullable<EntityTemplate['particleSystems']>[number],
  rKey: string,
  camera: { x: number; y: number; zoom: number },
  viewportSize: { width: number; height: number },
  zAxisDirection: { x: number; y: number },
  showParticles: boolean,
) {
  const runtime = refs.particleRuntimesRef.current.get(rKey);
  if (!runtime) return;

  const isActive = !entity.hide && showParticles && isParticleEmitterInViewport(
    entity,
    particleSystem,
    camera,
    viewportSize,
    zAxisDirection,
  );
  runtime.container.visible = !entity.hide && showParticles;
  runtime.container.renderable = isActive;
  if (isActive) {
    refs.activeParticleRuntimeKeysRef.current.add(rKey);
  } else {
    refs.activeParticleRuntimeKeysRef.current.delete(rKey);
  }
}

export function useEntityMeshRenderer({
  refs,
  camera,
  scene,
  templates,
  templateAtlases,
  textureRevision,
  appReadyRevision,
  getRenderFrame,
  parallaxOriginNormalized,
  parallaxPreviewActive,
  showParticles,
  viewportSize,
  onEntityPointerDown,
}: UseEntityMeshRendererParams) {
  const inspectorPreviewRef = useRef(new Map<string, TransformUpdate>());
  const ambientTintFrameRef = useRef<number | null>(null);

  // Sync entity meshes & culling
  useEffect(() => {
    const container = refs.entitiesContainerRef.current;
    const app = refs.appRef.current;
    if (!container || !app) return;
    const isManipulatingEntity = refs.isDraggingEntityRef.current || refs.isRotatingRef.current;

    const lastSync = refs.meshSyncRefsRef.current;
    if (lastSync.entities !== scene.entities) inspectorPreviewRef.current.clear();
    const isStructuralSyncNeeded =
      lastSync.entities !== scene.entities ||
      lastSync.parallaxIntensity !== scene.properties.parallaxIntensity ||
      lastSync.zAxisDirection !== scene.properties.zAxisDirection ||
      lastSync.templates !== templates ||
      lastSync.templateAtlases !== templateAtlases ||
      lastSync.textureRevision !== textureRevision ||
      lastSync.parallaxOrigin !== parallaxOriginNormalized ||
      lastSync.parallaxActive !== parallaxPreviewActive;
    const finishPlacementMetric = lastSync.entities !== scene.entities && !isManipulatingEntity
      ? startPerformanceMetric('renderer.placement', scene.entities.length)
      : null;

    // Re-populate Spatial Index (BucketManager) with bounding boxes when entities or templates change
    if (
      lastSync.entities !== scene.entities ||
      lastSync.templates !== templates ||
      lastSync.zAxisDirection !== scene.properties.zAxisDirection
    ) {
      bucketManager.clear();
      particleBucketManager.clear();
      refs.particleHostStatesRef.current.clear();
      refs.particleCullingEntriesRef.current.clear();
      for (const entity of scene.entities) {
        refs.particleHostStatesRef.current.set(entity.editorEntityUID, {
          position: { ...entity.position },
          angle: entity.angle,
          hide: entity.hide,
        });
        const template = resolveEntityTemplate(entity, templates);
        let w = 256;
        let h = 256;
        if (template) {
          const renderFrame = getRenderFrame(template, entity.spriteFrame);
          w = (renderFrame.layoutWidth || PLACEHOLDER_SIZE) * Math.abs(template.scale?.x ?? 1);
          h = (renderFrame.layoutHeight || PLACEHOLDER_SIZE) * Math.abs(template.scale?.y ?? 1);
        }
        bucketManager.insertOrUpdate(entity.editorEntityUID, {
          x: entity.position.x - w / 2,
          y: entity.position.y - h / 2,
          width: Math.max(w, 64),
          height: Math.max(h, 64),
        });
        template?.particleSystems?.forEach((particleSystem, psIdx) => {
          const rKey = `${entity.editorEntityUID}:${psIdx}`;
          particleBucketManager.insertOrUpdate(
            rKey,
            getParticleEmitterBounds(entity, particleSystem, scene.properties.zAxisDirection),
          );
          refs.particleCullingEntriesRef.current.set(rKey, {
            entity,
            particleSystem,
          });
        });
      }
    }

    const currentUids = new Set(scene.entities.map(e => e.editorEntityUID));
    const activeParticleRuntimeKeys = new Set<string>();
    const meshEntityUids = new Map<PIXI.Container, string>();
    const displayObjectDrawKeys = new Map<PIXI.Container, DrawSortKey>();
    const sortSignatureParts: string[] = [];
    let sortDirty = false;
    let parallaxGeometryActive = false;
    const parallaxContext = computeParallaxContext(
      scene.properties.parallaxIntensity,
      parallaxOriginNormalized,
      parallaxPreviewActive,
      app
    );

    // Structural pass: Re-build/update meshes, textures, particles, and z-sorting
    if (isStructuralSyncNeeded && !isManipulatingEntity) {
      // Remove deleted entity meshes
      for (const [uid, mesh] of refs.spriteMapRef.current) {
        if (!currentUids.has(uid)) {
          container.removeChild(mesh);
          mesh.destroy();
          refs.spriteMapRef.current.delete(uid);
          refs.boundsMapRef.current.delete(uid);
          refs.parallaxEntityUIDsRef.current.delete(uid);
          sortDirty = true;
        }
      }

      for (const entity of scene.entities) {
        const template = resolveEntityTemplate(entity, templates);
        const type = template?.type ?? 'horizontal';
        const drawKey = computeEntityDrawSortKey(entity, type);
        sortSignatureParts.push(`${entity.editorEntityUID}:${drawSortKeySignature(drawKey)}:${entity.hide ? 'h' : 'v'}`);

        if (entity.hide) {
          const mesh = refs.spriteMapRef.current.get(entity.editorEntityUID);
          if (mesh) {
            mesh.visible = false;
            meshEntityUids.set(mesh, entity.editorEntityUID);
            displayObjectDrawKeys.set(mesh, drawKey);
          }
          refs.boundsMapRef.current.delete(entity.editorEntityUID);
          refs.parallaxEntityUIDsRef.current.delete(entity.editorEntityUID);
          continue;
        }

        const useVerticalGeometry = template?.type === 'vertical';
        const renderFrame = template ? getRenderFrame(template, entity.spriteFrame) : {
          texture: PIXI.Texture.WHITE,
          layoutWidth: PLACEHOLDER_SIZE,
          layoutHeight: PLACEHOLDER_SIZE,
          frameWidth: PLACEHOLDER_SIZE,
          frameHeight: PLACEHOLDER_SIZE,
          offsetX: 0,
          offsetY: 0,
          pivotX: 0.5,
          pivotY: 0.5,
        };

        const expectedVertexCount = useVerticalGeometry ? 6 : 4;
        let mesh = refs.spriteMapRef.current.get(entity.editorEntityUID);
        if (mesh && mesh.geometry.positions.length / 2 !== expectedVertexCount) {
          container.removeChild(mesh);
          mesh.destroy();
          refs.spriteMapRef.current.delete(entity.editorEntityUID);
          mesh = undefined;
          sortDirty = true;
        }

        if (!mesh) {
          mesh = createEntityMesh(renderFrame.texture, useVerticalGeometry);
          refs.spriteMapRef.current.set(entity.editorEntityUID, mesh);
          container.addChild(mesh);
          sortDirty = true;

          const capturedUID = entity.editorEntityUID;
          mesh.on('pointerdown', (e: PIXI.FederatedPointerEvent) => onEntityPointerDown(capturedUID, e));
        }
        meshEntityUids.set(mesh, entity.editorEntityUID);
        displayObjectDrawKeys.set(mesh, drawKey);

        mesh.visible = true;
        if (mesh.texture !== renderFrame.texture) mesh.texture = renderFrame.texture;

        const blendMode = template?.blendMode ?? 0;
        const pixiBlendMode: PIXI.BLEND_MODES =
          blendMode === 1 ? 'screen' :
          blendMode === 4 ? 'multiply' :
          'normal';
        if (mesh.blendMode !== pixiBlendMode) mesh.blendMode = pixiBlendMode;

        const result = applyEntityTransformToMesh(
          mesh as PIXI.Mesh,
          entity,
          template,
          renderFrame,
          camera,
          useVerticalGeometry,
          parallaxContext
        );

        if (result.parallaxGeometryActive) {
          parallaxGeometryActive = true;
          refs.parallaxEntityUIDsRef.current.add(entity.editorEntityUID);
        } else {
          refs.parallaxEntityUIDsRef.current.delete(entity.editorEntityUID);
        }
        refs.boundsMapRef.current.set(entity.editorEntityUID, result.bounds);

        // Sync Particle Systems
        if (template?.particleSystems && template.particleSystems.length > 0) {
          template.particleSystems.forEach((psConfig, psIdx) => {
            const rKey = `${entity.editorEntityUID}:${psIdx}`;

            let runtime = refs.particleRuntimesRef.current.get(rKey);
            const psTexKey = psConfig.bitmap;
            const psTex = refs.baseTextureMapRef.current.get(psTexKey);

            if (psTex) {
              activeParticleRuntimeKeys.add(rKey);

              const nextRuntimeSignature = particleRuntimeSignature(psConfig, psTexKey, textureRevision);
              if (runtime && refs.particleRuntimeSignaturesRef.current.get(rKey) !== nextRuntimeSignature) {
                try {
                  container.removeChild(runtime.container);
                  runtime.destroy();
                } catch {
                  // Keep syncing the scene even if Pixi has already detached this runtime.
                }
                refs.particleRuntimesRef.current.delete(rKey);
                refs.particleRuntimeSignaturesRef.current.delete(rKey);
                runtime = undefined;
                sortDirty = true;
              }

              if (!runtime) {
                runtime = new ParticleSystemRuntime(
                  psConfig,
                  psTex,
                  { x: entity.position.x, y: entity.position.y },
                  entity.position,
                  entity.angle,
                  scene.properties.zAxisDirection
                );
                refs.particleRuntimesRef.current.set(rKey, runtime);
                refs.particleRuntimeSignaturesRef.current.set(rKey, nextRuntimeSignature);
                container.addChild(runtime.container);
              runtime.container.renderable = false;
                sortDirty = true;
              }
              runtime.container.visible = !entity.hide && showParticles;
              runtime.container.position.set(0, 0);
              runtime.container.rotation = 0;
              runtime.container.scale.set(1, 1);
              meshEntityUids.set(runtime.container, entity.editorEntityUID);
              const particleDrawKey = computeParticleDrawSortKey(entity, type, psConfig, psIdx, drawKey);
              displayObjectDrawKeys.set(runtime.container, particleDrawKey);
              sortSignatureParts.push(`${rKey}:${drawSortKeySignature(particleDrawKey)}:${nextRuntimeSignature}:${showParticles ? 'v' : 'h'}`);
            }
          });
        }
      }

      for (const [rKey, runtime] of refs.particleRuntimesRef.current) {
        if (!activeParticleRuntimeKeys.has(rKey)) {
          try {
            container.removeChild(runtime.container);
            runtime.destroy();
          } catch {
            // Continue removing stale particle runtimes.
          }
          refs.particleRuntimesRef.current.delete(rKey);
          refs.particleRuntimeSignaturesRef.current.delete(rKey);
          refs.activeParticleRuntimeKeysRef.current.delete(rKey);
          refs.particleCullingEntriesRef.current.delete(rKey);
          sortDirty = true;
        }
      }

      const sortSignature = sortSignatureParts.join('|');
      if (sortDirty || refs.drawSortSignatureRef.current !== sortSignature) {
        refs.drawSortSignatureRef.current = sortSignature;
        container.children.sort((a, b) => {
          const keyA = displayObjectDrawKeys.get(a);
          const keyB = displayObjectDrawKeys.get(b);
          if (keyA && keyB) return compareDrawSortKeys(keyA, keyB);
          if (keyA) return 1;
          if (keyB) return -1;
          return (meshEntityUids.get(a) ?? '').localeCompare(meshEntityUids.get(b) ?? '');
        });
      }
      refs.meshSyncRefsRef.current = {
        entities: scene.entities,
        parallaxIntensity: scene.properties.parallaxIntensity,
        zAxisDirection: scene.properties.zAxisDirection,
        templates,
        templateAtlases,
        textureRevision,
        parallaxOrigin: parallaxOriginNormalized,
        parallaxActive: parallaxPreviewActive,
      };
      refs.parallaxGeometryActiveRef.current = parallaxGeometryActive;
    }

    // Viewport Culling Pass: Runs EVERY time (on camera movement, window resize, or scene change)
    const screenWidth = Math.max(viewportSize.width || app.renderer.width, 1);
    const screenHeight = Math.max(viewportSize.height || app.renderer.height, 1);
    const worldX = (0 - camera.x) / camera.zoom;
    const worldY = (0 - camera.y) / camera.zoom;
    const worldW = screenWidth / camera.zoom;
    const worldH = screenHeight / camera.zoom;

    const padding = Math.max(512, 1024 / camera.zoom);
    const visibleUids = bucketManager.getEntitiesInRect(
      worldX - padding,
      worldY - padding,
      worldW + padding * 2,
      worldH + padding * 2
    );

    const selectedUIDsSet = new Set(useSceneStore.getState().selectedUIDs);
    for (const rKey of refs.activeParticleRuntimeKeysRef.current) {
      const runtime = refs.particleRuntimesRef.current.get(rKey);
      if (runtime) runtime.container.renderable = false;
    }
    refs.activeParticleRuntimeKeysRef.current.clear();

    for (const entity of scene.entities) {
      const isVisibleInViewport = visibleUids.has(entity.editorEntityUID) || selectedUIDsSet.has(entity.editorEntityUID);
      const mesh = refs.spriteMapRef.current.get(entity.editorEntityUID);
      if (mesh && !isManipulatingEntity) {
        mesh.renderable = !entity.hide && isVisibleInViewport;
        // If parallax geometry is active, re-apply transform to update screen-space vertex projections relative to camera
        if (isVisibleInViewport && refs.parallaxGeometryActiveRef.current) {
          const template = resolveEntityTemplate(entity, templates);
          const useVerticalGeometry = template?.type === 'vertical';
          const renderFrame = template ? getRenderFrame(template, entity.spriteFrame) : {
            texture: PIXI.Texture.WHITE,
            layoutWidth: PLACEHOLDER_SIZE,
            layoutHeight: PLACEHOLDER_SIZE,
            frameWidth: PLACEHOLDER_SIZE,
            frameHeight: PLACEHOLDER_SIZE,
            offsetX: 0,
            offsetY: 0,
            pivotX: 0.5,
            pivotY: 0.5,
          };
          const result = applyEntityTransformToMesh(
            mesh as PIXI.Mesh,
            entity,
            template,
            renderFrame,
            camera,
            useVerticalGeometry,
            parallaxContext
          );
          refs.boundsMapRef.current.set(entity.editorEntityUID, result.bounds);
        }
      }

    }

    if (!showParticles) {
      for (const runtime of refs.particleRuntimesRef.current.values()) {
        runtime.container.visible = false;
        runtime.container.renderable = false;
      }
      finishPlacementMetric?.();
      return;
    }

    const particlePadding = PARTICLE_VIEWPORT_PADDING_PX / Math.max(camera.zoom, 0.001);
    const candidateParticleRuntimeKeys = particleBucketManager.getEntitiesInRect(
      worldX - particlePadding,
      worldY - particlePadding,
      worldW + particlePadding * 2,
      worldH + particlePadding * 2,
    );
    for (const rKey of candidateParticleRuntimeKeys) {
      const entry = refs.particleCullingEntriesRef.current.get(rKey);
      if (!entry) continue;
      syncParticleRuntimeVisibility(
        refs,
        entry.entity,
        entry.particleSystem,
        rKey,
        camera,
        { width: screenWidth, height: screenHeight },
        scene.properties.zAxisDirection,
        showParticles,
      );
    }
    finishPlacementMetric?.();
  }, [refs, camera, scene.entities, scene.properties.parallaxIntensity, scene.properties.zAxisDirection, templates, templateAtlases, textureRevision, appReadyRevision, getRenderFrame, parallaxOriginNormalized, parallaxPreviewActive, showParticles, viewportSize, onEntityPointerDown]);

  // Ambient edits only change material tint. Coalesce picker updates per frame and
  // keep them out of the structural mesh, spatial-index, particle, and sort pass.
  useEffect(() => {
    if (ambientTintFrameRef.current !== null) {
      window.cancelAnimationFrame(ambientTintFrameRef.current);
    }

    ambientTintFrameRef.current = window.requestAnimationFrame(() => {
      ambientTintFrameRef.current = null;
      for (const entity of scene.entities) {
        const mesh = refs.spriteMapRef.current.get(entity.editorEntityUID);
        if (!mesh) continue;

        const template = resolveEntityTemplate(entity, templates);
        const previewDiffuse = inspectorPreviewRef.current.get(entity.editorEntityUID)?.diffuseColor;
        const diffuse = previewDiffuse ?? entity.diffuseColor ?? entity.color ?? template?.diffuseColor;
        const ambientColor = computeAmbientColor(scene.properties.ambient, template?.emissiveColor, diffuse);
        mesh.tint = rgbToTint(ambientColor);
        mesh.alpha = ambientColor.a;
      }
    });

    return () => {
      if (ambientTintFrameRef.current !== null) {
        window.cancelAnimationFrame(ambientTintFrameRef.current);
        ambientTintFrameRef.current = null;
      }
    };
  }, [refs, scene.entities, scene.properties.ambient, templates, appReadyRevision]);

  // Live transform preview from Inspector and viewport drags via EventBus
  useEffect(() => {
    return transformEventBus.subscribe(updates => {
      const app = refs.appRef.current;
      if (!app) return;

      const parallaxContext = computeParallaxContext(
        scene.properties.parallaxIntensity,
        parallaxOriginNormalized,
        parallaxPreviewActive,
        app
      );
      const entitiesByUid = new Map(scene.entities.map(entity => [entity.editorEntityUID, entity]));

      for (const update of updates) {
        const previous = inspectorPreviewRef.current.get(update.uid) ?? { uid: update.uid };
        const preview = { ...previous, ...update };
        inspectorPreviewRef.current.set(update.uid, preview);
        const mesh = refs.spriteMapRef.current.get(preview.uid);
        const originalEntity = entitiesByUid.get(preview.uid);
        if (!mesh || !originalEntity) continue;

        // Merge updates with original entity for calculation
        const simulatedEntity = { ...originalEntity };
        if (preview.x !== undefined) simulatedEntity.position = { ...simulatedEntity.position, x: preview.x };
        if (preview.y !== undefined) simulatedEntity.position = { ...simulatedEntity.position, y: preview.y };
        if (preview.angle !== undefined) simulatedEntity.angle = preview.angle;
        if (preview.spriteFrame !== undefined) simulatedEntity.spriteFrame = preview.spriteFrame;
        if (preview.flipX !== undefined) simulatedEntity.flipX = preview.flipX;
        if (preview.flipY !== undefined) simulatedEntity.flipY = preview.flipY;
        if (preview.hide !== undefined) simulatedEntity.hide = preview.hide;

        let template = resolveEntityTemplate(simulatedEntity, templates);
        if (template && (preview.scaleX !== undefined || preview.scaleY !== undefined || preview.blendMode !== undefined || preview.diffuseColor !== undefined)) {
          template = {
            ...template,
            ...(preview.scaleX !== undefined || preview.scaleY !== undefined ? {
              scale: {
                x: preview.scaleX !== undefined ? preview.scaleX : (template.scale?.x ?? 1),
                y: preview.scaleY !== undefined ? preview.scaleY : (template.scale?.y ?? 1),
              }
            } : {}),
            ...(preview.blendMode !== undefined ? { blendMode: preview.blendMode } : {}),
            ...(preview.diffuseColor !== undefined ? { diffuseColor: preview.diffuseColor } : {}),
          };
        }
        if (preview.diffuseColor !== undefined) {
          simulatedEntity.diffuseColor = preview.diffuseColor;
          simulatedEntity.color = preview.diffuseColor;
        }

        if (preview.hide !== undefined) {
          mesh.visible = !preview.hide;
        }

        const diffuse = simulatedEntity.diffuseColor ?? simulatedEntity.color ?? template?.diffuseColor;
        const ambientColor = computeAmbientColor(scene.properties.ambient, template?.emissiveColor, diffuse);
        mesh.tint = rgbToTint(ambientColor);
        mesh.alpha = ambientColor.a;

        const blendMode = template?.blendMode ?? 0;
        const pixiBlendMode: PIXI.BLEND_MODES =
          blendMode === 1 ? 'screen' :
          blendMode === 4 ? 'multiply' :
          'normal';
        if (mesh.blendMode !== pixiBlendMode) mesh.blendMode = pixiBlendMode;

        const useVerticalGeometry = template?.type === 'vertical';
        const renderFrame = template ? getRenderFrame(template, simulatedEntity.spriteFrame) : {
          texture: PIXI.Texture.WHITE,
          layoutWidth: PLACEHOLDER_SIZE,
          layoutHeight: PLACEHOLDER_SIZE,
          frameWidth: PLACEHOLDER_SIZE,
          frameHeight: PLACEHOLDER_SIZE,
          offsetX: 0,
          offsetY: 0,
          pivotX: 0.5,
          pivotY: 0.5,
        };

        if (mesh.texture !== renderFrame.texture) mesh.texture = renderFrame.texture;

        const result = applyEntityTransformToMesh(
          mesh as PIXI.Mesh,
          simulatedEntity,
          template,
          renderFrame,
          camera,
          useVerticalGeometry,
          parallaxContext
        );
        refs.boundsMapRef.current.set(preview.uid, result.bounds);
        if (result.parallaxGeometryActive) {
          refs.parallaxEntityUIDsRef.current.add(preview.uid);
        } else {
          refs.parallaxEntityUIDsRef.current.delete(preview.uid);
        }

        // Update Spatial Index for live drag/move
        if (preview.x !== undefined || preview.y !== undefined) {
          const w = (renderFrame.layoutWidth || PLACEHOLDER_SIZE) * Math.abs(template?.scale?.x ?? 1);
          const h = (renderFrame.layoutHeight || PLACEHOLDER_SIZE) * Math.abs(template?.scale?.y ?? 1);
          bucketManager.insertOrUpdate(preview.uid, {
            x: simulatedEntity.position.x - w / 2,
            y: simulatedEntity.position.y - h / 2,
            width: Math.max(w, 64),
            height: Math.max(h, 64),
          });
        }

        template?.particleSystems?.forEach((particleSystem, psIdx) => {
          const rKey = `${simulatedEntity.editorEntityUID}:${psIdx}`;
          particleBucketManager.insertOrUpdate(
            rKey,
            getParticleEmitterBounds(simulatedEntity, particleSystem, scene.properties.zAxisDirection),
          );
          refs.particleCullingEntriesRef.current.set(rKey, {
            entity: simulatedEntity,
            particleSystem,
          });
          syncParticleRuntimeVisibility(
            refs,
            simulatedEntity,
            particleSystem,
            rKey,
            camera,
            { width: app.renderer.width, height: app.renderer.height },
            scene.properties.zAxisDirection,
            showParticles,
          );
        });

        // Notify Selection Box to update if it's selected
        refs.updateSelectionOutlinesRef.current?.();
      }
    });
  }, [refs, camera, scene, templates, parallaxOriginNormalized, parallaxPreviewActive, getRenderFrame, showParticles]);
}
