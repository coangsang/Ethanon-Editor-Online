import { describe, expect, it } from 'vitest';
import type { EntityInstance, ProjectCharacterEntry } from '../../types';
import { getEntityCustomLabel, getEntityCustomRenderer } from '../entityCustomRender';

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
