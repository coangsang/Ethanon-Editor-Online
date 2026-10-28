export type PerformanceMetricName =
  | 'history.push'
  | 'texture.scan'
  | 'texture.commit'
  | 'renderer.placement';

export interface PerformanceSample {
  durationMs: number;
  entityCount: number;
  timestamp: number;
}

export interface PerformanceSummary {
  latestMs: number;
  medianMs: number;
  p95Ms: number;
  sampleCount: number;
  entityCount: number;
}

const SAMPLE_LIMIT = 120;
const METRIC_NAMES: PerformanceMetricName[] = [
  'history.push',
  'texture.scan',
  'texture.commit',
  'renderer.placement',
];

const samples = new Map<PerformanceMetricName, PerformanceSample[]>(
  METRIC_NAMES.map(metric => [metric, []]),
);

let enabled = false;

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index];
}

function median(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return sortedValues[middle];
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

export function setPerformanceProfilerEnabled(nextEnabled: boolean): void {
  const next = import.meta.env.DEV && nextEnabled;
  if (next && !enabled) resetPerformanceProfiler();
  enabled = next;
}

export function isPerformanceProfilerEnabled(): boolean {
  return import.meta.env.DEV && enabled;
}

export function recordPerformanceMetric(
  metric: PerformanceMetricName,
  durationMs: number,
  entityCount: number,
  timestamp = Date.now(),
): void {
  if (!isPerformanceProfilerEnabled()) return;

  const metricSamples = samples.get(metric)!;
  metricSamples.push({ durationMs, entityCount, timestamp });
  if (metricSamples.length > SAMPLE_LIMIT) {
    metricSamples.splice(0, metricSamples.length - SAMPLE_LIMIT);
  }
}

export function measurePerformanceMetric<T>(
  metric: PerformanceMetricName,
  entityCount: number,
  operation: () => T,
): T {
  if (!isPerformanceProfilerEnabled()) return operation();

  const startedAt = performance.now();
  try {
    return operation();
  } finally {
    recordPerformanceMetric(metric, performance.now() - startedAt, entityCount);
  }
}

export function startPerformanceMetric(
  metric: PerformanceMetricName,
  entityCount: number,
): () => void {
  if (!isPerformanceProfilerEnabled()) return () => {};

  const startedAt = performance.now();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    recordPerformanceMetric(metric, performance.now() - startedAt, entityCount);
  };
}

export function getPerformanceSummary(metric: PerformanceMetricName): PerformanceSummary | null {
  const metricSamples = samples.get(metric)!;
  if (metricSamples.length === 0) return null;

  const latest = metricSamples[metricSamples.length - 1];
  const sortedDurations = metricSamples
    .map(sample => sample.durationMs)
    .sort((left, right) => left - right);

  return {
    latestMs: latest.durationMs,
    medianMs: median(sortedDurations),
    p95Ms: percentile(sortedDurations, 0.95),
    sampleCount: metricSamples.length,
    entityCount: latest.entityCount,
  };
}

export function getPerformanceSummaries(): Record<PerformanceMetricName, PerformanceSummary | null> {
  return {
    'history.push': getPerformanceSummary('history.push'),
    'texture.scan': getPerformanceSummary('texture.scan'),
    'texture.commit': getPerformanceSummary('texture.commit'),
    'renderer.placement': getPerformanceSummary('renderer.placement'),
  };
}

export function resetPerformanceProfiler(): void {
  for (const metricSamples of samples.values()) metricSamples.length = 0;
}
