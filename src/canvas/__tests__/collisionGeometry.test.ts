import { describe, expect, it } from 'vitest';
import type { EntityInstance, EntityPhysicsConfig } from '../../types';
import { buildCollisionPrimitives } from '../collisionGeometry';

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
      position: { x: 5, y: 10 },
      size: { x: 20, y: 40 },
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

  it('applies instance rotation and ignores Z', () => {
    const first = buildCollisionPrimitives(entity({ angle: 90 }), physics(1), { x: 1, y: 1 });
    const second = buildCollisionPrimitives(entity({ angle: 90, position: { x: 100, y: 200, z: -12345 } }), physics(1), { x: 1, y: 1 });
    expect(second).toEqual(first);
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
    expect(compound).toHaveLength(2);
    expect(compound[0].kind).toBe('path');
    expect(compound[1]).toMatchObject({ kind: 'circle', radius: 10 });
  });
});
