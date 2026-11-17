import { describe, expect, it } from 'vitest';
import type { EntityInstance } from '../../types';
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

const fileName = [{ type: 'string', name: 'fileName', value: 'npcs/enemies/blood-priest.character' }];

describe('entity custom render registry', () => {
  it('labels character_spawn with its fileName custom data', () => {
    expect(getEntityCustomLabel(entity('character_spawn', fileName))).toBe('npcs/enemies/blood-priest.character');
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
