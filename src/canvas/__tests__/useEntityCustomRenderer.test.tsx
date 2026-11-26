// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityInstance, ProjectCharacterEntry, SceneData } from '../../types';
import { transformEventBus } from '../../store/TransformEventBus';
import type { ViewportRefs } from '../viewportTypes';
import { useEntityCustomRenderer } from '../useEntityCustomRenderer';

const { createdTexts, createdContainers, createdHearts, MockGraphics, MockContainer, MockText } = vi.hoisted(() => {
  class Graphics {
    visible = true;
    eventMode = 'auto';
    scale = { set: vi.fn() };
    position = { set: vi.fn() };
    destroy = vi.fn();
    svg = vi.fn(() => this);
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
