import { XMLParser } from 'fast-xml-parser';
import type { SceneData, EntityInstance, EntityTemplate, EntityType, CustomDataRefType, CustomDataVariable, InlineEntityTemplate, ParticleSystemConfig } from '../types';
import { normalizeHierarchy } from '../utils/sceneHierarchy';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

type RawSceneEntity = {
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
  Entity?: RawSceneEntityData | RawSceneEntityData[];
  editorParentEntity?: string;
  editorHierarchyOrder?: string | number;
};

type RawSceneEntityData = {
  FileName?: string;
  CustomData?: RawCustomData | string;
  Sprite?: string | number;
  SpriteCut?: RawVector2;
  Pivot?: RawVector2;
  PivotAdjust?: RawVector2;
  Scale?: RawVector2;
  type?: string | number;
  parallaxIntensity?: string | number;
  blendMode?: string | number;
  DiffuseColor?: RawColor;
  EmissiveColor?: RawColor;
  Particles?: { ParticleSystem?: unknown } | unknown;
  [key: string]: unknown;
};

type RawColor = {
  r?: string | number;
  g?: string | number;
  b?: string | number;
  a?: string | number;
};

type RawVector2 = {
  x?: string | number;
  y?: string | number;
};

type RawCustomData = {
  Variable?: RawCustomVariable | RawCustomVariable[];
};

type RawCustomVariable = {
  Type?: string | number;
  Name?: string | number;
  Value?: string | number | {
    '#text'?: string | number;
    x?: string | number;
    y?: string | number;
    z?: string | number;
    refEditorUID?: string | number;
    refType?: string | number;
    refValue?: string | number;
  };
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function firstNestedEntity(entityData: RawSceneEntityData | RawSceneEntityData[] | undefined) {
  return Array.isArray(entityData) ? entityData[0] : entityData;
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseColor(color?: RawColor): { r: number; g: number; b: number; a: number } | undefined {
  if (!color || typeof color !== 'object') return undefined;
  if (color.r === undefined && color.g === undefined && color.b === undefined && color.a === undefined) return undefined;
  return {
    r: toNumber(color.r, 1),
    g: toNumber(color.g, 1),
    b: toNumber(color.b, 1),
    a: toNumber(color.a, 1),
  };
}

function parseEmissiveColor(color?: RawColor): { r: number; g: number; b: number; a: number } | undefined {
  const parsed = parseColor(color);
  return parsed ? { ...parsed, a: toNumber(color?.a, 0) } : undefined;
}

export function extractCustomDataRefMetadata(rawValue: unknown): {
  refEditorUID?: string;
  refType?: CustomDataRefType;
  refValue?: string;
} {
  if (!rawValue || typeof rawValue !== 'object') return {};
  const obj = rawValue as Record<string, unknown>;
  const refEditorUID = obj.refEditorUID !== undefined ? String(obj.refEditorUID).trim() : '';
  if (!refEditorUID) return {};

  const rawRefType = obj.refType !== undefined ? String(obj.refType).trim() : '';
  const refType: CustomDataRefType | undefined =
    rawRefType === 'baseData' || rawRefType === 'customData' ? rawRefType : undefined;
  const refValue = obj.refValue !== undefined ? String(obj.refValue) : '';

  return {
    refEditorUID,
    ...(refType ? { refType } : {}),
    ...(obj.refValue !== undefined ? { refValue } : {}),
  };
}

function parseCustomData(entityData: RawSceneEntityData | RawSceneEntityData[] | undefined): CustomDataVariable[] {
  const nestedEntity = firstNestedEntity(entityData);
  const customData = typeof nestedEntity?.CustomData === 'object' ? nestedEntity.CustomData : null;

  return toArray(customData?.Variable).map(variable => {
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

//{Tag FileName is a marker to mark this entity have reference to a {EntityName}.ent file}
function hasInlineTemplateData(entityData: RawSceneEntityData | undefined) {
  if (!entityData) return false;

  const hasFileName = typeof entityData.FileName === 'string' && entityData.FileName.trim().length > 0;
  let hasValidParticles = false;
  if (entityData.Particles !== undefined) {
    if (hasFileName) {
      const rawParticles = typeof entityData.Particles === 'object' && entityData.Particles ? entityData.Particles : {};
      const rawSystems = toArray((rawParticles as { ParticleSystem?: unknown }).ParticleSystem);
      hasValidParticles = rawSystems.length > 0;
    } else {
      hasValidParticles = true;
    }
  }

  return Boolean(
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
    hasValidParticles
  );
}

function parseInlineTemplate(name: string, entityData: RawSceneEntityData): InlineEntityTemplate {
  const template: InlineEntityTemplate = { name };

  if (entityData.Sprite !== undefined) template.spriteFile = String(entityData.Sprite);
  if (entityData.SpriteCut && typeof entityData.SpriteCut === 'object') {
    template.spriteCut = {
      x: toNumber(entityData.SpriteCut.x, 1),
      y: toNumber(entityData.SpriteCut.y, 1),
    };
  }
  const pivot = entityData.PivotAdjust ?? entityData.Pivot;
  if (pivot && typeof pivot === 'object') {
    template.pivotAdjust = {
      x: toNumber(pivot.x, 0),
      y: toNumber(pivot.y, 0),
    };
  }
  if (entityData.Scale && typeof entityData.Scale === 'object') {
    template.scale = {
      x: toNumber(entityData.Scale.x, 1),
      y: toNumber(entityData.Scale.y, 1),
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
    const hasFileName = typeof entityData.FileName === 'string' && entityData.FileName.trim().length > 0;
    if (rawSystems.length > 0 || !hasFileName) {
      template.particleSystems = rawSystems.map(parseParticleSystem);
    }
  }

  return template;
}

export function parseScene(xmlString: string): SceneData {
  const doc = parser.parse(xmlString);
  const root = doc.Ethanon;
  const props = root.SceneProperties;

  const entities: EntityInstance[] = [];
  const rawEntities = root.EntitiesInScene?.Entity ?? [];
  const list = Array.isArray(rawEntities) ? rawEntities : [rawEntities];

  const usedUIDs = new Set<string>();

  list.forEach((e: RawSceneEntity, idx: number) => {
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
        }
      } : {}),
      ...(diffuseColor ? { diffuseColor, color: diffuseColor } : {}),
      customData: parseCustomData(e.Entity),
      ...(processedInlineData ? { inlineEntityData: processedInlineData } : {}),
      ...(inlineTemplate ? { inlineTemplate } : {}),
    });
  });

  return {
    properties: {
      ambient: {
        r: Number(props?.Ambient?.r ?? props?.ambient_r ?? 0.5),
        g: Number(props?.Ambient?.g ?? props?.ambient_g ?? 0.5),
        b: Number(props?.Ambient?.b ?? props?.ambient_b ?? 0.5),
      },
      lightIntensity: Number(props?.lightIntensity ?? 2),
      zAxisDirection: {
        x: Number(props?.ZAxisDirection?.x ?? props?.zAxisDirection_x ?? 0),
        y: Number(props?.ZAxisDirection?.y ?? props?.zAxisDirection_y ?? -1),
      },
      parallaxIntensity: Number(props?.parallaxIntensity ?? 3),
    },
    entities: normalizeHierarchy(entities),
  };
}

const entParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

const TYPE_MAP: Record<string, EntityType> = {
  '0': 'horizontal',
  '1': 'ground_decal',
  '2': 'vertical',
  '3': 'opaque_decal',
  '4': 'overall',
  '5': 'layerable',
};

export function parseParticleSystem(raw: any): ParticleSystemConfig {
  const p = raw ?? {};
  return {
    particles: toNumber(p.particles ?? p.Particles, 10),
    allAtOnce: String(p.allAtOnce ?? p.AllAtOnce) === '1' || p.allAtOnce === 1 || p.allAtOnce === true,
    alphaMode: toNumber(p.alphaMode ?? p.AlphaMode, 0),
    repeat: toNumber(p.repeat ?? p.repeats ?? p.Repeat ?? p.Repeats, 0),
    animationMode: toNumber(p.animationMode ?? p.AnimationMode, 1),
    boundingSphere: toNumber(p.boundingSphere ?? p.bounding ?? p.BoundingSphere ?? p.Bounding, 512),
    lifeTime: toNumber(p.lifeTime ?? p.time ?? p.LifeTime ?? p.Time, 1000),
    randomLifeTime: toNumber(p.randomLifeTime ?? p.randomTime ?? p.RandomLifeTime ?? p.RandomTime, 0),
    angleDir: toNumber(p.angleDir ?? p.AngleDir, 0),
    randAngle: toNumber(p.randAngle ?? p.randAngleDir ?? p.RandAngle ?? p.RandAngleDir, 0),
    size: toNumber(p.size ?? p.Size, 32),
    randomizeSize: toNumber(p.randomizeSize ?? p.randSize ?? p.RandomizeSize ?? p.RandSize, 0),
    growth: toNumber(p.growth ?? p.Growth, 0),
    minSize: toNumber(p.minSize ?? p.MinSize, 0),
    maxSize: toNumber(p.maxSize ?? p.MaxSize, 99999),
    angleStart: toNumber(p.angleStart ?? p.sAngle ?? p.AngleStart ?? p.SAngle, 0),
    randAngleStart: toNumber(p.randAngleStart ?? p.randAngleSt ?? p.RandAngleStart ?? p.RandAngleSt, 0),
    bitmap: String(p.Bitmap ?? p.bitmap ?? ''),
    gravity: {
      x: toNumber(p.Gravity?.x ?? p.gravity?.x, 0),
      y: toNumber(p.Gravity?.y ?? p.gravity?.y, 0),
    },
    direction: {
      x: toNumber(p.Direction?.x ?? p.Dir?.x ?? p.direction?.x ?? p.dir?.x, 0),
      y: toNumber(p.Direction?.y ?? p.Dir?.y ?? p.direction?.y ?? p.dir?.y, 0),
    },
    randomizeDir: {
      x: toNumber(p.RandomizeDir?.x ?? p.RDir?.x ?? p.randomizeDir?.x ?? p.rDir?.x, 0),
      y: toNumber(p.RandomizeDir?.y ?? p.RDir?.y ?? p.randomizeDir?.y ?? p.rDir?.y, 0),
    },
    spriteCut: {
      x: Math.max(1, toNumber(p.SpriteCut?.x ?? p.spriteCut?.x, 1)),
      y: Math.max(1, toNumber(p.SpriteCut?.y ?? p.spriteCut?.y, 1)),
    },
    startPoint: {
      x: toNumber(p.StartPoint?.x ?? p.Start?.x ?? p.startPoint?.x ?? p.start?.x, 0),
      y: toNumber(p.StartPoint?.y ?? p.Start?.y ?? p.startPoint?.y ?? p.start?.y, 0),
      z: toNumber(p.StartPoint?.z ?? p.Start?.z ?? p.startPoint?.z ?? p.start?.z, 0),
    },
    randStartPoint: {
      x: toNumber(p.RandStartPoint?.x ?? p.RStart?.x ?? p.randStartPoint?.x ?? p.rStart?.x, 0),
      y: toNumber(p.RandStartPoint?.y ?? p.RStart?.y ?? p.randStartPoint?.y ?? p.rStart?.y, 0),
    },
    color0: parseColor(p.Color0 ?? p.color0) ?? { r: 1, g: 1, b: 1, a: 1 },
    color1: parseColor(p.Color1 ?? p.color1) ?? { r: 1, g: 1, b: 1, a: 1 },
    luminance: {
      r: toNumber(p.Luminance?.r ?? p.Emissive?.r ?? p.luminance?.r ?? p.emissive?.r, 1),
      g: toNumber(p.Luminance?.g ?? p.Emissive?.g ?? p.luminance?.g ?? p.emissive?.g, 1),
      b: toNumber(p.Luminance?.b ?? p.Emissive?.b ?? p.luminance?.b ?? p.emissive?.b, 1),
    },
  };
}

export function parseEntityTemplate(name: string, xmlString: string): EntityTemplate {
  const doc = entParser.parse(xmlString);
  // Actual format: <Ethanon><Entity ...><Sprite>...</Sprite></Entity></Ethanon>
  const root = doc.Ethanon?.Entity ?? doc.Entity;
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error(`Invalid entity template "${name}": missing <Ethanon><Entity> root.`);
  }

  // spriteFile is just the bare filename (e.g. "player.png") — engine prepends "entities/" at runtime
  const rawSprite: string = root?.Sprite ?? '';
  const diffuseColor = parseColor(root?.DiffuseColor);
  const emissiveColor = parseEmissiveColor(root?.EmissiveColor);

  const particlesTag = doc.Ethanon?.Particles ?? doc.Ethanon?.Entity?.Particles ?? doc.Entity?.Particles ?? root?.Particles;
  const rawSystems = particlesTag ? toArray(particlesTag.ParticleSystem) : [];
  const particleSystems = rawSystems.map(parseParticleSystem);
  const customData = parseCustomData(root);

  return {
    name,
    spriteFile: rawSprite,
    spriteCut: {
      x: Number(root?.SpriteCut?.x ?? 1),
      y: Number(root?.SpriteCut?.y ?? 1),
    },
    type: TYPE_MAP[String(root?.type ?? '0')] ?? 'horizontal',
    pivotAdjust: {
      x: Number(root?.PivotAdjust?.x ?? root?.Pivot?.x ?? 0),
      y: Number(root?.PivotAdjust?.y ?? root?.Pivot?.y ?? 0),
    },
    scale: {
      x: Number(root?.Scale?.x ?? 1),
      y: Number(root?.Scale?.y ?? 1),
    },
    parallaxIntensity: Number(root?.parallaxIntensity ?? 1),
    blendMode: Number(root?.blendMode ?? 0),
    ...(diffuseColor ? { diffuseColor } : {}),
    ...(emissiveColor ? { emissiveColor } : {}),
    ...(particleSystems.length > 0 ? { particleSystems } : {}),
    ...(customData.length > 0 ? { customData } : {}),
    ...(typeof root === 'object' && root !== null ? { rawEntityData: root as Record<string, unknown> } : {}),
  };
}
