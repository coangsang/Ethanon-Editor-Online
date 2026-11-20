import { useState } from 'react';
import type { EntityInstance } from '../../types';
import { useSceneStore } from '../../store/sceneStore';
import { getCharacterEntityInfo } from '../../canvas/entityCustomRender';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

function SpritePreview({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = imageUrl !== null && failedUrl !== imageUrl;
  return (
    <div className="flex h-24 items-center justify-center overflow-hidden rounded border border-gray-700 bg-checkerboard">
      {showImage ? (
        <img
          src={imageUrl}
          alt={`${label} sprite`}
          onError={() => setFailedUrl(imageUrl)}
          className="max-h-full max-w-full object-contain pointer-events-none"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span className="text-[11px] italic text-gray-500">No sprite image</span>
      )}
    </div>
  );
}

/** Custom Inspector for entities drawn from a `.character` file (customData `fileName`). */
export function CharacterCustomInspector({ entity }: { entity: EntityInstance }) {
  const characters = useSceneStore(s => s.projectCharacters);
  const items = useSceneStore(s => s.projectItems);
  const templateImageUrls = useSceneStore(s => s.templateImageUrls);
  const pingSprite = useSceneStore(s => s.pingSprite);
  const info = getCharacterEntityInfo(entity, characters, items);
  const imageUrl = info?.bodySprite ? resolveImageUrl(templateImageUrls, info.bodySprite) : null;
  // Hair is shown only when its sprite image was loaded from the project.
  const hairImageUrl = info?.hairSprite ? resolveImageUrl(templateImageUrls, info.hairSprite) : null;

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
            <span className="text-xs text-gray-400 w-14 shrink-0">Sprite</span>
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
          {info.bodySprite && <SpritePreview key={imageUrl ?? ''} imageUrl={imageUrl} label={info.name} />}
          {info.hairSprite && hairImageUrl && (
            <>
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
              <SpritePreview key={hairImageUrl} imageUrl={hairImageUrl} label={`${info.name} hair`} />
            </>
          )}
          {info.equippedItems.map(item => {
            // Like hair, an item is shown only when its sprite image was loaded from the project.
            const itemImageUrl = item.sprite ? resolveImageUrl(templateImageUrls, item.sprite) : null;
            if (!item.sprite || !itemImageUrl) return null;
            const sprite = item.sprite;
            return (
              <div key={item.slot} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
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
                <SpritePreview key={itemImageUrl} imageUrl={itemImageUrl} label={`${info.name} ${item.typeLabel.toLowerCase()}`} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
