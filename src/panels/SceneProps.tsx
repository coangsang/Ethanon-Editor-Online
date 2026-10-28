import { useSceneStore } from '../store/sceneStore';
import { ColorControl } from '../components/ColorControl';
import './SceneProps.css';

function NumInput({ label, value, onChange, step = 0.1, min, max, onFocus, onBlur }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
  onFocus?: () => void; onBlur?: () => void;
}) {
  return (
    <div className="scene-property-row flex items-center gap-2">
      <span className="scene-property-label text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="scene-input flex-1 editor-input w-0"
      />
    </div>
  );
}

export function SceneProps() {
  const scene = useSceneStore(s => s.scene);
  const updateSceneProps = useSceneStore(s => s.updateSceneProps);
  const parallaxOrigin = useSceneStore(s => s.parallaxOriginNormalized);
  const parallaxPreviewActive = useSceneStore(s => s.parallaxPreviewActive);
  const setParallaxPreviewActive = useSceneStore(s => s.setParallaxPreviewActive);
  const p = scene.properties;

  return (
    <div className="scene-props-ui flex flex-col gap-1.5 px-3 py-2">
      <ColorControl
        label="Ambient Light"
        color={{ ...p.ambient, a: 1 }}
        showAlpha={false}
        onChange={({ r, g, b }) => updateSceneProps({ ambient: { r, g, b } })}
        onReset={() => updateSceneProps({ ambient: { r: 0.5, g: 0.5, b: 0.5 } })}
      />

      <div className="scene-section-title text-xs text-gray-500 mt-1 mb-0.5">Light</div>
      <NumInput label="Intensity" value={p.lightIntensity} step={0.1}
        onChange={v => updateSceneProps({ lightIntensity: v })} />

      <div className="scene-section-title text-xs text-gray-500 mt-2 mb-0.5 font-semibold text-indigo-400">Parallax Preview</div>

      <div className="scene-parallax-content flex flex-col gap-1 mt-1">
        <NumInput label="Parallax" value={p.parallaxIntensity} step={0.1}
          onFocus={() => setParallaxPreviewActive(true)}
          onBlur={() => setParallaxPreviewActive(false)}
          onChange={v => updateSceneProps({ parallaxIntensity: v })} />
        <div className="scene-preset-list flex flex-wrap items-center gap-1">
          <span className="scene-preset-label text-[10px] text-gray-500 mr-1 flex-shrink-0">Presets:</span>
          {[
            { label: 'Off (0.0)', val: 0.0 },
            { label: 'Std (1.0)', val: 1.0 },
            { label: 'Default (3.0)', val: 3.0 },
            { label: 'High (5.0)', val: 5.0 },
          ].map(item => (
            <button
              key={item.val}
              onClick={() => updateSceneProps({ parallaxIntensity: item.val })}
              className={`scene-preset-button flex-1 min-w-[36px] text-[10px] py-0.5 rounded border ${
                p.parallaxIntensity === item.val
                  ? 'scene-preset-active bg-indigo-600 text-white border-indigo-500 font-bold'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
              title={`Set Parallax Intensity = ${item.val}`}
            >
              {item.val}
            </button>
          ))}
        </div>
        <div className="scene-help-text text-[10px] text-gray-500 italic mt-0.5 leading-tight">
          Per-vertex offset uses Z, global intensity, template intensity, and preview origin.
        </div>
        <div className="scene-status-text text-[10px] text-gray-500 leading-tight">
          Origin {Math.round(parallaxOrigin.x * 100)}%, {Math.round(parallaxOrigin.y * 100)}%
          {parallaxPreviewActive ? ' - move mouse over viewport' : ' - focus Parallax to preview'}
        </div>
      </div>

      <div className="scene-section-title text-xs text-gray-500 mt-2 mb-0.5">Z-Axis Direction (saved for compatibility)</div>
      <NumInput label="Dir X" value={p.zAxisDirection.x} step={0.1}
        onChange={v => updateSceneProps({ zAxisDirection: { ...p.zAxisDirection, x: v } })} />
      <NumInput label="Dir Y" value={p.zAxisDirection.y} step={0.1}
        onChange={v => updateSceneProps({ zAxisDirection: { ...p.zAxisDirection, y: v } })} />
    </div>
  );
}
