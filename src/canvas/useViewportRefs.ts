import { useMemo, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { ParticleSystemRuntime } from './particleSystem';
import type { Bounds, MeshSyncRefs, ParticleCullingEntry, ParticleHostState, ViewportRefs } from './viewportTypes';

export function useViewportRefs(): ViewportRefs {
  const initialMeshSyncRefs: MeshSyncRefs = {
    entities: null,
    parallaxIntensity: null,
    zAxisDirection: null,
    templates: null,
    templateAtlases: null,
    textureRevision: -1,
    parallaxOrigin: null,
    parallaxActive: false,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const gridRef = useRef<PIXI.Graphics | null>(null);
  const entitiesContainerRef = useRef<PIXI.Container | null>(null);
  const selectionRef = useRef<PIXI.Graphics | null>(null);
  const marqueeGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const moveGizmoContainerRef = useRef<PIXI.Container | null>(null);
  const spriteMapRef = useRef<Map<string, PIXI.Mesh>>(new Map());
  const particleRuntimesRef = useRef<Map<string, ParticleSystemRuntime>>(new Map());
  const particleRuntimeSignaturesRef = useRef<Map<string, string>>(new Map());
  const activeParticleRuntimeKeysRef = useRef<Set<string>>(new Set());
  const particleHostStatesRef = useRef<Map<string, ParticleHostState>>(new Map());
  const particleCullingEntriesRef = useRef<Map<string, ParticleCullingEntry>>(new Map());
  const baseTextureMapRef = useRef<Map<string, PIXI.Texture>>(new Map());
  const frameTextureMapRef = useRef<Map<string, PIXI.Texture>>(new Map());
  const textureUrlMapRef = useRef<Map<string, string>>(new Map());
  const placeholderTextureRef = useRef<PIXI.RenderTexture | null>(null);
  const boundsMapRef = useRef<Map<string, Bounds>>(new Map());
  const drawSortSignatureRef = useRef('');
  const meshSyncRefsRef = useRef(initialMeshSyncRefs);
  const parallaxGeometryActiveRef = useRef(false);
  const parallaxEntityUIDsRef = useRef(new Set<string>());
  const liveFrameRef = useRef<number | null>(null);
  const pendingLiveUpdatesRef = useRef(null);
  const latestDragUpdatesRef = useRef(null);
  const handledFocusNonceRef = useRef<number | null>(null);
  const handledFitNonceRef = useRef<number | null>(null);
  const isDraggingEntityRef = useRef(false);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartVerticesRef = useRef<Map<string, Float32Array>>(new Map());
  const dragStartBoundsRef = useRef<Map<string, Bounds>>(new Map());
  const dragStartCentroidRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const entityClickHandledRef = useRef(false);
  const lastSceneEntityClickRef = useRef<{ uid: string; time: number } | null>(null);
  const isRotatingRef = useRef(false);
  const rotateStartRef = useRef({ mouseAngle: 0, pivotX: 0, pivotY: 0 });
  const rotateStartDataRef = useRef<Map<string, { angle: number; x: number; y: number }>>(new Map());
  const isMarqueeRef = useRef(false);
  const marqueeStartRef = useRef({ x: 0, y: 0 });
  const marqueeJustCompletedRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const updateSelectionOutlinesRef = useRef(() => {});
  const placePreviewMeshRef = useRef<PIXI.Mesh | null>(null);
  const placePreviewGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const placePreviewMouseRef = useRef<{ x: number; y: number; isOver: boolean }>({ x: 0, y: 0, isOver: false });
  const updatePlacePreviewRef = useRef<(x?: number, y?: number, isOver?: boolean) => void>(() => {});

  return useMemo(() => ({
    containerRef,
    appRef,
    worldRef,
    gridRef,
    entitiesContainerRef,
    selectionRef,
    marqueeGraphicsRef,
    moveGizmoContainerRef,
    spriteMapRef,
    particleRuntimesRef,
    particleRuntimeSignaturesRef,
    activeParticleRuntimeKeysRef,
    particleHostStatesRef,
    particleCullingEntriesRef,
    baseTextureMapRef,
    frameTextureMapRef,
    textureUrlMapRef,
    placeholderTextureRef,
    boundsMapRef,
    drawSortSignatureRef,
    meshSyncRefsRef,
    parallaxGeometryActiveRef,
    parallaxEntityUIDsRef,
    liveFrameRef,
    pendingLiveUpdatesRef,
    latestDragUpdatesRef,
    handledFocusNonceRef,
    handledFitNonceRef,
    isDraggingEntityRef,
    dragStartMouseRef,
    dragStartPositionsRef,
    dragPreviewPositionsRef,
    dragStartVerticesRef,
    dragStartBoundsRef,
    dragStartCentroidRef,
    hasDraggedRef,
    entityClickHandledRef,
    lastSceneEntityClickRef,
    isRotatingRef,
    rotateStartRef,
    rotateStartDataRef,
    isMarqueeRef,
    marqueeStartRef,
    marqueeJustCompletedRef,
    isPanningRef,
    lastPanPosRef,
    updateSelectionOutlinesRef,
    placePreviewMeshRef,
    placePreviewGraphicsRef,
    placePreviewMouseRef,
    updatePlacePreviewRef,
  }), []);
}
