import { useMemo, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { ViewModeToggle } from '../components/ViewModeToggle';

const ACTIVE_PREFAB_VIEW_MODE_KEY = 'ethanon_prefab_view_mode';

function getSavedPrefabViewMode(): 'grid' | 'list' {
  const saved = localStorage.getItem(ACTIVE_PREFAB_VIEW_MODE_KEY);
  return saved === 'list' || saved === 'grid' ? saved : 'grid';
}

export function PrefabList() {
  const projectName = useSceneStore(s => s.projectName);
  const projectPrefabs = useSceneStore(s => s.projectPrefabs);
  const placingPrefab = useSceneStore(s => s.placingPrefab);
  const setPlacingPrefab = useSceneStore(s => s.setPlacingPrefab);
  const prefabThumbnailUrls = useSceneStore(s => s.prefabThumbnailUrls);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(getSavedPrefabViewMode);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(ACTIVE_PREFAB_VIEW_MODE_KEY, mode);
  };

  const filteredPrefabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projectPrefabs;

    return projectPrefabs.filter(prefab => {
      if (prefab.name.toLowerCase().includes(query)) return true;
      return prefab.entities.some(
        e =>
          (e.entityName && e.entityName.toLowerCase().includes(query)) ||
          (e.editorEntityName && e.editorEntityName.toLowerCase().includes(query))
      );
    });
  }, [projectPrefabs, searchQuery]);

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-[#a2a5aa]">
        No project open
      </div>
    );
  }

  if (projectPrefabs.length === 0) {
    return (
      <div className="project-empty-state flex h-full flex-col items-center justify-center px-4 text-center text-xs text-[#a2a5aa] gap-1.5">
        <span>
          No prefabs in <code className="text-[#eceeef] font-mono px-1 py-0.5 bg-[#292a2d] rounded border border-[#46484d]">/prefabs</code>
        </span>
        <span className="text-[11px] text-[#a2a5aa]">
          Select an entity in Inspector &amp; click &quot;Prefab&quot; to export
        </span>
      </div>
    );
  }

  return (
    <div className="prefab-list-ui flex flex-col h-full bg-[#252629] select-none">
      {/* Header bar */}
      <div className="asset-list-header px-3 py-1.5 min-h-[34px] border-b border-[#46484d] bg-[#2c2d30] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter prefabs (.prf)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="asset-list-search editor-input bg-[#303135] border-[#46484d] text-[#eceeef] placeholder-[#a2a5aa] focus:border-[#d2d5db] w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle mode={viewMode} onChange={handleSetViewMode} />
        </div>
      </div>

      {/* Content list / grid */}
      <div className="project-resource-list flex-1 overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar">
        {filteredPrefabs.length === 0 ? (
          <div className="px-3 py-6 text-xs text-[#a2a5aa] text-center italic">
            No matching prefabs found
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-2 grid-auto-scenes">
            {filteredPrefabs.map(prefabEntry => {
              const isPlacing = placingPrefab?.name === prefabEntry.name;
              const thumbnailUrl = prefabThumbnailUrls[prefabEntry.name];
              const cleanName = prefabEntry.name.endsWith('.prf')
                ? prefabEntry.name.slice(0, -4)
                : prefabEntry.name;

              return (
                <button
                  key={prefabEntry.name}
                  type="button"
                  onClick={() => {
                    if (isPlacing) {
                      setPlacingPrefab(null);
                    } else {
                      setPlacingPrefab({
                        name: prefabEntry.name,
                        entities: prefabEntry.entities,
                      });
                    }
                  }}
                  title={
                    isPlacing
                      ? 'Click to cancel placing'
                      : `Click to place ${prefabEntry.name} on Canvas`
                  }
                  className={`project-resource-card flex min-w-0 items-center gap-2 rounded border px-2.5 py-2 text-left transition-colors ${
                    isPlacing
                      ? 'project-resource-card-active border-[#bec1c5] bg-[#4b4d52] text-[#eceeef] ring-1 ring-[#d2d5db]/50'
                      : 'border-[#46484d] bg-[#2b2c2f] text-[#eceeef] hover:border-[#bec1c5] hover:bg-[#37393d]'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                      isPlacing
                        ? 'border-[#bec1c5] bg-[#303135]'
                        : 'border-[#46484d] bg-[#202124]'
                    }`}
                  >
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={prefabEntry.name}
                        className="h-full w-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    ) : (
                      <svg
                        className="w-5 h-5 text-[#bec1c5]"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="10" height="10" rx="1.5" />
                        <path d="M3 8h10M8 3v10" />
                      </svg>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[#eceeef]">
                      {cleanName}
                    </span>
                    <span className="block text-[10px] text-[#bec1c5] font-mono">
                      {prefabEntry.entities.length}{' '}
                      {prefabEntry.entities.length === 1 ? 'entity' : 'entities'}
                    </span>
                  </span>
                  {isPlacing && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#bec1c5] bg-[#303135] text-[#eceeef]">
                      Placing
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredPrefabs.map(prefabEntry => {
              const isPlacing = placingPrefab?.name === prefabEntry.name;
              const thumbnailUrl = prefabThumbnailUrls[prefabEntry.name];
              const cleanName = prefabEntry.name.endsWith('.prf')
                ? prefabEntry.name.slice(0, -4)
                : prefabEntry.name;

              return (
                <button
                  key={prefabEntry.name}
                  type="button"
                  onClick={() => {
                    if (isPlacing) {
                      setPlacingPrefab(null);
                    } else {
                      setPlacingPrefab({
                        name: prefabEntry.name,
                        entities: prefabEntry.entities,
                      });
                    }
                  }}
                  title={
                    isPlacing
                      ? 'Click to cancel placing'
                      : `Click to place ${prefabEntry.name} on Canvas`
                  }
                  className={`project-resource-card flex min-w-0 items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left transition-colors ${
                    isPlacing
                      ? 'project-resource-card-active border-[#bec1c5] bg-[#4b4d52] text-[#eceeef] ring-1 ring-[#d2d5db]/50'
                      : 'border-[#46484d] bg-[#2b2c2f] text-[#eceeef] hover:border-[#bec1c5] hover:bg-[#37393d]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                        isPlacing
                          ? 'border-[#bec1c5] bg-[#303135]'
                          : 'border-[#46484d] bg-[#202124]'
                      }`}
                    >
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={prefabEntry.name}
                          className="h-full w-full object-cover pointer-events-none"
                          draggable={false}
                        />
                      ) : (
                        <svg
                          className="w-4 h-4 text-[#bec1c5]"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="3" y="3" width="10" height="10" rx="1.5" />
                          <path d="M3 8h10M8 3v10" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-xs text-[#eceeef] truncate font-medium">
                        {cleanName}
                      </span>
                      <span className="text-[10px] text-[#bec1c5] font-mono px-1 py-0.2 bg-[#292a2d] rounded border border-[#46484d]">
                        .prf
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-[#bec1c5] font-mono px-1.5 py-0.5 rounded border border-[#46484d] bg-[#292a2d]">
                      {prefabEntry.entities.length}{' '}
                      {prefabEntry.entities.length === 1 ? 'entity' : 'entities'}
                    </span>
                    {isPlacing && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#bec1c5] bg-[#303135] text-[#eceeef]">
                        Placing
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
