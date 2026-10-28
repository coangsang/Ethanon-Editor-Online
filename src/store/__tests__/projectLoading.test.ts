import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openProjectFolder, type ProjectFolderData } from '../../io/projectFolder';
import { useSceneStore } from '../sceneStore';

vi.mock('../../io/projectFolder', async importOriginal => ({
  ...await importOriginal<typeof import('../../io/projectFolder')>(),
  openProjectFolder: vi.fn(),
}));

const mockedOpenProjectFolder = vi.mocked(openProjectFolder);

function textFile(name: string, getText: () => Promise<string>) {
  return {
    kind: 'file' as const,
    name,
    getFile: async () => {
      const text = await getText();
      const bytes = new TextEncoder().encode(text);
      return { arrayBuffer: async () => bytes.buffer } as File;
    },
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  };
}

function project(firstSceneText: () => Promise<string>): ProjectFolderData {
  return {
    rootHandle: { name: 'new-project' } as ProjectFolderData['rootHandle'],
    scenesHandle: {} as ProjectFolderData['scenesHandle'],
    entitiesHandle: {} as ProjectFolderData['entitiesHandle'],
    prefabsHandle: null,
    scenes: [{ name: 'first.esc', handle: textFile('first.esc', firstSceneText) }],
    prefabs: [],
    templates: {},
    templateImageUrls: { 'new.png': 'blob:new-image' },
    templateAtlases: {},
    sprites: [{ name: 'new.png', relativePath: 'new.png', url: 'blob:new-image', hasAtlas: false, usedByTemplates: [] }],
    prefabThumbnailUrls: { 'first.prf': 'blob:new-thumbnail' },
    scanIssues: [],
  };
}

describe('project loading', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockedOpenProjectFolder.mockReset();
    vi.restoreAllMocks();
    useSceneStore.getState().loadScene('<Ethanon><SceneProperties /><EntitiesInScene /></Ethanon>');
    useSceneStore.setState({
      projectName: 'old-project',
      projectStatus: 'ready',
      projectError: null,
      templateImageUrls: { 'old.png': 'blob:old-image' },
      projectSprites: [{ name: 'old.png', relativePath: 'old.png', url: 'blob:old-image', hasAtlas: false, usedByTemplates: [] }],
      prefabThumbnailUrls: { 'old.prf': 'blob:old-thumbnail' },
    });
  });

  it('keeps unsaved edits when the user cancels opening another project', async () => {
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });

    await useSceneStore.getState().openProject();

    expect(confirm).toHaveBeenCalledOnce();
    expect(mockedOpenProjectFolder).not.toHaveBeenCalled();
    expect(useSceneStore.getState().scene.properties.lightIntensity).toBe(4);
    expect(useSceneStore.getState().projectName).toBe('old-project');
  });

  it('does not replace edits made while the new project is loading', async () => {
    mockedOpenProjectFolder.mockResolvedValue(project(async () => {
      useSceneStore.getState().updateSceneProps({ lightIntensity: 5 });
      return '<Ethanon><EntitiesInScene /></Ethanon>';
    }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();

    expect(useSceneStore.getState().projectName).toBe('old-project');
    expect(useSceneStore.getState().scene.properties.lightIntensity).toBe(5);
    expect(useSceneStore.getState().projectError).toContain('changed while the project was loading');
    expect(revoke).toHaveBeenCalledWith('blob:new-image');
    expect(revoke).not.toHaveBeenCalledWith('blob:old-image');
  });

  it('keeps the previous project assets and releases newly scanned assets if its first scene cannot be read', async () => {
    mockedOpenProjectFolder.mockResolvedValue(project(async () => { throw new Error('Scene read failed'); }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();

    expect(useSceneStore.getState().projectName).toBe('old-project');
    expect(useSceneStore.getState().templateImageUrls['old.png']).toBe('blob:old-image');
    expect(useSceneStore.getState().projectError).toBe('Scene read failed');
    expect(revoke).toHaveBeenCalledWith('blob:new-image');
    expect(revoke).toHaveBeenCalledWith('blob:new-thumbnail');
    expect(revoke).not.toHaveBeenCalledWith('blob:old-image');
  });

  it('releases the previous image and thumbnail only after the new project is ready', async () => {
    mockedOpenProjectFolder.mockResolvedValue(project(async () => '<Ethanon><EntitiesInScene /></Ethanon>'));
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();

    expect(useSceneStore.getState().projectName).toBe('new-project');
    expect(useSceneStore.getState().projectStatus).toBe('ready');
    expect(revoke).toHaveBeenCalledWith('blob:old-image');
    expect(revoke).toHaveBeenCalledWith('blob:old-thumbnail');
    expect(revoke).not.toHaveBeenCalledWith('blob:new-image');
  });

  it('keeps the project ready while publishing the latest entity scan issues', async () => {
    mockedOpenProjectFolder.mockResolvedValue({
      ...project(async () => '<Ethanon><EntitiesInScene /></Ethanon>'),
      scanIssues: [{ path: 'broken.ent', stage: 'parse', message: 'Missing Entity root' }],
    });

    await useSceneStore.getState().openProject();

    expect(useSceneStore.getState().projectStatus).toBe('ready');
    expect(useSceneStore.getState().projectScanIssues).toEqual([
      { path: 'broken.ent', stage: 'parse', message: 'Missing Entity root' },
    ]);

    mockedOpenProjectFolder.mockResolvedValue(project(async () => '<Ethanon><EntitiesInScene /></Ethanon>'));
    await useSceneStore.getState().openProject();
    expect(useSceneStore.getState().projectScanIssues).toEqual([]);
  });

  it('releases the old native project session only after the replacement succeeds', async () => {
    const releaseOld = vi.fn(async () => {});
    const releaseNew = vi.fn(async () => {});
    useSceneStore.setState({ rootHandle: { name: 'old-project', release: releaseOld } as ProjectFolderData['rootHandle'] });
    mockedOpenProjectFolder.mockResolvedValue({
      ...project(async () => '<Ethanon><EntitiesInScene /></Ethanon>'),
      rootHandle: { name: 'new-project', release: releaseNew } as ProjectFolderData['rootHandle'],
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();

    expect(releaseOld).toHaveBeenCalledOnce();
    expect(releaseNew).not.toHaveBeenCalled();
  });

  it('releases a failed new native project session and keeps the old one', async () => {
    const releaseOld = vi.fn(async () => {});
    const releaseNew = vi.fn(async () => {});
    useSceneStore.setState({ rootHandle: { name: 'old-project', release: releaseOld } as ProjectFolderData['rootHandle'] });
    mockedOpenProjectFolder.mockResolvedValue({
      ...project(async () => { throw new Error('Scene read failed'); }),
      rootHandle: { name: 'new-project', release: releaseNew } as ProjectFolderData['rootHandle'],
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();

    expect(releaseNew).toHaveBeenCalledOnce();
    expect(releaseOld).not.toHaveBeenCalled();
  });

  it('refreshes prefabs created after opening a project without a prefabs directory', async () => {
    const sceneFile = textFile('first.esc', async () => '<Ethanon><EntitiesInScene /></Ethanon>');
    const prefabFile = textFile('added.prf', async () => '<Ethanon><SceneProperties /></Ethanon>');
    const scenesHandle = {
      entries: async function* () { yield ['first.esc', sceneFile] as const; },
    } as ProjectFolderData['scenesHandle'];
    const entitiesHandle = {
      entries: async function* () {},
    } as ProjectFolderData['entitiesHandle'];
    const prefabsHandle = {
      getDirectoryHandle: async () => { throw new Error('Not found'); },
      entries: async function* () { yield ['added.prf', prefabFile] as const; },
    } as ProjectFolderData['prefabsHandle'];
    let prefabsExist = false;
    const rootHandle = {
      name: 'new-project',
      getDirectoryHandle: async (name: string) => {
        if (name === 'prefabs' && prefabsExist) return prefabsHandle;
        throw new Error('Not found');
      },
      entries: async function* () {},
    } as ProjectFolderData['rootHandle'];
    mockedOpenProjectFolder.mockResolvedValue({
      ...project(async () => '<Ethanon><EntitiesInScene /></Ethanon>'),
      rootHandle,
      scenesHandle,
      entitiesHandle,
      prefabsHandle: null,
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await useSceneStore.getState().openProject();
    expect(useSceneStore.getState().prefabsHandle).toBeNull();

    prefabsExist = true;
    await useSceneStore.getState().refreshProject();

    expect(useSceneStore.getState().prefabsHandle).toBe(prefabsHandle);
    expect(useSceneStore.getState().projectPrefabs.map(prefab => prefab.name)).toEqual(['added.prf']);
    expect(useSceneStore.getState().projectStatus).toBe('ready');
  });

  it('keeps a successfully saved scene active when refreshing the scene list fails', async () => {
    const newHandle = {
      kind: 'file',
      name: 'copy.esc',
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    } as ProjectFolderData['scenes'][number]['handle'];
    const oldHandle = textFile('old.esc', async () => '<Ethanon><EntitiesInScene /></Ethanon>');
    const scenesHandle = {
      getFileHandle: async () => newHandle,
      entries: async function* () { yield* []; throw new Error('Directory read failed'); },
    } as ProjectFolderData['scenesHandle'];
    useSceneStore.setState({
      scenesHandle,
      activeSceneName: 'old.esc',
      activeSceneHandle: oldHandle,
      projectScenes: [{ name: 'old.esc', handle: oldHandle }],
    });
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });

    await useSceneStore.getState().saveSceneAs('copy.esc');

    const saved = useSceneStore.getState();
    expect(saved.activeSceneName).toBe('copy.esc');
    expect(saved.activeSceneHandle).toBe(newHandle);
    expect(saved.projectScenes.map(scene => scene.name)).toEqual(['copy.esc', 'old.esc']);
    expect(saved.projectStatus).toBe('ready');
    expect(saved.projectError).toContain('Directory read failed');

    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });
    await useSceneStore.getState().openProjectScene('old.esc');
    expect(confirm).not.toHaveBeenCalled();
    expect(useSceneStore.getState().activeSceneName).toBe('old.esc');
  });

  it('keeps the old active scene and unsaved warning when Save As cannot write', async () => {
    const newHandle = {
      kind: 'file',
      name: 'copy.esc',
      createWritable: async () => { throw new Error('Disk full'); },
    } as ProjectFolderData['scenes'][number]['handle'];
    const oldHandle = textFile('old.esc', async () => '<Ethanon><EntitiesInScene /></Ethanon>');
    const otherHandle = textFile('other.esc', async () => '<Ethanon><EntitiesInScene /></Ethanon>');
    useSceneStore.setState({
      scenesHandle: { getFileHandle: async () => newHandle } as ProjectFolderData['scenesHandle'],
      activeSceneName: 'old.esc',
      activeSceneHandle: oldHandle,
      projectScenes: [
        { name: 'old.esc', handle: oldHandle },
        { name: 'other.esc', handle: otherHandle },
      ],
    });
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });

    await useSceneStore.getState().saveSceneAs('copy.esc');

    expect(useSceneStore.getState().activeSceneHandle).toBe(oldHandle);
    expect(useSceneStore.getState().projectScenes.map(scene => scene.name)).toEqual(['old.esc', 'other.esc']);
    expect(useSceneStore.getState().projectError).toBe('Disk full');

    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });
    await useSceneStore.getState().openProjectScene('other.esc');
    expect(confirm).toHaveBeenCalledOnce();
    expect(useSceneStore.getState().activeSceneHandle).toBe(oldHandle);
  });
});
