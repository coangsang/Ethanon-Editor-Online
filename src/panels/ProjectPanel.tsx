import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useSceneStore } from '../store/sceneStore';
import { EntityList } from './EntityList';
import { SpriteList } from './SpriteList';

const ACTIVE_PROJECT_ITEM_KEY = 'ethanon_project_active_item';

type ProjectItem = 'scenes' | 'entities' | 'sprites' | 'prefabs';

interface ProjectPanelProps {
  onToggleCollapse?: () => void;
}

function getSavedProjectItem(): ProjectItem {
  const saved = localStorage.getItem(ACTIVE_PROJECT_ITEM_KEY);
  return saved === 'scenes' || saved === 'entities' || saved === 'sprites' || saved === 'prefabs' ? saved : 'entities';
}

function ProjectTab({
  item,
  activeItem,
  label,
  count,
  onSelect,
}: {
  item: ProjectItem;
  activeItem: ProjectItem;
  label: string;
  count: number;
  onSelect: (item: ProjectItem) => void;
}) {
  const isActive = activeItem === item;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={isActive}
      className={`project-tab flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'border-indigo-500 bg-gray-800 text-gray-100'
          : 'border-transparent text-gray-500 hover:bg-gray-800/70 hover:text-gray-300'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
        isActive ? 'bg-gray-900 text-indigo-300' : 'bg-gray-800/80 text-gray-500'
      }`}>
        {count}
      </span>
    </button>
  );
}

function ScenesView() {
  const projectName = useSceneStore(s => s.projectName);
  const projectScenes = useSceneStore(s => s.projectScenes);
  const activeSceneName = useSceneStore(s => s.activeSceneName);
  const projectStatus = useSceneStore(s => s.projectStatus);
  const openProjectScene = useSceneStore(s => s.openProjectScene);

  const projectBusy = projectStatus === 'loading' || projectStatus === 'saving';

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
        No project open
      </div>
    );
  }

  if (projectScenes.length === 0) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
        No scenes in project
      </div>
    );
  }

  return (
    <div className="project-resource-list h-full overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar">
      <div className="grid gap-2 grid-auto-scenes">
        {projectScenes.map(sceneEntry => {
          const isActive = activeSceneName === sceneEntry.name;

          return (
            <button
              key={sceneEntry.name}
              type="button"
              disabled={projectBusy || isActive}
              onClick={() => void openProjectScene(sceneEntry.name)}
              title={isActive ? `${sceneEntry.name} is active` : `Open ${sceneEntry.name}`}
              className={`project-resource-card flex min-w-0 items-center gap-2 rounded border px-2.5 py-2 text-left transition-colors ${
                isActive
                  ? 'project-resource-card-active border-indigo-500 bg-indigo-950/70 text-white'
                  : projectBusy
                  ? 'project-resource-card-disabled cursor-not-allowed border-gray-800 bg-gray-900/60 text-gray-600'
                  : 'border-gray-800 bg-gray-800/40 text-gray-200 hover:border-gray-600 hover:bg-gray-700/60'
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                isActive
                  ? 'border-indigo-500/70 bg-indigo-900/70'
                  : 'border-gray-700 bg-gray-900'
              }`}>
                <img
                  src={`${import.meta.env.BASE_URL}app-icon.png`}
                  alt="Scene"
                  className="h-full w-full object-contain pointer-events-none"
                />
              </div>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {sceneEntry.name.endsWith('.esc') ? sceneEntry.name.slice(0, -4) : sceneEntry.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrefabsView() {
  const projectName = useSceneStore(s => s.projectName);
  const projectPrefabs = useSceneStore(s => s.projectPrefabs);
  const placingPrefab = useSceneStore(s => s.placingPrefab);
  const setPlacingPrefab = useSceneStore(s => s.setPlacingPrefab);
  const prefabThumbnailUrls = useSceneStore(s => s.prefabThumbnailUrls);

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
        No project open
      </div>
    );
  }

  if (projectPrefabs.length === 0) {
    return (
      <div className="project-empty-state flex h-full flex-col items-center justify-center px-4 text-center text-xs text-gray-500 gap-1.5">
        <span>No prefabs in <code className="text-cyan-400 font-mono">/prefabs</code></span>
        <span className="text-[11px] text-gray-600">Select an entity in Inspector &amp; click "Prefab" to export</span>
      </div>
    );
  }

  return (
    <div className="project-resource-list h-full overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar">
      <div className="grid gap-2 grid-auto-scenes">
        {projectPrefabs.map(prefabEntry => {
          const isPlacing = placingPrefab?.name === prefabEntry.name;
          const thumbnailUrl = prefabThumbnailUrls[prefabEntry.name];

          return (
            <button
              key={prefabEntry.name}
              type="button"
              onClick={() => {
                if (isPlacing) {
                  setPlacingPrefab(null);
                } else {
                  setPlacingPrefab({ name: prefabEntry.name, entities: prefabEntry.entities });
                }
              }}
              title={isPlacing ? 'Click to cancel placing' : `Click to place ${prefabEntry.name} on Canvas`}
              className={`project-resource-card flex min-w-0 items-center gap-2 rounded border px-2.5 py-2 text-left transition-colors ${
                isPlacing
                  ? 'project-resource-card-active border-cyan-500 bg-cyan-950/70 text-cyan-100 outline outline-1 outline-cyan-400'
                  : 'border-gray-800 bg-gray-800/40 text-gray-200 hover:border-gray-600 hover:bg-gray-700/60'
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border overflow-hidden p-0.5 ${
                isPlacing
                  ? 'border-cyan-500/70 bg-cyan-900/70'
                  : 'border-gray-700 bg-gray-900'
              }`}>
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={prefabEntry.name}
                    className="h-full w-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="10" height="10" rx="1.5" />
                    <path d="M3 8h10M8 3v10" />
                  </svg>
                )}
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {prefabEntry.name.endsWith('.prf') ? prefabEntry.name.slice(0, -4) : prefabEntry.name}
                </span>
                <span className="block text-[10px] text-gray-500 font-mono">
                  {prefabEntry.entities.length} {prefabEntry.entities.length === 1 ? 'entity' : 'entities'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectPanel({ onToggleCollapse }: ProjectPanelProps) {
  const projectName = useSceneStore(s => s.projectName);
  const projectStatus = useSceneStore(s => s.projectStatus);
  const refreshProject = useSceneStore(s => s.refreshProject);
  const projectScenes = useSceneStore(s => s.projectScenes);
  const projectPrefabs = useSceneStore(s => s.projectPrefabs);
  const templates = useSceneStore(s => s.templates);
  const projectSprites = useSceneStore(s => s.projectSprites);
  const activeSceneName = useSceneStore(s => s.activeSceneName);
  const [activeItem, setActiveItem] = useState<ProjectItem>(getSavedProjectItem);

  const isRefreshing = projectStatus === 'loading';

  const handleSelectItem = (item: ProjectItem) => {
    setActiveItem(item);
    localStorage.setItem(ACTIVE_PROJECT_ITEM_KEY, item);
  };

  const pingTemplateRequest = useSceneStore(s => s.pingTemplateRequest);
  const pingSpriteRequest = useSceneStore(s => s.pingSpriteRequest);

  useEffect(() => {
    if (pingTemplateRequest) {
      setActiveItem('entities');
    }
  }, [pingTemplateRequest]);

  useEffect(() => {
    if (pingSpriteRequest) {
      setActiveItem('sprites');
    }
  }, [pingSpriteRequest]);

  return (
    <div className="project-ui flex h-full select-none flex-col bg-gray-900">
      <div className="project-header flex items-center justify-between border-b border-gray-700 bg-gray-900/90 gap-2">
        <div className="flex min-w-0 items-center overflow-x-auto no-scrollbar">
          <span className="project-title px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0">
            Project
          </span>
          <div className="flex items-center">
            <ProjectTab
              item="scenes"
              activeItem={activeItem}
              label="Scenes"
              count={projectScenes.length}
              onSelect={handleSelectItem}
            />
            <ProjectTab
              item="prefabs"
              activeItem={activeItem}
              label="Prefabs"
              count={projectPrefabs.length}
              onSelect={handleSelectItem}
            />
            <ProjectTab
              item="entities"
              activeItem={activeItem}
              label="Entities"
              count={Object.keys(templates).length}
              onSelect={handleSelectItem}
            />
            <ProjectTab
              item="sprites"
              activeItem={activeItem}
              label="Sprites"
              count={projectSprites.length}
              onSelect={handleSelectItem}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 px-3">
          <span className="project-active-scene hidden md:inline-block max-w-[120px] lg:max-w-[160px] truncate text-right text-xs text-gray-400 font-mono bg-gray-800/60 px-2 py-0.5 rounded border border-gray-800" title={activeSceneName ?? 'No scene selected'}>
            {activeSceneName ? (activeSceneName.endsWith('.esc') ? activeSceneName.slice(0, -4) : activeSceneName) : 'No scene'}
          </span>
          <button
            type="button"
            disabled={!projectName || isRefreshing}
            onClick={() => void refreshProject()}
            title={projectName ? 'Refresh project files' : 'No project open'}
            className={`project-refresh-button flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors border shrink-0 ${
              !projectName || isRefreshing
                ? 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600'
                : 'border-gray-700/80 bg-gray-800/80 text-gray-300 hover:border-gray-600 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-gray-400'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6" />
              <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 1.8A10 10 0 0 0 22 12.5" />
            </svg>
            <span>Refresh</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse Project panel"
              className="project-collapse-button rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 shrink-0"
            >
              <Icon name="chevron-down" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeItem === 'entities' ? (
          <EntityList headerMode="embedded" />
        ) : activeItem === 'sprites' ? (
          <SpriteList headerMode="embedded" />
        ) : activeItem === 'prefabs' ? (
          <PrefabsView />
        ) : (
          <ScenesView />
        )}
      </div>
    </div>
  );
}
