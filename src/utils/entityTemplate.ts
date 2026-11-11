import type { CollisionShape, EntityInstance, EntityPhysicsConfig, EntityTemplate, InlineEntityTemplate } from '../types';
import {
  compoundsEqual,
  createDefaultCompoundSubShape,
  createDefaultPolygonVertices,
  filterDiagnosticsForEdit,
  filterWarningsForEdit,
  isCollisionGeometryValid,
  parseCompoundShapes,
  parsePolygonVertices,
  polygonsEqual,
  serializeCompoundEnml,
  serializePolygonEnml,
} from './collision';

function defaultTemplate(name: string): EntityTemplate {
  return {
    name,
    spriteFile: '',
    spriteCut: { x: 1, y: 1 },
    type: 'horizontal',
    pivotAdjust: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    parallaxIntensity: 1,
    blendMode: 0,
  };
}

export function getTemplateKey(entityName: string) {
  return entityName.replace(/\.ent$/i, '');
}

export function ensureEntExtension(name: string): string {
  if (!name || !name.trim()) return '';
  return name.toLowerCase().endsWith('.ent') ? name : `${name}.ent`;
}

export function resolveExternalTemplate(
  entityName: string,
  templates: Record<string, EntityTemplate>,
) {
  if (!entityName) return null;
  return templates[entityName]
    || templates[getTemplateKey(entityName)]
    || templates[ensureEntExtension(entityName)]
    || null;
}

export function mergeTemplate(
  name: string,
  base: EntityTemplate | null,
  inlineTemplate: InlineEntityTemplate,
): EntityTemplate {
  const fallback = base ?? defaultTemplate(name);
  return {
    name: inlineTemplate.name || fallback.name,
    spriteFile: inlineTemplate.spriteFile ?? fallback.spriteFile,
    spriteCut: inlineTemplate.spriteCut ?? fallback.spriteCut,
    type: inlineTemplate.type ?? fallback.type,
    pivotAdjust: inlineTemplate.pivotAdjust ?? fallback.pivotAdjust,
    scale: inlineTemplate.scale ?? fallback.scale,
    parallaxIntensity: inlineTemplate.parallaxIntensity ?? fallback.parallaxIntensity,
    blendMode: inlineTemplate.blendMode ?? fallback.blendMode,
    diffuseColor: inlineTemplate.diffuseColor ?? fallback.diffuseColor,
    emissiveColor: inlineTemplate.emissiveColor ?? fallback.emissiveColor,
    particleSystems: inlineTemplate.particleSystems ?? fallback.particleSystems,
    customData: inlineTemplate.customData ?? fallback.customData,
    physics: inlineTemplate.physics !== undefined ? inlineTemplate.physics : fallback.physics,
    rawEntityData: fallback.rawEntityData,
  };
}

export function resolveEntityTemplate(
  entity: EntityInstance,
  templates: Record<string, EntityTemplate>,
) {
  const hasFileName = entityHasFileNameTag(entity);
  const externalTemplate = hasFileName ? resolveExternalTemplate(entity.entityName, templates) : null;
  if (entity.inlineEntityData) {
    const safeInline = entity.inlineTemplate ?? { name: entity.entityName };
    const resolved = mergeTemplate(entity.entityName, externalTemplate, safeInline);
    // FileName entities are references: legacy inline blend overrides must not
    // change the preview because they cannot be represented in scene XML.
    return hasFileName
      ? {
          ...resolved,
          scale: externalTemplate?.scale ?? { x: 1, y: 1 },
          blendMode: externalTemplate?.blendMode ?? 0,
          emissiveColor: externalTemplate?.emissiveColor,
          physics: externalTemplate?.physics,
        }
      : resolved;
  }

  return externalTemplate;
}

export function entityHasFileNameTag(entity: EntityInstance): boolean {
  if (entity.inlineEntityData) {
    const rawFileName = entity.inlineEntityData.FileName;
    return typeof rawFileName === 'string' && rawFileName.trim().length > 0;
  }
  return false;
}

const TYPE_NUM_MAP: Record<string, string> = {
  horizontal: '0',
  ground_decal: '1',
  vertical: '2',
  opaque_decal: '3',
  overall: '4',
  layerable: '5',
};

export function mergeCustomData(
  packedData: import('../types').CustomDataVariable[] = [],
  sceneData: import('../types').CustomDataVariable[] = [],
): import('../types').CustomDataVariable[] {
  const sceneMap = new Map<string, import('../types').CustomDataVariable>();
  for (const item of sceneData) {
    if (item && item.name) {
      sceneMap.set(item.name, item);
    }
  }

  const result: import('../types').CustomDataVariable[] = [];
  const processedNames = new Set<string>();

  for (const packedItem of packedData) {
    if (!packedItem || !packedItem.name) continue;
    processedNames.add(packedItem.name);
    if (sceneMap.has(packedItem.name)) {
      result.push(sceneMap.get(packedItem.name)!);
    } else {
      result.push(packedItem);
    }
  }

  for (const sceneItem of sceneData) {
    if (sceneItem && sceneItem.name && !processedNames.has(sceneItem.name)) {
      result.push(sceneItem);
    }
  }

  return result;
}

export function unpackEntityInstance(
  entity: EntityInstance,
  templates: Record<string, EntityTemplate>,
): Partial<EntityInstance> {
  const template = resolveEntityTemplate(entity, templates);
  const packedCustomData = template?.customData ?? [];
  const sceneCustomData = entity.customData ?? [];
  const mergedCustomData = mergeCustomData(packedCustomData, sceneCustomData);

  const inlineName = entity.entityName;

  const inlineTemplate: InlineEntityTemplate = {
    name: inlineName,
    spriteFile: entity.inlineTemplate?.spriteFile ?? template?.spriteFile ?? '',
    spriteCut: entity.inlineTemplate?.spriteCut ?? template?.spriteCut ?? { x: 1, y: 1 },
    scale: entity.inlineTemplate?.scale ?? template?.scale ?? { x: 1, y: 1 },
    type: entity.inlineTemplate?.type ?? template?.type ?? 'horizontal',
    pivotAdjust: entity.inlineTemplate?.pivotAdjust ?? template?.pivotAdjust ?? { x: 0, y: 0 },
    parallaxIntensity: entity.inlineTemplate?.parallaxIntensity ?? template?.parallaxIntensity ?? 1,
    blendMode: entity.inlineTemplate?.blendMode ?? template?.blendMode ?? 0,
    ...((entity.diffuseColor || template?.diffuseColor) ? { diffuseColor: entity.diffuseColor ?? template?.diffuseColor } : {}),
    ...(template?.emissiveColor ? { emissiveColor: template.emissiveColor } : {}),
    ...((entity.inlineTemplate?.particleSystems || template?.particleSystems) ? { particleSystems: entity.inlineTemplate?.particleSystems ?? template?.particleSystems } : {}),
    ...(template?.physics ? { physics: template.physics } : {}),
  };

  const templateRawData = template?.rawEntityData
    ? JSON.parse(JSON.stringify(template.rawEntityData))
    : {};
  delete templateRawData.FileName;
  delete templateRawData.CustomData;

  const rawInline = { ...(entity.inlineEntityData ?? {}) };
  delete rawInline.FileName;

  const typeVal = TYPE_NUM_MAP[inlineTemplate.type ?? 'horizontal'] ?? '0';

  const inlineEntityData: Record<string, unknown> = {
    ...templateRawData,
    Sprite: inlineTemplate.spriteFile,
    SpriteCut: {
      x: inlineTemplate.spriteCut?.x ?? 1,
      y: inlineTemplate.spriteCut?.y ?? 1,
    },
    Scale: {
      x: inlineTemplate.scale?.x ?? 1,
      y: inlineTemplate.scale?.y ?? 1,
    },
    type: typeVal,
    PivotAdjust: {
      x: inlineTemplate.pivotAdjust?.x ?? 0,
      y: inlineTemplate.pivotAdjust?.y ?? 0,
    },
    parallaxIntensity: inlineTemplate.parallaxIntensity ?? 1,
    blendMode: inlineTemplate.blendMode ?? 0,
    ...rawInline,
  };

  if (inlineTemplate.diffuseColor) {
    inlineEntityData.DiffuseColor = {
      r: inlineTemplate.diffuseColor.r,
      g: inlineTemplate.diffuseColor.g,
      b: inlineTemplate.diffuseColor.b,
      a: inlineTemplate.diffuseColor.a,
    };
  }

  if (inlineTemplate.emissiveColor) {
    inlineEntityData.EmissiveColor = {
      r: inlineTemplate.emissiveColor.r,
      g: inlineTemplate.emissiveColor.g,
      b: inlineTemplate.emissiveColor.b,
      a: inlineTemplate.emissiveColor.a,
    };
  }

  return {
    entityName: inlineName,
    customData: mergedCustomData,
    inlineTemplate,
    inlineEntityData,
  };
}



export function createDefaultPhysics(
  shape: CollisionShape = 1,
  defaultSize?: { x: number; y: number; z?: number },
): EntityPhysicsConfig {
  const sizeX = defaultSize?.x && defaultSize.x > 0 ? defaultSize.x : (shape === 0 ? 0 : 64);
  const sizeY = defaultSize?.y && defaultSize.y > 0 ? defaultSize.y : (shape === 0 ? 0 : 64);
  const sizeZ = defaultSize?.z && defaultSize.z > 0 ? defaultSize.z : (shape === 0 ? 0 : 64);
  const polygon = shape === 3 ? createDefaultPolygonVertices() : [];
  const compound = shape === 4 ? [createDefaultCompoundSubShape([])] : [];
  return {
    shape,
    static: false,
    sensor: false,
    bullet: false,
    fixedRotation: false,
    friction: 1,
    density: 1,
    restitution: 0,
    gravityScale: 1,
    collision: {
      valid: true,
      position: { x: 0, y: 0, z: 0 },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      polygon,
      compound,
      joints: [],
    },
    warnings: [],
    diagnostics: [],
  };
}

export interface ApplyPhysicsOptions {
  forceSerializePolygon?: boolean;
  forceSerializeCompound?: boolean;
}

export function applyPhysicsToEntity(
  entity: EntityInstance,
  physics: EntityPhysicsConfig | null,
  options?: ApplyPhysicsOptions,
): EntityInstance {
  const inlineTemplate = {
    ...(entity.inlineTemplate ?? { name: entity.entityName }),
  };
  const inlineEntityData = {
    ...(entity.inlineEntityData ?? {}),
  };

  if (!physics || physics.shape === 0) {
    inlineTemplate.physics = physics
      ? {
          ...physics,
          shape: 0,
          collision: { ...physics.collision, valid: true },
          warnings: filterWarningsForEdit(physics.warnings, { type: 'shape', newShape: 0 }),
          diagnostics: filterDiagnosticsForEdit(physics.diagnostics, { type: 'shape', newShape: 0 }),
        }
      : createDefaultPhysics(0);
    inlineEntityData.shape = '0';
    delete inlineEntityData.Collision;
    return {
      ...entity,
      inlineTemplate,
      inlineEntityData,
    };
  }

  inlineTemplate.physics = {
    ...physics,
    collision: {
      ...physics.collision,
      valid: isCollisionGeometryValid(physics),
    },
  };

  const existingCollision = (entity.inlineEntityData?.Collision as Record<string, unknown>) ?? {};
  const rawExistingPolygon = typeof existingCollision.Polygon === 'string' ? existingCollision.Polygon : undefined;
  let polygonValue: string | undefined;
  if (physics.shape === 3) {
    if (!options?.forceSerializePolygon && rawExistingPolygon !== undefined && polygonsEqual(parsePolygonVertices(rawExistingPolygon), physics.collision.polygon)) {
      polygonValue = rawExistingPolygon;
    } else if (physics.collision.polygon.length > 0) {
      polygonValue = serializePolygonEnml(physics.collision.polygon);
    } else {
      polygonValue = options?.forceSerializePolygon ? '' : (rawExistingPolygon ?? '');
    }
  }

  const rawExistingCompound = typeof existingCollision.Compound === 'string' ? existingCollision.Compound : undefined;
  let compoundValue: string | undefined;
  if (physics.shape === 4) {
    if (!options?.forceSerializeCompound && rawExistingCompound !== undefined && compoundsEqual(parseCompoundShapes(rawExistingCompound), physics.collision.compound)) {
      compoundValue = rawExistingCompound;
    } else if (physics.collision.compound.length > 0) {
      compoundValue = serializeCompoundEnml(physics.collision.compound);
    } else {
      compoundValue = options?.forceSerializeCompound ? '' : (rawExistingCompound ?? '');
    }
  }

  inlineEntityData.shape = String(physics.shape);
  inlineEntityData.static = physics.static ? '1' : '0';
  inlineEntityData.sensor = physics.sensor ? '1' : '0';
  inlineEntityData.bullet = physics.bullet ? '1' : '0';
  inlineEntityData.fixedRotation = physics.fixedRotation ? '1' : '0';
  inlineEntityData.friction = String(physics.friction);
  inlineEntityData.density = String(physics.density);
  inlineEntityData.restitution = String(physics.restitution);
  inlineEntityData.gravityScale = String(physics.gravityScale);

  inlineEntityData.Collision = {
    Position: {
      x: String(physics.collision.position.x),
      y: String(physics.collision.position.y),
      z: String(physics.collision.position.z),
    },
    Size: {
      x: String(physics.collision.size.x),
      y: String(physics.collision.size.y),
      z: String(physics.collision.size.z),
    },
    ...(polygonValue !== undefined ? { Polygon: polygonValue } : {}),
    ...(compoundValue !== undefined ? { Compound: compoundValue } : {}),
    ...(typeof existingCollision.Joints === 'string' ? { Joints: existingCollision.Joints } : {}),
  };

  return {
    ...entity,
    inlineTemplate,
    inlineEntityData,
  };
}

export function findEntitiesWithInvalidCollision(entities: EntityInstance[]): EntityInstance[] {
  return entities.filter(entity => {
    const physics = entity.inlineTemplate?.physics;
    if (!physics || entityHasFileNameTag(entity)) return false;
    return !isCollisionGeometryValid(physics);
  });
}
