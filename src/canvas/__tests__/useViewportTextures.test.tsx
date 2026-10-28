// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
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
}));

vi.mock('pixi.js', () => ({
  Assets: pixiAssets,
  Rectangle: class Rectangle {},
  Texture: class Texture {},
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
});

afterEach(cleanup);

describe('useViewportTextures transactional commits', () => {
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
