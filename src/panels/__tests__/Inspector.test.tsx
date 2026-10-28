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
});
