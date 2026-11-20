import { describe, expect, it } from 'vitest';
import type { EntityInstance, ProjectCharacterEntry, ProjectItemEntry } from '../../types';
import { getEntityCustomLabel, getEntityCustomRenderer, resolveEntityRenderTemplate, findItemSprite, getCharacterEquippedItems, getCharacterOverlayLayers, getCharacterEntityInfo, type CharacterEntityInfo } from '../entityCustomRender';

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
      { slot: 'equippedItem1', typeLabel: 'Weapon', name: 'Zombie Bite', sprite: null, equip: { angle: 0, offsetX: -40, offsetY: 0 } },
      { slot: 'equippedItem2', typeLabel: 'Artifact', name: 'Ring', sprite: 'ring.png' },
    ]);
  });

  it('skips unsupported types and handles undefined input', () => {
    expect(getCharacterEquippedItems([{ name: 'equippedItem0', properties: { name: 'Hat', type: 'head', sprite: 'h.png' } }])).toEqual([]);
    expect(getCharacterEquippedItems(undefined)).toEqual([]);
  });
});

describe('getCharacterEquippedItems weapon equip', () => {
  const weapon = (properties: Record<string, unknown>) => getCharacterEquippedItems([
    { name: 'equippedItem0', properties: { name: 'W', type: 'weapon', sprite: 'w.png', ...properties } },
  ]);

  it('parses equippedAngle, equipOffsetX and equipOffsetY', () => {
    expect(weapon({ equippedAngle: -20, equipOffsetX: -36, equipOffsetY: -4 })[0].equip).toEqual({ angle: -20, offsetX: -36, offsetY: -4 });
  });

  it('parses numeric strings', () => {
    expect(weapon({ equippedAngle: '-20.0', equipOffsetX: -36, equipOffsetY: -4 })[0].equip).toEqual({ angle: -20, offsetX: -36, offsetY: -4 });
  });

  it('falls back to defaults for missing values', () => {
    expect(weapon({ equippedAngle: 15 })[0].equip).toEqual({ angle: 15, offsetX: -40, offsetY: 0 });
  });

  it('falls back to the default for non-numeric values', () => {
    expect(weapon({ equipOffsetX: 'abc' })[0].equip?.offsetX).toBe(-40);
  });

  it('gives non-weapon items no equip', () => {
    const [armor] = getCharacterEquippedItems([
      { name: 'equippedItem0', properties: { name: 'A', type: 'armor', sprite: 'a.png', equippedAngle: 10 } },
    ]);
    expect(armor.equip).toBeUndefined();
  });
});

describe('getCharacterEntityInfo keepClassHelm', () => {
  const infoFor = (properties: Record<string, unknown>) => getCharacterEntityInfo(
    entity('character_spawn', fileName),
    [character('enemies/blood-priest.character', [{ name: 'character', properties: { name: 'X', ...properties } }])],
  );

  it('is false for boolean false and the string false', () => {
    expect(infoFor({ keepClassHelm: false })?.keepClassHelm).toBe(false);
    expect(infoFor({ keepClassHelm: 'false' })?.keepClassHelm).toBe(false);
  });

  it('is true when absent or true', () => {
    expect(infoFor({})?.keepClassHelm).toBe(true);
    expect(infoFor({ keepClassHelm: true })?.keepClassHelm).toBe(true);
  });
});

describe('getCharacterEquippedItems headlessAlternativeSprite', () => {
  const armor = (properties: Record<string, unknown>) => getCharacterEquippedItems([
    { name: 'equippedItem0', properties: { name: 'Santa Claus', type: 'armor', sprite: 'armor_christmas_2022_A.png', ...properties } },
  ])[0];

  it('carries a headless alternative sprite', () => {
    expect(armor({ headlessAlternativeSprite: 'armor_christmas_2022_B.png' }).headlessAlternativeSprite).toBe('armor_christmas_2022_B.png');
  });

  it('omits the key when the value is none', () => {
    const item = armor({ headlessAlternativeSprite: 'none' });
    expect(item.headlessAlternativeSprite).toBeUndefined();
    expect(item).not.toHaveProperty('headlessAlternativeSprite');
  });
});

describe('getCharacterOverlayLayers', () => {
  const info = (overrides: Partial<CharacterEntityInfo>): CharacterEntityInfo => ({
    fileName: PATH,
    name: 'X',
    bodySprite: 'body.png',
    hairName: null,
    hairSprite: null,
    equippedItems: [],
    found: true,
    keepClassHelm: true,
    ...overrides,
  });

  it('orders weapon (behind), armor, hair, artifact regardless of slot order', () => {
    const result = getCharacterOverlayLayers(info({
      hairName: 'hair0',
      hairSprite: 'hair.png',
      equippedItems: [
        { slot: 'equippedItem0', typeLabel: 'Weapon', name: 'W', sprite: 'w.png' },
        { slot: 'equippedItem1', typeLabel: 'Artifact', name: 'A', sprite: 'artifact.png' },
        { slot: 'equippedItem2', typeLabel: 'Armor', name: 'R', sprite: 'armor.png' },
      ],
    }));
    expect(result).toEqual([
      { spriteFile: 'w.png', behind: true, spriteCut: { x: 1, y: 1 }, offset: { x: -40, y: 0 }, angle: 0 },
      { spriteFile: 'armor.png' },
      { spriteFile: 'hair.png' },
      { spriteFile: 'artifact.png' },
    ]);
  });

  it('uses the weapon equip offset and angle', () => {
    const result = getCharacterOverlayLayers(info({
      equippedItems: [
        { slot: 'equippedItem0', typeLabel: 'Weapon', name: 'W', sprite: 'w.png', equip: { angle: -20, offsetX: -36, offsetY: -4 } },
      ],
    }));
    expect(result[0]).toEqual({ spriteFile: 'w.png', behind: true, spriteCut: { x: 1, y: 1 }, offset: { x: -36, y: -4 }, angle: -20 });
  });

  it('skips missing sprites', () => {
    expect(getCharacterOverlayLayers(info({ hairName: 'hair0', hairSprite: 'hair.png' }))).toEqual([{ spriteFile: 'hair.png' }]);
  });

  const santaArmor = { slot: 'equippedItem0', typeLabel: 'Armor', name: 'Santa Claus', sprite: 'armor_christmas_2022_A.png', headlessAlternativeSprite: 'armor_christmas_2022_B.png' };

  it('uses the headless armor sprite and keeps hair when keepClassHelm is true', () => {
    expect(getCharacterOverlayLayers(info({ keepClassHelm: true, hairName: 'hair0', hairSprite: 'hair.png', equippedItems: [santaArmor] })))
      .toEqual([{ spriteFile: 'armor_christmas_2022_B.png' }, { spriteFile: 'hair.png' }]);
  });

  it('uses the normal armor sprite and drops hair when keepClassHelm is false', () => {
    expect(getCharacterOverlayLayers(info({ keepClassHelm: false, hairName: 'hair0', hairSprite: 'hair.png', equippedItems: [santaArmor] })))
      .toEqual([{ spriteFile: 'armor_christmas_2022_A.png' }]);
  });

  it('falls back to the armor sprite when it has no headless alternative', () => {
    expect(getCharacterOverlayLayers(info({
      keepClassHelm: true,
      hairName: 'hair0',
      hairSprite: 'hair.png',
      equippedItems: [{ slot: 'equippedItem0', typeLabel: 'Armor', name: 'R', sprite: 'armor.png' }],
    }))).toEqual([{ spriteFile: 'armor.png' }, { spriteFile: 'hair.png' }]);
  });
});

describe('character_spawn composite layers', () => {
  const cut = { name: 'character_spawn', spriteFile: 'x.png', spriteCut: { x: 4, y: 2 }, type: 'horizontal', pivotAdjust: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, parallaxIntensity: 1 } as const;
  const templates = { 'character_spawn.ent': cut, character_spawn: cut };
  const spawn = { ...entity('character_spawn', fileName), inlineEntityData: { FileName: 'character_spawn.ent' } };
  const items: ProjectItemEntry[] = [{
    name: 'npc-head.enml',
    relativePath: 'npc-head.enml',
    handle: {} as ProjectItemEntry['handle'],
    objects: [{ name: 'hair0', properties: { sprite: 'hair.png' } }],
  }];
  const withOverlays = [
    character('enemies/blood-priest.character', [
      { name: 'character', properties: { name: 'Blood Priest', bodySprite: 'body.png', hairSprite: 'hair0' } },
      { name: 'equippedItem0', properties: { name: 'Set', type: 'armor', sprite: 'armor.png' } },
    ]),
  ];
  const urls = { 'body.png': 'blob:body', 'armor.png': 'blob:armor', 'hair.png': 'blob:hair' };

  it('lists armor then hair with the entity template spriteCut', () => {
    const t = resolveEntityRenderTemplate(spawn, templates, { characters: withOverlays, items, templateImageUrls: urls });
    expect(t?.compositeLayers).toEqual([
      { spriteFile: 'armor.png', spriteCut: { x: 4, y: 2 } },
      { spriteFile: 'hair.png', spriteCut: { x: 4, y: 2 } },
    ]);
  });

  it('carries the weapon offset and angle on its composite layer', () => {
    const withWeapon = [
      character('enemies/blood-priest.character', [
        { name: 'character', properties: { name: 'Blood Priest', bodySprite: 'body.png', hairSprite: 'hair0' } },
        { name: 'equippedItem0', properties: { name: 'Set', type: 'armor', sprite: 'armor.png' } },
        { name: 'equippedItem1', properties: { name: 'Sword', type: 'weapon', sprite: 'weapon.png', equippedAngle: -20, equipOffsetX: -36, equipOffsetY: -4 } },
      ]),
    ];
    const t = resolveEntityRenderTemplate(spawn, templates, {
      characters: withWeapon,
      items,
      templateImageUrls: { ...urls, 'weapon.png': 'blob:weapon' },
    });
    const layers = t?.compositeLayers ?? [];
    expect(layers[0]).toEqual({ spriteFile: 'weapon.png', behind: true, spriteCut: { x: 1, y: 1 }, offset: { x: -36, y: -4 }, angle: -20 });
  });

  it('drops overlays whose image is missing', () => {
    const noArmor = { 'body.png': urls['body.png'], 'hair.png': urls['hair.png'] };
    const t = resolveEntityRenderTemplate(spawn, templates, { characters: withOverlays, items, templateImageUrls: noArmor });
    expect(t?.compositeLayers?.map(l => l.spriteFile)).toEqual(['hair.png']);
  });

  it('uses the normal armor and no hair when keepClassHelm is false', () => {
    const santaItems: ProjectItemEntry[] = [{
      name: 'npc-head.enml',
      relativePath: 'npc-head.enml',
      handle: {} as ProjectItemEntry['handle'],
      objects: [{ name: 'femaleCastleGuard0', properties: { sprite: 'hair_guard.png' } }],
    }];
    const santa = [
      character('enemies/blood-priest.character', [
        { name: 'character', properties: { name: 'Santas Minion', bodySprite: 'character_body.png', hairSprite: 'femaleCastleGuard0', keepClassHelm: false } },
        { name: 'equippedItem0', properties: { name: 'Santa Claus', type: 'armor', sprite: 'armor_christmas_2022_A.png', headlessAlternativeSprite: 'armor_christmas_2022_B.png' } },
      ]),
    ];
    const t = resolveEntityRenderTemplate(spawn, templates, {
      characters: santa,
      items: santaItems,
      templateImageUrls: {
        'character_body.png': 'blob:body',
        'armor_christmas_2022_A.png': 'blob:a',
        'armor_christmas_2022_B.png': 'blob:b',
        'hair_guard.png': 'blob:hair',
      },
    });
    expect(t?.compositeLayers?.map(l => l.spriteFile)).toEqual(['armor_christmas_2022_A.png']);
  });

  it('has no compositeLayers when there are no overlays', () => {
    const bodyOnly = [character('enemies/blood-priest.character', [
      { name: 'character', properties: { name: 'X', bodySprite: 'body.png' } },
    ])];
    const t = resolveEntityRenderTemplate(spawn, templates, { characters: bodyOnly, items, templateImageUrls: urls });
    expect(t).not.toBeNull();
    expect(t?.compositeLayers).toBeUndefined();
  });
});
