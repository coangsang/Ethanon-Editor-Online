import { bench, describe } from 'vitest';
import type { EntityTemplate } from '../../types';
import { pushHistorySnapshot, type HistoryEntry } from '../../store/sceneHistory';
import { useSceneStore } from '../../store/sceneStore';
import { createSyntheticScene } from '../../testUtils/syntheticScene';

const SIZES = [1000, 5000, 10000] as const;
const BENCH_OPTIONS = {
  time: 500,
  iterations: 10,
  warmupTime: 100,
  warmupIterations: 5,
};

const benchmarkTemplate: EntityTemplate = {
  name: 'benchmark',
  spriteFile: '',
  spriteCut: { x: 1, y: 1 },
  type: 'horizontal',
  pivotAdjust: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  parallaxIntensity: 0,
};

for (const size of SIZES) {
  describe(`${size.toLocaleString()} entities`, () => {
    const baseScene = createSyntheticScene(size);
    const placedScene = {
      ...baseScene,
      entities: [
        ...baseScene.entities,
        {
          ...baseScene.entities[0],
          id: size,
          editorEntityUID: `synthetic-placed-${size}`,
        },
      ],
    };
    const baseHistory: HistoryEntry[] = [{ entities: baseScene.entities }];
    const undoRedoHistory: HistoryEntry[] = [
      { entities: baseScene.entities },
      { entities: placedScene.entities },
    ];

    bench('history snapshot', () => {
      pushHistorySnapshot(baseHistory, 0, placedScene.entities);
    }, BENCH_OPTIONS);

    bench('place entity', () => {
      useSceneStore.setState({
        scene: baseScene,
        history: baseHistory,
        historyIndex: 0,
        selectedUIDs: [],
        templates: { benchmark: benchmarkTemplate },
        snapToGrid: false,
      });
      useSceneStore.getState().addEntity('benchmark', 100, 100);
    }, BENCH_OPTIONS);

    bench('undo', () => {
      useSceneStore.setState({
        scene: placedScene,
        history: undoRedoHistory,
        historyIndex: 1,
        selectedUIDs: [],
      });
      useSceneStore.getState().undo();
    }, BENCH_OPTIONS);

    bench('redo', () => {
      useSceneStore.setState({
        scene: baseScene,
        history: undoRedoHistory,
        historyIndex: 0,
        selectedUIDs: [],
      });
      useSceneStore.getState().redo();
    }, BENCH_OPTIONS);
  });
}
