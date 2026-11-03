import { describe, expect, it } from 'vitest';
import { parseEntityTemplate, parseScene } from '../../io/parseScene';
import { applyPhysicsToEntity, createDefaultPhysics, resolveEntityTemplate } from '../entityTemplate';
import {
  createDefaultCompoundSubShape,
  createDefaultPolygonVertices,
  MAX_COMPOUND_SUB_SHAPES,
  MAX_POLYGON_VERTICES,
  MIN_POLYGON_VERTICES,
  parseEntityPhysics,
  POLYGON_PRESETS,
  serializeCompoundEnml,
  serializePolygonEnml,
  validatePolygon,
} from '../collision';
import type { CollisionCompoundShape, CollisionPolygonVertex, EntityInstance } from '../../types';

describe('collision parsing and resolution', () => {
  it('parses complete XYZ box physics', () => {
    const template = parseEntityTemplate('crate', `
      <Ethanon><Entity shape="1" static="1" sensor="0" bullet="1" fixedRotation="1"
        friction="0.8" density="1.5" restitution="0.2" gravityScale="0.5">
        <Scale x="2" y="3"/><Collision>
          <Position x="4" y="5" z="99"/><Size x="20" y="30" z="64"/>
        </Collision>
      </Entity></Ethanon>`);

    expect(template.physics).toMatchObject({
      shape: 1,
      static: true,
      bullet: true,
      fixedRotation: true,
      friction: 0.8,
      density: 1.5,
      restitution: 0.2,
      gravityScale: 0.5,
      collision: { position: { x: 4, y: 5, z: 99 }, size: { x: 20, y: 30, z: 64 } },
    });
  });

  it('parses polygon, compound material overrides, and revolute joints', () => {
    const polygon = parseEntityPhysics({
      shape: '3',
      Collision: {
        Position: { x: 0, y: 0, z: 0 }, Size: { x: 64, y: 32, z: 16 },
        Polygon: `v0 { x = -1; y = -1; } v1 { x = 1; y = -1; } v2 { x = 0; y = 1; }`,
      },
    });
    expect(polygon.collision.polygon).toEqual([
      { name: 'v0', x: -1, y: -1 },
      { name: 'v1', x: 1, y: -1 },
      { name: 'v2', x: 0, y: 1 },
    ]);

    const compound = parseEntityPhysics({
      shape: '4', friction: '0.7', density: '2', restitution: '0.1',
      Collision: {
        Position: { x: 0, y: 0, z: 0 }, Size: { x: 80, y: 100, z: 20 },
        Compound: `
          torso { shape = box; posX = 0; posY = 0.2; sizeX = 1.6; sizeY = 1.2; angle = 0.5; friction = 0.4; }
          head { shape = circle; posX = 0; posY = -0.7; radius = 0.4; }
        `,
        Joints: `revoluteJoint_wheel {
          otherEntityName = wheel.ent; attachPointAX = 0.5; attachPointAY = -0.2;
          attachPointBX = -0.8; attachPointBY = 0; enableLimit = true;
          lowerAngle = -0.785; upperAngle = 0.785; enableMotor = false;
          motorSpeed = 2; maxMotorTorque = 100;
        } ignored { otherEntityName = no.ent; }`,
      },
    });
    expect(compound.collision.compound).toHaveLength(2);
    expect(compound.collision.compound[0]).toMatchObject({ shape: 'box', friction: 0.4, angle: 0.5 });
    expect(compound.collision.compound[1]).toMatchObject({ shape: 'circle', radius: 0.4 });
    expect(compound.collision.joints).toEqual([expect.objectContaining({
      name: 'revoluteJoint_wheel', otherEntityName: 'wheel.ent', enableLimit: true, maxMotorTorque: 100,
    })]);
  });

  it('uses external physics for FileName entities and inline physics otherwise', () => {
    const external = parseEntityTemplate('crate', `
      <Ethanon><Entity shape="1"><Scale x="2" y="2"/><Collision><Position x="1" y="2" z="3"/><Size x="10" y="20" z="8"/></Collision></Entity></Ethanon>`);
    const packedScene = parseScene(`<Ethanon><SceneProperties/><EntitiesInScene><Entity id="1">
      <EntityName>crate.ent</EntityName><Position x="0" y="0" z="0" angle="0"/>
      <Entity><FileName>crate.ent</FileName><Scale x="9" y="9"/><Collision><Position x="9" y="9" z="9"/><Size x="9" y="9" z="9"/></Collision></Entity>
    </Entity></EntitiesInScene></Ethanon>`);
    const inlineScene = parseScene(`<Ethanon><SceneProperties/><EntitiesInScene><Entity id="2">
      <EntityName>inline</EntityName><Position x="0" y="0" z="0" angle="0"/>
      <Entity shape="2"><Scale x="3" y="4"/><Collision><Position x="5" y="6" z="7"/><Size x="30" y="40" z="12"/></Collision></Entity>
    </Entity></EntitiesInScene></Ethanon>`);

    expect(resolveEntityTemplate(packedScene.entities[0], { crate: external })?.physics?.collision.size).toEqual({ x: 10, y: 20, z: 8 });
    expect(resolveEntityTemplate(packedScene.entities[0], { crate: external })?.scale).toEqual({ x: 2, y: 2 });
    expect(resolveEntityTemplate(inlineScene.entities[0], {})?.physics).toMatchObject({ shape: 2, collision: { size: { x: 30, y: 40 } } });
    expect(resolveEntityTemplate(inlineScene.entities[0], {})?.scale).toEqual({ x: 3, y: 4 });
  });

  it('reports malformed shape data without throwing', () => {
    const physics = parseEntityPhysics({
      shape: '4',
      Collision: { Position: { x: 0, y: 0, z: 0 }, Size: { x: 0, y: 20, z: 10 }, Compound: 'bad { shape = capsule; }' },
    });
    expect(physics.warnings).toEqual(expect.arrayContaining([
      'Collision.Size invalid',
      expect.stringContaining('unsupported'),
    ]));
    expect(physics.collision.valid).toBe(false);
    expect(physics.collision.compound).toEqual([]);
  });

  it('marks missing Z data invalid instead of rendering a fallback plane', () => {
    const parsed = parseEntityPhysics({
      shape: 1,
      Collision: { Position: { x: 0, y: 0 }, Size: { x: 10, y: 10 } },
    });
    expect(parsed.collision).toMatchObject({
      valid: false,
      position: { x: 0, y: 0, z: 0 },
      size: { x: 10, y: 10, z: 0 },
    });
    expect(parsed.warnings).toEqual(expect.arrayContaining([
      'Collision.Position invalid',
      'Collision.Size invalid',
    ]));
  });

  it('reports only "Collision tag missing" when shape != 0 and Collision tag is missing', () => {
    for (const shape of [1, 2, 3, 4]) {
      const parsed = parseEntityPhysics({ shape });
      expect(parsed.warnings).toEqual(['Collision tag missing']);
      expect(parsed.collision.valid).toBe(false);
      expect(parsed.collision.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(parsed.collision.size).toEqual({ x: 0, y: 0, z: 0 });
      expect(parsed.collision.polygon).toEqual([]);
      expect(parsed.collision.compound).toEqual([]);
    }
  });

  it('reports "Collision.Position tag missing" without inspecting x, y, z when Position tag is missing', () => {
    const parsed = parseEntityPhysics({
      shape: 1,
      Collision: { Size: { x: 10, y: 20, z: 30 } },
    });
    expect(parsed.warnings).toEqual(['Collision.Position tag missing']);
    expect(parsed.collision.valid).toBe(false);
    expect(parsed.collision.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reports "Collision.Position invalid" when position child coordinates are malformed', () => {
    const parsed = parseEntityPhysics({
      shape: 1,
      Collision: {
        Position: { x: 'invalid', y: 0, z: 0 },
        Size: { x: 10, y: 20, z: 30 },
      },
    });
    expect(parsed.warnings).toEqual(['Collision.Position invalid']);
    expect(parsed.collision.valid).toBe(false);
  });

  it('reports "Collision.Size tag missing" without inspecting x, y, z when Size tag is missing', () => {
    const parsed = parseEntityPhysics({
      shape: 1,
      Collision: { Position: { x: 0, y: 0, z: 0 } },
    });
    expect(parsed.warnings).toEqual(['Collision.Size tag missing']);
    expect(parsed.collision.valid).toBe(false);
    expect(parsed.collision.size).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reports "Collision.Size invalid" when size child dimension is malformed or non-positive', () => {
    const parsedZero = parseEntityPhysics({
      shape: 1,
      Collision: {
        Position: { x: 0, y: 0, z: 0 },
        Size: { x: 10, y: -5, z: 30 },
      },
    });
    expect(parsedZero.warnings).toEqual(['Collision.Size invalid']);
    expect(parsedZero.collision.valid).toBe(false);
  });

  it('reports no warnings when shape is 0 without Collision tag', () => {
    const parsed = parseEntityPhysics({ shape: 0 });
    expect(parsed.warnings).toEqual([]);
    expect(parsed.collision.valid).toBe(true);
  });

  it('accepts a clockwise convex polygon with eight sequential vertices', () => {
    const parsed = parseEntityPhysics({
      shape: 3,
      Collision: {
        Position: { x: 0, y: 0, z: 0 }, Size: { x: 10, y: 10, z: 10 },
        Polygon: `
          v0 { x=-0.5; y=-1; } v1 { x=0.5; y=-1; }
          v2 { x=1; y=-0.5; } v3 { x=1; y=0.5; }
          v4 { x=0.5; y=1; } v5 { x=-0.5; y=1; }
          v6 { x=-1; y=0.5; } v7 { x=-1; y=-0.5; }
        `,
      },
    });
    expect(parsed.collision.valid).toBe(true);
    expect(parsed.collision.polygon).toHaveLength(8);
  });

  it('rejects malformed polygon geometry instead of rendering a truncated shape', () => {
    const cases = [
      'v0 { x=-1; y=-1; } v1 { x=1; y=-1; } v2 { x=0; y=1; } v4 { x=0; y=0; }',
      'v0 { x=-2; y=-1; } v1 { x=1; y=-1; } v2 { x=0; y=1; }',
      'v0 { x=-1; y=-1; } v1 { x=0; y=0; } v2 { x=1; y=1; }',
      'v0 { x=-1; y=-1; } v1 { x=0; y=1; } v2 { x=1; y=-1; }',
    ];
    for (const Polygon of cases) {
      const parsed = parseEntityPhysics({
        shape: 3,
        Collision: { Position: { x: 0, y: 0, z: 0 }, Size: { x: 10, y: 10, z: 10 }, Polygon },
      });
      expect(parsed.collision.polygon).toEqual([]);
      expect(parsed.warnings.length).toBeGreaterThan(0);
    }
  });

  it('filters invalid compound children and reports invalid joints', () => {
    const parsed = parseEntityPhysics({
      shape: 4,
      Collision: {
        Position: { x: 0, y: 0, z: 0 }, Size: { x: 10, y: 10, z: 10 },
        Compound: `
          good { shape=box; posX=0; posY=0; sizeX=1; sizeY=1; }
          outside { shape=box; posX=2; posY=0; sizeX=1; sizeY=1; }
          negative { shape=circle; posX=0; posY=0; radius=-0.4; }
        `,
        Joints: 'revoluteJoint_bad { attachPointAX=2; enableLimit=true; lowerAngle=2; upperAngle=1; }',
      },
    });
    expect(parsed.collision.compound.map(item => item.name)).toEqual(['good']);
    expect(parsed.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('position'),
      expect.stringContaining('radius'),
      expect.stringContaining('anchors'),
      expect.stringContaining('lowerAngle'),
    ]));
  });

  it('preserves raw ENML strings (Polygon, Compound, Joints) in inlineEntityData.Collision when updating physics', () => {
    const rawPolygon = 'v0 { x=0; y=0; } v1 { x=1; y=1; }';
    const rawJoints = 'revoluteJoint0 { attachPointAX=0; }';
    const entity: EntityInstance = {
      id: 1,
      entityName: 'polyEntity',
      editorEntityName: 'polyEntity',
      editorEntityUID: 'poly-1',
      position: { x: 0, y: 0, z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
      inlineTemplate: {
        name: 'polyEntity',
        physics: createDefaultPhysics(3),
      },
      inlineEntityData: {
        shape: '3',
        Collision: {
          Position: { x: '0', y: '0', z: '0' },
          Size: { x: '10', y: '10', z: '10' },
          Polygon: rawPolygon,
          Joints: rawJoints,
        },
      },
    };

    const nextPhysics = {
      ...createDefaultPhysics(3),
      friction: 0.5,
      collision: {
        valid: true,
        position: { x: 5, y: 5, z: 0 },
        size: { x: 20, y: 20, z: 20 },
        polygon: [{ name: 'v0', x: 0, y: 0 }, { name: 'v1', x: 1, y: 1 }],
        compound: [],
        joints: [],
      },
      warnings: [],
    };

    const updated = applyPhysicsToEntity(entity, nextPhysics);
    const col = updated.inlineEntityData?.Collision as Record<string, unknown>;
    expect(col.Polygon).toBe(rawPolygon);
    expect(col.Joints).toBe(rawJoints);
    expect(typeof col.Polygon).toBe('string');
  });

  it('allows disabling collision on an entity unpacked from a template without fallback revival', () => {
    const template = parseEntityTemplate('rock', `
      <Ethanon><Entity shape="1">
        <Collision><Position x="0" y="0" z="0"/><Size x="32" y="32" z="32"/></Collision>
      </Entity></Ethanon>`);

    const entity: EntityInstance = {
      id: 2,
      entityName: 'rock',
      editorEntityName: 'rock_instance',
      editorEntityUID: 'rock-1',
      position: { x: 0, y: 0, z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
      inlineTemplate: {
        name: 'rock',
        physics: template.physics,
      },
      inlineEntityData: {
        shape: '1',
      },
    };

    const templates = { rock: template };

    // Disabling collision
    const disabled = applyPhysicsToEntity(entity, createDefaultPhysics(0));
    expect(disabled.inlineEntityData?.shape).toBe('0');
    expect(disabled.inlineEntityData?.Collision).toBeUndefined();

    // Resolving template must preserve shape 0 instead of reviving shape 1 from template
    const resolved = resolveEntityTemplate(disabled, templates);
    expect(resolved.physics?.shape).toBe(0);
  });

  describe('compound collision serialization and helpers', () => {
    it('has MAX_COMPOUND_SUB_SHAPES configured as 8', () => {
      expect(MAX_COMPOUND_SUB_SHAPES).toBe(8);
    });

    it('creates default compound sub-shapes with unique names and valid bounds', () => {
      const first = createDefaultCompoundSubShape([]);
      expect(first).toEqual({
        name: 'sub_0',
        shape: 'box',
        posX: 0,
        posY: 0,
        sizeX: 1,
        sizeY: 1,
        angle: 0,
      });

      const second = createDefaultCompoundSubShape([first], 'circle');
      expect(second).toEqual({
        name: 'sub_1',
        shape: 'circle',
        posX: 0,
        posY: 0,
        radius: 0.5,
        angle: 0,
      });
    });

    it('serializes compound sub-shapes to ENML format and roundtrips through parseEntityPhysics', () => {
      const original: CollisionCompoundShape[] = [
        {
          name: 'torso',
          shape: 'box',
          posX: 0.1,
          posY: -0.2,
          sizeX: 1.5,
          sizeY: 0.8,
          angle: 0.785,
          friction: 0.4,
          density: 2.5,
          restitution: 0.1,
        },
        {
          name: 'head',
          shape: 'circle',
          posX: 0,
          posY: 0.6,
          radius: 0.35,
          angle: 0,
        },
      ];

      const enml = serializeCompoundEnml(original);
      expect(enml).toContain('torso {');
      expect(enml).toContain('shape = box;');
      expect(enml).toContain('sizeX = 1.5;');
      expect(enml).toContain('friction = 0.4;');
      expect(enml).toContain('head {');
      expect(enml).toContain('shape = circle;');
      expect(enml).toContain('radius = 0.35;');

      const parsed = parseEntityPhysics({
        shape: '4',
        Collision: {
          Position: { x: 0, y: 0, z: 0 },
          Size: { x: 50, y: 50, z: 50 },
          Compound: enml,
        },
      });

      expect(parsed.collision.compound).toHaveLength(2);
      expect(parsed.collision.compound[0]).toMatchObject({
        name: 'torso',
        shape: 'box',
        posX: 0.1,
        posY: -0.2,
        sizeX: 1.5,
        sizeY: 0.8,
        angle: 0.785,
        friction: 0.4,
        density: 2.5,
        restitution: 0.1,
      });
      expect(parsed.collision.compound[1]).toMatchObject({
        name: 'head',
        shape: 'circle',
        posX: 0,
        posY: 0.6,
        radius: 0.35,
        angle: 0,
      });
    });

    it('updates inlineEntityData.Collision.Compound when applying shape 4 physics', () => {
      const entity: EntityInstance = {
        id: 1,
        entityName: 'custom_crate',
        editorEntityName: 'custom_crate_1',
        editorEntityUID: 'custom-1',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
      };

      const physics = createDefaultPhysics(4);
      expect(physics.collision.compound).toHaveLength(1);
      expect(physics.collision.compound[0].name).toBe('sub_0');

      const updated = applyPhysicsToEntity(entity, physics);
      const col = updated.inlineEntityData?.Collision as Record<string, unknown>;
      expect(col).toBeDefined();
      expect(typeof col.Compound).toBe('string');
      expect(col.Compound).toContain('sub_0 {');
      expect(col.Compound).toContain('shape = box;');
    });

    it('validates polygon constraints and serialization correctly', () => {
      expect(MIN_POLYGON_VERTICES).toBe(3);
      expect(MAX_POLYGON_VERTICES).toBe(8);

      const validTriangle = createDefaultPolygonVertices();
      const validResult = validatePolygon(validTriangle);
      expect(validResult.valid).toBe(true);
      expect(validResult.isConvex).toBe(true);
      expect(validResult.isClockwise).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Serialize and round-trip through parseEntityPhysics
      const enml = serializePolygonEnml(validTriangle);
      expect(enml).toContain('v0 {');
      expect(enml).toContain('x = 0;');
      expect(enml).toContain('y = -1;');

      const parsed = parseEntityPhysics({
        shape: '3',
        Collision: {
          Position: { x: 0, y: 0, z: 0 },
          Size: { x: 64, y: 64, z: 32 },
          Polygon: enml,
        },
      });
      expect(parsed.collision.polygon).toHaveLength(3);
      expect(parsed.collision.polygon[0]).toEqual({ name: 'v0', x: 0, y: -1 });

      // Counter-clockwise triangle
      const ccwTriangle: CollisionPolygonVertex[] = [
        { name: 'v0', x: 0, y: -1 },
        { name: 'v1', x: -1, y: 1 },
        { name: 'v2', x: 1, y: 1 },
      ];
      const ccwResult = validatePolygon(ccwTriangle);
      expect(ccwResult.valid).toBe(false);
      expect(ccwResult.isClockwise).toBe(false);
      expect(ccwResult.errors).toContain('Polygon vertices must use clockwise screen-space winding.');

      // Less than 3 vertices
      const twoVerts = [{ name: 'v0', x: 0, y: 0 }, { name: 'v1', x: 1, y: 1 }];
      const tooFewResult = validatePolygon(twoVerts);
      expect(tooFewResult.valid).toBe(false);

      // More than 8 vertices
      const nineVerts: CollisionPolygonVertex[] = Array.from({ length: 9 }, (_, i) => ({
        name: `v${i}`,
        x: 0,
        y: 0,
      }));
      const tooManyResult = validatePolygon(nineVerts);
      expect(tooManyResult.valid).toBe(false);

      // Verify all presets are valid
      for (const preset of POLYGON_PRESETS) {
        const res = validatePolygon(preset.vertices);
        expect(res.valid).toBe(true);
        expect(res.isConvex).toBe(true);
        expect(res.isClockwise).toBe(true);
      }
    });

    it('updates inlineEntityData.Collision.Polygon when applying shape 3 physics with new vertices', () => {
      const entity: EntityInstance = {
        id: 2,
        entityName: 'poly_rock',
        editorEntityName: 'poly_rock_1',
        editorEntityUID: 'poly-2',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
      };

      const physics = createDefaultPhysics(3);
      expect(physics.collision.polygon).toHaveLength(3);

      const updated = applyPhysicsToEntity(entity, physics);
      const col = updated.inlineEntityData?.Collision as Record<string, unknown>;
      expect(col).toBeDefined();
      expect(typeof col.Polygon).toBe('string');
      expect(col.Polygon).toContain('v0 {');
      expect(col.Polygon).toContain('v1 {');
      expect(col.Polygon).toContain('v2 {');
    });
  });
});
