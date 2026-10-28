import { describe, expect, it } from 'vitest';
import type { EntityInstance, EntityTemplate, SceneData } from '../../types';
import { unpackEntityInstance } from '../../utils/entityTemplate';
import { parseEntityTemplate, parseScene } from '../parseScene';
import { serializePrefab } from '../serializePrefab';
import { serializeScene } from '../serializeScene';

const SCENE_PROPERTIES = {
  ambient: { r: 0.25, g: 0.5, b: 0.75 },
  lightIntensity: 2,
  zAxisDirection: { x: 0, y: -1 },
  parallaxIntensity: 3,
};

function inlineEntity(inlineEntityData: Record<string, unknown>): EntityInstance {
  return {
    id: 10,
    entityName: 'inline_box',
    editorEntityUID: 'uid-box',
    position: { x: 100, y: 100, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    inlineTemplate: {
      name: 'inline_box',
      spriteFile: 'box.png',
      spriteCut: { x: 1, y: 1 },
      type: 'horizontal',
      pivotAdjust: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      parallaxIntensity: 1,
    },
    inlineEntityData,
  };
}

describe('EmissiveColor compatibility', () => {
  it('keeps a missing inline EmissiveColor absent when parsing and serializing', () => {
    const xml = `
      <Ethanon>
        <SceneProperties><Ambient r="0.25" g="0.5" b="0.75" /></SceneProperties>
        <EntitiesInScene>
          <Entity id="1" spriteFrame="0">
            <EntityName>inline_box</EntityName>
            <Position x="0" y="0" z="0" angle="0" />
            <Entity type="0"><Sprite>box.png</Sprite></Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>`;

    const scene = parseScene(xml);
    expect(scene.entities[0].inlineEntityData?.EmissiveColor).toBeUndefined();
    expect(scene.entities[0].inlineTemplate?.emissiveColor).toBeUndefined();
    expect(serializeScene(scene)).not.toContain('<EmissiveColor');
  });

  it('parses explicit emissive colors from inline and external entities', () => {
    const scene = parseScene(`
      <Ethanon>
        <SceneProperties />
        <EntitiesInScene>
          <Entity id="1" spriteFrame="0">
            <EntityName>inline_box</EntityName>
            <Position x="0" y="0" z="0" angle="0" />
            <Entity type="0">
              <Sprite>box.png</Sprite>
              <EmissiveColor r="0.2" g="0.4" b="0.6" />
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>`);
    const template = parseEntityTemplate('lamp', `
      <Ethanon><Entity type="2">
        <Sprite>lamp.png</Sprite>
        <EmissiveColor r="0.3" g="0.5" b="0.7" a="0.25" />
      </Entity></Ethanon>`);

    expect(scene.entities[0].inlineTemplate?.emissiveColor).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 0 });
    expect(template.emissiveColor).toEqual({ r: 0.3, g: 0.5, b: 0.7, a: 0.25 });
  });

  it('does not invent emissive color while unpacking an external template', () => {
    const templates: Record<string, EntityTemplate> = {
      rock: {
        name: 'rock', spriteFile: 'rock.png', spriteCut: { x: 1, y: 1 }, type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, parallaxIntensity: 1,
      },
    };
    const entity: EntityInstance = {
      ...inlineEntity({ FileName: 'rock.ent' }), entityName: 'rock.ent', inlineTemplate: undefined,
    };

    const patch = unpackEntityInstance(entity, templates);
    expect(patch.inlineTemplate?.emissiveColor).toBeUndefined();
    expect(patch.inlineEntityData?.EmissiveColor).toBeUndefined();
  });

  it('preserves explicit emissive color through unpacking', () => {
    const templates: Record<string, EntityTemplate> = {
      crystal: {
        name: 'crystal', spriteFile: 'crystal.png', spriteCut: { x: 1, y: 1 }, type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, parallaxIntensity: 1,
        emissiveColor: { r: 0.8, g: 0.9, b: 1, a: 0 },
        rawEntityData: { EmissiveColor: { r: '0.8', g: '0.9', b: '1', a: '0' } },
      },
    };
    const entity: EntityInstance = {
      ...inlineEntity({ FileName: 'crystal.ent' }), entityName: 'crystal.ent', inlineTemplate: undefined,
    };

    const patch = unpackEntityInstance(entity, templates);
    expect(patch.inlineTemplate?.emissiveColor).toEqual({ r: 0.8, g: 0.9, b: 1, a: 0 });
    expect(patch.inlineEntityData?.EmissiveColor).toEqual({ r: 0.8, g: 0.9, b: 1, a: 0 });
  });

  it('does not add EmissiveColor to scene or prefab XML when absent', () => {
    const entity = inlineEntity({ Sprite: 'box.png', shape: 1 });
    const scene: SceneData = { properties: SCENE_PROPERTIES, entities: [entity] };

    expect(serializeScene(scene)).not.toContain('<EmissiveColor');
    expect(serializePrefab(entity, [entity], { mode: 'keepReference' })).not.toContain('<EmissiveColor');
  });

  it('round-trips explicit EmissiveColor without changing scene properties', () => {
    const entity = inlineEntity({
      Sprite: 'box.png', EmissiveColor: { r: '0.2', g: '0.4', b: '0.6', a: '0' },
    });
    const xml = serializeScene({ properties: SCENE_PROPERTIES, entities: [entity] });
    const parsed = parseScene(xml);

    expect(xml).toContain('<Ambient r="0.25" g="0.5" b="0.75"/>');
    expect(xml).toContain('<EmissiveColor r="0.2" g="0.4" b="0.6" a="0"/>');
    expect(parsed.entities[0].inlineTemplate?.emissiveColor).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 0 });
  });
});
