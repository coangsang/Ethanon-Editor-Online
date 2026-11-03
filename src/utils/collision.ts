import type {
  CollisionCompoundShape,
  CollisionJoint,
  CollisionPolygonVertex,
  CollisionShape,
  EntityPhysicsConfig,
} from "../types";

type RawMap = Record<string, unknown>;

type EnmlBlock = {
  name: string;
  values: Record<string, string>;
};

export const MAX_COMPOUND_SUB_SHAPES = 8;

const SHAPE_NAMES = ["None", "Box", "Circle", "Polygon", "Compound"] as const;

function asMap(value: unknown): RawMap | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawMap)
    : null;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  const map = asMap(value);
  return map && typeof map["#text"] === "string" ? map["#text"] : "";
}

/** Parses Ethanon's flat ENML blocks. Collision ENML has no nested blocks. */
export function parseCollisionEnml(value: unknown): EnmlBlock[] {
  const source = textValue(value)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const blocks: EnmlBlock[] = [];
  const blockPattern = /([A-Za-z_][\w.-]*)\s*\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(source))) {
    const values: Record<string, string> = {};
    const propertyPattern =
      /([A-Za-z_][\w.-]*)\s*=\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^;\r\n}]+)\s*;?/g;
    let property: RegExpExecArray | null;
    while ((property = propertyPattern.exec(match[2]))) {
      const raw = property[2].trim();
      values[property[1]] =
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
          ? raw.slice(1, -1)
          : raw;
    }
    blocks.push({ name: match[1], values });
  }
  return blocks;
}

function parsePolygon(
  value: unknown,
  warnings: string[],
): CollisionPolygonVertex[] {
  const blocks = parseCollisionEnml(value);
  const vertices: CollisionPolygonVertex[] = [];
  let valid = true;
  const vertexBlocks = blocks.filter((block) => /^v\d+$/.test(block.name));
  for (let index = 0; index < vertexBlocks.length; index++) {
    const block = vertexBlocks[index];
    if (block.name !== `v${index}`) {
      warnings.push(
        `Polygon vertices must be sequential; expected v${index} but found ${block.name}.`,
      );
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
    warnings.push("Polygon must contain 3 to 8 sequential vertices.");
    valid = false;
  }
  if (vertices.length >= 3 && !validatePolygonGeometry(vertices, warnings))
    valid = false;
  return valid ? vertices : [];
}

function optionalNumber(
  values: Record<string, string>,
  key: string,
): number | undefined {
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
  if (raw === undefined || raw.trim() === "" || !Number.isFinite(parsed)) {
    warnings.push(`${label} has invalid ${key}.`);
    return null;
  }
  return parsed;
}

function inNormalizedRange(value: number) {
  return value >= -1 && value <= 1;
}

export const MIN_POLYGON_VERTICES = 3;
export const MAX_POLYGON_VERTICES = 8;

export interface PolygonValidationResult {
  valid: boolean;
  errors: string[];
  isConvex: boolean;
  isClockwise: boolean;
}

export function validatePolygon(
  vertices: CollisionPolygonVertex[],
): PolygonValidationResult {
  const errors: string[] = [];
  const addError = (msg: string) => {
    if (!errors.includes(msg)) errors.push(msg);
  };
  const epsilon = 1e-8;
  let isConvex = true;
  let isClockwise = true;

  if (vertices.length < MIN_POLYGON_VERTICES || vertices.length > MAX_POLYGON_VERTICES) {
    addError(`Polygon must contain ${MIN_POLYGON_VERTICES} to ${MAX_POLYGON_VERTICES} sequential vertices.`);
  }

  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index];
    if (vertex.name !== `v${index}`) {
      addError(`Polygon vertices must be sequential; expected v${index} but found ${vertex.name}.`);
    }
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
      addError(`Polygon vertex ${vertex.name} has invalid coordinates.`);
    } else if (!inNormalizedRange(vertex.x) || !inNormalizedRange(vertex.y)) {
      addError(`Polygon vertex ${vertex.name} must be within [-1, 1].`);
    }
  }

  const seen = new Set<string>();
  for (const vertex of vertices) {
    const key = `${vertex.x.toFixed(6)}:${vertex.y.toFixed(6)}`;
    if (seen.has(key)) {
      addError(`Polygon vertex ${vertex.name} duplicates another vertex.`);
    }
    seen.add(key);
  }

  if (vertices.length >= 3) {
    // 1. Overall winding order using Shoelace formula (signed area)
    // In screen coordinates (Y grows down):
    // Shoelace area = 0.5 * sum(x_i * y_{i+1} - x_{i+1} * y_i)
    // Positive area indicates clockwise winding.
    let signedArea = 0;
    for (let index = 0; index < vertices.length; index++) {
      const cur = vertices[index];
      const next = vertices[(index + 1) % vertices.length];
      signedArea += cur.x * next.y - next.x * cur.y;
    }
    if (signedArea < 0) {
      addError("Polygon vertices must use clockwise screen-space winding.");
      isClockwise = false;
    }

    // 2. Convexity check: verify all cross products match the expected winding sign
    let windingSign = 0;
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index];
      const b = vertices[(index + 1) % vertices.length];
      const c = vertices[(index + 2) % vertices.length];
      const abX = b.x - a.x;
      const abY = b.y - a.y;
      const bcX = c.x - b.x;
      const bcY = c.y - b.y;

      if (
        (Math.abs(abX) <= epsilon && Math.abs(abY) <= epsilon) ||
        (Math.abs(bcX) <= epsilon && Math.abs(bcY) <= epsilon)
      ) {
        continue;
      }
      const cross = abX * bcY - abY * bcX;
      if (Math.abs(cross) <= epsilon) {
        addError("Polygon must not contain three consecutive collinear vertices.");
        isConvex = false;
        continue;
      }
      const sign = Math.sign(cross);
      if (windingSign === 0) {
        windingSign = sign;
      } else if (windingSign !== sign) {
        addError("Polygon must be convex.");
        isConvex = false;
      }
    }
  } else {
    isConvex = false;
    isClockwise = false;
  }

  return {
    valid: errors.length === 0,
    errors,
    isConvex,
    isClockwise,
  };
}

function validatePolygonGeometry(
  vertices: CollisionPolygonVertex[],
  warnings: string[],
): boolean {
  const result = validatePolygon(vertices);
  for (const err of result.errors) {
    if (!warnings.includes(err)) {
      warnings.push(err);
    }
  }
  return result.valid;
}

function parseCompound(
  value: unknown,
  warnings: string[],
): CollisionCompoundShape[] {
  return parseCollisionEnml(value).flatMap((block) => {
    const shape = block.values.shape?.toLowerCase();
    if (shape !== "box" && shape !== "circle") {
      warnings.push(
        `Compound shape "${block.name}" has unsupported type "${block.values.shape ?? ""}".`,
      );
      return [];
    }
    const label = `Compound shape "${block.name}"`;
    const posX = requiredNumber(block.values, "posX", label, warnings);
    const posY = requiredNumber(block.values, "posY", label, warnings);
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
      friction: optionalNumber(block.values, "friction"),
      density: optionalNumber(block.values, "density"),
      restitution: optionalNumber(block.values, "restitution"),
    };
    if (shape === "box") {
      const sizeX = requiredNumber(block.values, "sizeX", label, warnings);
      const sizeY = requiredNumber(block.values, "sizeY", label, warnings);
      if (sizeX === null || sizeY === null || sizeX <= 0 || sizeY <= 0) {
        if (sizeX !== null && sizeY !== null)
          warnings.push(`Compound box "${block.name}" has invalid size.`);
        return [];
      }
      item.sizeX = sizeX;
      item.sizeY = sizeY;
    } else {
      const radius = requiredNumber(block.values, "radius", label, warnings);
      if (radius === null || radius <= 0) {
        if (radius !== null)
          warnings.push(`Compound circle "${block.name}" has invalid radius.`);
        return [];
      }
      item.radius = radius;
    }
    return [item];
  });
}

export function polygonsEqual(
  a: CollisionPolygonVertex[],
  b: CollisionPolygonVertex[],
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].name !== b[i].name ||
      Math.abs(a[i].x - b[i].x) > 1e-6 ||
      Math.abs(a[i].y - b[i].y) > 1e-6
    ) {
      return false;
    }
  }
  return true;
}

export function parsePolygonVertices(value: unknown): CollisionPolygonVertex[] {
  const blocks = parseCollisionEnml(value);
  return blocks
    .filter((b) => /^v\d+$/.test(b.name))
    .map((b) => ({
      name: b.name,
      x: Number(b.values.x),
      y: Number(b.values.y),
    }))
    .filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y));
}

export function serializePolygonEnml(vertices: CollisionPolygonVertex[]): string {
  if (!vertices || vertices.length === 0) return "";
  const formatVal = (n: number) => Number(Number(n).toFixed(4)).toString();
  return vertices
    .map((v, i) => `${v.name || `v${i}`} {\n\tx = ${formatVal(v.x)};\n\ty = ${formatVal(v.y)};\n}`)
    .join("\n");
}

export function createDefaultPolygonVertices(): CollisionPolygonVertex[] {
  return [
    { name: "v0", x: 0, y: -1 },
    { name: "v1", x: 1, y: 1 },
    { name: "v2", x: -1, y: 1 },
  ];
}

export interface PolygonPreset {
  name: string;
  vertices: CollisionPolygonVertex[];
}

export const POLYGON_PRESETS: PolygonPreset[] = [
  {
    name: "Triangle",
    vertices: [
      { name: "v0", x: 0, y: -1 },
      { name: "v1", x: 1, y: 1 },
      { name: "v2", x: -1, y: 1 },
    ],
  },
  {
    name: "Diamond",
    vertices: [
      { name: "v0", x: 0, y: -1 },
      { name: "v1", x: 1, y: 0 },
      { name: "v2", x: 0, y: 1 },
      { name: "v3", x: -1, y: 0 },
    ],
  },
  {
    name: "Pentagon",
    vertices: [
      { name: "v0", x: 0, y: -1 },
      { name: "v1", x: 0.95, y: -0.31 },
      { name: "v2", x: 0.59, y: 0.81 },
      { name: "v3", x: -0.59, y: 0.81 },
      { name: "v4", x: -0.95, y: -0.31 },
    ],
  },
  {
    name: "Hexagon",
    vertices: [
      { name: "v0", x: 0, y: -1 },
      { name: "v1", x: 0.87, y: -0.5 },
      { name: "v2", x: 0.87, y: 0.5 },
      { name: "v3", x: 0, y: 1 },
      { name: "v4", x: -0.87, y: 0.5 },
      { name: "v5", x: -0.87, y: -0.5 },
    ],
  },
];

export function serializeCompoundEnml(compound: CollisionCompoundShape[]): string {
  if (!compound || compound.length === 0) return "";
  const formatVal = (n: number) => Number(Number(n).toFixed(4)).toString();
  return compound
    .map((item) => {
      const lines: string[] = [
        `\tshape = ${item.shape};`,
        `\tposX = ${formatVal(item.posX)};`,
        `\tposY = ${formatVal(item.posY)};`,
      ];
      if (item.shape === "box") {
        lines.push(`\tsizeX = ${formatVal(item.sizeX ?? 1)};`);
        lines.push(`\tsizeY = ${formatVal(item.sizeY ?? 1)};`);
      } else {
        lines.push(`\tradius = ${formatVal(item.radius ?? 0.5)};`);
      }
      lines.push(`\tangle = ${formatVal(item.angle ?? 0)};`);
      if (item.friction !== undefined && Number.isFinite(item.friction)) {
        lines.push(`\tfriction = ${formatVal(item.friction)};`);
      }
      if (item.density !== undefined && Number.isFinite(item.density)) {
        lines.push(`\tdensity = ${formatVal(item.density)};`);
      }
      if (item.restitution !== undefined && Number.isFinite(item.restitution)) {
        lines.push(`\trestitution = ${formatVal(item.restitution)};`);
      }
      return `${item.name} {\n${lines.join("\n")}\n}`;
    })
    .join("\n");
}

export function generateSubShapeName(
  existing: CollisionCompoundShape[],
): string {
  const existingNames = new Set(
    existing.map((s) => s.name.trim().toLowerCase()),
  );
  for (let i = 0; i < 100; i++) {
    const candidate = `sub_${i}`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `sub_${Date.now()}`;
}

export function createDefaultCompoundSubShape(
  existing: CollisionCompoundShape[],
  shapeType: "box" | "circle" = "box",
): CollisionCompoundShape {
  const name = generateSubShapeName(existing);
  if (shapeType === "circle") {
    return {
      name,
      shape: "circle",
      posX: 0,
      posY: 0,
      radius: 0.5,
      angle: 0,
    };
  }
  return {
    name,
    shape: "box",
    posX: 0,
    posY: 0,
    sizeX: 1,
    sizeY: 1,
    angle: 0,
  };
}

function parseJoints(value: unknown, warnings: string[]): CollisionJoint[] {
  return parseCollisionEnml(value)
    .filter((block) => block.name.startsWith("revoluteJoint"))
    .map((block) => {
      const joint = {
        name: block.name,
        otherEntityName: block.values.otherEntityName ?? "",
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
      const anchors = [
        joint.attachPointAX,
        joint.attachPointAY,
        joint.attachPointBX,
        joint.attachPointBY,
      ];
      if (anchors.some((anchor) => !inNormalizedRange(anchor))) {
        warnings.push(`Joint "${joint.name}" anchors must be within [-1, 1].`);
      }
      if (joint.enableLimit && joint.lowerAngle > joint.upperAngle) {
        warnings.push(
          `Joint "${joint.name}" lowerAngle must not exceed upperAngle.`,
        );
      }
      return joint;
    });
}

export function hasPhysicsData(raw: RawMap): boolean {
  return (
    raw.shape !== undefined ||
    raw.Collision !== undefined ||
    [
      "static",
      "sensor",
      "bullet",
      "fixedRotation",
      "friction",
      "density",
      "restitution",
      "gravityScale",
    ].some((key) => raw[key] !== undefined)
  );
}

export function parseEntityPhysics(raw: RawMap): EntityPhysicsConfig {
  const warnings: string[] = [];
  const rawShape = raw.shape === undefined ? 0 : Number(raw.shape);
  const validShape =
    Number.isInteger(rawShape) && rawShape >= 0 && rawShape <= 4;
  const shape = (validShape ? rawShape : 0) as CollisionShape;
  if (!validShape)
    warnings.push(`Unsupported collision shape value "${String(raw.shape)}".`);

  const collision = asMap(raw.Collision);
  let geometryValid = shape === 0 || collision !== null;
  let posX = 0;
  let posY = 0;
  let posZ = 0;
  let sizeX = 0;
  let sizeY = 0;
  let sizeZ = 0;
  let polygon: CollisionPolygonVertex[] = [];
  let compound: CollisionCompoundShape[] = [];
  let joints: CollisionJoint[] = [];
  if (shape !== 0) {
    if (!collision) {
      warnings.push("Collision tag missing");
      geometryValid = false;
    } else {
      if (collision.Position === undefined) {
        warnings.push("Collision.Position tag missing");
        geometryValid = false;
      } else {
        const position = asMap(collision.Position);
        const hasValidCoord = (val: unknown): boolean =>
          val !== undefined &&
          String(val).trim() !== "" &&
          Number.isFinite(Number(val));

        if (
          !position ||
          !hasValidCoord(position.x) ||
          !hasValidCoord(position.y) ||
          !hasValidCoord(position.z)
        ) {
          warnings.push("Collision.Position invalid");
          geometryValid = false;
        }
        if (position) {
          posX = numberValue(position.x, 0);
          posY = numberValue(position.y, 0);
          posZ = numberValue(position.z, 0);
        }
      }

      if (collision.Size === undefined) {
        warnings.push("Collision.Size tag missing");
        geometryValid = false;
      } else {
        const size = asMap(collision.Size);
        const hasValidDimension = (val: unknown): boolean =>
          val !== undefined &&
          String(val).trim() !== "" &&
          Number.isFinite(Number(val)) &&
          Number(val) > 0;

        if (
          !size ||
          !hasValidDimension(size.x) ||
          !hasValidDimension(size.y) ||
          !hasValidDimension(size.z)
        ) {
          warnings.push("Collision.Size invalid");
          geometryValid = false;
        }
        if (size) {
          sizeX = numberValue(size.x, 0);
          sizeY = numberValue(size.y, 0);
          sizeZ = numberValue(size.z, 0);
        }
      }

      if (shape === 3) {
        if (collision.Polygon === undefined) {
          warnings.push("Collision.Polygon tag missing");
          geometryValid = false;
        } else {
          polygon = parsePolygon(collision.Polygon, warnings);
          if (polygon.length === 0) geometryValid = false;
        }
      }

      if (shape === 4) {
        if (collision.Compound === undefined) {
          warnings.push("Collision.Compound tag missing");
          geometryValid = false;
        } else {
          compound = parseCompound(collision.Compound, warnings);
          if (compound.length === 0) {
            warnings.push("Compound collision has no valid child shapes.");
            geometryValid = false;
          }
        }
      }

      joints = parseJoints(collision.Joints, warnings);
    }
  } else if (collision) {
    const position = asMap(collision.Position);
    if (position) {
      posX = numberValue(position.x, 0);
      posY = numberValue(position.y, 0);
      posZ = numberValue(position.z, 0);
    }
    const size = asMap(collision.Size);
    if (size) {
      sizeX = numberValue(size.x, 0);
      sizeY = numberValue(size.y, 0);
      sizeZ = numberValue(size.z, 0);
    }
    joints = parseJoints(collision.Joints, warnings);
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
        x: posX,
        y: posY,
        z: posZ,
      },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      polygon,
      compound,
      joints,
    },
    warnings,
  };
}

export function collisionShapeName(shape: CollisionShape): string {
  return SHAPE_NAMES[shape] ?? "Unknown";
}
