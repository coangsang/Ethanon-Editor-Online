import type { EntityInstance } from '../types';
import { computeLocalFromWorld, computeWorldFromLocal } from './transformMath';

export type LocalTransformPatch = Partial<{ x: number; y: number; z: number; angle: number }>;

export type WorldTransformPatch = {
  uid?: string;
  id?: number;
  position?: Partial<EntityInstance['position']>;
  angle?: number;
};

export type HierarchyIndex = {
  byId: Map<number, EntityInstance>;
  byUid: Map<string, EntityInstance>;
  childrenByParentUid: Map<string, EntityInstance[]>;
};

const ROOT_GROUP = '__root__';

function transformOf(entity: EntityInstance) {
  return { x: entity.position.x, y: entity.position.y, angle: entity.angle };
}

function localFromWorld(parent: EntityInstance, child: EntityInstance) {
  const local = computeLocalFromWorld(transformOf(parent), transformOf(child));
  return {
    x: local.x,
    y: local.y,
    z: (child.position.z ?? 0) - (parent.position.z ?? 0),
    angle: local.angle,
  };
}

export function buildHierarchyIndex(entities: EntityInstance[]): HierarchyIndex {
  const byId = new Map<number, EntityInstance>();
  const byUid = new Map<string, EntityInstance>();
  const childrenByParentUid = new Map<string, EntityInstance[]>();

  for (const entity of entities) {
    byId.set(entity.id, entity);
    byUid.set(entity.editorEntityUID, entity);
  }

  for (const entity of entities) {
    const parentUid = entity.editorParentEntity;
    if (!parentUid) continue;
    const children = childrenByParentUid.get(parentUid) ?? [];
    children.push(entity);
    childrenByParentUid.set(parentUid, children);
  }

  return { byId, byUid, childrenByParentUid };
}

export function findEntityInIndex(index: HierarchyIndex, key: string | number): EntityInstance | undefined {
  if (typeof key === 'string') {
    const ent = index.byUid.get(key);
    if (ent) return ent;
  }
  if (typeof key === 'number') {
    const ent = index.byId.get(key);
    if (ent) return ent;
  }
  const num = Number(key);
  if (!Number.isNaN(num)) {
    const ent = index.byId.get(num);
    if (ent) return ent;
  }
  return undefined;
}

export function getAllDescendantUIDs(entities: EntityInstance[], rootUidsOrIds: Set<string | number>): Set<string> {
  const index = buildHierarchyIndex(entities);
  const result = new Set<string>();
  const queue: Array<string | number> = [...rootUidsOrIds];

  for (const item of rootUidsOrIds) {
    const ent = findEntityInIndex(index, item);
    if (ent) result.add(ent.editorEntityUID);
  }

  while (queue.length > 0) {
    const key = queue.shift()!;
    const entity = findEntityInIndex(index, key);
    if (!entity) continue;

    const children = index.childrenByParentUid.get(entity.editorEntityUID) ?? [];
    for (const child of children) {
      if (result.has(child.editorEntityUID)) continue;
      result.add(child.editorEntityUID);
      queue.push(child.editorEntityUID);
    }
  }

  return result;
}

export function getAllDescendantIds(entities: EntityInstance[], rootIds: Set<number>): Set<number> {
  const index = buildHierarchyIndex(entities);
  const descendantUids = getAllDescendantUIDs(entities, rootIds);
  const descendantIds = new Set<number>();
  for (const uid of descendantUids) {
    const ent = index.byUid.get(uid);
    if (ent) descendantIds.add(ent.id);
  }
  return descendantIds;
}

function parentChainHasCycle(entity: EntityInstance, byUid: Map<string, EntityInstance>): boolean {
  const seen = new Set<string>([entity.editorEntityUID]);
  let parentUid = entity.editorParentEntity;

  while (parentUid) {
    if (seen.has(parentUid)) return true;
    seen.add(parentUid);

    const parent = byUid.get(parentUid);
    if (!parent) return false;
    parentUid = parent.editorParentEntity;
  }

  return false;
}

function normalizeHierarchyOrder(entities: EntityInstance[]): EntityInstance[] {
  const groups = new Map<string, Array<{ entity: EntityInstance; index: number }>>();

  entities.forEach((entity, index) => {
    const groupKey = entity.editorParentEntity ?? ROOT_GROUP;
    const group = groups.get(groupKey) ?? [];
    group.push({ entity, index });
    groups.set(groupKey, group);
  });

  const orderByUid = new Map<string, number>();
  for (const group of groups.values()) {
    group
      .sort((a, b) => {
        const orderA = Number.isFinite(a.entity.editorHierarchyOrder) ? a.entity.editorHierarchyOrder! : 0;
        const orderB = Number.isFinite(b.entity.editorHierarchyOrder) ? b.entity.editorHierarchyOrder! : 0;
        return orderA - orderB || a.index - b.index;
      })
      .forEach(({ entity }, order) => {
        orderByUid.set(entity.editorEntityUID, order);
      });
  }

  let changed = false;
  const normalized = entities.map(entity => {
    const order = orderByUid.get(entity.editorEntityUID) ?? 0;
    if (entity.editorHierarchyOrder === order) return entity;
    changed = true;
    return { ...entity, editorHierarchyOrder: order };
  });

  return changed ? normalized : entities;
}

export function normalizeHierarchy(entities: EntityInstance[]): EntityInstance[] {
  const normalized = entities.map(entity => ({ ...entity }));
  let changed = false;

  for (let i = 0; i < normalized.length; i++) {
    const entity = normalized[i];
    const parentUid = entity.editorParentEntity;

    if (!parentUid) {
      if (entity.localPosition) {
        const next = { ...entity };
        delete next.localPosition;
        normalized[i] = next;
        changed = true;
      }
      continue;
    }

    const byUid = buildHierarchyIndex(normalized).byUid;
    const parent = byUid.get(parentUid);
    if (!parent || parentChainHasCycle(entity, byUid)) {
      const next = { ...entity };
      delete next.editorParentEntity;
      delete next.localPosition;
      normalized[i] = next;
      changed = true;
      continue;
    }

    const derivedLocal = localFromWorld(parent, entity);
    if (
      entity.localPosition?.x === derivedLocal.x &&
      entity.localPosition?.y === derivedLocal.y &&
      entity.localPosition?.z === derivedLocal.z &&
      entity.localPosition?.angle === derivedLocal.angle
    ) {
      continue;
    }

    normalized[i] = { ...entity, localPosition: derivedLocal };
    changed = true;
  }

  const ordered = normalizeHierarchyOrder(normalized);
  return changed || ordered !== normalized ? ordered : entities;
}

export function cascadeWorldTransforms(
  entities: EntityInstance[],
  initialUpdatedKeys: Set<string | number>,
): EntityInstance[] {
  let currentEntities = [...entities];
  const updatedUids = new Set<string>();
  const queue: Array<string | number> = [...initialUpdatedKeys];

  const initialIndex = buildHierarchyIndex(currentEntities);
  for (const k of initialUpdatedKeys) {
    const ent = findEntityInIndex(initialIndex, k);
    if (ent) updatedUids.add(ent.editorEntityUID);
  }

  let changed = false;

  while (queue.length > 0) {
    const parentKey = queue.shift()!;
    const index = buildHierarchyIndex(currentEntities);
    const parent = findEntityInIndex(index, parentKey);
    if (!parent) continue;

    const children = index.childrenByParentUid.get(parent.editorEntityUID) ?? [];
    for (const child of children) {
      if (!child.localPosition) continue;
      const world = computeWorldFromLocal(transformOf(parent), {
        x: child.localPosition.x,
        y: child.localPosition.y,
        angle: child.localPosition.angle,
      });

      const worldZ = (parent.position.z ?? 0) + (child.localPosition.z ?? 0);

      if (
        child.position.x === world.x &&
        child.position.y === world.y &&
        child.position.z === worldZ &&
        child.angle === world.angle
      ) {
        continue;
      }

      currentEntities = currentEntities.map(entity => entity.editorEntityUID === child.editorEntityUID
        ? {
            ...entity,
            position: { ...entity.position, x: world.x, y: world.y, z: worldZ },
            angle: world.angle,
          }
        : entity
      );
      changed = true;

      if (!updatedUids.has(child.editorEntityUID)) {
        updatedUids.add(child.editorEntityUID);
        queue.push(child.editorEntityUID);
      }
    }
  }

  return changed ? currentEntities : entities;
}

export function syncLocalPositions(
  entities: EntityInstance[],
  updatedKeys: Set<string | number>,
): EntityInstance[] {
  const index = buildHierarchyIndex(entities);
  const updatedUids = new Set<string>();
  for (const k of updatedKeys) {
    const ent = findEntityInIndex(index, k);
    if (ent) updatedUids.add(ent.editorEntityUID);
  }

  let changed = false;

  const synced = entities.map(entity => {
    if (!updatedUids.has(entity.editorEntityUID) || !entity.editorParentEntity) return entity;

    const parent = index.byUid.get(entity.editorParentEntity);
    if (!parent) return entity;

    const localPosition = localFromWorld(parent, entity);
    if (
      entity.localPosition?.x === localPosition.x &&
      entity.localPosition?.y === localPosition.y &&
      entity.localPosition?.z === localPosition.z &&
      entity.localPosition?.angle === localPosition.angle
    ) {
      return entity;
    }

    changed = true;
    return { ...entity, localPosition };
  });

  return changed ? synced : entities;
}

export function applyWorldTransformPatches(
  entities: EntityInstance[],
  patches: WorldTransformPatch[],
  preservePatchedTransforms = false,
): EntityInstance[] {
  const index = buildHierarchyIndex(entities);
  const patchMap = new Map<string, WorldTransformPatch>();

  for (const patch of patches) {
    const key = patch.uid ?? patch.id;
    if (key !== undefined) {
      const ent = findEntityInIndex(index, key);
      if (ent) {
        patchMap.set(ent.editorEntityUID, patch);
      }
    }
  }

  if (patchMap.size === 0) return entities;

  const byUid = new Map(index.byUid);
  let changed = false;

  for (const [uid, patch] of patchMap) {
    const entity = byUid.get(uid);
    if (!entity) continue;
    const position = patch.position ? { ...entity.position, ...patch.position } : entity.position;
    const angle = patch.angle !== undefined ? patch.angle : entity.angle;
    if (
      position.x === entity.position.x && position.y === entity.position.y &&
      position.z === entity.position.z && angle === entity.angle
    ) continue;
    byUid.set(uid, { ...entity, position, angle });
    changed = true;
  }
  if (!changed) return entities;

  // Sync all explicitly patched children against their final patched parent transforms.
  for (const uid of patchMap.keys()) {
    const entity = byUid.get(uid);
    if (!entity?.editorParentEntity) continue;
    const parent = byUid.get(entity.editorParentEntity);
    if (!parent) continue;
    if (preservePatchedTransforms && patchMap.has(parent.editorEntityUID) && entity.localPosition) continue;
    const localPosition = localFromWorld(parent, entity);
    if (
      entity.localPosition?.x === localPosition.x &&
      entity.localPosition?.y === localPosition.y &&
      entity.localPosition?.z === localPosition.z &&
      entity.localPosition?.angle === localPosition.angle
    ) continue;
    byUid.set(uid, { ...entity, localPosition });
  }

  // Patched descendants already have authoritative world transforms. Only cascade to
  // unpatched descendants, using the single hierarchy index built above.
  const queue = [...patchMap.keys()];
  const queued = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const parentUid = queue[cursor];
    const parent = byUid.get(parentUid);
    if (!parent) continue;
    const children = index.childrenByParentUid.get(parentUid) ?? [];
    for (const originalChild of children) {
      const childUid = originalChild.editorEntityUID;
      if (preservePatchedTransforms && patchMap.has(childUid)) continue;
      const child = byUid.get(childUid);
      if (!child?.localPosition) continue;

      const world = computeWorldFromLocal(transformOf(parent), {
        x: child.localPosition.x,
        y: child.localPosition.y,
        angle: child.localPosition.angle,
      });
      const worldZ = (parent.position.z ?? 0) + (child.localPosition.z ?? 0);
      if (
        child.position.x === world.x && child.position.y === world.y &&
        child.position.z === worldZ && child.angle === world.angle
      ) continue;

      byUid.set(childUid, {
        ...child,
        position: { ...child.position, x: world.x, y: world.y, z: worldZ },
        angle: world.angle,
      });
      changed = true;
      if (!queued.has(childUid)) {
        queued.add(childUid);
        queue.push(childUid);
      }
    }
  }

  if (!changed) return entities;
  return entities.map(entity => byUid.get(entity.editorEntityUID) ?? entity);
}

export function applyLocalTransformPatch(
  entities: EntityInstance[],
  key: string | number,
  patch: LocalTransformPatch,
): EntityInstance[] {
  const index = buildHierarchyIndex(entities);
  const entity = findEntityInIndex(index, key);
  if (!entity || !entity.editorParentEntity) return entities;

  const parent = index.byUid.get(entity.editorParentEntity);
  if (!parent) return entities;

  const currentLocal = entity.localPosition ?? localFromWorld(parent, entity);
  const localPosition = { ...currentLocal, ...patch };
  const world = computeWorldFromLocal(transformOf(parent), {
    x: localPosition.x,
    y: localPosition.y,
    angle: localPosition.angle,
  });

  const worldZ = (parent.position.z ?? 0) + (localPosition.z ?? 0);

  const updated = entities.map(item => item.editorEntityUID === entity.editorEntityUID
    ? {
        ...item,
        localPosition,
        position: { ...item.position, x: world.x, y: world.y, z: worldZ },
        angle: world.angle,
      }
    : item
  );

  return cascadeWorldTransforms(updated, new Set([entity.editorEntityUID]));
}
