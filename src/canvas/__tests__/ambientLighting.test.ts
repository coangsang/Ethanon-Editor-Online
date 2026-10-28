import { describe, expect, it } from 'vitest';
import { computeAmbientColor, rgbToTint } from '../ambientLighting';

describe('ambient lighting', () => {
  it('uses black emissive and white diffuse as engine-compatible fallbacks', () => {
    expect(computeAmbientColor({ r: 0.2, g: 0.4, b: 0.6 }, undefined, undefined)).toEqual({
      r: 0.2, g: 0.4, b: 0.6, a: 1,
    });
  });

  it('adds emissive per channel, clamps to one, and multiplies diffuse', () => {
    expect(computeAmbientColor(
      { r: 0.2, g: 0.3, b: 0.4 },
      { r: 0.1, g: 0.8, b: 1, a: 0 },
      { r: 0.5, g: 0.25, b: 0.75, a: 0.6 },
    )).toEqual({ r: 0.15000000000000002, g: 0.25, b: 0.75, a: 0.6 });
  });

  it('keeps a fully emissive sprite at its diffuse color even in darkness', () => {
    expect(computeAmbientColor(
      { r: 0, g: 0, b: 0 },
      { r: 1, g: 1, b: 1, a: 0 },
      { r: 0.25, g: 0.5, b: 0.75, a: 1 },
    )).toEqual({ r: 0.25, g: 0.5, b: 0.75, a: 1 });
  });

  it('clamps output values before converting to a Pixi tint', () => {
    const color = computeAmbientColor(
      { r: 2, g: -1, b: 0.5 },
      { r: 0, g: 0, b: 0.75, a: 0 },
      { r: 2, g: 1, b: 1, a: 2 },
    );

    expect(color).toEqual({ r: 1, g: 0, b: 1, a: 1 });
    expect(rgbToTint(color)).toBe(0xff00ff);
  });
});
