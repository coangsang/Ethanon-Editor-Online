import { useState, useRef, useEffect } from 'react';
import type { CollisionCompoundShape, CollisionShape, EntityTemplate } from '../../types';
import {
  collisionShapeName,
  createDefaultCompoundSubShape,
  generateSubShapeName,
  MAX_COMPOUND_SUB_SHAPES,
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

const EMPTY_COMPOUND: CollisionCompoundShape[] = [];

function compoundsEqual(a: CollisionCompoundShape[], b: CollisionCompoundShape[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (
      ai.name !== bi.name ||
      ai.shape !== bi.shape ||
      ai.posX !== bi.posX ||
      ai.posY !== bi.posY ||
      ai.sizeX !== bi.sizeX ||
      ai.sizeY !== bi.sizeY ||
      ai.radius !== bi.radius ||
      ai.angle !== bi.angle ||
      ai.friction !== bi.friction ||
      ai.density !== bi.density ||
      ai.restitution !== bi.restitution
    ) {
      return false;
    }
  }
  return true;
}

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

export function CollisionGeometrySection({
  template,
  source,
  entityUid,
  readOnly = false,
  onChangeShape,
  onChangePosition,
  onChangeSize,
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
  onChangeCompound?: (compound: CollisionCompoundShape[]) => void;
  onRemoveCollision?: () => void;
}) {
  const [uniformCircleLock, setUniformCircleLock] = useState(true);

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

  const latestPosRef = useRef(localPos);
  const latestSizeRef = useRef(localSize);
  const latestLocalCompoundRef = useRef(localCompound);

  useEffect(() => {
    latestPosRef.current = localPos;
    latestSizeRef.current = localSize;
    latestLocalCompoundRef.current = localCompound;
  }, [localPos, localSize, localCompound]);

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
            {shape} - {collisionShapeName(shape)}
          </div>
        ) : (
          <select
            aria-label="Collision Shape"
            value={shape}
            onChange={e => onChangeShape?.(Number(e.target.value) as CollisionShape)}
            className="flex-1 editor-input py-1 text-xs font-mono cursor-pointer"
          >
            <option value={0}>0 - None</option>
            <option value={1}>1 - Box</option>
            <option value={2}>2 - Circle</option>
            {shape === 3 && <option value={3}>3 - Polygon</option>}
            <option value={4}>4 - Compound</option>
          </select>
        )}
      </div>

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

      {/* Warnings */}
      {physics && physics.warnings.length > 0 && (
        <div className="rounded border border-amber-800/70 bg-amber-950/30 p-2 text-[10px] text-amber-300">
          {physics.warnings.map((warning, index) => (
            <div key={index}>• {warning}</div>
          ))}
        </div>
      )}

      {/* Polygon Vertices (Shape 3 - Read Only) */}
      {shape === 3 && collision.polygon.length > 0 && (
        <div className="inspector-subsection rounded p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
            <span>Polygon Vertices ({collision.polygon.length})</span>
            <span className="text-[9px] text-gray-500 font-mono">[-1.0, 1.0]</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {collision.polygon.map(vertex => (
              <div key={vertex.name} className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 w-7 shrink-0">{vertex.name}</span>
                <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                  <AxisNumberInput
                    axis="X"
                    badgeClass="axis-badge-x"
                    value={vertex.x}
                    readOnly
                    precision={3}
                  />
                  <AxisNumberInput
                    axis="Y"
                    badgeClass="axis-badge-y"
                    value={vertex.y}
                    readOnly
                    precision={3}
                  />
                </div>
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
