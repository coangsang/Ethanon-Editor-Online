import { describe, it, expect } from 'vitest';
import { parseParticleSystem, parseEntityTemplate, parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';

describe('Ethanon XML & ParticleSystem Parser Tests', () => {
  describe('parseParticleSystem alias & defaults', () => {
    it('XML-01: Should parse standard Ethanon XML tag names and alias variants', () => {
      const ethanonRaw = {
        Particles: '25',
        AllAtOnce: '1',
        AlphaMode: '1',
        Repeats: '2',
        AnimationMode: '2',
        Bounding: '256',
        Time: '1500',
        RandomTime: '300',
        AngleDir: '1.5',
        RandAngleDir: '0.5',
        Size: '48',
        RandSize: '8',
        Growth: '-0.2',
        MinSize: '4',
        MaxSize: '64',
        SAngle: '45',
        RandAngleSt: '15',
        Bitmap: 'sparkles.png',
        Gravity: { x: '0', y: '9.8' },
        Dir: { x: '5', y: '-10' },
        RDir: { x: '2', y: '2' },
        SpriteCut: { x: '4', y: '1' },
        Start: { x: '0', y: '10', z: '5' },
        RStart: { x: '3', y: '3' },
        Color0: { r: '1', g: '0.8', b: '0.2', a: '1' },
        Color1: { r: '0', g: '0', b: '0', a: '0' },
        Emissive: { r: '0.9', g: '0.9', b: '0.9' },
      };

      const config = parseParticleSystem(ethanonRaw);

      expect(config.particles).toBe(25);
      expect(config.allAtOnce).toBe(true);
      expect(config.alphaMode).toBe(1);
      expect(config.repeat).toBe(2);
      expect(config.animationMode).toBe(2);
      expect(config.boundingSphere).toBe(256);
      expect(config.lifeTime).toBe(1500);
      expect(config.randomLifeTime).toBe(300);
      expect(config.angleDir).toBe(1.5);
      expect(config.randAngle).toBe(0.5);
      expect(config.size).toBe(48);
      expect(config.randomizeSize).toBe(8);
      expect(config.growth).toBe(-0.2);
      expect(config.minSize).toBe(4);
      expect(config.maxSize).toBe(64);
      expect(config.angleStart).toBe(45);
      expect(config.randAngleStart).toBe(15);
      expect(config.bitmap).toBe('sparkles.png');
      expect(config.gravity).toEqual({ x: 0, y: 9.8 });
      expect(config.direction).toEqual({ x: 5, y: -10 });
      expect(config.randomizeDir).toEqual({ x: 2, y: 2 });
      expect(config.spriteCut).toEqual({ x: 4, y: 1 });
      expect(config.startPoint).toEqual({ x: 0, y: 10, z: 5 });
      expect(config.randStartPoint).toEqual({ x: 3, y: 3 });
      expect(config.color0).toEqual({ r: 1, g: 0.8, b: 0.2, a: 1 });
      expect(config.color1).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(config.luminance).toEqual({ r: 0.9, g: 0.9, b: 0.9 });
    });

    it('XML-03: Should provide robust fallback defaults on empty or undefined input', () => {
      const config = parseParticleSystem({});

      expect(config.particles).toBe(10);
      expect(config.allAtOnce).toBe(false);
      expect(config.alphaMode).toBe(0);
      expect(config.repeat).toBe(0);
      expect(config.animationMode).toBe(1);
      expect(config.lifeTime).toBe(1000);
      expect(config.size).toBe(32);
      expect(config.bitmap).toBe('');
      expect(config.spriteCut).toEqual({ x: 1, y: 1 });
      expect(config.gravity).toEqual({ x: 0, y: 0 });
      expect(config.color0).toEqual({ r: 1, g: 1, b: 1, a: 1 });
      expect(config.color1).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    });
  });

  describe('parseEntityTemplate with Particle Systems', () => {
    it('XML-02: Should parse multiple ParticleSystem nodes within an entity template XML', () => {
      const xml = `<?xml version="1.0" ?>
      <Ethanon>
        <Entity shape="0" applyLight="0" castShadow="0" type="0" static="1" blendMode="0">
          <Sprite>campfire.png</Sprite>
          <Particles>
            <ParticleSystem>
              <Bitmap>fire.png</Bitmap>
              <Particles>30</Particles>
              <Time>800</Time>
              <AlphaMode>1</AlphaMode>
            </ParticleSystem>
            <ParticleSystem>
              <Bitmap>smoke.png</Bitmap>
              <Particles>15</Particles>
              <Time>2000</Time>
              <AlphaMode>0</AlphaMode>
            </ParticleSystem>
          </Particles>
        </Entity>
      </Ethanon>`;

      const template = parseEntityTemplate('campfire.ent', xml);

      expect(template.particleSystems).toBeDefined();
      expect(template.particleSystems?.length).toBe(2);
      expect(template.particleSystems?.[0].bitmap).toBe('fire.png');
      expect(template.particleSystems?.[0].particles).toBe(30);
      expect(template.particleSystems?.[0].alphaMode).toBe(1);
      expect(template.particleSystems?.[1].bitmap).toBe('smoke.png');
      expect(template.particleSystems?.[1].particles).toBe(15);
      expect(template.particleSystems?.[1].alphaMode).toBe(0);
    });
  });

  describe('parseScene with Inline Particles', () => {
    it('XML-04: Should parse inline ParticleSystem tags from scene entity', () => {
      const xml = `<?xml version="1.0" ?>
      <Ethanon>
        <SceneProperties lightIntensity="2" parallaxIntensity="3">
          <Ambient r="0.5" g="0.5" b="0.5" />
          <ZAxisDirection x="0" y="-1" />
        </SceneProperties>
        <EntitiesInScene>
          <Entity id="91081" spriteFrame="0">
            <EntityName>fire_spitter</EntityName>
            <Position x="-596" y="492" z="-0.1" angle="0" />
            <Entity shape="1" sensor="0">
              <Sprite>carranca.png</Sprite>
              <Particles>
                <ParticleSystem particles="5" allAtOnce="0" alphaMode="1" repeat="0" animationMode="1" lifeTime="500">
                  <Bitmap>explosion_particle.png</Bitmap>
                  <Gravity x="0" y="0" />
                </ParticleSystem>
              </Particles>
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>`;

      const scene = parseScene(xml);
      expect(scene.entities).toHaveLength(1);
      const entity = scene.entities[0];
      expect(entity.inlineTemplate).toBeDefined();
      expect(entity.inlineTemplate?.particleSystems).toBeDefined();
      expect(entity.inlineTemplate?.particleSystems).toHaveLength(1);
      expect(entity.inlineTemplate?.particleSystems?.[0].bitmap).toBe('explosion_particle.png');
      expect(entity.inlineTemplate?.particleSystems?.[0].particles).toBe(5);
      expect(entity.inlineTemplate?.particleSystems?.[0].lifeTime).toBe(500);
    });

    it('XML-05: Should serialize inline ParticleSystem tags as XML attributes without destroying structure', () => {
      const xml = `<?xml version="1.0" ?>
      <Ethanon>
        <SceneProperties lightIntensity="2" parallaxIntensity="3">
          <Ambient r="0.5" g="0.5" b="0.5" />
          <ZAxisDirection x="0" y="-1" />
        </SceneProperties>
        <EntitiesInScene>
          <Entity id="91081" spriteFrame="0">
            <EntityName>fire_spitter</EntityName>
            <Position x="-596" y="492" z="-0.1" angle="0" />
            <Entity shape="1" sensor="0">
              <Sprite>carranca.png</Sprite>
              <Particles>
                <ParticleSystem particles="5" allAtOnce="0" alphaMode="1" repeat="0" animationMode="1" lifeTime="500">
                  <Bitmap>explosion_particle.png</Bitmap>
                  <Gravity x="0" y="0" />
                </ParticleSystem>
              </Particles>
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>`;

      const scene = parseScene(xml);
      const serialized = serializeScene(scene);

      expect(serialized).toContain('particles="5"');
      expect(serialized).toContain('lifeTime="500"');
      expect(serialized).not.toContain('<particles>5</particles>');

      const reParsedScene = parseScene(serialized);
      const reParsedEntity = reParsedScene.entities[0];
      expect(reParsedEntity.inlineTemplate?.particleSystems).toHaveLength(1);
      expect(reParsedEntity.inlineTemplate?.particleSystems?.[0].particles).toBe(5);
      expect(reParsedEntity.inlineTemplate?.particleSystems?.[0].lifeTime).toBe(500);
      expect(reParsedEntity.inlineTemplate?.particleSystems?.[0].bitmap).toBe('explosion_particle.png');
    });

    it('XML-06: Should NOT output <Particles/> or inline tags when serializing packed entity', () => {
      const scene = {
        properties: {
          ambient: { r: 0.5, g: 0.5, b: 0.5 },
          lightIntensity: 2,
          zAxisDirection: { x: 0, y: -1 },
          parallaxIntensity: 3,
        },
        entities: [
          {
            id: 1,
            entityName: 'fire_torch.ent',
            editorEntityUID: 'uid-torch-1',
            position: { x: 100, y: 200, z: 0 },
            angle: 0,
            spriteFrame: 0,
            hide: false,
            flipX: false,
            flipY: false,
            customData: [],
            inlineEntityData: {
              FileName: 'fire_torch.ent',
            },
          },
        ],
      };

      const xml = serializeScene(scene);

      expect(xml).toContain('<FileName>fire_torch.ent</FileName>');
      expect(xml).not.toContain('<Particles');
      expect(xml).not.toContain('<Sprite');
    });

    it('XML-07: Should ignore legacy empty <Particles/> tag on packed entity during parseScene', () => {
      const xml = `<?xml version="1.0" ?>
      <Ethanon>
        <SceneProperties lightIntensity="2" parallaxIntensity="3">
          <Ambient r="0.5" g="0.5" b="0.5" />
          <ZAxisDirection x="0" y="-1" />
        </SceneProperties>
        <EntitiesInScene>
          <Entity id="1" spriteFrame="0">
            <EntityName>fire_torch.ent</EntityName>
            <Position x="100" y="200" z="0" angle="0" />
            <Entity>
              <FileName>fire_torch.ent</FileName>
              <Particles />
            </Entity>
          </Entity>
        </EntitiesInScene>
      </Ethanon>`;

      const scene = parseScene(xml);
      const entity = scene.entities[0];

      // Entity should NOT have inline template data because <Particles/> was empty
      expect(entity.inlineTemplate).toBeUndefined();
    });
  });
});

