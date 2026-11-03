import type { EntityTemplate } from '../../types';
import { AxisNumberInput, CheckInput } from './InspectorControls';
import { radToDeg } from './inspectorFormatters';

export function RevoluteJointsSection({
  template,
  source,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
}) {
  const joints = template.physics?.collision.joints;
  if (!joints || joints.length === 0) return null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
        <span>Revolute Joints ({joints.length})</span>
        {source && (
          <span className="inspector-data-type-badge text-[10px] rounded px-1.5 py-0.5 font-normal">
            {source}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {joints.map(joint => (
          <div
            key={joint.name}
            className="inspector-subsection rounded border border-gray-800 bg-gray-950/40 p-2 flex flex-col gap-2"
          >
            {/* Joint Name Header */}
            <div className="text-xs font-mono font-semibold text-gray-200 pb-1 border-b border-gray-800 select-text">
              {joint.name}
            </div>

            {/* Target Entity */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Target</span>
              <input
                type="text"
                readOnly
                value={joint.otherEntityName}
                placeholder="(none)"
                className="flex-1 editor-input-mono text-xs py-1 text-gray-200 select-text cursor-default"
              />
            </div>

            {/* Anchor A */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Anchor A</span>
              <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                <AxisNumberInput
                  axis="X"
                  badgeClass="axis-badge-x"
                  value={joint.attachPointAX}
                  readOnly
                  precision={3}
                />
                <AxisNumberInput
                  axis="Y"
                  badgeClass="axis-badge-y"
                  value={joint.attachPointAY}
                  readOnly
                  precision={3}
                />
              </div>
            </div>

            {/* Anchor B */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Anchor B</span>
              <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                <AxisNumberInput
                  axis="X"
                  badgeClass="axis-badge-x"
                  value={joint.attachPointBX}
                  readOnly
                  precision={3}
                />
                <AxisNumberInput
                  axis="Y"
                  badgeClass="axis-badge-y"
                  value={joint.attachPointBY}
                  readOnly
                  precision={3}
                />
              </div>
            </div>

            {/* Limit Section with Read-Only Inputs */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
              <CheckInput label="Limit" value={joint.enableLimit} readOnly />
              <div className={`grid grid-cols-2 gap-2 pl-5 ${!joint.enableLimit ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Lower</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="number"
                      readOnly
                      value={joint.lowerAngle}
                      step="any"
                      className="flex-1 min-w-0 editor-input-mono text-xs py-1 select-text cursor-default"
                      title={`Lower: ${joint.lowerAngle} rad (${radToDeg(joint.lowerAngle)}°)`}
                    />
                    <span className="text-[10px] text-gray-500 shrink-0">rad</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Upper</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="number"
                      readOnly
                      value={joint.upperAngle}
                      step="any"
                      className="flex-1 min-w-0 editor-input-mono text-xs py-1 select-text cursor-default"
                      title={`Upper: ${joint.upperAngle} rad (${radToDeg(joint.upperAngle)}°)`}
                    />
                    <span className="text-[10px] text-gray-500 shrink-0">rad</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Motor Section with Read-Only Inputs */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
              <CheckInput label="Motor" value={joint.enableMotor} readOnly />
              <div className={`grid grid-cols-2 gap-2 pl-5 ${!joint.enableMotor ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Speed</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="number"
                      readOnly
                      value={joint.motorSpeed}
                      step="any"
                      className="flex-1 min-w-0 editor-input-mono text-xs py-1 select-text cursor-default"
                      title={`Speed: ${joint.motorSpeed} rad/s`}
                    />
                    <span className="text-[10px] text-gray-500 shrink-0">rad/s</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Torque</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="number"
                      readOnly
                      value={joint.maxMotorTorque}
                      step="any"
                      className="flex-1 min-w-0 editor-input-mono text-xs py-1 select-text cursor-default"
                      title={`Torque: ${joint.maxMotorTorque}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
