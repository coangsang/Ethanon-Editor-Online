import { afterEach, describe, expect, it, vi } from 'vitest';
import { openProjectFolder, refreshProjectCharacters, rescanProject, type ProjectDirectoryHandle, type ProjectFileHandle } from '../projectFolder';

function textFile(name: string, text: string): ProjectFileHandle {
  const bytes = new TextEncoder().encode(text);
  return {
    kind: 'file',
    name,
    getFile: async () => ({ arrayBuffer: async () => bytes.buffer } as File),
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  };
}

describe('openProjectFolder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not create a prefabs directory while opening a project', async () => {
    const emptyDirectory = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const scenes = emptyDirectory('scenes');
    const entities = emptyDirectory('entities');
    const getDirectoryHandle = vi.fn(async (name: string, options?: { create?: boolean }) => {
      expect(options?.create).not.toBe(true);
      if (name === 'scenes') return scenes;
      if (name === 'entities') return entities;
      throw new Error('Not found');
    });
    const root: ProjectDirectoryHandle = {
      ...emptyDirectory('project'),
      getDirectoryHandle,
      entries: async function* () {
        yield ['scenes', scenes] as [string, ProjectDirectoryHandle];
        yield ['entities', entities] as [string, ProjectDirectoryHandle];
      },
    };
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });

    const loaded = await openProjectFolder();

    expect(loaded.prefabsHandle).toBeNull();
    expect(loaded.scenes).toEqual([]);
    expect(getDirectoryHandle).toHaveBeenCalledWith('prefabs');
  });

  it('finds prefabs added after a project without that directory was opened', async () => {
    const emptyDirectory = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const scenes = emptyDirectory('scenes');
    const entities = emptyDirectory('entities');
    const prefabFile = textFile('added.prf', '<Ethanon><SceneProperties /></Ethanon>');
    const prefabs: ProjectDirectoryHandle = {
      ...emptyDirectory('prefabs'),
      entries: async function* () { yield ['added.prf', prefabFile] as [string, ProjectFileHandle]; },
    };
    let prefabsExist = false;
    const getDirectoryHandle = vi.fn(async (name: string, options?: { create?: boolean }) => {
      expect(options?.create).not.toBe(true);
      if (name === 'scenes') return scenes;
      if (name === 'entities') return entities;
      if (name === 'prefabs' && prefabsExist) return prefabs;
      throw new Error('Not found');
    });
    const root: ProjectDirectoryHandle = {
      ...emptyDirectory('project'),
      getDirectoryHandle,
      entries: async function* () {
        yield ['scenes', scenes] as [string, ProjectDirectoryHandle];
        yield ['entities', entities] as [string, ProjectDirectoryHandle];
      },
    };
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });

    const opened = await openProjectFolder();
    expect(opened.prefabsHandle).toBeNull();

    prefabsExist = true;
    const refreshed = await rescanProject(root, scenes, entities);

    expect(refreshed.prefabsHandle).toBe(prefabs);
    expect(refreshed.prefabs.map(prefab => prefab.name)).toEqual(['added.prf']);
    expect(getDirectoryHandle).not.toHaveBeenCalledWith('prefabs', { create: true });
  });

  it('registers duplicate image aliases in a stable path order despite different read times', async () => {
    const image = (path: string, delay: number): ProjectFileHandle => ({
      kind: 'file',
      name: 'shared.png',
      getFile: async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { name: path } as File;
      },
      createWritable: async () => { throw new Error('Read only'); },
    });
    const directory = (name: string, handle: ProjectFileHandle): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => handle,
      entries: async function* () { yield ['shared.png', handle] as [string, ProjectFileHandle]; },
    });
    const a = directory('a', image('a/shared.png', 20));
    const b = directory('b', image('b/shared.png', 0));
    const entities: ProjectDirectoryHandle = {
      ...a,
      name: 'entities',
      entries: async function* () {
        yield ['a', a] as [string, ProjectDirectoryHandle];
        yield ['b', b] as [string, ProjectDirectoryHandle];
      },
    };
    const scenes: ProjectDirectoryHandle = { ...a, name: 'scenes', entries: async function* () {} };
    const root: ProjectDirectoryHandle = {
      ...a,
      name: 'project',
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    };
    vi.spyOn(URL, 'createObjectURL').mockImplementation(file => `blob:${(file as File).name}`);

    const scanned = await rescanProject(root, scenes, entities);

    expect(scanned.templateImageUrls['a/shared.png']).toBe('blob:a/shared.png');
    expect(scanned.templateImageUrls['b/shared.png']).toBe('blob:b/shared.png');
    expect(scanned.templateImageUrls['shared.png']).toBe('blob:b/shared.png');
  });

  it('recursively scans npcs, filters out non-character files, preserves duplicate basenames in different folders, and sorts stably', async () => {
    const emptyDirectory = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const scenes = emptyDirectory('scenes');
    const entities = emptyDirectory('entities');

    const alliesDir: ProjectDirectoryHandle = {
      ...emptyDirectory('allies'),
      entries: async function* () {
        yield ['king.character', textFile('king.character', '')] as [string, ProjectFileHandle];
        yield ['companion.character', textFile('companion.character', '')] as [string, ProjectFileHandle];
        yield ['allies.list', textFile('allies.list', '')] as [string, ProjectFileHandle];
      },
    };

    const bossesDir: ProjectDirectoryHandle = {
      ...emptyDirectory('bosses'),
      entries: async function* () {
        yield ['king.character', textFile('king.character', '')] as [string, ProjectFileHandle];
        yield ['evil-warlock.character', textFile('evil-warlock.character', '')] as [string, ProjectFileHandle];
        yield ['checksum.hash', textFile('checksum.hash', '')] as [string, ProjectFileHandle];
      },
    };

    const npcsDir: ProjectDirectoryHandle = {
      ...emptyDirectory('npcs'),
      entries: async function* () {
        yield ['allies', alliesDir] as [string, ProjectDirectoryHandle];
        yield ['bosses', bossesDir] as [string, ProjectDirectoryHandle];
        yield ['hero.character', textFile('hero.character', '')] as [string, ProjectFileHandle];
        yield ['npcs.list0', textFile('npcs.list0', '')] as [string, ProjectFileHandle];
        yield ['npcs.list1', textFile('npcs.list1', '')] as [string, ProjectFileHandle];
      },
    };

    const root: ProjectDirectoryHandle = {
      ...emptyDirectory('project'),
      getDirectoryHandle: async (name: string) => {
        if (name === 'scenes') return scenes;
        if (name === 'entities') return entities;
        if (name === 'npcs') return npcsDir;
        throw new Error('Not found');
      },
      entries: async function* () {
        yield ['scenes', scenes] as [string, ProjectDirectoryHandle];
        yield ['entities', entities] as [string, ProjectDirectoryHandle];
        yield ['npcs', npcsDir] as [string, ProjectDirectoryHandle];
      },
    };
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });

    const loaded = await openProjectFolder();

    expect(loaded.npcsHandle).toBe(npcsDir);
    expect(loaded.characters.map(c => ({ name: c.name, relativePath: c.relativePath }))).toEqual([
      { name: 'companion.character', relativePath: 'allies/companion.character' },
      { name: 'king.character', relativePath: 'allies/king.character' },
      { name: 'evil-warlock.character', relativePath: 'bosses/evil-warlock.character' },
      { name: 'king.character', relativePath: 'bosses/king.character' },
      { name: 'hero.character', relativePath: 'hero.character' },
    ]);
  });

  it('detects npcs directory added after opening a project without it', async () => {
    const emptyDirectory = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const scenes = emptyDirectory('scenes');
    const entities = emptyDirectory('entities');
    const charFile = textFile('warrior.character', '');
    const npcs: ProjectDirectoryHandle = {
      ...emptyDirectory('npcs'),
      entries: async function* () { yield ['warrior.character', charFile] as [string, ProjectFileHandle]; },
    };
    let npcsExist = false;
    const getDirectoryHandle = vi.fn(async (name: string) => {
      if (name === 'scenes') return scenes;
      if (name === 'entities') return entities;
      if (name === 'npcs' && npcsExist) return npcs;
      throw new Error('Not found');
    });
    const root: ProjectDirectoryHandle = {
      ...emptyDirectory('project'),
      getDirectoryHandle,
      entries: async function* () {
        yield ['scenes', scenes] as [string, ProjectDirectoryHandle];
        yield ['entities', entities] as [string, ProjectDirectoryHandle];
      },
    };
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });

    const opened = await openProjectFolder();
    expect(opened.npcsHandle).toBeNull();
    expect(opened.characters).toEqual([]);

    npcsExist = true;
    const refreshed = await rescanProject(root, scenes, entities);

    expect(refreshed.npcsHandle).toBe(npcs);
    expect(refreshed.characters.map(c => c.name)).toEqual(['warrior.character']);
  });
  it('refreshes characters via refreshProjectCharacters with valid handle and null handle', async () => {
    const emptyDir = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const charFile = textFile('archer.character', '');
    const npcs: ProjectDirectoryHandle = {
      ...emptyDir('npcs'),
      entries: async function* () { yield ['archer.character', charFile] as [string, ProjectFileHandle]; },
    };

    const fromNull = await refreshProjectCharacters(null);
    expect(fromNull).toEqual([]);

    const fromHandle = await refreshProjectCharacters(npcs);
    expect(fromHandle.map(c => c.name)).toEqual(['archer.character']);
  });

  it('handles scan error gracefully when npcs directory throws during iteration', async () => {
    const emptyDir = (name: string): ProjectDirectoryHandle => ({
      kind: 'directory',
      name,
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      getFileHandle: async () => { throw new Error('Not found'); },
      entries: async function* () {},
    });
    const brokenNpcs: ProjectDirectoryHandle = {
      ...emptyDir('npcs'),
      entries: async function* () {
        yield ['dummy', textFile('dummy', '')] as [string, ProjectFileHandle];
        throw new Error('OS permission denied or directory removed');
      },
    };
    const scenes = emptyDir('scenes');
    const entities = emptyDir('entities');
    const root: ProjectDirectoryHandle = {
      ...emptyDir('project'),
      getDirectoryHandle: async (name: string) => {
        if (name === 'scenes') return scenes;
        if (name === 'entities') return entities;
        if (name === 'npcs') return brokenNpcs;
        throw new Error('Not found');
      },
      entries: async function* () {
        yield ['scenes', scenes] as [string, ProjectDirectoryHandle];
        yield ['entities', entities] as [string, ProjectDirectoryHandle];
        yield ['npcs', brokenNpcs] as [string, ProjectDirectoryHandle];
      },
    };

    const scanned = await rescanProject(root, scenes, entities);
    expect(scanned.npcsHandle).toBe(brokenNpcs);
    expect(scanned.characters).toEqual([]);
  });
});