// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import * as PIXI from 'pixi.js';
import { afterEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';
import type { EntityTemplate } from '../../types';
import { usePlacePreviewRenderer } from '../usePlacePreviewRenderer';
import type { ViewportRefs } from '../viewportTypes';

afterEach(() => cleanup());

describe('usePlacePreviewRenderer ambient lighting', () => {
  it('uses ambient, emissive, diffuse, and ghost alpha for placement previews', () => {
    useSceneStore.setState({ placingPrefab: null });
    const world = new PIXI.Container();
    const refs = {
      appRef: { current: { renderer: { width: 800, height: 600 } } },
      worldRef: { current: world },
      placePreviewMeshRef: { current: null },
      placePreviewGraphicsRef: { current: null },
      placePreviewMouseRef: { current: { x: 10, y: 20, isOver: true } },
      updatePlacePreviewRef: { current: null },
    } as unknown as ViewportRefs;
    const template: EntityTemplate = {
      name: 'lamp',
      spriteFile: 'lamp.png',
      spriteCut: { x: 1, y: 1 },
      type: 'horizontal',
      pivotAdjust: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      parallaxIntensity: 1,
      diffuseColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.4 },
      emissiveColor: { r: 0.1, g: 0.1, b: 0.1, a: 0 },
    };
    const renderFrame = {
      texture: PIXI.Texture.WHITE,
      layoutWidth: 32,
      layoutHeight: 32,
      frameWidth: 32,
      frameHeight: 32,
      offsetX: 0,
      offsetY: 0,
      pivotX: 0.5,
      pivotY: 0.5,
    };
    const initialProps = {
      refs,
      camera: { x: 0, y: 0, zoom: 1 },
      placingTemplate: 'lamp',
      templates: { lamp: template },
      snapToGrid: false,
      textureRevision: 0,
      getRenderFrame: () => renderFrame,
      ambient: { r: 0.2, g: 0.2, b: 0.2 },
    };
    const { rerender } = renderHook(props => usePlacePreviewRenderer(props), { initialProps });
    const mesh = refs.placePreviewMeshRef.current!;

    expect(mesh.tint).toBe(0x262626);
    expect(mesh.alpha).toBeCloseTo(0.26);

    rerender({ ...initialProps, ambient: { r: 0.6, g: 0.6, b: 0.6 } });
    expect(mesh.tint).toBe(0x595959);
  });
});
