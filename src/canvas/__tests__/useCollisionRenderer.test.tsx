// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityPhysicsConfig, EntityTemplate, SceneData } from '../../types';
import { transformEventBus } from '../../store/TransformEventBus';
import type { ViewportRefs } from '../viewportTypes';
import { useCollisionRenderer } from '../useCollisionRenderer';

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
      position: { x: 0, y: 0 },
      size: { x: 20, y: 10 },
      polygon: [], compound: [], joints: [],
    },
    warnings: [],
  };
  const template: EntityTemplate = {
    name: 'box', spriteFile: '', spriteCut: { x: 1, y: 1 }, type: 'horizontal',
    pivotAdjust: { x: 0, y: 0 }, scale: { x: 2, y: 1 }, parallaxIntensity: 1, physics,
  };
  const scene: SceneData = {
    properties: { ambient: { r: 1, g: 1, b: 1 }, lightIntensity: 1, zAxisDirection: { x: 1, y: 1 }, parallaxIntensity: 99 },
    entities: [{
      id: 1, entityName: 'box', editorEntityUID: 'uid', position: { x: 10, y: 20, z: 999 },
      angle: 0, spriteFrame: 8, hide: false, flipX: true, flipY: true, customData: [],
      inlineEntityData: { FileName: 'box.ent' },
    }],
  };
  const graphics = { clear: vi.fn(), poly: vi.fn(), circle: vi.fn(), stroke: vi.fn() };
  const refs = { collisionGraphicsRef: { current: graphics } } as unknown as ViewportRefs;
  return { scene, templates: { box: template }, graphics, refs };
}

afterEach(cleanup);

describe('useCollisionRenderer', () => {
  it('honors the toggle and highlights selected collisions', () => {
    const data = fixture();
    const initialProps = {
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: ['uid'],
      showCollisions: true,
      cameraZoom: 2,
      appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useCollisionRenderer(props), { initialProps });

    expect(data.graphics.poly).toHaveBeenCalledWith([
      { x: -10, y: 15 }, { x: 30, y: 15 }, { x: 30, y: 25 }, { x: -10, y: 25 },
    ], true);
    expect(data.graphics.stroke).toHaveBeenCalledWith(expect.objectContaining({ color: 0xfbbf24, width: 1 }));

    const polyCalls = data.graphics.poly.mock.calls.length;
    rerender({ ...initialProps, showCollisions: false });
    expect(data.graphics.clear).toHaveBeenCalled();
    expect(data.graphics.poly).toHaveBeenCalledTimes(polyCalls);
  });

  it('redraws move, rotate, and scale previews from the transform event bus', () => {
    const data = fixture();
    renderHook(() => useCollisionRenderer({
      refs: data.refs,
      scene: data.scene,
      templates: data.templates,
      selectedUIDs: [],
      showCollisions: true,
      cameraZoom: 1,
      appReadyRevision: 1,
    }));
    data.graphics.poly.mockClear();

    act(() => transformEventBus.emit([{ uid: 'uid', x: 100, y: 200, angle: 90, scaleX: 1, scaleY: 2 }]));

    expect(data.graphics.poly).toHaveBeenCalledTimes(1);
    const points = data.graphics.poly.mock.calls[0][0] as Array<{ x: number; y: number }>;
    expect(points[0].x).toBeCloseTo(90);
    expect(points[0].y).toBeCloseTo(210);
  });
});
