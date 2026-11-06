import { useState, useRef, useEffect } from 'react';
import type {
  CollisionCompoundShape,
  CollisionPolygonVertex,
  CollisionShape,
  EntityTemplate,
} from '../../types';
import {
  collisionShapeName,
  compoundsEqual,
  createDefaultCompoundSubShape,
  createDefaultPolygonVertices,
  generateSubShapeName,
  getCollisionDiagnostics,
  MAX_COMPOUND_SUB_SHAPES,
  MAX_POLYGON_VERTICES,
  MIN_POLYGON_VERTICES,
  POLYGON_PRESETS,
  polygonsEqual,
  type PolygonPreset,
  sortCollisionDiagnostics,
  validateCompound,
  validatePolygon,
} from '../../utils/collision';
import { Icon } from '../../components/Icon';
import { AxisNumberInput } from './InspectorControls';
import { formatNumber, radToDeg } from './inspectorFormatters';
import { transformEventBus } from '../../store/TransformEventBus';

function SubShapeMaterialControl({
  item,
  readOnly,
  onChange,
}: {
  item: CollisionCompoundShape;
  readOnly: boolean;
  onChange: (patch: Partial<CollisionCompoundShape>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(
    item.friction !== undefined || item.density !== undefined || item.restitution !== undefined
  );

  const hasOverride =
    item.friction !== undefined || item.density !== undefined || item.restitution !== undefined;

  if (readOnly) {
    if (!hasOverride) return null;
    return (
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-[var(--inspector-border)]">
        <span title="Custom material override for this sub-shape">Material Override</span>
        <span className="font-mono text-gray-400 select-text">
          {[
            item.friction !== undefined && `F ${formatNumber(item.friction)}`,
            item.density !== undefined && `D ${formatNumber(item.density)}`,
            item.restitution !== undefined && `R ${formatNumber(item.restitution)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
    );
  }

  return (
    <div className="pt-1 border-t border-[var(--inspector-border)] flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors"
        >
          <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={10} />
          <span>Material Override</span>
          {hasOverride && (
            <span className="inspector-data-type-badge text-[9px] rounded px-1 font-mono">
              active
            </span>
          )}
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={() =>
              onChange({ friction: undefined, density: undefined, restitution: undefined })
            }
            title="Reset to Entity default material"
            className="inspector-text-button text-[10px] hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-3 gap-1 pt-0.5">
          <div>
            <div className="text-[9px] text-gray-500 mb-0.5">Friction</div>
            <input
              type="number"
              aria-label="Sub-shape Friction"
              value={item.friction ?? ''}
              placeholder="inherit"
              step={0.05}
              min={0}
              onChange={e =>
                onChange({
                  friction: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full editor-input editor-input-mono text-[11px] px-1.5 py-0.5"
            />
          </div>
          <div>
            <div className="text-[9px] text-gray-500 mb-0.5">Density</div>
            <input
              type="number"
              aria-label="Sub-shape Density"
              value={item.density ?? ''}
              placeholder="inherit"
              step={0.1}
              min={0}
              onChange={e =>
                onChange({
                  density: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full editor-input editor-input-mono text-[11px] px-1.5 py-0.5"
            />
          </div>
          <div>
            <div className="text-[9px] text-gray-500 mb-0.5">Restitution</div>
            <input
              type="number"
              aria-label="Sub-shape Restitution"
              value={item.restitution ?? ''}
              placeholder="inherit"
              step={0.05}
              min={0}
              max={1}
              onChange={e =>
                onChange({
                  restitution:
                    e.target.value === ''
                      ? undefined
                      : Math.max(0, Math.min(1, Number(e.target.value))),
                })
              }
              className="w-full editor-input editor-input-mono text-[11px] px-1.5 py-0.5"
            />
          </div>
        </div>
      )}
    </div>
  );
}

type LocalCompoundShape = CollisionCompoundShape & { _key: string };
type LocalPolygonVertex = CollisionPolygonVertex & { _key: string };

const EMPTY_COMPOUND: CollisionCompoundShape[] = [];
const EMPTY_POLYGON: CollisionPolygonVertex[] = [];

function toLocalCompound(
  compound: CollisionCompoundShape[],
  existing?: LocalCompoundShape[]
): LocalCompoundShape[] {
  const existingMap = new Map<number, string>();
  if (existing) {
    existing.forEach((item, idx) => {
      existingMap.set(idx, item._key);
    });
  }
  return compound.map((item, idx) => ({
    ...item,
    _key: existingMap.get(idx) ?? crypto.randomUUID(),
  }));
}

function stripLocalKey(local: LocalCompoundShape[]): CollisionCompoundShape[] {
  return local.map((item) => {
    const copy = { ...item };
    delete (copy as { _key?: string })._key;
    return copy;
  });
}

function toLocalPolygon(
  polygon: CollisionPolygonVertex[],
  existing?: LocalPolygonVertex[]
): LocalPolygonVertex[] {
  const existingMap = new Map<number, string>();
  if (existing) {
    existing.forEach((item, idx) => {
      existingMap.set(idx, item._key);
    });
  }
  return polygon.map((item, idx) => ({
    ...item,
    _key: existingMap.get(idx) ?? crypto.randomUUID(),
  }));
}

function stripLocalPolygonKey(local: LocalPolygonVertex[]): CollisionPolygonVertex[] {
  return local.map((item) => {
    const copy = { ...item };
    delete (copy as { _key?: string })._key;
    return copy;
  });
}

function computeNewVertexPosition(vertices: CollisionPolygonVertex[]): { x: number; y: number } {
  const count = vertices.length;
  if (count === 0) return { x: 0, y: -1 };
  const last = vertices[count - 1];
  const first = vertices[0];
  const midX = (last.x + first.x) / 2;
  const midY = (last.y + first.y) / 2;
  const avgX = vertices.reduce((sum, v) => sum + v.x, 0) / count;
  const avgY = vertices.reduce((sum, v) => sum + v.y, 0) / count;
  let dirX = midX - avgX;
  let dirY = midY - avgY;
  const len = Math.hypot(dirX, dirY);
  if (len > 1e-4) {
    dirX /= len;
    dirY /= len;
  } else {
    const edx = first.x - last.x;
    const edy = first.y - last.y;
    const elen = Math.hypot(edx, edy) || 1;
    dirX = edy / elen;
    dirY = -edx / elen;
  }
  const offset = 0.2;
  let candX = Math.max(-1, Math.min(1, Number((midX + dirX * offset).toFixed(3))));
  let candY = Math.max(-1, Math.min(1, Number((midY + dirY * offset).toFixed(3))));
  const cross = (candX - last.x) * (first.y - candY) - (candY - last.y) * (first.x - candX);
  if (Math.abs(cross) <= 1e-4) {
    if (Math.abs(candX) >= 0.99) candY = Math.max(-1, Math.min(1, candY + (candY > 0 ? -0.1 : 0.1)));
    else if (Math.abs(candY) >= 0.99) candX = Math.max(-1, Math.min(1, candX + (candX > 0 ? -0.1 : 0.1)));
    candX = Number(candX.toFixed(3));
    candY = Number(candY.toFixed(3));
  }
  return { x: candX, y: candY };
}

export function CollisionGeometrySection({
  template,
  source,
  entityUid,
  readOnly = false,
  onChangeShape,
  onChangePosition,
  onChangeSize,
  onChangePolygon,
  onChangeCompound,
  onRemoveCollision,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
  entityUid?: string;
  readOnly?: boolean;
  onChangeShape?: (shape: CollisionShape) => void;
  onChangePosition?: (pos: { x: number; y: number; z: number }) => void;
  onChangeSize?: (size: { x: number; y: number; z: number }) => void;
  onChangePolygon?: (polygon: CollisionPolygonVertex[]) => void;
  onChangeCompound?: (compound: CollisionCompoundShape[]) => void;
  onRemoveCollision?: () => void;
}) {
  const [uniformCircleLock, setUniformCircleLock] = useState(true);
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [prevEntityUid, setPrevEntityUid] = useState(entityUid);
  if (entityUid !== prevEntityUid) {
    setPrevEntityUid(entityUid);
    setIssuesExpanded(true);
  }

  const physics = template.physics;
  const shape = physics?.shape ?? 0;
  const collision = physics?.collision ?? {
    valid: false,
    position: { x: 0, y: 0, z: 0 },
    size: { x: 0, y: 0, z: 0 },
    polygon: [],
    compound: [],
    joints: [],
  };

  const rawCompound = physics?.collision?.compound ?? EMPTY_COMPOUND;
  const rawPolygon = physics?.collision?.polygon ?? EMPTY_POLYGON;

  const [localPos, setLocalPos] = useState({
    x: collision.position.x,
    y: collision.position.y,
    z: collision.position.z,
  });
  const [localSize, setLocalSize] = useState({
    x: collision.size.x,
    y: collision.size.y,
    z: collision.size.z,
  });
  const [localCompound, setLocalCompound] = useState<LocalCompoundShape[]>(() =>
    toLocalCompound(rawCompound)
  );
  const [localPolygon, setLocalPolygon] = useState<LocalPolygonVertex[]>(() =>
    toLocalPolygon(rawPolygon)
  );

  const [sourceCollision, setSourceCollision] = useState({
    uid: entityUid,
    posX: collision.position.x,
    posY: collision.position.y,
    posZ: collision.position.z,
    sizeX: collision.size.x,
    sizeY: collision.size.y,
    sizeZ: collision.size.z,
  });
  const [sourceCompoundSnapshot, setSourceCompoundSnapshot] = useState({
    uid: entityUid,
    compound: rawCompound,
  });
  const [sourcePolygonSnapshot, setSourcePolygonSnapshot] = useState({
    uid: entityUid,
    polygon: rawPolygon,
  });

  if (
    sourceCollision.uid !== entityUid ||
    sourceCollision.posX !== collision.position.x ||
    sourceCollision.posY !== collision.position.y ||
    sourceCollision.posZ !== collision.position.z ||
    sourceCollision.sizeX !== collision.size.x ||
    sourceCollision.sizeY !== collision.size.y ||
    sourceCollision.sizeZ !== collision.size.z
  ) {
    setSourceCollision({
      uid: entityUid,
      posX: collision.position.x,
      posY: collision.position.y,
      posZ: collision.position.z,
      sizeX: collision.size.x,
      sizeY: collision.size.y,
      sizeZ: collision.size.z,
    });
    setLocalPos({
      x: collision.position.x,
      y: collision.position.y,
      z: collision.position.z,
    });
    setLocalSize({
      x: collision.size.x,
      y: collision.size.y,
      z: collision.size.z,
    });
  }

  if (
    sourceCompoundSnapshot.uid !== entityUid ||
    !compoundsEqual(sourceCompoundSnapshot.compound, rawCompound)
  ) {
    setSourceCompoundSnapshot({
      uid: entityUid,
      compound: rawCompound,
    });
    setLocalCompound(prev => toLocalCompound(rawCompound, prev));
  }

  if (
    sourcePolygonSnapshot.uid !== entityUid ||
    !polygonsEqual(sourcePolygonSnapshot.polygon, rawPolygon)
  ) {
    setSourcePolygonSnapshot({
      uid: entityUid,
      polygon: rawPolygon,
    });
    setLocalPolygon(prev => toLocalPolygon(rawPolygon, prev));
  }

  const latestPosRef = useRef(localPos);
  const latestSizeRef = useRef(localSize);
  const latestLocalCompoundRef = useRef(localCompound);
  const latestLocalPolygonRef = useRef(localPolygon);

  useEffect(() => {
    latestPosRef.current = localPos;
    latestSizeRef.current = localSize;
    latestLocalCompoundRef.current = localCompound;
    latestLocalPolygonRef.current = localPolygon;
  }, [localPos, localSize, localCompound, localPolygon]);

  const isReadOnly = readOnly || source === 'Template';

  const handlePosChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isReadOnly) return;
    const rounded = Math.round(val);
    const newPos = {
      ...latestPosRef.current,
      [axis]: rounded,
    };
    latestPosRef.current = newPos;
    setLocalPos(newPos);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPos: newPos }]);
    }
  };

  const commitPosChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isReadOnly || !onChangePosition) return;
    const rounded = Math.round(val);
    const newPos = {
      ...latestPosRef.current,
      [axis]: rounded,
    };
    latestPosRef.current = newPos;
    setLocalPos(newPos);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPos: newPos }]);
    }
    onChangePosition(newPos);
  };

  const handleSizeChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isReadOnly) return;
    const clamped = Math.max(0.5, Number((Math.round(val * 2) / 2).toFixed(1)));
    let newSize: { x: number; y: number; z: number };
    if (shape === 2 && uniformCircleLock && (axis === 'x' || axis === 'y')) {
      newSize = {
        ...latestSizeRef.current,
        x: clamped,
        y: clamped,
      };
    } else {
      newSize = {
        ...latestSizeRef.current,
        [axis]: clamped,
      };
    }
    latestSizeRef.current = newSize;
    setLocalSize(newSize);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionSize: newSize }]);
    }
  };

  const commitSizeChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isReadOnly || !onChangeSize) return;
    const clamped = Math.max(0.5, Number((Math.round(val * 2) / 2).toFixed(1)));
    let newSize: { x: number; y: number; z: number };
    if (shape === 2 && uniformCircleLock && (axis === 'x' || axis === 'y')) {
      newSize = {
        ...latestSizeRef.current,
        x: clamped,
        y: clamped,
      };
    } else {
      newSize = {
        ...latestSizeRef.current,
        [axis]: clamped,
      };
    }
    latestSizeRef.current = newSize;
    setLocalSize(newSize);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionSize: newSize }]);
    }
    onChangeSize(newSize);
  };

  const handleVertexChange = (index: number, axis: 'x' | 'y', val: number) => {
    if (isReadOnly) return;
    const clamped = Math.max(-1, Math.min(1, Number(val.toFixed(3))));
    const updated = latestLocalPolygonRef.current.map((item, i) =>
      i === index ? { ...item, [axis]: clamped } : item
    );
    latestLocalPolygonRef.current = updated;
    setLocalPolygon(updated);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: stripLocalPolygonKey(updated) }]);
    }
  };

  const commitVertexChange = (index: number, axis: 'x' | 'y', val: number) => {
    if (isReadOnly || !onChangePolygon) return;
    const clamped = Math.max(-1, Math.min(1, Number(val.toFixed(3))));
    const updated = latestLocalPolygonRef.current.map((item, i) =>
      i === index ? { ...item, [axis]: clamped } : item
    );
    latestLocalPolygonRef.current = updated;
    setLocalPolygon(updated);
    const cleanUpdated = stripLocalPolygonKey(updated);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: cleanUpdated }]);
    }
    onChangePolygon(cleanUpdated);
  };

  const handleAddVertex = () => {
    const currentVertices = latestLocalPolygonRef.current;
    if (isReadOnly || currentVertices.length >= MAX_POLYGON_VERTICES) return;
    let nextVertices: LocalPolygonVertex[];
    if (currentVertices.length === 0) {
      nextVertices = toLocalPolygon(createDefaultPolygonVertices());
    } else {
      const pos = computeNewVertexPosition(currentVertices);
      const newVertex: LocalPolygonVertex = {
        name: `v${currentVertices.length}`,
        x: pos.x,
        y: pos.y,
        _key: crypto.randomUUID(),
      };
      nextVertices = [...currentVertices, newVertex];
    }
    const normalized = nextVertices.map((v, i) => ({ ...v, name: `v${i}` }));
    latestLocalPolygonRef.current = normalized;
    setLocalPolygon(normalized);
    const cleanUpdated = stripLocalPolygonKey(normalized);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: cleanUpdated }]);
    }
    onChangePolygon?.(cleanUpdated);
  };

  const handleDeleteVertex = (index: number) => {
    const currentVertices = latestLocalPolygonRef.current;
    if (isReadOnly || currentVertices.length <= MIN_POLYGON_VERTICES) return;
    const updated = currentVertices
      .filter((_, i) => i !== index)
      .map((v, i) => ({ ...v, name: `v${i}` }));
    latestLocalPolygonRef.current = updated;
    setLocalPolygon(updated);
    const cleanUpdated = stripLocalPolygonKey(updated);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: cleanUpdated }]);
    }
    onChangePolygon?.(cleanUpdated);
  };

  const handleMoveVertex = (index: number, direction: 'up' | 'down') => {
    if (isReadOnly) return;
    const currentVertices = latestLocalPolygonRef.current;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= currentVertices.length) return;
    const copy = [...currentVertices];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    const normalized = copy.map((v, i) => ({ ...v, name: `v${i}` }));
    latestLocalPolygonRef.current = normalized;
    setLocalPolygon(normalized);
    const cleanUpdated = stripLocalPolygonKey(normalized);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: cleanUpdated }]);
    }
    onChangePolygon?.(cleanUpdated);
  };

  const handleApplyPreset = (preset: PolygonPreset) => {
    if (isReadOnly) return;
    const localPreset = toLocalPolygon(preset.vertices);
    latestLocalPolygonRef.current = localPreset;
    setLocalPolygon(localPreset);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionPolygon: preset.vertices }]);
    }
    onChangePolygon?.(preset.vertices);
  };

  const handleAddSubShape = (shapeType: 'box' | 'circle' = 'box') => {
    if (isReadOnly || collision.compound.length >= MAX_COMPOUND_SUB_SHAPES) return;
    const newShape = createDefaultCompoundSubShape(collision.compound, shapeType);
    const updated = [...collision.compound, newShape];
    setLocalCompound(toLocalCompound(updated, latestLocalCompoundRef.current));
    onChangeCompound?.(updated);
  };

  const handleUpdateSubShape = (index: number, patch: Partial<CollisionCompoundShape>) => {
    if (isReadOnly) return;
    const base = collision.compound.length === latestLocalCompoundRef.current.length
      ? latestLocalCompoundRef.current
      : toLocalCompound(collision.compound, latestLocalCompoundRef.current);
    const updated = base.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    latestLocalCompoundRef.current = updated;
    setLocalCompound(updated);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionCompound: stripLocalKey(updated) }]);
    }
  };

  const commitCompoundChange = () => {
    if (isReadOnly || !onChangeCompound) return;
    onChangeCompound(stripLocalKey(latestLocalCompoundRef.current));
  };

  const handleDeleteSubShape = (index: number) => {
    if (isReadOnly) return;
    const updated = collision.compound.filter((_, i) => i !== index);
    setLocalCompound(toLocalCompound(updated, latestLocalCompoundRef.current));
    onChangeCompound?.(updated);
  };

  const handleDuplicateSubShape = (index: number) => {
    if (isReadOnly || collision.compound.length >= MAX_COMPOUND_SUB_SHAPES) return;
    const target = collision.compound[index];
    if (!target) return;
    const newName = generateSubShapeName(collision.compound);
    const clone: CollisionCompoundShape = {
      ...target,
      name: newName,
      posX: Math.max(-1, Math.min(1, Number((target.posX + 0.05).toFixed(2)))),
      posY: Math.max(-1, Math.min(1, Number((target.posY + 0.05).toFixed(2)))),
    };
    const updated = [...collision.compound, clone];
    setLocalCompound(toLocalCompound(updated, latestLocalCompoundRef.current));
    onChangeCompound?.(updated);
  };

  const handleShapeTypeChange = (index: number, newShape: 'box' | 'circle') => {
    if (isReadOnly) return;
    const current = latestLocalCompoundRef.current[index];
    if (!current) return;
    const patch: Partial<CollisionCompoundShape> = newShape === 'box'
      ? { shape: 'box', sizeX: current.sizeX ?? 1, sizeY: current.sizeY ?? 1 }
      : { shape: 'circle', radius: current.radius ?? 0.5 };
    const updated = latestLocalCompoundRef.current.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    latestLocalCompoundRef.current = updated;
    setLocalCompound(updated);
    const cleanUpdated = stripLocalKey(updated);
    if (entityUid) {
      transformEventBus.emit([{ uid: entityUid, collisionCompound: cleanUpdated }]);
    }
    onChangeCompound?.(cleanUpdated);
  };

  const currentPolygon = stripLocalPolygonKey(localPolygon);
  const currentCompound = stripLocalKey(localCompound);

  const polygonValidation = shape === 3 ? validatePolygon(currentPolygon) : null;
  const compoundValidation = shape === 4 ? validateCompound(currentCompound) : null;

  const activeDiagnostics = getCollisionDiagnostics({
    shape,
    collision: {
      valid: collision.valid,
      position: localPos,
      size: localSize,
      polygon: currentPolygon,
      compound: currentCompound,
      joints: collision.joints,
    },
    diagnostics: physics?.diagnostics,
  });
  const sortedDiagnostics = sortCollisionDiagnostics(activeDiagnostics);
  const isInvalid = sortedDiagnostics.length > 0;
  const unsupportedShapeDiag = sortedDiagnostics.find(
    d => d.code === 'UNSUPPORTED_SHAPE_VALUE'
  );
  const unsupportedRawValue = unsupportedShapeDiag
    ? (unsupportedShapeDiag.rawValue ?? unsupportedShapeDiag.message.match(/"([^"]*)"/)?.[1] ?? 'unknown')
    : null;
  const unsupportedLabel = unsupportedRawValue !== null ? `Unsupported (${unsupportedRawValue})` : null;

  const isGeometryWarning = (w: string) =>
    w.startsWith('Polygon') ||
    w.startsWith('Compound') ||
    w.startsWith('Collision') ||
    w.startsWith('Unsupported collision shape');

  const diagMessages = new Set(sortedDiagnostics.map(d => `${d.target}: ${d.message}`));
  const nonDiagnosticWarnings = (physics?.warnings ?? []).filter(
    w => !isGeometryWarning(w) && !diagMessages.has(w) && !sortedDiagnostics.some(d => w.includes(d.target))
  );

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>Collision</span>
          {source && (
            <span className="inspector-data-type-badge text-[10px] rounded px-1.5 py-0.5 font-normal">
              {source}
            </span>
          )}
        </div>
        {!isReadOnly && shape !== 0 && (
          <button
            type="button"
            onClick={onRemoveCollision}
            title="Remove Collision"
            aria-label="Remove Collision"
            className="inspector-icon-button inspector-danger-icon p-1 hover:text-red-400 transition-colors flex items-center justify-center"
          >
            <Icon name="trash" size={12} />
          </button>
        )}
      </div>

      {source === 'Template' && (
        <div className="text-[10px] text-gray-300 bg-gray-800/60 border border-[var(--inspector-border)] rounded px-2 py-1">
          Template collision is read-only. Unpack entity to edit.
        </div>
      )}

      {/* Shape Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-16 shrink-0">Shape</span>
        {isReadOnly ? (
          <div className="flex-1 editor-input py-1 text-xs font-mono select-text cursor-default">
            {unsupportedLabel ?? `${shape} - ${collisionShapeName(shape)}`}
          </div>
        ) : (
          <select
            aria-label="Collision Shape"
            value={unsupportedLabel ? 'unsupported' : shape}
            onChange={e => {
              if (e.target.value === 'unsupported') return;
              onChangeShape?.(Number(e.target.value) as CollisionShape);
            }}
            className="flex-1 editor-input py-1 text-xs font-mono cursor-pointer"
          >
            {unsupportedLabel && (
              <option value="unsupported" disabled>
                {unsupportedLabel}
              </option>
            )}
            <option value={0}>0 - None</option>
            <option value={1}>1 - Box</option>
            <option value={2}>2 - Circle</option>
            <option value={3}>3 - Polygon</option>
            <option value={4}>4 - Compound</option>
          </select>
        )}
      </div>

      {/* Invalid collision banner */}
      {isInvalid && (
        <div className="rounded border border-red-800/70 bg-red-950/40 text-[11px] text-red-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setIssuesExpanded(!issuesExpanded)}
            className="w-full px-2.5 py-1.5 flex items-center justify-between font-medium hover:bg-red-900/20 transition-colors text-left"
            aria-expanded={issuesExpanded}
          >
            <div className="flex items-center gap-1.5">
              <Icon name={issuesExpanded ? 'chevron-down' : 'chevron-right'} size={12} className="text-red-400 shrink-0" />
              <span className="font-semibold text-red-200">
                Invalid collision · {sortedDiagnostics.length} {sortedDiagnostics.length === 1 ? 'issue' : 'issues'}
              </span>
            </div>
            <span className="text-[10px] text-red-400 font-mono">
              {issuesExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {issuesExpanded && (
            <div className="px-2.5 pb-2 pt-1 border-t border-red-800/40 flex flex-col gap-1 text-[10px] text-red-200/90 font-mono">
              {sortedDiagnostics.map((diag, idx) => {
                const isGeneralPolygon = diag.target === 'Polygon' && (diag.message.startsWith('vertices') || diag.message.startsWith('must'));
                return (
                  <div key={`${diag.target}-${diag.code}-${idx}`} className="flex items-start gap-1">
                    <span>
                      • {isGeneralPolygon ? `Polygon ${diag.message}` : <><strong className="text-red-300 font-semibold">{diag.target}:</strong> {diag.message}</>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {shape === 0 && (
        <div className="text-xs text-gray-500 italic py-1">
          No collision assigned
        </div>
      )}

      {/* Collision Spatial Coordinates */}
      {shape !== 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--inspector-border)]">
          {/* Position XYZ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 shrink-0">Position</span>
            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={localPos.x}
                step={1}
                dragDelta={1}
                precision={0}
                readOnly={isReadOnly}
                onChange={v => handlePosChange('x', v)}
                onCommit={v => commitPosChange('x', v)}
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={localPos.y}
                step={1}
                dragDelta={1}
                precision={0}
                readOnly={isReadOnly}
                onChange={v => handlePosChange('y', v)}
                onCommit={v => commitPosChange('y', v)}
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={localPos.z}
                step={1}
                dragDelta={1}
                precision={0}
                readOnly={isReadOnly}
                onChange={v => handlePosChange('z', v)}
                onCommit={v => commitPosChange('z', v)}
              />
            </div>
          </div>

          {/* Local Size XYZ */}
          <div className="flex items-center gap-2">
            <div className="w-16 shrink-0 flex items-center justify-between pr-1">
              <span className="text-xs text-gray-400">Size</span>
              {shape === 2 && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setUniformCircleLock(!uniformCircleLock)}
                  title={uniformCircleLock ? 'Uniform circle radius locked (Size X = Size Y)' : 'Independent X/Y size'}
                  aria-label={uniformCircleLock ? 'Uniform circle radius locked' : 'Independent X/Y size'}
                  className={`inspector-icon-button p-0.5 transition-colors ${
                    uniformCircleLock
                      ? 'active text-[var(--inspector-text)] bg-[var(--inspector-surface-hover)] border border-[var(--inspector-border)]'
                      : 'text-gray-500'
                  }`}
                >
                  <Icon name={uniformCircleLock ? 'lock' : 'unlock'} size={11} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={localSize.x}
                step={0.5}
                dragDelta={0.5}
                precision={1}
                min={0.5}
                readOnly={isReadOnly}
                onChange={v => handleSizeChange('x', v)}
                onCommit={v => commitSizeChange('x', v)}
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={localSize.y}
                step={0.5}
                dragDelta={0.5}
                precision={1}
                min={0.5}
                readOnly={isReadOnly}
                onChange={v => handleSizeChange('y', v)}
                onCommit={v => commitSizeChange('y', v)}
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={localSize.z}
                step={0.5}
                dragDelta={0.5}
                precision={1}
                min={0.5}
                readOnly={isReadOnly}
                onChange={v => handleSizeChange('z', v)}
                onCommit={v => commitSizeChange('z', v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Non-geometry warnings (amber) */}
      {nonDiagnosticWarnings.length > 0 && (
        <div className="rounded border border-amber-800/70 bg-amber-950/30 p-2 text-[10px] text-amber-300">
          {nonDiagnosticWarnings.map((warning, index) => (
            <div key={index}>• {warning}</div>
          ))}
        </div>
      )}

      {/* Polygon Vertices Manager (Shape 3) */}
      {shape === 3 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--inspector-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400">
                Polygon Vertices ({localPolygon.length})
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  localPolygon.length >= MAX_POLYGON_VERTICES
                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                    : 'inspector-data-type-badge'
                }`}
              >
                {localPolygon.length} / {MAX_POLYGON_VERTICES}
              </span>
              {polygonValidation && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    polygonValidation.valid
                      ? 'inspector-data-type-badge'
                      : 'bg-red-950/70 text-red-400 border-red-800/60'
                  }`}
                  title={polygonValidation.valid ? 'Convex polygon with clockwise winding' : polygonValidation.errors.join(', ')}
                >
                  {polygonValidation.valid ? 'Convex' : 'Invalid Geometry'}
                </span>
              )}
            </div>

            {!isReadOnly && onChangePolygon && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={localPolygon.length >= MAX_POLYGON_VERTICES}
                  onClick={handleAddVertex}
                  title={
                    localPolygon.length >= MAX_POLYGON_VERTICES
                      ? `Maximum ${MAX_POLYGON_VERTICES} vertices reached`
                      : 'Add Polygon Vertex'
                  }
                  aria-label="Add Polygon Vertex"
                  className="inspector-button px-2 py-0.5 text-[10px] flex items-center gap-1 font-medium"
                >
                  + Vertex
                </button>
              </div>
            )}
          </div>

          {/* Preset Selector */}
          {!isReadOnly && onChangePolygon && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="shrink-0 text-[9px] text-gray-500">Presets:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {POLYGON_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="inspector-button px-1.5 py-0.5 text-[9px] font-mono text-gray-400 hover:text-gray-200"
                    title={`Apply ${preset.name} (${preset.vertices.length} vertices)`}
                    aria-label={`Apply ${preset.name}`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {localPolygon.length === 0 && (
            <div className="text-xs text-gray-500 italic py-1 text-center">
              No vertices. Click &quot;+ Vertex&quot; or choose a Preset to begin.
            </div>
          )}

          {/* Vertices List */}
          <div className="flex flex-col gap-1.5">
            {localPolygon.map((vertex, index) => (
              <div
                key={vertex._key}
                className="inspector-subsection rounded p-1.5 flex items-center gap-2"
              >
                <span className="text-xs font-mono text-gray-400 w-6 shrink-0 font-medium">
                  {vertex.name}
                </span>

                <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                  <AxisNumberInput
                    axis="X"
                    badgeClass="axis-badge-x"
                    value={vertex.x}
                    min={-1}
                    max={1}
                    step={0.05}
                    dragDelta={0.01}
                    precision={3}
                    readOnly={isReadOnly}
                    onChange={v => handleVertexChange(index, 'x', v)}
                    onCommit={v => commitVertexChange(index, 'x', v)}
                  />
                  <AxisNumberInput
                    axis="Y"
                    badgeClass="axis-badge-y"
                    value={vertex.y}
                    min={-1}
                    max={1}
                    step={0.05}
                    dragDelta={0.01}
                    precision={3}
                    readOnly={isReadOnly}
                    onChange={v => handleVertexChange(index, 'y', v)}
                    onCommit={v => commitVertexChange(index, 'y', v)}
                  />
                </div>

                {!isReadOnly && onChangePolygon && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveVertex(index, 'up')}
                      title="Move vertex up in sequence"
                      aria-label={`Move ${vertex.name} Up`}
                      className="inspector-icon-button p-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon name="chevron-up" size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index === localPolygon.length - 1}
                      onClick={() => handleMoveVertex(index, 'down')}
                      title="Move vertex down in sequence"
                      aria-label={`Move ${vertex.name} Down`}
                      className="inspector-icon-button p-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon name="chevron-down" size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={localPolygon.length <= MIN_POLYGON_VERTICES}
                      onClick={() => handleDeleteVertex(index)}
                      title={
                        localPolygon.length <= MIN_POLYGON_VERTICES
                          ? `Minimum ${MIN_POLYGON_VERTICES} vertices required`
                          : `Delete ${vertex.name}`
                      }
                      aria-label={`Delete ${vertex.name}`}
                      className="inspector-icon-button inspector-danger-icon p-0.5 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compound Shapes Manager (Shape 4) */}
      {shape === 4 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--inspector-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400">
                Compound shapes ({localCompound.length})
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  localCompound.length >= MAX_COMPOUND_SUB_SHAPES
                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                    : 'inspector-data-type-badge'
                }`}
              >
                {localCompound.length} / {MAX_COMPOUND_SUB_SHAPES}
              </span>
              {compoundValidation && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    compoundValidation.valid
                      ? 'inspector-data-type-badge'
                      : 'bg-red-950/70 text-red-400 border-red-800/60'
                  }`}
                  title={compoundValidation.valid ? 'Compound shapes valid' : compoundValidation.errors.join(', ')}
                >
                  {compoundValidation.valid ? 'Valid' : 'Invalid Geometry'}
                </span>
              )}
            </div>

            {!isReadOnly && onChangeCompound && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={localCompound.length >= MAX_COMPOUND_SUB_SHAPES}
                  onClick={() => handleAddSubShape('box')}
                  title={
                    localCompound.length >= MAX_COMPOUND_SUB_SHAPES
                      ? `Maximum ${MAX_COMPOUND_SUB_SHAPES} sub-shapes reached`
                      : 'Add Box Sub-shape'
                  }
                  aria-label="Add Box Sub-shape"
                  className="inspector-button px-2 py-0.5 text-[10px] flex items-center gap-1 font-medium"
                >
                  + Box
                </button>
                <button
                  type="button"
                  disabled={localCompound.length >= MAX_COMPOUND_SUB_SHAPES}
                  onClick={() => handleAddSubShape('circle')}
                  title={
                    localCompound.length >= MAX_COMPOUND_SUB_SHAPES
                      ? `Maximum ${MAX_COMPOUND_SUB_SHAPES} sub-shapes reached`
                      : 'Add Circle Sub-shape'
                  }
                  aria-label="Add Circle Sub-shape"
                  className="inspector-button px-2 py-0.5 text-[10px] flex items-center gap-1 font-medium"
                >
                  + Circle
                </button>
              </div>
            )}
          </div>

          {localCompound.length === 0 && (
            <div className="text-xs text-gray-500 italic py-1 text-center">
              No sub-shapes. Click &quot;+ Box&quot; or &quot;+ Circle&quot; to add a sub-shape.
            </div>
          )}

          {localCompound.map((item, index) => {
            const isCompoundReadOnly = isReadOnly || !onChangeCompound;
            return (
              <div
                key={item._key}
                className="inspector-subsection rounded p-2 flex flex-col gap-2"
              >
                {/* Sub-shape Card Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-500 font-mono">#{index + 1}</span>
                    {isCompoundReadOnly ? (
                      <span className="font-mono text-gray-200 text-xs truncate select-text">{item.name}</span>
                    ) : (
                      <>
                        <span className="sr-only">{item.name}</span>
                        <input
                          type="text"
                          aria-label={`Sub-shape ${index + 1} Name`}
                          value={item.name}
                          onChange={e => {
                            const clean = e.target.value.replace(/[^\w.-]/g, '');
                            handleUpdateSubShape(index, { name: clean });
                            commitCompoundChange();
                          }}
                          onBlur={commitCompoundChange}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              commitCompoundChange();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-28 editor-input editor-input-mono text-xs px-1.5 py-0.5"
                          placeholder="name"
                        />
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isCompoundReadOnly ? (
                      <span className="inspector-data-type-badge text-[10px] font-mono uppercase px-1.5 py-0.5 rounded">
                        {item.shape}
                      </span>
                    ) : (
                      <select
                        aria-label={`Sub-shape ${index + 1} Shape`}
                        value={item.shape}
                        onChange={e => {
                          const newShape = e.target.value as 'box' | 'circle';
                          handleShapeTypeChange(index, newShape);
                        }}
                        className="editor-input text-[11px] font-mono px-1.5 py-0.5 cursor-pointer"
                      >
                        <option value="box">Box</option>
                        <option value="circle">Circle</option>
                      </select>
                    )}

                    {!isCompoundReadOnly && (
                      <>
                        <button
                          type="button"
                          disabled={localCompound.length >= MAX_COMPOUND_SUB_SHAPES}
                          onClick={() => handleDuplicateSubShape(index)}
                          title={
                            localCompound.length >= MAX_COMPOUND_SUB_SHAPES
                              ? `Maximum ${MAX_COMPOUND_SUB_SHAPES} sub-shapes reached`
                              : 'Duplicate Sub-shape'
                          }
                          aria-label={`Duplicate Sub-shape ${index + 1}`}
                          className="inspector-icon-button p-1 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="copy" size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubShape(index)}
                          title="Delete Sub-shape"
                          aria-label={`Delete Sub-shape ${index + 1}`}
                          className="inspector-icon-button inspector-danger-icon p-1 hover:text-red-400 transition-colors"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Position */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 shrink-0">Position</span>
                  <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                    <AxisNumberInput
                      axis="X"
                      badgeClass="axis-badge-x"
                      value={item.posX}
                      readOnly={isCompoundReadOnly}
                      min={-1}
                      max={1}
                      step={0.05}
                      dragDelta={0.05}
                      precision={2}
                      onChange={v => {
                        handleUpdateSubShape(index, { posX: v });
                        commitCompoundChange();
                      }}
                      onCommit={commitCompoundChange}
                      ariaLabel={`Sub-shape ${index + 1} Pos X`}
                    />
                    <AxisNumberInput
                      axis="Y"
                      badgeClass="axis-badge-y"
                      value={item.posY}
                      readOnly={isCompoundReadOnly}
                      min={-1}
                      max={1}
                      step={0.05}
                      dragDelta={0.05}
                      precision={2}
                      onChange={v => {
                        handleUpdateSubShape(index, { posY: v });
                        commitCompoundChange();
                      }}
                      onCommit={commitCompoundChange}
                      ariaLabel={`Sub-shape ${index + 1} Pos Y`}
                    />
                  </div>
                </div>

                {/* Dimensions */}
                {item.shape === 'box' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Size</span>
                      <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                        <AxisNumberInput
                          axis="X"
                          badgeClass="axis-badge-x"
                          value={item.sizeX ?? 1}
                          readOnly={isCompoundReadOnly}
                          min={0.05}
                          max={10}
                          step={0.05}
                          dragDelta={0.05}
                          precision={2}
                          onChange={v => {
                            handleUpdateSubShape(index, { sizeX: Math.max(0.01, v) });
                            commitCompoundChange();
                          }}
                          onCommit={commitCompoundChange}
                          ariaLabel={`Sub-shape ${index + 1} Size X`}
                        />
                        <AxisNumberInput
                          axis="Y"
                          badgeClass="axis-badge-y"
                          value={item.sizeY ?? 1}
                          readOnly={isCompoundReadOnly}
                          min={0.05}
                          max={10}
                          step={0.05}
                          dragDelta={0.05}
                          precision={2}
                          onChange={v => {
                            handleUpdateSubShape(index, { sizeY: Math.max(0.01, v) });
                            commitCompoundChange();
                          }}
                          onCommit={commitCompoundChange}
                          ariaLabel={`Sub-shape ${index + 1} Size Y`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Angle</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <AxisNumberInput
                            axis="∠"
                            badgeClass="axis-badge-angle"
                            value={item.angle}
                            readOnly={isCompoundReadOnly}
                            step={0.05}
                            dragDelta={0.05}
                            onChange={v => {
                              handleUpdateSubShape(index, { angle: v });
                              commitCompoundChange();
                            }}
                            onCommit={commitCompoundChange}
                            ariaLabel={`Sub-shape ${index + 1} Angle`}
                            title={`Angle: ${item.angle} rad (${radToDeg(item.angle)}°)`}
                          />
                        </div>
                        <div className="text-xs text-gray-400 font-mono shrink-0 select-text">
                          <span>rad </span>
                          <span className="text-gray-500 text-[10px]">({radToDeg(item.angle)}°)</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Radius</span>
                      <div className="flex-1 min-w-0">
                        <AxisNumberInput
                          axis="R"
                          badgeClass="axis-badge-z"
                          value={item.radius ?? 0.5}
                          readOnly={isCompoundReadOnly}
                          min={0.05}
                          max={10}
                          step={0.05}
                          dragDelta={0.05}
                          precision={2}
                          onChange={v => {
                            handleUpdateSubShape(index, { radius: Math.max(0.01, v) });
                            commitCompoundChange();
                          }}
                          onCommit={commitCompoundChange}
                          ariaLabel={`Sub-shape ${index + 1} Radius`}
                          title={`Radius: ${item.radius ?? 0.5}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Angle</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <AxisNumberInput
                            axis="∠"
                            badgeClass="axis-badge-angle"
                            value={item.angle}
                            readOnly={isCompoundReadOnly}
                            step={0.05}
                            dragDelta={0.05}
                            onChange={v => {
                              handleUpdateSubShape(index, { angle: v });
                              commitCompoundChange();
                            }}
                            onCommit={commitCompoundChange}
                            ariaLabel={`Sub-shape ${index + 1} Angle`}
                            title={`Angle: ${item.angle} rad (${radToDeg(item.angle)}°)`}
                          />
                        </div>
                        <div className="text-xs text-gray-400 font-mono shrink-0 select-text">
                          <span>rad </span>
                          <span className="text-gray-500 text-[10px]">({radToDeg(item.angle)}°)</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Material Overrides */}
                <SubShapeMaterialControl
                  item={item}
                  readOnly={isCompoundReadOnly}
                  onChange={patch => {
                    handleUpdateSubShape(index, patch);
                    commitCompoundChange();
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
