import { describe, it, expect } from 'vitest';
import { mergeCustomData, unpackEntityInstance, entityHasFileNameTag } from '../../utils/entityTemplate';
import { serializeScene } from '../serializeScene';
import type { CustomDataVariable, EntityInstance, EntityTemplate, SceneData } from '../../types';

describe('Unpack Entity Feature', () => {
  describe('mergeCustomData', () => {
    it('should combine customData variables and override matching packed keys with scene values', () => {
      const packedData: CustomDataVariable[] = [
        { type: 'int', name: 'hp', value: '100' },
        { type: 'string', name: 'role', value: 'hero' },
        { type: 'vector2', name: 'offset', value: { x: 0, y: 0 } },
      ];

      const sceneData: CustomDataVariable[] = [
        { type: 'int', name: 'hp', value: '250' }, // duplicate: scene overrides 100 with 250
        { type: 'float', name: 'speed', value: '5.5' }, // scene unique key
      ];

      const merged = mergeCustomData(packedData, sceneData);

      expect(merged).toEqual([
        { type: 'int', name: 'hp', value: '250' },
        { type: 'string', name: 'role', value: 'hero' },
        { type: 'vector2', name: 'offset', value: { x: 0, y: 0 } },
        { type: 'float', name: 'speed', value: '5.5' },
      ]);
    });

    it('should return scene customData when packed customData is empty', () => {
      const sceneData: CustomDataVariable[] = [
        { type: 'string', name: 'tag', value: 'boss' },
      ];
      expect(mergeCustomData([], sceneData)).toEqual(sceneData);
    });

    it('should return packed customData when scene customData is empty', () => {
      const packedData: CustomDataVariable[] = [
        { type: 'int', name: 'maxCount', value: '10' },
      ];
      expect(mergeCustomData(packedData, [])).toEqual(packedData);
    });
  });

  describe('unpackEntityInstance', () => {
    const templates: Record<string, EntityTemplate> = {
      'goblin_archer': {
        name: 'goblin_archer',
        spriteFile: 'goblin.png',
        spriteCut: { x: 4, y: 1 },
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1.5, y: 1.5 },
        parallaxIntensity: 1,
        blendMode: 0,
        customData: [
          { type: 'int', name: 'damage', value: '25' },
          { type: 'string', name: 'faction', value: 'monsters' },
        ],
      },
    };

    it('should convert packed entity into inline entity and merge custom data', () => {
      const packedEntity: EntityInstance = {
        id: 42,
        entityName: 'goblin_archer.ent',
        editorEntityUID: 'uid-42',
        position: { x: 100, y: 200, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [
          { type: 'int', name: 'damage', value: '50' }, // Scene override
          { type: 'float', name: 'range', value: '12.0' }, // Scene unique
        ],
        inlineEntityData: {
          FileName: 'goblin_archer.ent',
        },
      };

      expect(entityHasFileNameTag(packedEntity)).toBe(true);

      const patch = unpackEntityInstance(packedEntity, templates);

      const unpackedEntity: EntityInstance = {
        ...packedEntity,
        ...patch,
      } as EntityInstance;

      expect(entityHasFileNameTag(unpackedEntity)).toBe(false);

      expect(unpackedEntity.entityName).toBe('goblin_archer.ent');

      expect(unpackedEntity.inlineEntityData?.FileName).toBeUndefined();

      expect(unpackedEntity.inlineTemplate?.spriteFile).toBe('goblin.png');
      expect(unpackedEntity.inlineTemplate?.scale).toEqual({ x: 1.5, y: 1.5 });

      expect(unpackedEntity.customData).toEqual([
        { type: 'int', name: 'damage', value: '50' },
        { type: 'string', name: 'faction', value: 'monsters' },
        { type: 'float', name: 'range', value: '12.0' },
      ]);
    });

    it('should copy all raw entity data (Particles, Light, Collision, physics attributes) from template', () => {
      const complexTemplate: Record<string, EntityTemplate> = {
        'torch_fire': {
          name: 'torch_fire',
          spriteFile: 'torch.png',
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 1,
          blendMode: 0,
          rawEntityData: {
            applyLight: '1',
            castShadow: '1',
            shape: '1',
            sensor: '0',
            Sprite: 'torch.png',
            Particles: {
              ParticleSystem: {
                particles: '100',
                bitmap: 'fire.png',
              },
            },
            Light: {
              Color: { r: '1', g: '0.8', b: '0.4' },
              range: '256',
            },
            Collision: {
              Size: { x: '32', y: '64' },
            },
          },
        },
      };

      const packedEntity: EntityInstance = {
        id: 99,
        entityName: 'torch_fire.ent',
        editorEntityUID: 'uid-torch',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: {
          FileName: 'torch_fire.ent',
        },
      };

      const patch = unpackEntityInstance(packedEntity, complexTemplate);
      const unpacked = { ...packedEntity, ...patch } as EntityInstance;

      expect(unpacked.inlineEntityData?.applyLight).toBe('1');
      expect(unpacked.inlineEntityData?.castShadow).toBe('1');
      expect(unpacked.inlineEntityData?.shape).toBe('1');
      expect(unpacked.inlineEntityData?.Particles).toEqual({
        ParticleSystem: {
          particles: '100',
          bitmap: 'fire.png',
        },
      });
      expect(unpacked.inlineEntityData?.Light).toEqual({
        Color: { r: '1', g: '0.8', b: '0.4' },
        range: '256',
      });
      expect(unpacked.inlineEntityData?.Collision).toEqual({
        Size: { x: '32', y: '64' },
      });

      // Verify serialization output includes Light, Particles, Collision and attributes
      const scene: SceneData = {
        properties: {
          ambient: { r: 0.5, g: 0.5, b: 0.5 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 3,
        },
        entities: [unpacked],
      };

      const xml = serializeScene(scene);
      expect(xml).toContain('applyLight="1"');
      expect(xml).toContain('castShadow="1"');
      expect(xml).toContain('<Particles>');
      expect(xml).toContain('<ParticleSystem');
      expect(xml).toContain('<Light');
      expect(xml).toContain('<Collision>');
    });
  });

  describe('XML Serialization after Unpacking', () => {
    it('should serialize unpacked entity without <FileName> tag', () => {
      const scene: SceneData = {
        properties: {
          ambient: { r: 0.5, g: 0.5, b: 0.5 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 3,
        },
        entities: [
          {
            id: 1,
            entityName: 'tree_large',
            editorEntityUID: 'tree-uid-1',
            position: { x: 50, y: 80, z: 0 },
            angle: 0,
            spriteFrame: 0,
            hide: false,
            flipX: false,
            flipY: false,
            customData: [
              { type: 'int', name: 'woodCount', value: '20' },
            ],
            inlineTemplate: {
              name: 'tree_large',
              spriteFile: 'tree.png',
              scale: { x: 2, y: 2 },
              spriteCut: { x: 1, y: 1 },
              type: 'horizontal',
            },
            inlineEntityData: {
              Sprite: 'tree.png',
              Scale: { x: 2, y: 2 },
              type: '0',
            },
          },
        ],
      };

      const xml = serializeScene(scene);

      expect(xml).toContain('<EntityName>tree_large</EntityName>');
      expect(xml).not.toContain('<FileName>');
      expect(xml).toContain('<Name>woodCount</Name>');
      expect(xml).toContain('<Value>20</Value>');
    });
  });
});
