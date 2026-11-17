import type { EntityInstance } from '../types';

/**
 * Custom render hooks keyed by the scene entity's `EntityName`.
 *
 * Keys are matched EXACTLY: `character_spawn` and `character_spawn.ent` are two
 * different entities. Do not normalise the `.ent` extension here (unlike
 * template lookup in `utils/entityTemplate.ts`). This is unrelated to the
 * editor-only `editorEntityName`.
 */
export type EntityCustomRenderer = {
  /** Text drawn above the entity's sprite, or null/empty for no label. */
  getLabel?: (entity: EntityInstance) => string | null;
};

function customDataString(entity: EntityInstance, name: string): string | null {
  const variable = entity.customData?.find(v => v.name === name);
  if (!variable || typeof variable.value !== 'string') return null;
  const value = variable.value.trim();
  return value.length > 0 ? value : null;
}

export const ENTITY_CUSTOM_RENDERERS: Readonly<Record<string, EntityCustomRenderer>> = {
  character_spawn: {
    getLabel: entity => customDataString(entity, 'fileName'),
  },
};

export function getEntityCustomRenderer(entityName: string): EntityCustomRenderer | null {
  return Object.prototype.hasOwnProperty.call(ENTITY_CUSTOM_RENDERERS, entityName)
    ? ENTITY_CUSTOM_RENDERERS[entityName]
    : null;
}

export function getEntityCustomLabel(entity: EntityInstance): string | null {
  return getEntityCustomRenderer(entity.entityName)?.getLabel?.(entity) ?? null;
}
