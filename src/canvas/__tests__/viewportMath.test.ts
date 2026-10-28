import { describe, expect, it } from 'vitest';
import type { EntityInstance, ParticleSystemConfig } from '../../types';
import { computeDragDelta, isParticleEmitterInViewport } from '../viewportMath';

describe('viewport drag math', () => {
  it('uses one integer-aligned delta for a multi-entity drag without grid snapping', () => {
    const delta = computeDragDelta(
      { x: 10.5, y: 20.25 },
      { x: 3.2, y: -2.6 },
      'free',
      false,
      16,
    );

    expect(delta).toEqual({ x: 3.5, y: -2.25 });
  });

  it('uses the selected entity as the snap reference and respects axis constraints', () => {
    const delta = computeDragDelta(
      { x: 10, y: 20 },
      { x: 10, y: -10 },
      'x',
      true,
      16,
    );

    expect(delta).toEqual({ x: 6, y: 0 });
  });
});

const particleSystem: ParticleSystemConfig = {
  particles: 1,
  allAtOnce: true,
  alphaMode: 0,
  repeat: 0,
  animationMode: 1,
  boundingSphere: 20,
  lifeTime: 1000,
  randomLifeTime: 0,
  angleDir: 0,
  randAngle: 0,
  size: 16,
  randomizeSize: 0,
  growth: 0,
  minSize: 0,
  maxSize: 16,
  angleStart: 0,
  randAngleStart: 0,
  bitmap: 'particle.png',
  gravity: { x: 0, y: 0 },
  direction: { x: 0, y: 0 },
  randomizeDir: { x: 0, y: 0 },
  spriteCut: { x: 1, y: 1 },
  startPoint: { x: 0, y: 0, z: 0 },
  randStartPoint: { x: 0, y: 0 },
  color0: { r: 1, g: 1, b: 1, a: 1 },
  color1: { r: 1, g: 1, b: 1, a: 1 },
  luminance: { r: 1, g: 1, b: 1 },
};

function createEntity(overrides: Partial<EntityInstance> = {}): EntityInstance {
  return {
    id: 1,
    editorEntityUID: 'particle-host',
    entityName: 'particle-host.ent',
    position: { x: 0, y: 0, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    ...overrides,
  };
}

describe('particle viewport culling', () => {
  const viewport = { width: 100, height: 100 };
  const camera = { x: 0, y: 0, zoom: 1 };
  const zAxisDirection = { x: 0, y: -1 };

  it('includes emitters in the viewport and touching its bounding-sphere edge', () => {
    expect(isParticleEmitterInViewport(createEntity(), particleSystem, camera, viewport, zAxisDirection)).toBe(true);
    expect(isParticleEmitterInViewport(
      createEntity({ position: { x: 248, y: 50, z: 0 } }),
      particleSystem,
      camera,
      viewport,
      zAxisDirection,
    )).toBe(true);
  });

  it('uses the 128px screen-space prewarm margin at different zoom levels', () => {
    expect(isParticleEmitterInViewport(
      createEntity({ position: { x: 248, y: 50, z: 0 } }),
      particleSystem,
      camera,
      viewport,
      zAxisDirection,
    )).toBe(true);
    expect(isParticleEmitterInViewport(
      createEntity({ position: { x: 115, y: 25, z: 0 } }),
      particleSystem,
      { x: 0, y: 0, zoom: 2 },
      viewport,
      zAxisDirection,
    )).toBe(true);
    expect(isParticleEmitterInViewport(
      createEntity({ position: { x: 249, y: 50, z: 0 } }),
      particleSystem,
      camera,
      viewport,
      zAxisDirection,
    )).toBe(false);
  });

  it('accounts for rotated start points, Z projection, and negative world coordinates', () => {
    const offsetSystem = {
      ...particleSystem,
      boundingSphere: 0,
      startPoint: { x: 20, y: 0, z: 10 },
    };
    expect(isParticleEmitterInViewport(
      createEntity({ position: { x: -128, y: 35, z: 5 }, angle: 90 }),
      offsetSystem,
      camera,
      viewport,
      zAxisDirection,
    )).toBe(true);
  });
});
