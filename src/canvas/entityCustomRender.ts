import type {
  EntityInstance,
  EntityTemplate,
  ProjectCharacterEntry,
  ProjectItemEntry,
  SpriteAtlas,
} from "../types";
import { getAtlasForTemplate } from "./viewportMath";
import type { RenderCompositeLayer, RenderTemplate } from "./renderTemplate";
import { resolveEntityTemplate } from "../utils/entityTemplate";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import {
  CHARACTER_RENDER_ENTITY_NAMES,
  DEFAULT_WEAPON_EQUIP,
  getCharacterEntityInfo,
  getCharacterFileName,
  type CharacterEntityInfo,
} from "../utils/character";
import {
  isCharacterRenderFieldEnabled,
  type EntityCustomRenderSettingsMap,
} from "../utils/entityCustomRenderSettings";

export const ATTACK_MINIMUM_DISTANCE_COLOR = 0xf97316;
export const FIELD_OF_VIEW_COLOR = 0x38bdf8;

/**
 * Custom render hooks keyed by the scene entity's `EntityName`.
 *
 * Keys are matched EXACTLY: `character_spawn` and `character_spawn.ent` are two
 * different entities. Do not normalise the `.ent` extension here (unlike
 * template lookup in `utils/entityTemplate.ts`). This is unrelated to the
 * editor-only `editorEntityName`.
 */
export type EntityCustomRenderContext = {
  characters: readonly ProjectCharacterEntry[];
  settings?: EntityCustomRenderSettingsMap;
  /** Needed to check that a custom sprite image actually exists. */
  templateImageUrls?: Record<string, string>;
  /** Atlases by sprite file; a custom sprite without one uses the template's grid cut. */
  templateAtlases?: Record<string, SpriteAtlas>;
  /** `.enml` item files, needed to resolve a character's hair sprite. */
  items?: readonly ProjectItemEntry[];
  /** Entity templates by name; an item's `equipEntity` template gives its blend mode. */
  templates?: Record<string, EntityTemplate>;
};

export type EntityCustomRenderer = {
  /** Text drawn above the entity's sprite, or null/empty for no label. */
  getLabel?: (
    entity: EntityInstance,
    context: EntityCustomRenderContext,
  ) => string | null;
  /** Replaces the entity's sprite image (first frame is drawn), or null to keep it. */
  getSpriteFile?: (
    entity: EntityInstance,
    context: EntityCustomRenderContext,
  ) => string | null;
  /** Sprites drawn over the replaced sprite's first frame, bottom to top, aligned on their pivots. */
  getOverlayLayers?: (
    entity: EntityInstance,
    context: EntityCustomRenderContext,
  ) => EntityOverlayLayer[];
  /** 0xRRGGBB multiplied into the replaced sprite (like a diffuse color), or null for none. */
  getBaseColor?: (
    entity: EntityInstance,
    context: EntityCustomRenderContext,
  ) => number | null;
};

/** A sprite drawn over an entity's custom sprite (see `RenderTemplate.compositeLayers`). */
export type EntityOverlayLayer = Omit<
  RenderCompositeLayer,
  "spriteCut"
> & {
  /** Grid cut used when the sprite has no atlas; defaults to the entity template's own cut. */
  spriteCut?: { x: number; y: number };
};


/**
 * Layers of a character besides its body, bottom to top: weapon (under the
 * body), then armor, hair, eyes, artifact over it. The weapon is placed by its `equip`
 * offset and angle. Missing sprites are skipped.
 */
export function getCharacterOverlayLayers(
  info: CharacterEntityInfo,
): EntityOverlayLayer[] {
  const equipped = (typeLabel: string) =>
    info.equippedItems.find(
      (item) => item.typeLabel === typeLabel && item.sprite,
    ) ?? null;
  const spriteLayer = (
    sprite: string | null | undefined,
  ): EntityOverlayLayer | null => (sprite ? { spriteFile: sprite } : null);
  const layers = [
    // With the class helm kept, the hair shows and the armor's headless sprite
    // (when it has one) replaces its own; otherwise there is no hair.
    spriteLayer(
      info.keepClassHelm
        ? (equipped("Armor")?.headlessAlternativeSprite ??
            equipped("Armor")?.sprite)
        : equipped("Armor")?.sprite,
    ),
    spriteLayer(info.keepClassHelm ? info.hairSprite : null),
    // Eyes are drawn right after the hair, whether or not the class helm is kept.
    info.eyeSprite
      ? {
          spriteFile: info.eyeSprite,
          ...(info.eyeColor !== null ? { color: info.eyeColor } : {}),
          ...(info.eyeBlendMode ? { blendMode: info.eyeBlendMode } : {}),
        }
      : null,
    spriteLayer(equipped("Artifact")?.sprite),
  ];
  const weapon = equipped("Weapon");
  if (weapon?.sprite) {
    const equip = weapon.equip ?? DEFAULT_WEAPON_EQUIP;
    // A weapon image is never cut by the entity's sprite cut: without an atlas it is drawn whole.
    // It is drawn first, under the body.
    layers.unshift({
      spriteFile: weapon.sprite,
      behind: true,
      spriteCut: { x: 1, y: 1 },
      offset: { x: equip.offsetX, y: equip.offsetY },
      angle: equip.angle,
    });
  }
  return layers.filter((layer): layer is EntityOverlayLayer => layer !== null);
}

const characterInfoCache = new WeakMap<
  EntityCustomRenderContext,
  Map<string, CharacterEntityInfo | null>
>();

function getContextCharacterInfo(
  entity: EntityInstance,
  context: EntityCustomRenderContext,
): CharacterEntityInfo | null {
  const fileName = getCharacterFileName(entity);
  if (!fileName) return null;
  let byFile = characterInfoCache.get(context);
  if (!byFile) {
    byFile = new Map();
    characterInfoCache.set(context, byFile);
  }
  if (byFile.has(fileName)) {
    return byFile.get(fileName) ?? null;
  }
  const info = getCharacterEntityInfo(
    entity,
    context.characters,
    context.items ?? [],
    context.templates,
  );
  byFile.set(fileName, info);
  return info;
}

/** Applies viewport preferences without changing character data or restoring entity overrides. */
export function getCharacterRenderInfo(
  entity: EntityInstance,
  context: EntityCustomRenderContext,
): CharacterEntityInfo | null {
  if (
    !getEntityCustomRenderer(entity.entityName) ||
    context.settings?.[entity.editorEntityUID]?.enabled === false
  )
    return null;
  const info = getContextCharacterInfo(entity, context);
  if (!info) return null;
  const settings = context.settings?.[entity.editorEntityUID];
  if (!settings) return info;
  const enabled = (
    field: Parameters<typeof isCharacterRenderFieldEnabled>[1],
  ) => isCharacterRenderFieldEnabled(settings, field);
  return {
    ...info,
    name: enabled("name") ? info.name : "",
    resistance: enabled("resistance") ? info.resistance : null,
    attackMinimumDistance: enabled("attackMinimumDistance")
      ? info.attackMinimumDistance
      : null,
    fieldOfView: enabled("fieldOfView") ? info.fieldOfView : null,
    bodyColor: enabled("bodyColor") ? info.bodyColor : null,
    hairSprite: enabled("hair") ? info.hairSprite : null,
    eyeSprite: enabled("eyes") ? info.eyeSprite : null,
    eyeColor: enabled("eyeColor") ? info.eyeColor : null,
    equippedItems: info.equippedItems.filter((item) =>
      enabled(`item:${item.slot}`),
    ),
  };
}

const characterRenderer: EntityCustomRenderer = {
  getLabel: (entity, context) =>
    getCharacterRenderInfo(entity, context)?.name || null,
  getSpriteFile: (entity, context) =>
    getContextCharacterInfo(entity, context)?.bodySprite ?? null,
  getBaseColor: (entity, context) =>
    getCharacterRenderInfo(entity, context)?.bodyColor ?? null,
  getOverlayLayers: (entity, context) => {
    const info = getCharacterRenderInfo(entity, context);
    return info ? getCharacterOverlayLayers(info) : [];
  },
};


export const ENTITY_CUSTOM_RENDERERS: Readonly<
  Record<string, EntityCustomRenderer>
> = Object.fromEntries(
  CHARACTER_RENDER_ENTITY_NAMES.map((name) => [name, characterRenderer]),
);

export function getEntityCustomRenderer(
  entityName: string,
): EntityCustomRenderer | null {
  return Object.prototype.hasOwnProperty.call(
    ENTITY_CUSTOM_RENDERERS,
    entityName,
  )
    ? ENTITY_CUSTOM_RENDERERS[entityName]
    : null;
}

export function getEntityCustomLabel(
  entity: EntityInstance,
  context: EntityCustomRenderContext = { characters: [] },
): string | null {
  return (
    getEntityCustomRenderer(entity.entityName)?.getLabel?.(entity, context) ??
    null
  );
}

const renderTemplateCache = new WeakMap<
  EntityCustomRenderContext,
  WeakMap<
    EntityInstance,
    { templates: Record<string, EntityTemplate>; result: RenderTemplate | null }
  >
>();

/**
 * Template used by the viewport to draw an entity: the normal resolved template,
 * with its sprite replaced when the entity's custom renderer supplies one and the
 * image exists in the project. Scale is reset to 1; type and pivot adjust stay
 * those of the entity's own template.
 */
export function resolveEntityRenderTemplate(
  entity: EntityInstance,
  templates: Record<string, EntityTemplate>,
  context?: EntityCustomRenderContext,
): RenderTemplate | null {
  const base = resolveEntityTemplate(entity, templates);
  if (!context) return base;
  if (context.settings?.[entity.editorEntityUID]?.enabled === false)
    return base;
  const renderer = getEntityCustomRenderer(entity.entityName);
  if (!renderer) return base;

  let byEntity = renderTemplateCache.get(context);
  const cached = byEntity?.get(entity);
  if (cached && cached.templates === templates) {
    return cached.result;
  }

  const result = computeCustomRenderTemplate(entity, base, renderer, context);
  if (!byEntity) {
    byEntity = new WeakMap();
    renderTemplateCache.set(context, byEntity);
  }
  byEntity.set(entity, { templates, result });
  return result;
}

function computeCustomRenderTemplate(
  entity: EntityInstance,
  base: EntityTemplate | null,
  renderer: EntityCustomRenderer,
  context: EntityCustomRenderContext,
): RenderTemplate | null {
  const spriteFile = renderer.getSpriteFile?.(entity, context);
  if (!spriteFile) return base;
  const imageExists = (file: string) =>
    !context.templateImageUrls ||
    resolveImageUrl(context.templateImageUrls, file) !== null;
  if (!imageExists(spriteFile)) return base;
  // Overlays are drawn only when their image was loaded from the project.
  // A sprite without an atlas is cut by the entity template's own grid cut.
  const gridCut = base?.spriteCut ?? { x: 1, y: 1 };
  const compositeLayers = (renderer.getOverlayLayers?.(entity, context) ?? [])
    .filter((layer) => imageExists(layer.spriteFile))
    .map((layer) => ({ ...layer, spriteCut: layer.spriteCut ?? gridCut }));
  const bodyColor = renderer.getBaseColor?.(entity, context) ?? null;
  return {
    name: entity.entityName,
    type: "horizontal",
    pivotAdjust: { x: 0, y: 0 },
    parallaxIntensity: 1,
    blendMode: 0,
    ...base,
    spriteFile,
    // The entity template's scale belongs to its own sprite, not the body sprite.
    scale: { x: 1, y: 1 },
    // A custom sprite with a texture atlas is cut by that atlas. Without one,
    // fall back to the entity template's own grid cut (when atlases are known).
    spriteCut:
      context.templateAtlases &&
      !getAtlasForTemplate(
        { spriteFile } as EntityTemplate,
        context.templateAtlases,
      )
        ? (base?.spriteCut ?? { x: 1, y: 1 })
        : { x: 1, y: 1 },
    renderFirstFrameOnly: true,
    compositeLayers: compositeLayers.length > 0 ? compositeLayers : undefined,
    compositeBaseColor: bodyColor ?? undefined,
    compositeBaseHidden:
      renderer === characterRenderer &&
      !isCharacterRenderFieldEnabled(
        context.settings?.[entity.editorEntityUID],
        "body",
      ),
  };
}
