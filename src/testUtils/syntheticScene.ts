import type { EntityInstance, SceneData } from '../types';

export function createSyntheticEntities(count: number): EntityInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    editorEntityUID: `synthetic-entity-${index}`,
    entityName: 'benchmark.ent',
    editorEntityName: `Synthetic Entity ${index}`,
    position: { x: index % 1000, y: Math.floor(index / 1000), z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    inlineEntityData: { FileName: 'benchmark.ent' },
  }));
}

export function createSyntheticScene(count: number): SceneData {
  return {
    properties: {
      ambient: { r: 0.5, g: 0.5, b: 0.5 },
      lightIntensity: 2,
      zAxisDirection: { x: 0, y: -1 },
      parallaxIntensity: 3,
    },
    entities: createSyntheticEntities(count),
  };
}
