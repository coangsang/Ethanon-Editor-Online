import type {
  EntityInstance,
  EntityTemplate,
  ProjectCharacterEntry,
  ProjectItemEntry,
  SpriteAtlas,
} from "../types";
import { getAtlasForTemplate } from "./viewportMath";
import {
  resolveEntityTemplate,
  resolveExternalTemplate,
} from "../utils/entityTemplate";
import { resolveImageUrl } from "../utils/resolveImageUrl";
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

/** A sprite drawn over an entity's custom sprite (see `EntityTemplate.compositeLayers`). */
export type EntityOverlayLayer = Omit<
  NonNullable<EntityTemplate["compositeLayers"]>[number],
  "spriteCut"
> & {
  /** Grid cut used when the sprite has no atlas; defaults to the entity template's own cut. */
  spriteCut?: { x: number; y: number };
};

function customDataString(entity: EntityInstance, name: string): string | null {
  const variable = entity.customData?.find((v) => v.name === name);
  if (!variable || typeof variable.value !== "string") return null;
  const value = variable.value.trim();
  return value.length > 0 ? value : null;
}

function normalizeCharacterPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .toLowerCase();
}

function findCharacterEntry(
  fileName: string,
  characters: readonly ProjectCharacterEntry[],
): ProjectCharacterEntry | null {
  const wanted = normalizeCharacterPath(fileName);
  // Character entries are relative to the project's npcs folder, while the
  // scene's fileName is relative to the project root ("npcs/...").
  const wantedInNpcs = wanted.replace(/^npcs\//, "");
  return (
    characters.find((c) => {
      const rel = normalizeCharacterPath(c.relativePath);
      return rel === wanted || rel === wantedInNpcs;
    }) ?? null
  );
}

function getCharacterObject(
  fileName: string,
  characters: readonly ProjectCharacterEntry[],
) {
  return (
    findCharacterEntry(fileName, characters)?.objects?.find(
      (o) => o.name === "character",
    ) ?? null
  );
}

/**
 * `character.properties.name` from the .character file when it exists,
 * otherwise the file's base name without extension (e.g. "blood-priest").
 */
function characterDisplayName(
  fileName: string,
  characters: readonly ProjectCharacterEntry[],
): string {
  const name = getCharacterObject(fileName, characters)?.properties.name;
  if (typeof name === "string" && name.trim().length > 0) return name.trim();
  const base = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? fileName;
  return base.replace(/\.character$/i, "");
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The `sprite` of the `.enml` item block named `itemName`. `npc-head.enml` is
 * searched first, then the other item files in path order.
 */
export function findItemSprite(
  itemName: string,
  items: readonly ProjectItemEntry[],
): string | null {
  return nonEmptyString(findItemProperties(itemName, items)?.sprite);
}

function findItemProperties(
  itemName: string,
  items: readonly ProjectItemEntry[],
): Record<string, unknown> | null {
  const isHeadFile = (entry: ProjectItemEntry) =>
    entry.name.toLowerCase() === "npc-head.enml";
  const ordered = [
    ...items.filter(isHeadFile),
    ...items.filter((entry) => !isHeadFile(entry)),
  ];
  for (const entry of ordered) {
    const object = entry.objects?.find((o) => o.name === itemName);
    if (object) return object.properties;
  }
  return null;
}

const EQUIPPED_ITEM_TYPE_LABELS: Record<string, string> = {
  armor: "Armor",
  artifact: "Artifact",
  weapon: "Weapon",
};

export type CharacterEquippedItem = {
  /** Block name in the `.character` file, e.g. `equippedItem0`. */
  slot: string;
  /** Display label of `type`: Armor, Artifact, or Weapon. */
  typeLabel: string;
  /** Item `name`, or null when missing. */
  name: string | null;
  /** Item `sprite`, or null when missing or `none`. */
  sprite: string | null;
  /** Item `headlessAlternativeSprite`, present only when set and not `none`. */
  headlessAlternativeSprite?: string;
  /** Weapons only: how the weapon is held relative to the body's pivot. */
  equip?: CharacterWeaponEquip;
};

export type CharacterWeaponEquip = {
  /** `equippedAngle` in degrees (default 0). */
  angle: number;
  /** `equipOffsetX` / `equipOffsetY` in pixels from the body's pivot (default -40, 0). */
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_WEAPON_EQUIP: Readonly<CharacterWeaponEquip> = {
  angle: 0,
  offsetX: -40,
  offsetY: 0,
};

function isFalse(value: unknown): boolean {
  return (
    value === false ||
    (typeof value === "string" && value.trim().toLowerCase() === "false")
  );
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

/** Weapon hold transform; each property missing or not a number uses its default. */
function getWeaponEquip(
  properties: Record<string, unknown>,
): CharacterWeaponEquip {
  return {
    angle: finiteNumber(properties.equippedAngle) ?? DEFAULT_WEAPON_EQUIP.angle,
    offsetX:
      finiteNumber(properties.equipOffsetX) ?? DEFAULT_WEAPON_EQUIP.offsetX,
    offsetY:
      finiteNumber(properties.equipOffsetY) ?? DEFAULT_WEAPON_EQUIP.offsetY,
  };
}

/**
 * The `.enml` item block whose `name` property is `itemName` (the target of an
 * `equippedItem` block's `reference`). `npc-head.enml` is searched first.
 */
function findItemByName(
  itemName: string,
  items: readonly ProjectItemEntry[],
): Record<string, unknown> | null {
  const isHeadFile = (entry: ProjectItemEntry) =>
    entry.name.toLowerCase() === "npc-head.enml";
  const ordered = [
    ...items.filter(isHeadFile),
    ...items.filter((entry) => !isHeadFile(entry)),
  ];
  for (const entry of ordered) {
    const object = entry.objects?.find(
      (o) => nonEmptyString(o.properties.name) === itemName,
    );
    if (object) return object.properties;
  }
  return null;
}

/**
 * An `equippedItem` block's effective properties: with a `reference`, the
 * referenced `.enml` item's properties, overridden by any set in the block itself.
 */
function resolveEquippedProperties(
  properties: Record<string, unknown>,
  items: readonly ProjectItemEntry[],
): Record<string, unknown> {
  const reference = nonEmptyString(properties.reference);
  const referenced = reference ? findItemByName(reference, items) : null;
  if (!referenced) return properties;
  const merged = { ...referenced, ...properties };
  delete merged.reference;
  delete merged.stackSize;
  return merged;
}

/** `equippedItem0`..`equippedItem2` blocks with an armor, artifact, or weapon `type`, in slot order. */
export function getCharacterEquippedItems(
  objects:
    | readonly { name: string; properties: Record<string, unknown> }[]
    | null
    | undefined,
  items: readonly ProjectItemEntry[] = [],
): CharacterEquippedItem[] {
  const result: CharacterEquippedItem[] = [];
  for (let i = 0; i <= 2; i++) {
    const slot = `equippedItem${i}`;
    const block = objects?.find((o) => o.name === slot)?.properties;
    const properties = block
      ? resolveEquippedProperties(block, items)
      : undefined;
    const type = nonEmptyString(properties?.type)?.toLowerCase();
    const typeLabel = type ? EQUIPPED_ITEM_TYPE_LABELS[type] : undefined;
    if (!properties || !typeLabel) continue;
    const sprite = nonEmptyString(properties.sprite);
    const headless = nonEmptyString(properties.headlessAlternativeSprite);
    result.push({
      slot,
      typeLabel,
      name: nonEmptyString(properties.name),
      sprite: sprite && sprite.toLowerCase() !== "none" ? sprite : null,
      ...(headless && headless.toLowerCase() !== "none"
        ? { headlessAlternativeSprite: headless }
        : {}),
      ...(type === "weapon" ? { equip: getWeaponEquip(properties) } : {}),
    });
  }
  return result;
}

/** uint color (e.g. 4284590503): the low 24 bits are RGB, the alpha byte is ignored. White means no tint. */
function parseCharacterColor(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  // 0 is the unset value (not black); white multiplies to nothing.
  if (parsed === 0) return null;
  const rgb = Math.trunc(parsed) % 0x1000000;
  return rgb === 0xffffff ? null : rgb;
}

export type CharacterEntityInfo = {
  /** customData `fileName` as written in the scene. */
  fileName: string;
  /** Display name (see `characterDisplayName`). */
  name: string;
  /** Optional integer resistance from the character block; 20 equals one heart. */
  resistance: number | null;
  /** Optional numeric stats from the character block. */
  level: number | null;
  speed: number | null;
  jumpImpulse: number | null;
  scale: number | null;
  attackMinimumDistance: number | null;
  /** Half-angle in degrees (null when negative); the game's projected angle is twice this value. */
  fieldOfView: number | null;
  /** `character.properties.bodySprite`, or null when missing. */
  bodySprite: string | null;
  /** `character.properties.bodyColor` as 0xRRGGBB (alpha dropped); null when missing or white. */
  bodyColor: number | null;
  /** `character.properties.hairSprite` (an item name), or null when missing. */
  hairName: string | null;
  /** `sprite` of the `.enml` item named by `hairName`, or null when not found. */
  hairSprite: string | null;
  /** `character.properties.eyeSprite` (an item name), or null when missing. */
  eyeName: string | null;
  /** `sprite` of the `.enml` item named by `eyeName`, or null when not found. */
  eyeSprite: string | null;
  /** `character.properties.eyeColor` as 0xRRGGBB (alpha dropped); null when unset or white. */
  eyeColor: number | null;
  /** Blend mode of the eye layer: that of the item's `equipEntity` template; absent when normal or not found. */
  eyeBlendMode?: number;
  /** Armor, artifact, and weapon blocks `equippedItem0`..`equippedItem2`. */
  equippedItems: CharacterEquippedItem[];
  /** Optional sound files (in the project's `soundfx` folder); null when absent. */
  threatDetectedSound: string | null;
  confusedSound: string | null;
  damageSound: string | null;
  /** Whether the `.character` file was found among the project's characters. */
  found: boolean;
  /** `character.properties.keepClassHelm`; false only when explicitly `false`. */
  keepClassHelm: boolean;
};

/** Character data for an entity whose customData `fileName` points to a `.character` file. */
export function getCharacterEntityInfo(
  entity: EntityInstance,
  characters: readonly ProjectCharacterEntry[],
  items: readonly ProjectItemEntry[] = [],
  templates: Record<string, EntityTemplate> = {},
): CharacterEntityInfo | null {
  const fileName = customDataString(entity, "fileName");
  if (!fileName) return null;
  const entry = findCharacterEntry(fileName, characters);
  const properties = entry?.objects?.find(
    (o) => o.name === "character",
  )?.properties;
  const hairName = nonEmptyString(properties?.hairSprite);
  const eyeName = nonEmptyString(properties?.eyeSprite);
  const eyeProperties = eyeName ? findItemProperties(eyeName, items) : null;
  const eyeEquipEntity = nonEmptyString(eyeProperties?.equipEntity);
  const eyeBlendMode = eyeEquipEntity
    ? resolveExternalTemplate(eyeEquipEntity, templates)?.blendMode
    : undefined;
  return {
    fileName,
    name: characterDisplayName(fileName, characters),
    resistance:
      typeof properties?.resistance === "number" &&
      Number.isInteger(properties.resistance)
        ? properties.resistance
        : null,
    level: finiteNumber(properties?.level),
    speed: finiteNumber(properties?.speed),
    jumpImpulse: finiteNumber(properties?.jumpImpulse),
    scale: finiteNumber(properties?.scale),
    attackMinimumDistance: nonNegativeNumber(properties?.attackMinimumDistance),
    fieldOfView: nonNegativeNumber(properties?.fieldOfView),
    bodySprite: nonEmptyString(properties?.bodySprite),
    bodyColor: parseCharacterColor(properties?.bodyColor),
    hairName,
    hairSprite: hairName ? findItemSprite(hairName, items) : null,
    eyeName,
    eyeSprite: nonEmptyString(eyeProperties?.sprite),
    eyeColor: parseCharacterColor(properties?.eyeColor),
    ...(eyeBlendMode ? { eyeBlendMode } : {}),
    equippedItems: getCharacterEquippedItems(entry?.objects, items),
    threatDetectedSound: nonEmptyString(properties?.threatDetectedSound),
    confusedSound: nonEmptyString(properties?.confusedSound),
    damageSound: nonEmptyString(properties?.damageSound),
    found: entry !== null,
    keepClassHelm: !isFalse(properties?.keepClassHelm),
  };
}

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
  const fileName = customDataString(entity, "fileName");
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

/** Entity names (exact match) drawn from a `.character` file via customData `fileName`. */
export const CHARACTER_RENDER_ENTITY_NAMES: readonly string[] = [
  "character_spawn",
  "character_air_attack",
  "copycat_spawn",
  "spider_egg",
  "dungeon44_ethereal_captain_spawn",
];

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
    { templates: Record<string, EntityTemplate>; result: EntityTemplate | null }
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
): EntityTemplate | null {
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
): EntityTemplate | null {
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
