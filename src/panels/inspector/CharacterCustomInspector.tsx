import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Heart, Play, Square } from 'lucide-react';
import type { EntityInstance } from '../../types';
import { readProjectSound } from '../../io/projectFolder';
import type { ProjectDirectoryHandle } from '../../io/projectFolder';
import { useSceneStore } from '../../store/sceneStore';
import type { CharacterRenderField } from '../../utils/entityCustomRenderSettings';

/** Reserve the same eye column for fields that have no viewport effect. */
function RenderVisibility({ uid, field, label }: { uid: string; field?: CharacterRenderField; label?: string }) {
  const settings = useSceneStore(s => s.customRenderSettings[uid]);
  const setFieldEnabled = useSceneStore(s => s.setCharacterRenderFieldEnabled);
  if (!field) return <span className="w-4 shrink-0" aria-hidden="true" />;
  const enabled = settings?.fields?.[field] !== false;
  return (
    <button
      type="button"
      aria-label={`Render ${label} in viewport`}
      aria-pressed={enabled}
      disabled={settings?.enabled === false}
      title={`${enabled ? 'Hide' : 'Show'} ${label} in viewport. Alt+click to apply to all characters.`}
      onClick={event => setFieldEnabled(uid, field, !enabled, event.altKey)}
      className="w-4 h-4 shrink-0 inline-flex items-center justify-center rounded-sm text-gray-400 enabled:hover:text-gray-200 enabled:hover:bg-gray-700 enabled:cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {enabled ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
    </button>
  );
}

/** One sound row: file name plus a Play/Stop button. */
function SoundRow({ label, fileName, rootHandle }: { label: string; fileName: string; rootHandle: ProjectDirectoryHandle | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPlaying(false);
  };

  // Stop when the row unmounts or points at another file.
  useEffect(() => stop, [fileName, rootHandle]);

  const toggle = async () => {
    if (playing) { stop(); return; }
    setError(null);
    if (!rootHandle) { setError('No project folder open'); return; }
    try {
      const file = await readProjectSound(rootHandle, fileName);
      if (!file) { setError('Not found in soundfx'); return; }
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onended = stop;
      audio.onerror = () => { setError('Cannot play file'); stop(); };
      audioRef.current = audio;
      urlRef.current = url;
      setPlaying(true);
      await audio.play();
    } catch {
      setError('Cannot play file');
      stop();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-4 shrink-0" aria-hidden="true" />
      <span className="text-xs text-gray-400 w-14 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 truncate text-[10px] text-gray-300 font-mono" title={error ?? fileName}>
        {fileName}
      </span>
      {error && <span className="text-[10px] text-amber-400 shrink-0">{error}</span>}
      <button
        type="button"
        onClick={toggle}
        title={playing ? 'Stop' : 'Play'}
        aria-label={`${playing ? 'Stop' : 'Play'} ${label} sound`}
        className="inspector-button editor-input shrink-0 text-[10px] px-2 py-1 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors"
      >
        {playing ? <Square size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
      </button>
    </div>
  );
}
import { ATTACK_MINIMUM_DISTANCE_COLOR, FIELD_OF_VIEW_COLOR } from '../../canvas/entityCustomRender';
import { getCharacterEntityInfo } from '../../utils/character';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

/** Custom Inspector for entities drawn from a `.character` file (customData `fileName`). */
export function CharacterCustomInspector({ entity }: { entity: EntityInstance }) {
  const characters = useSceneStore(s => s.projectCharacters);
  const items = useSceneStore(s => s.projectItems);
  const templateImageUrls = useSceneStore(s => s.templateImageUrls);
  const pingSprite = useSceneStore(s => s.pingSprite);
  const rootHandle = useSceneStore(s => s.rootHandle);
  const renderEnabled = useSceneStore(s => s.customRenderSettings[entity.editorEntityUID]?.enabled !== false);
  const setRenderEnabled = useSceneStore(s => s.setCustomRenderEnabled);
  const uid = entity.editorEntityUID;
  const info = getCharacterEntityInfo(entity, characters, items);
  // Hair is shown only when its sprite image was loaded from the project.
  const hairImageUrl = info?.hairSprite ? resolveImageUrl(templateImageUrls, info.hairSprite) : null;

  const eyeImageUrl = info?.eyeSprite ? resolveImageUrl(templateImageUrls, info.eyeSprite) : null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-400 font-semibold uppercase tracking-wider">
        Character
      </div>
      <label
        className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300"
        title="Render as Character. Alt+click to apply to all characters."
        onClick={event => {
          if (event.target instanceof HTMLInputElement) return;
          // Label activation forwards a synthetic input click without modifier keys.
          event.preventDefault();
          setRenderEnabled(uid, !renderEnabled, event.altKey);
        }}
      >
        <input
          type="checkbox"
          checked={renderEnabled}
          onChange={event => setRenderEnabled(uid, event.target.checked, (event.nativeEvent as MouseEvent).altKey)}
          className="w-3.5 h-3.5"
        />
        Render as Character
      </label>
      {!info ? (
        <div className="text-[11px] italic text-gray-500">No fileName in custom data</div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <RenderVisibility uid={uid} field="name" label="Name" />
            <span className="text-xs text-gray-400 w-14 shrink-0">Name</span>
            <span className="flex-1 min-w-0 truncate text-xs text-gray-200 font-semibold" title={info.name}>
              {info.name}
            </span>
          </div>
          {info.resistance !== null && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="resistance" label="Resistance" />
              <span className="text-xs text-gray-400 min-w-14 shrink-0">Resistance</span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-200" aria-label={`${info.resistance} resistance, ${info.resistance / 20} hearts`}>
                {info.resistance} · x{info.resistance / 20}
                <Heart size={12} fill="currentColor" aria-hidden="true" />
              </span>
            </div>
          )}
          {([
            ['Level', info.level],
            ['Speed', info.speed],
            ['Jump Impulse', info.jumpImpulse],
            ['Scale', info.scale],
          ] as const).map(([label, value]) => value !== null && (
            <div key={label} className="flex items-center gap-2">
              <RenderVisibility uid={uid} />
              <span className="text-xs text-gray-400 min-w-14 shrink-0">{label}</span>
              <span className="text-xs text-gray-200" aria-label={`${label}: ${value}`}>{value}</span>
            </div>
          ))}
          {info.attackMinimumDistance !== null && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="attackMinimumDistance" label="Attack Minimum Distance" />
              <span className="text-xs text-gray-400 shrink-0">Attack Minimum Distance</span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-200" aria-label={`Attack Minimum Distance: ${info.attackMinimumDistance}`}>
                {info.attackMinimumDistance}
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${ATTACK_MINIMUM_DISTANCE_COLOR.toString(16)}` }} aria-hidden="true" />
              </span>
            </div>
          )}
          {info.fieldOfView !== null && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="fieldOfView" label="Field of View" />
              <span className="text-xs text-gray-400 shrink-0">Field of View</span>
              <span
                className="inline-flex items-center gap-1 text-xs text-gray-200"
                aria-label={`Field of View: ${info.fieldOfView} degrees, ${info.fieldOfView * 2} degrees total`}
                title="Projected angle is twice fieldOfView. The guide has an illustrative radius of 80 scene units and scales with camera zoom; it shows the angle, not sight range. Angles of 360° or more are drawn as a full circle."
              >
                {info.fieldOfView}° ({info.fieldOfView * 2}° total)
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${FIELD_OF_VIEW_COLOR.toString(16)}` }} aria-hidden="true" />
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <RenderVisibility uid={uid} />
            <span className="text-xs text-gray-400 w-14 shrink-0">File</span>
            <span className="flex-1 min-w-0 truncate text-[10px] text-gray-300 font-mono" title={info.fileName}>
              {info.fileName}
            </span>
          </div>
          {!info.found && (
            <div className="text-[11px] text-amber-400">Character file not found in project</div>
          )}
          <div className="flex items-center gap-2">
            <RenderVisibility uid={uid} field="body" label="Body" />
            <span className="text-xs text-gray-400 w-14 shrink-0">Body</span>
            <button
              type="button"
              disabled={!info.bodySprite}
              onClick={() => info.bodySprite && pingSprite(info.bodySprite)}
              title={info.bodySprite ? 'Ping Sprite in Project Panel' : '(none)'}
              className="inspector-button flex-1 editor-input w-0 font-mono text-[10px] text-left truncate px-2 py-1 bg-gray-800 enabled:cursor-pointer enabled:hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-600 transition-colors"
            >
              {info.bodySprite || '(none)'}
            </button>
          </div>
          {info.bodyColor !== null && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="bodyColor" label="Color" />
              <span className="text-xs text-gray-400 w-14 shrink-0">Color</span>
              <span
                className="inline-block w-4 h-4 shrink-0 border border-gray-600"
                style={{ backgroundColor: `#${info.bodyColor.toString(16).padStart(6, '0')}` }}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0 truncate text-[10px] text-gray-300 font-mono" title="bodyColor (multiplied into Body)">
                #{info.bodyColor.toString(16).padStart(6, '0').toUpperCase()}
              </span>
            </div>
          )}
          {info.hairSprite && hairImageUrl && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="hair" label="Hair" />
              <span className="text-xs text-gray-400 w-14 shrink-0">Hair</span>
              <button
                type="button"
                onClick={() => info.hairSprite && pingSprite(info.hairSprite)}
                title={`${info.hairName} — Ping Sprite in Project Panel`}
                className="inspector-button flex-1 editor-input w-0 font-mono text-[10px] text-left truncate px-2 py-1 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors"
              >
                {info.hairSprite}
              </button>
            </div>
          )}
          {info.eyeSprite && eyeImageUrl && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="eyes" label="Eyes" />
              <span className="text-xs text-gray-400 w-14 shrink-0">Eyes</span>
              <button
                type="button"
                onClick={() => info.eyeSprite && pingSprite(info.eyeSprite)}
                title={`${info.eyeName} — Ping Sprite in Project Panel`}
                className="inspector-button flex-1 editor-input w-0 font-mono text-[10px] text-left truncate px-2 py-1 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors"
              >
                {info.eyeSprite}
              </button>
            </div>
          )}
          {info.eyeColor !== null && (
            <div className="flex items-center gap-2">
              <RenderVisibility uid={uid} field="eyeColor" label="Eye Color" />
              <span className="text-xs text-gray-400 w-14 shrink-0">Eye Color</span>
              <span
                className="inline-block w-4 h-4 shrink-0 border border-gray-600"
                style={{ backgroundColor: `#${info.eyeColor.toString(16).padStart(6, '0')}` }}
                aria-hidden="true"
              />
              <span className="flex-1 min-w-0 truncate text-[10px] text-gray-300 font-mono" title="eyeColor (multiplied into Eyes)">
                #{info.eyeColor.toString(16).padStart(6, '0').toUpperCase()}
              </span>
            </div>
          )}
          {info.equippedItems.map(item => {
            // Like hair, an item is shown only when its sprite image was loaded from the project.
            const itemImageUrl = item.sprite ? resolveImageUrl(templateImageUrls, item.sprite) : null;
            if (!item.sprite || !itemImageUrl) return null;
            const sprite = item.sprite;
            return (
              <div key={item.slot} className="flex items-center gap-2">
                <RenderVisibility uid={uid} field={`item:${item.slot}`} label={item.typeLabel} />
                <span className="text-xs text-gray-400 w-14 shrink-0">{item.typeLabel}</span>
                <button
                  type="button"
                  onClick={() => pingSprite(sprite)}
                  title={`${item.name ?? item.slot} — Ping Sprite in Project Panel`}
                  className="inspector-button flex-1 editor-input w-0 font-mono text-[10px] text-left truncate px-2 py-1 bg-gray-800 cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  {sprite}
                </button>
              </div>
            );
          })}
          {info.threatDetectedSound && <SoundRow label="Threat" fileName={info.threatDetectedSound} rootHandle={rootHandle} />}
          {info.confusedSound && <SoundRow label="Confused" fileName={info.confusedSound} rootHandle={rootHandle} />}
          {info.damageSound && <SoundRow label="Damage" fileName={info.damageSound} rootHandle={rootHandle} />}
        </>
      )}
    </div>
  );
}
