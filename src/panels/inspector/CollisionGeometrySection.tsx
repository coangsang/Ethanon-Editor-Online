import type { EntityTemplate } from '../../types';
import { AxisNumberInput } from './InspectorControls';
import { radToDeg } from './inspectorFormatters';

export function CollisionGeometrySection({
  template,
}: {
  template: EntityTemplate;
}) {
  const physics = template.physics;
  if (!physics) return null;
  const { collision } = physics;
  const scale = template.scale ?? { x: 1, y: 1 };
  const effectiveSize = {
    x: Math.abs(collision.size.x * scale.x),
    y: Math.abs(collision.size.y * scale.y),
    z: collision.size.z,
  };

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5">
        Collision
      </div>

      {/* Shape Selector (Standard editor select) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-16 shrink-0">Shape</span>
        <select
          value={physics.shape}
          disabled
          className="flex-1 editor-input py-1 cursor-not-allowed opacity-80"
        >
          <option value={0}>0 - None</option>
          <option value={1}>1 - Box</option>
          <option value={2}>2 - Circle</option>
          <option value={3}>3 - Polygon</option>
          <option value={4}>4 - Compound</option>
        </select>
      </div>

      {/* Collision Spatial Coordinates */}
      {physics.shape !== 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-800">
          {/* Position XYZ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 shrink-0">Position</span>
            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={collision.position.x}
                disabled
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={collision.position.y}
                disabled
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={collision.position.z}
                disabled
              />
            </div>
          </div>

          {/* Local Size XYZ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 shrink-0">Size</span>
            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={collision.size.x}
                disabled
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={collision.size.y}
                disabled
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={collision.size.z}
                disabled
              />
            </div>
          </div>

          {/* Effective Size XYZ */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs text-gray-500 w-16 shrink-0"
              title="Effective size scaled by entity transform"
            >
              Effective
            </span>
            <div className="grid grid-cols-3 gap-1 flex-1 min-w-0">
              <AxisNumberInput
                axis="X"
                badgeClass="axis-badge-x"
                value={effectiveSize.x}
                disabled
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={effectiveSize.y}
                disabled
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={effectiveSize.z}
                disabled
              />
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {physics.warnings.length > 0 && (
        <div className="rounded border border-amber-800/70 bg-amber-950/30 p-2 text-[10px] text-amber-300">
          {physics.warnings.map((warning, index) => (
            <div key={index}>• {warning}</div>
          ))}
        </div>
      )}

      {/* Polygon Vertices (Shape 3) */}
      {physics.shape === 3 && collision.polygon.length > 0 && (
        <div className="inspector-subsection rounded border border-gray-800 bg-gray-950/40 p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
            <span>Polygon Vertices ({collision.polygon.length})</span>
            <span className="text-[9px] text-gray-500 font-mono">[-1.0, 1.0]</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {collision.polygon.map(vertex => (
              <div key={vertex.name} className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-gray-400 w-5">{vertex.name}</span>
                <div className="grid grid-cols-2 gap-1 flex-1">
                  <AxisNumberInput
                    axis="X"
                    badgeClass="axis-badge-x"
                    value={vertex.x}
                    disabled
                    precision={3}
                  />
                  <AxisNumberInput
                    axis="Y"
                    badgeClass="axis-badge-y"
                    value={vertex.y}
                    disabled
                    precision={3}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compound Shapes (Shape 4) */}
      {physics.shape === 4 && collision.compound.length > 0 && (
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
                <span className="font-mono text-gray-200">{item.name}</span>
                <span className="text-[10px] text-gray-400 font-mono uppercase">
                  {item.shape}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-14 shrink-0">Position</span>
                <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                  <AxisNumberInput
                    axis="X"
                    badgeClass="axis-badge-x"
                    value={item.posX}
                    disabled
                  />
                  <AxisNumberInput
                    axis="Y"
                    badgeClass="axis-badge-y"
                    value={item.posY}
                    disabled
                  />
                </div>
              </div>
              {item.shape === 'box' ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">Size</span>
                    <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                      <AxisNumberInput
                        axis="X"
                        badgeClass="axis-badge-x"
                        value={item.sizeX ?? 0}
                        disabled
                      />
                      <AxisNumberInput
                        axis="Y"
                        badgeClass="axis-badge-y"
                        value={item.sizeY ?? 0}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">Angle</span>
                    <div className="flex-1 flex items-center gap-2 font-mono text-xs text-gray-300">
                      <span>{item.angle} rad</span>
                      <span className="text-gray-500 text-[10px]">
                        ({radToDeg(item.angle)}°)
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Radius</span>
                  <input
                    type="number"
                    disabled
                    value={item.radius ?? 0}
                    className="flex-1 editor-input-mono text-xs py-1"
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-800">
                <span>Material</span>
                <span className="font-mono text-gray-400">
                  F {item.friction ?? physics.friction} · D {item.density ?? physics.density} · R{' '}
                  {item.restitution ?? physics.restitution}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
