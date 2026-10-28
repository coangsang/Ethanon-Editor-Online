import { useEffect, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import {
  getPerformanceSummaries,
  type PerformanceMetricName,
  type PerformanceSummary,
} from '../utils/performanceProfiler';
import type { ViewportRefs } from './viewportTypes';

interface ViewportStatsOverlayProps {
  refs: ViewportRefs;
}

export function ViewportStatsOverlay({ refs }: ViewportStatsOverlayProps) {
  const showFps = useSceneStore((s) => s.showFps);
  const showParticleFps = useSceneStore((s) => s.showParticleFps);
  const showPlacementProfiler = useSceneStore((s) => s.showPlacementProfiler);
  const entityCount = useSceneStore((s) => s.scene.entities.length);
  const [performanceSummaries, setPerformanceSummaries] = useState(getPerformanceSummaries);

  const [fpsData, setFpsData] = useState<{
    fps: number;
    frameTimeMs: number;
    emitterCount: number;
    activeParticleCount: number;
  }>({
    fps: 60,
    frameTimeMs: 16.6,
    emitterCount: 0,
    activeParticleCount: 0,
  });

  useEffect(() => {
    if (!showFps && !showParticleFps) return;

    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let accumulatedTime = 0;

    const tick = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      frameCount++;
      accumulatedTime += delta;

      // Update state every 250ms for smooth readable HUD
      if (accumulatedTime >= 250) {
        const measuredFps = Math.round((frameCount * 1000) / accumulatedTime);
        const frameTime = accumulatedTime / frameCount;

        let totalParticles = 0;
        let totalEmitters = 0;

        if (refs.particleRuntimesRef.current) {
          for (const rKey of refs.activeParticleRuntimeKeysRef.current) {
            const runtime = refs.particleRuntimesRef.current.get(rKey);
            if (!runtime) continue;
            totalEmitters++;
            if (typeof runtime.getActiveParticlesCount === 'function') {
              totalParticles += runtime.getActiveParticlesCount();
            }
          }
        }

        setFpsData({
          fps: measuredFps,
          frameTimeMs: Math.round(frameTime * 10) / 10,
          emitterCount: totalEmitters,
          activeParticleCount: totalParticles,
        });

        frameCount = 0;
        accumulatedTime = 0;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [showFps, showParticleFps, refs]);

  useEffect(() => {
    if (!showPlacementProfiler) return;
    const update = () => setPerformanceSummaries(getPerformanceSummaries());
    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [showPlacementProfiler]);

  if (!showFps && !showParticleFps && !showPlacementProfiler) return null;

  const fpsColorClass =
    fpsData.fps >= 50
      ? 'text-emerald-400 font-bold'
      : fpsData.fps >= 30
      ? 'text-amber-400 font-bold'
      : 'text-rose-400 font-bold';

  return (
    <div className="absolute top-3 right-3 z-20 pointer-events-none select-none flex flex-col gap-1.5 font-mono text-[11px] text-gray-200">
      {showFps && (
        <div className="flex items-center gap-3 bg-gray-950/85 backdrop-blur-md border border-gray-700/80 px-2.5 py-1.5 rounded-md shadow-xl">
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[10px]">FPS:</span>
            <span className={fpsColorClass}>{fpsData.fps}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[10px]">LATENCY:</span>
            <span className="text-indigo-300 font-semibold">{fpsData.frameTimeMs} ms</span>
          </div>
        </div>
      )}

      {showParticleFps && (
        <div className="flex items-center gap-3 bg-gray-950/85 backdrop-blur-md border border-purple-800/60 px-2.5 py-1.5 rounded-md shadow-xl">
          <div className="flex items-center gap-1">
            <span className="text-purple-300 text-[10px]">EMITTERS:</span>
            <span className="text-purple-200 font-semibold">{fpsData.emitterCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-purple-300 text-[10px]">PARTICLES:</span>
            <span className="text-purple-100 font-bold">{fpsData.activeParticleCount}</span>
          </div>
        </div>
      )}

      {showPlacementProfiler && import.meta.env.DEV && (
        <div className="bg-gray-950/90 border border-cyan-800/70 px-2.5 py-2 rounded-md shadow-xl min-w-72">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-cyan-300 font-semibold">PLACEMENT PROFILER</span>
            <span className="text-gray-400">{entityCount} entities</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 tabular-nums">
            <span className="text-gray-500">Metric</span>
            <span className="text-gray-500 text-right">Latest</span>
            <span className="text-gray-500 text-right">Median</span>
            <span className="text-gray-500 text-right">P95</span>
            {(Object.entries(performanceSummaries) as Array<[PerformanceMetricName, PerformanceSummary | null]>).map(([metric, summary]) => (
              <PerformanceMetricRow key={metric} metric={metric} summary={summary} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceMetricRow({
  metric,
  summary,
}: {
  metric: PerformanceMetricName;
  summary: PerformanceSummary | null;
}) {
  const format = (value: number) => `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
  return (
    <>
      <span className="text-gray-300" title={summary ? `${summary.sampleCount} samples` : 'No samples'}>{metric}</span>
      <span className="text-right text-cyan-200">{summary ? format(summary.latestMs) : '—'}</span>
      <span className="text-right text-gray-200">{summary ? format(summary.medianMs) : '—'}</span>
      <span className="text-right text-amber-200">{summary ? format(summary.p95Ms) : '—'}</span>
    </>
  );
}
