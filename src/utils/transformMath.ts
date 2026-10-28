export type Transform2D = {
  x: number;
  y: number;
  angle: number;
};

/**
 * Computes the world transform for a child given its parent's world transform
 * and the child's local transform relative to the parent.
 */
export function computeWorldFromLocal(parent: Transform2D, local: Transform2D): Transform2D {
  const angleRad = -parent.angle * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const worldX = parent.x + local.x * cos - local.y * sin;
  const worldY = parent.y + local.x * sin + local.y * cos;
  
  let worldAngle = (parent.angle + local.angle) % 360;
  if (worldAngle < 0) worldAngle += 360;

  return { x: worldX, y: worldY, angle: worldAngle };
}

/**
 * Computes the local transform of a child relative to a parent,
 * given the parent's world transform and the child's world transform.
 */
export function computeLocalFromWorld(parent: Transform2D, world: Transform2D): Transform2D {
  // Inverse of computeWorldFromLocal: translate by -parent.position, then rotate by +parent.angle.
  const angleRad = parent.angle * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const dx = world.x - parent.x;
  const dy = world.y - parent.y;

  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  let localAngle = (world.angle - parent.angle) % 360;
  if (localAngle < 0) localAngle += 360;

  return { x: localX, y: localY, angle: localAngle };
}
