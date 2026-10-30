// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';
import type { ViewportRefs } from '../viewportTypes';
import { getCursorSceneCoordinates } from '../cursorCoordinates';
import { ViewportCursorCoordinates } from '../ViewportCursorCoordinates';

describe('cursor scene coordinate conversion', () => {
  it('accounts for camera translation, zoom, and negative coordinates', () => {
    expect(getCursorSceneCoordinates(50, 30, { x: 10, y: 10, zoom: 2 }, false, 16))
      .toEqual({ x: 20, y: 10 });
    expect(getCursorSceneCoordinates(0, 0, { x: 20, y: 10, zoom: 2 }, false, 16))
      .toEqual({ x: -10, y: -5 });
  });

  it('uses the nearest configured grid point when snapping is enabled', () => {
    expect(getCursorSceneCoordinates(47, -17, { x: 0, y: 0, zoom: 1 }, true, 32))
      .toEqual({ x: 32, y: -32 });
    expect(getCursorSceneCoordinates(47, -17, { x: 0, y: 0, zoom: 1 }, false, 32))
      .toEqual({ x: 47, y: -17 });
  });
});

describe('ViewportCursorCoordinates', () => {
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let refs: ViewportRefs;
  let frameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    container = document.createElement('div');
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });
    refs = {
      containerRef: { current: container },
      appRef: { current: null },
    } as unknown as ViewportRefs;
    useSceneStore.setState({
      camera: { x: 10, y: 10, zoom: 2 },
      gridSize: 16,
      snapToGrid: false,
      showCursorCoordinates: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function flushFrame() {
    const callback = frameCallbacks.shift();
    expect(callback).toBeDefined();
    act(() => callback!(performance.now()));
  }

  it('follows the mouse, formats one decimal, and hides on mouse leave', () => {
    render(<ViewportCursorCoordinates refs={refs} appReadyRevision={1} />);
    expect(screen.queryByTestId('viewport-cursor-coordinates')).toBeNull();

    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 30 });
    flushFrame();

    const readout = screen.getByTestId('viewport-cursor-coordinates');
    expect(readout.textContent).toContain('X: 0.0');
    expect(readout.textContent).toContain('Y: 0.0');
    expect(readout.dataset.horizontalSide).toBe('right');
    expect(readout.dataset.verticalSide).toBe('below');
    expect(readout.style.left).toBe('55px');
    expect(readout.style.top).toBe('55px');

    fireEvent.mouseLeave(canvas);
    expect(screen.queryByTestId('viewport-cursor-coordinates')).toBeNull();
  });

  it('shows snapped values and flips inside the bottom-right edge', () => {
    useSceneStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      gridSize: 32,
      snapToGrid: true,
    });
    render(<ViewportCursorCoordinates refs={refs} appReadyRevision={1} />);

    fireEvent.mouseMove(canvas, { clientX: 205, clientY: 115 });
    flushFrame();

    const readout = screen.getByTestId('viewport-cursor-coordinates');
    expect(readout.textContent).toContain('X: 192.0');
    expect(readout.textContent).toContain('Y: 96.0');
    expect(readout.dataset.horizontalSide).toBe('left');
    expect(readout.dataset.verticalSide).toBe('above');
  });

  it('removes the readout when the setting is disabled', () => {
    render(<ViewportCursorCoordinates refs={refs} appReadyRevision={1} />);
    fireEvent.mouseMove(canvas, { clientX: 60, clientY: 50 });
    flushFrame();
    expect(screen.getByTestId('viewport-cursor-coordinates')).toBeDefined();

    act(() => useSceneStore.getState().toggleCursorCoordinates());
    expect(screen.queryByTestId('viewport-cursor-coordinates')).toBeNull();

    act(() => useSceneStore.getState().toggleCursorCoordinates());
    expect(screen.queryByTestId('viewport-cursor-coordinates')).toBeNull();
  });
});
