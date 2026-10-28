import type { EntityInstance } from '../types';
import { measurePerformanceMetric } from '../utils/performanceProfiler';

export interface HistoryEntry {
  entities: EntityInstance[];
}

export function pushHistorySnapshot(
  history: HistoryEntry[],
  index: number,
  entities: EntityInstance[],
): { history: HistoryEntry[]; historyIndex: number } {
  return measurePerformanceMetric('history.push', entities.length, () => {
    const newHistory = history.slice(0, index + 1);
    newHistory.push({ entities: JSON.parse(JSON.stringify(entities)) });
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  });
}
