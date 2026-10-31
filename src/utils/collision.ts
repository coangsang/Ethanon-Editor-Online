import type {
  CollisionCompoundShape,
  CollisionJoint,
  CollisionPolygonVertex,
  CollisionShape,
  EntityPhysicsConfig,
} from '../types';

type RawMap = Record<string, unknown>;

type EnmlBlock = {
  name: string;
  values: Record<string, string>;
};

const SHAPE_NAMES = ['None', 'Box', 'Circle', 'Polygon', 'Compound'] as const;

function asMap(value: unknown): RawMap | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RawMap : null;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const map = asMap(value);
  return map && typeof map['#text'] === 'string' ? map['#text'] : '';
}

/** Parses Ethanon's flat ENML blocks. Collision ENML has no nested blocks. */
export function parseCollisionEnml(value: unknown): EnmlBlock[] {
  const source = textValue(value)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const blocks: EnmlBlock[] = [];
  const blockPattern = /([A-Za-z_][\w.-]*)\s*\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(source))) {
    const values: Record<string, string> = {};
    const propertyPattern = /([A-Za-z_][\w.-]*)\s*=\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^;\r\n}]+)\s*;?/g;
    let property: RegExpExecArray | null;
    while ((property = propertyPattern.exec(match[2]))) {
      const raw = property[2].trim();
      values[property[1]] = ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
        ? raw.slice(1, -1)
        : raw;
    }
    blocks.push({ name: match[1], values });
  }
  return blocks;
}

function parsePolygon(value: unknown, warnings: string[]): CollisionPolygonVertex[] {
  const blocks = parseCollisionEnml(value);
  const vertices: CollisionPolygonVertex[] = [];
  let valid = true;
  const vertexBlocks = blocks.filter(block => /^v\d+$/.test(block.name));
  for (let index = 0; index < vertexBlocks.length; index++) {
    const block = vertexBlocks[index];
    if (block.name !== `v${index}`) {
      warnings.push(`Polygon vertices must be sequential; expected v${index} but found ${block.name}.`);
      valid = false;
    }
    const x = Number(block.values.x);
    const y = Number(block.values.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      warnings.push(`Polygon vertex ${block.name} has invalid coordinates.`);
      valid = false;
      continue;
    }
    vertices.push({ name: block.name, x, y });
  }
  if (vertices.length < 3 || vertices.length > 8) {
    warnings.push('Polygon must contain 3 to 8 sequential vertices.');
    valid = false;
  }
  if (vertices.length >= 3 && !validatePolygonGeometry(vertices, warnings)) valid = false;
  return valid ? vertices : [];
}

function optionalNumber(values: Record<string, string>, key: string): number | undefined {
  if (values[key] === undefined) return undefined;
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredNumber(
  values: Record<string, string>,
  key: string,
  label: string,
  warnings: string[],
): number | null {
  const raw = values[key];
  const parsed = Number(raw);
  if (raw === undefined || raw.trim() === '' || !Number.isFinite(parsed)) {
    warnings.push(`${label} has invalid ${key}.`);
    return null;
  }
  return parsed;
}

function inNormalizedRange(value: number) {
  return value >= -1 && value <= 1;
}

function validatePolygonGeometry(vertices: CollisionPolygonVertex[], warnings: string[]): boolean {
  const epsilon = 1e-8;
  let valid = true;

  for (const vertex of vertices) {
    if (!inNormalizedRange(vertex.x) || !inNormalizedRange(vertex.y)) {
      warnings.push(`Polygon vertex ${vertex.name} must be within [-1, 1].`);
      valid = false;
    }
  }

  const seen = new Set<string>();
  for (const vertex of vertices) {
    const key = `${vertex.x}:${vertex.y}`;
    if (seen.has(key)) {
      warnings.push(`Polygon vertex ${vertex.name} duplicates another vertex.`);
      valid = false;
    }
    seen.add(key);
  }

  let windingSign = 0;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const c = vertices[(index + 2) % vertices.length];
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const bcX = c.x - b.x;
    const bcY = c.y - b.y;
    if (Math.abs(abX) <= epsilon && Math.abs(abY) <= epsilon) {
      valid = false;
      continue;
    }
    const cross = abX * bcY - abY * bcX;
    if (Math.abs(cross) <= epsilon) {
      warnings.push('Polygon must not contain three consecutive collinear vertices.');
      valid = false;
      continue;
    }
    const sign = Math.sign(cross);
    if (windingSign === 0) windingSign = sign;
    else if (windingSign !== sign) {
      warnings.push('Polygon must be convex.');
      valid = false;
      break;
    }
  }

  // With screen coordinates (Y grows down), a positive cross product is clockwise.
  if (windingSign < 0) {
    warnings.push('Polygon vertices must use clockwise screen-space winding.');
    valid = false;
  }
  return valid;
}

function parseCompound(value: unknown, warnings: string[]): CollisionCompoundShape[] {
  return parseCollisionEnml(value).flatMap(block => {
    const shape = block.values.shape?.toLowerCase();
    if (shape !== 'box' && shape !== 'circle') {
      warnings.push(`Compound shape "${block.name}" has unsupported type "${block.values.shape ?? ''}".`);
      return [];
    }
    const label = `Compound shape "${block.name}"`;
    const posX = requiredNumber(block.values, 'posX', label, warnings);
    const posY = requiredNumber(block.values, 'posY', label, warnings);
    if (posX === null || posY === null) return [];
    if (!inNormalizedRange(posX) || !inNormalizedRange(posY)) {
      warnings.push(`${label} position must be within [-1, 1].`);
      return [];
    }
    const item: CollisionCompoundShape = {
      name: block.name,
      shape,
      posX,
      posY,
      angle: numberValue(block.values.angle, 0),
      friction: optionalNumber(block.values, 'friction'),
      density: optionalNumber(block.values, 'density'),
      restitution: optionalNumber(block.values, 'restitution'),
    };
    if (shape === 'box') {
      const sizeX = requiredNumber(block.values, 'sizeX', label, warnings);
      const sizeY = requiredNumber(block.values, 'sizeY', label, warnings);
      if (sizeX === null || sizeY === null || sizeX <= 0 || sizeY <= 0) {
        if (sizeX !== null && sizeY !== null) warnings.push(`Compound box "${block.name}" has invalid size.`);
        return [];
      }
      item.sizeX = sizeX;
      item.sizeY = sizeY;
    } else {
      const radius = requiredNumber(block.values, 'radius', label, warnings);
      if (radius === null || radius <= 0) {
        if (radius !== null) warnings.push(`Compound circle "${block.name}" has invalid radius.`);
        return [];
      }
      item.radius = radius;
    }
    return [item];
  });
}

function parseJoints(value: unknown, warnings: string[]): CollisionJoint[] {
  return parseCollisionEnml(value)
    .filter(block => block.name.startsWith('revoluteJoint'))
    .map(block => {
      const joint = {
        name: block.name,
        otherEntityName: block.values.otherEntityName ?? '',
        attachPointAX: numberValue(block.values.attachPointAX, 0),
        attachPointAY: numberValue(block.values.attachPointAY, 0),
        attachPointBX: numberValue(block.values.attachPointBX, 0),
        attachPointBY: numberValue(block.values.attachPointBY, 0),
        enableLimit: booleanValue(block.values.enableLimit),
        lowerAngle: numberValue(block.values.lowerAngle, 0),
        upperAngle: numberValue(block.values.upperAngle, 0),
        enableMotor: booleanValue(block.values.enableMotor),
        motorSpeed: numberValue(block.values.motorSpeed, 0),
        maxMotorTorque: numberValue(block.values.maxMotorTorque, 0),
      };
      const anchors = [joint.attachPointAX, joint.attachPointAY, joint.attachPointBX, joint.attachPointBY];
      if (anchors.some(anchor => !inNormalizedRange(anchor))) {
        warnings.push(`Joint "${joint.name}" anchors must be within [-1, 1].`);
      }
      if (joint.enableLimit && joint.lowerAngle > joint.upperAngle) {
        warnings.push(`Joint "${joint.name}" lowerAngle must not exceed upperAngle.`);
      }
      return joint;
    });
}

export function hasPhysicsData(raw: RawMap): boolean {
  return raw.shape !== undefined || raw.Collision !== undefined || [
    'static', 'sensor', 'bullet', 'fixedRotation', 'friction', 'density', 'restitution', 'gravityScale',
  ].some(key => raw[key] !== undefined);
}

export function parseEntityPhysics(raw: RawMap): EntityPhysicsConfig {
  const warnings: string[] = [];
  const rawShape = raw.shape === undefined ? 0 : Number(raw.shape);
  const validShape = Number.isInteger(rawShape) && rawShape >= 0 && rawShape <= 4;
  const shape = (validShape ? rawShape : 0) as CollisionShape;
  if (!validShape) warnings.push(`Unsupported collision shape value "${String(raw.shape)}".`);

  const collision = asMap(raw.Collision);
  const position = asMap(collision?.Position);
  const size = asMap(collision?.Size);
  const sizeX = numberValue(size?.x, 0);
  const sizeY = numberValue(size?.y, 0);
  const sizeZ = numberValue(size?.z, 0);
  let geometryValid = shape === 0 || collision !== null;
  if (shape !== 0 && !collision) warnings.push('Collision data is missing.');
  if (shape !== 0) {
    for (const axis of ['x', 'y', 'z'] as const) {
      if (position?.[axis] === undefined || String(position[axis]).trim() === '' || !Number.isFinite(Number(position[axis]))) {
        warnings.push(`Collision Position.${axis} is missing or invalid.`);
        geometryValid = false;
      }
      if (size?.[axis] === undefined || String(size[axis]).trim() === '' || !Number.isFinite(Number(size[axis]))) {
        warnings.push(`Collision Size.${axis} is missing or invalid.`);
        geometryValid = false;
      }
    }
  }
  if (shape !== 0 && (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0)) {
    warnings.push('Collision Size.x, Size.y, and Size.z must be positive.');
    geometryValid = false;
  }
  const polygon = shape === 3 ? parsePolygon(collision?.Polygon, warnings) : [];
  if (shape === 3 && polygon.length === 0) geometryValid = false;
  const compound = shape === 4 ? parseCompound(collision?.Compound, warnings) : [];
  if (shape === 4 && compound.length === 0) {
    warnings.push('Compound collision has no valid child shapes.');
    geometryValid = false;
  }

  return {
    shape,
    static: booleanValue(raw.static),
    sensor: booleanValue(raw.sensor),
    bullet: booleanValue(raw.bullet),
    fixedRotation: booleanValue(raw.fixedRotation),
    friction: numberValue(raw.friction, 1),
    density: numberValue(raw.density, 1),
    restitution: numberValue(raw.restitution, 0),
    gravityScale: numberValue(raw.gravityScale, 1),
    collision: {
      valid: geometryValid,
      position: {
        x: numberValue(position?.x, 0),
        y: numberValue(position?.y, 0),
        z: numberValue(position?.z, 0),
      },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      polygon,
      compound,
      joints: parseJoints(collision?.Joints, warnings),
    },
    warnings,
  };
}

export function collisionShapeName(shape: CollisionShape): string {
  return SHAPE_NAMES[shape] ?? 'Unknown';
}
