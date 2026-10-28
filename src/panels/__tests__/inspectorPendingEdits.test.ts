import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';

describe('Inspector pending edits', () => {
  afterEach(() => vi.useRealTimers());

  function loadTwoEntities() {
    useSceneStore.getState().loadScene(`
      <Ethanon><SceneProperties><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
      <EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="entity-a"><EntityName>before-a</EntityName><Position x="0" y="0" z="0" angle="0" /></Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="entity-b"><EntityName>before-b</EntityName><Position x="10" y="0" z="0" angle="0" /></Entity>
      </EntitiesInScene>
      </Ethanon>
    `);
  }

  it('commits A before selection changes and never applies it to B', () => {
    vi.useFakeTimers();
    loadTwoEntities();
    const store = useSceneStore.getState();
    store.queueInspectorEdit('entity-a', 'identity', entity => ({ ...entity, editorEntityName: 'A editor', entityName: 'A entity' }));
    store.selectEntity('entity-b');
    vi.runAllTimers();

    const [a, b] = useSceneStore.getState().scene.entities;
    expect(a.editorEntityName).toBe('A editor');
    expect(a.entityName).toBe('A entity');
    expect(b.entityName).toBe('before-b');
  });

  it('keeps queued edits for two entities separate', () => {
    vi.useFakeTimers();
    loadTwoEntities();
    const store = useSceneStore.getState();
    store.queueInspectorEdit('entity-a', 'identity', entity => ({ ...entity, entityName: 'after-a' }));
    store.selectEntity('entity-b');
    store.queueInspectorEdit('entity-b', 'identity', entity => ({ ...entity, entityName: 'after-b' }));
    vi.advanceTimersByTime(250);

    expect(useSceneStore.getState().scene.entities.map(entity => entity.entityName)).toEqual(['after-a', 'after-b']);
  });

  it('creates one history entry and flushes before undo', () => {
    loadTwoEntities();
    const store = useSceneStore.getState();
    const historyLength = store.history.length;
    store.queueInspectorEdit('entity-a', 'identity', entity => ({ ...entity, entityName: 'after' }));
    store.queueInspectorEdit('entity-a', 'spriteFlags', entity => ({ ...entity, hide: true }));
    store.flushInspectorEdits();
    expect(useSceneStore.getState().history).toHaveLength(historyLength + 1);

    useSceneStore.getState().undo();
    expect(useSceneStore.getState().scene.entities[0].entityName).toBe('before-a');
    expect(useSceneStore.getState().scene.entities[0].hide).toBe(false);
  });

  it('applies nested mutations against the entity produced by the previous group', () => {
    loadTwoEntities();
    const store = useSceneStore.getState();
    store.queueInspectorEdit('entity-a', 'scale', entity => ({
      ...entity,
      inlineTemplate: { ...(entity.inlineTemplate ?? { name: entity.entityName }), scale: { x: 2, y: 3 } },
      inlineEntityData: { ...(entity.inlineEntityData ?? {}), Scale: { x: 2, y: 3 } },
    }));
    store.queueInspectorEdit('entity-a', 'material', entity => ({
      ...entity,
      inlineTemplate: { ...(entity.inlineTemplate ?? { name: entity.entityName }), blendMode: 4 },
      inlineEntityData: { ...(entity.inlineEntityData ?? {}), blendMode: 4 },
    }));
    store.flushInspectorEdits();

    const entity = useSceneStore.getState().scene.entities[0];
    expect(entity.inlineTemplate?.scale).toEqual({ x: 2, y: 3 });
    expect(entity.inlineTemplate?.blendMode).toBe(4);
    expect(entity.inlineEntityData?.Scale).toEqual({ x: 2, y: 3 });
  });

  it('commits a child local transform before selection changes', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon><SceneProperties><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
      <EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="parent"><EntityName>parent</EntityName><Position x="10" y="0" z="0" angle="0" /></Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="child-a" editorParentEntity="parent"><EntityName>child-a</EntityName><Position x="15" y="0" z="0" angle="0" /></Entity>
        <Entity id="3" spriteFrame="0" editorEntityUID="child-b" editorParentEntity="parent"><EntityName>child-b</EntityName><Position x="20" y="0" z="0" angle="0" /></Entity>
      </EntitiesInScene>
      </Ethanon>
    `);
    const store = useSceneStore.getState();
    store.queueInspectorEdit('child-a', 'transform', entity => ({
      ...entity,
      localPosition: { x: 8, y: 0, z: 0, angle: 45 },
    }));
    store.selectEntity('child-b');

    const [parent, childA, childB] = useSceneStore.getState().scene.entities;
    expect(parent.position.x).toBe(10);
    expect(childA.localPosition).toMatchObject({ x: 8, angle: 45 });
    expect(childA.position.x).toBe(18);
    expect(childA.angle).toBe(45);
    expect(childB.position.x).toBe(20);
  });
});
