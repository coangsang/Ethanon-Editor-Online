import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '../sceneStore';
import { parseScene } from '../../io/parseScene';
import { serializeScene } from '../../io/serializeScene';

const BASE_SCENE_XML = `
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="parent-1" editorEntityName="Parent Entity">
      <EntityName>parent.ent</EntityName>
      <Position x="100" y="200" z="0" angle="0" />
      <Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

describe('Empty Entity Creation and Serialization', () => {
  beforeEach(() => {
    useSceneStore.getState().loadScene(BASE_SCENE_XML);
  });

  it('creates a root empty entity with default attributes', () => {
    useSceneStore.getState().addEmptyEntity(null);

    const entities = useSceneStore.getState().scene.entities;
    expect(entities.length).toBe(2);

    const empty = entities.find(e => e.id === 2);
    expect(empty).toBeDefined();
    expect(empty?.entityName).toBe('');
    expect(empty?.editorEntityName).toBe('Empty Entity');
    expect(empty?.editorParentEntity).toBeUndefined();
    expect(empty?.inlineEntityData).toEqual({
      shape: 1,
      sensor: 0,
      bullet: 0,
      fixedRotation: 0,
      friction: 1,
      density: 1,
      restitution: 0,
      gravityScale: 1,
      applyLight: 0,
      castShadow: 0,
      type: 0,
      static: 0,
      blendMode: 0,
      Particles: {},
    });
  });

  it('creates an empty child entity under a selected parent entity', () => {
    useSceneStore.getState().addEmptyEntity('parent-1');

    const entities = useSceneStore.getState().scene.entities;
    const emptyChild = entities.find(e => e.editorParentEntity === 'parent-1');

    expect(emptyChild).toBeDefined();
    expect(emptyChild?.entityName).toBe('');
    expect(emptyChild?.editorEntityName).toBe('Empty Entity');
    expect(emptyChild?.localPosition).toEqual({ x: 0, y: 0, z: 0, angle: 0 });
    expect(emptyChild?.position).toEqual({ x: 100, y: 200, z: 0 });
  });

  it('serializes empty entity to Ethanon XML matching required specification', () => {
    useSceneStore.getState().addEmptyEntity(null);
    const scene = useSceneStore.getState().scene;

    const serializedXml = serializeScene(scene);

    // Should NOT contain <FileName> tag for empty entity node
    const emptyEntitySnippet = serializedXml.slice(serializedXml.indexOf('editorEntityName="Empty Entity"'));
    expect(emptyEntitySnippet).not.toContain('<FileName>');

    // Should contain required Ethanon attributes on <Entity>
    expect(serializedXml).toContain('shape="1"');
    expect(serializedXml).toContain('sensor="0"');
    expect(serializedXml).toContain('bullet="0"');
    expect(serializedXml).toContain('fixedRotation="0"');
    expect(serializedXml).toContain('friction="1"');
    expect(serializedXml).toContain('density="1"');
    expect(serializedXml).toContain('restitution="0"');
    expect(serializedXml).toContain('gravityScale="1"');
    expect(serializedXml).toContain('applyLight="0"');
    expect(serializedXml).toContain('castShadow="0"');
    expect(serializedXml).toContain('type="0"');
    expect(serializedXml).toContain('static="0"');
    expect(serializedXml).toContain('blendMode="0"');

    // Should contain <Particles /> and <CustomData />
    expect(serializedXml).toContain('<Particles');
    expect(serializedXml).toContain('<CustomData');
  });

  it('parses back serialized empty entity XML with high fidelity', () => {
    useSceneStore.getState().addEmptyEntity('parent-1');
    const xml = serializeScene(useSceneStore.getState().scene);

    const reParsedScene = parseScene(xml);
    const emptyChild = reParsedScene.entities.find(e => e.editorParentEntity === 'parent-1');

    expect(emptyChild).toBeDefined();
    expect(emptyChild?.editorEntityName).toBe('Empty Entity');
    expect(emptyChild?.position.x).toBe(100);
    expect(emptyChild?.position.y).toBe(200);
  });
});
