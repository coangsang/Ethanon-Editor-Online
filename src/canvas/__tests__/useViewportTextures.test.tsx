// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityTemplate } from '../../types';
import type { ViewportRefs } from '../viewportTypes';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

const pixiAssets = vi.hoisted(() => ({
  load: vi.fn(),
  unload: vi.fn(async () => undefined),
  from: vi.fn((resource: unknown) => ({ source: { resource }, destroy: vi.fn() })),
}));

vi.mock('pixi.js', () => ({
  Assets: pixiAssets,
  Rectangle: class Rectangle {},
  Texture: class Texture {
    static from = pixiAssets.from;
    static EMPTY = { empty: true };
  },
}));

import { useViewportTextures } from '../useViewportTextures';

const template: EntityTemplate = {
  name: 'Hero',
  spriteFile: 'hero.png',
  spriteCut: { x: 1, y: 1 },
  type: 'horizontal',
  pivotAdjust: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  parallaxIntensity: 1,
};

function createTextureRefs(): ViewportRefs {
  return {
    frameTextureMapRef: { current: new Map() },
    baseTextureMapRef: { current: new Map() },
    textureUrlMapRef: { current: new Map() },
    boundsMapRef: { current: new Map() },
    drawSortSignatureRef: { current: '' },
    placeholderTextureRef: { current: null },
  } as unknown as ViewportRefs;
}

function hookProps(refs: ViewportRefs, url: string) {
  return {
    refs,
    sceneEntities: [],
    templates: { Hero: template },
    templateAtlases: {},
    templateImageUrls: { 'hero.png': url },
    placingTemplate: null,
  };
}

beforeEach(() => {
  pixiAssets.load.mockReset();
  pixiAssets.unload.mockReset().mockResolvedValue(undefined);
  pixiAssets.from.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useViewportTextures transactional commits', () => {
  it.each([false, true])('omits hidden body pixels, keeps overlays (%s), and separates cached frames', async withOverlay => {
    const context = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const bodyImage = {};
    const overlayImage = {};
    const body = { uid: 1, width: 20, height: 40, frame: { x: 0, y: 0, width: 20, height: 40 }, source: { resource: bodyImage } };
    const overlay = { uid: 2, width: 10, height: 10, frame: { x: 0, y: 0, width: 10, height: 10 }, source: { resource: overlayImage } };
    pixiAssets.load.mockImplementation(async ({ src }: { src: string }) => src === 'body-url' ? body : overlay);
    const refs = createTextureRefs();
    const { result } = renderHook(() => useViewportTextures({
      ...hookProps(refs, 'body-url'),
      templates: { Hero: template, Hat: { ...template, spriteFile: 'hat.png' } },
      templateImageUrls: { 'hero.png': 'body-url', 'hat.png': 'hat-url' },
    }));
    await waitFor(() => expect(result.current.textureRevision).toBe(1));
    const visibleTemplate = {
      ...template,
      compositeLayers: withOverlay ? [{ spriteFile: 'hat.png', spriteCut: { x: 1, y: 1 } }] : undefined,
    };
    const visible = result.current.getRenderFrame(visibleTemplate, 0);
    context.drawImage.mockClear();
    const hiddenTemplate = { ...visibleTemplate, compositeBaseHidden: true };
    const hidden = result.current.getRenderFrame(hiddenTemplate, 0);
    expect(hidden.texture).not.toBe(visible.texture);
    expect(hidden.layoutWidth).toBe(20);
    expect(hidden.layoutHeight).toBe(40);
    expect(context.drawImage).toHaveBeenCalledTimes(withOverlay ? 1 : 0);
    if (withOverlay) expect(context.drawImage.mock.calls[0][0]).toBe(overlayImage);
    expect(result.current.getRenderFrame(hiddenTemplate, 0)).toBe(hidden);
    expect(result.current.getRenderFrame(visibleTemplate, 0).texture).toBe(visible.texture);
    expect(pixiAssets.load).toHaveBeenCalledTimes(2);
  });

  it.each(['frame', 'particle', 'independent frame'])(
    'keeps retired textures alive while a %s on stage still uses them',
    async kind => {
      let nextId = 0;
      const callbacks = new Map<number, FrameRequestCallback>();
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callbacks.set(++nextId, callback);
        return nextId;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
      const flushFrames = () => act(() => {
        const pending = [...callbacks.values()];
        callbacks.clear();
        pending.forEach(callback => callback(performance.now()));
      });
      const oldSource = {};
      const oldTexture = { source: oldSource };
      const newTexture = { source: {} };
      pixiAssets.load.mockImplementation(({ src }: { src: string }) =>
        Promise.resolve(src === 'old-url' ? oldTexture : newTexture));
      const refs = createTextureRefs();
      const frame = { source: kind === 'independent frame' ? {} : oldSource, destroy: vi.fn() };
      const child = { texture: frame, children: [], visible: false };
      const stage = { children: [child] };
      refs.appRef = { current: { stage } } as unknown as ViewportRefs['appRef'];
      const { rerender } = renderHook(props => useViewportTextures(props), {
        initialProps: hookProps(refs, 'old-url'),
      });
      await waitFor(() => expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(oldTexture));
      // Particle subtextures have the old source but are owned by their runtime.
      if (kind !== 'particle') {
        refs.frameTextureMapRef.current.set('old-frame', frame as never);
      }
      flushFrames();
      rerender(hookProps(refs, 'new-url'));
      await waitFor(() => expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(newTexture));

      flushFrames();
      flushFrames();
      expect(frame.destroy).not.toHaveBeenCalled();
      expect(pixiAssets.unload).not.toHaveBeenCalledWith('old-url');

      child.texture = { source: newTexture.source, destroy: vi.fn() };
      flushFrames();
      if (kind !== 'particle') expect(frame.destroy).toHaveBeenCalledWith(false);
      else expect(frame.destroy).not.toHaveBeenCalled();
      await waitFor(() => expect(pixiAssets.unload).toHaveBeenCalledWith('old-url'));
    },
  );

  it('does not let an older generation overwrite a newer cache', async () => {
    const oldLoad = deferred<object>();
    const newLoad = deferred<object>();
    const oldTexture = { generation: 'old' };
    const newTexture = { generation: 'new' };
    pixiAssets.load.mockImplementation(({ src }: { src: string }) => (
      src === 'old-url' ? oldLoad.promise : newLoad.promise
    ));
    const refs = createTextureRefs();
    const { rerender } = renderHook(
      props => useViewportTextures(props),
      { initialProps: hookProps(refs, 'old-url') },
    );

    rerender(hookProps(refs, 'new-url'));
    newLoad.resolve(newTexture);
    await waitFor(() => expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(newTexture));

    oldLoad.resolve(oldTexture);
    await waitFor(() => expect(pixiAssets.unload).toHaveBeenCalledWith('old-url'));
    expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(newTexture);
  });

  it('retains the previous project until the replacement texture set settles', async () => {
    const nextLoad = deferred<object>();
    const oldTexture = { generation: 'old' };
    const newTexture = { generation: 'new' };
    pixiAssets.load.mockImplementation(({ src }: { src: string }) => (
      src === 'old-url' ? Promise.resolve(oldTexture) : nextLoad.promise
    ));
    const refs = createTextureRefs();
    const { rerender } = renderHook(
      props => useViewportTextures(props),
      { initialProps: hookProps(refs, 'old-url') },
    );
    await waitFor(() => expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(oldTexture));

    rerender(hookProps(refs, 'new-url'));
    expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(oldTexture);
    expect(pixiAssets.unload).not.toHaveBeenCalledWith('old-url');

    nextLoad.resolve(newTexture);
    await waitFor(() => expect(refs.baseTextureMapRef.current.get('hero.png')).toBe(newTexture));
    await waitFor(() => expect(pixiAssets.unload).toHaveBeenCalledWith('old-url'));
  });
});
