import { describe, expect, it } from 'vitest';
import type { EntityInstance } from '../../types';
import {
  getAllDescendantIds,
  normalizeHierarchy,
} from '../sceneHierarchy';

function entity(
  id: number,
  uid: string,
  parentUid?: string,
  order = 0,
): EntityInstance {
  return {
    id,
    entityName: `entity-${id}`,
    editorEntityUID: uid,
    position: { x: id * 10, y: 0, z: id },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    editorParentEntity: parentUid,
    editorHierarchyOrder: order,
  };
}

describe('scene hierarchy helpers', () => {
  it('removes parent references to missing UIDs', () => {
    const [child] = normalizeHierarchy([
      entity(1, 'child', 'missing-parent'),
    ]);

    expect(child.editorParentEntity).toBeUndefined();
    expect(child.localPosition).toBeUndefined();
  });

  it('sanitizes cycles without dropping the involved entities', () => {
    const normalized = normalizeHierarchy([
      entity(1, 'a', 'b'),
      entity(2, 'b', 'a'),
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized.filter(e => e.editorParentEntity).length).toBe(1);
    expect(getAllDescendantIds(normalized, new Set([1])).size).toBeLessThanOrEqual(2);
  });

  it('collects descendants in O(n)-style indexed traversal regardless of array order', () => {
    const entities = normalizeHierarchy([
      entity(4, 'grandchild', 'child'),
      entity(2, 'sibling', 'root'),
      entity(3, 'child', 'root'),
      entity(1, 'root'),
    ]);

    expect([...getAllDescendantIds(entities, new Set([1]))].sort()).toEqual([1, 2, 3, 4]);
  });

  it('normalizes hierarchy order within root and sibling groups', () => {
    const normalized = normalizeHierarchy([
      entity(1, 'root-a', undefined, 10),
      entity(2, 'root-b', undefined, 10),
      entity(3, 'child-a', 'root-a', 5),
      entity(4, 'child-b', 'root-a', 5),
    ]);

    const byId = new Map(normalized.map(e => [e.id, e]));
    expect(byId.get(1)?.editorHierarchyOrder).toBe(0);
    expect(byId.get(2)?.editorHierarchyOrder).toBe(1);
    expect(byId.get(3)?.editorHierarchyOrder).toBe(0);
    expect(byId.get(4)?.editorHierarchyOrder).toBe(1);
  });
});
