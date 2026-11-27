import type { EntityTemplate } from '../types';

/**
 * A sprite composited with a render template's `spriteFile`, bottom to top,
 * all aligned on their pivots. `spriteCut` is the grid cut used when the
 * sprite has no atlas. `offset` (pixels) moves the layer's pivot away from the
 * shared pivot; `angle` (degrees, same sign as an entity's angle) rotates the
 * layer around its own pivot.
 */
export type RenderCompositeLayer = {
  spriteFile: string;
  spriteCut: { x: number; y: number };
  offset?: { x: number; y: number };
  angle?: number;
  /** Drawn under `spriteFile` instead of over it (layers keep their order). */
  behind?: boolean;
  /** Blend mode of this layer when composited (1 = screen); default normal. */
  blendMode?: number;
  /** RGB (0xRRGGBB) multiplied into this sprite before compositing. */
  color?: number;
};

/**
 * Template the viewport draws with: an `EntityTemplate` plus viewport-only
 * fields. These fields exist only at runtime in `canvas/` and are not part of
 * the scene or entity file format, so they never reach the parser or serializer.
 */
export type RenderTemplate = EntityTemplate & {
  /** The viewport always draws the sprite's first frame. */
  renderFirstFrameOnly?: boolean;
  /** RGB (0xRRGGBB) multiplied into the base sprite when compositing. */
  compositeBaseColor?: number;
  /** Keep the base sprite's layout but omit its pixels. */
  compositeBaseHidden?: boolean;
  compositeLayers?: RenderCompositeLayer[];
};
