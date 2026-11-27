// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityInstance, ProjectCharacterEntry, SceneData } from '../../types';
import { transformEventBus } from '../../store/TransformEventBus';
import type { ViewportRefs } from '../viewportTypes';
import { useEntityCustomRenderer } from '../useEntityCustomRenderer';
import { ATTACK_MINIMUM_DISTANCE_COLOR, FIELD_OF_VIEW_COLOR } from '../entityCustomRender';
import type { EntityCustomRenderSettingsMap } from '../../utils/entityCustomRenderSettings';

const { createdTexts, createdContainers, createdHearts, MockGraphics, MockContainer, MockText } = vi.hoisted(() => {
  class Graphics {
    visible = true;
    eventMode = 'auto';
    scale = { set: vi.fn() };
    position = { set: vi.fn() };
    destroy = vi.fn();
    svg = vi.fn(() => this);
    clear = vi.fn(() => this);
    moveTo = vi.fn(() => this);
    lineTo = vi.fn(() => this);
    stroke = vi.fn(() => this);
    circle = vi.fn(() => this);
    arc = vi.fn(() => this);
    fill = vi.fn(() => this);
    constructor() { hearts.push(this); }
  }
  const hearts: Graphics[] = [];
  const texts: Array<{
    text: string;
    visible: boolean;
    eventMode: string;
    anchor: { set: ReturnType<typeof vi.fn> };
    position: { set: ReturnType<typeof vi.fn> };
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const containers: Array<{
    eventMode: string;
    addChild: ReturnType<typeof vi.fn>;
    removeChild: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  class Container {
    eventMode = 'auto';
    addChild = vi.fn();
    removeChild = vi.fn();
    destroy = vi.fn();
    constructor() {
      containers.push(this);
    }
  }

  class Text {
    width = 100;
    text: string;
    visible = true;
    eventMode = 'auto';
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    destroy = vi.fn();
    constructor(options: { text?: string } = {}) {
      this.text = options.text ?? '';
      texts.push(this);
    }
  }

  return {
    createdHearts: hearts,
    MockGraphics: Graphics,
    createdTexts: texts,
    createdContainers: containers,
    MockContainer: Container,
    MockText: Text,
  };
});

vi.mock('pixi.js', () => ({
  Container: MockContainer,
  Text: MockText,
  Graphics: MockGraphics,
}));

function makeEntity(uid = 'uid-1'): EntityInstance {
  return {
    id: 1,
    entityName: 'character_spawn',
    editorEntityUID: uid,
    position: { x: 0, y: 0, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [{ type: 'string', name: 'fileName', value: 'npcs/blood-priest.character' }],
  };
}

function makeScene(entities: EntityInstance[]): SceneData {
  return {
    properties: {
      ambient: { r: 1, g: 1, b: 1 },
      lightIntensity: 1,
      zAxisDirection: { x: 0, y: 0 },
      parallaxIntensity: 0,
    },
    entities,
  };
}

function makeRefs() {
  const stage = new MockContainer();
  const spriteMap = new Map([['uid-1', { visible: true, renderable: true }]]);
  const boundsMap = new Map([['uid-1', { x: 10, y: 20, width: 40, height: 30 }]]);
  const refs = {
    appRef: { current: { stage } },
    spriteMapRef: { current: spriteMap },
    boundsMapRef: { current: boundsMap },
  } as unknown as ViewportRefs;
  return { refs, stage, spriteMap, boundsMap };
}

beforeEach(() => {
  createdTexts.length = 0;
  createdHearts.length = 0;
  createdContainers.length = 0;
});

afterEach(() => {
  cleanup();
});

describe('useEntityCustomRenderer', () => {
  it('keeps guides live without a name label, and toggles each effect independently', () => {
    const { refs } = makeRefs();
    const initialProps = {
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([makeEntity()]),
      characters: [{ name: 'blood-priest.character', relativePath: 'blood-priest.character',
        handle: {} as ProjectCharacterEntry['handle'],
        objects: [{ name: 'character', properties: { name: 'Priest', resistance: 40, fieldOfView: 45, attackMinimumDistance: 100 } }],
      }], textureRevision: 0, appReadyRevision: 1,
      settings: { 'uid-1': { fields: { name: false, resistance: false } } } as EntityCustomRenderSettingsMap,
    };
    const { rerender } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    expect(createdTexts).toHaveLength(0);
    const fov = createdHearts[0];
    const distance = createdHearts[1];
    expect(fov.arc).toHaveBeenCalled();
    expect(distance.lineTo).toHaveBeenLastCalledWith(100, 0);
    act(() => transformEventBus.emit([{ uid: 'uid-1', x: 10, y: 20 }]));
    expect(fov.position.set).toHaveBeenLastCalledWith(10, 20);
    expect(distance.position.set).toHaveBeenLastCalledWith(10, 20);
    rerender({ ...initialProps, camera: { x: 5, y: 7, zoom: 2 } });
    expect(fov.position.set).toHaveBeenLastCalledWith(25, 47);
    expect(distance.position.set).toHaveBeenLastCalledWith(25, 47);

    rerender({ ...initialProps, settings: { 'uid-1': { fields: { name: false, fieldOfView: false } } } });
    expect(fov.destroy).toHaveBeenCalledOnce();
    expect(distance.destroy).not.toHaveBeenCalled();
    expect(createdTexts[0].text).toBe('x2');
    const heart = createdHearts[2];
    expect(heart.svg).toHaveBeenCalled();
    rerender({ ...initialProps, settings: { 'uid-1': { fields: { resistance: false, attackMinimumDistance: false } } } });
    expect(createdTexts[0].text).toBe('Priest');
    expect(heart.destroy).toHaveBeenCalledOnce();
    expect(distance.destroy).toHaveBeenCalledOnce();
    rerender({ ...initialProps, settings: { 'uid-1': { enabled: false } } });
    expect(createdTexts[0].destroy).toHaveBeenCalledOnce();
    expect(createdHearts.every(graphics => graphics.destroy.mock.calls.length === 1)).toBe(true);
    rerender({ ...initialProps, settings: {} });
    expect(createdTexts[1].text).toBe('Priest x2');
  });

  const characterWithFov = (fieldOfView: number | string | boolean): ProjectCharacterEntry => ({
    name: 'blood-priest.character', relativePath: 'blood-priest.character',
    handle: {} as ProjectCharacterEntry['handle'],
    objects: [{ name: 'character', properties: { fieldOfView } }],
  });

  it('draws a 90 degree guide for fieldOfView 45 and follows position, flip, and camera', () => {
    const { refs, spriteMap } = makeRefs();
    const entity = { ...makeEntity(), position: { x: 100, y: 50, z: 0 }, angle: 90 };
    const initialProps = {
      refs, camera: { x: 5, y: 7, zoom: 2 }, scene: makeScene([entity]),
      characters: [characterWithFov(45)], textureRevision: 0, appReadyRevision: 1,
    };
    const { rerender, unmount } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    const guide = createdHearts[0];
    expect(guide.position.set).toHaveBeenLastCalledWith(205, 107);
    expect(guide.arc).toHaveBeenLastCalledWith(0, 0, 160, -Math.PI / 4, Math.PI / 4);
    expect(guide.fill).toHaveBeenCalledWith({ color: FIELD_OF_VIEW_COLOR, alpha: 0.08 });
    expect(guide.lineTo).toHaveBeenLastCalledWith(160, 0);
    expect(guide.eventMode).toBe('none');

    act(() => transformEventBus.emit([{ uid: 'uid-1', x: 200, flipX: true }]));
    act(() => transformEventBus.emit([{ uid: 'uid-1', y: 80, angle: 30, flipY: true }]));
    expect(guide.position.set).toHaveBeenLastCalledWith(405, 167);
    expect(guide.arc).toHaveBeenLastCalledWith(0, 0, 160, 3 * Math.PI / 4, 5 * Math.PI / 4);
    expect(guide.lineTo).toHaveBeenLastCalledWith(-160, 0);
    rerender({ ...initialProps, camera: { x: 10, y: 20, zoom: 0.5 } });
    expect(createdHearts).toHaveLength(1);
    expect(guide.position.set).toHaveBeenLastCalledWith(110, 60);
    expect(guide.arc).toHaveBeenLastCalledWith(0, 0, 40, 3 * Math.PI / 4, 5 * Math.PI / 4);
    expect(guide.lineTo).toHaveBeenLastCalledWith(-40, 0);

    spriteMap.get('uid-1')!.visible = false;
    act(() => transformEventBus.emit([{ uid: 'uid-1', hide: true }]));
    expect(guide.visible).toBe(false);
    spriteMap.get('uid-1')!.visible = true;
    rerender({ ...initialProps, characters: [characterWithFov(90)] });
    expect(guide.visible).toBe(true);
    expect(guide.arc).toHaveBeenLastCalledWith(0, 0, 160, -Math.PI / 2, Math.PI / 2);
    rerender({ ...initialProps, characters: [] });
    expect(guide.destroy).toHaveBeenCalledOnce();
    unmount();
    expect(createdContainers[1].destroy).toHaveBeenCalledWith({ children: true });
  });

  it.each([180, 190, 270])('draws a full circle for fieldOfView %s without wrapping', fieldOfView => {
    const { refs } = makeRefs();
    renderHook(() => useEntityCustomRenderer({
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([{ ...makeEntity(), flipX: true }]),
      characters: [characterWithFov(fieldOfView)], textureRevision: 0, appReadyRevision: 1,
    }));
    expect(createdHearts[0].circle).toHaveBeenCalledWith(0, 0, 80);
    expect(createdHearts[0].arc).not.toHaveBeenCalled();
    expect(createdHearts[0].lineTo).toHaveBeenLastCalledWith(-80, 0);
  });

  it.each([-1, Infinity, NaN, 'invalid', true])('does not draw invalid fieldOfView %s', fieldOfView => {
    const { refs } = makeRefs();
    renderHook(() => useEntityCustomRenderer({
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([makeEntity()]),
      characters: [characterWithFov(fieldOfView)], textureRevision: 0, appReadyRevision: 1,
    }));
    expect(createdHearts).toHaveLength(0);
  });

  it('draws only the direction for zero fieldOfView', () => {
    const { refs } = makeRefs();
    renderHook(() => useEntityCustomRenderer({
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([makeEntity()]),
      characters: [characterWithFov(0)], textureRevision: 0, appReadyRevision: 1,
    }));
    expect(createdHearts[0].arc).not.toHaveBeenCalled();
    expect(createdHearts[0].lineTo).toHaveBeenLastCalledWith(80, 0);
  });

  it('draws the attack distance around entity position and follows camera and live moves', () => {
    const { refs, spriteMap } = makeRefs();
    const entity = { ...makeEntity(), position: { x: 100, y: 50, z: 0 }, angle: 90, flipX: true };
    const characters: ProjectCharacterEntry[] = [{
      name: 'blood-priest.character', relativePath: 'blood-priest.character',
      handle: {} as ProjectCharacterEntry['handle'],
      objects: [{ name: 'character', properties: { attackMinimumDistance: 300 } }],
    }];
    const initialProps = {
      refs, camera: { x: 5, y: 7, zoom: 2 }, scene: makeScene([entity]),
      characters, textureRevision: 0, appReadyRevision: 1,
    };
    const { rerender, unmount } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    const line = createdHearts[0];
    expect(line.position.set).toHaveBeenLastCalledWith(205, 107);
    expect(line.moveTo).toHaveBeenLastCalledWith(-600, 0);
    expect(line.lineTo).toHaveBeenLastCalledWith(600, 0);
    expect(line.circle).toHaveBeenCalledWith(-600, 0, 3);
    expect(line.circle).toHaveBeenCalledWith(0, 0, 3);
    expect(line.circle).toHaveBeenCalledWith(600, 0, 3);
    expect(line.stroke).toHaveBeenCalledWith({ color: ATTACK_MINIMUM_DISTANCE_COLOR, width: 1.5 });
    expect(line.fill).toHaveBeenCalledWith(ATTACK_MINIMUM_DISTANCE_COLOR);
    expect(line.eventMode).toBe('none');

    act(() => transformEventBus.emit([{ uid: 'uid-1', x: 200 }]));
    act(() => transformEventBus.emit([{ uid: 'uid-1', y: 80, angle: 45, scaleX: 2 }]));
    expect(line.position.set).toHaveBeenLastCalledWith(405, 167);
    rerender({ ...initialProps, camera: { x: 10, y: 20, zoom: 0.5 } });
    expect(createdHearts).toHaveLength(1);
    expect(line.position.set).toHaveBeenLastCalledWith(110, 60);
    expect(line.moveTo).toHaveBeenLastCalledWith(-150, 0);
    expect(line.lineTo).toHaveBeenLastCalledWith(150, 0);

    spriteMap.get('uid-1')!.visible = false;
    act(() => transformEventBus.emit([{ uid: 'uid-1', hide: true }]));
    expect(line.visible).toBe(false);
    rerender({ ...initialProps, scene: makeScene([]) });
    expect(line.destroy).toHaveBeenCalledOnce();
    unmount();
    expect(createdContainers[1].destroy).toHaveBeenCalledWith({ children: true });
  });

  it.each([undefined, -1, Infinity, 'invalid', true])('does not draw invalid attack distance %s', attackMinimumDistance => {
    const { refs } = makeRefs();
    renderHook(() => useEntityCustomRenderer({
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([makeEntity()]),
      characters: [{ name: 'blood-priest.character', relativePath: 'blood-priest.character',
        handle: {} as ProjectCharacterEntry['handle'],
        objects: [{ name: 'character', properties: attackMinimumDistance === undefined ? {} : { attackMinimumDistance } }],
      }], textureRevision: 0, appReadyRevision: 1,
    }));
    expect(createdHearts).toHaveLength(0);
  });

  it('updates the resistance suffix and Lucide heart when character data changes', () => {
    const { refs } = makeRefs();
    const character = (resistance?: number): ProjectCharacterEntry => ({
      name: 'blood-priest.character', relativePath: 'blood-priest.character',
      handle: {} as ProjectCharacterEntry['handle'],
      objects: [{ name: 'character', properties: resistance === undefined ? {} : { resistance } }],
    });
    const initialProps = {
      refs, camera: { x: 0, y: 0, zoom: 1 }, scene: makeScene([makeEntity()]),
      characters: [character(40)], textureRevision: 0, appReadyRevision: 1,
    };
    const { rerender } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    expect(createdTexts[0].text).toBe('blood-priest x2');
    expect(createdHearts).toHaveLength(1);
    expect(createdHearts[0].svg).toHaveBeenCalledWith(expect.stringContaining('lucide-heart'));
    expect(createdHearts[0].position.set).toHaveBeenCalledWith(75, 6);
    rerender({ ...initialProps, characters: [character(50)] });
    expect(createdTexts[0].text).toBe('blood-priest x2.5');
    expect(createdHearts).toHaveLength(1);
    rerender({ ...initialProps, characters: [character()] });
    expect(createdTexts[0].text).toBe('blood-priest');
    expect(createdHearts[0].destroy).toHaveBeenCalledOnce();
  });

  it('repositions labels on camera change without recreating or destroying them', () => {
    const { refs } = makeRefs();
    const entity = makeEntity();
    const initialProps = {
      refs,
      camera: { x: 0, y: 0, zoom: 1 },
      scene: makeScene([entity]),
      characters: [],
      textureRevision: 0,
      appReadyRevision: 1,
    };

    const { rerender } = renderHook(props => useEntityCustomRenderer(props), { initialProps });

    expect(createdTexts).toHaveLength(1);
    expect(createdTexts[0].text).toBe('blood-priest');
    createdTexts[0].position.set.mockClear();

    rerender({ ...initialProps, camera: { x: 5, y: 7, zoom: 2 } });

    expect(createdTexts).toHaveLength(1);
    expect(createdTexts[0].destroy).not.toHaveBeenCalled();
    expect(createdTexts[0].position.set).toHaveBeenCalledWith(65, 45);
  });

  it('keeps existing labels when scene.entities is a new array with the same labelled entity', () => {
    const { refs } = makeRefs();
    const entity = makeEntity();
    const initialProps = {
      refs,
      camera: { x: 0, y: 0, zoom: 1 },
      scene: makeScene([entity]),
      characters: [],
      textureRevision: 0,
      appReadyRevision: 1,
    };

    const { rerender } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    expect(createdTexts).toHaveLength(1);

    rerender({ ...initialProps, scene: makeScene([entity]) });
    expect(createdTexts).toHaveLength(1);
    expect(createdTexts[0].destroy).not.toHaveBeenCalled();
  });

  it('destroys a label when its entity is removed from the scene', () => {
    const { refs } = makeRefs();
    const entity = makeEntity();
    const initialProps = {
      refs,
      camera: { x: 0, y: 0, zoom: 1 },
      scene: makeScene([entity]),
      characters: [],
      textureRevision: 0,
      appReadyRevision: 1,
    };

    const { rerender } = renderHook(props => useEntityCustomRenderer(props), { initialProps });
    expect(createdTexts).toHaveLength(1);

    rerender({ ...initialProps, scene: makeScene([]) });
    expect(createdTexts[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the layer with children on unmount', () => {
    const { refs } = makeRefs();
    const entity = makeEntity();
    const { unmount } = renderHook(() =>
      useEntityCustomRenderer({
        refs,
        camera: { x: 0, y: 0, zoom: 1 },
        scene: makeScene([entity]),
        characters: [],
        textureRevision: 0,
        appReadyRevision: 1,
      }),
    );

    // createdContainers[0] is stage; createdContainers[1] is the label layer.
    const layer = createdContainers[1];
    expect(layer).toBeDefined();

    unmount();
    expect(layer.destroy).toHaveBeenCalledWith({ children: true });
  });

  it('re-places the label when transformEventBus emits an update for its uid', () => {
    const { refs, boundsMap } = makeRefs();
    const entity = makeEntity();
    renderHook(() =>
      useEntityCustomRenderer({
        refs,
        camera: { x: 5, y: 7, zoom: 2 },
        scene: makeScene([entity]),
        characters: [],
        textureRevision: 0,
        appReadyRevision: 1,
      }),
    );

    expect(createdTexts).toHaveLength(1);
    createdTexts[0].position.set.mockClear();

    boundsMap.set('uid-1', { x: 100, y: 50, width: 20, height: 10 });
    act(() => {
      transformEventBus.emit([{ uid: 'uid-1', x: 100, y: 50 }]);
    });

    expect(createdTexts[0].position.set).toHaveBeenCalledWith(225, 105);
  });
});
