import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useSceneStore } from '../store/sceneStore';
import { EntityList } from './EntityList';
import { SpriteList } from './SpriteList';
import { CharacterList } from './CharacterList';
import { SceneList } from './SceneList';
import { PrefabList } from './PrefabList';

const ACTIVE_PROJECT_ITEM_KEY = 'ethanon_project_active_item';

type ProjectItem = 'scenes' | 'entities' | 'sprites' | 'prefabs' | 'characters';

interface ProjectPanelProps {
  onToggleCollapse?: () => void;
}

function getSavedProjectItem(): ProjectItem {
  const saved = localStorage.getItem(ACTIVE_PROJECT_ITEM_KEY);
  return saved === 'scenes' || saved === 'entities' || saved === 'sprites' || saved === 'prefabs' || saved === 'characters' ? saved : 'entities';
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
          ? 'border-[#bec1c5] bg-[#303135] text-[#eceeef]'
          : 'border-transparent text-[#a2a5aa] hover:bg-[#3a3c40]/60 hover:text-[#eceeef]'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
        isActive ? 'bg-[#252629] text-[#eceeef] border border-[#46484d]' : 'bg-[#252629] text-[#a2a5aa] border border-transparent'
      }`}>
        {count}
      </span>
    </button>
  );
}

export function ProjectPanel({ onToggleCollapse }: ProjectPanelProps) {
  const projectName = useSceneStore(s => s.projectName);
  const projectStatus = useSceneStore(s => s.projectStatus);
  const refreshProject = useSceneStore(s => s.refreshProject);
  const projectScenes = useSceneStore(s => s.projectScenes);
  const projectPrefabs = useSceneStore(s => s.projectPrefabs);
  const projectCharacters = useSceneStore(s => s.projectCharacters);
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
    <div className="project-ui flex h-full select-none flex-col bg-[#252629]">
      <div className="project-header flex items-center justify-between border-b border-[#46484d] bg-[#2c2d30] gap-2 min-h-[34px]">
        <div className="flex min-w-0 items-center overflow-x-auto no-scrollbar">
          <span className="project-title px-3 text-xs font-semibold uppercase tracking-wider text-[#bec1c5] shrink-0">
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
              item="characters"
              activeItem={activeItem}
              label="Characters"
              count={projectCharacters.length}
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
          <span className="project-active-scene hidden md:inline-block max-w-[120px] lg:max-w-[160px] truncate text-right text-xs text-[#bec1c5] font-mono bg-[#292a2d] px-2 py-0.5 rounded border border-[#46484d]" title={activeSceneName ?? 'No scene selected'}>
            {activeSceneName ? (activeSceneName.endsWith('.esc') ? activeSceneName.slice(0, -4) : activeSceneName) : 'No scene'}
          </span>
          <button
            type="button"
            disabled={!projectName || isRefreshing}
            onClick={() => void refreshProject()}
            title={projectName ? 'Refresh project files' : 'No project open'}
            className={`project-refresh-button flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors border shrink-0 ${
              !projectName || isRefreshing
                ? 'cursor-not-allowed border-[#393b3f] bg-[#292a2d] text-[#a2a5aa]'
                : 'border-[#46484d] bg-[#303135] text-[#bec1c5] hover:border-[#bec1c5] hover:bg-[#3a3c40] hover:text-[#eceeef]'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#eceeef]' : 'text-[#a2a5aa]'}`}
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
          <PrefabList />
        ) : activeItem === 'characters' ? (
          <CharacterList />
        ) : (
          <SceneList />
        )}
      </div>
    </div>
  );
}
