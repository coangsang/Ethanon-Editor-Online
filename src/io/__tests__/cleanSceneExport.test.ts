import { describe, expect, it } from 'vitest';
import type { SceneData } from '../../types';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';

describe('Clean Scene Export (.esc)', () => {
  const mockScene: SceneData = {
    properties: {
      ambient: { r: 0.5, g: 0.5, b: 0.5 },
      lightIntensity: 2,
      zAxisDirection: { x: 0, y: -1 },
      parallaxIntensity: 3,
    },
    entities: [
      {
        id: 10,
        entityName: 'parent_chest.ent',
        editorEntityName: 'Treasure Chest',
        editorEntityUID: 'parent-uid-1234',
        position: { x: 100, y: 50, z: 0 },
        angle: 30,
        spriteFrame: 1,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
      },
      {
        id: 20,
        entityName: 'child_coin.ent',
        editorEntityName: 'Gold Coin',
        editorEntityUID: 'child-uid-5678',
        editorParentEntity: 'parent-uid-1234',
        editorHierarchyOrder: 1,
        localPosition: { x: 5, y: 10, z: 2, angle: 15 },
        position: { x: 109.33, y: 56.16, z: 2 },
        angle: 45,
        spriteFrame: 0,
        hide: false,
        flipX: true,
        flipY: false,
        customData: [],
      },
    ],
  };

  it('default serialization preserves editor fields', () => {
    const xml = serializeScene(mockScene);

    expect(xml).toContain('editorEntityUID="parent-uid-1234"');
    expect(xml).toContain('editorEntityName="Treasure Chest"');
    expect(xml).toContain('editorEntityUID="child-uid-5678"');
    expect(xml).toContain('editorEntityName="Gold Coin"');
    expect(xml).toContain('editorParentEntity="parent-uid-1234"');
    expect(xml).toContain('editorHierarchyOrder="1"');
    expect(xml).toContain('LocalPosition');
  });

  it('clean serialization removes editor fields from XML output', () => {
    const xml = serializeScene(mockScene, { clean: true });

    // Must NOT contain editor attributes or nodes
    expect(xml).not.toContain('editorEntityUID');
    expect(xml).not.toContain('editorEntityName');
    expect(xml).not.toContain('editorParentEntity');
    expect(xml).not.toContain('editorHierarchyOrder');
    expect(xml).not.toContain('LocalPosition');

    // Must preserve standard Ethanon engine fields
    expect(xml).toContain('id="10"');
    expect(xml).toContain('spriteFrame="1"');
    expect(xml).toContain('<EntityName>parent_chest.ent</EntityName>');
    expect(xml).toContain('id="20"');
    expect(xml).toContain('flipX="1"');
    expect(xml).toContain('<EntityName>child_coin.ent</EntityName>');
    expect(xml).toContain('<Position x="100" y="50" z="0" angle="30"');
  });

  it('clean serialization does NOT mutate entities in memory', () => {
    const entitiesCloneBefore = JSON.parse(JSON.stringify(mockScene.entities));
    serializeScene(mockScene, { clean: true });

    // Ensure objects in memory still have their editor metadata intact for editing
    expect(mockScene.entities[0].editorEntityUID).toBe('parent-uid-1234');
    expect(mockScene.entities[0].editorEntityName).toBe('Treasure Chest');
    expect(mockScene.entities[1].editorParentEntity).toBe('parent-uid-1234');
    expect(mockScene.entities).toEqual(entitiesCloneBefore);
  });

  it('clean exported XML can be parsed back into scene editor without errors', () => {
    const cleanXml = serializeScene(mockScene, { clean: true });
    const parsed = parseScene(cleanXml);

    expect(parsed.entities).toHaveLength(2);

    const first = parsed.entities[0];
    expect(first.id).toBe(10);
    expect(first.entityName).toBe('parent_chest.ent');
    // Default editorEntityName falls back to entityName
    expect(first.editorEntityName).toBe('parent_chest.ent');
    // Automatically generates a valid UID
    expect(first.editorEntityUID).toBeTruthy();
    expect(typeof first.editorEntityUID).toBe('string');
    expect(first.position.x).toBe(100);
    expect(first.position.y).toBe(50);
  });
});

