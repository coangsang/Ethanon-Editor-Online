import { describe, expect, it } from 'vitest';
import { computeAdaptiveGridStep } from '../viewportMath';

describe('computeAdaptiveGridStep', () => {
  it('returns baseStep as majorStep when zoom is 1.0', () => {
    const { majorStep, minorStep } = computeAdaptiveGridStep(16, 1.0);
    expect(majorStep).toBe(16);
    expect(minorStep).toBeNull();
  });

  it('scales up majorStep when zoomed out far', () => {
    const { majorStep, minorStep } = computeAdaptiveGridStep(16, 0.25);
    // 16 * 0.25 = 4 (< 14). Next: 32 * 0.25 = 8 (< 14). Next: 64 * 0.25 = 16 (>= 14).
    expect(majorStep).toBe(64);
    // 16 * 0.25 = 4 (< 7), so minorStep is null
    expect(minorStep).toBeNull();
  });

  it('provides minorStep when zoomed in closely', () => {
    const { majorStep, minorStep } = computeAdaptiveGridStep(16, 3.0);
    expect(majorStep).toBe(16);
    // 16 * 3.0 = 48 >= 28, 8 * 3.0 = 24 < 28 -> minorStep = 8
    expect(minorStep).toBe(8);
  });

  it('handles custom gridSize correctly', () => {
    const { majorStep } = computeAdaptiveGridStep(64, 0.1);
    // 64 * 0.1 = 6.4 (< 14). 128 * 0.1 = 12.8 (< 14). 256 * 0.1 = 25.6 (>= 14).
    expect(majorStep).toBe(256);
  });
});

