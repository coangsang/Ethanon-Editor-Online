// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';
import { ProjectPanel } from '../ProjectPanel';
import type { ProjectCharacterEntry, ProjectFileHandle } from '../../types';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

function dummyFileHandle(name: string): ProjectFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => new File([], name),
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  };
}

describe('ProjectPanel with Characters tab', () => {
  beforeEach(() => {
    localStorage.clear();
    useSceneStore.setState({
      projectName: 'TestProject',
      projectStatus: 'ready',
      projectScenes: [],
      projectPrefabs: [],
      templates: {},
      templateImageUrls: {},
      projectSprites: [],
      projectCharacters: [],
      activeSceneName: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the Characters tab with badge count', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'king.character', relativePath: 'bosses/king.character', handle: dummyFileHandle('king.character') },
      { name: 'soldier.character', relativePath: 'allies/soldier.character', handle: dummyFileHandle('soldier.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    render(<ProjectPanel />);

    const charactersTab = screen.getByRole('button', { name: /Characters/i });
    expect(charactersTab).toBeTruthy();
    expect(charactersTab.textContent).toContain('2');
  });

  it('renders characters list when Characters tab is active', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'evil-warlock.character', relativePath: 'bosses/evil-warlock.character', handle: dummyFileHandle('evil-warlock.character') },
      { name: 'hero.character', relativePath: 'hero.character', handle: dummyFileHandle('hero.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    render(<ProjectPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText('evil-warlock')).toBeTruthy();
    expect(screen.getByText('bosses/')).toBeTruthy();

    expect(screen.getByText('hero')).toBeTruthy();
    expect(screen.getByText('/')).toBeTruthy();

    const warlockCard = screen.getByTitle('npcs/bosses/evil-warlock.character');
    expect(warlockCard).toBeTruthy();
    expect(warlockCard.textContent).toContain('C');
  });

  it('renders the character bodySprite as a thumbnail in grid and list views', () => {
    const character: ProjectCharacterEntry = {
      name: 'dude-guard.character',
      relativePath: 'guards/dude-guard.character',
      handle: dummyFileHandle('dude-guard.character'),
      objects: [
        {
          name: 'character',
          properties: {
            name: 'Dude Guard',
            bodySprite: 'character_body.png',
            hairSprite: 'castleGuard1',
          },
        },
      ],
    };

    useSceneStore.setState({
      projectCharacters: [character],
      templateImageUrls: {
        'character_body.png': 'blob:character-body',
      },
    });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    const gridThumbnail = screen.getByRole('img', { name: 'dude-guard preview' });
    expect(gridThumbnail.getAttribute('src')).toBe('blob:character-body');

    fireEvent.click(screen.getByRole('button', { name: /List View/i }));

    const listThumbnail = screen.getByRole('img', { name: 'dude-guard preview' });
    expect(listThumbnail.getAttribute('src')).toBe('blob:character-body');
  });

  it('falls back to the character icon when the bodySprite image fails to load', () => {
    const character: ProjectCharacterEntry = {
      name: 'missing-body.character',
      relativePath: 'missing-body.character',
      handle: dummyFileHandle('missing-body.character'),
      objects: [
        {
          name: 'character',
          properties: { bodySprite: 'missing.png' },
        },
      ],
    };

    useSceneStore.setState({
      projectCharacters: [character],
      templateImageUrls: { 'missing.png': 'blob:missing-body' },
    });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    fireEvent.error(
      screen.getByRole('img', { name: 'missing-body preview' }),
    );

    const characterCard = screen.getByTitle('npcs/missing-body.character');
    expect(characterCard.textContent).toContain('C');
    expect(screen.queryByRole('img', { name: 'missing-body preview' })).toBeNull();
  });

  it('restores Characters tab from localStorage', () => {
    localStorage.setItem('ethanon_project_active_item', 'characters');
    useSceneStore.setState({
      projectCharacters: [
        { name: 'fighter.character', relativePath: 'fighters/fighter.character', handle: dummyFileHandle('fighter.character') },
      ],
    });

    render(<ProjectPanel />);

    expect(screen.getByText('fighter')).toBeTruthy();
    expect(screen.getByText('fighters/')).toBeTruthy();
  });

  it('displays empty state when project is open but has no characters', () => {
    render(<ProjectPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText(/No characters in/i)).toBeTruthy();
    expect(screen.getByText('/npcs')).toBeTruthy();
  });

  it('displays empty state when no project is open', () => {
    useSceneStore.setState({ projectName: null });

    render(<ProjectPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText('No project open')).toBeTruthy();
  });

  it('does not trigger any action when clicking a character card', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'rogue.character', relativePath: 'allies/rogue.character', handle: dummyFileHandle('rogue.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    const openProjectSceneSpy = vi.spyOn(useSceneStore.getState(), 'openProjectScene');
    const setPlacingPrefabSpy = vi.spyOn(useSceneStore.getState(), 'setPlacingPrefab');

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    const rogueCard = screen.getByTitle('npcs/allies/rogue.character');
    fireEvent.click(rogueCard);

    expect(openProjectSceneSpy).not.toHaveBeenCalled();
    expect(setPlacingPrefabSpy).not.toHaveBeenCalled();
  });
  it('trims .Character extension case-insensitively and falls back if filename is only .character', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'Paladin.Character', relativePath: 'Paladin.Character', handle: dummyFileHandle('Paladin.Character') },
      { name: '.character', relativePath: '.character', handle: dummyFileHandle('.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText('Paladin')).toBeTruthy();
    expect(screen.getByText('.character')).toBeTruthy();

    const paladinCard = screen.getByTitle('npcs/Paladin.Character');
    expect(paladinCard.className).toContain('project-resource-card-static');
  });

  it('filters characters using the search input', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'boss-dragon.character', relativePath: 'bosses/boss-dragon.character', handle: dummyFileHandle('boss-dragon.character') },
      { name: 'goblin.character', relativePath: 'enemies/goblin.character', handle: dummyFileHandle('goblin.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText('boss-dragon')).toBeTruthy();
    expect(screen.getByText('goblin')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Filter characters (.character)...');
    fireEvent.change(searchInput, { target: { value: 'dragon' } });

    expect(screen.getByText('boss-dragon')).toBeTruthy();
    expect(screen.queryByText('goblin')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No matching characters found')).toBeTruthy();
  });

  it('toggles between grid and list view for characters and persists in localStorage', () => {
    const chars: ProjectCharacterEntry[] = [
      { name: 'soldier.character', relativePath: 'allies/soldier.character', handle: dummyFileHandle('soldier.character') },
    ];
    useSceneStore.setState({ projectCharacters: chars });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    const listViewButton = screen.getByRole('button', { name: /List View/i });
    fireEvent.click(listViewButton);

    expect(localStorage.getItem('ethanon_character_view_mode')).toBe('list');
    expect(screen.getByText('.character')).toBeTruthy();

    const gridViewButton = screen.getByRole('button', { name: /Grid View/i });
    fireEvent.click(gridViewButton);

    expect(localStorage.getItem('ethanon_character_view_mode')).toBe('grid');
  });
});

describe('ProjectPanel with Scenes tab', () => {
  beforeEach(() => {
    localStorage.clear();
    useSceneStore.setState({
      projectName: 'TestProject',
      projectStatus: 'ready',
      projectScenes: [],
      projectPrefabs: [],
      templates: {},
      projectSprites: [],
      projectCharacters: [],
      activeSceneName: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders scenes tab with badge count and filters scenes', () => {
    const scenes = [
      { name: 'dungeon0.esc', handle: dummyFileHandle('dungeon0.esc') },
      { name: 'cave.esc', handle: dummyFileHandle('cave.esc') },
    ];
    useSceneStore.setState({ projectScenes: scenes, activeSceneName: null });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Scenes/i }));

    expect(screen.getByText('dungeon0')).toBeTruthy();
    expect(screen.getByText('cave')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Filter scenes (.esc)...');
    fireEvent.change(searchInput, { target: { value: 'cave' } });

    expect(screen.getByText('cave')).toBeTruthy();
    expect(screen.queryByText('dungeon0')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'nothing' } });
    expect(screen.getByText('No matching scenes found')).toBeTruthy();
  });

  it('toggles grid and list view for scenes and persists in localStorage', () => {
    const scenes = [
      { name: 'level1.esc', handle: dummyFileHandle('level1.esc') },
    ];
    useSceneStore.setState({ projectScenes: scenes });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Scenes/i }));

    const listViewBtn = screen.getByRole('button', { name: /List View/i });
    fireEvent.click(listViewBtn);

    expect(localStorage.getItem('ethanon_scene_view_mode')).toBe('list');
    expect(screen.getByText('Click to open')).toBeTruthy();

    const gridViewBtn = screen.getByRole('button', { name: /Grid View/i });
    fireEvent.click(gridViewBtn);

    expect(localStorage.getItem('ethanon_scene_view_mode')).toBe('grid');
  });

  it('calls openProjectScene when clicking a non-active scene', () => {
    const scenes = [
      { name: 'stage1.esc', handle: dummyFileHandle('stage1.esc') },
    ];
    useSceneStore.setState({ projectScenes: scenes, activeSceneName: null });

    const openProjectSceneSpy = vi.spyOn(useSceneStore.getState(), 'openProjectScene').mockResolvedValue(undefined as never);

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Scenes/i }));

    const sceneCard = screen.getByTitle('Open stage1.esc');
    fireEvent.click(sceneCard);

    expect(openProjectSceneSpy).toHaveBeenCalledWith('stage1.esc');
  });
});

describe('ProjectPanel with Prefabs tab', () => {
  beforeEach(() => {
    localStorage.clear();
    useSceneStore.setState({
      projectName: 'TestProject',
      projectStatus: 'ready',
      projectScenes: [],
      projectPrefabs: [],
      templates: {},
      projectSprites: [],
      projectCharacters: [],
      activeSceneName: null,
      placingPrefab: null,
      prefabThumbnailUrls: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders prefabs tab and filters by prefab name or child entity name', () => {
    const prefabs = [
      {
        name: 'chest_treasure.prf',
        handle: dummyFileHandle('chest_treasure.prf'),
        entities: [
          { id: 1, entityName: 'chest', editorEntityName: 'chest_body', editorEntityUID: 'u1', position: { x: 0, y: 0, z: 0 }, angle: 0, spriteFrame: 0, hide: false, flipX: false, flipY: false, customData: [] },
          { id: 2, entityName: 'gold', editorEntityName: 'gold_pile', editorEntityUID: 'u2', position: { x: 0, y: 0, z: 0 }, angle: 0, spriteFrame: 0, hide: false, flipX: false, flipY: false, customData: [] },
        ] as any,
      },
      {
        name: 'torch_wall.prf',
        handle: dummyFileHandle('torch_wall.prf'),
        entities: [
          { id: 3, entityName: 'torch', editorEntityName: 'torch_item', editorEntityUID: 'u3', position: { x: 0, y: 0, z: 0 }, angle: 0, spriteFrame: 0, hide: false, flipX: false, flipY: false, customData: [] },
        ] as any,
      },
    ];
    useSceneStore.setState({ projectPrefabs: prefabs });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Prefabs/i }));

    expect(screen.getByText('chest_treasure')).toBeTruthy();
    expect(screen.getByText('torch_wall')).toBeTruthy();

    const searchInput = screen.getByPlaceholderText('Filter prefabs (.prf)...');
    // Filter by child entity name 'gold'
    fireEvent.change(searchInput, { target: { value: 'gold' } });

    expect(screen.getByText('chest_treasure')).toBeTruthy();
    expect(screen.queryByText('torch_wall')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No matching prefabs found')).toBeTruthy();
  });

  it('toggles grid and list view for prefabs and persists in localStorage', () => {
    const prefabs = [
      {
        name: 'gate.prf',
        handle: dummyFileHandle('gate.prf'),
        entities: [{ id: 1, name: 'gate', shape: 'rectangle', position: { x: 0, y: 0, z: 0 } }] as any,
      },
    ];
    useSceneStore.setState({ projectPrefabs: prefabs });

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Prefabs/i }));

    const listViewBtn = screen.getByRole('button', { name: /List View/i });
    fireEvent.click(listViewBtn);

    expect(localStorage.getItem('ethanon_prefab_view_mode')).toBe('list');
    expect(screen.getByText('.prf')).toBeTruthy();

    const gridViewBtn = screen.getByRole('button', { name: /Grid View/i });
    fireEvent.click(gridViewBtn);

    expect(localStorage.getItem('ethanon_prefab_view_mode')).toBe('grid');
  });

  it('toggles placingPrefab when clicking prefab in grid and list views', () => {
    const prefabs = [
      {
        name: 'spikes.prf',
        handle: dummyFileHandle('spikes.prf'),
        entities: [{ id: 1, name: 'spikes_trap', shape: 'rectangle', position: { x: 0, y: 0, z: 0 } }] as any,
      },
    ];
    useSceneStore.setState({ projectPrefabs: prefabs });

    const setPlacingPrefabSpy = vi.spyOn(useSceneStore.getState(), 'setPlacingPrefab');

    render(<ProjectPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Prefabs/i }));

    // Click to start placing
    const card = screen.getByTitle('Click to place spikes.prf on Canvas');
    fireEvent.click(card);

    expect(setPlacingPrefabSpy).toHaveBeenCalledWith({
      name: 'spikes.prf',
      entities: prefabs[0].entities,
    });
  });
});
