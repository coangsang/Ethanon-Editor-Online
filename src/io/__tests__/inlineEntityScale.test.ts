import { describe, it, expect } from 'vitest';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';
import { entityHasFileNameTag, resolveEntityTemplate } from '../../utils/entityTemplate';
import type { SceneData } from '../../types';

describe('Inline Entity Scale & Transform Inspector Support', () => {
  const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<Ethanon>
    <SceneProperties lightIntensity="2" parallaxIntensity="0">
        <Ambient r="1" g="1" b="1" />
        <ZAxisDirection x="0" y="-1" />
    </SceneProperties>
    <EntitiesInScene>
        <Entity id="181727" spriteFrame="0">
            <EntityName>character_spawn</EntityName>
            <Position x="56" y="-612" z="0" angle="45" />
            <Entity shape="0" applyLight="0" castShadow="0" type="0" static="1" blendMode="0">
                <EmissiveColor r="0.2" g="0.2" b="0.2" a="0" />
                <SpriteCut x="4" y="2" />
                <Scale x="4" y="4" />
            </Entity>
        </Entity>
        <Entity id="181728" spriteFrame="0">
            <EntityName>tree_prefab</EntityName>
            <Position x="120" y="240" z="-10" angle="0" />
            <Entity>
                <FileName>props/tree.ent</FileName>
            </Entity>
        </Entity>
    </EntitiesInScene>
</Ethanon>`;

  it('should parse inline entity with Scale properly and recognize it as inline entity', () => {
    const scene = parseScene(SAMPLE_XML);
    expect(scene.entities).toHaveLength(2);

    const inlineEntity = scene.entities.find(e => e.id === 181727)!;
    expect(inlineEntity).toBeDefined();
    expect(inlineEntity.entityName).toBe('character_spawn');
    expect(inlineEntity.position).toEqual({ x: 56, y: -612, z: 0 });
    expect(inlineEntity.angle).toBe(45);

    // Should NOT have FileName tag
    expect(entityHasFileNameTag(inlineEntity)).toBe(false);

    // Template scale should be parsed from <Scale x="4" y="4"/>
    expect(inlineEntity.inlineTemplate?.scale).toEqual({ x: 4, y: 4 });
    expect(inlineEntity.inlineTemplate?.spriteCut).toEqual({ x: 4, y: 2 });

    const resolved = resolveEntityTemplate(inlineEntity, {});
    expect(resolved?.scale).toEqual({ x: 4, y: 4 });

    // Prefab entity should have FileName tag
    const prefabEntity = scene.entities.find(e => e.id === 181728)!;
    expect(prefabEntity).toBeDefined();
    expect(entityHasFileNameTag(prefabEntity)).toBe(true);
  });

  it('should serialize inline entity with updated Scale correctly back to XML', () => {
    const scene = parseScene(SAMPLE_XML);
    const inlineEntity = scene.entities.find(e => e.id === 181727)!;

    // Simulate updating scale from Inspector (e.g. scale x=2.5, y=3)
    inlineEntity.inlineTemplate = {
      ...(inlineEntity.inlineTemplate ?? { name: inlineEntity.entityName }),
      scale: { x: 2.5, y: 3 },
    };
    inlineEntity.inlineEntityData = {
      ...(inlineEntity.inlineEntityData ?? {}),
      Scale: { x: 2.5, y: 3 },
    };

    const xml = serializeScene(scene);
    expect(xml).toContain('<EntityName>character_spawn</EntityName>');
    expect(xml).toContain('<Scale x="2.5" y="3"');

    // Round-trip parse to verify integrity
    const reParsed = parseScene(xml);
    const reParsedEntity = reParsed.entities.find(e => e.id === 181727)!;
    expect(reParsedEntity.inlineTemplate?.scale).toEqual({ x: 2.5, y: 3 });
  });

  it('should handle pure inline entity with custom scale from scratch', () => {
    const freshScene: SceneData = {
      properties: {
        ambient: { r: 1, g: 1, b: 1 },
        lightIntensity: 2,
        zAxisDirection: { x: 0, y: -1 },
        parallaxIntensity: 0,
      },
      entities: [
        {
          id: 999,
          entityName: 'custom_spawner',
          position: { x: 100, y: 200, z: 5 },
          angle: 90,
          spriteFrame: 0,
          hide: false,
          flipX: false,
          flipY: false,
          customData: [],
          inlineTemplate: {
            name: 'custom_spawner',
            scale: { x: 3, y: 3 },
          },
          inlineEntityData: {
            Scale: { x: 3, y: 3 },
          },
        },
      ],
    };

    expect(entityHasFileNameTag(freshScene.entities[0])).toBe(false);

    const xml = serializeScene(freshScene);
    expect(xml).toContain('<EntityName>custom_spawner</EntityName>');
    expect(xml).toContain('<Scale x="3" y="3"');
    expect(xml).not.toContain('<FileName>');
  });
});
