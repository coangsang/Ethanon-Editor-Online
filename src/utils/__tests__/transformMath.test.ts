import { describe, expect, it } from 'vitest';
import { computeLocalFromWorld, computeWorldFromLocal } from '../transformMath';

describe('transform math angle convention', () => {
  it('rotates child local offsets with the same negative-angle convention as rendering', () => {
    const worldFromPositiveAngle = computeWorldFromLocal(
      { x: 0, y: 0, angle: 90 },
      { x: 10, y: 0, angle: 0 },
    );
    expect(worldFromPositiveAngle.x).toBeCloseTo(0);
    expect(worldFromPositiveAngle.y).toBeCloseTo(-10);

    const worldFromNegativeAngle = computeWorldFromLocal(
      { x: 0, y: 0, angle: -90 },
      { x: 10, y: 0, angle: 0 },
    );
    expect(worldFromNegativeAngle.x).toBeCloseTo(0);
    expect(worldFromNegativeAngle.y).toBeCloseTo(10);
  });

  it.each([45, 90, 180, -90])('round-trips local and world transforms at %s degrees', parentAngle => {
    const local = { x: 8, y: -3, angle: 30 };
    const world = computeWorldFromLocal({ x: 12, y: -7, angle: parentAngle }, local);
    const roundTripped = computeLocalFromWorld({ x: 12, y: -7, angle: parentAngle }, world);

    expect(roundTripped.x).toBeCloseTo(local.x);
    expect(roundTripped.y).toBeCloseTo(local.y);
    expect(roundTripped.angle).toBe(local.angle);
  });
});