import { describe, expect, it } from 'vitest';
import type { EntityInstance, EntityPhysicsConfig } from '../../types';
import {
  buildCollisionPrimitives,
  buildCollisionWorldGeometry,
  getProjectedCollisionBounds,
} from '../collisionGeometry';

function entity(overrides: Partial<EntityInstance> = {}): EntityInstance {
  return {
    id: 1,
    entityName: 'test',
    editorEntityUID: 'uid',
    position: { x: 100, y: 200, z: 999 },
    angle: 0,
    spriteFrame: 7,
    hide: false,
    flipX: true,
    flipY: true,
    customData: [],
    ...overrides,
  };
}

function physics(shape: EntityPhysicsConfig['shape']): EntityPhysicsConfig {
  return {
    shape,
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
      position: { x: 5, y: 10, z: 0 },
      size: { x: 20, y: 40, z: 10 },
      polygon: [],
      compound: [],
      joints: [],
    },
    warnings: [],
  };
}

describe('collision geometry', () => {
  it('scales collision position and size independently from sprite data', () => {
    const [primitive] = buildCollisionPrimitives(entity(), physics(1), { x: 2, y: 3 });
    expect(primitive).toEqual({
      kind: 'path', closed: true,
      points: [
        { x: 90, y: 170 }, { x: 130, y: 170 }, { x: 130, y: 290 }, { x: 90, y: 290 },
      ],
    });
  });

  it('mirrors offset and polygon geometry with negative entity scale', () => {
    const config = physics(3);
    config.collision.polygon = [
      { name: 'v0', x: -1, y: -1 }, { name: 'v1', x: 1, y: -1 }, { name: 'v2', x: 0, y: 1 },
    ];
    const [primitive] = buildCollisionPrimitives(entity({ position: { x: 0, y: 0, z: -500 } }), config, { x: -2, y: 1 });
    expect(primitive).toMatchObject({
      kind: 'path',
      points: [{ x: 10, y: -10 }, { x: -30, y: -10 }, { x: -10, y: 30 }],
    });
  });

  it('applies instance rotation and projects entity and collision Z', () => {
    const first = buildCollisionPrimitives(entity({ angle: 90 }), physics(1), { x: 1, y: 1 });
    const config = physics(1);
    config.collision.position.z = 4;
    config.collision.size.z = 6;
    const second = buildCollisionPrimitives(
      entity({ angle: 90, position: { x: 100, y: 200, z: 10 } }),
      config,
      { x: 1, y: 1 },
      {
        camera: { x: 0, y: 0, zoom: 1 },
        parallaxContext: { globalParallaxIntensity: 1, screenWidth: 100, originPxX: 0, originPxY: 0 },
        zAxisDirection: { x: 0, y: -1 },
        templateParallaxIntensity: 1,
      },
    );
    expect(second).toHaveLength(6);
    expect((second[0] as { points: Array<{ x: number; y: number }> }).points[0]).toEqual({ x: 99, y: 224.5 });
    expect((second[1] as { points: Array<{ x: number; y: number }> }).points[0]).toEqual({ x: 99, y: 218.5 });
    expect(first[0]).toMatchObject({ kind: 'path' });
  });

  it('builds circles and compound child shapes', () => {
    const circle = buildCollisionPrimitives(entity(), physics(2), { x: 2, y: 1 });
    expect(circle[0]).toMatchObject({ kind: 'circle', radius: 20 });

    const config = physics(4);
    config.collision.compound = [
      { name: 'box', shape: 'box', posX: 1, posY: 0, sizeX: 1, sizeY: 2, angle: 0 },
      { name: 'circle', shape: 'circle', posX: 0, posY: -1, radius: 0.5, angle: 0 },
    ];
    const compound = buildCollisionPrimitives(entity(), config, { x: 2, y: 3 });
    expect(compound).toHaveLength(12);
    expect(compound[0].kind).toBe('path');
    expect(compound[6]).toMatchObject({ kind: 'circle', radius: 10 });
  });

  it('does not render a collision marked invalid', () => {
    const config = physics(1);
    config.collision.valid = false;
    expect(buildCollisionPrimitives(entity(), config, { x: 1, y: 1 })).toEqual([]);
  });

  it('computes projected bounds that contain every generated primitive', () => {
    const config = physics(4);
    config.collision.compound = [
      { name: 'box', shape: 'box', posX: 1, posY: 0, sizeX: 1, sizeY: 2, angle: 0.4 },
      { name: 'circle', shape: 'circle', posX: -1, posY: 1, radius: 0.75, angle: 0 },
    ];
    const target = entity({ angle: 35, position: { x: 100, y: 200, z: 10 } });
    const projection = {
      camera: { x: 20, y: -10, zoom: 1.5 },
      parallaxContext: { globalParallaxIntensity: 2, screenWidth: 800, originPxX: 400, originPxY: 300 },
      zAxisDirection: { x: 0.25, y: -1 },
      templateParallaxIntensity: 0.8,
    };
    const geometry = buildCollisionWorldGeometry(target, config, { x: -2, y: 3 });
    const bounds = getProjectedCollisionBounds(geometry, projection)!;
    const primitives = buildCollisionPrimitives(target, config, { x: -2, y: 3 }, projection);
    for (const primitive of primitives) {
      if (primitive.kind === 'path') {
        for (const point of primitive.points) {
          expect(point.x).toBeGreaterThanOrEqual(bounds.x - 1e-8);
          expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-8);
          expect(point.y).toBeGreaterThanOrEqual(bounds.y - 1e-8);
          expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-8);
        }
      } else {
        expect(primitive.center.x - primitive.radius).toBeGreaterThanOrEqual(bounds.x - 1e-8);
        expect(primitive.center.x + primitive.radius).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-8);
      }
    }
  });

  it('rejects non-finite transforms and projections without throwing', () => {
    expect(buildCollisionWorldGeometry(entity({ angle: Number.NaN }), physics(1), { x: 1, y: 1 })).toBeNull();
    expect(buildCollisionPrimitives(entity(), physics(1), { x: Number.POSITIVE_INFINITY, y: 1 })).toEqual([]);
    expect(buildCollisionPrimitives(entity(), physics(1), { x: 1, y: 1 }, {
      camera: { x: 0, y: 0, zoom: 0 },
      parallaxContext: { globalParallaxIntensity: 0, screenWidth: 100, originPxX: 0, originPxY: 0 },
      zAxisDirection: { x: 0, y: 0 },
      templateParallaxIntensity: 1,
    })).toEqual([]);
  });
});
