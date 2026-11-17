import type { EntityInstance, ProjectCharacterEntry } from '../types';

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
};

export type EntityCustomRenderer = {
  /** Text drawn above the entity's sprite, or null/empty for no label. */
  getLabel?: (entity: EntityInstance, context: EntityCustomRenderContext) => string | null;
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

/**
 * `character.properties.name` from the .character file when it exists,
 * otherwise the file's base name without extension (e.g. "blood-priest").
 */
function characterDisplayName(fileName: string, characters: readonly ProjectCharacterEntry[]): string {
  const entry = findCharacterEntry(fileName, characters);
  const name = entry?.objects?.find(o => o.name === 'character')?.properties.name;
  if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  const base = fileName.trim().replace(/\\/g, '/').split('/').pop() ?? fileName;
  return base.replace(/\.character$/i, '');
}

export const ENTITY_CUSTOM_RENDERERS: Readonly<Record<string, EntityCustomRenderer>> = {
  character_spawn: {
    getLabel: (entity, { characters }) => {
      const fileName = customDataString(entity, 'fileName');
      return fileName ? characterDisplayName(fileName, characters) : null;
    },
  },
};

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
