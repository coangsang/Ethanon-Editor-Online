import { useState, useRef, useEffect } from 'react';
import type { EntityTemplate } from '../../types';
import { collisionShapeName } from '../../utils/collision';
import { Icon } from '../../components/Icon';
import { AxisNumberInput } from './InspectorControls';
import { formatNumber, radToDeg } from './inspectorFormatters';
import { transformEventBus } from '../../store/TransformEventBus';

export function CollisionGeometrySection({
  template,
  source,
  entityUid,
  readOnly = false,
  onChangeShape,
  onChangePosition,
  onChangeSize,
  onRemoveCollision,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
  entityUid?: string;
  readOnly?: boolean;
  onChangeShape?: (shape: 0 | 1 | 2) => void;
  onChangePosition?: (pos: { x: number; y: number; z: number }) => void;
  onChangeSize?: (size: { x: number; y: number; z: number }) => void;
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
  const [sourceCollision, setSourceCollision] = useState({
    uid: entityUid,
    posX: collision.position.x,
    posY: collision.position.y,
    posZ: collision.position.z,
    sizeX: collision.size.x,
    sizeY: collision.size.y,
    sizeZ: collision.size.z,
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

  const latestPosRef = useRef(localPos);
  const latestSizeRef = useRef(localSize);

  useEffect(() => {
    latestPosRef.current = localPos;
    latestSizeRef.current = localSize;
  }, [localPos, localSize]);

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

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>Collision</span>
          {source && (
            <span className="text-[10px] rounded bg-cyan-950/70 px-1.5 py-0.5 text-cyan-300 font-normal">
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
            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors flex items-center gap-0.5"
          >
            <Icon name="trash" size={12} />
          </button>
        )}
      </div>

      {source === 'Template' && (
        <div className="text-[10px] text-cyan-300/80 bg-cyan-950/30 border border-cyan-800/40 rounded px-2 py-1">
          Template collision is read-only. Unpack entity to edit.
        </div>
      )}

      {/* Shape Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-16 shrink-0">Shape</span>
        {isReadOnly ? (
          <div className="flex-1 editor-input py-1 text-xs font-mono text-gray-200 select-text cursor-default">
            {shape} - {collisionShapeName(shape)}
          </div>
        ) : (
          <select
            aria-label="Collision Shape"
            value={shape}
            onChange={e => onChangeShape?.(Number(e.target.value) as 0 | 1 | 2)}
            className="flex-1 editor-input py-1 text-xs font-mono text-gray-200 bg-gray-850 border border-gray-700 rounded focus:border-cyan-500 focus:outline-none cursor-pointer"
          >
            <option value={0}>0 - None</option>
            <option value={1}>1 - Box</option>
            <option value={2}>2 - Circle</option>
            {shape === 3 && <option value={3}>3 - Polygon</option>}
            {shape === 4 && <option value={4}>4 - Compound</option>}
          </select>
        )}
      </div>

      {shape === 0 && (
        <div className="text-[11px] text-gray-500 italic py-1">
          No collision assigned
        </div>
      )}

      {/* Collision Spatial Coordinates */}
      {shape !== 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-800">
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
                  className={`p-0.5 rounded transition-colors ${
                    uniformCircleLock
                      ? 'text-cyan-400 bg-cyan-950/60'
                      : 'text-gray-500 hover:text-gray-300'
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
        <div className="inspector-subsection rounded border border-gray-800 bg-gray-950/40 p-2 flex flex-col gap-1.5">
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

      {/* Compound Shapes (Shape 4 - Read Only) */}
      {shape === 4 && collision.compound.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold text-gray-400">
            Compound shapes ({collision.compound.length})
          </div>
          {collision.compound.map(item => (
            <div
              key={item.name}
              className="inspector-subsection rounded border border-gray-800 bg-gray-950/40 p-2 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-200 select-text">{item.name}</span>
                <span className="text-[10px] text-gray-400 font-mono uppercase">
                  {item.shape}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 shrink-0">Position</span>
                <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                  <AxisNumberInput
                    axis="X"
                    badgeClass="axis-badge-x"
                    value={item.posX}
                    readOnly
                  />
                  <AxisNumberInput
                    axis="Y"
                    badgeClass="axis-badge-y"
                    value={item.posY}
                    readOnly
                  />
                </div>
              </div>
              {item.shape === 'box' ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 shrink-0">Size</span>
                    <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                      <AxisNumberInput
                        axis="X"
                        badgeClass="axis-badge-x"
                        value={item.sizeX ?? 0}
                        readOnly
                      />
                      <AxisNumberInput
                        axis="Y"
                        badgeClass="axis-badge-y"
                        value={item.sizeY ?? 0}
                        readOnly
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
                          readOnly
                          ariaLabel="Angle"
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 shrink-0">Radius</span>
                  <div className="flex-1 min-w-0">
                    <AxisNumberInput
                      axis="R"
                      badgeClass="axis-badge-z"
                      value={item.radius ?? 0}
                      readOnly
                      ariaLabel="Radius"
                      title={`Radius: ${item.radius ?? 0}`}
                    />
                  </div>
                </div>
              )}
              {(item.friction !== undefined || item.density !== undefined || item.restitution !== undefined) && (
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-800">
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
