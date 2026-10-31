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
  for (let index = 0; ; index++) {
    const block = blocks.find(item => item.name === `v${index}`);
    if (!block) break;
    const x = Number(block.values.x);
    const y = Number(block.values.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      warnings.push(`Polygon vertex v${index} has invalid coordinates.`);
      continue;
    }
    vertices.push({ name: block.name, x, y });
  }
  if (vertices.length < 3 || vertices.length > 8) {
    warnings.push('Polygon must contain 3 to 8 sequential vertices.');
  }
  return vertices;
}

function optionalNumber(values: Record<string, string>, key: string): number | undefined {
  if (values[key] === undefined) return undefined;
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCompound(value: unknown, warnings: string[]): CollisionCompoundShape[] {
  return parseCollisionEnml(value).flatMap(block => {
    const shape = block.values.shape?.toLowerCase();
    if (shape !== 'box' && shape !== 'circle') {
      warnings.push(`Compound shape "${block.name}" has unsupported type "${block.values.shape ?? ''}".`);
      return [];
    }
    const item: CollisionCompoundShape = {
      name: block.name,
      shape,
      posX: numberValue(block.values.posX, 0),
      posY: numberValue(block.values.posY, 0),
      angle: numberValue(block.values.angle, 0),
      friction: optionalNumber(block.values, 'friction'),
      density: optionalNumber(block.values, 'density'),
      restitution: optionalNumber(block.values, 'restitution'),
    };
    if (shape === 'box') {
      item.sizeX = numberValue(block.values.sizeX, 0);
      item.sizeY = numberValue(block.values.sizeY, 0);
      if (item.sizeX <= 0 || item.sizeY <= 0) warnings.push(`Compound box "${block.name}" has invalid size.`);
    } else {
      item.radius = numberValue(block.values.radius, 0);
      if (item.radius <= 0) warnings.push(`Compound circle "${block.name}" has invalid radius.`);
    }
    return [item];
  });
}

function parseJoints(value: unknown): CollisionJoint[] {
  return parseCollisionEnml(value)
    .filter(block => block.name.startsWith('revoluteJoint'))
    .map(block => ({
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
    }));
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
  if (shape !== 0 && !collision) warnings.push('Collision data is missing.');
  if (shape !== 0 && (sizeX === 0 || sizeY === 0)) warnings.push('Collision Size.x and Size.y must be non-zero.');
  const polygon = shape === 3 ? parsePolygon(collision?.Polygon, warnings) : [];
  const compound = shape === 4 ? parseCompound(collision?.Compound, warnings) : [];
  if (shape === 4 && compound.length === 0) warnings.push('Compound collision has no valid child shapes.');

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
      position: { x: numberValue(position?.x, 0), y: numberValue(position?.y, 0) },
      size: { x: sizeX, y: sizeY },
      polygon,
      compound,
      joints: parseJoints(collision?.Joints),
    },
    warnings,
  };
}

export function collisionShapeName(shape: CollisionShape): string {
  return SHAPE_NAMES[shape] ?? 'Unknown';
}
