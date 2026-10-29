import { XMLParser } from 'fast-xml-parser';
import type { EntityInstance, InlineEntityTemplate, CustomDataVariable } from '../types';
import { normalizeHierarchy } from '../utils/sceneHierarchy';
import { extractCustomDataRefMetadata, parseParticleSystem } from './parseScene';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

type RawPrefabEntity = {
  id?: string | number;
  EntityName?: string;
  editorEntityName?: string;
  editorEntityUID?: string;
  Position?: {
    x?: string | number;
    y?: string | number;
    z?: string | number;
    angle?: string | number;
    LocalPosition?: {
      x?: string | number;
      y?: string | number;
      z?: string | number;
      angle?: string | number;
    };
  };
  spriteFrame?: string | number;
  hide?: string | number;
  flipX?: string | number;
  flipY?: string | number;
  Entity?: Record<string, unknown> | Array<Record<string, unknown>>;
  editorParentEntity?: string;
  editorHierarchyOrder?: string | number;
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function firstNestedEntity(entityData: Record<string, unknown> | Array<Record<string, unknown>> | undefined) {
  return Array.isArray(entityData) ? entityData[0] : entityData;
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseColor(color?: any): { r: number; g: number; b: number; a: number } | undefined {
  if (!color || typeof color !== 'object') return undefined;
  if (color.r === undefined && color.g === undefined && color.b === undefined && color.a === undefined) return undefined;
  return {
    r: toNumber(color.r, 1),
    g: toNumber(color.g, 1),
    b: toNumber(color.b, 1),
    a: toNumber(color.a, 1),
  };
}

function parseEmissiveColor(color?: any): { r: number; g: number; b: number; a: number } | undefined {
  const parsed = parseColor(color);
  return parsed ? { ...parsed, a: toNumber(color?.a, 0) } : undefined;
}

function parseCustomData(entityData: Record<string, unknown> | Array<Record<string, unknown>> | undefined): CustomDataVariable[] {
  const nestedEntity = firstNestedEntity(entityData);
  const customData = (nestedEntity && typeof nestedEntity.CustomData === 'object') ? nestedEntity.CustomData as any : null;

  return toArray(customData?.Variable).map((variable: any) => {
    const type = String(variable.Type ?? '');
    const value = variable.Value;
    const refMeta = extractCustomDataRefMetadata(value);

    if (
      (type === 'vector2' || type === 'vector3') &&
      value &&
      typeof value === 'object'
    ) {
      return {
        type,
        name: String(variable.Name ?? ''),
        value: {
          x: Number(value.x ?? 0),
          y: Number(value.y ?? 0),
          ...(type === 'vector3' ? { z: Number(value.z ?? 0) } : {}),
        },
        ...refMeta,
      };
    }

    const scalarRaw = (value && typeof value === 'object')
      ? (value as Record<string, unknown>)['#text'] ?? ''
      : value;

    return {
      type,
      name: String(variable.Name ?? ''),
      value: String(scalarRaw ?? ''),
      ...refMeta,
    };
  });
}

const TYPE_MAP: Record<string, import('../types').EntityType> = {
  '0': 'horizontal',
  '1': 'ground_decal',
  '2': 'vertical',
  '3': 'opaque_decal',
  '4': 'overall',
  '5': 'layerable',
};

function hasInlineTemplateData(entityData: Record<string, unknown> | undefined) {
  return Boolean(entityData && (
    entityData.Sprite !== undefined ||
    entityData.SpriteCut !== undefined ||
    entityData.Pivot !== undefined ||
    entityData.PivotAdjust !== undefined ||
    entityData.Scale !== undefined ||
    entityData.type !== undefined ||
    entityData.parallaxIntensity !== undefined ||
    entityData.blendMode !== undefined ||
    entityData.DiffuseColor !== undefined ||
    entityData.EmissiveColor !== undefined ||
    entityData.Particles !== undefined
  ));
}

function parseInlineTemplate(name: string, entityData: Record<string, unknown>): InlineEntityTemplate {
  const template: InlineEntityTemplate = { name };

  if (entityData.Sprite !== undefined) template.spriteFile = String(entityData.Sprite);
  if (entityData.SpriteCut && typeof entityData.SpriteCut === 'object') {
    const sc = entityData.SpriteCut as any;
    template.spriteCut = {
      x: toNumber(sc.x, 1),
      y: toNumber(sc.y, 1),
    };
  }
  const pivot = (entityData.PivotAdjust ?? entityData.Pivot) as any;
  if (pivot && typeof pivot === 'object') {
    template.pivotAdjust = {
      x: toNumber(pivot.x, 0),
      y: toNumber(pivot.y, 0),
    };
  }
  if (entityData.Scale && typeof entityData.Scale === 'object') {
    const sc = entityData.Scale as any;
    template.scale = {
      x: toNumber(sc.x, 1),
      y: toNumber(sc.y, 1),
    };
  }
  if (entityData.type !== undefined) {
    template.type = TYPE_MAP[String(entityData.type ?? '0')] ?? 'horizontal';
  }
  if (entityData.parallaxIntensity !== undefined) {
    template.parallaxIntensity = toNumber(entityData.parallaxIntensity, 1);
  }
  if (entityData.blendMode !== undefined) {
    template.blendMode = toNumber(entityData.blendMode, 0);
  }
  if (entityData.DiffuseColor !== undefined) {
    template.diffuseColor = parseColor(entityData.DiffuseColor);
  }
  if (entityData.EmissiveColor !== undefined) {
    template.emissiveColor = parseEmissiveColor(entityData.EmissiveColor);
  }
  if (entityData.Particles !== undefined) {
    const rawParticles = typeof entityData.Particles === 'object' && entityData.Particles ? entityData.Particles : {};
    const rawSystems = toArray((rawParticles as { ParticleSystem?: unknown }).ParticleSystem);
    template.particleSystems = rawSystems.map(parseParticleSystem);
  }

  return template;
}

export function parsePrefab(xmlString: string): EntityInstance[] {
  const doc = parser.parse(xmlString);
  const root = doc.Ethanon;
  if (!root) {
    throw new Error('Invalid Prefab XML: Missing <Ethanon> root node.');
  }

  const rawEntities = root.Entity ?? [];
  const list = Array.isArray(rawEntities) ? rawEntities : [rawEntities];

  const usedUIDs = new Set<string>();
  const entities: EntityInstance[] = [];

  list.forEach((e: RawPrefabEntity, idx: number) => {
    const entityName = String(e.EntityName ?? '');
    const editorEntityName = String(e.editorEntityName ?? entityName);
    const nestedEntity = firstNestedEntity(e.Entity);
    const inlineTemplate = hasInlineTemplateData(nestedEntity)
      ? parseInlineTemplate(entityName, nestedEntity!)
      : undefined;

    const diffuseColor = parseColor(nestedEntity?.DiffuseColor);

    let uid = String(e.editorEntityUID || '');
    if (!uid || usedUIDs.has(uid)) {
      uid = crypto.randomUUID();
    }
    usedUIDs.add(uid);

    const processedInlineData = nestedEntity as Record<string, unknown> | undefined;

    entities.push({
      id: Number(e.id ?? idx),
      entityName,
      editorEntityName,
      editorEntityUID: uid,
      position: {
        x: Number(e.Position?.x ?? 0),
        y: Number(e.Position?.y ?? 0),
        z: Number(e.Position?.z ?? 0),
      },
      angle: Number(e.Position?.angle ?? 0),
      spriteFrame: Number(e.spriteFrame ?? 0),
      hide: e.hide === '1' || e.hide === 1,
      flipX: e.flipX === '1' || e.flipX === 1,
      flipY: e.flipY === '1' || e.flipY === 1,
      ...(e.editorParentEntity ? { editorParentEntity: String(e.editorParentEntity) } : {}),
      editorHierarchyOrder: e.editorHierarchyOrder !== undefined ? Number(e.editorHierarchyOrder) : 0,
      ...(e.Position?.LocalPosition ? {
        localPosition: {
          x: Number(e.Position.LocalPosition.x ?? 0),
          y: Number(e.Position.LocalPosition.y ?? 0),
          z: Number(e.Position.LocalPosition.z ?? 0),
          angle: Number(e.Position.LocalPosition.angle ?? 0),
        },
      } : {}),
      ...(diffuseColor ? { diffuseColor, color: diffuseColor } : {}),
      customData: parseCustomData(e.Entity),
      ...(processedInlineData ? { inlineEntityData: processedInlineData } : {}),
      ...(inlineTemplate ? { inlineTemplate } : {}),
    });
  });

  return normalizeHierarchy(entities);
}
