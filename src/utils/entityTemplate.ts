import type { EntityInstance, EntityTemplate, InlineEntityTemplate } from '../types';

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
          blendMode: externalTemplate?.blendMode ?? 0,
          emissiveColor: externalTemplate?.emissiveColor,
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


