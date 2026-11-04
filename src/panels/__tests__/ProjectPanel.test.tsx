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
});