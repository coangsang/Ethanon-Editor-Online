import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '../sceneStore';

const SCENE_WITH_HIERARCHY_XML = `
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="parent-uid" editorEntityName="Parent Entity">
      <EntityName>parent.ent</EntityName>
      <Position x="100" y="200" z="0" angle="0" />
      <Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
    <Entity id="2" spriteFrame="0" editorEntityUID="child-uid" editorEntityName="Child Entity" editorParentEntity="parent-uid">
      <EntityName>child.ent</EntityName>
      <Position x="150" y="250" z="0" angle="0" />
      <LocalPosition x="50" y="50" z="0" angle="0" />
      <Entity><FileName>child.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

describe('Entity Duplicate, Copy, and Paste', () => {
  beforeEach(() => {
    useSceneStore.getState().loadScene(SCENE_WITH_HIERARCHY_XML);
  });

  it('duplicates a single entity with a new UID, new numeric ID, and position offset', () => {
    const store = useSceneStore.getState();
    store.selectEntity('child-uid');
    store.duplicateSelected();

    const entities = useSceneStore.getState().scene.entities;
    expect(entities.length).toBe(3);

    const duplicated = entities.find(e => e.id === 3);
    expect(duplicated).toBeDefined();
    expect(duplicated?.editorEntityUID).not.toBe('child-uid');
    expect(duplicated?.editorEntityUID).toBeTruthy();
    expect(duplicated?.editorEntityName).toBe('Child Entity');
    expect(duplicated?.position.x).toBe(150 + 16);
    expect(duplicated?.position.y).toBe(250 + 16);
    // Since original parent-uid exists in scene, duplicated child retains parent-uid
    expect(duplicated?.editorParentEntity).toBe('parent-uid');
    expect(useSceneStore.getState().selectedUIDs).toEqual([duplicated?.editorEntityUID]);
  });

  it('duplicates a parent entity together with all its children, remapping parent UID', () => {
    const store = useSceneStore.getState();
    store.selectEntity('parent-uid');
    store.duplicateSelected();

    const entities = useSceneStore.getState().scene.entities;
    // Original 2 entities + 2 duplicated entities = 4 entities
    expect(entities.length).toBe(4);

    const duplicatedParent = entities.find(e => e.id === 3);
    const duplicatedChild = entities.find(e => e.id === 4);

    expect(duplicatedParent).toBeDefined();
    expect(duplicatedChild).toBeDefined();

    expect(duplicatedParent?.editorEntityUID).not.toBe('parent-uid');
    expect(duplicatedChild?.editorEntityUID).not.toBe('child-uid');

    // Duplicated child MUST point to duplicated parent's new editorEntityUID, NOT the old parent-uid
    expect(duplicatedChild?.editorParentEntity).toBe(duplicatedParent?.editorEntityUID);
    expect(duplicatedParent?.position.x).toBe(100 + 16);
    expect(duplicatedParent?.position.y).toBe(200 + 16);
  });

  it('copies and pastes entities into the scene', () => {
    const store = useSceneStore.getState();
    store.selectEntity('parent-uid');
    store.copySelected();

    expect(useSceneStore.getState().clipboard).not.toBeNull();
    expect(useSceneStore.getState().clipboard?.length).toBe(2);

    store.pasteClipboard();

    const entities = useSceneStore.getState().scene.entities;
    expect(entities.length).toBe(4);

    const pastedParent = entities.find(e => e.id === 3);
    const pastedChild = entities.find(e => e.id === 4);

    expect(pastedParent).toBeDefined();
    expect(pastedChild).toBeDefined();
    expect(pastedChild?.editorParentEntity).toBe(pastedParent?.editorEntityUID);
  });

  it('supports undoing duplicate and paste operations', () => {
    const store = useSceneStore.getState();
    store.selectEntity('parent-uid');
    store.duplicateSelected();

    expect(useSceneStore.getState().scene.entities.length).toBe(4);

    useSceneStore.getState().undo();
    expect(useSceneStore.getState().scene.entities.length).toBe(2);

    useSceneStore.getState().redo();
    expect(useSceneStore.getState().scene.entities.length).toBe(4);
  });
});
