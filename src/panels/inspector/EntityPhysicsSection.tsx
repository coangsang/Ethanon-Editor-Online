import type { EntityTemplate } from '../../types';
import { CheckInput } from './InspectorControls';

export function EntityPhysicsSection({
  template,
  source,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
}) {
  const physics = template.physics;
  if (!physics) return null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-500 mb-0.5 flex items-center justify-between">
        <span>Physics</span>
        {source && (
          <span className="text-[10px] rounded bg-cyan-950/70 px-1.5 py-0.5 text-cyan-300 font-normal">
            {source}
          </span>
        )}
      </div>

      {/* Body Properties */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
        <CheckInput label="Static" value={physics.static} readOnly />
        <CheckInput label="Sensor" value={physics.sensor} readOnly />
        <CheckInput label="Bullet (CCD)" value={physics.bullet} readOnly />
        <CheckInput label="Fixed Rotation" value={physics.fixedRotation} readOnly />
      </div>

      {/* Material & Gravity Parameters with Read-Only inputs */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Friction</span>
            <input
              type="number"
              readOnly
              value={physics.friction}
              step="any"
              className="w-16 editor-input-mono text-xs py-1 select-text cursor-default"
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Density</span>
            <input
              type="number"
              readOnly
              value={physics.density}
              step="any"
              className="w-16 editor-input-mono text-xs py-1 select-text cursor-default"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Restitution</span>
            <input
              type="number"
              readOnly
              value={physics.restitution}
              step="any"
              className="w-16 editor-input-mono text-xs py-1 select-text cursor-default"
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Gravity Scale</span>
            <input
              type="number"
              readOnly
              value={physics.gravityScale}
              step="any"
              className="w-16 editor-input-mono text-xs py-1 select-text cursor-default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
