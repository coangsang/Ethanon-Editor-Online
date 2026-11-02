import type { EntityTemplate } from '../../types';
import { AxisNumberInput, CheckInput } from './InspectorControls';
import { radToDeg } from './inspectorFormatters';

export function RevoluteJointsSection({
  template,
}: {
  template: EntityTemplate;
}) {
  const joints = template.physics?.collision.joints;
  if (!joints || joints.length === 0) return null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5">
        Revolute Joints ({joints.length})
      </div>

      <div className="flex flex-col gap-2">
        {joints.map(joint => (
          <div
            key={joint.name}
            className="inspector-subsection rounded border border-gray-800 bg-gray-950/40 p-2 flex flex-col gap-2"
          >
            {/* Joint Name Header */}
            <div className="text-xs font-mono font-semibold text-gray-200 pb-1 border-b border-gray-800">
              {joint.name}
            </div>

            {/* Target Entity */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Target</span>
              <input
                type="text"
                disabled
                value={joint.otherEntityName}
                placeholder="(none)"
                className="flex-1 editor-input-mono text-xs py-1 text-gray-200"
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
                  disabled
                />
                <AxisNumberInput
                  axis="Y"
                  badgeClass="axis-badge-y"
                  value={joint.attachPointAY}
                  disabled
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
                  disabled
                />
                <AxisNumberInput
                  axis="Y"
                  badgeClass="axis-badge-y"
                  value={joint.attachPointBY}
                  disabled
                />
              </div>
            </div>

            {/* Limit Section with Edit Text Inputs */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
              <CheckInput label="Limit" value={joint.enableLimit} disabled />
              <div className={`grid grid-cols-2 gap-2 pl-5 ${!joint.enableLimit ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Lower</span>
                  <input
                    type="number"
                    disabled
                    value={joint.lowerAngle}
                    className="flex-1 editor-input-mono text-xs py-1 w-0"
                    title={joint.enableLimit ? `${radToDeg(joint.lowerAngle)}°` : undefined}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Upper</span>
                  <input
                    type="number"
                    disabled
                    value={joint.upperAngle}
                    className="flex-1 editor-input-mono text-xs py-1 w-0"
                    title={joint.enableLimit ? `${radToDeg(joint.upperAngle)}°` : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Motor Section with Edit Text Inputs */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
              <CheckInput label="Motor" value={joint.enableMotor} disabled />
              <div className={`grid grid-cols-2 gap-2 pl-5 ${!joint.enableMotor ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Speed</span>
                  <input
                    type="number"
                    disabled
                    value={joint.motorSpeed}
                    className="flex-1 editor-input-mono text-xs py-1 w-0"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-10 shrink-0">Torque</span>
                  <input
                    type="number"
                    disabled
                    value={joint.maxMotorTorque}
                    className="flex-1 editor-input-mono text-xs py-1 w-0"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
