import { describe, expect, it } from 'vitest';
import type { EntityInstance, EntityTemplate, PrefabExportOptions } from '../../types';
import { serializePrefab } from '../serializePrefab';
import { parsePrefab } from '../parsePrefab';
import { instantiatePrefab } from '../../utils/prefabUtils';
import { resolveEntityTemplate } from '../../utils/entityTemplate';
import { serializeScene } from '../serializeScene';

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

  it('should parse inline collision/physics data in unpacked prefab and retain it across instantiation', () => {
    const rawXml = `<?xml version="1.0" encoding="utf-8"?>
<Ethanon isPrefab="1">
  <Entity editorEntityUID="uid-collider-1" editorEntityName="ColliderEntity" spriteFrame="0">
    <EntityName>box_collider.ent</EntityName>
    <Position x="0" y="0" z="0" angle="0" />
    <Entity shape="1" density="2" friction="0.4" restitution="0.1" gravityScale="1" static="1" sensor="0" bullet="0" fixedRotation="1">
      <Collision>
        <Position x="5" y="10" z="0" />
        <Size x="64" y="32" z="16" />
      </Collision>
    </Entity>
  </Entity>
</Ethanon>`;

    const parsed = parsePrefab(rawXml);
    expect(parsed).toHaveLength(1);
    const parsedEntity = parsed[0];

    // inlineTemplate and its physics must be populated
    expect(parsedEntity.inlineTemplate).toBeDefined();
    expect(parsedEntity.inlineTemplate?.physics).toBeDefined();
    expect(parsedEntity.inlineTemplate?.physics?.shape).toBe(1);
    expect(parsedEntity.inlineTemplate?.physics?.collision.position).toEqual({ x: 5, y: 10, z: 0 });
    expect(parsedEntity.inlineTemplate?.physics?.collision.size).toEqual({ x: 64, y: 32, z: 16 });

    // resolveEntityTemplate should resolve effective physics without external templates
    const resolved = resolveEntityTemplate(parsedEntity, {});
    expect(resolved?.physics).toBeDefined();
    expect(resolved?.physics?.shape).toBe(1);

    // Instantiating into scene must preserve inlineTemplate and physics
    const instantiated = instantiatePrefab(parsed, { x: 150, y: 250 }, []);
    expect(instantiated).toHaveLength(1);
    const placedEntity = instantiated[0];
    expect(placedEntity.inlineTemplate?.physics).toBeDefined();
    expect(placedEntity.inlineTemplate?.physics?.shape).toBe(1);
    expect(placedEntity.inlineTemplate?.physics?.collision.position).toEqual({ x: 5, y: 10, z: 0 });

    const resolvedPlaced = resolveEntityTemplate(placedEntity, {});
    expect(resolvedPlaced?.physics).toBeDefined();
    expect(resolvedPlaced?.physics?.shape).toBe(1);

    // Serializing to scene should preserve the raw Collision and physics tags
    const sceneXml = serializeScene({
      properties: {
        ambient: { r: 0.5, g: 0.5, b: 0.5 },
        lightIntensity: 2,
        parallaxIntensity: 3,
        zAxisDirection: { x: 0, y: -1 },
      },
      entities: instantiated,
    });
    expect(sceneXml).toContain('shape="1"');
    expect(sceneXml).toContain('<Collision>');
  });
});
