// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPhysicsConfig, EntityTemplate, SceneData } from '../../types';
import { createDefaultPhysics } from '../../utils/entityTemplate';
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
  const unselectedGraphics = { clear: vi.fn(), poly: vi.fn(), circle: vi.fn(), stroke: vi.fn(), fill: vi.fn(), position: { set: vi.fn() }, scale: { set: vi.fn() } };
  const selectedGraphics = { clear: vi.fn(), poly: vi.fn(), circle: vi.fn(), stroke: vi.fn(), fill: vi.fn(), position: { set: vi.fn() }, scale: { set: vi.fn() } };
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

  it('updates compound collision preview live through the event bus', () => {
    const data = fixture();
    const compoundTemplate = {
      ...data.templates.box,
      physics: {
        ...data.templates.box.physics!,
        shape: 4 as const,
        collision: {
          ...data.templates.box.physics!.collision,
          compound: [
            {
              name: 'sub_0',
              shape: 'box' as const,
              posX: 0,
              posY: 0,
              sizeX: 1,
              sizeY: 1,
              angle: 0,
            },
          ],
        },
      },
    };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: { box: compoundTemplate },
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

    act(() => transformEventBus.emit([{
      uid: 'uid',
      collisionCompound: [
        {
          name: 'sub_0',
          shape: 'box',
          posX: 0.5,
          posY: 0.5,
          sizeX: 2,
          sizeY: 2,
          angle: 0,
        },
      ],
    }]));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalledTimes(6);
  });

  it('updates live collision rendering when transformEventBus emits collisionPolygon', () => {
    const data = fixture();
    const polyTemplate: EntityTemplate = {
      ...data.templates.box,
      physics: {
        ...createDefaultPhysics(3),
        shape: 3,
        collision: {
          valid: true,
          position: { x: 0, y: 0, z: 0 },
          size: { x: 64, y: 64, z: 32 },
          polygon: [
            { name: 'v0', x: 0, y: -1 },
            { name: 'v1', x: 1, y: 1 },
            { name: 'v2', x: -1, y: 1 },
          ],
          compound: [],
          joints: [],
        },
      },
    };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: { box: polyTemplate },
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

    act(() => transformEventBus.emit([{
      uid: 'uid',
      collisionPolygon: [
        { name: 'v0', x: 0, y: -1 },
        { name: 'v1', x: 1, y: 0 },
        { name: 'v2', x: 0, y: 1 },
        { name: 'v3', x: -1, y: 0 },
      ],
    }]));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalled();
  });

  it('stops drawing a live polygon preview that becomes invalid', () => {
    const data = fixture();
    const polyTemplate: EntityTemplate = {
      ...data.templates.box,
      physics: {
        ...createDefaultPhysics(3),
        shape: 3,
        collision: {
          valid: true,
          position: { x: 0, y: 0, z: 0 },
          size: { x: 64, y: 64, z: 32 },
          polygon: [
            { name: 'v0', x: 0, y: -1 },
            { name: 'v1', x: 1, y: 1 },
            { name: 'v2', x: -1, y: 1 },
          ],
          compound: [],
          joints: [],
        },
      },
    };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: { box: polyTemplate },
      selectedUIDs: [],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();
    expect(data.graphics.poly).toHaveBeenCalled();
    data.graphics.poly.mockClear();
    data.graphics.stroke.mockClear();
    data.graphics.fill.mockClear();

    act(() => transformEventBus.emit([{
      uid: 'uid',
      collisionPolygon: [
        { name: 'v0', x: -0.5, y: -0.5 },
        { name: 'v1', x: 0, y: 0 },
        { name: 'v2', x: 0.5, y: -0.5 },
        { name: 'v3', x: 0.5, y: 0.5 },
        { name: 'v4', x: -0.5, y: 0.5 },
      ],
    }]));
    flushAnimationFrames();

    expect(data.graphics.poly).toHaveBeenCalled();
    expect(data.graphics.fill).toHaveBeenCalledWith(expect.objectContaining({
      color: 0xef4444,
      alpha: 0.3,
    }));
    expect(data.graphics.stroke).toHaveBeenCalledWith(expect.objectContaining({
      color: 0xef4444,
      alpha: 0.9,
    }));
  });

  it('renders invalid selection in red with fill even when showCollisions is false', () => {
    const data = fixture();
    const invalidTemplate: EntityTemplate = {
      ...data.templates.box,
      physics: {
        ...data.templates.box.physics!,
        shape: 3,
        collision: {
          ...data.templates.box.physics!.collision,
          valid: false,
          polygon: [
            { name: 'v0', x: -0.5, y: -0.5 },
            { name: 'v1', x: 0, y: 0 },
            { name: 'v2', x: 0.5, y: -0.5 },
            { name: 'v3', x: 0.5, y: 0.5 },
            { name: 'v4', x: -0.5, y: 0.5 },
          ],
        },
      },
    };
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: { box: invalidTemplate },
      selectedUIDs: ['uid'],
      showCollisions: false,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();

    expect(data.selectedGraphics.poly).toHaveBeenCalled();
    expect(data.selectedGraphics.fill).toHaveBeenCalledWith(expect.objectContaining({
      color: 0xef4444,
      alpha: 0.3,
    }));
    expect(data.selectedGraphics.stroke).toHaveBeenCalledWith(expect.objectContaining({
      color: 0xef4444,
      alpha: 0.9,
      width: 2,
    }));
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

  it('maintains invalid red color during live preview when entity has parser diagnostics, and turns valid when geometry is fixed', () => {
    const data = fixture();
    const invalidPhysics: EntityPhysicsConfig = {
      shape: 4,
      static: false,
      sensor: false,
      bullet: false,
      fixedRotation: false,
      friction: 1,
      density: 1,
      restitution: 0,
      gravityScale: 1,
      collision: {
        valid: false,
        position: { x: 0, y: 0, z: 0 },
        size: { x: 40, y: 40, z: 10 },
        polygon: [],
        compound: [
          { name: 'outside', shape: 'box', posX: 0, posY: 0, sizeX: 1, sizeY: 1 },
        ],
        joints: [],
      },
      diagnostics: [
        {
          scope: 'compound',
          target: 'Compound bad',
          code: 'UNSUPPORTED_SHAPE_TYPE',
          message: 'has unsupported type "capsule"',
        },
      ],
      warnings: ['Compound shape "bad" has unsupported type "capsule".'],
    };

    const template: EntityTemplate = {
      name: 'compoundBad',
      spriteFile: '',
      spriteCut: { x: 1, y: 1 },
      type: 'horizontal',
      pivotAdjust: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      parallaxIntensity: 1,
      physics: invalidPhysics,
    };

    const scene: SceneData = {
      properties: { ambient: { r: 1, g: 1, b: 1 }, lightIntensity: 1, zAxisDirection: { x: 0, y: 0 }, parallaxIntensity: 0 },
      entities: [{
        id: 1,
        entityName: 'compoundBad',
        editorEntityUID: 'comp-1',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: { FileName: 'compoundBad.ent' },
      }],
    };

    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene,
      templates: { compoundBad: template },
      selectedUIDs: ['comp-1'],
      showCollisions: true,
      camera: { x: 0, y: 0, zoom: 1 },
      viewportSize: { width: 100, height: 100 },
      parallaxOriginNormalized: { x: 0.5, y: 0.5 },
      parallaxPreviewActive: false,
      appReadyRevision: 1,
    }));
    flushAnimationFrames();

    // 1. Initial render has red stroke (0xef4444)
    expect(data.selectedGraphics.stroke).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 0xef4444 }),
    );

    // 2. Dragging Position (preview) keeps red stroke because compound diagnostic still persists
    act(() => {
      transformEventBus.emit([{ uid: 'comp-1', collisionPos: { x: 10, y: 10, z: 0 } }]);
    });
    flushAnimationFrames();

    expect(data.selectedGraphics.stroke).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 0xef4444 }),
    );

    // 3. Fixing compound geometry during preview turns stroke green (0x00bb00)
    act(() => {
      transformEventBus.emit([
        {
          uid: 'comp-1',
          collisionCompound: [
            { name: 'fixedBox', shape: 'box', posX: 0, posY: 0, sizeX: 1, sizeY: 1 },
          ],
        },
      ]);
    });
    flushAnimationFrames();

    expect(data.selectedGraphics.stroke).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 0x00bb00 }),
    );
  });
});
