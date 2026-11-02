import React from 'react';
import { formatNumber } from './inspectorFormatters';

export function AxisNumberInput({
  axis,
  badgeClass,
  value,
  onChange,
  step = 1,
  min,
  max,
  precision,
  ariaLabel,
  title,
  disabled = false,
  readOnly = false,
}: {
  axis: string;
  badgeClass: string;
  value: number;
  onChange?: (val: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
  precision?: number;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const isInactive = disabled || readOnly;

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (isInactive || !onChange) return;
    const stepVal = typeof step === 'number' ? step : 1;
    const delta = e.deltaY < 0 ? stepVal : -stepVal;
    let nextVal = value + delta;
    if (min !== undefined) nextVal = Math.max(min, nextVal);
    if (max !== undefined) nextVal = Math.min(max, nextVal);
    const dec = precision ?? (typeof stepVal === 'number' && stepVal.toString().includes('.')
      ? stepVal.toString().split('.')[1].length
      : 0);
    nextVal = Number(nextVal.toFixed(dec));
    onChange(nextVal);
  };

  const displayVal = Number.isFinite(value)
    ? (precision !== undefined ? formatNumber(value, precision) : value)
    : 0;

  const effectiveStep = isInactive && step === 1 ? 'any' : step;

  const stateClass = disabled
    ? 'opacity-70 cursor-not-allowed'
    : readOnly
    ? 'opacity-85 cursor-default'
    : '';

  return (
    <div className={`axis-input-group ${stateClass}`} title={title}>
      <span className={`axis-badge ${badgeClass}`}>{axis}</span>
      <input
        type="number"
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel || axis}
        value={displayVal}
        step={effectiveStep}
        min={min}
        max={max}
        onWheel={handleWheel}
        onChange={e => {
          if (isInactive || !onChange) return;
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className={`axis-number-input ${readOnly ? 'select-text cursor-default' : ''}`}
      />
    </div>
  );
}

export function CheckInput({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: {
  label: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const isInactive = disabled || readOnly;
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-75' : readOnly ? 'cursor-default opacity-85' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={e => {
          if (isInactive) return;
          onChange?.(e.target.checked);
        }}
        className="w-3.5 h-3.5 accent-gray-500"
      />
      <span className="text-xs text-gray-300">{label}</span>
    </label>
  );
}

