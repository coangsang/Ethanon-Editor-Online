import type * as PIXI from 'pixi.js';
import type { EntityInstance, EntityTemplate, ParticleSystemConfig, SceneData, SpriteAtlas } from '../types';
import type { ParticleSystemRuntime } from './particleSystem';

export type Bounds = { x: number; y: number; width: number; height: number };

export type DrawSortKey = {
  depth: number;
  pieceOrder: number;
  yOrder: number;
  entityUid: string;
};

export type RenderFrame = {
  texture: PIXI.Texture;
  layoutWidth: number;
  layoutHeight: number;
  frameWidth: number;
  frameHeight: number;
  offsetX: number;
  offsetY: number;
  pivotX: number;
  pivotY: number;
};

export type MeshSyncRefs = {
  entities: SceneData['entities'] | null;
  parallaxIntensity: number | null;
  zAxisDirection: SceneData['properties']['zAxisDirection'] | null;
  templates: Record<string, EntityTemplate> | null;
  templateAtlases: Record<string, SpriteAtlas> | null;
  textureRevision: number;
  parallaxOrigin: { x: number; y: number } | null;
  parallaxActive: boolean;
};

export type AxisConstraint = 'x' | 'y' | 'free';

export type LiveUpdate = { uid: string; x?: number; y?: number; angle?: number };

export type ParticleHostState = {
  position: { x: number; y: number; z: number };
  angle: number;
  hide: boolean;
};

export type ParticleCullingEntry = {
  entity: EntityInstance;
  particleSystem: ParticleSystemConfig;
};

export type ViewportRefs = {
  containerRef: { current: HTMLDivElement | null };
  appRef: { current: PIXI.Application | null };
  worldRef: { current: PIXI.Container | null };
  gridRef: { current: PIXI.Graphics | null };
  entitiesContainerRef: { current: PIXI.Container | null };
  selectionRef: { current: PIXI.Graphics | null };
  marqueeGraphicsRef: { current: PIXI.Graphics | null };
  moveGizmoContainerRef: { current: PIXI.Container | null };
  spriteMapRef: { current: Map<string, PIXI.Mesh> };
  particleRuntimesRef: { current: Map<string, ParticleSystemRuntime> };
  particleRuntimeSignaturesRef: { current: Map<string, string> };
  activeParticleRuntimeKeysRef: { current: Set<string> };
  particleHostStatesRef: { current: Map<string, ParticleHostState> };
  particleCullingEntriesRef: { current: Map<string, ParticleCullingEntry> };
  baseTextureMapRef: { current: Map<string, PIXI.Texture> };
  frameTextureMapRef: { current: Map<string, PIXI.Texture> };
  textureUrlMapRef: { current: Map<string, string> };
  placeholderTextureRef: { current: PIXI.Texture | null };
  boundsMapRef: { current: Map<string, Bounds> };
  drawSortSignatureRef: { current: string };
  meshSyncRefsRef: { current: MeshSyncRefs };
  parallaxGeometryActiveRef: { current: boolean };
  parallaxEntityUIDsRef: { current: Set<string> };
  liveFrameRef: { current: number | null };
  pendingLiveUpdatesRef: { current: LiveUpdate[] | null };
  latestDragUpdatesRef: { current: LiveUpdate[] | null };
  handledFocusNonceRef: { current: number | null };
  isDraggingEntityRef: { current: boolean };
  dragStartMouseRef: { current: { x: number; y: number } };
  dragStartPositionsRef: { current: Map<string, { x: number; y: number }> };
  dragPreviewPositionsRef: { current: Map<string, { x: number; y: number }> };
  dragStartVerticesRef: { current: Map<string, Float32Array> };
  dragStartBoundsRef: { current: Map<string, Bounds> };
  dragStartCentroidRef: { current: { x: number; y: number } };
  hasDraggedRef: { current: boolean };
  entityClickHandledRef: { current: boolean };
  lastSceneEntityClickRef: { current: { uid: string; time: number } | null };
  isRotatingRef: { current: boolean };
  rotateStartRef: { current: { mouseAngle: number; pivotX: number; pivotY: number } };
  rotateStartDataRef: { current: Map<string, { angle: number; x: number; y: number }> };
  isMarqueeRef: { current: boolean };
  marqueeStartRef: { current: { x: number; y: number } };
  marqueeJustCompletedRef: { current: boolean };
  isPanningRef: { current: boolean };
  lastPanPosRef: { current: { x: number; y: number } };
  updateSelectionOutlinesRef: { current: () => void };
  placePreviewMeshRef: { current: PIXI.Mesh | null };
  placePreviewGraphicsRef: { current: PIXI.Graphics | null };
  placePreviewMouseRef: { current: { x: number; y: number; isOver: boolean } };
  updatePlacePreviewRef: { current: (x?: number, y?: number, isOver?: boolean) => void };
};

export type ParticleRuntimeConfig = {
  config: ParticleSystemConfig;
  textureKey: string;
  revision: number;
};
