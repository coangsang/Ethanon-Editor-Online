import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPerformanceSummary,
  recordPerformanceMetric,
  resetPerformanceProfiler,
  setPerformanceProfilerEnabled,
} from '../../utils/performanceProfiler';
import { useSceneStore } from '../sceneStore';

const EMPTY_SCENE = '<Ethanon><SceneProperties /><EntitiesInScene /></Ethanon>';

describe('scene store performance profiler sessions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setPerformanceProfilerEnabled(false);
    resetPerformanceProfiler();
    useSceneStore.getState().loadScene(EMPTY_SCENE);
    setPerformanceProfilerEnabled(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setPerformanceProfilerEnabled(false);
    resetPerformanceProfiler();
  });

  it('clears profiler samples after replacing the scene successfully', () => {
    recordPerformanceMetric('history.push', 3, 10);
    expect(getPerformanceSummary('history.push')).not.toBeNull();

    useSceneStore.getState().loadScene(EMPTY_SCENE);

    expect(getPerformanceSummary('history.push')).toBeNull();
  });

  it('keeps profiler samples when opening another project is cancelled', async () => {
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
    recordPerformanceMetric('history.push', 3, 10);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });

    await useSceneStore.getState().openProject();

    expect(confirm).toHaveBeenCalledOnce();
    expect(getPerformanceSummary('history.push')?.sampleCount).toBe(1);
  });
});
