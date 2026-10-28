import { describe, expect, it } from 'vitest';
import { createSyntheticScene } from '../syntheticScene';

describe('createSyntheticScene', () => {
  it.each([1000, 5000, 10000])('creates %i minimal entities with unique IDs and UIDs', count => {
    const scene = createSyntheticScene(count);
    expect(scene.entities).toHaveLength(count);
    expect(new Set(scene.entities.map(entity => entity.id)).size).toBe(count);
    expect(new Set(scene.entities.map(entity => entity.editorEntityUID)).size).toBe(count);
    expect(scene.entities[0].entityName).toBe('benchmark.ent');
    expect(scene.entities[count - 1].editorEntityUID).toBe(`synthetic-entity-${count - 1}`);
  });
});
