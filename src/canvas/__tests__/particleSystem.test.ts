import { describe, it, expect, beforeEach } from 'vitest';
import * as PIXI from 'pixi.js';
import { ParticleSystemRuntime } from '../particleSystem';
import type { ParticleSystemConfig } from '../../types';

function createMockTexture(width = 64, height = 64): PIXI.Texture {
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

describe('ParticleSystemRuntime Logic & Rigor Tests', () => {
  let texture: PIXI.Texture;

  beforeEach(() => {
    texture = createMockTexture(32, 32);
  });

  describe('LOGIC: Lifecycle, Repeat, and Kill status', () => {
    it('LOGIC-05: Should release particles staggered over lifetime when allAtOnce is false', () => {
      const config = createDefaultConfig({ particles: 10, lifeTime: 1000, allAtOnce: false });
      const runtime = new ParticleSystemRuntime(config, texture);

      expect(runtime.isFinished()).toBe(false);
      expect(runtime.getActiveParticlesCount()).toBe(0);

      // Tick 1: First particle should release (index 0 has releaseTime = 0)
      runtime.update(50);
      expect(runtime.getActiveParticlesCount()).toBe(1);

      // Advance by 450ms (total 500ms): particles up to 50% should be released
      runtime.update(250);
      runtime.update(200);
      expect(runtime.getActiveParticlesCount()).toBeGreaterThanOrEqual(5);

      // Advance to full 1000ms: all 10 particles active
      runtime.update(250);
      runtime.update(250);
      expect(runtime.getActiveParticlesCount()).toBe(10);
    });

    it('LOGIC-05: Should release all particles at once when allAtOnce is true', () => {
      const config = createDefaultConfig({ particles: 10, lifeTime: 1000, allAtOnce: true });
      const runtime = new ParticleSystemRuntime(config, texture);

      runtime.update(50);
      expect(runtime.getActiveParticlesCount()).toBe(10);
    });

    it('LOGIC-06: Should finish after specified repeat count', () => {
      const config = createDefaultConfig({ particles: 5, lifeTime: 200, allAtOnce: true, repeat: 1 });
      const runtime = new ParticleSystemRuntime(config, texture);

      runtime.update(50);
      expect(runtime.isFinished()).toBe(false);

      // Advance past first cycle lifetime
      runtime.update(200);
      // Next tick after cycle ends:
      runtime.update(50);

      expect(runtime.isFinished()).toBe(true);
      expect(runtime.getActiveParticlesCount()).toBe(0);
    });

    it('LOGIC-01 (Bug Fix Verification): kill() should allow active particles to expire then set isFinished to true', () => {
      const config = createDefaultConfig({ particles: 5, lifeTime: 200, allAtOnce: true, repeat: 0 });
      const runtime = new ParticleSystemRuntime(config, texture);

      runtime.update(50);
      expect(runtime.getActiveParticlesCount()).toBe(5);
      expect(runtime.isFinished()).toBe(false);

      runtime.kill(true);
      expect(runtime.isKilled()).toBe(true);

      // Still alive during remaining lifetime
      runtime.update(100);
      expect(runtime.getActiveParticlesCount()).toBe(5);
      expect(runtime.isFinished()).toBe(false);

      // Advance past remaining lifetime
      runtime.update(150);
      expect(runtime.getActiveParticlesCount()).toBe(0);
      expect(runtime.isFinished()).toBe(true);
    });
  });

  describe('PHYSICS & MATH: Movement, Gravity, and Rotation', () => {
    it('LOGIC-01: Direction should rotate according to entity angle', () => {
      const config = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        direction: { x: 10, y: 0 },
        growth: 0,
      });

      // Entity angle = 90 deg -> rad = -90 deg -> direction (10, 0) rotated by -90 deg becomes (0, -10)
      const runtime = new ParticleSystemRuntime(config, texture, { x: 100, y: 100 }, { x: 100, y: 100, z: 0 }, 90);

      // 250ms update (cappedDt = 250ms -> frameSpeed = 15)
      runtime.update(250, { x: 100, y: 100 }, { x: 100, y: 100, z: 0 }, 90);

      const sprite = runtime.container.children[0] as PIXI.Sprite;
      expect(sprite.x).toBeCloseTo(100, 1);
      // y decreases by dir.y * frameSpeed = -10 * 15 = -150 -> 100 - 150 = -50
      expect(sprite.y).toBeCloseTo(-50, 1);
    });

    it('LOGIC-02: Gravity should apply acceleration in world space', () => {
      const config = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        direction: { x: 0, y: 0 },
        gravity: { x: 0, y: 2 },
      });

      const runtime = new ParticleSystemRuntime(config, texture, { x: 0, y: 0 });

      // Tick 1 (frameSpeed = 6 for 100ms)
      runtime.update(100);

      const sprite = runtime.container.children[0] as PIXI.Sprite;
      expect(sprite.y).toBeGreaterThan(0);
    });

    it('LOGIC-07: Size growth should respect minSize and maxSize bounds', () => {
      const config = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        size: 10,
        growth: 5,
        minSize: 5,
        maxSize: 25,
      });

      const runtime = new ParticleSystemRuntime(config, texture);

      // Advance several ticks
      runtime.update(200);
      runtime.update(200);

      const sprite = runtime.container.children[0] as PIXI.Sprite;
      // size <= 25 (with texture size 32 -> scale <= 25/32)
      expect(sprite.scale.x * 32).toBeLessThanOrEqual(25.01);
    });

    it('LOGIC-08: Color interpolation should interpolate between color0 and color1 without NaN', () => {
      const config = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        lifeTime: 1000,
        color0: { r: 1, g: 0, b: 0, a: 1 },
        color1: { r: 0, g: 0, b: 1, a: 0 },
      });

      const runtime = new ParticleSystemRuntime(config, texture);

      // At 50% lifetime (two 250ms ticks = 500ms)
      runtime.update(250);
      runtime.update(250);

      const sprite = runtime.container.children[0] as PIXI.Sprite;
      expect(sprite.alpha).toBeCloseTo(0.5, 1);
    });

    it('ROTATION: Active particles should preserve trajectory in world space when Entity angle changes mid-flight', () => {
      const config = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        direction: { x: 10, y: 0 },
      });

      // Initially spawned at entity angle = 0 deg (direction vector remains (10, 0))
      const runtime = new ParticleSystemRuntime(config, texture, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0);

      // First tick at angle = 0: cappedDt = 100ms -> frameSpeed = 6.0
      // Position advances by dir.x * 6.0 = 10 * 6.0 = 60
      runtime.update(100, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0);
      const sprite = runtime.container.children[0] as PIXI.Sprite;
      expect(sprite.x).toBeCloseTo(60, 1);
      expect(sprite.y).toBeCloseTo(0, 1);

      // Second tick: Entity rotates to angle = 90 deg, BUT active particle continues along original velocity (10, 0)
      runtime.update(100, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 90);
      expect(sprite.x).toBeCloseTo(120, 1);
      expect(sprite.y).toBeCloseTo(0, 1);
    });

    it('ROTATION: Staggered particles emitted after Entity rotates should adopt the updated angle at release time', () => {
      const config = createDefaultConfig({
        particles: 2,
        allAtOnce: false,
        lifeTime: 1000,
        direction: { x: 10, y: 0 },
      });

      const runtime = new ParticleSystemRuntime(config, texture, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0);

      // Particle 0 releases at t=0 at angle=0.
      // Advance 100ms at angle=0
      runtime.update(100, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0);

      // Advance to >500ms (particle 1 releaseTime = 500ms) with Entity angle = 90 deg.
      // Note: dtMs is capped at 250ms per update, so call update(250) twice.
      runtime.update(250, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 90);
      runtime.update(250, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 90);

      const p1 = (runtime as any).particles[1];
      expect(p1.dir.x).toBeCloseTo(0, 1);
      expect(p1.dir.y).toBeCloseTo(-10, 1);
    });
  });

  describe('DEPTH & BLENDING', () => {
    it('DEPTH-01: AlphaMode 0 should sort child sprites by Y-depth offset (_offsetY)', () => {
      const config = createDefaultConfig({
        particles: 2,
        allAtOnce: true,
        alphaMode: 0,
        direction: { x: 0, y: 10 },
      });

      const runtime = new ParticleSystemRuntime(config, texture);
      // Particle 0 at y=50, Particle 1 at y=100
      (runtime as any).particles[0].pos.y = 50;
      (runtime as any).particles[0].startPoint.y = 0;
      (runtime as any).particles[1].pos.y = 100;
      (runtime as any).particles[1].startPoint.y = 0;

      runtime.update(50);

      const children = runtime.container.children as any[];
      // _offsetY for particle 1 is 0 - 100 = -100, for particle 0 is 0 - 50 = -50
      // -100 < -50, so child with smaller _offsetY appears earlier in children list
      expect(children[0]._offsetY).toBeLessThanOrEqual(children[1]._offsetY);
    });

    it('DEPTH-05: Ambient light should modulate AlphaMode 0 and 3 but NOT Additive AlphaMode 1', () => {
      const normalConfig = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        alphaMode: 0,
        luminance: { r: 0, g: 0, b: 0 },
        color0: { r: 1, g: 1, b: 1, a: 1 },
        color1: { r: 1, g: 1, b: 1, a: 1 },
      });
      const additiveConfig = createDefaultConfig({
        particles: 1,
        allAtOnce: true,
        alphaMode: 1,
        luminance: { r: 0, g: 0, b: 0 },
        color0: { r: 1, g: 1, b: 1, a: 1 },
        color1: { r: 1, g: 1, b: 1, a: 1 },
      });

      const normalRuntime = new ParticleSystemRuntime(normalConfig, texture);
      const additiveRuntime = new ParticleSystemRuntime(additiveConfig, texture);

      const darkAmbient = { r: 0.2, g: 0.2, b: 0.2 };

      normalRuntime.update(50, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0, darkAmbient);
      additiveRuntime.update(50, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 }, 0, darkAmbient);

      const normalSprite = normalRuntime.container.children[0] as PIXI.Sprite;
      const additiveSprite = additiveRuntime.container.children[0] as PIXI.Sprite;

      // Normal mode sprite is darkened by ambient
      expect(normalSprite.tint).toBeLessThan(0xFFFFFF);
      // Additive mode sprite stays full brightness (0xFFFFFF)
      expect(additiveSprite.tint).toBe(0xFFFFFF);
    });
  });

  describe('MEMORY & CLEANUP', () => {
    it('STAB-01: destroy() should clean up particles, container, and sub-textures without throwing', () => {
      const config = createDefaultConfig({
        particles: 10,
        spriteCut: { x: 2, y: 2 }, // Creates 4 sub-textures
      });

      const runtime = new ParticleSystemRuntime(config, texture);
      expect(runtime.container.children.length).toBe(10);

      runtime.destroy();
      expect(runtime.container.destroyed).toBe(true);
      expect(runtime.getActiveParticlesCount()).toBe(0);
    });

    it('STAB-05: Should handle extreme/boundary parameters safely (zero lifetime, zero particles)', () => {
      const config = createDefaultConfig({
        particles: 0,
        lifeTime: 0,
        size: 0,
        spriteCut: { x: 0, y: 0 },
      });

      expect(() => {
        const runtime = new ParticleSystemRuntime(config, texture);
        runtime.update(100);
        runtime.destroy();
      }).not.toThrow();
    });
  });

  describe('TRANSFORMS: mirrorX and mirrorY', () => {
    it('LOGIC-03: mirrorX should invert startPoint.x and direction.x without making spread negative', () => {
      const config = createDefaultConfig({
        startPoint: { x: 10, y: 5, z: 0 },
        direction: { x: 20, y: 0 },
        randStartPoint: { x: 4, y: 4 },
        randomizeDir: { x: 2, y: 2 },
      });

      const runtime = new ParticleSystemRuntime(config, texture);
      runtime.mirrorX(false);

      expect((runtime as any).config.startPoint.x).toBe(-10);
      expect((runtime as any).config.direction.x).toBe(-20);
      // Spread values must remain positive
      expect((runtime as any).config.randStartPoint.x).toBeGreaterThan(0);
      expect((runtime as any).config.randomizeDir.x).toBeGreaterThan(0);
    });
  });
});
