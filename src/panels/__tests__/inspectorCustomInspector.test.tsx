// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectCharacterEntry, ProjectItemEntry } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { Inspector } from '../Inspector';
import { CHARACTER_RENDER_ENTITY_NAMES, resolveEntityRenderTemplate } from '../../canvas/entityCustomRender';

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
  function loadCharacters() {
    const fileName = 'npcs/enemies/blood-priest.character';
    useSceneStore.setState({ projectCharacters: [BLOOD_PRIEST] });
    useSceneStore.getState().loadScene(`<Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>${[
      ...CHARACTER_RENDER_ENTITY_NAMES.map((name, index) => entityXml(`uid-${index + 1}`, name, fileName)),
      entityXml('other', 'crate'),
      entityXml('extension', 'character_spawn.ent', fileName),
    ].join('')}</EntitiesInScene></Ethanon>`);
    useSceneStore.getState().selectEntity('uid-1');
  }

  it('Alt-clicks a field to set every character uniformly while ordinary clicks stay local', () => {
    loadCharacters();
    useSceneStore.getState().setCharacterRenderFieldEnabled('uid-2', 'body', false);
    useSceneStore.getState().setCharacterRenderFieldEnabled('uid-2', 'name', false);
    const originalScene = useSceneStore.getState().scene;
    const originalXml = useSceneStore.getState().saveScene();
    const history = useSceneStore.getState().history;
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    const body = screen.getByRole('button', { name: 'Render Body in viewport' });
    fireEvent.click(body, { altKey: true });
    const settings = useSceneStore.getState().customRenderSettings;
    for (const entity of originalScene.entities.slice(0, 4)) {
      const uid = entity.editorEntityUID;
      expect(settings[uid]?.fields?.body).toBe(false);
      expect(resolveEntityRenderTemplate(entity, {}, { characters: [BLOOD_PRIEST], settings })?.compositeBaseHidden).toBe(true);
    }
    expect(settings['uid-2']?.fields?.name).toBe(false);
    expect(settings.other).toBeUndefined();
    expect(settings.extension).toBeUndefined();
    fireEvent.click(body);
    expect(useSceneStore.getState().customRenderSettings['uid-1']?.fields?.body).toBe(true);
    expect(useSceneStore.getState().customRenderSettings['uid-2']?.fields?.body).toBe(false);
    fireEvent.click(body, { altKey: true });
    fireEvent.click(body, { altKey: true });
    for (const entity of originalScene.entities.slice(0, 4)) {
      expect(useSceneStore.getState().customRenderSettings[entity.editorEntityUID]?.fields?.body).toBe(true);
    }
    expect(useSceneStore.getState().scene).toBe(originalScene);
    expect(useSceneStore.getState().history).toBe(history);
    expect(useSceneStore.getState().saveScene()).toBe(originalXml);
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);
  });

  it.each(['checkbox', 'label'])('Alt-clicks the master %s for all characters and preserves field choices', target => {
    loadCharacters();
    useSceneStore.getState().setCharacterRenderFieldEnabled('uid-2', 'body', false);
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    const master = screen.getByRole('checkbox', { name: 'Render as Character' });
    const clickTarget = target === 'checkbox' ? master : screen.getByText('Render as Character');
    fireEvent.click(clickTarget, { altKey: true });
    for (const entity of useSceneStore.getState().scene.entities.slice(0, 4)) {
      expect(useSceneStore.getState().customRenderSettings[entity.editorEntityUID]?.enabled).toBe(false);
    }
    expect(useSceneStore.getState().customRenderSettings.other).toBeUndefined();
    expect(useSceneStore.getState().customRenderSettings.extension).toBeUndefined();
    fireEvent.click(clickTarget, { altKey: true });
    for (const entity of useSceneStore.getState().scene.entities.slice(0, 4)) {
      expect(useSceneStore.getState().customRenderSettings[entity.editorEntityUID]?.enabled).toBe(true);
    }
    expect(useSceneStore.getState().customRenderSettings['uid-2']?.fields?.body).toBe(false);
    fireEvent.click(master);
    expect(useSceneStore.getState().customRenderSettings['uid-1']?.enabled).toBe(false);
    expect(useSceneStore.getState().customRenderSettings['uid-2']?.enabled).toBe(true);
  });

  it('Alt-clicks equipment by type even when other characters use different slots', () => {
    loadCharacters();
    const equippedCharacter = (relativePath: string, armorSlot: number): ProjectCharacterEntry => ({
      ...BLOOD_PRIEST, relativePath,
      objects: [
        ...BLOOD_PRIEST.objects!,
        { name: `equippedItem${armorSlot}`, properties: { type: 'armor', sprite: 'armor.png' } },
        { name: `equippedItem${1 - armorSlot}`, properties: { type: 'weapon', sprite: 'weapon.png' } },
      ],
    });
    useSceneStore.setState({
      projectCharacters: [equippedCharacter('enemies/blood-priest.character', 0), equippedCharacter('other.character', 1)],
      templateImageUrls: { 'armor.png': 'blob:armor', 'weapon.png': 'blob:weapon' },
    });
    useSceneStore.getState().updateEntity('uid-2', {
      customData: [{ type: 'string', name: 'fileName', value: 'npcs/other.character' }],
    });
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    fireEvent.click(screen.getByRole('button', { name: 'Render Armor in viewport' }), { altKey: true });
    expect(useSceneStore.getState().customRenderSettings['uid-1']?.fields?.['item:equippedItem0']).toBe(false);
    expect(useSceneStore.getState().customRenderSettings['uid-2']?.fields?.['item:equippedItem1']).toBe(false);
    expect(useSceneStore.getState().customRenderSettings['uid-2']?.fields?.['item:equippedItem0']).toBeUndefined();
    act(() => useSceneStore.getState().selectEntity('uid-2'));
    expect(screen.getByRole('button', { name: 'Render Armor in viewport' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Render Weapon in viewport' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('controls rendering per entity, retains field choices, and never changes saved scene data', () => {
    useSceneStore.setState({ projectCharacters: [BLOOD_PRIEST] });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    const originalScene = useSceneStore.getState().scene;
    const originalXml = useSceneStore.getState().saveScene();
    const originalHistory = useSceneStore.getState().history;
    const view = render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    const master = screen.getByRole('checkbox', { name: 'Render as Character' }) as HTMLInputElement;
    expect(master.checked).toBe(true);
    const body = screen.getByRole('button', { name: 'Render Body in viewport' });
    expect(body.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(body);
    expect(body.getAttribute('aria-pressed')).toBe('false');
    expect(body.querySelector('.lucide-eye-off')).toBeTruthy();
    expect(screen.getByText('entity/blood_priest.png')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Render Name in viewport' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(master);
    expect(master.checked).toBe(false);
    expect((body as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(master);
    expect(body.getAttribute('aria-pressed')).toBe('false');
    expect((body as HTMLButtonElement).disabled).toBe(false);
    expect(useSceneStore.getState().scene).toBe(originalScene);
    expect(useSceneStore.getState().history).toBe(originalHistory);
    expect(useSceneStore.getState().hasUnsavedChanges()).toBe(false);
    expect(useSceneStore.getState().saveScene()).toBe(originalXml);

    // Leaving and reopening the Inspector preserves viewport preferences.
    view.unmount();
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.getByRole('button', { name: 'Render Body in viewport' }).getAttribute('aria-pressed')).toBe('false');

    cleanup();
    // Loading another scene, even with reused UIDs, starts with rendering enabled.
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    expect(useSceneStore.getState().customRenderSettings).toEqual({});
  });

  it.each([[45, 90], [90, 180], [190, 380], [270, 540], [0, 0], ['45', 90]])(
    'shows fieldOfView %s and doubled angle %s with a blue marker', (fieldOfView, total) => {
      useSceneStore.setState({ projectCharacters: [{ ...BLOOD_PRIEST, objects: [
        { name: 'other', properties: { fieldOfView: 999 } },
        { name: 'character', properties: { fieldOfView } },
      ] }] });
      loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
      render(<Inspector />);
      fireEvent.click(screen.getByRole('button', { name: 'Character' }));
      const value = screen.getByLabelText(`Field of View: ${fieldOfView} degrees, ${total} degrees total`);
      expect(value.textContent).toBe(`${fieldOfView}° (${total}° total)`);
      expect((value.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(56, 189, 248)');
      expect(value.title).toContain('not sight range');
    },
  );

  it.each([{}, { fieldOfView: 'invalid' }, { fieldOfView: Infinity }, { fieldOfView: -1 }, { fieldOfView: '-45' }])('hides missing or invalid fieldOfView: %o', properties => {
    useSceneStore.setState({ projectCharacters: [{ ...BLOOD_PRIEST, objects: [
      { name: 'other', properties: { fieldOfView: 45 } }, { name: 'character', properties },
    ] }] });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    expect(screen.queryByText('Field of View')).toBeNull();
  });

  it.each([300, 0, '300'])('shows attack minimum distance %s with an orange marker', attackMinimumDistance => {
    useSceneStore.setState({ projectCharacters: [{ ...BLOOD_PRIEST, objects: [
      { name: 'other', properties: { attackMinimumDistance: 999 } },
      { name: 'character', properties: { attackMinimumDistance } },
    ] }] });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    const value = screen.getByLabelText(`Attack Minimum Distance: ${attackMinimumDistance}`);
    expect(value.textContent).toBe(String(attackMinimumDistance));
    expect((value.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(249, 115, 22)');
  });

  it.each([{}, { attackMinimumDistance: -1 }, { attackMinimumDistance: '-300' }, { attackMinimumDistance: 'invalid' }])(
    'hides missing, negative, or invalid attack minimum distance: %o', properties => {
      useSceneStore.setState({ projectCharacters: [{ ...BLOOD_PRIEST, objects: [
        { name: 'other', properties: { attackMinimumDistance: 300 } }, { name: 'character', properties },
      ] }] });
      loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
      render(<Inspector />);
      fireEvent.click(screen.getByRole('button', { name: 'Character' }));
      expect(screen.queryByText('Attack Minimum Distance')).toBeNull();
    },
  );

  it.each([
    { level: 1, speed: 7.0, jumpImpulse: 35, scale: 1.1 },
    { level: 0, speed: 0, jumpImpulse: 0, scale: 0 },
    { level: '1', speed: '7.0', jumpImpulse: '35', scale: '1.1' },
  ])('shows numeric stats from the character block: %o', properties => {
    useSceneStore.setState({ projectCharacters: [{
      ...BLOOD_PRIEST,
      objects: [
        { name: 'other', properties: { level: 99, speed: 99, jumpImpulse: 99, scale: 99 } },
        { name: 'character', properties },
      ],
    }] });
    loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
    render(<Inspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Character' }));
    for (const [label, value] of [
      ['Level', properties.level], ['Speed', properties.speed],
      ['Jump Impulse', properties.jumpImpulse], ['Scale', properties.scale],
    ]) {
      expect(screen.getByLabelText(`${label}: ${Number(value)}`).textContent).toBe(String(Number(value)));
    }
  });

  it.each([{}, { level: '', speed: 'invalid', jumpImpulse: Infinity, scale: true }])(
    'hides absent or invalid character stats: %o', properties => {
      useSceneStore.setState({ projectCharacters: [{
        ...BLOOD_PRIEST,
        objects: [
          { name: 'other', properties: { level: 99, speed: 99, jumpImpulse: 99, scale: 99 } },
          { name: 'character', properties },
        ],
      }] });
      loadEntity('character_spawn', 'npcs/enemies/blood-priest.character');
      render(<Inspector />);
      fireEvent.click(screen.getByRole('button', { name: 'Character' }));
      for (const label of ['Level', 'Speed', 'Jump Impulse', 'Scale']) {
        expect(screen.queryByText(label)).toBeNull();
      }
    },
  );

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
