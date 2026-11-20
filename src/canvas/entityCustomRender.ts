import type { EntityInstance, EntityTemplate, ProjectCharacterEntry, SpriteAtlas } from '../types';
import { getAtlasForTemplate } from './viewportMath';
import { resolveEntityTemplate } from '../utils/entityTemplate';
import { resolveImageUrl } from '../utils/resolveImageUrl';

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
  /** Needed to check that a custom sprite image actually exists. */
  templateImageUrls?: Record<string, string>;
  /** Atlases by sprite file; a custom sprite without one uses the template's grid cut. */
  templateAtlases?: Record<string, SpriteAtlas>;
};

export type EntityCustomRenderer = {
  /** Text drawn above the entity's sprite, or null/empty for no label. */
  getLabel?: (entity: EntityInstance, context: EntityCustomRenderContext) => string | null;
  /** Replaces the entity's sprite image (first frame is drawn), or null to keep it. */
  getSpriteFile?: (entity: EntityInstance, context: EntityCustomRenderContext) => string | null;
};

function customDataString(entity: EntityInstance, name: string): string | null {
  const variable = entity.customData?.find(v => v.name === name);
  if (!variable || typeof variable.value !== 'string') return null;
  const value = variable.value.trim();
  return value.length > 0 ? value : null;
}

function normalizeCharacterPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
}

function findCharacterEntry(
  fileName: string,
  characters: readonly ProjectCharacterEntry[],
): ProjectCharacterEntry | null {
  const wanted = normalizeCharacterPath(fileName);
  // Character entries are relative to the project's npcs folder, while the
  // scene's fileName is relative to the project root ("npcs/...").
  const wantedInNpcs = wanted.replace(/^npcs\//, '');
  return characters.find(c => {
    const rel = normalizeCharacterPath(c.relativePath);
    return rel === wanted || rel === wantedInNpcs;
  }) ?? null;
}

function getCharacterObject(fileName: string, characters: readonly ProjectCharacterEntry[]) {
  return findCharacterEntry(fileName, characters)?.objects?.find(o => o.name === 'character') ?? null;
}

/**
 * `character.properties.name` from the .character file when it exists,
 * otherwise the file's base name without extension (e.g. "blood-priest").
 */
function characterDisplayName(fileName: string, characters: readonly ProjectCharacterEntry[]): string {
  const name = getCharacterObject(fileName, characters)?.properties.name;
  if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  const base = fileName.trim().replace(/\\/g, '/').split('/').pop() ?? fileName;
  return base.replace(/\.character$/i, '');
}

const characterRenderer: EntityCustomRenderer = {
  getLabel: (entity, { characters }) => {
    const fileName = customDataString(entity, 'fileName');
    return fileName ? characterDisplayName(fileName, characters) : null;
  },
  getSpriteFile: (entity, { characters }) => {
    const fileName = customDataString(entity, 'fileName');
    if (!fileName) return null;
    const bodySprite = getCharacterObject(fileName, characters)?.properties.bodySprite;
    return typeof bodySprite === 'string' && bodySprite.trim() ? bodySprite.trim() : null;
  },
};

/** Entity names (exact match) drawn from a `.character` file via customData `fileName`. */
export const CHARACTER_RENDER_ENTITY_NAMES: readonly string[] = ['character_spawn', 'character_air_attack'];

export const ENTITY_CUSTOM_RENDERERS: Readonly<Record<string, EntityCustomRenderer>> = Object.fromEntries(
  CHARACTER_RENDER_ENTITY_NAMES.map(name => [name, characterRenderer]),
);

export function getEntityCustomRenderer(entityName: string): EntityCustomRenderer | null {
  return Object.prototype.hasOwnProperty.call(ENTITY_CUSTOM_RENDERERS, entityName)
    ? ENTITY_CUSTOM_RENDERERS[entityName]
    : null;
}

export function getEntityCustomLabel(
  entity: EntityInstance,
  context: EntityCustomRenderContext = { characters: [] },
): string | null {
  return getEntityCustomRenderer(entity.entityName)?.getLabel?.(entity, context) ?? null;
}

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
  const spriteFile = getEntityCustomRenderer(entity.entityName)?.getSpriteFile?.(entity, context);
  if (!spriteFile) return base;
  if (context.templateImageUrls && !resolveImageUrl(context.templateImageUrls, spriteFile)) return base;
  return {
    name: entity.entityName,
    type: 'horizontal',
    pivotAdjust: { x: 0, y: 0 },
    parallaxIntensity: 1,
    blendMode: 0,
    ...base,
    spriteFile,
    // The entity template's scale belongs to its own sprite, not the body sprite.
    scale: { x: 1, y: 1 },
    // A custom sprite with a texture atlas is cut by that atlas. Without one,
    // fall back to the entity template's own grid cut (when atlases are known).
    spriteCut: context.templateAtlases && !getAtlasForTemplate({ spriteFile } as EntityTemplate, context.templateAtlases)
      ? base?.spriteCut ?? { x: 1, y: 1 }
      : { x: 1, y: 1 },
    renderFirstFrameOnly: true,
  };
}
