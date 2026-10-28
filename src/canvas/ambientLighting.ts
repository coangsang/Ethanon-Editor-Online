export type RgbColor = { r: number; g: number; b: number };
export type RgbaColor = RgbColor & { a: number };

const WHITE: RgbaColor = { r: 1, g: 1, b: 1, a: 1 };
const BLACK: RgbaColor = { r: 0, g: 0, b: 0, a: 0 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeAmbientColor(
  ambient: RgbColor,
  emissive: RgbaColor | undefined,
  diffuse: RgbaColor | undefined,
): RgbaColor {
  const materialEmissive = emissive ?? BLACK;
  const materialDiffuse = diffuse ?? WHITE;

  return {
    r: clamp01(Math.min(1, ambient.r + materialEmissive.r) * materialDiffuse.r),
    g: clamp01(Math.min(1, ambient.g + materialEmissive.g) * materialDiffuse.g),
    b: clamp01(Math.min(1, ambient.b + materialEmissive.b) * materialDiffuse.b),
    a: clamp01(materialDiffuse.a),
  };
}

export function rgbToTint(color: RgbColor): number {
  return (
    (Math.round(clamp01(color.r) * 255) << 16) |
    (Math.round(clamp01(color.g) * 255) << 8) |
    Math.round(clamp01(color.b) * 255)
  );
}
