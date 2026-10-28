import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '../sceneStore';

const SCENE_XML = `
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="parent">
      <EntityName>parent</EntityName>
      <Position x="10" y="0" z="0" angle="0" />
      <Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
    <Entity id="2" spriteFrame="0" editorEntityUID="child" editorParentEntity="parent">
      <EntityName>child</EntityName>
      <Position x="15" y="0" z="2" angle="0" />
      <Entity><FileName>child.ent</FileName></Entity>
    </Entity>
    <Entity id="3" spriteFrame="0" editorEntityUID="grandchild" editorParentEntity="child">
      <EntityName>grandchild</EntityName>
      <Position x="18" y="0" z="3" angle="0" />
      <Entity><FileName>grandchild.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

const REPARENT_XML = `
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="parent">
      <EntityName>parent</EntityName>
      <Position x="10" y="0" z="0" angle="0" />
      <Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
    <Entity id="2" spriteFrame="0" editorEntityUID="existing-child" editorParentEntity="parent">
      <EntityName>existing-child</EntityName>
      <Position x="12" y="0" z="0" angle="0" />
      <Entity><FileName>existing-child.ent</FileName></Entity>
    </Entity>
    <Entity id="3" spriteFrame="0" editorEntityUID="moved-child">
      <EntityName>moved-child</EntityName>
      <Position x="15" y="0" z="3" angle="0" />
      <Entity><FileName>moved-child.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

const MULTI_REPARENT_XML = `
<Ethanon>
  <SceneProperties lightIntensity="2" parallaxIntensity="3">
    <Ambient r="0.5" g="0.5" b="0.5" />
    <ZAxisDirection x="0" y="-1" />
  </SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="target">
      <EntityName>target</EntityName><Position x="100" y="0" z="10" angle="0" />
      <Entity><FileName>target.ent</FileName></Entity>
    </Entity>
    <Entity id="2" spriteFrame="0" editorEntityUID="parent">
      <EntityName>parent</EntityName><Position x="10" y="0" z="1" angle="0" />
      <Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
    <Entity id="3" spriteFrame="0" editorEntityUID="child" editorParentEntity="parent">
      <EntityName>child</EntityName><Position x="15" y="0" z="2" angle="0" />
      <Entity><FileName>child.ent</FileName></Entity>
    </Entity>
    <Entity id="4" spriteFrame="0" editorEntityUID="sibling-a" editorHierarchyOrder="2">
      <EntityName>sibling-a</EntityName><Position x="20" y="5" z="3" angle="0" />
      <Entity><FileName>sibling-a.ent</FileName></Entity>
    </Entity>
    <Entity id="5" spriteFrame="0" editorEntityUID="sibling-b" editorHierarchyOrder="3">
      <EntityName>sibling-b</EntityName><Position x="30" y="5" z="4" angle="0" />
      <Entity><FileName>sibling-b.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

describe('scene store hierarchy transforms', () => {
  beforeEach(() => {
    useSceneStore.getState().loadScene(SCENE_XML);
  });

  it('enables live particle emitter updates while moving by default and can toggle them off', () => {
    expect(useSceneStore.getState().updateParticlesWhileMoving).toBe(true);
    useSceneStore.getState().toggleUpdateParticlesWhileMoving();
    expect(useSceneStore.getState().updateParticlesWhileMoving).toBe(false);
  });

  it('updates child local transform without syncing it back to the old world transform', () => {
    useSceneStore.getState().updateLocalTransform(2, { x: 8, angle: 45 });

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.localPosition?.x).toBe(8);
    expect(child.localPosition?.angle).toBe(45);
    expect(child.position.x).toBe(18);
    expect(child.position.y).toBe(0);
    expect(child.angle).toBe(45);
  });

  it('cascades parent world updates to descendants', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 1, position: { x: 20, y: 0 } },
    ]);

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.localPosition?.x).toBe(5);
    expect(child.position.x).toBe(25);
  });

  it('keeps a patched child local transform when parent and child share a drag delta', () => {
    useSceneStore.getState().updateWorldTransform([{ id: 2, position: { x: 15.5 } }]);
    const localBeforeDrag = useSceneStore.getState().scene.entities.find(e => e.id === 2)!.localPosition;

    useSceneStore.getState().updateWorldTransform([
      { id: 1, position: { x: 11.25, y: 3 } },
      { id: 2, position: { x: 16.75, y: 3 } },
    ]);

    const entities = useSceneStore.getState().scene.entities;
    const parent = entities.find(e => e.id === 1)!;
    const child = entities.find(e => e.id === 2)!;
    expect(parent.position).toMatchObject({ x: 11.25, y: 3 });
    expect(child.position).toMatchObject({ x: 16.75, y: 3 });
    expect(child.localPosition).toEqual(localBeforeDrag);
  });

  it('cascades a grouped drag to unpatched grandchildren in one history step', () => {
    const before = useSceneStore.getState().historyIndex;
    useSceneStore.getState().updateWorldTransform([
      { id: 1, position: { x: 11, y: 4 } },
      { id: 2, position: { x: 16, y: 4 } },
    ], true);

    const moved = useSceneStore.getState();
    const grandchild = moved.scene.entities.find(e => e.id === 3)!;
    expect(grandchild.position).toMatchObject({ x: 19, y: 4 });
    expect(moved.historyIndex).toBe(before + 1);

    moved.undo();
    expect(useSceneStore.getState().scene.entities.find(e => e.id === 3)!.position).toMatchObject({ x: 18, y: 0 });
    useSceneStore.getState().redo();
    expect(useSceneStore.getState().scene.entities.find(e => e.id === 3)!.position).toMatchObject({ x: 19, y: 4 });
  });

  it('does not add history for an unchanged world transform', () => {
    const before = useSceneStore.getState().historyIndex;
    useSceneStore.getState().updateWorldTransform([{ id: 1, position: { x: 10, y: 0 } }]);
    expect(useSceneStore.getState().historyIndex).toBe(before);
  });

  it('cascades parent rotation using the render angle convention', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 1, angle: 90 },
    ]);

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.localPosition?.x).toBe(5);
    expect(child.position.x).toBeCloseTo(10);
    expect(child.position.y).toBeCloseTo(-5);
    expect(child.angle).toBe(90);
  });

  it('syncs local cache after direct child world updates', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 2, position: { x: 25, y: 0 }, angle: 90 },
    ]);

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.position.x).toBe(25);
    expect(child.angle).toBe(90);
    expect(child.localPosition?.x).toBe(15);
    expect(child.localPosition?.angle).toBe(90);
  });

  it('preserves world transform and normalizes sibling order when reparenting', () => {
    useSceneStore.getState().loadScene(REPARENT_XML);
    useSceneStore.getState().setParentEntities([3], 1);

    const entities = useSceneStore.getState().scene.entities;
    const moved = entities.find(e => e.id === 3)!;
    const existing = entities.find(e => e.id === 2)!;

    expect(moved.editorParentEntity).toBe('parent');
    expect(moved.position.x).toBe(15);
    expect(moved.position.z).toBe(3);
    expect(moved.localPosition?.x).toBe(5);
    expect(existing.editorHierarchyOrder).toBe(0);
    expect(moved.editorHierarchyOrder).toBe(1);
  });

  it('moves only selected roots when the selection also contains descendants', () => {
    useSceneStore.getState().loadScene(MULTI_REPARENT_XML);
    const beforeHistory = useSceneStore.getState().historyIndex;

    useSceneStore.getState().setParentEntities(['parent', 'child'], 'target');

    const state = useSceneStore.getState();
    const parent = state.scene.entities.find(e => e.editorEntityUID === 'parent')!;
    const child = state.scene.entities.find(e => e.editorEntityUID === 'child')!;
    expect(parent.editorParentEntity).toBe('target');
    expect(child.editorParentEntity).toBe('parent');
    expect(parent.position).toEqual({ x: 10, y: 0, z: 1 });
    expect(child.position).toEqual({ x: 15, y: 0, z: 2 });
    expect(state.historyIndex).toBe(beforeHistory + 1);
  });

  it('reparents selected siblings together while preserving order and world transforms', () => {
    useSceneStore.getState().loadScene(MULTI_REPARENT_XML);
    const beforeHistory = useSceneStore.getState().historyIndex;

    useSceneStore.getState().setParentEntities(['sibling-a', 'sibling-b'], 'target');

    const state = useSceneStore.getState();
    const siblingA = state.scene.entities.find(e => e.editorEntityUID === 'sibling-a')!;
    const siblingB = state.scene.entities.find(e => e.editorEntityUID === 'sibling-b')!;
    expect(siblingA.editorParentEntity).toBe('target');
    expect(siblingB.editorParentEntity).toBe('target');
    expect(siblingA.editorHierarchyOrder).toBe(0);
    expect(siblingB.editorHierarchyOrder).toBe(1);
    expect(siblingA.position).toEqual({ x: 20, y: 5, z: 3 });
    expect(siblingB.position).toEqual({ x: 30, y: 5, z: 4 });
    expect(state.historyIndex).toBe(beforeHistory + 1);
  });

  it('rejects dropping selected roots onto one of their descendants', () => {
    const before = useSceneStore.getState();
    const beforeEntities = JSON.parse(JSON.stringify(before.scene.entities));

    before.setParentEntities(['parent', 'child'], 'grandchild');

    const after = useSceneStore.getState();
    expect(after.scene.entities).toEqual(beforeEntities);
    expect(after.historyIndex).toBe(before.historyIndex);
  });

  it('preserves world transform when reparenting under a rotated parent', () => {
    useSceneStore.getState().loadScene(REPARENT_XML);
    useSceneStore.getState().updateWorldTransform([{ id: 1, angle: 90 }]);
    useSceneStore.getState().setParentEntities([3], 1);

    const moved = useSceneStore.getState().scene.entities.find(e => e.id === 3)!;
    expect(moved.editorParentEntity).toBe('parent');
    expect(moved.position.x).toBe(15);
    expect(moved.position.y).toBe(0);
    expect(moved.localPosition?.x).toBeCloseTo(0);
    expect(moved.localPosition?.y).toBeCloseTo(5);
  });

  it('keeps descendant world patches authoritative during group rotate commits', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 1, angle: -90 },
      { id: 2, position: { x: 10, y: 5 }, angle: -90 },
    ]);

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.position.x).toBe(10);
    expect(child.position.y).toBe(5);
    expect(child.angle).toBe(270);
    expect(child.localPosition?.x).toBeCloseTo(5);
    expect(child.localPosition?.y).toBeCloseTo(0);
  });

  it('cascades parent Z updates automatically to children', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 1, position: { x: 10, y: 0, z: 50 } },
    ]);

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.localPosition?.z).toBe(2);
    expect(child.position.z).toBe(52);
  });

  it('updates child world Z when updating local Z', () => {
    useSceneStore.getState().updateWorldTransform([
      { id: 1, position: { x: 10, y: 0, z: 50 } },
    ]);
    useSceneStore.getState().updateLocalTransform(2, { z: 10 });

    const child = useSceneStore.getState().scene.entities.find(e => e.id === 2)!;
    expect(child.localPosition?.z).toBe(10);
    expect(child.position.z).toBe(60);
  });

  it('computes correct relative local Z when reparenting under a parent with non-zero Z', () => {
    useSceneStore.getState().loadScene(REPARENT_XML);
    useSceneStore.getState().updateWorldTransform([{ id: 1, position: { x: 10, y: 0, z: 20 } }]);
    useSceneStore.getState().setParentEntities([3], 1);

    const moved = useSceneStore.getState().scene.entities.find(e => e.id === 3)!;
    expect(moved.editorParentEntity).toBe('parent');
    expect(moved.position.z).toBe(3);
    expect(moved.localPosition?.z).toBe(-17); // 3 - 20 = -17
  });
});
