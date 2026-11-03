import { describe, expect, it } from 'vitest';
import { parseEntityTemplate, parseScene } from '../../io/parseScene';
import { resolveEntityTemplate } from '../entityTemplate';
import { parseEntityPhysics } from '../collision';

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
});
