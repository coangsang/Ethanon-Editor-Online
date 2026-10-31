import { useEffect, useRef } from 'react';
import type { EntityInstance, EntityTemplate, SceneData } from '../types';
import { resolveEntityTemplate } from '../utils/entityTemplate';
import { transformEventBus, type TransformUpdate } from '../store/TransformEventBus';
import { buildCollisionPrimitives } from './collisionGeometry';
import type { ViewportRefs } from './viewportTypes';
import { computeParallaxContext } from './viewportMath';

type UseCollisionRendererParams = {
  refs: ViewportRefs;
  scene: SceneData;
  templates: Record<string, EntityTemplate>;
  selectedUIDs: string[];
  showCollisions: boolean;
  camera: { x: number; y: number; zoom: number };
  viewportSize: { width: number; height: number };
  parallaxOriginNormalized: { x: number; y: number };
  parallaxPreviewActive: boolean;
  appReadyRevision: number;
};

function drawCollisionGraphics(
  params: UseCollisionRendererParams,
  previews: Map<string, TransformUpdate>,
) {
  const { refs, scene, templates, selectedUIDs, showCollisions, camera } = params;
  const graphics = refs.collisionGraphicsRef.current;
  if (!graphics) return;
  graphics.clear();
  if (!showCollisions) return;

  const selected = new Set(selectedUIDs);
  const zoom = Math.max(0.001, camera.zoom);
  const parallaxContext = computeParallaxContext(
    scene.properties.parallaxIntensity,
    params.parallaxOriginNormalized,
    params.parallaxPreviewActive,
    refs.appRef.current,
  );
  for (const originalEntity of scene.entities) {
    if (originalEntity.hide) continue;
    const originalTemplate = resolveEntityTemplate(originalEntity, templates);
    if (!originalTemplate?.physics) continue;
    const resolved = applyPreview(originalEntity, originalTemplate, previews.get(originalEntity.editorEntityUID));
    const primitives = buildCollisionPrimitives(
      resolved.entity,
      resolved.template.physics,
      resolved.template.scale,
      {
        camera,
        parallaxContext,
        zAxisDirection: scene.properties.zAxisDirection,
        templateParallaxIntensity: resolved.template.parallaxIntensity,
      },
    );
    if (primitives.length === 0) continue;
    for (const primitive of primitives) {
      if (primitive.kind === 'circle') graphics.circle(primitive.center.x, primitive.center.y, primitive.radius);
      else graphics.poly(primitive.points, primitive.closed);
    }
    const isSelected = selected.has(originalEntity.editorEntityUID);
    graphics.stroke({
      width: (isSelected ? 2 : 1) / zoom,
      color: isSelected ? 0xfbbf24 : 0x22d3ee,
      alpha: 0.9,
    });
  }
}

function applyPreview(
  entity: EntityInstance,
  template: EntityTemplate,
  preview: TransformUpdate | undefined,
): { entity: EntityInstance; template: EntityTemplate } {
  if (!preview) return { entity, template };
  const nextEntity = {
    ...entity,
    position: {
      ...entity.position,
      x: preview.x ?? entity.position.x,
      y: preview.y ?? entity.position.y,
    },
    angle: preview.angle ?? entity.angle,
  };
  const nextTemplate = preview.scaleX !== undefined || preview.scaleY !== undefined
    ? {
        ...template,
        scale: {
          x: preview.scaleX ?? template.scale.x,
          y: preview.scaleY ?? template.scale.y,
        },
      }
    : template;
  return { entity: nextEntity, template: nextTemplate };
}

export function useCollisionRenderer({
  refs,
  scene,
  templates,
  selectedUIDs,
  showCollisions,
  camera,
  viewportSize,
  parallaxOriginNormalized,
  parallaxPreviewActive,
  appReadyRevision,
}: UseCollisionRendererParams) {
  const previewsRef = useRef(new Map<string, TransformUpdate>());

  useEffect(() => {
    previewsRef.current.clear();
    drawCollisionGraphics({ refs, scene, templates, selectedUIDs, showCollisions, camera, viewportSize, parallaxOriginNormalized, parallaxPreviewActive, appReadyRevision }, previewsRef.current);
  }, [refs, scene, templates, selectedUIDs, showCollisions, camera, viewportSize, parallaxOriginNormalized, parallaxPreviewActive, appReadyRevision]);

  useEffect(() => {
    const unsubscribe = transformEventBus.subscribe(updates => {
      for (const update of updates) {
        const previous = previewsRef.current.get(update.uid) ?? { uid: update.uid };
        previewsRef.current.set(update.uid, { ...previous, ...update });
      }
      drawCollisionGraphics({ refs, scene, templates, selectedUIDs, showCollisions, camera, viewportSize, parallaxOriginNormalized, parallaxPreviewActive, appReadyRevision }, previewsRef.current);
    });
    return unsubscribe;
  }, [refs, scene, templates, selectedUIDs, showCollisions, camera, viewportSize, parallaxOriginNormalized, parallaxPreviewActive, appReadyRevision]);
}
