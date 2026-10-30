// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useViewportInteractions } from '../useViewportInteractions';
import { useSceneStore } from '../../store/sceneStore';
import type { ViewportRefs } from '../viewportTypes';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }));

function createMockRefs(): ViewportRefs {
  return {
    containerRef: { current: document.createElement('div') },
    appRef: { current: null },
    worldRef: { current: null },
    gridRef: { current: null },
    entitiesContainerRef: { current: null },
    selectionRef: { current: null },
    marqueeGraphicsRef: { current: null },
    moveGizmoContainerRef: { current: null },
    spriteMapRef: { current: new Map() },
    particleRuntimesRef: { current: new Map() },
    particleRuntimeSignaturesRef: { current: new Map() },
    activeParticleRuntimeKeysRef: { current: new Set() },
    particleHostStatesRef: { current: new Map() },
    particleCullingEntriesRef: { current: new Map() },
    baseTextureMapRef: { current: new Map() },
    frameTextureMapRef: { current: new Map() },
    textureUrlMapRef: { current: new Map() },
    placeholderTextureRef: { current: null },
    boundsMapRef: { current: new Map() },
    drawSortSignatureRef: { current: '' },
    meshSyncRefsRef: {
      current: {
        entities: null,
        parallaxIntensity: null,
        zAxisDirection: null,
        templates: null,
        templateAtlases: null,
        textureRevision: -1,
        parallaxOrigin: null,
        parallaxActive: false,
      },
    },
    parallaxGeometryActiveRef: { current: false },
    parallaxEntityUIDsRef: { current: new Set() },
    liveFrameRef: { current: null },
    pendingLiveUpdatesRef: { current: null },
    latestDragUpdatesRef: { current: null },
    handledFocusNonceRef: { current: null },
    handledFitNonceRef: { current: null },
    isDraggingEntityRef: { current: false },
    dragStartMouseRef: { current: { x: 0, y: 0 } },
    dragStartPositionsRef: { current: new Map() },
    dragPreviewPositionsRef: { current: new Map() },
    dragStartVerticesRef: { current: new Map() },
    dragStartBoundsRef: { current: new Map() },
    dragStartCentroidRef: { current: { x: 0, y: 0 } },
    hasDraggedRef: { current: false },
    entityClickHandledRef: { current: false },
    lastSceneEntityClickRef: { current: null },
    isRotatingRef: { current: false },
    rotateStartRef: { current: { mouseAngle: 0, pivotX: 0, pivotY: 0 } },
    rotateStartDataRef: { current: new Map() },
    isMarqueeRef: { current: false },
    marqueeStartRef: { current: { x: 0, y: 0 } },
    marqueeJustCompletedRef: { current: false },
    isPanningRef: { current: false },
    lastPanPosRef: { current: { x: 0, y: 0 } },
    updateSelectionOutlinesRef: { current: () => {} },
    placePreviewMeshRef: { current: null },
    placePreviewGraphicsRef: { current: null },
    placePreviewMouseRef: { current: { x: 0, y: 0, isOver: false } },
    updatePlacePreviewRef: { current: () => {} },
  };
}

describe('Viewport Fit Scene keyboard shortcut', () => {
  let fitSpy: Mock<() => void>;
  let originalFit: () => void;
  let unmountHook: (() => void) | null = null;

  beforeEach(() => {
    originalFit = useSceneStore.getState().fitViewToScene;
    fitSpy = vi.fn();
    useSceneStore.setState({ fitViewToScene: fitSpy });
  });

  afterEach(() => {
    if (unmountHook) {
      unmountHook();
      unmountHook = null;
    }
    useSceneStore.setState({ fitViewToScene: originalFit });
  });

  function setupHook() {
    const refs = createMockRefs();
    const result = renderHook(() =>
      useViewportInteractions({
        refs,
        setCamera: vi.fn(),
        addEntity: vi.fn(),
        updateWorldTransform: vi.fn(),
        setParallaxOriginNormalized: vi.fn(),
      })
    );
    unmountHook = result.unmount;
    return refs;
  }

  it('triggers fitViewToScene when pressing key "0"', () => {
    setupHook();

    const event = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Digit0',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(fitSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('triggers fitViewToScene when pressing Numpad0', () => {
    setupHook();

    const event = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Numpad0',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(fitSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT trigger fitViewToScene when pressing Shift + 0 (closing parenthesis ")")', () => {
    setupHook();

    const event = new KeyboardEvent('keydown', {
      key: ')',
      code: 'Digit0',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(fitSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT trigger fitViewToScene when pressing Shift + F', () => {
    setupHook();

    const event = new KeyboardEvent('keydown', {
      key: 'F',
      code: 'KeyF',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(fitSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT trigger fitViewToScene when pressing Ctrl + 0 or Meta + 0', () => {
    setupHook();

    const ctrlEvent = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Digit0',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ctrlEvent);
    expect(fitSpy).not.toHaveBeenCalled();
    expect(ctrlEvent.defaultPrevented).toBe(false);

    const metaEvent = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Digit0',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(metaEvent);
    expect(fitSpy).not.toHaveBeenCalled();
    expect(metaEvent.defaultPrevented).toBe(false);
  });

  it('does NOT trigger fitViewToScene when typing in an input element or select element', () => {
    setupHook();

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Digit0',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(fitSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    document.body.removeChild(input);

    const select = document.createElement('select');
    document.body.appendChild(select);
    const selectEvent = new KeyboardEvent('keydown', {
      key: '0',
      code: 'Digit0',
      bubbles: true,
      cancelable: true,
    });
    select.dispatchEvent(selectEvent);

    expect(fitSpy).not.toHaveBeenCalled();
    expect(selectEvent.defaultPrevented).toBe(false);

    document.body.removeChild(select);
  });
});
