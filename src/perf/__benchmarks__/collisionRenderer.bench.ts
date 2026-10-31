import { bench, describe } from 'vitest';
import type { EntityInstance, EntityPhysicsConfig } from '../../types';
import { BucketManager } from '../../utils/BucketManager';
import {
  buildCollisionWorldGeometry,
  getProjectedCollisionBounds,
  projectCollisionGeometry,
  type CollisionWorldGeometry,
} from '../../canvas/collisionGeometry';

const SIZES = [1000, 5000, 10000] as const;
const BENCH_OPTIONS = {
  time: 500,
  iterations: 10,
  warmupTime: 100,
  warmupIterations: 5,
};

const physics: EntityPhysicsConfig = {
  shape: 1,
  static: false,
  sensor: false,
  bullet: false,
  fixedRotation: false,
  friction: 1,
  density: 1,
  restitution: 0,
  gravityScale: 1,
  collision: {
    valid: true,
    position: { x: 4, y: -2, z: 8 },
    size: { x: 48, y: 32, z: 16 },
    polygon: [],
    compound: [],
    joints: [],
  },
  warnings: [],
};

function createEntity(index: number): EntityInstance {
  return {
    id: index,
    editorEntityUID: `collision-${index}`,
    entityName: 'benchmark.ent',
    position: {
      x: (index % 100) * 64,
      y: Math.floor(index / 100) * 64,
      z: index % 32,
    },
    angle: index % 360,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
  };
}

const baseProjection = {
  camera: { x: 0, y: 0, zoom: 1 },
  parallaxContext: { globalParallaxIntensity: 0, screenWidth: 1920, originPxX: 960, originPxY: 540 },
  zAxisDirection: { x: 0, y: -1 },
  templateParallaxIntensity: 1,
};

for (const size of SIZES) {
  describe(`${size.toLocaleString()} collision entities`, () => {
    const entities = Array.from({ length: size }, (_, index) => createEntity(index));
    const geometries = entities.map(entity => buildCollisionWorldGeometry(entity, physics, { x: 1, y: 1 }))
      .filter((geometry): geometry is CollisionWorldGeometry => geometry !== null);
    const index = new BucketManager();
    geometries.forEach((geometry, geometryIndex) => {
      const bounds = getProjectedCollisionBounds(geometry, baseProjection);
      if (bounds) index.insertOrUpdate(entities[geometryIndex].editorEntityUID, bounds);
    });

    bench('cold geometry rebuild', () => {
      for (const entity of entities) buildCollisionWorldGeometry(entity, physics, { x: 1, y: 1 });
    }, BENCH_OPTIONS);

    bench('camera pan query without parallax', () => {
      index.getEntitiesInRect(512, 256, 1920, 1080, new Set());
    }, BENCH_OPTIONS);

    bench('parallax bounds projection', () => {
      const projection = {
        ...baseProjection,
        camera: { x: -320, y: 80, zoom: 1.25 },
        parallaxContext: { ...baseProjection.parallaxContext, globalParallaxIntensity: 2 },
      };
      for (const geometry of geometries) getProjectedCollisionBounds(geometry, projection);
    }, BENCH_OPTIONS);

    bench('project visible collision primitives', () => {
      const projection = {
        ...baseProjection,
        parallaxContext: { ...baseProjection.parallaxContext, globalParallaxIntensity: 2 },
      };
      for (let index = 0; index < Math.min(250, geometries.length); index++) {
        projectCollisionGeometry(geometries[index], projection);
      }
    }, BENCH_OPTIONS);

    bench('single-entity transform preview rebuild', () => {
      const entity = entities[Math.floor(size / 2)];
      buildCollisionWorldGeometry({
        ...entity,
        position: { ...entity.position, x: entity.position.x + 1, y: entity.position.y + 1 },
        angle: entity.angle + 1,
      }, physics, { x: 1.01, y: 0.99 });
    }, BENCH_OPTIONS);
  });
}
