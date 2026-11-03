import React, { useRef, useState } from 'react';
import { formatNumber } from './inspectorFormatters';

export function AxisNumberInput({
  axis,
  badgeClass,
  value,
  onChange,
  onCommit,
  step = 1,
  min,
  max,
  precision,
  dragDelta,
  ariaLabel,
  title,
  disabled = false,
  readOnly = false,
}: {
  axis: string;
  badgeClass: string;
  value: number;
  onChange?: (val: number) => void;
  onCommit?: (val: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
  precision?: number;
  dragDelta?: number;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const isInactive = disabled || readOnly;
  const isInteractive = !isInactive && !!onChange;

  const dragStartRef = useRef<{ startX: number; startVal: number } | null>(null);
  const latestDragValRef = useRef<number>(value);
  const [isDragging, setIsDragging] = useState(false);

  const deltaStep = dragDelta ?? (typeof step === 'number' ? step : 1);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!isInteractive || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartRef.current = { startX: e.clientX, startVal: value };
    latestDragValRef.current = value;
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored if unsupported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragStartRef.current || !onChange) return;
    const pixelDiff = e.clientX - dragStartRef.current.startX;
    const steps = Math.round(pixelDiff / 4);
    let nextVal = dragStartRef.current.startVal + steps * deltaStep;
    if (min !== undefined) nextVal = Math.max(min, nextVal);
    if (max !== undefined) nextVal = Math.min(max, nextVal);
    const dec = precision ?? (deltaStep.toString().includes('.')
      ? deltaStep.toString().split('.')[1].length
      : 0);
    nextVal = Number(nextVal.toFixed(dec));
    latestDragValRef.current = nextVal;
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (dragStartRef.current) {
      dragStartRef.current = null;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignored if already released
      }
      onCommit?.(latestDragValRef.current);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (isInactive || !onChange) return;
    const stepVal = typeof step === 'number' ? step : deltaStep;
    const delta = e.deltaY < 0 ? stepVal : -stepVal;
    let nextVal = value + delta;
    if (min !== undefined) nextVal = Math.max(min, nextVal);
    if (max !== undefined) nextVal = Math.min(max, nextVal);
    const dec = precision ?? (typeof stepVal === 'number' && stepVal.toString().includes('.')
      ? stepVal.toString().split('.')[1].length
      : 0);
    nextVal = Number(nextVal.toFixed(dec));
    onChange(nextVal);
    onCommit?.(nextVal);
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

  const badgeDragClass = isInteractive
    ? 'cursor-ew-resize select-none active:opacity-75'
    : '';

  return (
    <div className={`axis-input-group ${stateClass} ${isDragging ? 'ring-1 ring-cyan-500/50' : ''}`} title={title}>
      <span
        className={`axis-badge ${badgeClass} ${badgeDragClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {axis}
      </span>
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
          const nextVal = Number.isFinite(parsed) ? parsed : 0;
          onChange(nextVal);
          onCommit?.(nextVal);
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

