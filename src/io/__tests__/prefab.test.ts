import { describe, expect, it } from 'vitest';
import type { EntityInstance, EntityTemplate, PrefabExportOptions } from '../../types';
import { serializePrefab } from '../serializePrefab';
import { parsePrefab } from '../parsePrefab';
import { instantiatePrefab } from '../../utils/prefabUtils';

describe('Prefab System (.prf)', () => {
  const parentEntity: EntityInstance = {
    id: 1,
    entityName: 'parent_entity.ent',
    editorEntityName: 'ParentEntity',
    editorEntityUID: 'uid-parent-1',
    position: { x: 500, y: 300, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [{ type: 'string', name: 'tag', value: 'hero' }],
    inlineEntityData: {
      FileName: 'parent_entity.ent',
    },
  };

  const childEntity: EntityInstance = {
    id: 2,
    entityName: 'child_entity.ent',
    editorEntityName: 'ChildEntity',
    editorEntityUID: 'uid-child-1',
    editorParentEntity: 'uid-parent-1',
    position: { x: 600, y: 350, z: 0 },
    angle: 45,
    localPosition: { x: 100, y: 50, z: 0, angle: 45 },
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    inlineEntityData: {
      FileName: 'child_entity.ent',
    },
  };

  const childEntityWithFrame: EntityInstance = {
    ...childEntity,
    spriteFrame: 5,
  };

  const allEntities = [parentEntity, childEntityWithFrame];

  it('should serialize prefab with keepReference mode and re-base coordinates including spriteFrame', () => {
    const options: PrefabExportOptions = { mode: 'keepReference' };
    const xml = serializePrefab(parentEntity, allEntities, options);

    expect(xml).toContain('<Ethanon isPrefab="1">');
    expect(xml).toContain('editorEntityUID="uid-parent-1"');
    expect(xml).toContain('editorEntityUID="uid-child-1"');
    expect(xml).toContain('editorParentEntity="uid-parent-1"');
    expect(xml).toContain('spriteFrame="5"');
    expect(xml).toContain('<FileName>parent_entity.ent</FileName>');
    expect(xml).toContain('<FileName>child_entity.ent</FileName>');

    // Parse back
    const parsed = parsePrefab(xml);
    expect(parsed).toHaveLength(2);

    const parsedRoot = parsed.find(e => e.editorEntityUID === 'uid-parent-1')!;
    const parsedChild = parsed.find(e => e.editorEntityUID === 'uid-child-1')!;

    // Root coordinate re-based to (0,0,0)
    expect(parsedRoot.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(parsedRoot.spriteFrame).toBe(0);

    // Child relative position re-based to (100, 50, 0) and spriteFrame preserved
    expect(parsedChild.position).toEqual({ x: 100, y: 50, z: 0 });
    expect(parsedChild.localPosition).toEqual({ x: 100, y: 50, z: 0, angle: 45 });
    expect(parsedChild.spriteFrame).toBe(5);
  });

  it('should serialize prefab with unpack mode and remove FileName tags', () => {
    const templates: Record<string, EntityTemplate> = {
      'parent_entity': {
        name: 'parent_entity',
        spriteFile: 'parent.png',
        spriteCut: { x: 1, y: 1 },
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
      },
      'child_entity': {
        name: 'child_entity',
        spriteFile: 'child.png',
        spriteCut: { x: 1, y: 1 },
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
      },
    };

    const options: PrefabExportOptions = { mode: 'unpack' };
    const xml = serializePrefab(parentEntity, allEntities, options, templates);

    expect(xml).toContain('<Ethanon isPrefab="1">');
    expect(xml).not.toContain('<FileName>');
    expect(xml).toContain('Sprite');

    const parsed = parsePrefab(xml);
    expect(parsed).toHaveLength(2);
  });

  it('should instantiate prefab into scene with new UIDs and preserved hierarchy', () => {
    const options: PrefabExportOptions = { mode: 'keepReference' };
    const xml = serializePrefab(parentEntity, allEntities, options);
    const prefabEntities = parsePrefab(xml);

    const placePosition = { x: 200, y: 400 };
    const instantiated = instantiatePrefab(prefabEntities, placePosition, []);

    expect(instantiated).toHaveLength(2);

    const root = instantiated.find(e => !e.editorParentEntity)!;
    const child = instantiated.find(e => Boolean(e.editorParentEntity))!;

    expect(root).toBeDefined();
    expect(child).toBeDefined();

    // Check UIDs are newly generated
    expect(root.editorEntityUID).not.toBe('uid-parent-1');
    expect(child.editorEntityUID).not.toBe('uid-child-1');

    // Check parent-child linkage
    expect(child.editorParentEntity).toBe(root.editorEntityUID);

    // Check root world position
    expect(root.position.x).toBe(200);
    expect(root.position.y).toBe(400);

    // Check child position is cascaded correctly
    expect(child.localPosition).toEqual({ x: 100, y: 50, z: 0, angle: 45 });
  });

  it('should support multiple instantiations without UID collision', () => {
    const xml = serializePrefab(parentEntity, allEntities, { mode: 'keepReference' });
    const prefabEntities = parsePrefab(xml);

    const scene1 = instantiatePrefab(prefabEntities, { x: 100, y: 100 }, []);
    const scene2 = instantiatePrefab(prefabEntities, { x: 300, y: 300 }, scene1);

    expect(scene2).toHaveLength(4);

    const uids = new Set(scene2.map(e => e.editorEntityUID));
    expect(uids.size).toBe(4); // All UIDs are unique

    const ids = new Set(scene2.map(e => e.id));
    expect(ids.size).toBe(4); // All numeric IDs are unique
  });
});
