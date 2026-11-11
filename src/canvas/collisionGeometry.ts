import type { EntityInstance, EntityPhysicsConfig } from '../types';
import type { Bounds } from './viewportTypes';
import { projectParallaxPoint, type ParallaxContext } from './viewportMath';

export type CollisionPoint = { x: number; y: number };
export type CollisionPrimitive =
  | { kind: 'path'; points: CollisionPoint[]; closed: boolean }
  | { kind: 'circle'; center: CollisionPoint; radius: number };

export type CollisionWorldPoint = CollisionPoint & { localZ: number };
export type CollisionWorldPrimitive =
  | { kind: 'path'; points: CollisionWorldPoint[]; closed: boolean }
  | { kind: 'circle'; center: CollisionWorldPoint; radius: number };

export type CollisionWorldGeometry = {
  effectiveZ: number;
  primitives: CollisionWorldPrimitive[];
};

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

function finite(values: number[]) {
  return values.every(Number.isFinite);
}

function rotateWith(point: CollisionPoint, cos: number, sin: number): CollisionPoint {
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function rectangle(center: CollisionPoint, halfX: number, halfY: number, cos = 1, sin = 0): CollisionPoint[] {
  return [
    { x: -halfX, y: -halfY }, { x: halfX, y: -halfY },
    { x: halfX, y: halfY }, { x: -halfX, y: halfY },
  ].map(point => {
    const rotated = rotateWith(point, cos, sin);
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
}

/** Builds camera-independent collision geometry in world space. */
export function buildCollisionWorldGeometry(
  entity: EntityInstance,
  physics: EntityPhysicsConfig | undefined,
  scale: { x: number; y: number },
): CollisionWorldGeometry | null {
  if (!physics || physics.shape === 0) return null;
  const { collision } = physics;
  if (!finite([
    entity.position.x, entity.position.y, entity.position.z, entity.angle,
    scale.x, scale.y,
    collision.position.x, collision.position.y, collision.position.z,
    collision.size.x, collision.size.y, collision.size.z,
  ])) return null;
  if (collision.size.x <= 0 || collision.size.y <= 0 || collision.size.z <= 0) return null;

  const scaledCenter = { x: collision.position.x * scale.x, y: collision.position.y * scale.y };
  const scaledSize = { x: collision.size.x * scale.x, y: collision.size.y * scale.y };
  if (scaledSize.x === 0 || scaledSize.y === 0) return null;

  const entityRadians = -entity.angle * Math.PI / 180;
  const entityCos = Math.cos(entityRadians);
  const entitySin = Math.sin(entityRadians);
  const toWorld = (point: CollisionPoint): CollisionPoint => {
    const rotated = rotateWith(point, entityCos, entitySin);
    return { x: entity.position.x + rotated.x, y: entity.position.y + rotated.y };
  };
  const frontZ = collision.position.z - collision.size.z / 2;
  const backZ = collision.position.z + collision.size.z / 2;
  const primitives: CollisionWorldPrimitive[] = [];

  const extrudePath = (points: CollisionPoint[]) => {
    const worldPoints = points.map(toWorld);
    primitives.push(
      { kind: 'path', points: worldPoints.map(point => ({ ...point, localZ: frontZ })), closed: true },
      { kind: 'path', points: worldPoints.map(point => ({ ...point, localZ: backZ })), closed: true },
    );
    for (const point of worldPoints) {
      primitives.push({
        kind: 'path',
        points: [{ ...point, localZ: frontZ }, { ...point, localZ: backZ }],
        closed: false,
      });
    }
  };

  const extrudeCircle = (center: CollisionPoint, radius: number) => {
    if (!Number.isFinite(radius) || radius <= 0) return;
    const worldCenter = toWorld(center);
    primitives.push(
      { kind: 'circle', center: { ...worldCenter, localZ: frontZ }, radius },
      { kind: 'circle', center: { ...worldCenter, localZ: backZ }, radius },
    );
    const extrema = [
      { x: center.x - radius, y: center.y }, { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y - radius }, { x: center.x, y: center.y + radius },
    ].map(toWorld);
    for (const point of extrema) {
      primitives.push({
        kind: 'path',
        points: [{ ...point, localZ: frontZ }, { ...point, localZ: backZ }],
        closed: false,
      });
    }
  };

  if (physics.shape === 1) {
    extrudePath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2));
  } else if (physics.shape === 2) {
    extrudeCircle(scaledCenter, (Math.abs(scaledSize.x) + Math.abs(scaledSize.y)) / 4);
  } else if (physics.shape === 3) {
    if (collision.polygon.length >= 3) {
      const points = collision.polygon.map(vertex => ({
        x: scaledCenter.x + vertex.x * scaledSize.x / 2,
        y: scaledCenter.y + vertex.y * scaledSize.y / 2,
      }));
      if (points.every(point => finite([point.x, point.y]))) {
        extrudePath(points);
      } else {
        extrudePath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2));
      }
    } else {
      extrudePath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2));
    }
  } else {
    const halfUnscaledX = collision.size.x / 2;
    const halfUnscaledY = collision.size.y / 2;
    let renderedCount = 0;
    for (const item of collision.compound) {
      if (!finite([item.posX, item.posY, item.angle])) continue;
      const center = {
        x: (collision.position.x + item.posX * halfUnscaledX) * scale.x,
        y: (collision.position.y + item.posY * halfUnscaledY) * scale.y,
      };
      if (item.shape === 'circle') {
        const radius = (item.radius ?? 0) * halfUnscaledX * Math.abs(scale.x);
        if (Number.isFinite(radius) && radius > 0) {
          extrudeCircle(center, radius);
          renderedCount++;
        }
        continue;
      }
      if (!item.sizeX || !item.sizeY || item.sizeX <= 0 || item.sizeY <= 0 || !Number.isFinite(item.sizeX) || !Number.isFinite(item.sizeY)) continue;
      const itemCos = Math.cos(item.angle);
      const itemSin = Math.sin(item.angle);
      const points = rectangle(
        { x: 0, y: 0 },
        item.sizeX * halfUnscaledX / 2,
        item.sizeY * halfUnscaledY / 2,
        itemCos,
        itemSin,
      ).map(point => ({ x: center.x + point.x * scale.x, y: center.y + point.y * scale.y }));
      extrudePath(points);
      renderedCount++;
    }
    if (renderedCount === 0) {
      extrudePath(rectangle(scaledCenter, scaledSize.x / 2, scaledSize.y / 2));
    }
  }

  return primitives.length > 0 ? { effectiveZ: entity.position.z, primitives } : null;
}

function validProjection(projection: CollisionProjection) {
  return projection.camera.zoom > 0 && finite([
    projection.camera.x, projection.camera.y, projection.camera.zoom,
    projection.parallaxContext.globalParallaxIntensity,
    projection.parallaxContext.screenWidth,
    projection.parallaxContext.originPxX,
    projection.parallaxContext.originPxY,
    projection.zAxisDirection.x, projection.zAxisDirection.y,
    projection.templateParallaxIntensity,
  ]) && projection.parallaxContext.screenWidth > 0;
}

function projectWorldPoint(
  point: CollisionWorldPoint,
  effectiveZ: number,
  projection: CollisionProjection,
): CollisionPoint {
  const base = projectParallaxPoint(
    point,
    effectiveZ,
    projection.camera,
    projection.parallaxContext,
    projection.templateParallaxIntensity,
  );
  return {
    x: base.x + projection.zAxisDirection.x * point.localZ,
    y: base.y + projection.zAxisDirection.y * point.localZ,
  };
}

export function projectCollisionGeometry(
  geometry: CollisionWorldGeometry | null,
  projection: CollisionProjection = DEFAULT_PROJECTION,
): CollisionPrimitive[] {
  if (!geometry || !validProjection(projection) || !Number.isFinite(geometry.effectiveZ)) return [];
  const result: CollisionPrimitive[] = [];
  for (const primitive of geometry.primitives) {
    if (primitive.kind === 'path') {
      result.push({
        kind: 'path',
        points: primitive.points.map(point => projectWorldPoint(point, geometry.effectiveZ, projection)),
        closed: primitive.closed,
      });
      continue;
    }
    const center = projectWorldPoint(primitive.center, geometry.effectiveZ, projection);
    const edge = projectWorldPoint(
      { ...primitive.center, x: primitive.center.x + primitive.radius },
      geometry.effectiveZ,
      projection,
    );
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (Number.isFinite(radius) && radius > 0) result.push({ kind: 'circle', center, radius });
  }
  return result;
}

/** Returns exact projected bounds without allocating projected primitives. */
export function getProjectedCollisionBounds(
  geometry: CollisionWorldGeometry | null,
  projection: CollisionProjection = DEFAULT_PROJECTION,
): Bounds | null {
  if (!geometry || !validProjection(projection) || !Number.isFinite(geometry.effectiveZ)) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (point: CollisionPoint, radius = 0) => {
    minX = Math.min(minX, point.x - radius);
    minY = Math.min(minY, point.y - radius);
    maxX = Math.max(maxX, point.x + radius);
    maxY = Math.max(maxY, point.y + radius);
  };
  for (const primitive of geometry.primitives) {
    if (primitive.kind === 'path') {
      for (const point of primitive.points) include(projectWorldPoint(point, geometry.effectiveZ, projection));
      continue;
    }
    const center = projectWorldPoint(primitive.center, geometry.effectiveZ, projection);
    const edge = projectWorldPoint(
      { ...primitive.center, x: primitive.center.x + primitive.radius },
      geometry.effectiveZ,
      projection,
    );
    include(center, Math.hypot(edge.x - center.x, edge.y - center.y));
  }
  if (!finite([minX, minY, maxX, maxY])) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function buildCollisionPrimitives(
  entity: EntityInstance,
  physics: EntityPhysicsConfig | undefined,
  scale: { x: number; y: number },
  projection: CollisionProjection = DEFAULT_PROJECTION,
): CollisionPrimitive[] {
  return projectCollisionGeometry(buildCollisionWorldGeometry(entity, physics, scale), projection);
}
