// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityTemplate } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { entityHasFileNameTag } from '../../utils/entityTemplate';
import { serializeScene } from '../../io/serializeScene';
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
  it('shows separated physics, collision, and revolute joints sections', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="collision-entity">
          <EntityName>collision-entity</EntityName><Position x="0" y="0" z="70" angle="0" />
          <Entity shape="1" static="1" friction="0.8">
            <Scale x="2" y="3"/><Collision><Position x="4" y="5" z="9"/><Size x="20" y="30" z="64"/></Collision>
          </Entity>
        </Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="joint-entity">
          <EntityName>joint-entity</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="4">
            <Collision>
              <Position x="0" y="0" z="0"/><Size x="10" y="10" z="10"/>
              <Joints>
                revoluteJoint_wheel { otherEntityName = wheel.ent; attachPointAX = 1; attachPointAY = 2; attachPointBX = 3; attachPointBY = 4; enableLimit = true; lowerAngle = 0; upperAngle = 1.57; enableMotor = true; motorSpeed = 5; maxMotorTorque = 100; }
              </Joints>
            </Collision>
          </Entity>
        </Entity>
        <Entity id="3" spriteFrame="0" editorEntityUID="none-shape-entity">
          <EntityName>none-shape-entity</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="0" static="1">
            <Collision><Position x="0" y="0" z="0"/><Size x="0" y="0" z="0"/></Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    // Test box entity
    useSceneStore.getState().selectEntity('collision-entity');
    const { unmount } = render(<Inspector />);

    const physicsSection = screen.getByText('Physics').closest('.inspector-section');
    expect(physicsSection?.textContent).toContain('Inline');
    expect(physicsSection?.textContent).toContain('Static');
    expect(physicsSection?.textContent).toContain('Friction');
    const withinPhysics = within(physicsSection as HTMLElement);
    expect(withinPhysics.getByDisplayValue('0.8')).toBeDefined();
    expect(physicsSection?.textContent).toContain('Density');
    expect(physicsSection?.textContent).toContain('Restitution');


    const collisionSection = screen.getByText('Collision').closest('.inspector-section');
    const withinCollision = within(collisionSection as HTMLElement);
    expect(collisionSection?.textContent).toContain('Inline');
    expect(collisionSection?.textContent).toContain('1 - Box');
    expect(collisionSection?.textContent).toContain('Position');
    expect(withinCollision.getByDisplayValue('4')).toBeDefined();
    expect(withinCollision.getByDisplayValue('5')).toBeDefined();
    expect(withinCollision.getByDisplayValue('9')).toBeDefined();
    expect(withinCollision.getByDisplayValue('20')).toBeDefined();
    expect(withinCollision.getByDisplayValue('30')).toBeDefined();
    expect(withinCollision.getByDisplayValue('64')).toBeDefined();

    expect(collisionSection?.textContent).toContain('Size');
    expect(collisionSection?.textContent).not.toContain('Effective');
    expect(screen.queryByText(/Revolute Joints/)).toBeNull();

    unmount();

    // Test joint entity
    useSceneStore.getState().selectEntity('joint-entity');
    const { unmount: unmountJoint } = render(<Inspector />);

    const jointsSection = screen.getByText(/Revolute Joints/).closest('.inspector-section');
    const withinJoints = within(jointsSection as HTMLElement);
    expect(jointsSection).not.toBeNull();
    expect(jointsSection?.textContent).toContain('Inline');
    expect(jointsSection?.textContent).toContain('revoluteJoint_wheel');
    expect(withinJoints.getByDisplayValue('wheel.ent')).toBeDefined();
    expect(jointsSection?.textContent).toContain('Anchor A');
    expect(jointsSection?.textContent).toContain('Anchor B');
    expect(jointsSection?.textContent).toContain('Limit');
    expect(jointsSection?.textContent).toContain('Motor');
    expect(withinJoints.getByDisplayValue('1')).toBeDefined();
    expect(withinJoints.getByDisplayValue('2')).toBeDefined();
    expect(withinJoints.getByDisplayValue('3')).toBeDefined();
    expect(withinJoints.getByDisplayValue('4')).toBeDefined();
    expect(withinJoints.getByDisplayValue('1.57')).toBeDefined();
    expect(withinJoints.getByDisplayValue('5')).toBeDefined();
    expect(withinJoints.getByDisplayValue('100')).toBeDefined();

    unmountJoint();

    // Test none-shape entity
    useSceneStore.getState().selectEntity('none-shape-entity');
    render(<Inspector />);

    const noneCollisionSection = screen.getByText('Collision').closest('.inspector-section');
    expect(noneCollisionSection?.textContent).toContain('0 - None');
    expect(screen.queryByText(/Revolute Joints/)).toBeNull();
  });

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

  it('repairs missing or malformed Collision.Position when re-committing fallback value 0', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="missing-pos">
          <EntityName>missing-pos</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="1">
            <Collision><Size x="64" y="64" z="64"/></Collision>
          </Entity>
        </Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="malformed-pos">
          <EntityName>malformed-pos</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="1">
            <Collision><Position x="invalid" y="0" z="0"/><Size x="64" y="64" z="64"/></Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    // 1. Missing Position
    useSceneStore.getState().selectEntity('missing-pos');
    const { unmount } = render(<Inspector />);

    expect(screen.getByText(/Invalid collision · 1 issue/)).toBeTruthy();
    expect(screen.getByText(/Collision\.Position tag missing/)).toBeTruthy();

    const collisionSection = screen.getByText('Collision').closest('.inspector-section') as HTMLElement;
    const posXBadge = within(collisionSection).getAllByText('X')[0];
    fireEvent.pointerDown(posXBadge, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(posXBadge, { pointerId: 1 });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const repairedMissing = useSceneStore.getState().scene.entities[0];
    expect(repairedMissing.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(repairedMissing.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect((repairedMissing.inlineEntityData?.Collision as Record<string, unknown>)?.Position).toEqual({
      x: '0',
      y: '0',
      z: '0',
    });
    expect(screen.queryByText(/Invalid collision/)).toBeNull();
    unmount();

    // 2. Malformed Position
    useSceneStore.getState().selectEntity('malformed-pos');
    render(<Inspector />);

    expect(screen.getByText(/Invalid collision · 1 issue/)).toBeTruthy();
    const collisionSection2 = screen.getByText('Collision').closest('.inspector-section') as HTMLElement;
    const posXInput = within(collisionSection2).getAllByLabelText('X')[0];
    fireEvent.change(posXInput, { target: { value: '00' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const repairedMalformed = useSceneStore.getState().scene.entities[1];
    expect(repairedMalformed.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(repairedMalformed.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect((repairedMalformed.inlineEntityData?.Collision as Record<string, unknown>)?.Position).toEqual({
      x: '0',
      y: '0',
      z: '0',
    });
    expect(screen.queryByText(/Invalid collision/)).toBeNull();
  });

  it('recovers missing <Collision> tag through standard position/size edits and clears generic diagnostic', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="missing-collision">
          <EntityName>missing-collision</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="1" static="1" />
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    useSceneStore.getState().selectEntity('missing-collision');
    render(<Inspector />);

    expect(screen.getByText(/Collision tag missing/)).toBeTruthy();

    const collisionSection = screen.getByText('Collision').closest('.inspector-section') as HTMLElement;
    const withinCol = within(collisionSection);
    const xInputs = withinCol.getAllByLabelText('X');
    const yInputs = withinCol.getAllByLabelText('Y');
    const zInputs = withinCol.getAllByLabelText('Z');

    // Edit Position X to 0 (materializes <Collision> and clears Collision tag missing)
    const posXBadge = withinCol.getAllByText('X')[0];
    fireEvent.pointerDown(posXBadge, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(posXBadge, { pointerId: 1 });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const afterPosEdit = useSceneStore.getState().scene.entities[0];
    expect(afterPosEdit.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect(afterPosEdit.inlineTemplate?.physics?.warnings).toEqual([]);
    expect(screen.queryByText(/Collision tag missing/)).toBeNull();

    // Edit Size X, Y, Z to 64 -> collision becomes fully valid
    fireEvent.change(xInputs[1], { target: { value: '64' } });
    fireEvent.change(yInputs[1], { target: { value: '64' } });
    fireEvent.change(zInputs[1], { target: { value: '64' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const afterSizeEdit = useSceneStore.getState().scene.entities[0];
    expect(afterSizeEdit.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(afterSizeEdit.inlineEntityData?.Collision).toEqual({
      Position: { x: '0', y: '0', z: '0' },
      Size: { x: '64', y: '64', z: '64' },
    });
    expect(screen.queryByText(/Invalid collision/)).toBeNull();
  });

  it('repairs Polygon with invalid raw block when re-applying matching Triangle preset and preserves raw on unrelated physics edit', () => {
    const rawPolygonWithBadBlock = 'v0 { x = 0; y = -1; } v1 { x = 1; y = 1; } v2 { x = -1; y = 1; } bad { x = 0; y = 0; }';
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="poly-entity">
          <EntityName>poly-entity</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="3" friction="0.5">
            <Collision>
              <Position x="0" y="0" z="0"/><Size x="64" y="64" z="64"/>
              <Polygon>${rawPolygonWithBadBlock}</Polygon>
            </Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    useSceneStore.getState().selectEntity('poly-entity');
    render(<Inspector />);

    expect(screen.getByText(/Invalid collision · 1 issue/)).toBeTruthy();
    expect(screen.getByText(/unexpected block "bad" in Polygon/)).toBeTruthy();

    // Unrelated physics edit (Friction) must preserve raw Polygon and keep invalid state
    const physicsSection = screen.getByText('Physics').closest('.inspector-section') as HTMLElement;
    const frictionInput = within(physicsSection).getByDisplayValue('0.5');
    fireEvent.change(frictionInput, { target: { value: '0.8' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const afterFriction = useSceneStore.getState().scene.entities[0];
    expect((afterFriction.inlineEntityData?.Collision as Record<string, unknown>)?.Polygon).toBe(rawPolygonWithBadBlock);
    expect(afterFriction.inlineTemplate?.physics?.collision.valid).toBe(false);

    // Clicking Triangle preset (whose vertices match the sanitized model) explicitly repairs the raw Polygon
    fireEvent.click(screen.getByRole('button', { name: 'Apply Triangle' }));
    act(() => useSceneStore.getState().flushInspectorEdits());

    const afterPreset = useSceneStore.getState().scene.entities[0];
    const serializedPolygon = (afterPreset.inlineEntityData?.Collision as Record<string, unknown>)?.Polygon as string;
    expect(serializedPolygon).not.toContain('bad');
    expect(serializedPolygon).toContain('v0 {');
    expect(afterPreset.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(afterPreset.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect(screen.queryByText(/Invalid collision/)).toBeNull();
  });

  it('repairs Compound with unparseable raw block on explicit commit of equivalent sub-shapes and treats clean same-value commit as no-op', () => {
    const rawCompoundWithBadBlock = 'sub_0 { shape = box; posX = 0; posY = 0; sizeX = 1; sizeY = 1; angle = 0; } bad { shape = capsule; }';
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="comp-entity">
          <EntityName>comp-entity</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="4">
            <Collision>
              <Position x="0" y="0" z="0"/><Size x="64" y="64" z="64"/>
              <Compound>${rawCompoundWithBadBlock}</Compound>
            </Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    useSceneStore.getState().selectEntity('comp-entity');
    render(<Inspector />);

    expect(screen.getByText(/Invalid collision · 1 issue/)).toBeTruthy();

    // Explicit commit on Sub-shape 1 Name (blurring with same name) repairs the compound
    const nameInput = screen.getByLabelText('Sub-shape 1 Name');
    fireEvent.blur(nameInput);
    act(() => useSceneStore.getState().flushInspectorEdits());

    const afterRepair = useSceneStore.getState().scene.entities[0];
    const serializedCompound = (afterRepair.inlineEntityData?.Collision as Record<string, unknown>)?.Compound as string;
    expect(serializedCompound).not.toContain('capsule');
    expect(serializedCompound).toContain('sub_0 {');
    expect(afterRepair.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(afterRepair.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect(screen.queryByText(/Invalid collision/)).toBeNull();

    // Subsequent commit with the same value on a now-clean collision is a no-op (no new history entry)
    const historyLengthAfterRepair = useSceneStore.getState().history.length;
    fireEvent.blur(nameInput);
    act(() => useSceneStore.getState().flushInspectorEdits());
    expect(useSceneStore.getState().history).toHaveLength(historyLengthAfterRepair);
  });

  it('allows selecting None directly from an unsupported shape in Inspector and clears diagnostics, warnings, and Collision block', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="unsupported-ent">
          <EntityName>unsupported-ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="5">
            <Collision>
              <Position x="10" y="20" z="0"/><Size x="64" y="64" z="64"/>
            </Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    useSceneStore.getState().selectEntity('unsupported-ent');
    render(<Inspector />);

    expect(screen.getByText(/Invalid collision · 1 issue/)).toBeTruthy();
    const shapeSelect = screen.getByLabelText('Collision Shape') as HTMLSelectElement;
    expect(shapeSelect.value).toBe('unsupported');
    expect(screen.getByRole('option', { name: 'Unsupported (5)' })).toBeTruthy();

    const historyBefore = useSceneStore.getState().history.length;
    fireEvent.change(shapeSelect, { target: { value: '0' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const updated = useSceneStore.getState().scene.entities[0];
    expect(updated.inlineTemplate?.physics?.shape).toBe(0);
    expect(updated.inlineTemplate?.physics?.collision.valid).toBe(true);
    expect(updated.inlineTemplate?.physics?.diagnostics).toEqual([]);
    expect(updated.inlineTemplate?.physics?.warnings).toEqual([]);
    expect(updated.inlineEntityData?.shape).toBe('0');
    expect(updated.inlineEntityData?.Collision).toBeUndefined();
    expect(screen.queryByText(/Invalid collision/)).toBeNull();
    expect(shapeSelect.value).toBe('0');
    expect(useSceneStore.getState().history).toHaveLength(historyBefore + 1);
  });

  it('cleans up obsolete geometry tags when changing shape in Inspector and serializing scene', () => {
    useSceneStore.getState().loadScene(`
      <Ethanon>${SCENE_PROPERTIES}<EntitiesInScene>
        <Entity id="1" spriteFrame="0" editorEntityUID="poly-ent">
          <EntityName>poly-ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="3">
            <Collision>
              <Position x="0" y="0" z="0"/><Size x="64" y="64" z="64"/>
              <Polygon>v0 { x = -0.5; y = -0.5; } v1 { x = 0.5; y = -0.5; } v2 { x = 0.5; y = 0.5; } v3 { x = -0.5; y = 0.5; }</Polygon>
            </Collision>
          </Entity>
        </Entity>
        <Entity id="2" spriteFrame="0" editorEntityUID="comp-ent">
          <EntityName>comp-ent</EntityName><Position x="0" y="0" z="0" angle="0" />
          <Entity shape="4">
            <Collision>
              <Position x="0" y="0" z="0"/><Size x="64" y="64" z="64"/>
              <Compound>sub0 { shape = box; posX = 0; posY = 0; sizeX = 1; sizeY = 1; }</Compound>
            </Collision>
          </Entity>
        </Entity>
      </EntitiesInScene></Ethanon>
    `);

    // 1. Polygon -> Box (1) via Inspector selector
    useSceneStore.getState().selectEntity('poly-ent');
    const { unmount: unmountPoly } = render(<Inspector />);

    const polyShapeSelect = screen.getByLabelText('Collision Shape') as HTMLSelectElement;
    expect(polyShapeSelect.value).toBe('3');

    fireEvent.change(polyShapeSelect, { target: { value: '1' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const polyToBox = useSceneStore.getState().scene.entities[0];
    const polyBoxCol = polyToBox.inlineEntityData?.Collision as Record<string, unknown>;
    expect(polyToBox.inlineEntityData?.shape).toBe('1');
    expect(polyBoxCol).toBeDefined();
    expect(polyBoxCol.Polygon).toBeUndefined();
    expect(polyBoxCol.Compound).toBeUndefined();

    // Serialize scene to XML: confirm no <Polygon> or <Compound> for this entity
    let xml = serializeScene(useSceneStore.getState().scene);
    const polyEntityXml = xml.slice(xml.indexOf('poly-ent'), xml.indexOf('comp-ent'));
    expect(polyEntityXml).not.toContain('<Polygon>');
    expect(polyEntityXml).not.toContain('<Compound>');

    // 2. Box -> Compound (4) via Inspector selector
    fireEvent.change(polyShapeSelect, { target: { value: '4' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const polyToComp = useSceneStore.getState().scene.entities[0];
    const polyCompCol = polyToComp.inlineEntityData?.Collision as Record<string, unknown>;
    expect(polyToComp.inlineEntityData?.shape).toBe('4');
    expect(polyCompCol.Compound).toBeDefined();
    expect(polyCompCol.Polygon).toBeUndefined();

    xml = serializeScene(useSceneStore.getState().scene);
    const polyCompXml = xml.slice(xml.indexOf('poly-ent'), xml.indexOf('comp-ent'));
    expect(polyCompXml).toContain('<Compound>');
    expect(polyCompXml).not.toContain('<Polygon>');

    // 3. Compound -> Polygon (3) restores model polygon and clears Compound
    fireEvent.change(polyShapeSelect, { target: { value: '3' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const polyRestored = useSceneStore.getState().scene.entities[0];
    const polyRestoredCol = polyRestored.inlineEntityData?.Collision as Record<string, unknown>;
    expect(polyRestored.inlineEntityData?.shape).toBe('3');
    expect(polyRestoredCol.Polygon).toBeDefined();
    expect(polyRestoredCol.Compound).toBeUndefined();

    xml = serializeScene(useSceneStore.getState().scene);
    const polyRestoredXml = xml.slice(xml.indexOf('poly-ent'), xml.indexOf('comp-ent'));
    expect(polyRestoredXml).toContain('<Polygon>');
    expect(polyRestoredXml).not.toContain('<Compound>');

    unmountPoly();

    // 4. Compound -> Circle (2) via Inspector selector
    useSceneStore.getState().selectEntity('comp-ent');
    render(<Inspector />);

    const compShapeSelect = screen.getByLabelText('Collision Shape') as HTMLSelectElement;
    expect(compShapeSelect.value).toBe('4');

    fireEvent.change(compShapeSelect, { target: { value: '2' } });
    act(() => useSceneStore.getState().flushInspectorEdits());

    const compToCircle = useSceneStore.getState().scene.entities[1];
    const compCircleCol = compToCircle.inlineEntityData?.Collision as Record<string, unknown>;
    expect(compToCircle.inlineEntityData?.shape).toBe('2');
    expect(compCircleCol).toBeDefined();
    expect(compCircleCol.Compound).toBeUndefined();
    expect(compCircleCol.Polygon).toBeUndefined();

    xml = serializeScene(useSceneStore.getState().scene);
    const compEntityXml = xml.slice(xml.indexOf('comp-ent'));
    expect(compEntityXml).not.toContain('<Compound>');
    expect(compEntityXml).not.toContain('<Polygon>');
  });
});
