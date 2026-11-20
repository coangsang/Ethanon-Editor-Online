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
  /** Where this layer's pivot sits relative to the shared pivot, in pixels (default 0, 0). */
  position?: { x: number; y: number };
  /** Rotation around this layer's own pivot, in radians, clockwise on screen (default 0). */
  rotation?: number;
};

export type CompositeLayerPlacement = {
  /** Position of the layer's pivot inside the composite image. */
  x: number;
  y: number;
  /** Rotation around that pivot, in radians, clockwise on screen. */
  rotation: number;
  /** Top-left corner of the layer's frame relative to its own pivot, before rotation. */
  frameX: number;
  frameY: number;
};

export type CompositeLayout = {
  /** Size of the composite image in pixels. */
  width: number;
  height: number;
  /** Normalized pivot of the composite image: the shared pivot point. */
  pivotX: number;
  pivotY: number;
  /** Placement of each layer, in input order. */
  placements: CompositeLayerPlacement[];
};

/** Removes floating-point noise so that floor/ceil of exact values stay exact. */
function snap(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Lays out layers so that every layer's pivot falls on the shared pivot, moved
 * by the layer's `position` (the Sprite Atlas Studio alignment, without a base
 * layer). A layer's frame sits at `offset` inside its `layout` box, and its pivot
 * is `pivot * layout` in that box. Returns null when there is no layer.
 */
export function computeCompositeLayout(layers: readonly CompositeLayerFrame[]): CompositeLayout | null {
  if (layers.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const relative = layers.map(layer => {
    const frameX = Math.round(layer.offsetX - layer.layoutWidth * layer.pivotX);
    const frameY = Math.round(layer.offsetY - layer.layoutHeight * layer.pivotY);
    const position = layer.position ?? { x: 0, y: 0 };
    const rotation = layer.rotation ?? 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    for (const [cornerX, cornerY] of [
      [frameX, frameY],
      [frameX + layer.frameWidth, frameY],
      [frameX, frameY + layer.frameHeight],
      [frameX + layer.frameWidth, frameY + layer.frameHeight],
    ]) {
      const x = snap(position.x + cornerX * cos - cornerY * sin);
      const y = snap(position.y + cornerX * sin + cornerY * cos);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return { position, rotation, frameX, frameY };
  });
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  const width = Math.max(1, Math.ceil(maxX) - minX);
  const height = Math.max(1, Math.ceil(maxY) - minY);
  return {
    width,
    height,
    pivotX: -minX / width,
    pivotY: -minY / height,
    placements: relative.map(layer => ({
      x: layer.position.x - minX,
      y: layer.position.y - minY,
      rotation: layer.rotation,
      frameX: layer.frameX,
      frameY: layer.frameY,
    })),
  };
}
