import { screenToWorld } from './viewportMath';

function snapCoordinate(value: number, gridSize: number) {
  const snapped = Math.round(value / gridSize) * gridSize;
  return Object.is(snapped, -0) ? 0 : snapped;
}

export function getCursorSceneCoordinates(
  screenX: number,
  screenY: number,
  camera: { x: number; y: number; zoom: number },
  snapToGrid: boolean,
  gridSize: number,
) {
  const world = screenToWorld(screenX, screenY, camera);
  if (!snapToGrid || gridSize <= 0) return world;
  return {
    x: snapCoordinate(world.x, gridSize),
    y: snapCoordinate(world.y, gridSize),
  };
}
