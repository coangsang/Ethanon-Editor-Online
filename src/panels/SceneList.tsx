import { useMemo, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { ViewModeToggle } from '../components/ViewModeToggle';

const ACTIVE_SCENE_VIEW_MODE_KEY = 'ethanon_scene_view_mode';

function getSavedSceneViewMode(): 'grid' | 'list' {
  const saved = localStorage.getItem(ACTIVE_SCENE_VIEW_MODE_KEY);
  return saved === 'list' || saved === 'grid' ? saved : 'grid';
}

export function SceneList() {
  const projectName = useSceneStore(s => s.projectName);
  const projectScenes = useSceneStore(s => s.projectScenes);
  const activeSceneName = useSceneStore(s => s.activeSceneName);
  const projectStatus = useSceneStore(s => s.projectStatus);
  const openProjectScene = useSceneStore(s => s.openProjectScene);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(getSavedSceneViewMode);
  const [searchQuery, setSearchQuery] = useState('');

  const projectBusy = projectStatus === 'loading' || projectStatus === 'saving';

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(ACTIVE_SCENE_VIEW_MODE_KEY, mode);
  };

  const filteredScenes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projectScenes;
    return projectScenes.filter(scene =>
      scene.name.toLowerCase().includes(query)
    );
  }, [projectScenes, searchQuery]);

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-[#a2a5aa]">
        No project open
      </div>
    );
  }

  if (projectScenes.length === 0) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-[#a2a5aa]">
        No scenes in project
      </div>
    );
  }

  return (
    <div className="scene-list-ui flex flex-col h-full bg-[#252629] select-none">
      {/* Header bar */}
      <div className="asset-list-header px-3 py-1.5 min-h-[34px] border-b border-[#46484d] bg-[#2c2d30] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter scenes (.esc)..."
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
        {filteredScenes.length === 0 ? (
          <div className="px-3 py-6 text-xs text-[#a2a5aa] text-center italic">
            No matching scenes found
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-2 grid-auto-scenes">
            {filteredScenes.map(sceneEntry => {
              const isActive = activeSceneName === sceneEntry.name;
              const cleanName = sceneEntry.name.endsWith('.esc')
                ? sceneEntry.name.slice(0, -4)
                : sceneEntry.name;

              return (
                <button
                  key={sceneEntry.name}
                  type="button"
                  disabled={projectBusy || isActive}
                  onClick={() => void openProjectScene(sceneEntry.name)}
                  title={isActive ? `${sceneEntry.name} is active` : `Open ${sceneEntry.name}`}
                  className={`project-resource-card flex min-w-0 items-center gap-2 rounded border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? 'project-resource-card-active border-[#bec1c5] bg-[#4b4d52] text-[#eceeef] ring-1 ring-[#d2d5db]/50'
                      : projectBusy
                      ? 'project-resource-card-disabled cursor-not-allowed border-[#393b3f] bg-[#292a2d] text-[#a2a5aa]'
                      : 'border-[#46484d] bg-[#2b2c2f] text-[#eceeef] hover:border-[#bec1c5] hover:bg-[#37393d]'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                      isActive
                        ? 'border-[#bec1c5] bg-[#303135]'
                        : 'border-[#46484d] bg-[#202124]'
                    }`}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}app-icon.png`}
                      alt="Scene"
                      className="h-full w-full object-contain pointer-events-none"
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[#eceeef]">
                      {cleanName}
                    </span>
                    <span className="block truncate text-[10px] text-[#bec1c5] font-mono">
                      .esc
                    </span>
                  </span>
                  {isActive && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#bec1c5] bg-[#303135] text-[#eceeef]">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredScenes.map(sceneEntry => {
              const isActive = activeSceneName === sceneEntry.name;
              const cleanName = sceneEntry.name.endsWith('.esc')
                ? sceneEntry.name.slice(0, -4)
                : sceneEntry.name;

              return (
                <button
                  key={sceneEntry.name}
                  type="button"
                  disabled={projectBusy || isActive}
                  onClick={() => void openProjectScene(sceneEntry.name)}
                  title={isActive ? `${sceneEntry.name} is active` : `Open ${sceneEntry.name}`}
                  className={`project-resource-card flex min-w-0 items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left transition-colors ${
                    isActive
                      ? 'project-resource-card-active border-[#bec1c5] bg-[#4b4d52] text-[#eceeef] ring-1 ring-[#d2d5db]/50'
                      : projectBusy
                      ? 'project-resource-card-disabled cursor-not-allowed border-[#393b3f] bg-[#292a2d] text-[#a2a5aa]'
                      : 'border-[#46484d] bg-[#2b2c2f] text-[#eceeef] hover:border-[#bec1c5] hover:bg-[#37393d]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                        isActive
                          ? 'border-[#bec1c5] bg-[#303135]'
                          : 'border-[#46484d] bg-[#202124]'
                      }`}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}app-icon.png`}
                        alt="Scene"
                        className="h-full w-full object-contain pointer-events-none"
                      />
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-xs text-[#eceeef] truncate font-medium">
                        {cleanName}
                      </span>
                      <span className="text-[10px] text-[#bec1c5] font-mono px-1 py-0.2 bg-[#292a2d] rounded border border-[#46484d]">
                        .esc
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#bec1c5] bg-[#303135] text-[#eceeef]">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#a2a5aa] font-mono hidden sm:inline">
                        Click to open
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

