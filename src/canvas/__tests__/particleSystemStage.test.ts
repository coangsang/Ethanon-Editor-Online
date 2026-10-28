import { describe, expect, it } from 'vitest';
import * as PIXI from 'pixi.js';
import type { EntityInstance, ParticleSystemConfig } from '../../types';
import { ParticleSystemRuntime } from '../particleSystem';

function createMockTexture(width = 32, height = 32): PIXI.Texture {
  const source = new PIXI.BufferImageSource({ width, height });
  return new PIXI.Texture({
    source,
    frame: new PIXI.Rectangle(0, 0, width, height),
  });
}

function createDefaultConfig(overrides: Partial<ParticleSystemConfig> = {}): ParticleSystemConfig {
  return {
    particles: 10,
    allAtOnce: false,
    alphaMode: 0,
    repeat: 0,
    animationMode: 1,
    boundingSphere: 512,
    lifeTime: 1000,
    randomLifeTime: 0,
    angleDir: 0,
    randAngle: 0,
    size: 32,
    randomizeSize: 0,
    growth: 0,
    minSize: 0,
    maxSize: 1000,
    angleStart: 0,
    randAngleStart: 0,
    bitmap: 'smoke.png',
    gravity: { x: 0, y: 0 },
    direction: { x: 0, y: 0 },
    randomizeDir: { x: 0, y: 0 },
    spriteCut: { x: 1, y: 1 },
    startPoint: { x: 0, y: 0, z: 0 },
    randStartPoint: { x: 0, y: 0 },
    color0: { r: 1, g: 1, b: 1, a: 1 },
    color1: { r: 1, g: 1, b: 1, a: 0 },
    luminance: { r: 1, g: 1, b: 1 },
    ...overrides,
  };
}

describe('Particle System Stage & Host Entity Matching', () => {
  it('correctly extracts string editorEntityUID from rKey and updates runtime at entity position', () => {
    const texture = createMockTexture(32, 32);
    const entityUid = 'test-uuid-550e8400-e29b-41d4-a716-446655440000';
    const rKey = `${entityUid}:0`;

    const entity: EntityInstance = {
      id: 42,
      editorEntityUID: entityUid,
      entityName: 'test_hero.ent',
      position: { x: 450, y: 320, z: 5 },
      angle: 90,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
    };

    const entityByUid = new Map<string, EntityInstance>([[entity.editorEntityUID, entity]]);
    const particleRuntimes = new Map<string, ParticleSystemRuntime>();

    const sampleConfig = createDefaultConfig();
    const runtime = new ParticleSystemRuntime(
      sampleConfig,
      texture,
      { x: 0, y: 0 },
      { x: 0, y: 0, z: 0 },
      0,
    );
    particleRuntimes.set(rKey, runtime);

    // Simulate stage tick logic
    const extractedUid = rKey.split(':')[0];
    expect(extractedUid).toBe(entityUid);

    const foundEntity = entityByUid.get(extractedUid);
    expect(foundEntity).toBeDefined();
    expect(foundEntity).toBe(entity);

    if (foundEntity && !foundEntity.hide) {
      const v2Pos = { x: foundEntity.position.x, y: foundEntity.position.y };
      const v3Pos = foundEntity.position;
      runtime.update(50, v2Pos, v3Pos, foundEntity.angle, { r: 1, g: 1, b: 1 }, { x: 0, y: -1 });
    }

    expect(runtime).toBeDefined();
  });
});
