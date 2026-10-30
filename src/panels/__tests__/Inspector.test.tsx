// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityTemplate } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { entityHasFileNameTag } from '../../utils/entityTemplate';
import { Inspector } from '../Inspector';

const SCENE_PROPERTIES = `
  <SceneProperties><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
`;

afterEach(() => {
  useSceneStore.getState().flushInspectorEdits();
  cleanup();
  vi.useRealTimers();
  useSceneStore.setState({ templates: {}, templateAtlases: {} });
});

describe('Inspector pending edit interactions', () => {
  it('shows each entity values when selection changes', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="first">
          <EntityName>first</EntityName><Position x="10" y="0" z="0" angle="0" />
          <Entity><Sprite>first.png</Sprite><SpriteCut x="1" y="1" /></Entity>
        </Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="second">
          <EntityName>second</EntityName><Position x="25" y="0" z="0" angle="0" />
          <Entity><Sprite>second.png</Sprite><SpriteCut x="1" y="1" /></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('first');
    render(<Inspector />);

    expect((screen.getByRole('spinbutton', { name: 'Position X' }) as HTMLInputElement).value).toBe('10');
    act(() => useSceneStore.getState().selectEntity('second'));
    expect((screen.getByRole('spinbutton', { name: 'Position X' }) as HTMLInputElement).value).toBe('25');
    expect((screen.getByPlaceholderText('Entity Name...') as HTMLInputElement).value).toBe('second');
    act(() => useSceneStore.getState().selectEntity('first'));
    expect((screen.getByRole('spinbutton', { name: 'Position X' }) as HTMLInputElement).value).toBe('10');
  });

  it('refreshes selected values from external edits without clearing a pending local edit on unrelated renders', () => {
    vi.useFakeTimers();
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="inline-entity">
          <EntityName>inline-entity</EntityName>
          <Position x="0" y="0" z="0" angle="0" />
          <Entity><Sprite>sprite.png</Sprite><SpriteCut x="3" y="1" /></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('inline-entity');
    const { rerender } = render(<Inspector />);

    act(() => useSceneStore.getState().updateEntity('inline-entity', {
      editorEntityName: 'Updated externally',
      position: { x: 12, y: 0, z: 0 },
      spriteFrame: 2,
      diffuseColor: { r: 1, g: 0, b: 0, a: 1 },
      customData: [{ type: 'string', name: 'note', value: 'external' }],
    }));
    expect((screen.getByPlaceholderText('Editor Entity Name...') as HTMLInputElement).value).toBe('Updated externally');
    expect((screen.getByRole('spinbutton', { name: 'Position X' }) as HTMLInputElement).value).toBe('12');
    expect(screen.getByText('note')).toBeTruthy();
    expect((screen.getByDisplayValue('external') as HTMLInputElement).value).toBe('external');
    expect((document.querySelector('input[type="color"]') as HTMLInputElement).value).toBe('#ff0000');

    const frame = screen.getByDisplayValue('2') as HTMLInputElement;
    fireEvent.change(frame, { target: { value: '1' } });
    expect(frame.value).toBe('1');
    rerender(<Inspector />);
    expect(frame.value).toBe('1');
    act(() => vi.advanceTimersByTime(250));
    expect(useSceneStore.getState().scene.entities[0].spriteFrame).toBe(1);
  });

  it('keeps rapid Sprite Cut wheel edits visible and commits the final value once', () => {
    vi.useFakeTimers();
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="inline-entity">
          <EntityName>inline-entity</EntityName>
          <Position x="0" y="0" z="0" angle="0" />
          <Entity><Sprite>sprite.png</Sprite><SpriteCut x="1" y="1" /></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('inline-entity');
    const historyLength = useSceneStore.getState().history.length;

    render(<Inspector />);
    const cutX = screen.getByRole('spinbutton', { name: 'Sprite Cut X' }) as HTMLInputElement;

    fireEvent.wheel(cutX, { deltaY: -1 });
    fireEvent.wheel(cutX, { deltaY: -1 });
    fireEvent.wheel(cutX, { deltaY: -1 });

    expect(cutX.value).toBe('4');
    expect(useSceneStore.getState().scene.entities[0].inlineTemplate?.spriteCut?.x).toBe(1);

    act(() => vi.advanceTimersByTime(250));

    expect(useSceneStore.getState().scene.entities[0].inlineTemplate?.spriteCut).toEqual({ x: 4, y: 1 });
    expect(useSceneStore.getState().history).toHaveLength(historyLength + 1);
  });

  it('uses the shared color control for diffuse RGBA edits, presets, and reset', () => {
    vi.useFakeTimers();
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="inline-entity">
          <EntityName>inline-entity</EntityName>
          <Position x="0" y="0" z="0" angle="0" />
          <Entity><Sprite>sprite.png</Sprite><SpriteCut x="1" y="1" /></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('inline-entity');
    render(<Inspector />);

    expect(screen.getByLabelText('Diffuse Color alpha')).toBeTruthy();
    expect(screen.getByLabelText('Diffuse Color A')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Diffuse Color: Red'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    act(() => vi.advanceTimersByTime(250));
    expect(useSceneStore.getState().scene.entities[0].diffuseColor).toEqual({ r: 1, g: 1, b: 1, a: 1 });

    fireEvent.click(screen.getByRole('button', { name: '0.0 - 1.0' }));
    expect((screen.getByLabelText('Diffuse Color A') as HTMLInputElement).value).toBe('255');
    fireEvent.change(screen.getByLabelText('Diffuse Color A'), { target: { value: '128' } });
    act(() => vi.advanceTimersByTime(250));
    expect(useSceneStore.getState().scene.entities[0].diffuseColor?.a).toBeCloseTo(0.502, 3);
  });

  it('unpacks the entity from refreshed state after flushing pending custom data', () => {
    const template: EntityTemplate = {
      name: 'packed-entity',
      spriteFile: 'packed.png',
      spriteCut: { x: 1, y: 1 },
      type: 'horizontal',
      pivotAdjust: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      parallaxIntensity: 1,
      blendMode: 0,
      customData: [{ type: 'int', name: 'health', value: '10' }],
    };
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="packed-entity">
          <EntityName>packed-entity</EntityName>
          <Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>packed-entity.ent</FileName></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.setState({ templates: { 'packed-entity': template } });
    useSceneStore.getState().selectEntity('packed-entity');
    useSceneStore.getState().queueInspectorEdit('packed-entity', 'customData', entity => ({
      ...entity,
      customData: [{ type: 'int', name: 'health', value: '25' }],
    }));

    render(<Inspector />);
    expect(screen.queryByLabelText('Diffuse Color color picker')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Unpack/i }));

    const unpacked = useSceneStore.getState().scene.entities[0];
    expect(entityHasFileNameTag(unpacked)).toBe(false);
    expect(unpacked.customData).toEqual([{ type: 'int', name: 'health', value: '25' }]);
  });

  it('creates referenced custom data via modal, disables chained (ref) options, syncs on updates, and supports unlink', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="7" spriteFrame="0" editorEntityUID="uid-origin" editorEntityName="Origin">
          <EntityName>origin.ent</EntityName>
          <Position x="0" y="0" z="0" angle="0" />
          <Entity>
            <FileName>origin.ent</FileName>
            <CustomData>
              <Variable><Type>string</Type><Name>baseMat</Name><Value>obsidian</Value></Variable>
            </CustomData>
          </Entity>
        </Entity>
        <Entity id="8" spriteFrame="0" editorEntityUID="uid-middle" editorEntityName="Middle">
          <EntityName>middle.ent</EntityName>
          <Position x="10" y="0" z="0" angle="0" />
          <Entity>
            <FileName>middle.ent</FileName>
            <CustomData>
              <Variable><Type>string</Type><Name>normalVar</Name><Value>iron</Value></Variable>
              <Variable>
                <Type>string</Type>
                <Name>alreadyRef</Name>
                <Value refEditorUID="uid-origin" refType="customData" refValue="baseMat">obsidian</Value>
              </Variable>
            </CustomData>
          </Entity>
        </Entity>
        <Entity id="9" spriteFrame="0" editorEntityUID="uid-consumer" editorEntityName="Consumer">
          <EntityName>consumer.ent</EntityName>
          <Position x="20" y="0" z="0" angle="0" />
          <Entity><FileName>consumer.ent</FileName></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    useSceneStore.getState().selectEntity('uid-consumer');
    render(<Inspector />);

    // Open Add Custom Data form
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Custom Data/i }));
    fireEvent.change(screen.getByPlaceholderText('Variable name...'), { target: { value: 'linkedMat' } });
    fireEvent.click(screen.getByLabelText('Reference Custom Data'));

    // Open Entity Picker Modal and select "Middle"
    fireEvent.click(screen.getByRole('button', { name: 'Select EID' }));
    expect(screen.getByRole('dialog', { name: 'Select Reference Entity' })).toBeTruthy();
    expect(screen.getByText('uid-middle')).toBeTruthy();
    fireEvent.click(screen.getByText('uid-middle'));

    // Check refValue dropdown options on Middle entity: alreadyRef must be disabled and labeled (ref)
    const refValueSelect = screen.getByLabelText('Reference Value') as HTMLSelectElement;
    const alreadyRefOption = Array.from(refValueSelect.options).find(opt => opt.value === 'alreadyRef');
    const normalVarOption = Array.from(refValueSelect.options).find(opt => opt.value === 'normalVar');
    expect(alreadyRefOption?.disabled).toBe(true);
    expect(alreadyRefOption?.textContent).toContain('(ref)');
    expect(normalVarOption?.disabled).toBe(false);

    // Select normalVar and add variable
    fireEvent.change(refValueSelect, { target: { value: 'normalVar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Variable' }));

    const consumerAfterAdd = useSceneStore.getState().scene.entities.find(e => e.editorEntityUID === 'uid-consumer')!;
    expect(consumerAfterAdd.customData).toEqual([
      {
        type: 'string',
        name: 'linkedMat',
        value: 'iron',
        refEditorUID: 'uid-middle',
        refType: 'customData',
        refValue: 'normalVar',
      },
    ]);

    // When source entity (uid-middle) updates normalVar -> consumer updates immediately
    act(() => {
      useSceneStore.getState().updateEntity('uid-middle', {
        customData: [
          { type: 'string', name: 'normalVar', value: 'steel' },
          consumerAfterAdd.customData[0],
        ],
      });
    });

    const consumerAfterSourceUpdate = useSceneStore.getState().scene.entities.find(e => e.editorEntityUID === 'uid-consumer')!;
    expect(consumerAfterSourceUpdate.customData[0].value).toBe('steel');
    expect((screen.getByDisplayValue('steel') as HTMLInputElement).disabled).toBe(true);

    // Unlink reference -> keeps current value ('steel') and removes ref metadata
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    const consumerAfterUnlink = useSceneStore.getState().scene.entities.find(e => e.editorEntityUID === 'uid-consumer')!;
    expect(consumerAfterUnlink.customData[0]).toEqual({
      type: 'string',
      name: 'linkedMat',
      value: 'steel',
    });
    expect((screen.getByDisplayValue('steel') as HTMLInputElement).disabled).toBe(false);
  });

  it('renders a compact reference target button and pings the hierarchy without changing selection', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="7" spriteFrame="0" editorEntityUID="uid-target" editorEntityName="Target Editor Name">
          <EntityName>target.ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>target.ent</FileName><CustomData><Variable><Type>string</Type><Name>material</Name><Value>iron</Value></Variable></CustomData></Entity>
        </Entity>
        <Entity id="8" spriteFrame="0" editorEntityUID="uid-consumer" editorEntityName="Consumer">
          <EntityName>consumer.ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>consumer.ent</FileName><CustomData><Variable><Type>string</Type><Name>linked</Name><Value refEditorUID="uid-target" refType="customData" refValue="material">iron</Value></Variable></CustomData></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('uid-consumer');
    render(<Inspector />);

    const targetButton = screen.getByRole('button', { name: 'Ping Target Editor Name in Hierarchy' });
    expect(targetButton.textContent).toBe('Target Editor Name');
    const referenceRow = targetButton.closest('.custom-data-reference-row')!;
    expect(Array.from(referenceRow.children).map(element => element.textContent)).toEqual([
      'ref',
      'Target Editor Name',
      'Edit Ref',
      'Unlink',
    ]);
    expect(targetButton.getAttribute('title')).toBe('Ping Target Editor Name in Hierarchy (customData.material)');

    fireEvent.click(targetButton);

    expect(useSceneStore.getState().selectedUIDs).toEqual(['uid-consumer']);
    expect(useSceneStore.getState().scrollHierarchyRequest).toMatchObject({ uid: 'uid-target', highlight: true });
  });

  it('falls back to entityName on the reference ping button', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="7" spriteFrame="0" editorEntityUID="uid-target">
          <EntityName>target.ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>target.ent</FileName><CustomData><Variable><Type>string</Type><Name>material</Name><Value>iron</Value></Variable></CustomData></Entity>
        </Entity>
        <Entity id="8" spriteFrame="0" editorEntityUID="uid-consumer" editorEntityName="Consumer">
          <EntityName>consumer.ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>consumer.ent</FileName><CustomData><Variable><Type>string</Type><Name>linked</Name><Value refEditorUID="uid-target" refType="customData" refValue="material">iron</Value></Variable></CustomData></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('uid-consumer');
    render(<Inspector />);

    const targetButton = screen.getByRole('button', { name: 'Ping target.ent in Hierarchy' });
    expect(targetButton.textContent).toBe('target.ent');
    fireEvent.click(targetButton);
    expect(useSceneStore.getState().scrollHierarchyRequest).toMatchObject({ uid: 'uid-target', highlight: true });
  });

  it('renders broken reference status without a reference ping button', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="8" spriteFrame="0" editorEntityUID="uid-consumer" editorEntityName="Consumer">
          <EntityName>consumer.ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity><FileName>consumer.ent</FileName><CustomData><Variable><Type>string</Type><Name>linked</Name><Value refEditorUID="uid-missing" refType="customData" refValue="material">iron</Value></Variable></CustomData></Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);
    useSceneStore.getState().selectEntity('uid-consumer');
    render(<Inspector />);

    const brokenLabel = screen.getByText('⚠ Broken Ref');
    const referenceRow = brokenLabel.closest('.custom-data-reference-row')!;
    expect(referenceRow.querySelector('button.custom-data-reference-name')).toBeNull();
    expect(referenceRow.querySelector('.custom-data-reference-badge')?.textContent).toBe('ref!');
    expect(referenceRow.querySelector('.custom-data-reference-edit')).toBeTruthy();
    expect(referenceRow.querySelector('.custom-data-reference-unlink')).toBeTruthy();
  });
});
