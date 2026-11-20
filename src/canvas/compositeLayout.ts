/** The part of a render frame needed to place one layer of a composite sprite. */
export type CompositeLayerFrame = {
  layoutWidth: number;
  layoutHeight: number;
  frameWidth: number;
  frameHeight: number;
  offsetX: number;
  offsetY: number;
  pivotX: number;
  pivotY: number;
};

export type CompositeLayout = {
  /** Size of the composite image in pixels. */
  width: number;
  height: number;
  /** Normalized pivot of the composite image: where all layer pivots meet. */
  pivotX: number;
  pivotY: number;
  /** Top-left pixel position of each layer's frame inside the composite image, in input order. */
  placements: { x: number; y: number }[];
};

/**
 * Lays out layers so that every layer's pivot falls on the same point (the
 * Sprite Atlas Studio alignment, without a base layer). A layer's frame sits at
 * `offset` inside its `layout` box, and its pivot is `pivot * layout` in that box.
 * Returns null when there is no layer.
 */
export function computeCompositeLayout(layers: readonly CompositeLayerFrame[]): CompositeLayout | null {
  if (layers.length === 0) return null;
  // Frame rectangles relative to the shared pivot point.
  const rects = layers.map(layer => {
    const x = Math.round(layer.offsetX - layer.layoutWidth * layer.pivotX);
    const y = Math.round(layer.offsetY - layer.layoutHeight * layer.pivotY);
    return { x, y, right: x + layer.frameWidth, bottom: y + layer.frameHeight };
  });
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const width = Math.max(1, Math.ceil(Math.max(...rects.map(r => r.right)) - minX));
  const height = Math.max(1, Math.ceil(Math.max(...rects.map(r => r.bottom)) - minY));
  return {
    width,
    height,
    pivotX: -minX / width,
    pivotY: -minY / height,
    placements: rects.map(r => ({ x: r.x - minX, y: r.y - minY })),
  };
}
