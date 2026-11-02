import type { EntityTemplate } from '../../types';
import { CheckInput } from './InspectorControls';

export function EntityPhysicsSection({
  template,
}: {
  template: EntityTemplate;
}) {
  const physics = template.physics;
  if (!physics) return null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5">
        Physics
      </div>

      {/* Body Properties */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
        <CheckInput label="Static" value={physics.static} disabled />
        <CheckInput label="Sensor" value={physics.sensor} disabled />
        <CheckInput label="Bullet (CCD)" value={physics.bullet} disabled />
        <CheckInput label="Fixed Rotation" value={physics.fixedRotation} disabled />
      </div>

      {/* Material & Gravity Parameters with Edit Text inputs */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 w-18 shrink-0">Friction</span>
            <input
              type="number"
              disabled
              value={physics.friction}
              className="flex-1 editor-input-mono text-xs py-1 w-0"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 w-18 shrink-0">Density</span>
            <input
              type="number"
              disabled
              value={physics.density}
              className="flex-1 editor-input-mono text-xs py-1 w-0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 w-18 shrink-0">Restitution</span>
            <input
              type="number"
              disabled
              value={physics.restitution}
              className="flex-1 editor-input-mono text-xs py-1 w-0"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 w-18 shrink-0">Gravity Scale</span>
            <input
              type="number"
              disabled
              value={physics.gravityScale}
              className="flex-1 editor-input-mono text-xs py-1 w-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
