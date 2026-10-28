import { useState } from 'react';

export type EditorColor = { r: number; g: number; b: number; a: number };

function floatToHex(r: number, g: number, b: number): string {
  const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value * 255)));
  return `#${[r, g, b].map(value => clampByte(value).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): Pick<EditorColor, 'r' | 'g' | 'b'> {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: Number((((value >> 16) & 255) / 255).toFixed(4)),
    g: Number((((value >> 8) & 255) / 255).toFixed(4)),
    b: Number(((value & 255) / 255).toFixed(4)),
  };
}

const PRESETS: Array<{ label: string; color: EditorColor }> = [
  { label: 'White', color: { r: 1, g: 1, b: 1, a: 1 } },
  { label: 'Red', color: { r: 1, g: 0, b: 0, a: 1 } },
  { label: 'Green', color: { r: 0, g: 1, b: 0, a: 1 } },
  { label: 'Blue', color: { r: 0, g: 0.4, b: 1, a: 1 } },
  { label: 'Yellow', color: { r: 1, g: 0.9, b: 0, a: 1 } },
  { label: 'Magenta', color: { r: 1, g: 0.2, b: 0.8, a: 1 } },
  { label: 'Cyan', color: { r: 0, g: 0.9, b: 1, a: 1 } },
  { label: 'Dark', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } },
];

export function ColorControl({
  label,
  color,
  onChange,
  onReset,
  showAlpha = true,
}: {
  label: string;
  color: EditorColor;
  onChange: (color: EditorColor) => void;
  onReset?: () => void;
  showAlpha?: boolean;
}) {
  const [mode, setMode] = useState<'float' | 'byte'>('float');
  const hexValue = floatToHex(color.r, color.g, color.b);
  const rgbaCss = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
  const channels = showAlpha ? (['r', 'g', 'b', 'a'] as const) : (['r', 'g', 'b'] as const);

  const updateChannel = (channel: keyof EditorColor, value: number) => {
    const normalized = mode === 'byte' ? Number((value / 255).toFixed(4)) : value;
    onChange({ ...color, [channel]: Math.max(0, Math.min(1, normalized)) });
  };

  return (
    <div className="color-control inspector-subsection flex flex-col gap-2 rounded border border-gray-800 bg-gray-950/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="color-control-title min-w-0 truncate text-xs text-gray-300 font-medium" title={label}>{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode(mode === 'float' ? 'byte' : 'float')}
            className="color-control-button inspector-button rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
            title="Toggle between float (0..1) and 8-bit byte (0..255) display"
          >
            {mode === 'float' ? '0.0 - 1.0' : '0 - 255'}
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="color-control-button inspector-button rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              title={`Reset ${label}`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="color-control-preview relative shrink-0 w-8 h-8 rounded border border-gray-700 overflow-hidden shadow-inner bg-checkerboard cursor-pointer group" title="Click to open color picker">
          <div className="w-full h-full" style={{ backgroundColor: rgbaCss }} />
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={hexValue}
            onChange={event => onChange({ ...color, ...hexToRgb(event.target.value) })}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>

        {showAlpha && (
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-[10px] text-gray-400">
              <span>Alpha / Opacity</span>
              <span className="font-mono">{mode === 'float' ? color.a.toFixed(2) : Math.round(color.a * 255)}</span>
            </div>
            <input
              type="range"
              aria-label={`${label} alpha`}
              min={0}
              max={1}
              step={0.01}
              value={color.a}
              onChange={event => onChange({ ...color, a: Number.parseFloat(event.target.value) || 0 })}
              className="w-full h-1.5 accent-indigo-500 bg-gray-800 rounded appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      <div className={`color-control-channels grid gap-1 ${showAlpha ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {channels.map(channel => {
          const value = color[channel];
          const displayValue = mode === 'byte' ? Math.round(value * 255) : value;
          const step = mode === 'byte' ? 1 : 0.05;
          const max = mode === 'byte' ? 255 : 1;

          return (
            <label key={channel} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">{channel}</span>
              <input
                type="number"
                aria-label={`${label} ${channel.toUpperCase()}`}
                value={displayValue}
                step={step}
                min={0}
                max={max}
                onWheel={event => {
                  if (document.activeElement !== event.currentTarget) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? step : -step;
                  let next = Math.max(0, Math.min(max, displayValue + delta));
                  if (mode === 'float') next = Number(next.toFixed(3));
                  updateChannel(channel, next);
                }}
                onChange={event => updateChannel(channel, Number.parseFloat(event.target.value) || 0)}
                className="color-control-input editor-input-mono"
              />
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            type="button"
            aria-label={`${label}: ${preset.label}`}
            onClick={() => onChange({ ...preset.color, a: showAlpha ? preset.color.a : color.a })}
            title={preset.label}
            className="color-control-swatch inspector-swatch w-4 h-4 rounded border border-gray-700 cursor-pointer"
            style={{ backgroundColor: floatToHex(preset.color.r, preset.color.g, preset.color.b) }}
          />
        ))}
      </div>
    </div>
  );
}
