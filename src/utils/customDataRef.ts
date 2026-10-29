import type { CustomDataRefType, CustomDataValue, CustomDataVariable, CustomDataVectorValue, EntityInstance } from '../types';

export interface CustomDataRefIndex {
  byUid: Map<string, EntityInstance>;
  dependentsByTargetUid: Map<string, Set<string>>;
  subscribersWithRefs: Set<string>;
}

const refIndexCache = new WeakMap<EntityInstance[], CustomDataRefIndex>();

export function isVariableRef(variable: CustomDataVariable): boolean {
  return Boolean(variable.refEditorUID && variable.refEditorUID.trim().length > 0);
}

function isVectorValue(value: CustomDataValue): value is CustomDataVectorValue {
  return typeof value === 'object' && value !== null;
}

function cloneCustomDataValue(value: CustomDataValue): CustomDataValue {
  if (isVectorValue(value)) {
    return {
      x: value.x,
      y: value.y,
      ...(value.z !== undefined ? { z: value.z } : {}),
    };
  }
  return String(value ?? '');
}

function isSameCustomDataValue(a: CustomDataValue, b: CustomDataValue): boolean {
  if (isVectorValue(a) && isVectorValue(b)) {
    return a.x === b.x && a.y === b.y && (a.z ?? undefined) === (b.z ?? undefined);
  }
  if (!isVectorValue(a) && !isVectorValue(b)) {
    return a === b;
  }
  return false;
}

export function buildCustomDataRefIndex(entities: EntityInstance[]): CustomDataRefIndex {
  const cached = refIndexCache.get(entities);
  if (cached) return cached;

  const byUid = new Map<string, EntityInstance>();
  const dependentsByTargetUid = new Map<string, Set<string>>();
  const subscribersWithRefs = new Set<string>();

  for (const entity of entities) {
    byUid.set(entity.editorEntityUID, entity);
    if (!entity.customData || entity.customData.length === 0) continue;

    for (const variable of entity.customData) {
      const targetUid = variable.refEditorUID?.trim();
      if (!targetUid) continue;
      subscribersWithRefs.add(entity.editorEntityUID);

      let dependents = dependentsByTargetUid.get(targetUid);
      if (!dependents) {
        dependents = new Set<string>();
        dependentsByTargetUid.set(targetUid, dependents);
      }
      dependents.add(entity.editorEntityUID);
    }
  }

  const index: CustomDataRefIndex = {
    byUid,
    dependentsByTargetUid,
    subscribersWithRefs,
  };
  refIndexCache.set(entities, index);
  return index;
}

export function isBaseDataFieldCompatibleWithType(field: string, variableType: string): boolean {
  if (field === 'id') {
    return variableType === 'int' || variableType === 'uint' || variableType === 'float' || variableType === 'string';
  }
  if (field === 'name') {
    return variableType === 'string';
  }
  return false;
}

export function coerceScalarToVariableType(rawScalar: string | number, variableType: string): CustomDataValue {
  if (variableType === 'vector2') {
    return { x: 0, y: 0 };
  }
  if (variableType === 'vector3') {
    return { x: 0, y: 0, z: 0 };
  }
  if (variableType === 'int') {
    const parsed = Math.round(Number(rawScalar) || 0);
    return String(parsed);
  }
  if (variableType === 'uint') {
    const parsed = Math.max(0, Math.round(Number(rawScalar) || 0));
    return String(parsed);
  }
  if (variableType === 'float') {
    const parsed = Number(rawScalar);
    return String(Number.isFinite(parsed) ? parsed : 0);
  }
  return String(rawScalar ?? '');
}

export interface ResolvedCustomDataRef {
  status: 'ok' | 'broken';
  value: CustomDataValue;
  sourceType?: string;
  reason?: string;
}

export function resolveCustomDataRefValue(
  variable: CustomDataVariable,
  index: CustomDataRefIndex,
  ownerUid?: string,
): ResolvedCustomDataRef {
  const targetUid = variable.refEditorUID?.trim();
  const refType: CustomDataRefType | undefined = variable.refType;
  const refValue = variable.refValue?.trim() ?? '';

  if (!targetUid || !refType || !refValue) {
    return {
      status: 'broken',
      value: cloneCustomDataValue(variable.value),
      reason: 'Incomplete reference configuration',
    };
  }

  if (ownerUid && targetUid === ownerUid) {
    return {
      status: 'broken',
      value: cloneCustomDataValue(variable.value),
      reason: 'Self-reference is not allowed',
    };
  }

  const targetEntity = index.byUid.get(targetUid);
  if (!targetEntity) {
    return {
      status: 'broken',
      value: cloneCustomDataValue(variable.value),
      reason: `Referenced entity "${targetUid}" not found`,
    };
  }

  if (refType === 'baseData') {
    if (refValue === 'id') {
      return {
        status: 'ok',
        value: coerceScalarToVariableType(targetEntity.id, variable.type),
        sourceType: 'int',
      };
    }
    if (refValue === 'name') {
      return {
        status: 'ok',
        value: String(targetEntity.entityName ?? ''),
        sourceType: 'string',
      };
    }
    return {
      status: 'broken',
      value: cloneCustomDataValue(variable.value),
      reason: `Unknown baseData field "${refValue}"`,
    };
  }

  if (refType === 'customData') {
    const targetVar = (targetEntity.customData ?? []).find(v => v.name === refValue);
    if (!targetVar) {
      return {
        status: 'broken',
        value: cloneCustomDataValue(variable.value),
        reason: `Variable "${refValue}" not found on target entity`,
      };
    }

    if (isVariableRef(targetVar)) {
      return {
        status: 'broken',
        value: cloneCustomDataValue(variable.value),
        reason: `Variable "${refValue}" on target entity is itself a reference`,
      };
    }

    if (variable.type === 'vector2' || variable.type === 'vector3') {
      if (isVectorValue(targetVar.value)) {
        return {
          status: 'ok',
          value: {
            x: targetVar.value.x,
            y: targetVar.value.y,
            ...(variable.type === 'vector3' ? { z: targetVar.value.z ?? 0 } : {}),
          },
          sourceType: targetVar.type,
        };
      }
      return {
        status: 'ok',
        value: coerceScalarToVariableType(String(targetVar.value ?? ''), variable.type),
        sourceType: targetVar.type,
      };
    }

    if (isVectorValue(targetVar.value)) {
      const textVal = targetVar.value.z === undefined
        ? `${targetVar.value.x}, ${targetVar.value.y}`
        : `${targetVar.value.x}, ${targetVar.value.y}, ${targetVar.value.z}`;
      return {
        status: 'ok',
        value: coerceScalarToVariableType(textVal, variable.type),
        sourceType: targetVar.type,
      };
    }

    return {
      status: 'ok',
      value: coerceScalarToVariableType(targetVar.value, variable.type),
      sourceType: targetVar.type,
    };
  }

  return {
    status: 'broken',
    value: cloneCustomDataValue(variable.value),
    reason: `Unsupported refType "${String(refType)}"`,
  };
}

export function collectAffectedSubscriberUids(
  entities: EntityInstance[],
  modifiedSourceUids: Iterable<string>,
): Set<string> {
  const index = buildCustomDataRefIndex(entities);
  const affected = new Set<string>();

  for (const sourceUid of modifiedSourceUids) {
    if (index.subscribersWithRefs.has(sourceUid)) {
      affected.add(sourceUid);
    }
    const dependents = index.dependentsByTargetUid.get(sourceUid);
    if (!dependents) continue;
    for (const subUid of dependents) {
      affected.add(subUid);
    }
  }

  return affected;
}

export function syncEntitiesCustomDataRefs(
  entities: EntityInstance[],
  targetSubscriberUids?: Iterable<string>,
): EntityInstance[] {
  const index = buildCustomDataRefIndex(entities);
  if (index.subscribersWithRefs.size === 0) return entities;

  const targetSet = targetSubscriberUids
    ? new Set(targetSubscriberUids)
    : index.subscribersWithRefs;

  if (targetSet.size === 0) return entities;

  let anyEntityChanged = false;
  const nextEntities = entities.map(entity => {
    if (!targetSet.has(entity.editorEntityUID)) return entity;
    if (!entity.customData || entity.customData.length === 0) return entity;

    let entityChanged = false;
    const nextCustomData = entity.customData.map(variable => {
      if (!isVariableRef(variable)) return variable;
      const resolved = resolveCustomDataRefValue(variable, index, entity.editorEntityUID);
      if (resolved.status !== 'ok') return variable;
      if (isSameCustomDataValue(variable.value, resolved.value)) return variable;

      entityChanged = true;
      return {
        ...variable,
        value: resolved.value,
      };
    });

    if (!entityChanged) return entity;
    anyEntityChanged = true;
    return {
      ...entity,
      customData: nextCustomData,
    };
  });

  return anyEntityChanged ? nextEntities : entities;
}

