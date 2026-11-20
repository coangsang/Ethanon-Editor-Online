// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectCharacterEntry } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { Inspector } from '../Inspector';

const SCENE_PROPERTIES = `
  <SceneProperties><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
`;

function entityXml(uid: string, entityName: string, fileName?: string) {
  const customData = fileName
    ? `<CustomData><Variable><Type>string</Type><Name>fileName</Name><Value>${fileName}</Value></Variable></CustomData>`
    : '';
  return `
    <Entity id="1" spriteFrame="0" editorEntityUID="${uid}">
      <EntityName>${entityName}</EntityName><Position x="0" y="0" z="0" angle="0" />
      <Entity>${customData}</Entity>
    </Entity>`;
}

function loadEntity(entityName: string, fileName?: string) {
  useSceneStore.getState().loadScene(
    `<Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>${entityXml('uid-1', entityName, fileName)}</EntitiesInScene></Ethanon>`,
  );
  useSceneStore.getState().selectEntity('uid-1');
}

const BLOOD_PRIEST: ProjectCharacterEntry = {
  name: 'blood-priest.character',
  relativePath: 'enemies/blood-priest.character',
  handle: {} as ProjectCharacterEntry['handle'],
  objects: [{ name: 'character', properties: { name: 'Blood Priest', bodySprite: 'entity/blood_priest.png' } }],
};

afterEach(() => {
  useSceneStore.getState().flushInspectorEdits();
  cleanup();
  useSceneStore.setState({ projectCharacters: [], templateImageUrls: {} });
});

describe('Inspector custom mode', () => {
  it('does not offer custom mode for entities without a custom inspector', () => {
    loadEntity('character_spawn.ent', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    expect(screen.queryByRole('button', { name: 'Character' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom' })).toBeNull();
    expect(screen.getByText('Identity')).toBeTruthy();
  });

  it('switches a character entity between default and custom inspectors', () => {
    useSceneStore.setState({
      projectCharacters: [BLOOD_PRIEST],
      templateImageUrls: { 'entity/blood_priest.png': 'blob:blood-priest' },
    });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);

    const toggle = screen.getByRole('button', { name: 'Character' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Identity')).toBeTruthy();
    expect(screen.queryByText('Character', { selector: '.inspector-section-title' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Identity')).toBeNull();
    expect(screen.getByText('Character', { selector: '.inspector-section-title' })).toBeTruthy();
    expect(screen.getByText('Blood Priest')).toBeTruthy();
    expect(screen.getByText('npcs/enemies/blood-priest.character')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'entity/blood_priest.png' })).toBeTruthy();
    expect(screen.getByAltText('Blood Priest sprite').getAttribute('src')).toBe('blob:blood-priest');

    fireEvent.click(toggle);
    expect(screen.getByText('Identity')).toBeTruthy();
    expect(screen.queryByText('Character', { selector: '.inspector-section-title' })).toBeNull();
  });

  it('shows the file base name and a warning when the character file is missing', () => {
    loadEntity('character_air_attack', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByText('blood-priest')).toBeTruthy();
    expect(screen.getByText('Character file not found in project')).toBeTruthy();
    expect(screen.getByRole('button', { name: '(none)' })).toHaveProperty('disabled', true);
  });

  it('reports a character entity without a fileName', () => {
    loadEntity('character_spawn');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByText('No fileName in custom data')).toBeTruthy();
  });
});
