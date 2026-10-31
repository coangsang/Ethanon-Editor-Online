import type { EntityInstance, EntityPhysicsConfig } from '../types';

export type CollisionPoint = { x: number; y: number };
export type CollisionPrimitive =
  | { kind: 'path'; points: CollisionPoint[]; closed: true }
  | { kind: 'circle'; center: CollisionPoint; radius: number };

function rotate(point: CollisionPoint, angle: number): CollisionPoint {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function transformToWorld(point: CollisionPoint, entity: EntityInstance): CollisionPoint {
  const rotated = rotate(point, -entity.angle * Math.PI / 180);
  return { x: entity.position.x + rotated.x, y: entity.position.y + rotated.y };
}

function rectangle(center: CollisionPoint, halfX: number, halfY: number, angle = 0): CollisionPoint[] {
  return [
    { x: -halfX, y: -halfY },
    { x: halfX, y: -halfY },
    { x: halfX, y: halfY },
    { x: -halfX, y: halfY },
  ].map(point => {
    const rotated = rotate(point, angle);
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
}

export function buildCollisionPrimitives(
  entity: EntityInstance,
  physics: EntityPhysicsConfig | undefined,
  scale: { x: number; y: number },
): CollisionPrimitive[] {
  if (!physics || physics.shape === 0) return [];
  const { collision } = physics;
  const scaledCenter = {
    x: collision.position.x * scale.x,
    y: collision.position.y * scale.y,
  };
  const scaledSize = {
    x: collision.size.x * scale.x,
    y: collision.size.y * scale.y,
  };
  if (scaledSize.x === 0 || scaledSize.y === 0) return [];

  const toWorldPath = (points: CollisionPoint[]): CollisionPrimitive => ({
    kind: 'path',
    points: points.map(point => transformToWorld(point, entity)),
    closed: true,
  });

  if (physics.shape === 1) {
    return [toWorldPath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2))];
  }

  if (physics.shape === 2) {
    const radius = (Math.abs(scaledSize.x) + Math.abs(scaledSize.y)) / 4;
    return radius > 0 ? [{ kind: 'circle', center: transformToWorld(scaledCenter, entity), radius }] : [];
  }

  if (physics.shape === 3) {
    if (collision.polygon.length < 3) return [];
    return [toWorldPath(collision.polygon.map(vertex => ({
      x: scaledCenter.x + vertex.x * scaledSize.x / 2,
      y: scaledCenter.y + vertex.y * scaledSize.y / 2,
    })))];
  }

  const halfUnscaledX = collision.size.x / 2;
  const halfUnscaledY = collision.size.y / 2;
  return collision.compound.flatMap(item => {
    const center = {
      x: (collision.position.x + item.posX * halfUnscaledX) * scale.x,
      y: (collision.position.y + item.posY * halfUnscaledY) * scale.y,
    };
    if (item.shape === 'circle') {
      const radius = Math.abs((item.radius ?? 0) * halfUnscaledX * scale.x);
      return radius > 0
        ? [{ kind: 'circle' as const, center: transformToWorld(center, entity), radius }]
        : [];
    }

    if (!item.sizeX || !item.sizeY) return [];
    const localPoints = rectangle(
      { x: 0, y: 0 },
      item.sizeX * halfUnscaledX / 2,
      item.sizeY * halfUnscaledY / 2,
      item.angle,
    ).map(point => ({
      x: center.x + point.x * scale.x,
      y: center.y + point.y * scale.y,
    }));
    return [toWorldPath(localPoints)];
  });
}
