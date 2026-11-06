/* eslint react-hooks/immutability: off */
import { useCallback, useEffect, useState } from "react";
import type { EntityInstance, EntityTemplate, SceneData } from "../types";
import {
  transformEventBus,
  type TransformUpdate,
} from "../store/TransformEventBus";
import { BucketManager } from "../utils/BucketManager";
import {
  compoundsEqual,
  filterDiagnosticsForEdit,
  isCollisionGeometryValid,
  polygonsEqual,
} from "../utils/collision";
import { resolveEntityTemplate } from "../utils/entityTemplate";
import {
  isPerformanceProfilerEnabled,
  recordPerformanceMetric,
} from "../utils/performanceProfiler";
import {
  buildCollisionWorldGeometry,
  getProjectedCollisionBounds,
  projectCollisionGeometry,
  type CollisionPrimitive,
  type CollisionProjection,
  type CollisionWorldGeometry,
} from "./collisionGeometry";
import type { Bounds, ViewportRefs } from "./viewportTypes";
import { computeParallaxContext } from "./viewportMath";

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

type CollisionCacheEntry = {
  uid: string;
  geometry: CollisionWorldGeometry;
  templateParallaxIntensity: number;
  bounds: Bounds | null;
  projected: CollisionPrimitive[] | null;
  isValid: boolean;
};

type CollisionRuntime = {
  latestParams: UseCollisionRendererParams | null;
  entries: Map<string, CollisionCacheEntry>;
  entitiesByUid: Map<string, EntityInstance>;
  index: BucketManager;
  candidateSet: Set<string>;
  visibleSet: Set<string>;
  previews: Map<string, TransformUpdate>;
  dirtyUids: Set<string>;
  frameId: number | null;
  geometryAllDirty: boolean;
  projectionDirty: boolean;
  visibilityDirty: boolean;
  styleDirty: boolean;
  forceDraw: boolean;
  cleared: boolean;
  lastSceneEntities: SceneData["entities"] | null;
  lastTemplates: Record<string, EntityTemplate> | null;
  lastZAxisDirection: SceneData["properties"]["zAxisDirection"] | null;
  lastParallaxIntensity: number | null;
  lastParallaxOrigin: { x: number; y: number } | null;
  lastParallaxActive: boolean | null;
  lastCamera: { x: number; y: number; zoom: number } | null;
  lastViewport: { width: number; height: number } | null;
  lastAppReadyRevision: number;
  lastShowCollisions: boolean;
  lastSelectedUIDs: string[];
  lastPrimitiveCount: number;
};

const COLLISION_CULLING_PADDING_PX = 128;

function createRuntime(): CollisionRuntime {
  return {
    latestParams: null,
    entries: new Map(),
    entitiesByUid: new Map(),
    index: new BucketManager(),
    candidateSet: new Set(),
    visibleSet: new Set(),
    previews: new Map(),
    dirtyUids: new Set(),
    frameId: null,
    geometryAllDirty: true,
    projectionDirty: true,
    visibilityDirty: true,
    styleDirty: true,
    forceDraw: true,
    cleared: true,
    lastSceneEntities: null,
    lastTemplates: null,
    lastZAxisDirection: null,
    lastParallaxIntensity: null,
    lastParallaxOrigin: null,
    lastParallaxActive: null,
    lastCamera: null,
    lastViewport: null,
    lastAppReadyRevision: -1,
    lastShowCollisions: false,
    lastSelectedUIDs: [],
    lastPrimitiveCount: 0,
  };
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
  let nextTemplate =
    preview.scaleX !== undefined || preview.scaleY !== undefined
      ? {
          ...template,
          scale: {
            x: preview.scaleX ?? template.scale.x,
            y: preview.scaleY ?? template.scale.y,
          },
        }
      : template;

  if (
    preview.collisionPos !== undefined ||
    preview.collisionSize !== undefined ||
    preview.collisionPolygon !== undefined ||
    preview.collisionCompound !== undefined
  ) {
    if (nextTemplate.physics) {
      let remainingDiagnostics = nextTemplate.physics.diagnostics ?? [];
      const curCollision = nextTemplate.physics.collision;

      if (preview.collisionPos !== undefined) {
        const hasChanged =
          preview.collisionPos.x !== curCollision.position.x ||
          preview.collisionPos.y !== curCollision.position.y ||
          preview.collisionPos.z !== curCollision.position.z;
        if (hasChanged) {
          remainingDiagnostics = filterDiagnosticsForEdit(remainingDiagnostics, { type: 'position' });
        }
      }

      if (preview.collisionSize !== undefined) {
        const hasChanged =
          preview.collisionSize.x !== curCollision.size.x ||
          preview.collisionSize.y !== curCollision.size.y ||
          preview.collisionSize.z !== curCollision.size.z;
        if (hasChanged) {
          remainingDiagnostics = filterDiagnosticsForEdit(remainingDiagnostics, { type: 'size' });
        }
      }

      if (preview.collisionPolygon !== undefined) {
        const hasChanged = !polygonsEqual(curCollision.polygon, preview.collisionPolygon);
        if (hasChanged) {
          remainingDiagnostics = filterDiagnosticsForEdit(remainingDiagnostics, { type: 'polygon' });
        }
      }

      if (preview.collisionCompound !== undefined) {
        const hasChanged = !compoundsEqual(curCollision.compound, preview.collisionCompound);
        if (hasChanged) {
          remainingDiagnostics = filterDiagnosticsForEdit(remainingDiagnostics, { type: 'compound' });
        }
      }

      const collision = {
        ...curCollision,
        ...(preview.collisionPos ? { position: preview.collisionPos } : {}),
        ...(preview.collisionSize ? { size: preview.collisionSize } : {}),
        ...(preview.collisionPolygon ? { polygon: preview.collisionPolygon } : {}),
        ...(preview.collisionCompound ? { compound: preview.collisionCompound } : {}),
      };

      const isValid = isCollisionGeometryValid({
        shape: nextTemplate.physics.shape,
        collision,
        diagnostics: remainingDiagnostics,
      });

      nextTemplate = {
        ...nextTemplate,
        physics: {
          ...nextTemplate.physics,
          collision: {
            ...collision,
            valid: isValid,
          },
          diagnostics: remainingDiagnostics,
        },
      };
    }
  }

  return { entity: nextEntity, template: nextTemplate };
}

function projectionFor(
  params: UseCollisionRendererParams,
  templateParallaxIntensity: number,
): CollisionProjection {
  return {
    camera: params.camera,
    parallaxContext: computeParallaxContext(
      params.scene.properties.parallaxIntensity,
      params.parallaxOriginNormalized,
      params.parallaxPreviewActive,
      params.refs.appRef.current,
    ),
    zAxisDirection: params.scene.properties.zAxisDirection,
    templateParallaxIntensity,
  };
}

function rebuildEntry(
  runtime: CollisionRuntime,
  params: UseCollisionRendererParams,
  uid: string,
) {
  runtime.index.removeEntity(uid);
  runtime.entries.delete(uid);
  const originalEntity = runtime.entitiesByUid.get(uid);
  if (!originalEntity || originalEntity.hide) return;
  const originalTemplate = resolveEntityTemplate(
    originalEntity,
    params.templates,
  );
  if (!originalTemplate?.physics) return;
  const resolved = applyPreview(
    originalEntity,
    originalTemplate,
    runtime.previews.get(uid),
  );
  const geometry = buildCollisionWorldGeometry(
    resolved.entity,
    resolved.template.physics,
    resolved.template.scale,
  );
  if (!geometry) return;
  const isValid = resolved.template.physics?.collision.valid ?? true;
  runtime.entries.set(uid, {
    uid,
    geometry,
    templateParallaxIntensity: resolved.template.parallaxIntensity,
    bounds: null,
    projected: null,
    isValid,
  });
}

function updateEntryProjection(
  runtime: CollisionRuntime,
  params: UseCollisionRendererParams,
  entry: CollisionCacheEntry,
) {
  entry.bounds = getProjectedCollisionBounds(
    entry.geometry,
    projectionFor(params, entry.templateParallaxIntensity),
  );
  entry.projected = null;
  if (entry.bounds) runtime.index.insertOrUpdate(entry.uid, entry.bounds);
  else runtime.index.removeEntity(entry.uid);
}

function setsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function boundsIntersect(left: Bounds, right: Bounds) {
  return (
    left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y
  );
}

function appendPrimitives(
  graphics: NonNullable<ViewportRefs["collisionGraphicsRef"]["current"]>,
  primitives: CollisionPrimitive[],
) {
  for (const primitive of primitives) {
    if (primitive.kind === "circle")
      graphics.circle(primitive.center.x, primitive.center.y, primitive.radius);
    else graphics.poly(primitive.points, primitive.closed);
  }
}

function appendFillPrimitives(
  graphics: NonNullable<ViewportRefs["collisionGraphicsRef"]["current"]>,
  primitives: CollisionPrimitive[],
) {
  for (const primitive of primitives) {
    if (primitive.kind === "circle") {
      graphics.circle(primitive.center.x, primitive.center.y, primitive.radius);
    } else if (primitive.closed) {
      graphics.poly(primitive.points, true);
    }
  }
}

function flushCollisionRenderer(
  runtime: CollisionRuntime,
  params: UseCollisionRendererParams,
) {
  runtime.frameId = null;
  const unselectedGraphics = params.refs.collisionGraphicsRef.current;
  const selectedGraphics = params.refs.selectedCollisionGraphicsRef.current;
  if (!unselectedGraphics || !selectedGraphics) return;

  const hasSelection = params.selectedUIDs.length > 0;

  if (!params.showCollisions && !hasSelection) {
    if (!runtime.cleared) {
      unselectedGraphics.clear();
      selectedGraphics.clear();
    }
    runtime.cleared = true;
    runtime.forceDraw = false;
    runtime.styleDirty = false;
    runtime.visibilityDirty = false;
    return;
  }

  const profiling = isPerformanceProfilerEnabled();
  const startedAt = profiling ? performance.now() : 0;
  let geometryChanged = false;

  if (runtime.geometryAllDirty) {
    runtime.entries.clear();
    runtime.index.clear();
    runtime.entitiesByUid = new Map(
      params.scene.entities.map((entity) => [entity.editorEntityUID, entity]),
    );
    for (const entity of params.scene.entities)
      rebuildEntry(runtime, params, entity.editorEntityUID);
    runtime.geometryAllDirty = false;
    runtime.dirtyUids.clear();
    runtime.projectionDirty = true;
    geometryChanged = true;
  } else if (runtime.dirtyUids.size > 0) {
    for (const uid of runtime.dirtyUids) {
      rebuildEntry(runtime, params, uid);
      const entry = runtime.entries.get(uid);
      if (entry) updateEntryProjection(runtime, params, entry);
    }
    runtime.dirtyUids.clear();
    geometryChanged = true;
  }

  if (runtime.projectionDirty) {
    runtime.index.clear();
    for (const entry of runtime.entries.values())
      updateEntryProjection(runtime, params, entry);
    runtime.projectionDirty = false;
  }

  const zoom = Math.max(0.001, params.camera.zoom);
  const renderer = params.refs.appRef.current?.renderer;
  const width = Math.max(params.viewportSize.width || renderer?.width || 1, 1);
  const height = Math.max(
    params.viewportSize.height || renderer?.height || 1,
    1,
  );
  const padding = COLLISION_CULLING_PADDING_PX / zoom;
  const viewportBounds: Bounds = {
    x: -params.camera.x / zoom - padding,
    y: -params.camera.y / zoom - padding,
    width: width / zoom + padding * 2,
    height: height / zoom + padding * 2,
  };
  const candidates = runtime.index.getEntitiesInRect(
    viewportBounds.x,
    viewportBounds.y,
    viewportBounds.width,
    viewportBounds.height,
    runtime.candidateSet,
  );
  const nextVisible = new Set<string>();
  for (const uid of candidates) {
    const bounds = runtime.entries.get(uid)?.bounds;
    if (bounds && boundsIntersect(bounds, viewportBounds)) nextVisible.add(uid);
  }
  const visibilityChanged = !setsEqual(runtime.visibleSet, nextVisible);
  runtime.visibleSet = nextVisible;
  runtime.visibilityDirty = false;

  const shouldDraw =
    runtime.forceDraw ||
    runtime.styleDirty ||
    runtime.cleared ||
    geometryChanged ||
    visibilityChanged;
  if (!shouldDraw) {
    if (profiling) {
      recordPerformanceMetric(
        "renderer.collision",
        performance.now() - startedAt,
        runtime.entries.size,
        undefined,
        {
          visibleEntities: runtime.visibleSet.size,
          primitiveCount: runtime.lastPrimitiveCount,
        },
      );
    }
    return;
  }

  const selected = new Set(params.selectedUIDs);
  let primitiveCount = 0;

  if (params.showCollisions) {
    unselectedGraphics.clear();
    const validPrimitives: CollisionPrimitive[] = [];
    const invalidPrimitives: CollisionPrimitive[] = [];
    for (const uid of runtime.visibleSet) {
      if (selected.has(uid)) continue;
      const entry = runtime.entries.get(uid);
      if (!entry) continue;
      if (!entry.projected) {
        entry.projected = projectCollisionGeometry(
          entry.geometry,
          projectionFor(params, entry.templateParallaxIntensity),
        );
      }
      if (entry.projected.length === 0) continue;
      primitiveCount += entry.projected.length;
      if (entry.isValid) {
        validPrimitives.push(...entry.projected);
      } else {
        invalidPrimitives.push(...entry.projected);
      }
    }
    if (validPrimitives.length > 0) {
      appendPrimitives(unselectedGraphics, validPrimitives);
      unselectedGraphics.stroke({
        width: 1 / zoom,
        color: 0x22d3ee,
        alpha: 0.9,
      });
    }
    if (invalidPrimitives.length > 0) {
      appendFillPrimitives(unselectedGraphics, invalidPrimitives);
      unselectedGraphics.fill?.({
        color: 0xef4444,
        alpha: 0.3,
      });
      appendPrimitives(unselectedGraphics, invalidPrimitives);
      unselectedGraphics.stroke({
        width: 1 / zoom,
        color: 0xef4444,
        alpha: 0.9,
      });
    }
  } else {
    unselectedGraphics.clear();
  }

  selectedGraphics.clear();
  if (hasSelection) {
    const validPrimitives: CollisionPrimitive[] = [];
    const invalidPrimitives: CollisionPrimitive[] = [];
    for (const uid of params.selectedUIDs) {
      const entry = runtime.entries.get(uid);
      if (!entry) continue;
      if (!entry.projected) {
        entry.projected = projectCollisionGeometry(
          entry.geometry,
          projectionFor(params, entry.templateParallaxIntensity),
        );
      }
      if (entry.projected.length === 0) continue;
      primitiveCount += entry.projected.length;
      if (entry.isValid) {
        validPrimitives.push(...entry.projected);
      } else {
        invalidPrimitives.push(...entry.projected);
      }
    }
    if (validPrimitives.length > 0) {
      appendPrimitives(selectedGraphics, validPrimitives);
      selectedGraphics.stroke({
        width: 2 / zoom,
        alignment: 1,
        color: 0x00bb00,
        alpha: 0.9,
      });
    }
    if (invalidPrimitives.length > 0) {
      appendFillPrimitives(selectedGraphics, invalidPrimitives);
      selectedGraphics.fill?.({
        color: 0xef4444,
        alpha: 0.3,
      });
      appendPrimitives(selectedGraphics, invalidPrimitives);
      selectedGraphics.stroke({
        width: 2 / zoom,
        alignment: 1,
        color: 0xef4444,
        alpha: 0.9,
      });
    }
  }

  runtime.cleared = false;
  runtime.lastPrimitiveCount = primitiveCount;
  runtime.forceDraw = false;
  runtime.styleDirty = false;
  if (profiling) {
    recordPerformanceMetric(
      "renderer.collision",
      performance.now() - startedAt,
      runtime.entries.size,
      undefined,
      {
        visibleEntities: runtime.visibleSet.size,
        primitiveCount,
      },
    );
  }
}

export function useCollisionRenderer(params: UseCollisionRendererParams) {
  const [runtime] = useState(createRuntime);
  const schedule = useCallback(() => {
    if (runtime.frameId !== null) return;
    runtime.frameId = window.requestAnimationFrame(() => {
      if (runtime.latestParams)
        flushCollisionRenderer(runtime, runtime.latestParams);
      else runtime.frameId = null;
    });
  }, [runtime]);

  useEffect(() => {
    runtime.latestParams = {
      refs: params.refs,
      scene: params.scene,
      templates: params.templates,
      selectedUIDs: params.selectedUIDs,
      showCollisions: params.showCollisions,
      camera: params.camera,
      viewportSize: params.viewportSize,
      parallaxOriginNormalized: params.parallaxOriginNormalized,
      parallaxPreviewActive: params.parallaxPreviewActive,
      appReadyRevision: params.appReadyRevision,
    };
    const sceneChanged = runtime.lastSceneEntities !== params.scene.entities;
    const templatesChanged = runtime.lastTemplates !== params.templates;
    const zAxisChanged =
      runtime.lastZAxisDirection !== params.scene.properties.zAxisDirection;
    const parallaxChanged =
      runtime.lastParallaxIntensity !==
        params.scene.properties.parallaxIntensity ||
      runtime.lastParallaxOrigin !== params.parallaxOriginNormalized ||
      runtime.lastParallaxActive !== params.parallaxPreviewActive;
    const cameraChanged =
      !runtime.lastCamera ||
      runtime.lastCamera.x !== params.camera.x ||
      runtime.lastCamera.y !== params.camera.y ||
      runtime.lastCamera.zoom !== params.camera.zoom;
    const zoomChanged =
      !runtime.lastCamera || runtime.lastCamera.zoom !== params.camera.zoom;
    const viewportChanged =
      !runtime.lastViewport ||
      runtime.lastViewport.width !== params.viewportSize.width ||
      runtime.lastViewport.height !== params.viewportSize.height;
    const appChanged = runtime.lastAppReadyRevision !== params.appReadyRevision;
    const showChanged = runtime.lastShowCollisions !== params.showCollisions;
    const selectionChanged =
      runtime.lastSelectedUIDs.length !== params.selectedUIDs.length ||
      runtime.lastSelectedUIDs.some((uid, i) => uid !== params.selectedUIDs[i]);

    if (sceneChanged || templatesChanged) {
      runtime.previews.clear();
      runtime.geometryAllDirty = true;
    }
    if (
      zAxisChanged ||
      parallaxChanged ||
      appChanged ||
      ((cameraChanged || viewportChanged) &&
        params.scene.properties.parallaxIntensity !== 0)
    ) {
      runtime.projectionDirty = true;
      runtime.forceDraw = true;
    }
    if (cameraChanged || viewportChanged) runtime.visibilityDirty = true;
    if (zoomChanged || selectionChanged) runtime.styleDirty = true;
    if (appChanged || showChanged || selectionChanged) runtime.forceDraw = true;

    runtime.lastSceneEntities = params.scene.entities;
    runtime.lastTemplates = params.templates;
    runtime.lastZAxisDirection = params.scene.properties.zAxisDirection;
    runtime.lastParallaxIntensity = params.scene.properties.parallaxIntensity;
    runtime.lastParallaxOrigin = params.parallaxOriginNormalized;
    runtime.lastParallaxActive = params.parallaxPreviewActive;
    runtime.lastCamera = params.camera;
    runtime.lastViewport = params.viewportSize;
    runtime.lastAppReadyRevision = params.appReadyRevision;
    runtime.lastShowCollisions = params.showCollisions;
    runtime.lastSelectedUIDs = params.selectedUIDs;
    runtime.styleDirty = runtime.styleDirty || showChanged || selectionChanged;
    schedule();
  }, [
    params.refs,
    params.scene,
    params.templates,
    params.selectedUIDs,
    params.showCollisions,
    params.camera,
    params.viewportSize,
    params.parallaxOriginNormalized,
    params.parallaxPreviewActive,
    params.appReadyRevision,
    runtime,
    schedule,
  ]);

  useEffect(
    () =>
      transformEventBus.subscribe((updates) => {
        for (const update of updates) {
          const previous = runtime.previews.get(update.uid) ?? {
            uid: update.uid,
          };
          runtime.previews.set(update.uid, { ...previous, ...update });
          runtime.dirtyUids.add(update.uid);
        }
        runtime.forceDraw = true;
        schedule();
      }),
    [params.refs, runtime, schedule],
  );

  useEffect(
    () => () => {
      if (runtime.frameId !== null) {
        window.cancelAnimationFrame(runtime.frameId);
        runtime.frameId = null;
      }
    },
    [runtime],
  );
}
