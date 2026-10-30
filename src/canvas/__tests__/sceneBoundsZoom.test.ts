import { describe, expect, it } from 'vitest';
import {
  calculateSceneBounds,
  computeSceneMinZoom,
  computeSceneFitCamera,
  DEFAULT_SCENE_BOUNDS,
  MIN_ZOOM_ABSOLUTE,
} from '../viewportMath';
import type { EntityInstance } from '../../types';
import type { Bounds } from '../viewportTypes';

function createEntity(uid: string, x: number, y: number): EntityInstance {
  return {
    id: 1,
    entityName: 'dummy.ent',
    editorEntityUID: uid,
    position: { x, y, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
  };
}

describe('calculateSceneBounds', () => {
  it('returns default 1920x1080 bounds when entities list is empty', () => {
    const bounds = calculateSceneBounds([]);
    expect(bounds).toEqual(DEFAULT_SCENE_BOUNDS);
  });

  it('calculates bounds from entities with fallback 64x64 footprint when boundsMap is empty', () => {
    const entities = [
      createEntity('e1', 100, 200),
      createEntity('e2', 500, 800),
    ];
    const bounds = calculateSceneBounds(entities);
    // e1: x in [68, 132], y in [168, 232]
    // e2: x in [468, 532], y in [768, 832]
    expect(bounds.x).toBe(68);
    expect(bounds.y).toBe(168);
    expect(bounds.width).toBe(532 - 68);
    expect(bounds.height).toBe(832 - 168);
  });

  it('uses cached boundsMap when available', () => {
    const entities = [
      createEntity('e1', 0, 0),
      createEntity('e2', 1000, 1000),
    ];
    const boundsMap = new Map<string, Bounds>([
      ['e1', { x: -100, y: -50, width: 200, height: 100 }],
      ['e2', { x: 1000, y: 1000, width: 300, height: 400 }],
    ]);
    const bounds = calculateSceneBounds(entities, boundsMap);
    // minX = -100, minY = -50, maxX = 1300, maxY = 1400
    expect(bounds).toEqual({
      x: -100,
      y: -50,
      width: 1400,
      height: 1450,
    });
  });
});

describe('computeSceneMinZoom & computeSceneFitCamera', () => {
  const viewportSize = { width: 1920, height: 1080 };

  it('computes min zoom that fits scene with padding', () => {
    const sceneBounds: Bounds = { x: 0, y: 0, width: 3840, height: 2160 };
    const padding = 64;
    // availW = 1920 - 128 = 1792, availH = 1080 - 128 = 952
    // fitZoom = min(1792 / 3840, 952 / 2160) = min(0.4666..., 0.4407...) = ~0.4407
    const minZoom = computeSceneMinZoom(sceneBounds, viewportSize, padding);
    expect(minZoom).toBeCloseTo(952 / 2160, 4);
  });

  it('supports huge scene sizes by scaling minZoom below standard 0.1 down to absolute limit', () => {
    const hugeSceneBounds: Bounds = { x: 0, y: 0, width: 40000, height: 30000 };
    const minZoom = computeSceneMinZoom(hugeSceneBounds, viewportSize, 64);
    expect(minZoom).toBeLessThan(0.1);
    expect(minZoom).toBeGreaterThanOrEqual(MIN_ZOOM_ABSOLUTE);
  });

  it('does not clamp minZoom above 1.0 for small scenes so users can zoom out', () => {
    const smallBounds: Bounds = { x: 0, y: 0, width: 64, height: 64 };
    const minZoom = computeSceneMinZoom(smallBounds, viewportSize, 64);
    expect(minZoom).toBeLessThanOrEqual(1.0);
  });

  it('caps fit camera zoom to 1.0 for small scenes instead of extreme magnification', () => {
    const smallBounds: Bounds = { x: 0, y: 0, width: 64, height: 64 };
    const camera = computeSceneFitCamera(smallBounds, viewportSize, 64);
    expect(camera.zoom).toBe(1.0);
  });

  it('computes centered camera transform for fit view on large scenes', () => {
    const sceneBounds: Bounds = { x: 0, y: 0, width: 3840, height: 2160 };
    const camera = computeSceneFitCamera(sceneBounds, viewportSize, 0);
    // availW = 1920, availH = 1080
    // fitZoom = min(1920/3840, 1080/2160) = 0.5
    expect(camera.zoom).toBeCloseTo(0.5, 4);
    // center = (1920, 1080)
    // cam.x = 1920/2 - 1920 * 0.5 = 960 - 960 = 0
    // cam.y = 1080/2 - 1080 * 0.5 = 540 - 540 = 0
    expect(camera.x).toBeCloseTo(0, 2);
    expect(camera.y).toBeCloseTo(0, 2);
  });
});

