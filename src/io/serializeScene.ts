import { XMLBuilder } from 'fast-xml-parser';
import type { CustomDataVariable, CustomDataVectorValue, EntityInstance, SceneData } from '../types';
import { ensureEntExtension, entityHasFileNameTag } from '../utils/entityTemplate';
import { syncEntitiesCustomDataRefs } from '../utils/customDataRef';

const INLINE_ENTITY_ATTRIBUTE_KEYS = new Set([
  'shape',
  'sensor',
  'bullet',
  'fixedRotation',
  'friction',
  'density',
  'restitution',
  'gravityScale',
  'applyLight',
  'castShadow',
  'type',
  'parallaxIntensity',
  'static',
  'blendMode',
  'x',
  'y',
  'z',
  'r',
  'g',
  'b',
  'a',
  'particles',
  'allAtOnce',
  'alphaMode',
  'repeat',
  'repeats',
  'animationMode',
  'boundingSphere',
  'bounding',
  'lifeTime',
  'time',
  'randomLifeTime',
  'randomTime',
  'angleDir',
  'randAngle',
  'randAngleDir',
  'size',
  'randomizeSize',
  'randSize',
  'growth',
  'minSize',
  'maxSize',
  'angleStart',
  'sAngle',
  'randAngleStart',
  'randAngleSt',
  'active',
  'castShadows',
  'range',
  'haloBrightness',
  'haloSize',
  'omni',
  'halo',
]);

//if value agrument is a vector, 
//`value is CustomDataVectorValue` allow us use value as CustomDataVectorValue immediately
function isVectorValue(value: CustomDataVariable['value']): value is CustomDataVectorValue {
  return typeof value === 'object' && value !== null;
}

export function serializeCustomDataVariables(variables: CustomDataVariable[], isClean = false) {
  if (!variables || variables.length === 0) return '';

  return {
    Variable: variables.map(variable => {
      const isVector = variable.type === 'vector2' || variable.type === 'vector3';
      const value = variable.value;
      const hasRef = !isClean && Boolean(variable.refEditorUID && variable.refEditorUID.trim());
      const refAttrs = hasRef
        ? {
            '@_refEditorUID': variable.refEditorUID!.trim(),
            '@_refType': variable.refType ?? '',
            '@_refValue': variable.refValue ?? '',
          }
        : {};

      let serializedValue: unknown;
      if (isVector && isVectorValue(value)) {
        serializedValue = {
          '@_x': value.x,
          '@_y': value.y,
          ...(variable.type === 'vector3' ? { '@_z': value.z ?? 0 } : {}),
          ...refAttrs,
        };
      } else if (hasRef) {
        serializedValue = {
          ...refAttrs,
          '#text': String(value ?? ''),
        };
      } else {
        serializedValue = String(value ?? '');
      }

      return {
        Type: variable.type,
        Name: variable.name,
        Value: serializedValue,
      };
    }),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serializePreservedNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializePreservedNode);
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'CustomData')
      .map(([key, childValue]) => {
        const outputKey = INLINE_ENTITY_ATTRIBUTE_KEYS.has(key) ? `@_${key}` : key;
        return [outputKey, serializePreservedNode(childValue)];
      }),
  );
}

function serializeNestedEntity(entity: EntityInstance, isClean = false) {
  const diffuseColor = entity.diffuseColor ?? entity.color;
  const hasFileName = entityHasFileNameTag(entity);
  const fileNameToUse = hasFileName && entity.entityName && entity.entityName.trim()
    ? ensureEntExtension(entity.entityName)
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
      CustomData: serializeCustomDataVariables(entity.customData, isClean),
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

  const restPreserved = { ...preserved };
  delete restPreserved.FileName;

  return {
    Particles: '',
    ...restPreserved,
    CustomData: serializeCustomDataVariables(entity.customData, isClean),
  };
}

export const SCENE_XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
  entities: [
    { regex: new RegExp('&', 'g'), val: '&amp;' },
    { regex: new RegExp('>', 'g'), val: '&gt;' },
    { regex: new RegExp('<', 'g'), val: '&lt;' },
    { regex: new RegExp('"', 'g'), val: '&quot;' },
  ],
};

export interface SerializeSceneOptions {
  clean?: boolean;
}

export function serializeScene(scene: SceneData, options?: SerializeSceneOptions): string {
  const { properties: p } = scene;
  const isClean = Boolean(options?.clean);
  const entities = syncEntitiesCustomDataRefs(scene.entities);

  const xmlObj = {
    '?xml': { '@_version': '1.0' },
    Ethanon: {
      SceneProperties: {
        '@_lightIntensity': p.lightIntensity,
        '@_parallaxIntensity': p.parallaxIntensity,
        Ambient: {
          '@_r': p.ambient.r,
          '@_g': p.ambient.g,
          '@_b': p.ambient.b,
        },
        ZAxisDirection: {
          '@_x': p.zAxisDirection.x,
          '@_y': p.zAxisDirection.y,
        },
      },
      EntitiesInScene: {
        Entity: entities.map(e => ({
          '@_id': e.id,
          '@_spriteFrame': e.spriteFrame,
          ...(!isClean ? {
            '@_editorEntityUID': e.editorEntityUID,
            '@_editorEntityName': e.editorEntityName ?? e.entityName,
            ...(e.editorParentEntity ? { '@_editorParentEntity': e.editorParentEntity } : {}),
            ...(e.editorHierarchyOrder !== undefined ? { '@_editorHierarchyOrder': e.editorHierarchyOrder } : {}),
          } : {}),
          ...(e.flipX && { '@_flipX': '1' }),
          ...(e.flipY && { '@_flipY': '1' }),
          ...(e.hide && { '@_hide': '1' }),
          EntityName: e.entityName,
          Position: {
            '@_x': e.position.x,
            '@_y': e.position.y,
            '@_z': e.position.z,
            '@_angle': e.angle,
            ...(!isClean && e.localPosition && e.editorParentEntity ? {
              LocalPosition: {
                '@_x': e.localPosition.x,
                '@_y': e.localPosition.y,
                '@_z': e.localPosition.z,
                '@_angle': e.localPosition.angle,
              }
            } : {})
          },
          Entity: serializeNestedEntity(e, isClean),
        })),
      },
    },
  };

  const builder = new XMLBuilder(SCENE_XML_BUILDER_OPTIONS as any);
  return builder.build(xmlObj);
}
