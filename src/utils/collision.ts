import type {
  CollisionCompoundShape,
  CollisionDiagnostic,
  CollisionJoint,
  CollisionPolygonVertex,
  CollisionShape,
  EntityPhysicsConfig,
} from "../types";

export type { CollisionDiagnostic };

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

export function parsePolygon(
  value: unknown,
  warnings: string[] = [],
  diagnostics: CollisionDiagnostic[] = [],
): { vertices: CollisionPolygonVertex[]; diagnostics: CollisionDiagnostic[] } {
  const blocks = parseCollisionEnml(value);
  const vertices: CollisionPolygonVertex[] = [];

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (!/^v\d+$/.test(block.name)) {
      warnings.push(
        `Polygon vertex name "${block.name}" is invalid; expected v${index}.`,
      );
      diagnostics.push({
        scope: "polygon",
        target: `Polygon ${block.name}`,
        code: "UNEXPECTED_BLOCK",
        message: `unexpected block "${block.name}" in Polygon`,
      });
      continue;
    }
    const rawX = block.values.x;
    const rawY = block.values.y;
    const x = Number(rawX);
    const y = Number(rawY);
    if (
      rawX === undefined ||
      rawY === undefined ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      warnings.push(`Polygon vertex ${block.name} has invalid coordinates.`);
      diagnostics.push({
        scope: "polygon",
        target: `Polygon ${block.name}`,
        code: "INVALID_COORDINATES",
        message: "coordinates are invalid",
      });
      continue;
    }
    vertices.push({ name: block.name, x, y });
  }

  const validation = validatePolygon(vertices);
  for (const diag of validation.diagnostics) {
    if (
      !diagnostics.some((d) => d.target === diag.target && d.code === diag.code)
    ) {
      diagnostics.push(diag);
    }
  }
  for (const err of validation.errors) {
    if (!warnings.includes(err)) {
      warnings.push(err);
    }
  }

  return { vertices, diagnostics };
}

function optionalNumber(
  values: Record<string, string>,
  key: string,
): number | undefined {
  if (values[key] === undefined) return undefined;
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inNormalizedRange(value: number) {
  return value >= -1 && value <= 1;
}

export const MIN_POLYGON_VERTICES = 3;
export const MAX_POLYGON_VERTICES = 8;

export interface PolygonValidationResult {
  valid: boolean;
  errors: string[];
  diagnostics: CollisionDiagnostic[];
  isConvex: boolean;
  isClockwise: boolean;
}

export function validatePolygon(
  vertices: CollisionPolygonVertex[],
  unparsedDiagnostics: CollisionDiagnostic[] = [],
): PolygonValidationResult {
  const errors: string[] = [];
  const diagnostics: CollisionDiagnostic[] = [...unparsedDiagnostics];
  const addError = (msg: string, diag?: CollisionDiagnostic) => {
    if (!errors.includes(msg)) errors.push(msg);
    if (
      diag &&
      !diagnostics.some((d) => d.target === diag.target && d.code === diag.code)
    ) {
      diagnostics.push(diag);
    }
  };
  const epsilon = 1e-8;
  let isConvex = true;
  let isClockwise = true;

  if (
    vertices.length < MIN_POLYGON_VERTICES ||
    vertices.length > MAX_POLYGON_VERTICES
  ) {
    addError(
      `Polygon must contain ${MIN_POLYGON_VERTICES} to ${MAX_POLYGON_VERTICES} sequential vertices.`,
      {
        scope: "polygon",
        target: "Polygon",
        code: "POLYGON_VERTEX_COUNT",
        message: `must contain ${MIN_POLYGON_VERTICES} to ${MAX_POLYGON_VERTICES} sequential vertices`,
      },
    );
  }

  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index];
    if (vertex.name !== `v${index}`) {
      addError(
        `Polygon vertices must be sequential; expected v${index} but found ${vertex.name}.`,
        {
          scope: "polygon",
          target: `Polygon ${vertex.name}`,
          code: "POLYGON_VERTEX_ORDER",
          message: `expected v${index} but found ${vertex.name}`,
        },
      );
    }
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
      addError(`Polygon vertex ${vertex.name} has invalid coordinates.`, {
        scope: "polygon",
        target: `Polygon ${vertex.name}`,
        code: "POLYGON_VERTEX_COORDINATES",
        message: "coordinates are invalid",
      });
    } else if (!inNormalizedRange(vertex.x) || !inNormalizedRange(vertex.y)) {
      addError(`Polygon vertex ${vertex.name} must be within [-1, 1].`, {
        scope: "polygon",
        target: `Polygon ${vertex.name}`,
        code: "POLYGON_VERTEX_RANGE",
        message: "coordinates are outside [-1, 1]",
      });
    }
  }

  const seen = new Set<string>();
  for (const vertex of vertices) {
    const key = `${vertex.x.toFixed(6)}:${vertex.y.toFixed(6)}`;
    if (seen.has(key)) {
      addError(`Polygon vertex ${vertex.name} duplicates another vertex.`, {
        scope: "polygon",
        target: `Polygon ${vertex.name}`,
        code: "POLYGON_VERTEX_DUPLICATE",
        message: "duplicates another vertex",
      });
    }
    seen.add(key);
  }

  if (vertices.length >= 3) {
    // 1. Overall winding order using Shoelace formula (signed area)
    let signedArea = 0;
    for (let index = 0; index < vertices.length; index++) {
      const cur = vertices[index];
      const next = vertices[(index + 1) % vertices.length];
      signedArea += cur.x * next.y - next.x * cur.y;
    }
    if (signedArea < 0) {
      addError("Polygon vertices must use clockwise screen-space winding.", {
        scope: "polygon",
        target: "Polygon",
        code: "POLYGON_WINDING",
        message: "vertices must use clockwise screen-space winding.",
      });
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
        addError(
          "Polygon must not contain three consecutive collinear vertices.",
          {
            scope: "polygon",
            target: "Polygon",
            code: "POLYGON_COLLINEAR",
            message: "must not contain three consecutive collinear vertices",
          },
        );
        isConvex = false;
        continue;
      }
      const sign = Math.sign(cross);
      if (windingSign === 0) {
        windingSign = sign;
      } else if (windingSign !== sign) {
        addError("Polygon must be convex.", {
          scope: "polygon",
          target: "Polygon",
          code: "POLYGON_NOT_CONVEX",
          message: "must be convex",
        });
        isConvex = false;
      }
    }
  } else {
    isConvex = false;
    isClockwise = false;
  }

  return {
    valid: diagnostics.length === 0,
    errors,
    diagnostics,
    isConvex,
    isClockwise,
  };
}

export interface CompoundValidationResult {
  valid: boolean;
  errors: string[];
  diagnostics: CollisionDiagnostic[];
}

export function validateCompound(
  compound: CollisionCompoundShape[],
  unparsedDiagnostics: CollisionDiagnostic[] = [],
): CompoundValidationResult {
  const errors: string[] = [];
  const diagnostics: CollisionDiagnostic[] = [...unparsedDiagnostics];
  const addError = (msg: string, diag?: CollisionDiagnostic) => {
    if (!errors.includes(msg)) errors.push(msg);
    if (
      diag &&
      !diagnostics.some((d) => d.target === diag.target && d.code === diag.code)
    ) {
      diagnostics.push(diag);
    }
  };

  if (compound.length === 0) {
    addError("Compound collision has no child shapes.", {
      scope: "compound",
      target: "Compound",
      code: "COMPOUND_EMPTY",
      message: "must contain at least 1 child shape",
    });
  } else if (compound.length > MAX_COMPOUND_SUB_SHAPES) {
    addError(
      `Compound must contain at most ${MAX_COMPOUND_SUB_SHAPES} child shapes.`,
      {
        scope: "compound",
        target: "Compound",
        code: "COMPOUND_MAX_COUNT",
        message: `maximum ${MAX_COMPOUND_SUB_SHAPES} child shapes allowed`,
      },
    );
  }

  for (const item of compound) {
    const target = `Compound ${item.name}`;
    if (!Number.isFinite(item.posX) || !Number.isFinite(item.posY)) {
      addError(`Compound shape "${item.name}" has invalid position.`, {
        scope: "compound",
        target,
        code: "INVALID_POSITION",
        message: "position coordinates must be finite",
      });
    } else if (!inNormalizedRange(item.posX) || !inNormalizedRange(item.posY)) {
      addError(
        `Compound shape "${item.name}" position must be within [-1, 1].`,
        {
          scope: "compound",
          target,
          code: "OUT_OF_BOUNDS",
          message: "position must be within [-1, 1]",
        },
      );
    }

    if (item.shape === "box") {
      if (
        item.sizeX === undefined ||
        item.sizeY === undefined ||
        !Number.isFinite(item.sizeX) ||
        !Number.isFinite(item.sizeY) ||
        item.sizeX <= 0 ||
        item.sizeY <= 0
      ) {
        addError(`Compound box "${item.name}" has invalid size.`, {
          scope: "compound",
          target,
          code: "INVALID_SIZE",
          message: "size must be positive and finite",
        });
      }
    } else if (item.shape === "circle") {
      if (
        item.radius === undefined ||
        !Number.isFinite(item.radius) ||
        item.radius <= 0
      ) {
        addError(`Compound circle "${item.name}" has invalid radius.`, {
          scope: "compound",
          target,
          code: "INVALID_RADIUS",
          message: "radius must be positive and finite",
        });
      }
    }

    if (item.angle !== undefined && !Number.isFinite(item.angle)) {
      addError(`Compound shape "${item.name}" has invalid angle.`, {
        scope: "compound",
        target,
        code: "INVALID_ANGLE",
        message: "angle must be finite",
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    errors,
    diagnostics,
  };
}

export function sortCollisionDiagnostics(
  diagnostics: CollisionDiagnostic[],
): CollisionDiagnostic[] {
  const seen = new Set<string>();
  const unique: CollisionDiagnostic[] = [];
  for (const d of diagnostics) {
    const key = `${d.target}:::${d.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(d);
    }
  }

  const getPriority = (d: CollisionDiagnostic) => {
    if (d.target === "Collision.Position") return 1;
    if (d.target === "Collision.Size") return 2;
    if (d.target === "Polygon" || d.target === "Collision.Polygon") return 3;
    if (d.target.startsWith("Polygon v")) {
      const num = parseInt(d.target.replace("Polygon v", ""), 10);
      return 100 + (isNaN(num) ? 0 : num);
    }
    if (d.target === "Compound" || d.target === "Collision.Compound")
      return 200;
    if (d.target.startsWith("Compound ")) return 300;
    return 400;
  };

  return unique.sort((a, b) => {
    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return (
      a.target.localeCompare(b.target) || a.message.localeCompare(b.message)
    );
  });
}

export type CollisionEditType =
  | { type: "position" }
  | { type: "size" }
  | { type: "polygon" }
  | { type: "compound" }
  | { type: "shape"; newShape: CollisionShape };

export function filterDiagnosticsForEdit(
  diagnostics: CollisionDiagnostic[] | undefined,
  edit: CollisionEditType,
): CollisionDiagnostic[] {
  if (!diagnostics || diagnostics.length === 0) return [];
  switch (edit.type) {
    case "position":
      return diagnostics.filter(
        (d) => !(d.scope === "collision" && d.target === "Collision.Position"),
      );
    case "size":
      return diagnostics.filter(
        (d) => !(d.scope === "collision" && d.target === "Collision.Size"),
      );
    case "polygon":
      return diagnostics.filter((d) => d.scope !== "polygon");
    case "compound":
      return diagnostics.filter((d) => d.scope !== "compound");
    case "shape": {
      const { newShape } = edit;
      if (newShape === 0) return [];
      return diagnostics.filter((d) => {
        if (d.code === "UNSUPPORTED_SHAPE_VALUE") return false;
        if (
          (newShape === 1 || newShape === 2) &&
          (d.scope === "polygon" || d.scope === "compound")
        )
          return false;
        if (newShape === 3 && d.scope === "compound") return false;
        if (newShape === 4 && d.scope === "polygon") return false;
        return true;
      });
    }
  }
}

export function filterWarningsForEdit(
  warnings: string[] | undefined,
  edit: CollisionEditType,
): string[] {
  if (!warnings || warnings.length === 0) return [];
  switch (edit.type) {
    case "position":
      return warnings.filter((w) => !w.startsWith("Collision.Position"));
    case "size":
      return warnings.filter((w) => !w.startsWith("Collision.Size"));
    case "polygon":
      return warnings.filter((w) => !w.startsWith("Polygon"));
    case "compound":
      return warnings.filter((w) => !w.startsWith("Compound"));
    case "shape": {
      const { newShape } = edit;
      if (newShape === 0) {
        return warnings.filter(
          (w) =>
            !w.startsWith("Collision") &&
            !w.startsWith("Polygon") &&
            !w.startsWith("Compound") &&
            !w.startsWith("Unsupported collision shape"),
        );
      }
      return warnings.filter((w) => {
        if (w.startsWith("Unsupported collision shape")) return false;
        if (
          (newShape === 1 || newShape === 2) &&
          (w.startsWith("Polygon") || w.startsWith("Compound"))
        )
          return false;
        if (newShape === 3 && w.startsWith("Compound")) return false;
        if (newShape === 4 && w.startsWith("Polygon")) return false;
        return true;
      });
    }
  }
}

export function getCollisionDiagnostics(
  physics: Pick<EntityPhysicsConfig, "shape" | "collision"> & {
    diagnostics?: CollisionDiagnostic[];
  },
): CollisionDiagnostic[] {
  if (physics.shape === 0) {
    if (!physics.diagnostics || physics.diagnostics.length === 0) {
      return [];
    }
    return sortCollisionDiagnostics(physics.diagnostics);
  }
  const diagnostics: CollisionDiagnostic[] = [];
  const { collision } = physics;

  // 1. Position check
  if (
    !Number.isFinite(collision.position.x) ||
    !Number.isFinite(collision.position.y) ||
    !Number.isFinite(collision.position.z)
  ) {
    diagnostics.push({
      scope: "collision",
      target: "Collision.Position",
      code: "INVALID_POSITION",
      message: "coordinates must be finite (fallback box cannot be rendered)",
    });
  }

  // 2. Size check
  if (
    !Number.isFinite(collision.size.x) ||
    !Number.isFinite(collision.size.y) ||
    !Number.isFinite(collision.size.z) ||
    collision.size.x <= 0 ||
    collision.size.y <= 0 ||
    collision.size.z <= 0
  ) {
    diagnostics.push({
      scope: "collision",
      target: "Collision.Size",
      code: "INVALID_SIZE",
      message:
        "dimensions must be positive and finite (fallback box cannot be rendered)",
    });
  }

  // 3. Shape-specific check
  if (physics.shape === 3) {
    const polyValidation = validatePolygon(collision.polygon);
    diagnostics.push(...polyValidation.diagnostics);
  } else if (physics.shape === 4) {
    const compValidation = validateCompound(collision.compound);
    diagnostics.push(...compValidation.diagnostics);
  }

  // 4. Carry over any unparsed or tag missing diagnostics that were stored on physics
  const isPositionValid =
    Number.isFinite(collision.position.x) &&
    Number.isFinite(collision.position.y) &&
    Number.isFinite(collision.position.z);
  const isSizeValid =
    Number.isFinite(collision.size.x) &&
    Number.isFinite(collision.size.y) &&
    Number.isFinite(collision.size.z) &&
    collision.size.x > 0 &&
    collision.size.y > 0 &&
    collision.size.z > 0;

  if (physics.diagnostics) {
    for (const d of physics.diagnostics) {
      if (isPositionValid && d.target === "Collision.Position") continue;
      if (isSizeValid && d.target === "Collision.Size") continue;
      if (
        (physics.shape === 1 || physics.shape === 2) &&
        (d.scope === "polygon" || d.scope === "compound")
      )
        continue;
      if (physics.shape === 3 && d.scope === "compound") continue;
      if (physics.shape === 4 && d.scope === "polygon") continue;

      if (
        !diagnostics.some(
          (existing) =>
            existing.target === d.target && existing.code === d.code,
        )
      ) {
        diagnostics.push(d);
      }
    }
  }

  return sortCollisionDiagnostics(diagnostics);
}

export function isCollisionGeometryValid(
  physics: Pick<EntityPhysicsConfig, "shape" | "collision"> & {
    diagnostics?: CollisionDiagnostic[];
  },
): boolean {
  if (physics.shape === 0) {
    return !physics.diagnostics || physics.diagnostics.length === 0;
  }
  const { collision } = physics;
  const isPositionValid =
    Number.isFinite(collision.position.x) &&
    Number.isFinite(collision.position.y) &&
    Number.isFinite(collision.position.z);
  if (!isPositionValid) return false;

  const isSizeValid =
    Number.isFinite(collision.size.x) &&
    Number.isFinite(collision.size.y) &&
    Number.isFinite(collision.size.z) &&
    collision.size.x > 0 &&
    collision.size.y > 0 &&
    collision.size.z > 0;
  if (!isSizeValid) return false;

  if (physics.diagnostics && physics.diagnostics.length > 0) {
    const relevantDiagnostics = physics.diagnostics.filter((d) => {
      if (isPositionValid && d.target === "Collision.Position") return false;
      if (isSizeValid && d.target === "Collision.Size") return false;
      if (
        (physics.shape === 1 || physics.shape === 2) &&
        (d.scope === "polygon" || d.scope === "compound")
      )
        return false;
      if (physics.shape === 3 && d.scope === "compound") return false;
      if (physics.shape === 4 && d.scope === "polygon") return false;
      return true;
    });
    if (relevantDiagnostics.length > 0) return false;
  }

  if (physics.shape === 1 || physics.shape === 2) {
    return true;
  }
  if (physics.shape === 3) {
    return validatePolygon(collision.polygon).valid;
  }
  if (physics.shape === 4) {
    return validateCompound(collision.compound).valid;
  }
  return true;
}

export function parseCompound(
  value: unknown,
  warnings: string[] = [],
  diagnostics: CollisionDiagnostic[] = [],
): { compound: CollisionCompoundShape[]; diagnostics: CollisionDiagnostic[] } {
  const compound: CollisionCompoundShape[] = [];
  const blocks = parseCollisionEnml(value);

  for (const block of blocks) {
    const rawShape = block.values.shape?.toLowerCase();
    if (rawShape !== "box" && rawShape !== "circle") {
      warnings.push(
        `Compound shape "${block.name}" has unsupported type "${block.values.shape ?? ""}".`,
      );
      diagnostics.push({
        scope: "compound",
        target: `Compound ${block.name}`,
        code: "UNSUPPORTED_SHAPE_TYPE",
        message: `has unsupported type "${block.values.shape ?? ""}"`,
      });
      continue;
    }

    const label = `Compound shape "${block.name}"`;
    const rawPosX = block.values.posX;
    const rawPosY = block.values.posY;
    const posX = Number(rawPosX);
    const posY = Number(rawPosY);

    if (
      rawPosX === undefined ||
      rawPosY === undefined ||
      !Number.isFinite(posX) ||
      !Number.isFinite(posY)
    ) {
      warnings.push(`${label} has invalid position.`);
      diagnostics.push({
        scope: "compound",
        target: `Compound ${block.name}`,
        code: "INVALID_POSITION",
        message: "position coordinates must be finite",
      });
      continue;
    }

    const item: CollisionCompoundShape = {
      name: block.name,
      shape: rawShape,
      posX,
      posY,
      angle: numberValue(block.values.angle, 0),
      friction: optionalNumber(block.values, "friction"),
      density: optionalNumber(block.values, "density"),
      restitution: optionalNumber(block.values, "restitution"),
    };

    if (rawShape === "box") {
      const rawSizeX = block.values.sizeX;
      const rawSizeY = block.values.sizeY;
      const sizeX = Number(rawSizeX);
      const sizeY = Number(rawSizeY);
      if (
        rawSizeX === undefined ||
        rawSizeY === undefined ||
        !Number.isFinite(sizeX) ||
        !Number.isFinite(sizeY)
      ) {
        warnings.push(`Compound box "${block.name}" has invalid size.`);
        diagnostics.push({
          scope: "compound",
          target: `Compound ${block.name}`,
          code: "INVALID_SIZE",
          message: "has invalid size",
        });
        continue;
      }
      item.sizeX = sizeX;
      item.sizeY = sizeY;
    } else {
      const rawRadius = block.values.radius;
      const radius = Number(rawRadius);
      if (rawRadius === undefined || !Number.isFinite(radius)) {
        warnings.push(`Compound circle "${block.name}" has invalid radius.`);
        diagnostics.push({
          scope: "compound",
          target: `Compound ${block.name}`,
          code: "INVALID_RADIUS",
          message: "has invalid radius",
        });
        continue;
      }
      item.radius = radius;
    }

    compound.push(item);
  }

  const validation = validateCompound(compound);
  for (const diag of validation.diagnostics) {
    if (
      !diagnostics.some((d) => d.target === diag.target && d.code === diag.code)
    ) {
      diagnostics.push(diag);
    }
  }
  for (const err of validation.errors) {
    if (!warnings.includes(err)) {
      warnings.push(err);
    }
  }

  return { compound, diagnostics };
}

export function parseCompoundShapes(value: unknown): CollisionCompoundShape[] {
  const blocks = parseCollisionEnml(value);
  const items: CollisionCompoundShape[] = [];
  for (const block of blocks) {
    const rawShape = block.values.shape?.toLowerCase();
    if (rawShape !== "box" && rawShape !== "circle") continue;
    const posX = Number(block.values.posX);
    const posY = Number(block.values.posY);
    if (!Number.isFinite(posX) || !Number.isFinite(posY)) continue;
    const item: CollisionCompoundShape = {
      name: block.name,
      shape: rawShape,
      posX,
      posY,
      angle: numberValue(block.values.angle, 0),
      friction: optionalNumber(block.values, "friction"),
      density: optionalNumber(block.values, "density"),
      restitution: optionalNumber(block.values, "restitution"),
    };
    if (rawShape === "box") {
      const sizeX = Number(block.values.sizeX);
      const sizeY = Number(block.values.sizeY);
      if (!Number.isFinite(sizeX) || !Number.isFinite(sizeY)) continue;
      item.sizeX = sizeX;
      item.sizeY = sizeY;
    } else {
      const radius = Number(block.values.radius);
      if (!Number.isFinite(radius)) continue;
      item.radius = radius;
    }
    items.push(item);
  }
  return items;
}

export function compoundsEqual(
  a: CollisionCompoundShape[],
  b: CollisionCompoundShape[],
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (
      ai.name !== bi.name ||
      ai.shape !== bi.shape ||
      Math.abs(ai.posX - bi.posX) > 1e-6 ||
      Math.abs(ai.posY - bi.posY) > 1e-6 ||
      Math.abs((ai.sizeX ?? 0) - (bi.sizeX ?? 0)) > 1e-6 ||
      Math.abs((ai.sizeY ?? 0) - (bi.sizeY ?? 0)) > 1e-6 ||
      Math.abs((ai.radius ?? 0) - (bi.radius ?? 0)) > 1e-6 ||
      Math.abs((ai.angle ?? 0) - (bi.angle ?? 0)) > 1e-6 ||
      ai.friction !== bi.friction ||
      ai.density !== bi.density ||
      ai.restitution !== bi.restitution
    ) {
      return false;
    }
  }
  return true;
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

export function serializePolygonEnml(
  vertices: CollisionPolygonVertex[],
): string {
  if (!vertices || vertices.length === 0) return "";
  const formatVal = (n: number) => Number(Number(n).toFixed(4)).toString();
  return vertices
    .map(
      (v, i) =>
        `${v.name || `v${i}`} {\n\tx = ${formatVal(v.x)};\n\ty = ${formatVal(v.y)};\n}`,
    )
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

export function serializeCompoundEnml(
  compound: CollisionCompoundShape[],
): string {
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
  const diagnostics: CollisionDiagnostic[] = [];
  const rawShape = raw.shape === undefined ? 0 : Number(raw.shape);
  const validShape =
    Number.isInteger(rawShape) && rawShape >= 0 && rawShape <= 4;
  const shape = (validShape ? rawShape : 0) as CollisionShape;
  if (!validShape) {
    warnings.push(`Unsupported collision shape value "${String(raw.shape)}".`);
    diagnostics.push({
      scope: "collision",
      target: "Collision",
      code: "UNSUPPORTED_SHAPE_VALUE",
      message: `Unsupported collision shape value "${String(raw.shape)}".`,
    });
  }

  const collision = asMap(raw.Collision);
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
      diagnostics.push({
        scope: "collision",
        target: "Collision",
        code: "TAG_MISSING",
        message: "Collision tag missing",
      });
    } else {
      if (collision.Position === undefined) {
        warnings.push("Collision.Position tag missing");
        diagnostics.push({
          scope: "collision",
          target: "Collision.Position",
          code: "TAG_MISSING",
          message: "Collision.Position tag missing",
        });
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
          diagnostics.push({
            scope: "collision",
            target: "Collision.Position",
            code: "INVALID_POSITION",
            message:
              "coordinates must be finite (fallback box cannot be rendered)",
          });
        }
        if (position) {
          posX = numberValue(position.x, 0);
          posY = numberValue(position.y, 0);
          posZ = numberValue(position.z, 0);
        }
      }

      if (collision.Size === undefined) {
        warnings.push("Collision.Size tag missing");
        diagnostics.push({
          scope: "collision",
          target: "Collision.Size",
          code: "TAG_MISSING",
          message: "Collision.Size tag missing",
        });
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
          diagnostics.push({
            scope: "collision",
            target: "Collision.Size",
            code: "INVALID_SIZE",
            message:
              "dimensions must be positive and finite (fallback box cannot be rendered)",
          });
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
          diagnostics.push({
            scope: "polygon",
            target: "Polygon",
            code: "TAG_MISSING",
            message: "Polygon tag missing",
          });
        } else {
          const res = parsePolygon(collision.Polygon, warnings, diagnostics);
          polygon = res.vertices;
        }
      }

      if (shape === 4) {
        if (collision.Compound === undefined) {
          warnings.push("Collision.Compound tag missing");
          diagnostics.push({
            scope: "compound",
            target: "Compound",
            code: "TAG_MISSING",
            message: "Compound tag missing",
          });
        } else {
          const res = parseCompound(collision.Compound, warnings, diagnostics);
          compound = res.compound;
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

  const geometryValid = !validShape
    ? false
    : shape === 0
      ? true
      : diagnostics.length === 0;

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
    diagnostics,
  };
}

export function collisionShapeName(shape: CollisionShape): string {
  return SHAPE_NAMES[shape] ?? "Unknown";
}
