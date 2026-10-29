import { XMLBuilder } from 'fast-xml-parser';
import type { EntityInstance, EntityTemplate, PrefabExportOptions } from '../types';
import { getAllDescendantIds } from '../utils/sceneHierarchy';
import { unpackEntityInstance } from '../utils/entityTemplate';
import { syncEntitiesCustomDataRefs } from '../utils/customDataRef';

import { SCENE_XML_BUILDER_OPTIONS, serializeCustomDataVariables, serializePreservedNode } from './serializeScene';

// Helper to serialize nested entity data matching scene serializer format
function serializeNestedEntityData(entity: EntityInstance) {
  const diffuseColor = entity.diffuseColor ?? entity.color;
  const hasFileName = Boolean(
    entity.inlineEntityData?.FileName ||
    (!entity.inlineEntityData && entity.entityName)
  );

  const fileNameToUse = hasFileName && entity.entityName && entity.entityName.trim()
    ? entity.entityName.toLowerCase().endsWith('.ent') ? entity.entityName : `${entity.entityName}.ent`
    : null;

  if (!entity.inlineEntityData || (hasFileName && fileNameToUse)) {
    const diffuseColorNode = diffuseColor ? {
      DiffuseColor: {
        '@_r': diffuseColor.r,
        '@_g': diffuseColor.g,
        '@_b': diffuseColor.b,
        '@_a': diffuseColor.a,
      },
    } : {};

    return {
      ...(fileNameToUse ? { FileName: fileNameToUse } : {}),
      ...diffuseColorNode,
      CustomData: entity.customData && entity.customData.length > 0 ? serializeCustomDataVariables(entity.customData) : '',
    };
  }

  const preserved = serializePreservedNode(entity.inlineEntityData) as Record<string, unknown>;
  if (diffuseColor) {
    preserved.DiffuseColor = {
      '@_r': diffuseColor.r,
      '@_g': diffuseColor.g,
      '@_b': diffuseColor.b,
      '@_a': diffuseColor.a,
    };
  } else {
    delete preserved.DiffuseColor;
  }

  delete preserved.FileName;

  return {
    ...preserved,
    CustomData: entity.customData && entity.customData.length > 0 ? serializeCustomDataVariables(entity.customData) : '',
  };
}

export function serializePrefab(
  rootEntity: EntityInstance,
  allEntities: EntityInstance[],
  options: PrefabExportOptions,
  templates: Record<string, EntityTemplate> = {},
): string {
  const syncedEntities = syncEntitiesCustomDataRefs(allEntities);
  const descendantIds = getAllDescendantIds(syncedEntities, new Set([rootEntity.id]));
  const prefabEntities = syncedEntities.filter(e => descendantIds.has(e.id));

  // Base coordinate origin is rootEntity's world position
  const originX = rootEntity.position.x;
  const originY = rootEntity.position.y;
  const originZ = rootEntity.position.z;

  const serializedEntityNodes = prefabEntities.map(e => {
    let processedEntity = { ...e };

    if (options.mode === 'unpack') {
      const unpacked = unpackEntityInstance(processedEntity, templates);
      processedEntity = {
        ...processedEntity,
        ...unpacked,
      };
      // For unpack mode, remove FileName tag from inlineEntityData if present
      if (processedEntity.inlineEntityData) {
        const copyInline = { ...processedEntity.inlineEntityData };
        delete copyInline.FileName;
        processedEntity.inlineEntityData = copyInline;
      }
    }

    const isRoot = e.id === rootEntity.id;
    const rebasedPos = {
      x: e.position.x - originX,
      y: e.position.y - originY,
      z: e.position.z - originZ,
    };

    const isChild = Boolean(e.editorParentEntity) && !isRoot;

    return {
      '@_editorEntityUID': e.editorEntityUID,
      '@_editorEntityName': e.editorEntityName ?? e.entityName,
      '@_spriteFrame': e.spriteFrame,
      ...(isChild && e.editorParentEntity ? { '@_editorParentEntity': e.editorParentEntity } : {}),
      ...(e.editorHierarchyOrder !== undefined ? { '@_editorHierarchyOrder': e.editorHierarchyOrder } : {}),
      ...(e.flipX && { '@_flipX': '1' }),
      ...(e.flipY && { '@_flipY': '1' }),
      ...(e.hide && { '@_hide': '1' }),
      EntityName: e.entityName,
      Position: {
        '@_x': rebasedPos.x,
        '@_y': rebasedPos.y,
        '@_z': rebasedPos.z,
        '@_angle': e.angle,
        ...(isChild && e.localPosition ? {
          LocalPosition: {
            '@_x': e.localPosition.x,
            '@_y': e.localPosition.y,
            '@_z': e.localPosition.z,
            '@_angle': e.localPosition.angle,
          },
        } : {}),
      },
      Entity: serializeNestedEntityData(processedEntity),
    };
  });

  const xmlObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'utf-8' },
    Ethanon: {
      '@_isPrefab': '1',
      Entity: serializedEntityNodes,
    },
  };

  const builder = new XMLBuilder(SCENE_XML_BUILDER_OPTIONS as any);

  return builder.build(xmlObj);
}
