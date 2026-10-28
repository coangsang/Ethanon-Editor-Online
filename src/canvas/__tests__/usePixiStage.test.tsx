// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pixiMock = vi.hoisted(() => ({
  applications: [] as Array<{
    canvas: HTMLCanvasElement;
    destroy: ReturnType<typeof vi.fn>;
    ticker: {
      deltaMS: number;
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    };
  }>,
  initResults: [] as Array<() => Promise<void>>,
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }));

vi.mock('pixi.js', () => {
  class Container {
    visible = true;
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
    addChild = vi.fn((_child: unknown) => _child);
  }

  class Graphics extends Container {
    clear = vi.fn(() => this);
    moveTo = vi.fn(() => this);
    lineTo = vi.fn(() => this);
    stroke = vi.fn(() => this);
  }

  class Application {
    canvas = document.createElement('canvas');
    stage = new Container();
    renderer = { width: 640, height: 480, resize: vi.fn() };
    ticker = {
      deltaMS: 16,
      add: vi.fn(),
      remove: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    destroy = vi.fn();
    init = vi.fn(() => pixiMock.initResults.shift()?.() ?? Promise.resolve());

    constructor() {
      pixiMock.applications.push(this);
    }
  }

  return { Application, Container, Graphics };
});

import { usePixiStage } from '../usePixiStage';
import { useViewportRefs } from '../useViewportRefs';
import { useSceneStore } from '../../store/sceneStore';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function renderStage() {
  const container = document.createElement('div');
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    width: 640,
    height: 480,
    top: 0,
    left: 0,
    right: 640,
    bottom: 480,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  return renderHook(() => {
    const refs = useViewportRefs();
    refs.containerRef.current = container;
    return {
      refs,
      runtime: usePixiStage({
        refs,
        camera: { x: 12, y: 24, zoom: 2 },
        showGrid: true,
      }),
    };
  });
}

beforeEach(() => {
  pixiMock.applications.length = 0;
  pixiMock.initResults.length = 0;
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('usePixiStage runtime recovery', () => {
  it('reports an init failure and retry creates a fresh renderer', async () => {
    const initializationError = new Error('WebGL initialization failed');
    pixiMock.initResults.push(
      () => Promise.reject(initializationError),
      () => Promise.resolve(),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderStage();

    await waitFor(() => expect(result.current.runtime.runtimeState.status).toBe('error'));
    expect(result.current.runtime.runtimeState.message).toBe(initializationError.message);
    expect(consoleError).toHaveBeenCalledWith(
      '[Viewport] Pixi application initialization failed:',
      initializationError,
    );
    expect(pixiMock.applications).toHaveLength(1);

    act(() => result.current.runtime.retryViewport());
    await waitFor(() => expect(result.current.runtime.runtimeState.status).toBe('ready'));

    expect(pixiMock.applications).toHaveLength(2);
    expect(result.current.refs.appRef.current).toBe(pixiMock.applications[1]);
  });

  it('moves through recovering and ready when the WebGL context is restored', async () => {
    pixiMock.initResults.push(() => Promise.resolve());
    const { result } = renderStage();
    await waitFor(() => expect(result.current.runtime.runtimeState.status).toBe('ready'));

    const canvas = pixiMock.applications[0].canvas;
    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    act(() => canvas.dispatchEvent(lostEvent));

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(result.current.runtime.runtimeState).toMatchObject({
      status: 'recovering',
      canRetry: false,
    });

    act(() => canvas.dispatchEvent(new Event('webglcontextrestored')));
    expect(result.current.runtime.runtimeState).toEqual({
      status: 'ready',
      message: null,
      canRetry: false,
    });
  });

  it('updates only active particle runtimes and does not accumulate offscreen time', async () => {
    pixiMock.initResults.push(() => Promise.resolve());
    const { result } = renderStage();
    await waitFor(() => expect(result.current.runtime.runtimeState.status).toBe('ready'));

    const visibleUpdate = vi.fn();
    const offscreenUpdate = vi.fn();
    const visibleRuntime = { container: { renderable: true }, update: visibleUpdate };
    const offscreenRuntime = { container: { renderable: false }, update: offscreenUpdate };
    result.current.refs.particleRuntimesRef.current.set('visible:0', visibleRuntime as any);
    result.current.refs.particleRuntimesRef.current.set('offscreen:0', offscreenRuntime as any);
    result.current.refs.activeParticleRuntimeKeysRef.current.add('visible:0');
    result.current.refs.particleHostStatesRef.current.set('visible', {
      position: { x: 10, y: 20, z: 0 },
      angle: 0,
      hide: false,
    });
    useSceneStore.setState({ showParticles: true });

    const app = pixiMock.applications[0];
    app.ticker.deltaMS = 50;
    const onTicker = app.ticker.add.mock.calls[0][0] as () => void;

    act(() => onTicker());
    expect(visibleUpdate).toHaveBeenCalledTimes(1);
    expect(offscreenUpdate).not.toHaveBeenCalled();

    result.current.refs.activeParticleRuntimeKeysRef.current.clear();
    act(() => onTicker());
    expect(visibleUpdate).toHaveBeenCalledTimes(1);

    result.current.refs.activeParticleRuntimeKeysRef.current.add('visible:0');
    act(() => onTicker());
    expect(visibleUpdate).toHaveBeenCalledTimes(2);
    expect(visibleUpdate.mock.calls[1][0]).toBe(50);

    useSceneStore.setState({ showParticles: false });
    act(() => onTicker());
    expect(visibleUpdate).toHaveBeenCalledTimes(2);
  });
});
