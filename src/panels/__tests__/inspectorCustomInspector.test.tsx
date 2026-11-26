// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectCharacterEntry, ProjectItemEntry } from '../../types';
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
  useSceneStore.setState({ projectCharacters: [], projectItems: [], templateImageUrls: {} });
});

describe('Inspector custom mode', () => {
  it.each([[40, '2'], [50, '2.5'], [0, '0'], [41, '2.05']])('shows %s res with x%s hearts', (resistance, hearts) => {
    useSceneStore.setState({ projectCharacters: [{
      ...BLOOD_PRIEST,
      objects: [{ name: 'character', properties: { name: 'Blood Priest', resistance } }],
    }] });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    const value = screen.getByLabelText(`${resistance} resistance, ${hearts} hearts`);
    expect(value.textContent).toContain(`x${hearts}`);
    expect(value.querySelector('svg.lucide-heart')).toBeTruthy();
  });

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
    expect(screen.queryByText('Resistance')).toBeNull();
    expect(screen.getByText('npcs/enemies/blood-priest.character')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'entity/blood_priest.png' })).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(document.querySelector('.inspector-section img')).toBeNull();

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

  it('shows the hair sprite from items .enml when its image exists', () => {
    const alien: ProjectCharacterEntry = {
      name: 'alien.character',
      relativePath: 'enemies/alien.character',
      handle: {} as ProjectCharacterEntry['handle'],
      objects: [{ name: 'character', properties: { name: 'Alien', bodySprite: 'entity/alien.png', hairSprite: 'alien0' } }],
    };
    const npcHead: ProjectItemEntry = {
      name: 'npc-head.enml',
      relativePath: 'npc-head.enml',
      handle: {} as ProjectItemEntry['handle'],
      objects: [{ name: 'alien0', properties: { name: 'alien0', type: 'head', secondaryType: 'hair', sprite: 'hair_6.png' } }],
    };
    useSceneStore.setState({
      projectCharacters: [alien],
      projectItems: [npcHead],
      templateImageUrls: { 'entity/alien.png': 'blob:alien', 'hair_6.png': 'blob:hair' },
    });
    loadEntity('character_spawn', 'npcs/enemies/alien.character');
    const { unmount } = render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByRole('button', { name: 'hair_6.png' })).toBeTruthy();
    unmount();

    // Hidden when the hair image was not loaded from entities.
    useSceneStore.setState({ templateImageUrls: { 'entity/alien.png': 'blob:alien' } });
    render(<Inspector />);
    if (screen.getByRole('button', { name: 'Character' }).getAttribute('aria-pressed') !== 'true') {
      fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    }
    expect(screen.queryByText('Hair')).toBeNull();
  });

  it('shows equipped item sprites only when their image is loaded', () => {
    const knight: ProjectCharacterEntry = {
      name: 'knight.character',
      relativePath: 'enemies/knight.character',
      handle: {} as ProjectCharacterEntry['handle'],
      objects: [
        { name: 'character', properties: { name: 'Knight', bodySprite: 'entity/knight.png' } },
        { name: 'equippedItem0', properties: { name: 'Xmas Armor', type: 'armor', sprite: 'armor_christmas_2022_A.png' } },
        { name: 'equippedItem1', properties: { name: 'Sword', type: 'weapon', sprite: 'sword.png' } },
      ],
    };
    useSceneStore.setState({
      projectCharacters: [knight],
      templateImageUrls: { 'entity/knight.png': 'blob:knight', 'armor_christmas_2022_A.png': 'blob:armor' },
    });
    loadEntity('character_spawn', 'npcs/enemies/knight.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByText('Armor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'armor_christmas_2022_A.png' })).toBeTruthy();
    expect(screen.queryByText('Weapon')).toBeNull();
    expect(screen.queryByRole('button', { name: 'sword.png' })).toBeNull();
  });

  it('reports a character entity without a fileName', () => {
    loadEntity('character_spawn');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByText('No fileName in custom data')).toBeTruthy();
  });

  it('shows eyeColor as a swatch and RGB value, and hides it when unset', () => {
    useSceneStore.setState({
      projectCharacters: [{ ...BLOOD_PRIEST, objects: [{
        name: 'character', properties: { eyeColor: 4294901760 },
      }] }],
    });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByText('Eye Color')).toBeTruthy();
    const value = screen.getByTitle('eyeColor (multiplied into Eyes)');
    expect(value.textContent).toBe('#FF0000');
    expect((value.previousElementSibling as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');

    cleanup();
    useSceneStore.setState({ projectCharacters: [BLOOD_PRIEST] });
    render(<Inspector />);
    if (screen.getByRole('button', { name: 'Character' }).getAttribute('aria-pressed') !== 'true') {
      fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    }
    expect(screen.queryByText('Eye Color')).toBeNull();
  });
});
