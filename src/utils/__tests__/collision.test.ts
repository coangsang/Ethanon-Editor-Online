import { describe, expect, it } from 'vitest';
import { parseEntityTemplate, parseScene } from '../../io/parseScene';
import { resolveEntityTemplate } from '../entityTemplate';
import { parseEntityPhysics } from '../collision';

describe('collision parsing and resolution', () => {
  it('parses box physics without exposing Z values', () => {
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
      collision: { position: { x: 4, y: 5 }, size: { x: 20, y: 30 } },
    });
    expect(template.physics?.collision.position).not.toHaveProperty('z');
    expect(template.physics?.collision.size).not.toHaveProperty('z');
  });

  it('parses polygon, compound material overrides, and revolute joints', () => {
    const polygon = parseEntityPhysics({
      shape: '3',
      Collision: {
        Position: { x: 0, y: 0 }, Size: { x: 64, y: 32 },
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
        Position: { x: 0, y: 0 }, Size: { x: 80, y: 100 },
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
      <Ethanon><Entity shape="1"><Scale x="2" y="2"/><Collision><Position x="1" y="2"/><Size x="10" y="20"/></Collision></Entity></Ethanon>`);
    const packedScene = parseScene(`<Ethanon><SceneProperties/><EntitiesInScene><Entity id="1">
      <EntityName>crate.ent</EntityName><Position x="0" y="0" z="0" angle="0"/>
      <Entity><FileName>crate.ent</FileName><Scale x="9" y="9"/><Collision><Position x="9" y="9"/><Size x="9" y="9"/></Collision></Entity>
    </Entity></EntitiesInScene></Ethanon>`);
    const inlineScene = parseScene(`<Ethanon><SceneProperties/><EntitiesInScene><Entity id="2">
      <EntityName>inline</EntityName><Position x="0" y="0" z="0" angle="0"/>
      <Entity shape="2"><Scale x="3" y="4"/><Collision><Position x="5" y="6"/><Size x="30" y="40"/></Collision></Entity>
    </Entity></EntitiesInScene></Ethanon>`);

    expect(resolveEntityTemplate(packedScene.entities[0], { crate: external })?.physics?.collision.size).toEqual({ x: 10, y: 20 });
    expect(resolveEntityTemplate(packedScene.entities[0], { crate: external })?.scale).toEqual({ x: 2, y: 2 });
    expect(resolveEntityTemplate(inlineScene.entities[0], {})?.physics).toMatchObject({ shape: 2, collision: { size: { x: 30, y: 40 } } });
    expect(resolveEntityTemplate(inlineScene.entities[0], {})?.scale).toEqual({ x: 3, y: 4 });
  });

  it('reports malformed shape data without throwing', () => {
    const physics = parseEntityPhysics({
      shape: '4',
      Collision: { Size: { x: 0, y: 20 }, Compound: 'bad { shape = capsule; }' },
    });
    expect(physics.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Size.x'),
      expect.stringContaining('unsupported'),
    ]));
    expect(physics.collision.compound).toEqual([]);
  });
});
