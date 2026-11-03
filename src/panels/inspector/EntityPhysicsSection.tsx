import { useState } from 'react';
import type { EntityPhysicsConfig, EntityTemplate } from '../../types';
import { CheckInput } from './InspectorControls';

export function EntityPhysicsSection({
  template,
  source,
  readOnly = false,
  onChange,
}: {
  template: EntityTemplate;
  source?: 'Template' | 'Inline';
  readOnly?: boolean;
  onChange?: (patch: Partial<EntityPhysicsConfig>) => void;
}) {
  const physics = template.physics;
  const isReadOnly = readOnly || source === 'Template';

  const [drafts, setDrafts] = useState({
    friction: String(physics?.friction ?? 1),
    density: String(physics?.density ?? 1),
    restitution: String(physics?.restitution ?? 0),
    gravityScale: String(physics?.gravityScale ?? 1),
  });

  const [sourceVals, setSourceVals] = useState({
    friction: physics?.friction,
    density: physics?.density,
    restitution: physics?.restitution,
    gravityScale: physics?.gravityScale,
  });

  if (
    physics && (
      sourceVals.friction !== physics.friction ||
      sourceVals.density !== physics.density ||
      sourceVals.restitution !== physics.restitution ||
      sourceVals.gravityScale !== physics.gravityScale
    )
  ) {
    setSourceVals({
      friction: physics.friction,
      density: physics.density,
      restitution: physics.restitution,
      gravityScale: physics.gravityScale,
    });
    setDrafts({
      friction: String(physics.friction),
      density: String(physics.density),
      restitution: String(physics.restitution),
      gravityScale: String(physics.gravityScale),
    });
  }

  const handleNumberChange = (
    field: 'friction' | 'density' | 'restitution' | 'gravityScale',
    valueStr: string,
  ) => {
    if (isReadOnly || !onChange) return;
    setDrafts(prev => ({ ...prev, [field]: valueStr }));
    const parsed = parseFloat(valueStr);
    if (Number.isFinite(parsed)) {
      onChange({ [field]: parsed });
    }
  };

  const handleBlur = (
    field: 'friction' | 'density' | 'restitution' | 'gravityScale',
  ) => {
    if (!physics) return;
    const current = drafts[field];
    const parsed = parseFloat(current);
    if (!Number.isFinite(parsed)) {
      setDrafts(prev => ({ ...prev, [field]: String(physics[field]) }));
    }
  };

  if (!physics || physics.shape === 0) return null;

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
        <CheckInput
          label="Static"
          value={physics.static}
          readOnly={isReadOnly}
          onChange={v => !isReadOnly && onChange?.({ static: v })}
        />
        <CheckInput
          label="Sensor"
          value={physics.sensor}
          readOnly={isReadOnly}
          onChange={v => !isReadOnly && onChange?.({ sensor: v })}
        />
        <CheckInput
          label="Bullet (CCD)"
          value={physics.bullet}
          readOnly={isReadOnly}
          onChange={v => !isReadOnly && onChange?.({ bullet: v })}
        />
        <CheckInput
          label="Fixed Rotation"
          value={physics.fixedRotation}
          readOnly={isReadOnly}
          onChange={v => !isReadOnly && onChange?.({ fixedRotation: v })}
        />
      </div>

      {/* Material & Gravity Parameters */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-800">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Friction</span>
            <input
              type="number"
              readOnly={isReadOnly}
              value={drafts.friction}
              step="any"
              onChange={e => handleNumberChange('friction', e.target.value)}
              onBlur={() => handleBlur('friction')}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Density</span>
            <input
              type="number"
              readOnly={isReadOnly}
              value={drafts.density}
              step="any"
              onChange={e => handleNumberChange('density', e.target.value)}
              onBlur={() => handleBlur('density')}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Restitution</span>
            <input
              type="number"
              readOnly={isReadOnly}
              value={drafts.restitution}
              step="any"
              onChange={e => handleNumberChange('restitution', e.target.value)}
              onBlur={() => handleBlur('restitution')}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Gravity Scale</span>
            <input
              type="number"
              readOnly={isReadOnly}
              value={drafts.gravityScale}
              step="any"
              onChange={e => handleNumberChange('gravityScale', e.target.value)}
              onBlur={() => handleBlur('gravityScale')}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
