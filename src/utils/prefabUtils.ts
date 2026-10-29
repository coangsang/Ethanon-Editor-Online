import type { EntityInstance } from '../types';
import { cascadeWorldTransforms, normalizeHierarchy } from './sceneHierarchy';
import { syncEntitiesCustomDataRefs } from './customDataRef';

export interface CloneEntityTreeOptions {
  positionOffset?: { x: number; y: number };
  overrideRootPosition?: { x: number; y: number };
}

export interface CloneEntityTreeResult {
  combinedEntities: EntityInstance[];
  newRootUids: string[];
  newClonedEntities: EntityInstance[];
}

export function cloneEntityTree(
  entitiesToClone: EntityInstance[],
  existingEntities: EntityInstance[],
  options?: CloneEntityTreeOptions,
): CloneEntityTreeResult {
  if (entitiesToClone.length === 0) {
    return { combinedEntities: existingEntities, newRootUids: [], newClonedEntities: [] };
  }

  const maxExistingId = existingEntities.length > 0
    ? Math.max(...existingEntities.map(e => e.id))
    : -1;

  // 1. Build UID remapping map
  const uidMap = new Map<string, string>();
  entitiesToClone.forEach(e => {
    uidMap.set(e.editorEntityUID, crypto.randomUUID());
  });

  const clonedUidSet = new Set(entitiesToClone.map(e => e.editorEntityUID));
  const existingUidSet = new Set(existingEntities.map(e => e.editorEntityUID));

  const newEntities: EntityInstance[] = [];
  const newRootUids: string[] = [];

  entitiesToClone.forEach((e, idx) => {
    const newId = maxExistingId + 1 + idx;
    const newUid = uidMap.get(e.editorEntityUID)!;
    const isClonedRoot = !e.editorParentEntity || !clonedUidSet.has(e.editorParentEntity);

    let editorParentEntity: string | undefined;
    let localPosition: { x: number; y: number; z: number; angle: number } | undefined;
    let position: { x: number; y: number; z: number };

    if (isClonedRoot) {
      newRootUids.push(newUid);
      if (options?.overrideRootPosition) {
        editorParentEntity = undefined;
        localPosition = undefined;
        position = {
          x: options.overrideRootPosition.x,
          y: options.overrideRootPosition.y,
          z: e.position.z ?? 0,
        };
      } else {
        editorParentEntity = (e.editorParentEntity && existingUidSet.has(e.editorParentEntity))
          ? e.editorParentEntity
          : undefined;

        const offsetX = options?.positionOffset?.x ?? 0;
        const offsetY = options?.positionOffset?.y ?? 0;
        position = {
          x: (e.position?.x ?? 0) + offsetX,
          y: (e.position?.y ?? 0) + offsetY,
          z: e.position.z ?? 0,
        };

        if (e.localPosition) {
          localPosition = {
            ...e.localPosition,
            x: e.localPosition.x + offsetX,
            y: e.localPosition.y + offsetY,
          };
        } else {
          localPosition = undefined;
        }
      }
    } else {
      const newParentUid = uidMap.get(e.editorParentEntity!);
      editorParentEntity = newParentUid;
      localPosition = e.localPosition ? { ...e.localPosition } : undefined;
      position = { ...e.position };
    }

    const remappedCustomData = (e.customData ?? []).map(v => {
      if (v.refEditorUID && uidMap.has(v.refEditorUID)) {
        return {
          ...v,
          refEditorUID: uidMap.get(v.refEditorUID),
        };
      }
      return { ...v };
    });

    const clonedEntity: EntityInstance = {
      ...JSON.parse(JSON.stringify(e)),
      id: newId,
      editorEntityUID: newUid,
      editorParentEntity,
      localPosition,
      position,
      customData: remappedCustomData,
    };
    newEntities.push(clonedEntity);
  });

  let combined = [...existingEntities, ...newEntities];
  const newEntityIds = new Set(newEntities.map(e => e.id));
  combined = cascadeWorldTransforms(combined, newEntityIds);
  combined = normalizeHierarchy(combined);

  const newEntityUids = new Set(newEntities.map(e => e.editorEntityUID));
  combined = syncEntitiesCustomDataRefs(combined, newEntityUids);
  const syncedNewEntities = combined.filter(e => newEntityUids.has(e.editorEntityUID));

  return { combinedEntities: combined, newRootUids, newClonedEntities: syncedNewEntities };
}

export function instantiatePrefab(
  prefabEntities: EntityInstance[],
  placePosition: { x: number; y: number },
  existingEntities: EntityInstance[],
): EntityInstance[] {
  const result = cloneEntityTree(prefabEntities, existingEntities, {
    overrideRootPosition: placePosition,
  });
  return result.combinedEntities;
}
