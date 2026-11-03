// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPhysicsConfig, EntityTemplate, SceneData } from '../../types';
import { transformEventBus } from '../../store/TransformEventBus';
import type { ViewportRefs } from '../viewportTypes';
import { useCollisionRenderer } from '../useCollisionRenderer';

let nextAnimationFrameId = 1;
let animationFrames = new Map<number, FrameRequestCallback>();

function flushAnimationFrames() {
  const frames = [...animationFrames.values()];
  animationFrames.clear();
  act(() => frames.forEach(callback => callback(performance.now())));
}

beforeEach(() => {
  nextAnimationFrameId = 1;
  animationFrames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId++;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => animationFrames.delete(id)));
});

function fixture() {
  const physics: EntityPhysicsConfig = {
    shape: 1,
    static: false,
    sensor: false,
    bullet: false,
    fixedRotation: false,
    friction: 1,
    density: 1,
    restitution: 0,
    gravityScale: 1,
    collision: {
      valid: true,
      position: { x: 0, y: 0, z: 0 },
      size: { x: 20, y: 10, z: 10 },
      polygon: [], compound: [], joints: [],
    },
    warnings: [],
  };
  const template: EntityTemplate = {
    name: 'box', spriteFile: '', spriteCut: { x: 1, y: 1 }, type: 'horizontal',
    pivotAdjust: { x: 0, y: 0 }, scale: { x: 2, y: 1 }, parallaxIntensity: 1, physics,
  };
  const scene: SceneData = {
    properties: { ambient: { r: 1, g: 1, b: 1 }, lightIntensity: 1, zAxisDirection: { x: 0, y: 0 }, parallaxIntensity: 0 },
    entities: [{
      id: 1, entityName: 'box', editorEntityUID: 'uid', position: { x: 10, y: 20, z: 0 },
      angle: 0, spriteFrame: 8, hide: false, flipX: true, flipY: true, customData: [],
      inlineEntityData: { FileName: 'box.ent' },
    }],
  };
  const unselectedGraphics = { clear: vi.fn(), poly: vi.fn(), circle: vi.fn(), stroke: vi.fn(), position: { set: vi.fn() }, scale: { set: vi.fn() } };
  const selectedGraphics = { clear: vi.fn(), poly: vi.fn(), circle: vi.fn(), stroke: vi.fn(), position: { set: vi.fn() }, scale: { set: vi.fn() } };
  const refs = {
    collisionGraphicsRef: { current: unselectedGraphics },
    selectedCollisionGraphicsRef: { current: selectedGraphics },
    appRef: { current: { renderer: { width: 100, height: 100 } } },
  } as unknown as ViewportRefs;
  return { scene, templates: { box: template }, graphics: unselectedGraphics, unselectedGraphics, selectedGraphics, refs };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useCollisionRenderer', () => {
  it('honors the toggle and highlights selected collisions with green stroke even when toggle is off', () => {
    const data = fixture();
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: ['uid'],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 2 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });
    flushAnimationFrames();

    expect(data.selectedGraphics.poly).toHaveBeenCalledWith([
      { x: -10, y: 15 }, { x: 30, y: 15 }, { x: 30, y: 25 }, { x: -10, y: 25 },
    ], true);
    expect(data.selectedGraphics.stroke).toHaveBeenCalledWith(expect.objectContaining({
      color: 0x00bb00,
      width: 1,
      alignment: 1,
    }));

    data.selectedGraphics.poly.mockClear();
    rerender({ ...initialProps, showCollisions: false });
    flushAnimationFrames();
    expect(data.unselectedGraphics.clear).toHaveBeenCalled();
    expect(data.selectedGraphics.poly).toHaveBeenCalled();
    expect(data.selectedGraphics.stroke).toHaveBeenCalledWith(expect.objectContaining({
      color: 0x00bb00,
      width: 1,
      alignment: 1,
    }));

    rerender({ ...initialProps, showCollisions: false, selectedUIDs: [] });
    flushAnimationFrames();
    expect(data.selectedGraphics.clear).toHaveBeenCalled();
  });

  it('renders selected collision when initialized with showCollisions=false and selected later', () => {
    const data = fixture();
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [] as string[],
      showCollisions: false,
      camera: { x: 0, y: 0, zoom: 2 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });
    flushAnimationFrames();

    rerender({ ...initialProps, selectedUIDs: ['uid'] });
    flushAnimationFrames();

    expect(data.selectedGraphics.poly).toHaveBeenCalled();
  });

  it('redraws move, rotate, and scale previews from the transform event bus', () => {
    const data = fixture();
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();
    data.graphics.poly.mockClear();

    act(() => transformEventBus.emit([{ uid: 'uid', x: 100, y: 200, angle: 90, scaleX: 1, scaleY: 2 }]));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
    const points = data.graphics.poly.mock.calls[0][0] as Array<{ x: number; y: number }>;
    expect(points[0].x).toBeCloseTo(90);
    expect(points[0].y).toBeCloseTo(210);
  });

  it('redraws collision preview when collisionPos or collisionSize updates from event bus', () => {
    const data = fixture();
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();
    data.graphics.poly.mockClear();

    act(() => transformEventBus.emit([{ uid: 'uid', collisionPos: { x: 50, y: 50, z: 0 }, collisionSize: { x: 40, y: 60, z: 10 } }]));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
  });

  it('redraws parallax geometry when the camera changes', () => {
    const data = fixture();
    data.scene.entities[0].position.z = 10;
    data.scene.properties.parallaxIntensity = 1;
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: true,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });
    flushAnimationFrames();
    const firstX = data.graphics.poly.mock.calls[0][0][0].x;
    data.graphics.poly.mockClear();
    rerender({ ...initialProps, camera: { x: 20, y: 0, zoom: 1 } });
    flushAnimationFrames();
    expect(data.graphics.poly.mock.calls[0][0][0].x).not.toBe(firstX);
  });

  it('coalesces updates and culls collision bounds outside the padded viewport', () => {
    const data = fixture();
    const farEntity = {
      ...data.scene.entities[0],
      id: 2,
      editorEntityUID: 'far',
      position: { x: 10_000, y: 10_000, z: 0 },
    };
    const scene = { ...data.scene, entities: [...data.scene.entities, farEntity] };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));

    act(() => {
      transformEventBus.emit([{ uid: 'uid', x: 20 }]);
      transformEventBus.emit([{ uid: 'uid', y: 30 }]);
    });
    expect(animationFrames.size).toBe(1);
    flushAnimationFrames();

    // One visible box has six paths; the far box is not submitted to Pixi.
    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
    expect(data.graphics.stroke).toHaveBeenCalledTimes(1);
  });

  it('keeps a live preview when selection and camera change', () => {
    const data = fixture();
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [] as string[],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });
    flushAnimationFrames();
    act(() => transformEventBus.emit([{ uid: 'uid', x: 100 }]));
    flushAnimationFrames();

    data.selectedGraphics.poly.mockClear();
    rerender({ ...initialProps, selectedUIDs: ['uid'], camera: { x: -10, y: 0, zoom: 1 } });
    flushAnimationFrames();
    const points = data.selectedGraphics.poly.mock.calls[0][0] as Array<{ x: number; y: number }>;
    expect(points[0].x).toBeCloseTo(80);
  });

  it('culls by collision bounds instead of sprite position', () => {
    const data = fixture();
    const offsetTemplate = {
      ...data.templates.box,
      physics: {
        ...data.templates.box.physics!,
        collision: {
          ...data.templates.box.physics!.collision,
          position: { x: -4975, y: 0, z: 0 },
        },
      },
    };
    const scene = {
      ...data.scene,
      entities: [{
        ...data.scene.entities[0],
        position: { x: 10_000, y: 20, z: 0 },
      }],
    };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene,
      templates: { box: offsetTemplate },
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
  });

  it('culls correctly at the minimum supported zoom without scanning every viewport bucket', () => {
    const data = fixture();
    const farEntity = {
      ...data.scene.entities[0],
      id: 2,
      editorEntityUID: 'far',
      position: { x: 100_000, y: 100_000, z: 0 },
    };
    const scene = { ...data.scene, entities: [...data.scene.entities, farEntity] };

    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 0.005 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
    expect(data.graphics.stroke).toHaveBeenCalledTimes(1);
  });

  it('does not resubmit unchanged geometry when panning inside the same culling set', () => {
    const data = fixture();
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [] as string[],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });
    flushAnimationFrames();
    const clearCalls = data.graphics.clear.mock.calls.length;
    const polyCalls = data.graphics.poly.mock.calls.length;

    rerender({ ...initialProps, camera: { x: -1, y: 0, zoom: 1 } });
    flushAnimationFrames();

    expect(data.graphics.clear).toHaveBeenCalledTimes(clearCalls);
    expect(data.graphics.poly).toHaveBeenCalledTimes(polyCalls);
  });
});
