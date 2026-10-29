import { describe, expect, it } from 'vitest';
import type { EntityInstance } from '../../types';
import {
  buildCustomDataRefIndex,
  collectAffectedSubscriberUids,
  resolveCustomDataRefValue,
  syncEntitiesCustomDataRefs,
} from '../customDataRef';
import { cloneEntityTree } from '../prefabUtils';

function createEntity(overrides: Partial<EntityInstance> & { id: number; editorEntityUID: string }): EntityInstance {
  return {
    entityName: 'default.ent',
    editorEntityName: 'Default',
    position: { x: 0, y: 0, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
    ...overrides,
  };
}

describe('customDataRef index and synchronization', () => {
  it('builds reverse dependency index and resolves baseData (id, name) and customData values', () => {
    const source = createEntity({
      id: 42,
      editorEntityUID: 'uid-source',
      entityName: 'pillar.ent',
      customData: [
        { type: 'string', name: 'material', value: 'marble' },
        { type: 'vector2', name: 'offset', value: { x: 12, y: -8 } },
      ],
    });

    const subscriber = createEntity({
      id: 2,
      editorEntityUID: 'uid-sub',
      customData: [
        {
          type: 'string',
          name: 'targetName',
          value: 'old',
          refEditorUID: 'uid-source',
          refType: 'baseData',
          refValue: 'name',
        },
        {
          type: 'int',
          name: 'targetId',
          value: '0',
          refEditorUID: 'uid-source',
          refType: 'baseData',
          refValue: 'id',
        },
        {
          type: 'string',
          name: 'copiedMat',
          value: 'wood',
          refEditorUID: 'uid-source',
          refType: 'customData',
          refValue: 'material',
        },
        {
          type: 'vector2',
          name: 'copiedOffset',
          value: { x: 0, y: 0 },
          refEditorUID: 'uid-source',
          refType: 'customData',
          refValue: 'offset',
        },
      ],
    });

    const entities = [source, subscriber];
    const index = buildCustomDataRefIndex(entities);

    expect(index.dependentsByTargetUid.get('uid-source')?.has('uid-sub')).toBe(true);
    expect([...collectAffectedSubscriberUids(entities, ['uid-source'])]).toEqual(['uid-sub']);

    const synced = syncEntitiesCustomDataRefs(entities);
    const updatedSub = synced.find(e => e.editorEntityUID === 'uid-sub')!;

    expect(updatedSub.customData[0].value).toBe('pillar.ent');
    expect(updatedSub.customData[1].value).toBe('42');
    expect(updatedSub.customData[2].value).toBe('marble');
    expect(updatedSub.customData[3].value).toEqual({ x: 12, y: -8 });
  });

  it('prevents chained references and keeps last known value when target entity or variable is missing', () => {
    const entityA = createEntity({
      id: 1,
      editorEntityUID: 'uid-a',
      customData: [
        { type: 'string', name: 'mat', value: 'gold' },
      ],
    });

    const entityB = createEntity({
      id: 2,
      editorEntityUID: 'uid-b',
      customData: [
        {
          type: 'string',
          name: 'matRef',
          value: 'gold',
          refEditorUID: 'uid-a',
          refType: 'customData',
          refValue: 'mat',
        },
      ],
    });

    const entityC = createEntity({
      id: 3,
      editorEntityUID: 'uid-c',
      customData: [
        {
          type: 'string',
          name: 'chainedRef',
          value: 'fallback-val',
          refEditorUID: 'uid-b',
          refType: 'customData',
          refValue: 'matRef',
        },
        {
          type: 'string',
          name: 'missingEntityRef',
          value: 'kept-val',
          refEditorUID: 'uid-deleted',
          refType: 'customData',
          refValue: 'mat',
        },
      ],
    });

    const entities = [entityA, entityB, entityC];
    const index = buildCustomDataRefIndex(entities);

    const chainedResult = resolveCustomDataRefValue(entityC.customData[0], index, 'uid-c');
    expect(chainedResult.status).toBe('broken');
    expect(chainedResult.value).toBe('fallback-val');

    const missingResult = resolveCustomDataRefValue(entityC.customData[1], index, 'uid-c');
    expect(missingResult.status).toBe('broken');
    expect(missingResult.value).toBe('kept-val');

    const synced = syncEntitiesCustomDataRefs(entities);
    expect(synced[2].customData[0].value).toBe('fallback-val');
    expect(synced[2].customData[1].value).toBe('kept-val');
  });

  it('rejects incompatible types for baseData and customData references with status broken', () => {
    const target = createEntity({
      id: 99,
      editorEntityUID: 'uid-target',
      entityName: 'torch.ent',
      customData: [
        { type: 'int', name: 'fuel', value: '100' },
        { type: 'vector2', name: 'sparkOffset', value: { x: 5, y: 10 } },
      ],
    });

    const subscriber = createEntity({
      id: 100,
      editorEntityUID: 'uid-sub',
      customData: [
        // Incompatible 1: vector2 referencing baseData "name" (which is a string)
        {
          type: 'vector2',
          name: 'invalidVectorNameRef',
          value: { x: 0, y: 0 },
          refEditorUID: 'uid-target',
          refType: 'baseData',
          refValue: 'name',
        },
        // Incompatible 2: vector2 referencing baseData "id" (which is int)
        {
          type: 'vector2',
          name: 'invalidVectorIdRef',
          value: { x: 0, y: 0 },
          refEditorUID: 'uid-target',
          refType: 'baseData',
          refValue: 'id',
        },
        // Incompatible 3: int referencing baseData "name" (which is string)
        {
          type: 'int',
          name: 'invalidIntNameRef',
          value: '0',
          refEditorUID: 'uid-target',
          refType: 'baseData',
          refValue: 'name',
        },
        // Incompatible 4: vector2 referencing scalar customData (fuel: int)
        {
          type: 'vector2',
          name: 'invalidVectorToScalarRef',
          value: { x: 0, y: 0 },
          refEditorUID: 'uid-target',
          refType: 'customData',
          refValue: 'fuel',
        },
        // Incompatible 5: int referencing vector customData (sparkOffset: vector2)
        {
          type: 'int',
          name: 'invalidIntToVectorRef',
          value: '0',
          refEditorUID: 'uid-target',
          refType: 'customData',
          refValue: 'sparkOffset',
        },
      ],
    });

    const index = buildCustomDataRefIndex([target, subscriber]);

    const res1 = resolveCustomDataRefValue(subscriber.customData[0], index, 'uid-sub');
    expect(res1.status).toBe('broken');
    expect(res1.reason).toContain('not compatible');

    const res2 = resolveCustomDataRefValue(subscriber.customData[1], index, 'uid-sub');
    expect(res2.status).toBe('broken');
    expect(res2.reason).toContain('not compatible');

    const res3 = resolveCustomDataRefValue(subscriber.customData[2], index, 'uid-sub');
    expect(res3.status).toBe('broken');
    expect(res3.reason).toContain('not compatible');

    const res4 = resolveCustomDataRefValue(subscriber.customData[3], index, 'uid-sub');
    expect(res4.status).toBe('broken');
    expect(res4.reason).toContain('Cannot reference scalar variable');

    const res5 = resolveCustomDataRefValue(subscriber.customData[4], index, 'uid-sub');
    expect(res5.status).toBe('broken');
    expect(res5.reason).toContain('Cannot reference vector variable');
  });

  it('syncs intra-tree references after cloneEntityTree so values reflect newly assigned target IDs', () => {
    const button = createEntity({
      id: 10,
      editorEntityUID: 'btn-1',
      entityName: 'button.ent',
    });

    const door = createEntity({
      id: 11,
      editorEntityUID: 'door-1',
      entityName: 'door.ent',
      customData: [
        {
          type: 'int',
          name: 'targetButtonId',
          value: '10',
          refEditorUID: 'btn-1',
          refType: 'baseData',
          refValue: 'id',
        },
      ],
    });

    const cloned = cloneEntityTree([button, door], [button, door]);

    // Check newly cloned entities
    const clonedDoor = cloned.newClonedEntities.find(e => e.entityName === 'door.ent')!;
    const clonedButton = cloned.newClonedEntities.find(e => e.entityName === 'button.ent')!;

    expect(clonedButton.id).not.toBe(10);
    expect(clonedDoor.id).not.toBe(11);
    expect(clonedDoor.customData[0].refEditorUID).toBe(clonedButton.editorEntityUID);
    // Value must be synced to the newly created button's ID, NOT stale "10"
    expect(clonedDoor.customData[0].value).toBe(String(clonedButton.id));
  });
});

