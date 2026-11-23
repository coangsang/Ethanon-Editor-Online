import type { EntityInstance } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { getCharacterEntityInfo } from '../../canvas/entityCustomRender';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

/** Custom Inspector for entities drawn from a `.character` file (customData `fileName`). */
export function CharacterCustomInspector({ entity }: { entity: EntityInstance }) {
  const characters = useSceneStore(s => s.projectCharacters);
  const items = useSceneStore(s => s.projectItems);
  const templateImageUrls = useSceneStore(s => s.templateImageUrls);
  const pingSprite = useSceneStore(s => s.pingSprite);
  const info = getCharacterEntityInfo(entity, characters, items);
  // Hair is shown only when its sprite image was loaded from the project.
  const hairImageUrl = info?.hairSprite ? resolveImageUrl(templateImageUrls, info.hairSprite) : null;

  const eyeImageUrl = info?.eyeSprite ? resolveImageUrl(templateImageUrls, info.eyeSprite) : null;

  return (
    <div className="inspector-section px-3 py-2 flex flex-col gap-2 border-b border-gray-700">
      <div className="inspector-section-title text-xs text-gray-400 font-semibold uppercase tracking-wider">
        Character
      </div>
      {!info ? (
        <div className="text-[11px] italic text-gray-500">No fileName in custom data</div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14 shrink-0">Name</span>
            <span className="flex-1 min-w-0 truncate text-xs text-gray-200 font-semibold" title={info.name}>
              {info.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14 shrink-0">File</span>
            <span className="flex-1 min-w-0 truncate text-[10px] text-gray-300 font-mono" title={info.fileName}>
              {info.fileName}
            </span>
          </div>
          {!info.found && (
            <div className="text-[11px] text-amber-400">Character file not found in project</div>
          )}
          <div className="flex items-center gap-2">
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
          {info.equippedItems.map(item => {
            // Like hair, an item is shown only when its sprite image was loaded from the project.
            const itemImageUrl = item.sprite ? resolveImageUrl(templateImageUrls, item.sprite) : null;
            if (!item.sprite || !itemImageUrl) return null;
            const sprite = item.sprite;
            return (
              <div key={item.slot} className="flex items-center gap-2">
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
        </>
      )}
    </div>
  );
}
