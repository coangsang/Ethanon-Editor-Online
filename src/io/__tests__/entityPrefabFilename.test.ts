import { describe, it, expect } from 'vitest';
import { ensureEntExtension, getTemplateKey, resolveEntityTemplate, resolveExternalTemplate } from '../../utils/entityTemplate';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';
import type { EntityInstance, EntityTemplate, SceneData } from '../../types';

describe('Entity Prefab Filename & Extension Normalization', () => {
  describe('ensureEntExtension & getTemplateKey', () => {
    it('should add .ent when missing', () => {
      expect(ensureEntExtension('cage_chain')).toBe('cage_chain.ent');
      expect(ensureEntExtension('props/torch')).toBe('props/torch.ent');
    });

    it('should keep .ent if already present', () => {
      expect(ensureEntExtension('cage_chain.ent')).toBe('cage_chain.ent');
      expect(ensureEntExtension('props/torch.ENT')).toBe('props/torch.ENT');
    });

    it('should handle empty or whitespace string', () => {
      expect(ensureEntExtension('')).toBe('');
      expect(ensureEntExtension('   ')).toBe('');
    });

    it('should extract template base key correctly', () => {
      expect(getTemplateKey('cage_chain.ent')).toBe('cage_chain');
      expect(getTemplateKey('cage_chain')).toBe('cage_chain');
      expect(getTemplateKey('props/torch.ent')).toBe('props/torch');
    });
  });

  describe('resolveExternalTemplate & resolveEntityTemplate', () => {
    const templates: Record<string, EntityTemplate> = {
      cage_chain: {
        name: 'cage_chain',
        spriteFile: 'cage_chain.png',
        spriteCut: { x: 1, y: 1 },
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        blendMode: 0,
      },
    };

    it('should resolve template whether entityName has .ent or not', () => {
      expect(resolveExternalTemplate('cage_chain', templates)).toBeTruthy();
      expect(resolveExternalTemplate('cage_chain.ent', templates)).toBeTruthy();
    });

    it('should resolve template using entityName as sole source and ignore FileName content', () => {
      const entity: EntityInstance = {
        id: 1,
        entityName: 'cage_chain',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: {
          FileName: 'different_or_ignored.ent',
        },
      };

      const resolved = resolveEntityTemplate(entity, templates);
      expect(resolved).toBeTruthy();
      expect(resolved?.spriteFile).toBe('cage_chain.png');
    });

    it('ignores legacy inline blend-mode overrides on FileName entities', () => {
      const entity: EntityInstance = {
        id: 3,
        entityName: 'cage_chain',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineTemplate: { name: 'cage_chain', blendMode: 4 },
        inlineEntityData: { FileName: 'cage_chain.ent', blendMode: 4 },
      };

      expect(resolveEntityTemplate(entity, templates)?.blendMode).toBe(0);
      expect(entity.inlineTemplate?.blendMode).toBe(4);
    });

    it('uses external emissive color and ignores non-serializable FileName overrides', () => {
      const templatesWithEmissive: Record<string, EntityTemplate> = {
        cage_chain: {
          ...templates.cage_chain,
          emissiveColor: { r: 0.1, g: 0.2, b: 0.3, a: 0 },
        },
      };
      const entity: EntityInstance = {
        id: 4,
        entityName: 'cage_chain',
        editorEntityUID: 'cage-chain-ref',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineTemplate: {
          name: 'cage_chain',
          emissiveColor: { r: 1, g: 1, b: 1, a: 0 },
        },
        inlineEntityData: {
          FileName: 'cage_chain.ent',
          EmissiveColor: { r: '1', g: '1', b: '1', a: '0' },
        },
      };

      expect(resolveEntityTemplate(entity, templatesWithEmissive)?.emissiveColor).toEqual({
        r: 0.1, g: 0.2, b: 0.3, a: 0,
      });

      const xml = serializeScene({
        properties: {
          ambient: { r: 0.5, g: 0.5, b: 0.5 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 3,
        },
        entities: [entity],
      });
      const reparsed = parseScene(xml).entities[0];
      expect(xml).not.toContain('<EmissiveColor');
      expect(resolveEntityTemplate(reparsed, templatesWithEmissive)?.emissiveColor).toEqual({
        r: 0.1, g: 0.2, b: 0.3, a: 0,
      });

      const inlineEntity = {
        ...entity,
        inlineEntityData: { Sprite: 'cage_chain.png' },
      };
      expect(resolveEntityTemplate(inlineEntity, templatesWithEmissive)?.emissiveColor).toEqual({
        r: 1, g: 1, b: 1, a: 0,
      });
    });

    it('should NOT resolve external template if entity has NO FileName tag', () => {
      const inlineEntity: EntityInstance = {
        id: 2,
        entityName: 'cage_chain',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineTemplate: {
          name: 'cage_chain',
          spriteFile: 'custom_inline.png',
        },
        inlineEntityData: {
          Sprite: 'custom_inline.png',
        },
      };

      const templatesWithParticles: Record<string, EntityTemplate> = {
        cage_chain: {
          name: 'cage_chain',
          spriteFile: 'template_sprite.png',
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 1,
          blendMode: 0,
          particleSystems: [
            {
              particles: 50,
              allAtOnce: false,
              alphaMode: 0,
              repeat: 0,
              animationMode: 1,
              boundingSphere: 512,
              lifeTime: 1000,
              randomLifeTime: 0,
              angleDir: 0,
              randAngle: 0,
              size: 32,
              randomizeSize: 0,
              growth: 0,
              minSize: 0,
              maxSize: 99999,
              angleStart: 0,
              randAngleStart: 0,
              bitmap: 'fire.png',
              gravity: { x: 0, y: 0 },
              direction: { x: 0, y: 0 },
              randomizeDir: { x: 0, y: 0 },
              spriteCut: { x: 1, y: 1 },
              startPoint: { x: 0, y: 0, z: 0 },
              randStartPoint: { x: 0, y: 0 },
              color0: { r: 1, g: 1, b: 1, a: 1 },
              color1: { r: 1, g: 1, b: 1, a: 1 },
              luminance: { r: 1, g: 1, b: 1 },
            },
          ],
        },
      };

      const resolved = resolveEntityTemplate(inlineEntity, templatesWithParticles);
      expect(resolved).toBeTruthy();
      expect(resolved?.spriteFile).toBe('custom_inline.png');
      expect(resolved?.particleSystems).toBeUndefined();
    });
  });

  describe('serializeScene with Prefab Filenames', () => {
    it('should ensure <FileName> has .ent extension when saving reference entities', () => {
      const scene: SceneData = {
        properties: {
          ambient: { r: 1, g: 1, b: 1 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 0,
        },
        entities: [
          {
            id: 101,
            entityName: 'cage_chain',
            position: { x: 10, y: 20, z: -4 },
            angle: 0,
            spriteFrame: 0,
            hide: false,
            flipX: false,
            flipY: false,
            customData: [],
            inlineEntityData: {
              FileName: 'cage_chain.ent',
            },
          },
          {
            id: 102,
            entityName: 'chain_no_light',
            position: { x: 50, y: 60, z: 0 },
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

      expect(xml).toContain('<EntityName>cage_chain</EntityName>');
      expect(xml).toContain('<FileName>cage_chain.ent</FileName>');
      expect(xml).toContain('<EntityName>chain_no_light</EntityName>');
      expect(xml).not.toContain('<FileName>chain_no_light.ent</FileName>');
    });

    it('should not add <FileName> to pure inline entities without template', () => {
      const scene: SceneData = {
        properties: {
          ambient: { r: 1, g: 1, b: 1 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 0,
        },
        entities: [
          {
            id: 103,
            entityName: 'cage_anchor',
            position: { x: 0, y: -146, z: 0 },
            angle: 0,
            spriteFrame: 0,
            hide: false,
            flipX: false,
            flipY: false,
            customData: [],
            inlineEntityData: {
              shape: '1',
              sensor: '1',
              Collision: {
                Position: { x: '0', y: '0', z: '0' },
                Size: { x: '32', y: '32', z: '2' },
              },
            },
          },
        ],
      };

      const xml = serializeScene(scene);

      expect(xml).toContain('<EntityName>cage_anchor</EntityName>');
      expect(xml).not.toContain('<FileName>');
    });
  });
});
