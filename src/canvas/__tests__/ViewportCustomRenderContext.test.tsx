// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityCustomRenderContext } from '../entityCustomRender';

const calls = vi.hoisted(() => ({
  textures: [] as (EntityCustomRenderContext | undefined)[],
  mesh: [] as (EntityCustomRenderContext | undefined)[],
}));

vi.mock('../useViewportRefs', () => ({ useViewportRefs: () => ({ containerRef: { current: null } }) }));
vi.mock('../usePixiStage', () => ({
  usePixiStage: () => ({ viewportSize: { width: 0, height: 0 }, appReadyRevision: 0, runtimeState: null, retryViewport: () => {} }),
}));
vi.mock('../useViewportTextures', () => ({
  useViewportTextures: ({ customRenderContext }: { customRenderContext?: EntityCustomRenderContext }) => {
    calls.textures.push(customRenderContext);
    return { textureRevision: 0, getRenderFrame: () => null };
  },
}));
vi.mock('../useEntityMeshRenderer', () => ({
  useEntityMeshRenderer: ({ customRenderContext }: { customRenderContext?: EntityCustomRenderContext }) => {
    calls.mesh.push(customRenderContext);
  },
}));
vi.mock('../useViewportInteractions', () => ({ useViewportInteractions: () => ({}) }));
vi.mock('../useEntityCustomRenderer', () => ({ useEntityCustomRenderer: () => {} }));
vi.mock('../useCollisionRenderer', () => ({ useCollisionRenderer: () => {} }));
vi.mock('../usePlacePreviewRenderer', () => ({ usePlacePreviewRenderer: () => {} }));
vi.mock('../useViewportSelection', () => ({ useViewportSelection: () => {} }));
vi.mock('../ViewportZoomControls', () => ({ ViewportZoomControls: () => null }));
vi.mock('../ViewportCursorCoordinates', () => ({ ViewportCursorCoordinates: () => null }));
vi.mock('../ViewportStatsOverlay', () => ({ ViewportStatsOverlay: () => null }));
vi.mock('../ViewportRuntimeOverlay', () => ({ ViewportRuntimeOverlay: () => null }));

import { useSceneStore } from '../../store/sceneStore';
import { Viewport } from '../Viewport';

afterEach(() => {
  cleanup();
  calls.textures.length = 0;
  calls.mesh.length = 0;
  useSceneStore.setState({ customRenderSettings: {} });
});

describe('Viewport custom render contexts', () => {
  it('keeps the texture load context stable while viewport render settings change', () => {
    render(<Viewport />);
    const textureContext = calls.textures.at(-1);
    expect(textureContext?.settings).toBeUndefined();

    act(() => useSceneStore.getState().setCharacterRenderFieldEnabled('uid-1', 'hair', false));

    expect(calls.textures.at(-1)).toBe(textureContext);
    expect(calls.mesh.at(-1)?.settings).toEqual({ 'uid-1': { fields: { hair: false } } });
    expect(calls.mesh.at(-1)?.characters).toBe(textureContext?.characters);
  });
});
