import { afterEach, describe, expect, it, vi } from 'vitest';
import { openProjectFolder, rescanProject, type ProjectDirectoryHandle, type ProjectFileHandle } from '../projectFolder';

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
    const refreshed = await rescanProject(root, scenes, entities, opened.prefabsHandle);

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

    const scanned = await rescanProject(root, scenes, entities, null);

    expect(scanned.templateImageUrls['a/shared.png']).toBe('blob:a/shared.png');
    expect(scanned.templateImageUrls['b/shared.png']).toBe('blob:b/shared.png');
    expect(scanned.templateImageUrls['shared.png']).toBe('blob:b/shared.png');
  });
});
