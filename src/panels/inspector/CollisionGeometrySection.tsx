import type { EntityTemplate } from '../../types';
import { collisionShapeName } from '../../utils/collision';
import { AxisNumberInput } from './InspectorControls';
import { formatNumber, radToDeg } from './inspectorFormatters';

export function CollisionGeometrySection({
  template,
  source,
  instanceScale,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
  instanceScale?: { x: number; y: number };
}) {
  const physics = template.physics;
  if (!physics) return null;
  const { collision } = physics;
  const scale = instanceScale ?? template.scale ?? { x: 1, y: 1 };
  const effectiveSize = {
    x: Math.abs(collision.size.x * scale.x),
    y: Math.abs(collision.size.y * scale.y),
    z: collision.size.z,
  };

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
        <span>Collision</span>
        {source && (
          <span className="text-[10px] rounded bg-cyan-950/70 px-1.5 py-0.5 text-cyan-300 font-normal">
            {source}
          </span>
        )}
      </div>

      {/* Shape Selector Display */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-16 shrink-0">Shape</span>
        <div className="flex-1 editor-input py-1 text-xs font-mono text-gray-200 select-text cursor-default">
          {physics.shape} - {collisionShapeName(physics.shape)}
        </div>
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
                readOnly
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={collision.position.y}
                readOnly
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={collision.position.z}
                readOnly
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
                readOnly
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={collision.size.y}
                readOnly
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={collision.size.z}
                readOnly
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
                readOnly
              />
              <AxisNumberInput
                axis="Y"
                badgeClass="axis-badge-y"
                value={effectiveSize.y}
                readOnly
              />
              <AxisNumberInput
                axis="Z"
                badgeClass="axis-badge-z"
                value={effectiveSize.z}
                readOnly
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
