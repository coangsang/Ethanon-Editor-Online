import { useSceneStore } from '../../store/sceneStore';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';
import { ToolbarSettingsPopover } from './ToolbarSettingsPopover';
import { ProjectScanIssuesPopover } from './ProjectScanIssuesPopover';
import type { IconName } from '../Icon';

const TOOL_BUTTONS: Array<{ key: 'grab' | 'select' | 'move' | 'rotate'; title: string; iconName: IconName }> = [
  { key: 'grab', title: 'Grab / Pan Canvas (Q)', iconName: 'hand' },
  { key: 'select', title: 'Select (S)', iconName: 'cursor' },
  { key: 'move', title: 'Move (W)', iconName: 'move' },
  { key: 'rotate', title: 'Rotate (E)', iconName: 'rotate' },
];

export function Toolbar() {
  const openProject = useSceneStore(s => s.openProject);
  const refreshProject = useSceneStore(s => s.refreshProject);
  const saveActiveScene = useSceneStore(s => s.saveActiveScene);
  const saveSceneAs = useSceneStore(s => s.saveSceneAs);
  const projectName = useSceneStore(s => s.projectName);
  const activeSceneName = useSceneStore(s => s.activeSceneName);
  const projectStatus = useSceneStore(s => s.projectStatus);
  const projectError = useSceneStore(s => s.projectError);
  const tool = useSceneStore(s => s.tool);
  const setTool = useSceneStore(s => s.setTool);
  const undo = useSceneStore(s => s.undo);
  const redo = useSceneStore(s => s.redo);
  const snapToGrid = useSceneStore(s => s.snapToGrid);
  const toggleSnap = useSceneStore(s => s.toggleSnap);
  const gridSize = useSceneStore(s => s.gridSize);
  const cleanSceneFile = useSceneStore(s => s.cleanSceneFile);

  const projectBusy = projectStatus === 'loading' || projectStatus === 'saving';
  const canSaveProjectScene = Boolean(activeSceneName) && !projectBusy;

  const handleSaveAs = () => {
    const filename = window.prompt('Save scene as', activeSceneName ?? 'scene.esc');
    if (filename) void saveSceneAs(filename);
  };

  return (
    <div className="toolbar-ui col-span-full row-start-1 flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700 z-10 select-none">
      {/* Brand Header */}
      <div className="toolbar-brand flex items-center gap-1.5 mr-1 shrink-0">
        <img
          src={`${import.meta.env.BASE_URL}app-icon.png`}
          alt="Unofficial Magic Rampage Scene Editor"
          className="w-4 h-4 rounded object-contain shrink-0"
        />
        <span className="text-xs font-semibold text-indigo-400">Unofficial Magic Rampage Scene Editor</span>
      </div>

      {/* Project File Actions */}
      <ToolbarButton
        icon="project-open"
        iconSize={14}
        disabled={projectBusy}
        onClick={() => void openProject()}
      >
        Open Project
      </ToolbarButton>

      <ToolbarButton
        disabled={!projectName || projectBusy}
        onClick={() => void refreshProject()}
        title="Refresh Project Files"
      >
        <span className="flex items-center gap-1">
          <svg
            className={`w-3.5 h-3.5 ${projectStatus === 'loading' ? 'animate-spin text-indigo-400' : ''}`}
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
          Refresh
        </span>
      </ToolbarButton>

      <ToolbarButton
        icon="save"
        iconSize={14}
        disabled={!canSaveProjectScene}
        onClick={() => void saveActiveScene()}
      >
        Save Scene
      </ToolbarButton>

      {cleanSceneFile && (
        <ToolbarButton
          icon="save"
          iconSize={14}
          disabled={!canSaveProjectScene}
          onClick={() => void saveActiveScene({ clean: true })}
          title="Save active scene without editor metadata (.esc)"
        >
          Clean Save
        </ToolbarButton>
      )}

      <ToolbarButton
        disabled={!projectName || projectBusy}
        onClick={handleSaveAs}
      >
        Save As
      </ToolbarButton>

      <ToolbarDivider />

      {/* Tools: Q/W/E/S */}
      {TOOL_BUTTONS.map(({ key, title, iconName }) => (
        <ToolbarButton
          key={key}
          icon={iconName}
          iconSize={16}
          title={title}
          active={tool === key}
          onClick={() => setTool(key)}
        />
      ))}

      <ToolbarDivider />

      {/* History */}
      <ToolbarButton title="Undo (Ctrl+Z)" onClick={undo}>
        ↩
      </ToolbarButton>
      <ToolbarButton title="Redo (Ctrl+Y)" onClick={redo}>
        ↪
      </ToolbarButton>

      <ToolbarDivider />

      {/* View Options & Settings */}
      <ToolbarButton
        title={`Snap to Grid (${gridSize}px)`}
        active={snapToGrid}
        onClick={toggleSnap}
      >
        Snap ({gridSize}px)
      </ToolbarButton>

      <ToolbarSettingsPopover />

      <div className="flex-1" />

      {/* Status & Error Display */}
      <ProjectScanIssuesPopover />
      {projectError && (
        <span className="text-xs text-red-400 truncate max-w-80" title={projectError}>
          {projectError}
        </span>
      )}
      {!projectError && projectBusy && (
        <span className="text-xs text-gray-500 truncate max-w-80" title={activeSceneName ?? projectName ?? undefined}>
          {projectStatus === 'loading' ? 'Loading project...' : 'Saving scene...'}
        </span>
      )}
    </div>
  );
}
