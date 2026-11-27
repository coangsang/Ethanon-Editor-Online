import { CHARACTER_RENDER_ENTITY_NAMES } from '../../utils/character';

/**
 * Custom Inspector views keyed by the scene entity's `EntityName`, matched
 * EXACTLY like the viewport's custom renderers (`canvas/entityCustomRender.ts`).
 * The Inspector shows a "Custom" switch only for entities that have one; the
 * view for each kind is chosen in `EntityCustomInspector.tsx`.
 */
export type EntityCustomInspectorKind = 'character';

/** Text of the Inspector's custom-mode switch for each kind. */
export const ENTITY_CUSTOM_INSPECTOR_LABELS: Readonly<Record<EntityCustomInspectorKind, string>> = {
  character: 'Character',
};

export const ENTITY_CUSTOM_INSPECTOR_KINDS: Readonly<Record<string, EntityCustomInspectorKind>> = Object.fromEntries(
  CHARACTER_RENDER_ENTITY_NAMES.map(name => [name, 'character' as const]),
);

export function getEntityCustomInspectorKind(entityName: string): EntityCustomInspectorKind | null {
  return Object.prototype.hasOwnProperty.call(ENTITY_CUSTOM_INSPECTOR_KINDS, entityName)
    ? ENTITY_CUSTOM_INSPECTOR_KINDS[entityName]
    : null;
}
