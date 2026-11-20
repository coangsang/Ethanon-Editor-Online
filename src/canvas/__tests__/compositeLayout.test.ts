import { describe, expect, it } from 'vitest';
import { computeCompositeLayout, type CompositeLayerFrame } from '../compositeLayout';

function layer(overrides: Partial<CompositeLayerFrame>): CompositeLayerFrame {
  return {
    layoutWidth: 10,
    layoutHeight: 10,
    frameWidth: 10,
    frameHeight: 10,
    offsetX: 0,
    offsetY: 0,
    pivotX: 0.5,
    pivotY: 0.5,
    ...overrides,
  };
}

describe('computeCompositeLayout', () => {
  it('returns null when there are no layers', () => {
    expect(computeCompositeLayout([])).toBeNull();
  });

  it('keeps a single layer as is', () => {
    const result = computeCompositeLayout([
      layer({ layoutWidth: 100, layoutHeight: 80, frameWidth: 100, frameHeight: 80 }),
    ]);
    expect(result).toEqual({ width: 100, height: 80, pivotX: 0.5, pivotY: 0.5, placements: [{ x: 50, y: 40, rotation: 0, frameX: -50, frameY: -40 }] });
  });

  it('aligns the pivots of a body and a hair layer', () => {
    const body = layer({ layoutWidth: 100, layoutHeight: 100, frameWidth: 60, frameHeight: 80, offsetX: 20, offsetY: 10, pivotX: 0.5, pivotY: 1 });
    const hair = layer({ layoutWidth: 40, layoutHeight: 40, frameWidth: 40, frameHeight: 30, offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 0.5 });
    const result = computeCompositeLayout([body, hair]);
    expect(result).not.toBeNull();
    expect(result?.width).toBe(60);
    expect(result?.height).toBe(100);
    expect(result?.pivotX).toBeCloseTo(0.5);
    expect(result?.pivotY).toBeCloseTo(0.9);
    expect(result?.placements).toEqual([
      { x: 30, y: 90, rotation: 0, frameX: -30, frameY: -90 },
      { x: 30, y: 90, rotation: 0, frameX: -20, frameY: -20 },
    ]);
  });

  it('grows to the layer that extends beyond the other', () => {
    const small = layer({ layoutWidth: 10, layoutHeight: 10, frameWidth: 10, frameHeight: 10 });
    const wide = layer({ layoutWidth: 30, layoutHeight: 10, frameWidth: 30, frameHeight: 10 });
    const result = computeCompositeLayout([small, wide]);
    expect(result?.width).toBe(30);
    expect(result?.height).toBe(10);
    expect(result?.pivotX).toBeCloseTo(0.5);
    expect(result?.pivotY).toBeCloseTo(0.5);
    expect(result?.placements).toEqual([
      { x: 15, y: 5, rotation: 0, frameX: -5, frameY: -5 },
      { x: 15, y: 5, rotation: 0, frameX: -15, frameY: -5 },
    ]);
  });
  it('moves a layer by its position', () => {
    const body = layer({ layoutWidth: 20, layoutHeight: 20, frameWidth: 20, frameHeight: 20 });
    const weapon = layer({ layoutWidth: 10, layoutHeight: 4, frameWidth: 10, frameHeight: 4, position: { x: -40, y: 0 } });
    const result = computeCompositeLayout([body, weapon]);
    expect(result?.width).toBe(55);
    expect(result?.height).toBe(20);
    expect(result?.pivotX).toBeCloseTo(45 / 55);
    expect(result?.pivotY).toBeCloseTo(0.5);
    expect(result?.placements).toEqual([
      { x: 45, y: 10, rotation: 0, frameX: -10, frameY: -10 },
      { x: 5, y: 10, rotation: 0, frameX: -5, frameY: -2 },
    ]);
  });

  it('rotates a layer around its pivot', () => {
    const result = computeCompositeLayout([
      layer({ layoutWidth: 10, layoutHeight: 4, frameWidth: 10, frameHeight: 4, rotation: Math.PI / 2 }),
    ]);
    expect(result?.width).toBe(4);
    expect(result?.height).toBe(10);
    expect(result?.pivotX).toBeCloseTo(0.5);
    expect(result?.pivotY).toBeCloseTo(0.5);
    const placement = result?.placements[0];
    expect(placement?.x).toBe(2);
    expect(placement?.y).toBe(5);
    expect(placement?.rotation).toBeCloseTo(Math.PI / 2);
    expect(placement?.frameX).toBe(-5);
    expect(placement?.frameY).toBe(-2);
  });
});
