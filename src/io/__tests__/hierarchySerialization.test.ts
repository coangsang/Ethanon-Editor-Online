import { describe, expect, it } from 'vitest';
import type { SceneData } from '../../types';
import { parseScene } from '../parseScene';
import { serializeScene } from '../serializeScene';

describe('hierarchy serialization', () => {
  it('saves parent UID, hierarchy order, and local transform', () => {
    const scene: SceneData = {
      properties: {
        ambient: { r: 0.5, g: 0.5, b: 0.5 },
        lightIntensity: 2,
        zAxisDirection: { x: 0, y: -1 },
        parallaxIntensity: 3,
      },
      entities: [
        {
          id: 10,
          entityName: 'parent',
          editorEntityUID: 'parent-uid',
          position: { x: 100, y: 50, z: 0 },
          angle: 30,
          spriteFrame: 0,
          hide: false,
          flipX: false,
          flipY: false,
          customData: [],
        },
        {
          id: 20,
          entityName: 'child',
          editorEntityUID: 'child-uid',
          editorParentEntity: 'parent-uid',
          editorHierarchyOrder: 1,
          localPosition: { x: 5, y: 10, z: 2, angle: 15 },
          position: { x: 109.3301270189222, y: 56.16025403784439, z: 2 },
          angle: 45,
          spriteFrame: 0,
          hide: false,
          flipX: false,
          flipY: false,
          customData: [],
        },
      ],
    };

    const xml = serializeScene(scene);
    expect(xml).toContain('editorEntityUID="parent-uid"');
    expect(xml).toContain('editorParentEntity="parent-uid"');
    expect(xml).not.toContain('editorParentId');
    expect(xml).toContain('editorHierarchyOrder="1"');
    expect(xml).toContain('<LocalPosition x="5" y="10" z="2" angle="15"');

    const parsed = parseScene(xml);
    const child = parsed.entities.find(entity => entity.id === 20)!;
    expect(child.editorParentEntity).toBe('parent-uid');
    expect(child.localPosition?.x).toBeCloseTo(5);
    expect(child.localPosition?.y).toBeCloseTo(10);
    expect(child.localPosition?.z).toBe(2);
    expect(child.localPosition?.angle).toBe(15);
  });
});
