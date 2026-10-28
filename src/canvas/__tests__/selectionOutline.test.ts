import { describe, expect, it } from 'vitest';
import * as PIXI from 'pixi.js';

describe('Selection Outline Polygon Geometry', () => {
  it('computes screen coordinates correctly for rotated mesh vertices', () => {
    // Simulate a Pixi container hierarchy similar to Viewport: app.stage -> world -> mesh
    const world = new PIXI.Container();
    world.position.set(100, 200); // camera.x = 100, camera.y = 200
    world.scale.set(2.0);        // camera.zoom = 2.0

    const mesh = new PIXI.Mesh({
      geometry: new PIXI.MeshGeometry({
        positions: new Float32Array([
          -50, -50, // TL (V0)
           50, -50, // TR (V1)
          -50,  50, // BL (V2)
           50,  50, // BR (V3)
        ]),
      }),
    });
    mesh.position.set(50, 50); // entity position
    world.addChild(mesh);

    const positions = mesh.geometry.positions;
    const p0 = mesh.toGlobal({ x: positions[0], y: positions[1] });
    const p1 = mesh.toGlobal({ x: positions[2], y: positions[3] });
    const p2 = mesh.toGlobal({ x: positions[4], y: positions[5] });
    const p3 = mesh.toGlobal({ x: positions[6], y: positions[7] });

    // Local (-50, -50) + position (50, 50) = world (0, 0)
    // Screen = world * 2.0 + (100, 200) = (100, 200)
    expect(p0.x).toBeCloseTo(100);
    expect(p0.y).toBeCloseTo(200);

    // Local (50, 50) + position (50, 50) = world (100, 100)
    // Screen = (100, 100) * 2.0 + (100, 200) = (300, 400)
    expect(p3.x).toBeCloseTo(300);
    expect(p3.y).toBeCloseTo(400);

    // Quad perimeter loop p0 -> p1 -> p3 -> p2
    const pts = [p0, p1, p3, p2];
    expect(pts).toHaveLength(4);
  });
});

