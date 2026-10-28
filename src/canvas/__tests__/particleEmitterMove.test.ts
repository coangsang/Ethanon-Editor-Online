import { describe, expect, it } from 'vitest';
import * as PIXI from 'pixi.js';
import { ParticleSystemRuntime } from '../particleSystem';
import type { ParticleSystemConfig } from '../../types';

const config: ParticleSystemConfig = {
  particles: 2,
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
};

describe('particle emitter movement preview', () => {
  it('spawns future particles at the preview position while existing particles keep their path', () => {
    const source = new PIXI.BufferImageSource({ width: 32, height: 32 });
    const texture = new PIXI.Texture({ source, frame: new PIXI.Rectangle(0, 0, 32, 32) });
    const runtime = new ParticleSystemRuntime(config, texture);

    runtime.update(100, { x: 0, y: 0 }, { x: 0, y: 0, z: 0 });
    const firstParticle = runtime.container.children[0] as PIXI.Sprite;
    runtime.update(250, { x: 100, y: 40 }, { x: 100, y: 40, z: 0 });
    runtime.update(250, { x: 100, y: 40 }, { x: 100, y: 40, z: 0 });

    const secondParticle = runtime.container.children[1] as PIXI.Sprite;
    expect(firstParticle.x).toBeCloseTo(0);
    expect(firstParticle.y).toBeCloseTo(0);
    expect(secondParticle.x).toBeCloseTo(100);
    expect(secondParticle.y).toBeCloseTo(40);
  });
});
