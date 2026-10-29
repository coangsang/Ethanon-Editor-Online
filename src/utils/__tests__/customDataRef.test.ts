import { describe, expect, it } from 'vitest';
import type { EntityInstance } from '../../types';
import {
  buildCustomDataRefIndex,
  collectAffectedSubscriberUids,
  resolveCustomDataRefValue,
  syncEntitiesCustomDataRefs,
} from '../customDataRef';

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
});

