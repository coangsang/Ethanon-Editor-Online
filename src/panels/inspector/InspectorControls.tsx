import React from 'react';

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
}) {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (disabled || !onChange) return;
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

  return (
    <div className={`axis-input-group ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`} title={title}>
      <span className={`axis-badge ${badgeClass}`}>{axis}</span>
      <input
        type="number"
        disabled={disabled}
        aria-label={ariaLabel || axis}
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onWheel={handleWheel}
        onChange={e => {
          if (disabled || !onChange) return;
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="axis-number-input"
      />
    </div>
  );
}

export function CheckInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="w-3.5 h-3.5 accent-gray-500"
      />
      <span className="text-xs text-gray-300">{label}</span>
    </label>
  );
}

