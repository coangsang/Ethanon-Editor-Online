import { describe, expect, it } from 'vitest';
import type { EntityInstance, SceneData } from '../../types';
import { parseScene } from '../parseScene';
import { serializePrefab } from '../serializePrefab';
import { serializeScene } from '../serializeScene';

describe('custom data quotes serialization', () => {
  it('serializes single quote in custom data string value as literal apostrophe instead of &apos;', () => {
    const scene: SceneData = {
      properties: {
        ambient: { r: 1, g: 1, b: 1 },
        lightIntensity: 1,
        zAxisDirection: { x: 0, y: -1 },
        parallaxIntensity: 0,
      },
      entities: [
        {
          id: 1,
          entityName: 'TestEntity',
          editorEntityUID: 'uid-1',
          position: { x: 0, y: 0, z: 0 },
          angle: 0,
          spriteFrame: 0,
          hide: false,
          flipX: false,
          flipY: false,
          customData: [
            {
              type: 'string',
              name: 'phrase',
              value: "don't give up, it's dangerous",
            },
            {
              type: 'string',
              name: 'xmlSpecialChars',
              value: 'Rock & Roll <5> "quotes"',
            },
          ],
        },
      ],
    };

    const xml = serializeScene(scene);

    // Single quotes should remain literal apostrophes in text nodes
    expect(xml).toContain("<Value>don't give up, it's dangerous</Value>");
    expect(xml).not.toContain('&apos;');

    // XML special characters like &, <, > should still be safely escaped
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');

    // Round-trip parse verifies integrity
    const parsed = parseScene(xml);
    const parsedEntity = parsed.entities[0];
    const phraseVar = parsedEntity.customData.find(v => v.name === 'phrase');
    expect(phraseVar?.value).toBe("don't give up, it's dangerous");

    const specialVar = parsedEntity.customData.find(v => v.name === 'xmlSpecialChars');
    expect(specialVar?.value).toBe('Rock & Roll <5> "quotes"');
  });

  it('serializes single quote in prefab custom data without &apos;', () => {
    const rootEntity: EntityInstance = {
      id: 1,
      entityName: 'PrefabRoot',
      editorEntityUID: 'prefab-root-uid',
      position: { x: 10, y: 20, z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [
        {
          type: 'string',
          name: 'dialogue',
          value: "Hero's quest: You can't pass!",
        },
      ],
    };

    const xml = serializePrefab(rootEntity, [rootEntity], { mode: 'keepReference' });

    expect(xml).toContain("<Value>Hero's quest: You can't pass!</Value>");
    expect(xml).not.toContain('&apos;');
  });
});
