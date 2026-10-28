import { describe, expect, it } from 'vitest';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';

describe('editorEntityName parsing and serialization', () => {
  it('should parse editorEntityName attribute from Entity element when present', () => {
    const xml = `
      <Ethanon>
        <SceneProperties lightIntensity="2" parallaxIntensity="3">
          <Ambient r="0.5" g="0.5" b="0.5" />
          <ZAxisDirection x="0" y="-1" />
        </SceneProperties>
        <EntitiesInScene>
          <Entity id="91082" spriteFrame="0" editorEntityName="ChestOfGold">
            <EntityName>chest</EntityName>
            <Position x="100" y="200" z="0" angle="0" />
            <Entity>
              <FileName>chest.ent</FileName>
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>
    `;

    const scene = parseScene(xml);
    expect(scene.entities).toHaveLength(1);
    expect(scene.entities[0].id).toBe(91082);
    expect(scene.entities[0].entityName).toBe('chest');
    expect(scene.entities[0].editorEntityName).toBe('ChestOfGold');
  });

  it('should auto-populate editorEntityName from EntityName if editorEntityName is missing', () => {
    const xml = `
      <Ethanon>
        <SceneProperties lightIntensity="2" parallaxIntensity="3">
          <Ambient r="0.5" g="0.5" b="0.5" />
          <ZAxisDirection x="0" y="-1" />
        </SceneProperties>
        <EntitiesInScene>
          <Entity id="123" spriteFrame="0">
            <EntityName>magic_tree</EntityName>
            <Position x="50" y="50" z="0" angle="0" />
            <Entity>
              <FileName>magic_tree.ent</FileName>
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>
    `;

    const scene = parseScene(xml);
    expect(scene.entities).toHaveLength(1);
    expect(scene.entities[0].entityName).toBe('magic_tree');
    expect(scene.entities[0].editorEntityName).toBe('magic_tree');
  });

  it('should serialize editorEntityName attribute onto Entity XML tag', () => {
    const scene = {
      properties: {
        ambient: { r: 0.5, g: 0.5, b: 0.5 },
        lightIntensity: 2,
        zAxisDirection: { x: 0, y: -1 },
        parallaxIntensity: 3,
      },
      entities: [
        {
          id: 91082,
          entityName: 'chest',
          editorEntityName: 'ChestOfGold',
          position: { x: 100, y: 200, z: 0 },
          angle: 0,
          spriteFrame: 0,
          hide: false,
          flipX: false,
          flipY: false,
          customData: [],
        },
      ],
    };

    const xml = serializeScene(scene);
    expect(xml).toContain('editorEntityName="ChestOfGold"');
    expect(xml).toContain('<EntityName>chest</EntityName>');
  });
});
