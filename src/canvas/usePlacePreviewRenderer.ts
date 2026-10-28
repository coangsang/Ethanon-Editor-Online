/* eslint react-hooks/immutability: off, react-hooks/preserve-manual-memoization: off */
import { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { EntityInstance, EntityTemplate } from '../types';
import { useSceneStore } from '../store/sceneStore';
import { resolveEntityTemplate, resolveExternalTemplate } from '../utils/entityTemplate';
import { instantiatePrefab } from '../utils/prefabUtils';
import { applyEntityTransformToMesh, computeParallaxContext, createEntityMesh, snapVal } from './viewportMath';
import { computeAmbientColor, rgbToTint } from './ambientLighting';
import type { RenderFrame, ViewportRefs } from './viewportTypes';

type UsePlacePreviewRendererParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  placingTemplate: string | null;
  templates: Record<string, EntityTemplate>;
  snapToGrid: boolean;
  textureRevision: number;
  getRenderFrame: (template: EntityTemplate, spriteFrame: number) => RenderFrame;
  parallaxIntensity?: number;
  parallaxOriginNormalized?: { x: number; y: number };
  parallaxPreviewActive?: boolean;
  ambient: { r: number; g: number; b: number };
};

export function usePlacePreviewRenderer({
  refs,
  camera,
  placingTemplate,
  templates,
  snapToGrid,
  textureRevision,
  getRenderFrame,
  parallaxIntensity,
  parallaxOriginNormalized,
  parallaxPreviewActive = false,
  ambient,
}: UsePlacePreviewRendererParams) {
  const placingPrefab = useSceneStore(s => s.placingPrefab);
  const extraMeshesRef = useRef<PIXI.Mesh[]>([]);

  const clearExtraMeshes = useCallback(() => {
    const world = refs.worldRef.current;
    for (const mesh of extraMeshesRef.current) {
      if (world && mesh.parent === world) {
        world.removeChild(mesh);
      }
      try {
        mesh.destroy();
      } catch {
        // ignore
      }
    }
    extraMeshesRef.current = [];
  }, [refs]);

  const updatePlacePreview = useCallback((worldX?: number, worldY?: number, isOverOverride?: boolean) => {
    const world = refs.worldRef.current;
    if (!world) return;

    if (!placingTemplate && !placingPrefab) {
      if (refs.placePreviewMeshRef.current) refs.placePreviewMeshRef.current.visible = false;
      if (refs.placePreviewGraphicsRef.current) refs.placePreviewGraphicsRef.current.visible = false;
      clearExtraMeshes();
      return;
    }

    const mouseState = refs.placePreviewMouseRef.current;
    if (worldX !== undefined && worldY !== undefined) {
      mouseState.x = worldX;
      mouseState.y = worldY;
    }
    if (isOverOverride !== undefined) {
      mouseState.isOver = isOverOverride;
    }

    if (!mouseState.isOver) {
      if (refs.placePreviewMeshRef.current) refs.placePreviewMeshRef.current.visible = false;
      if (refs.placePreviewGraphicsRef.current) refs.placePreviewGraphicsRef.current.visible = false;
      clearExtraMeshes();
      return;
    }

    const { gridSize } = useSceneStore.getState();
    const posX = snapVal(mouseState.x, snapToGrid, gridSize);
    const posY = snapVal(mouseState.y, snapToGrid, gridSize);

    let entitiesToPreview: Array<{ entity: EntityInstance; template: EntityTemplate }> = [];

    if (placingPrefab) {
      const instantiated = instantiatePrefab(placingPrefab.entities, { x: posX, y: posY }, []);
      entitiesToPreview = instantiated.map(ent => {
        let tmpl = resolveEntityTemplate(ent, templates);
        if (!tmpl) {
          tmpl = {
            name: ent.entityName,
            spriteFile: ent.entityName,
            spriteCut: { x: 1, y: 1 },
            type: 'horizontal',
            pivotAdjust: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            parallaxIntensity: 0,
          };
        }
        return { entity: ent, template: tmpl };
      });
    } else if (placingTemplate) {
      let tmpl = resolveExternalTemplate(placingTemplate, templates);
      if (!tmpl) {
        const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(placingTemplate);
        const cleanEntityName = isImage
          ? placingTemplate.replace(/\.[^.]+$/i, '')
          : placingTemplate.replace(/\.ent$/i, '');
        tmpl = {
          name: cleanEntityName,
          spriteFile: placingTemplate,
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 0,
        };
      }
      const singleEntity: EntityInstance = {
        id: -99999,
        entityName: tmpl.name,
        editorEntityUID: 'preview-place-uid',
        position: { x: posX, y: posY, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
      };
      entitiesToPreview = [{ entity: singleEntity, template: tmpl }];
    }

    if (entitiesToPreview.length === 0) return;

    // Ensure we have enough meshes in extraMeshesRef + primary placePreviewMeshRef
    const neededMeshes = entitiesToPreview.length;
    while (extraMeshesRef.current.length + 1 < neededMeshes) {
      const extraMesh = createEntityMesh(PIXI.Texture.EMPTY, false);
      world.addChild(extraMesh);
      extraMeshesRef.current.push(extraMesh);
    }
    while (extraMeshesRef.current.length + 1 > neededMeshes && extraMeshesRef.current.length > 0) {
      const popped = extraMeshesRef.current.pop();
      if (popped) {
        try { popped.destroy(); } catch {
          // Ignore
        }
      }
    }

    const app = refs.appRef.current;
    const parallaxContext = computeParallaxContext(
      parallaxIntensity,
      parallaxOriginNormalized,
      parallaxPreviewActive,
      app
    );

    entitiesToPreview.forEach((item, index) => {
      const renderFrame = getRenderFrame(item.template, item.entity.spriteFrame ?? 0);
      const useVerticalGeometry = item.template.type === 'vertical';
      const expectedVertexCount = useVerticalGeometry ? 6 : 4;

      let mesh: PIXI.Mesh | null;

      if (index === 0) {
        mesh = refs.placePreviewMeshRef.current;
        if (mesh && mesh.geometry.positions.length / 2 !== expectedVertexCount) {
          world.removeChild(mesh);
          mesh.destroy();
          mesh = null;
          refs.placePreviewMeshRef.current = null;
        }

        if (!mesh) {
          mesh = createEntityMesh(renderFrame.texture, useVerticalGeometry);
          refs.placePreviewMeshRef.current = mesh;
          world.addChild(mesh);
        } else if (mesh.parent !== world) {
          world.addChild(mesh);
        }
      } else {
        mesh = extraMeshesRef.current[index - 1];
        if (mesh && mesh.geometry.positions.length / 2 !== expectedVertexCount) {
          world.removeChild(mesh);
          mesh.destroy();
          mesh = createEntityMesh(renderFrame.texture, useVerticalGeometry);
          extraMeshesRef.current[index - 1] = mesh;
          world.addChild(mesh);
        }
      }

      if (!mesh) return;

      mesh.visible = true;
      if (mesh.texture !== renderFrame.texture) {
        mesh.texture = renderFrame.texture;
      }
      mesh.position.set(0, 0);
      mesh.rotation = 0;
      mesh.scale.set(1, 1);
      const diffuse = item.entity.diffuseColor ?? item.entity.color ?? item.template.diffuseColor;
      const ambientColor = computeAmbientColor(ambient, item.template.emissiveColor, diffuse);
      mesh.alpha = 0.65 * ambientColor.a; // Translucent ghost preview
      mesh.tint = rgbToTint(ambientColor);
      mesh.blendMode = 'normal';

      applyEntityTransformToMesh(
        mesh,
        item.entity,
        item.template,
        renderFrame,
        camera,
        useVerticalGeometry,
        parallaxContext
      );
    });

    // Pivot marker graphics
    let gfx = refs.placePreviewGraphicsRef.current;
    if (!gfx) {
      gfx = new PIXI.Graphics();
      refs.placePreviewGraphicsRef.current = gfx;
      world.addChild(gfx);
    } else if (gfx.parent !== world) {
      world.addChild(gfx);
    }

    gfx.clear();
    gfx.visible = true;
    const r = 4 / camera.zoom;
    gfx.circle(posX, posY, r);
    gfx.moveTo(posX - r * 1.5, posY);
    gfx.lineTo(posX + r * 1.5, posY);
    gfx.moveTo(posX, posY - r * 1.5);
    gfx.lineTo(posX, posY + r * 1.5);
    gfx.stroke({ width: 1.5 / camera.zoom, color: 0x00ffcc, alpha: 0.9 });

    // Ensure preview graphics renders on top
    world.setChildIndex(gfx, world.children.length - 1);
  }, [
    refs,
    camera,
    placingTemplate,
    placingPrefab,
    templates,
    snapToGrid,
    getRenderFrame,
    clearExtraMeshes,
    parallaxIntensity,
    parallaxOriginNormalized,
    parallaxPreviewActive,
    ambient,
  ]);

  // Register callback ref so mousemove events can trigger 60 FPS GPU updates directly
  useEffect(() => {
    refs.updatePlacePreviewRef.current = updatePlacePreview;
  }, [refs, updatePlacePreview]);

  // Trigger update when React state changes
  useEffect(() => {
    updatePlacePreview();
  }, [
    updatePlacePreview,
    textureRevision,
    placingPrefab,
    parallaxIntensity,
    parallaxOriginNormalized,
    parallaxPreviewActive,
  ]);

  // Clean up preview on unmount
  useEffect(() => {
    return () => {
      refs.updatePlacePreviewRef.current = () => {};
      clearExtraMeshes();
      if (refs.placePreviewMeshRef.current) {
        try {
          refs.worldRef.current?.removeChild(refs.placePreviewMeshRef.current);
          refs.placePreviewMeshRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        refs.placePreviewMeshRef.current = null;
      }
      if (refs.placePreviewGraphicsRef.current) {
        try {
          refs.worldRef.current?.removeChild(refs.placePreviewGraphicsRef.current);
          refs.placePreviewGraphicsRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        refs.placePreviewGraphicsRef.current = null;
      }
    };
  }, [refs, clearExtraMeshes]);
}

