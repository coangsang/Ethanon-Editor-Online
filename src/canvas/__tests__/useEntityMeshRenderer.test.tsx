// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import * as PIXI from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneData } from '../../types';
import type { ViewportRefs } from '../viewportTypes';

const profiler = vi.hoisted(() => ({
  finish: vi.fn(),
  start: vi.fn(() => profiler.finish),
}));

vi.mock('../../utils/performanceProfiler', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils/performanceProfiler')>(),
  startPerformanceMetric: profiler.start,
}));

import { useEntityMeshRenderer } from '../useEntityMeshRenderer';
import { transformEventBus } from '../../store/TransformEventBus';

let nextAnimationFrameId = 1;
let animationFrames = new Map<number, FrameRequestCallback>();

function flushAnimationFrames() {
  const frames = [...animationFrames.values()];
  animationFrames.clear();
  act(() => frames.forEach(callback => callback(performance.now())));
}

const properties = {
  ambient: { r: 0.5, g: 0.5, b: 0.5 },
  lightIntensity: 2,
  zAxisDirection: { x: 0, y: -1 },
  parallaxIntensity: 3,
};

function createRefs(): ViewportRefs {
  return {
    appRef: { current: { renderer: { width: 800, height: 600 } } },
    entitiesContainerRef: { current: { children: [], addChild: vi.fn(), removeChild: vi.fn() } },
    spriteMapRef: { current: new Map() },
    particleRuntimesRef: { current: new Map() },
    particleRuntimeSignaturesRef: { current: new Map() },
    activeParticleRuntimeKeysRef: { current: new Set() },
    particleHostStatesRef: { current: new Map() },
    particleCullingEntriesRef: { current: new Map() },
    boundsMapRef: { current: new Map() },
    drawSortSignatureRef: { current: '' },
    meshSyncRefsRef: {
      current: {
        entities: null,
        parallaxIntensity: null,
        zAxisDirection: null,
        templates: null,
        templateAtlases: null,
        textureRevision: -1,
        parallaxOrigin: null,
        parallaxActive: false,
      },
    },
    parallaxGeometryActiveRef: { current: false },
    parallaxEntityUIDsRef: { current: new Set() },
    isDraggingEntityRef: { current: false },
    isRotatingRef: { current: false },
    updateSelectionOutlinesRef: { current: null },
  } as unknown as ViewportRefs;
}

function hookProps(refs: ViewportRefs, scene: SceneData, camera = { x: 0, y: 0, zoom: 1 }) {
  return {
    refs,
    camera,
    scene,
    templates: {},
    templateAtlases: {},
    textureRevision: 0,
    appReadyRevision: 1,
    getRenderFrame: vi.fn(),
    parallaxOriginNormalized: { x: 0.5, y: 0.5 },
    parallaxPreviewActive: false,
    showParticles: false,
    viewportSize: { width: 800, height: 600 },
    onEntityPointerDown: vi.fn(),
  };
}

beforeEach(() => {
  nextAnimationFrameId = 1;
  animationFrames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    animationFrames.delete(id);
  }));
});

afterEach(() => {
  cleanup();
  profiler.start.mockClear();
  profiler.finish.mockClear();
  vi.unstubAllGlobals();
});

describe('useEntityMeshRenderer placement profiling', () => {
  it('profiles entity structural syncs but not camera-only or viewport-only passes', () => {
    const refs = createRefs();
    const scene: SceneData = { properties, entities: [] };
    const initialProps = hookProps(refs, scene);
    const { rerender } = renderHook(props => useEntityMeshRenderer(props), {
      initialProps,
    });

    expect(profiler.start).toHaveBeenCalledTimes(1);
    expect(profiler.start).toHaveBeenLastCalledWith('renderer.placement', 0);
    expect(profiler.finish).toHaveBeenCalledTimes(1);

    rerender({
      ...initialProps,
      camera: { x: 10, y: 20, zoom: 2 },
      viewportSize: { width: 1024, height: 768 },
    });
    expect(profiler.start).toHaveBeenCalledTimes(1);

    rerender({
      ...initialProps,
      scene: { ...scene, entities: [...scene.entities] },
    });
    expect(profiler.start).toHaveBeenCalledTimes(2);
    expect(profiler.finish).toHaveBeenCalledTimes(2);
  });

  it('does not record a structural sync while entity manipulation defers it', () => {
    const refs = createRefs();
    const scene: SceneData = { properties, entities: [] };
    const initialProps = hookProps(refs, scene);
    const { rerender } = renderHook(props => useEntityMeshRenderer(props), {
      initialProps,
    });
    const changedScene = { ...scene, entities: [...scene.entities] };

    refs.isDraggingEntityRef.current = true;
    rerender({ ...initialProps, scene: changedScene });
    expect(profiler.start).toHaveBeenCalledTimes(1);

    refs.isDraggingEntityRef.current = false;
    rerender({
      ...initialProps,
      scene: changedScene,
      camera: { x: 1, y: 0, zoom: 1 },
    });
    expect(profiler.start).toHaveBeenCalledTimes(2);
    expect(profiler.finish).toHaveBeenCalledTimes(2);
  });

  it('coalesces ambient tint updates without repeating structural work', () => {
    const refs = createRefs();
    const entity = {
      id: 1,
      entityName: 'inline',
      editorEntityUID: 'entity-1',
      position: { x: 0, y: 0, z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      diffuseColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 },
      customData: [],
      inlineEntityData: { Sprite: 'inline.png' },
      inlineTemplate: {
        name: 'inline',
        spriteFile: 'inline.png',
        spriteCut: { x: 1, y: 1 },
        type: 'horizontal' as const,
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        emissiveColor: { r: 0.1, g: 0.1, b: 0.1, a: 0 },
      },
    };
    const scene: SceneData = {
      properties: { ...properties, ambient: { r: 0.2, g: 0.2, b: 0.2 } },
      entities: [entity],
    };
    const renderFrame = {
      texture: PIXI.Texture.WHITE,
      layoutWidth: 32,
      layoutHeight: 32,
      frameWidth: 32,
      frameHeight: 32,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: 0.5,
    };
    const initialProps = {
      ...hookProps(refs, scene),
      getRenderFrame: vi.fn(() => renderFrame),
    };
    const { rerender } = renderHook(props => useEntityMeshRenderer(props), { initialProps });
    const mesh = refs.spriteMapRef.current.get(entity.editorEntityUID)!;
    flushAnimationFrames();

    expect(mesh.tint).toBe(0x262626);
    expect(mesh.alpha).toBe(0.8);
    const structuralRenderFrameCalls = initialProps.getRenderFrame.mock.calls.length;

    rerender({
      ...initialProps,
      scene: { ...scene, properties: { ...scene.properties, ambient: { r: 0.4, g: 0.4, b: 0.4 } } },
    });
    rerender({
      ...initialProps,
      scene: { ...scene, properties: { ...scene.properties, ambient: { r: 0.6, g: 0.6, b: 0.6 } } },
    });

    expect(initialProps.getRenderFrame).toHaveBeenCalledTimes(structuralRenderFrameCalls);
    expect(profiler.start).toHaveBeenCalledTimes(1);
    expect(animationFrames).toHaveLength(1);
    flushAnimationFrames();
    expect(mesh.tint).toBe(0x595959);

    act(() => {
      transformEventBus.emit([{
        uid: entity.editorEntityUID,
        diffuseColor: { r: 1, g: 1, b: 1, a: 0.5 },
      }]);
    });
    expect(mesh.tint).toBe(0xb3b3b3);
    expect(mesh.alpha).toBe(0.5);
  });

  it('still structurally syncs parallax and Z-axis changes', () => {
    const refs = createRefs();
    const entity = {
      id: 1,
      entityName: 'inline',
      editorEntityUID: 'entity-1',
      position: { x: 0, y: 0, z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
      inlineEntityData: { Sprite: 'inline.png' },
      inlineTemplate: {
        name: 'inline', spriteFile: 'inline.png', spriteCut: { x: 1, y: 1 },
        type: 'horizontal' as const, pivotAdjust: { x: 0, y: 0 }, scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
      },
    };
    const scene: SceneData = { properties, entities: [entity] };
    const renderFrame = {
      texture: PIXI.Texture.WHITE,
      layoutWidth: 32,
      layoutHeight: 32,
      frameWidth: 32,
      frameHeight: 32,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: 0.5,
    };
    const initialProps = { ...hookProps(refs, scene), getRenderFrame: vi.fn(() => renderFrame) };
    const { rerender } = renderHook(props => useEntityMeshRenderer(props), { initialProps });
    const initialCalls = initialProps.getRenderFrame.mock.calls.length;

    rerender({
      ...initialProps,
      scene: { ...scene, properties: { ...properties, parallaxIntensity: 4 } },
    });
    const afterParallaxCalls = initialProps.getRenderFrame.mock.calls.length;
    expect(afterParallaxCalls).toBeGreaterThan(initialCalls);

    rerender({
      ...initialProps,
      scene: {
        ...scene,
        properties: { ...properties, parallaxIntensity: 4, zAxisDirection: { x: 1, y: 0 } },
      },
    });
    expect(initialProps.getRenderFrame.mock.calls.length).toBeGreaterThan(afterParallaxCalls);
  });
});
