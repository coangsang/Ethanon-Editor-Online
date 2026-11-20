import { describe, expect, it } from 'vitest';
import type { EntityInstance, ProjectCharacterEntry, ProjectItemEntry } from '../../types';
import { getEntityCustomLabel, getEntityCustomRenderer, resolveEntityRenderTemplate, findItemSprite, getCharacterEquippedItems } from '../entityCustomRender';

function entity(entityName: string, customData: EntityInstance['customData'] = []): EntityInstance {
  return {
    id: 1,
    entityName,
    editorEntityUID: 'uid-1',
    position: { x: 0, y: 0, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData,
  };
}

const PATH = 'npcs/enemies/blood-priest.character';
const fileName = [{ type: 'string', name: 'fileName', value: PATH }];

function character(relativePath: string, objects: ProjectCharacterEntry['objects']): ProjectCharacterEntry {
  return {
    name: relativePath.split('/').pop() ?? relativePath,
    relativePath,
    handle: {} as ProjectCharacterEntry['handle'],
    objects,
  };
}

describe('entity custom render registry', () => {
  it('uses character.properties.name from the existing character file', () => {
    const characters = [
      character('enemies/blood-priest.character', [
        { name: 'character', properties: { name: 'Blood Priest' } },
      ]),
    ];
    expect(getEntityCustomLabel(entity('character_spawn', fileName), { characters })).toBe('Blood Priest');
  });

  it('falls back to the file base name when the character file is missing', () => {
    expect(getEntityCustomLabel(entity('character_spawn', fileName), { characters: [] })).toBe('blood-priest');
    expect(getEntityCustomLabel(entity('character_spawn', fileName))).toBe('blood-priest');
  });

  it('falls back to the file base name when the file has no character name', () => {
    const noName = [character('enemies/blood-priest.character', [{ name: 'character', properties: { hp: 5 } }])];
    const noObject = [character('enemies/blood-priest.character', [])];
    expect(getEntityCustomLabel(entity('character_spawn', fileName), { characters: noName })).toBe('blood-priest');
    expect(getEntityCustomLabel(entity('character_spawn', fileName), { characters: noObject })).toBe('blood-priest');
  });

  it('renders character_air_attack like character_spawn', () => {
    expect(getEntityCustomLabel(entity('character_air_attack', fileName))).toBe('blood-priest');
    expect(getEntityCustomRenderer('character_air_attack')).toBe(getEntityCustomRenderer('character_spawn'));
    expect(getEntityCustomRenderer('character_air_attack.ent')).toBeNull();
  });

  it('matches the entity name exactly, so the .ent variant is a different entity', () => {
    expect(getEntityCustomRenderer('character_spawn.ent')).toBeNull();
    expect(getEntityCustomLabel(entity('character_spawn.ent', fileName))).toBeNull();
  });

  it('ignores prototype keys and unrelated entities', () => {
    expect(getEntityCustomRenderer('constructor')).toBeNull();
    expect(getEntityCustomLabel(entity('other', fileName))).toBeNull();
  });

  it('returns no label when fileName is missing or blank', () => {
    expect(getEntityCustomLabel(entity('character_spawn'))).toBeNull();
    expect(getEntityCustomLabel(entity('character_spawn', [{ type: 'string', name: 'fileName', value: '  ' }]))).toBeNull();
  });
});

describe('character_spawn body sprite override', () => {
  const characters = [
    character('enemies/blood-priest.character', [
      { name: 'character', properties: { name: 'Blood Priest', bodySprite: 'entities/priest_body.png' } },
    ]),
  ];
  const urls = { 'entities/priest_body.png': 'blob:priest' };
  const spawn = entity('character_spawn', fileName);

  it('replaces the sprite with bodySprite and renders only the first frame', () => {
    const t = resolveEntityRenderTemplate(spawn, {}, { characters, templateImageUrls: urls });
    expect(t?.spriteFile).toBe('entities/priest_body.png');
    expect(t?.spriteCut).toEqual({ x: 1, y: 1 });
    expect(t?.renderFirstFrameOnly).toBe(true);
    expect(t?.scale).toEqual({ x: 1, y: 1 });
  });

  it('uses the entity template spriteCut when the body sprite has no atlas', () => {
    const cut = { name: 'character_spawn', spriteFile: 'x.png', spriteCut: { x: 4, y: 2 }, type: 'horizontal', pivotAdjust: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, parallaxIntensity: 1 } as const;
    const e = { ...spawn, inlineEntityData: { FileName: 'character_spawn.ent' } };
    const templates = { 'character_spawn.ent': cut, character_spawn: cut };
    const noAtlas = resolveEntityRenderTemplate(e, templates, { characters, templateImageUrls: urls, templateAtlases: {} });
    expect(noAtlas?.spriteCut).toEqual({ x: 4, y: 2 });
    const atlas = { frames: [{ x: 0, y: 0, width: 1, height: 1 }] } as never;
    const withAtlas = resolveEntityRenderTemplate(e, templates, { characters, templateImageUrls: urls, templateAtlases: { 'entities/priest_body.png': atlas } });
    expect(withAtlas?.spriteCut).toEqual({ x: 1, y: 1 });
  });

  it('ignores the entity template scale for the body sprite', () => {
    const scaled = { name: 'character_spawn', spriteFile: 'x.png', spriteCut: { x: 1, y: 1 }, type: 'horizontal', pivotAdjust: { x: 0, y: 0 }, scale: { x: 3, y: 3 }, parallaxIntensity: 1 } as const;
    const e = { ...spawn, inlineEntityData: { FileName: 'character_spawn.ent' } };
    const t = resolveEntityRenderTemplate(e, { 'character_spawn.ent': scaled, character_spawn: scaled }, { characters, templateImageUrls: urls });
    expect(t?.scale).toEqual({ x: 1, y: 1 });  });

  it('keeps the original template when bodySprite is absent or its image is missing', () => {
    const noBody = [character('enemies/blood-priest.character', [{ name: 'character', properties: { name: 'X' } }])];
    expect(resolveEntityRenderTemplate(spawn, {}, { characters: noBody, templateImageUrls: urls })).toBeNull();
    expect(resolveEntityRenderTemplate(spawn, {}, { characters, templateImageUrls: { 'entities/other.png': 'blob:other' } })).toBeNull();
    expect(resolveEntityRenderTemplate(spawn, {}, { characters: [], templateImageUrls: urls })).toBeNull();
  });

  it('does not override other entity names, including character_spawn.ent', () => {
    const ctx = { characters, templateImageUrls: urls };
    expect(resolveEntityRenderTemplate(entity('character_spawn.ent', fileName), {}, ctx)).toBeNull();
  });
});

describe('findItemSprite', () => {
  const item = (name: string, objects: { name: string; properties: Record<string, string> }[]) => ({
    name,
    relativePath: name,
    handle: {} as ProjectItemEntry['handle'],
    objects,
  });

  it('prefers npc-head.enml and returns the item sprite', () => {
    const items = [
      item('a-other.enml', [{ name: 'alien0', properties: { sprite: 'other.png' } }]),
      item('npc-head.enml', [{ name: 'alien0', properties: { sprite: 'hair_6.png' } }]),
    ];
    expect(findItemSprite('alien0', items)).toBe('hair_6.png');
    expect(findItemSprite('missing', items)).toBeNull();
    expect(findItemSprite('alien0', [items[0]])).toBe('other.png');
  });
});

describe('getCharacterEquippedItems', () => {
  it('returns armor/artifact/weapon slots in slot order', () => {
    const objects = [
      { name: 'character', properties: { name: 'X' } },
      { name: 'equippedItem1', properties: { name: 'Zombie Bite', type: 'weapon', sprite: 'none' } },
      { name: 'equippedItem0', properties: { name: 'Zombie Set', type: 'armor', sprite: 'armor_leather_0b.png' } },
      { name: 'equippedItem2', properties: { name: 'Ring', type: 'Artifact', sprite: 'ring.png' } },
      { name: 'equippedItem3', properties: { type: 'armor', sprite: 'x.png' } },
    ];
    expect(getCharacterEquippedItems(objects)).toEqual([
      { slot: 'equippedItem0', typeLabel: 'Armor', name: 'Zombie Set', sprite: 'armor_leather_0b.png' },
      { slot: 'equippedItem1', typeLabel: 'Weapon', name: 'Zombie Bite', sprite: null },
      { slot: 'equippedItem2', typeLabel: 'Artifact', name: 'Ring', sprite: 'ring.png' },
    ]);
  });

  it('skips unsupported types and handles undefined input', () => {
    expect(getCharacterEquippedItems([{ name: 'equippedItem0', properties: { name: 'Hat', type: 'head', sprite: 'h.png' } }])).toEqual([]);
    expect(getCharacterEquippedItems(undefined)).toEqual([]);
  });
});
