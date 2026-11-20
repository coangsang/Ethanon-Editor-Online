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
    expect(result).toEqual({ width: 100, height: 80, pivotX: 0.5, pivotY: 0.5, placements: [{ x: 0, y: 0 }] });
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
    expect(result?.placements).toEqual([{ x: 0, y: 0 }, { x: 10, y: 70 }]);
  });

  it('grows to the layer that extends beyond the other', () => {
    const small = layer({ layoutWidth: 10, layoutHeight: 10, frameWidth: 10, frameHeight: 10 });
    const wide = layer({ layoutWidth: 30, layoutHeight: 10, frameWidth: 30, frameHeight: 10 });
    const result = computeCompositeLayout([small, wide]);
    expect(result?.width).toBe(30);
    expect(result?.height).toBe(10);
    expect(result?.pivotX).toBeCloseTo(0.5);
    expect(result?.pivotY).toBeCloseTo(0.5);
    expect(result?.placements).toEqual([{ x: 10, y: 0 }, { x: 0, y: 0 }]);
  });
});
