import type {
  EntityInstance,
  EntityTemplate,
  ProjectCharacterEntry,
  ProjectItemEntry,
} from "../types";
import { resolveExternalTemplate } from "./entityTemplate";

/**
 * Character data read from the project's `.character` and `.enml` files for a
 * scene entity whose customData `fileName` points to a `.character` file.
 * Pure data only: viewport drawing lives in `canvas/entityCustomRender.ts`.
 */

/** Entity names (exact match) drawn from a `.character` file via customData `fileName`. */
export const CHARACTER_RENDER_ENTITY_NAMES: readonly string[] = [
  "character_spawn",
  "character_air_attack",
  "copycat_spawn",
  "spider_egg",
  "dungeon44_ethereal_captain_spawn",
  "character_spawn.ent",
  "papa_trainer_spawn",
  "spawn_random_minion",
  "spawn_during_power_up",
  "character_spawn_bat.ent",
  "patroller_spawn",
  "character_air_attack_",
  "dungeon41_1_kingptain_spawn",
  "dungeon42_post_stomper_character_spawn",
  "dungeon42_dude_spawn",
  "dungeon43_moonkeeper_spawn",
  "dungeon43_1_dude_spawn",
  "slot_spawn_patrolling_1",
  "slot_spawn_patrolling_0",
  "dungeon44_prologue_scavenger_b_spawn",
  "spawn_dude_dungeon13",
  "dungeon34_end_air_attack",
  "minion_spawn_1",
  "minion_spawn_0",
  "dungeon38_kingptain_spawn",
  "dungeon38_moonkeeper_spawn",
];

/** Trimmed customData `fileName` string of the entity, or null when missing or blank. */
export function getCharacterFileName(entity: EntityInstance): string | null {
  const variable = entity.customData?.find((v) => v.name === "fileName");
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
  const fileName = getCharacterFileName(entity);
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
