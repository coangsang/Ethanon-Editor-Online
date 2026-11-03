import { useState, useRef, useEffect } from 'react';
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
  if (!physics || physics.shape === 0) return null;

  const isReadOnly = readOnly || source === 'Template';

  const [localVals, setLocalVals] = useState({
    friction: physics.friction,
    density: physics.density,
    restitution: physics.restitution,
    gravityScale: physics.gravityScale,
  });

  const [sourceVals, setSourceVals] = useState({
    friction: physics.friction,
    density: physics.density,
    restitution: physics.restitution,
    gravityScale: physics.gravityScale,
  });

  if (
    sourceVals.friction !== physics.friction ||
    sourceVals.density !== physics.density ||
    sourceVals.restitution !== physics.restitution ||
    sourceVals.gravityScale !== physics.gravityScale
  ) {
    setSourceVals({
      friction: physics.friction,
      density: physics.density,
      restitution: physics.restitution,
      gravityScale: physics.gravityScale,
    });
    setLocalVals({
      friction: physics.friction,
      density: physics.density,
      restitution: physics.restitution,
      gravityScale: physics.gravityScale,
    });
  }

  const latestValsRef = useRef(localVals);
  useEffect(() => {
    latestValsRef.current = localVals;
  }, [localVals]);

  const handleNumberChange = (
    field: 'friction' | 'density' | 'restitution' | 'gravityScale',
    valueStr: string,
  ) => {
    if (isReadOnly || !onChange) return;
    const parsed = parseFloat(valueStr);
    const val = Number.isFinite(parsed) ? parsed : 0;
    const next = { ...latestValsRef.current, [field]: val };
    latestValsRef.current = next;
    setLocalVals(next);
    onChange({ [field]: val });
  };

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
              disabled={isReadOnly}
              value={localVals.friction}
              step="any"
              onChange={e => handleNumberChange('friction', e.target.value)}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Density</span>
            <input
              type="number"
              readOnly={isReadOnly}
              disabled={isReadOnly}
              value={localVals.density}
              step="any"
              onChange={e => handleNumberChange('density', e.target.value)}
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
              disabled={isReadOnly}
              value={localVals.restitution}
              step="any"
              onChange={e => handleNumberChange('restitution', e.target.value)}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Gravity Scale</span>
            <input
              type="number"
              readOnly={isReadOnly}
              disabled={isReadOnly}
              value={localVals.gravityScale}
              step="any"
              onChange={e => handleNumberChange('gravityScale', e.target.value)}
              className={`w-16 editor-input-mono text-xs py-1 ${isReadOnly ? 'select-text cursor-default opacity-85' : 'bg-gray-800'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
