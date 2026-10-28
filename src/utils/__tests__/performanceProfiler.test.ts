import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPerformanceSummary,
  measurePerformanceMetric,
  recordPerformanceMetric,
  resetPerformanceProfiler,
  setPerformanceProfilerEnabled,
} from '../performanceProfiler';

describe('performanceProfiler', () => {
  beforeEach(() => {
    setPerformanceProfilerEnabled(false);
    resetPerformanceProfiler();
  });

  it('does not read the clock or record samples while disabled', () => {
    const nowSpy = vi.spyOn(performance, 'now');
    const result = measurePerformanceMetric('history.push', 10, () => 'result');

    expect(result).toBe('result');
    expect(nowSpy).not.toHaveBeenCalled();
    expect(getPerformanceSummary('history.push')).toBeNull();
  });

  it('keeps only the latest 120 samples', () => {
    setPerformanceProfilerEnabled(true);
    for (let index = 0; index < 125; index++) {
      recordPerformanceMetric('texture.scan', index, 1000, index);
    }

    const summary = getPerformanceSummary('texture.scan');
    expect(summary?.sampleCount).toBe(120);
    expect(summary?.latestMs).toBe(124);
  });

  it('calculates median and nearest-rank p95', () => {
    setPerformanceProfilerEnabled(true);
    for (let duration = 1; duration <= 20; duration++) {
      recordPerformanceMetric('renderer.placement', duration, 5000);
    }

    const summary = getPerformanceSummary('renderer.placement');
    expect(summary?.medianMs).toBe(10.5);
    expect(summary?.p95Ms).toBe(19);
    expect(summary?.entityCount).toBe(5000);
  });

  it('starts a clean sample session only when transitioning from disabled to enabled', () => {
    setPerformanceProfilerEnabled(true);
    recordPerformanceMetric('history.push', 1, 1);

    setPerformanceProfilerEnabled(true);
    expect(getPerformanceSummary('history.push')?.sampleCount).toBe(1);

    setPerformanceProfilerEnabled(false);
    setPerformanceProfilerEnabled(true);
    expect(getPerformanceSummary('history.push')).toBeNull();
  });

  it('clears every metric on reset', () => {
    setPerformanceProfilerEnabled(true);
    recordPerformanceMetric('history.push', 1, 1);
    recordPerformanceMetric('texture.commit', 2, 1);

    resetPerformanceProfiler();

    expect(getPerformanceSummary('history.push')).toBeNull();
    expect(getPerformanceSummary('texture.commit')).toBeNull();
  });
});
