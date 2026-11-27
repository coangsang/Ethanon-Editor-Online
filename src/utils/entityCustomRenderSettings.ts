/** Viewport preferences only; never stored in scene entities or XML. */
export type CharacterRenderField =
  | 'name' | 'resistance' | 'attackMinimumDistance' | 'fieldOfView'
  | 'body' | 'bodyColor' | 'hair' | 'eyes' | 'eyeColor'
  | `item:${string}`;

export type EntityCustomRenderSettings = {
  enabled?: boolean;
  fields?: Partial<Record<CharacterRenderField, boolean>>;
};

export type EntityCustomRenderSettingsMap = Readonly<Record<string, EntityCustomRenderSettings>>;

export function isCharacterRenderFieldEnabled(settings: EntityCustomRenderSettings | undefined, field: CharacterRenderField) {
  return settings?.enabled !== false && settings?.fields?.[field] !== false;
}
