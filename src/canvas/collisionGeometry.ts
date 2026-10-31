import type { EntityInstance, EntityPhysicsConfig } from '../types';
import { projectParallaxPoint, type ParallaxContext } from './viewportMath';

export type CollisionPoint = { x: number; y: number };
export type CollisionPrimitive =
  | { kind: 'path'; points: CollisionPoint[]; closed: boolean }
  | { kind: 'circle'; center: CollisionPoint; radius: number };

export type CollisionProjection = {
  camera: { x: number; y: number; zoom: number };
  parallaxContext: ParallaxContext;
  zAxisDirection: { x: number; y: number };
  templateParallaxIntensity: number;
};

const DEFAULT_PROJECTION: CollisionProjection = {
  camera: { x: 0, y: 0, zoom: 1 },
  parallaxContext: { globalParallaxIntensity: 0, screenWidth: 1, originPxX: 0, originPxY: 0 },
  zAxisDirection: { x: 0, y: 0 },
  templateParallaxIntensity: 1,
};

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
    { x: -halfX, y: -halfY }, { x: halfX, y: -halfY },
    { x: halfX, y: halfY }, { x: -halfX, y: halfY },
  ].map(point => {
    const rotated = rotate(point, angle);
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
}

export function buildCollisionPrimitives(
  entity: EntityInstance,
  physics: EntityPhysicsConfig | undefined,
  scale: { x: number; y: number },
  projection: CollisionProjection = DEFAULT_PROJECTION,
): CollisionPrimitive[] {
  if (!physics || physics.shape === 0) return [];
  const { collision } = physics;
  if (!collision.valid || [collision.size.x, collision.size.y, collision.size.z].some(value => !Number.isFinite(value) || value <= 0)) return [];

  const scaledCenter = {
    x: collision.position.x * scale.x,
    y: collision.position.y * scale.y,
  };
  const scaledSize = {
    x: collision.size.x * scale.x,
    y: collision.size.y * scale.y,
  };
  if (scaledSize.x === 0 || scaledSize.y === 0) return [];

  const frontZ = collision.position.z - collision.size.z / 2;
  const backZ = collision.position.z + collision.size.z / 2;
  const projectPoint = (localPoint: CollisionPoint, localZ: number): CollisionPoint => {
    const base = projectParallaxPoint(
      transformToWorld(localPoint, entity),
      entity.position.z,
      projection.camera,
      projection.parallaxContext,
      projection.templateParallaxIntensity,
    );
    return {
      x: base.x + projection.zAxisDirection.x * localZ,
      y: base.y + projection.zAxisDirection.y * localZ,
    };
  };
  const projectedPath = (points: CollisionPoint[], localZ: number, closed = true): CollisionPrimitive => ({
    kind: 'path', points: points.map(point => projectPoint(point, localZ)), closed,
  });
  const connector = (point: CollisionPoint): CollisionPrimitive => ({
    kind: 'path',
    points: [projectPoint(point, frontZ), projectPoint(point, backZ)],
    closed: false,
  });
  const extrudePath = (points: CollisionPoint[]): CollisionPrimitive[] => [
    projectedPath(points, frontZ),
    projectedPath(points, backZ),
    ...points.map(connector),
  ];

  const circlePrimitives = (center: CollisionPoint, radius: number): CollisionPrimitive[] => {
    if (radius <= 0) return [];
    const projectedCenter = projectPoint(center, frontZ);
    const projectedEdge = projectPoint({ x: center.x + radius, y: center.y }, frontZ);
    const projectedRadius = Math.hypot(
      projectedEdge.x - projectedCenter.x,
      projectedEdge.y - projectedCenter.y,
    );
    const extrema = [
      { x: center.x - radius, y: center.y }, { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y - radius }, { x: center.x, y: center.y + radius },
    ];
    return [
      { kind: 'circle', center: projectedCenter, radius: projectedRadius },
      { kind: 'circle', center: projectPoint(center, backZ), radius: projectedRadius },
      ...extrema.map(connector),
    ];
  };

  if (physics.shape === 1) {
    return extrudePath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2));
  }
  if (physics.shape === 2) {
    return circlePrimitives(scaledCenter, (Math.abs(scaledSize.x) + Math.abs(scaledSize.y)) / 4);
  }
  if (physics.shape === 3) {
    if (collision.polygon.length < 3) return [];
    return extrudePath(collision.polygon.map(vertex => ({
      x: scaledCenter.x + vertex.x * scaledSize.x / 2,
      y: scaledCenter.y + vertex.y * scaledSize.y / 2,
    })));
  }

  const halfUnscaledX = collision.size.x / 2;
  const halfUnscaledY = collision.size.y / 2;
  return collision.compound.flatMap(item => {
    const center = {
      x: (collision.position.x + item.posX * halfUnscaledX) * scale.x,
      y: (collision.position.y + item.posY * halfUnscaledY) * scale.y,
    };
    if (item.shape === 'circle') {
      const radius = (item.radius ?? 0) * halfUnscaledX * Math.abs(scale.x);
      return circlePrimitives(center, radius);
    }
    if (!item.sizeX || !item.sizeY || item.sizeX <= 0 || item.sizeY <= 0) return [];
    const localPoints = rectangle(
      { x: 0, y: 0 },
      item.sizeX * halfUnscaledX / 2,
      item.sizeY * halfUnscaledY / 2,
      item.angle,
    ).map(point => ({ x: center.x + point.x * scale.x, y: center.y + point.y * scale.y }));
    return extrudePath(localPoints);
  });
}
