import { useState } from 'react';
import './App.css';
import { Viewport } from './canvas/Viewport';
import { Icon } from './components/Icon';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TauriCloseGuard } from './components/TauriCloseGuard';
import { HierarchyPanel } from './panels/HierarchyPanel';
import { Inspector } from './panels/Inspector';
import { ProjectPanel } from './panels/ProjectPanel';
import { SceneProps } from './panels/SceneProps';
import { useSceneStore } from './store/sceneStore';

export default function App() {
  const scene = useSceneStore(s => s.scene);
  const templates = useSceneStore(s => s.templates);
  const projectSprites = useSceneStore(s => s.projectSprites);

  const [rightTab, setRightTab] = useState<'inspector' | 'scene'>('inspector');
  const [isHierarchyCollapsed, setIsHierarchyCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ethanon_hierarchy_collapsed') === 'true';
  });

  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ethanon_inspector_collapsed') === 'true';
  });

  const [isProjectCollapsed, setIsProjectCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('ethanon_project_collapsed');
    if (saved !== null) return saved === 'true';
    return localStorage.getItem('ethanon_entity_collapsed') === 'true';
  });

  const toggleHierarchyCollapsed = () => {
    setIsHierarchyCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ethanon_hierarchy_collapsed', String(next));
      return next;
    });
  };

  const toggleInspectorCollapsed = () => {
    setIsInspectorCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ethanon_inspector_collapsed', String(next));
      return next;
    });
  };

  const toggleProjectCollapsed = () => {
    setIsProjectCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ethanon_project_collapsed', String(next));
      return next;
    });
  };

  const [hierarchyWidth, setHierarchyWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ethanon_hierarchy_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 120 && parsed <= 420) {
        return parsed;
      }
    }
    return 220;
  });

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ethanon_inspector_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 160 && parsed <= 600) {
        return parsed;
      }
    }
    return 240;
  });

  const [projectPanelHeight, setProjectPanelHeight] = useState<number>(() => {
    const saved = localStorage.getItem('ethanon_project_panel_height')
      ?? localStorage.getItem('ethanon_entity_panel_height');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 600) {
        return parsed;
      }
    }
    return 200;
  });

  const [dragGuide, setDragGuide] = useState<{
    type: 'hierarchy' | 'inspector' | 'project';
    pos: number;
    value: number;
  } | null>(null);

  const handleHierarchyResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isHierarchyCollapsed) {
      setIsHierarchyCollapsed(false);
      localStorage.setItem('ethanon_hierarchy_collapsed', 'false');
    }
    const startX = e.clientX;
    const startWidth = hierarchyWidth;
    let finalWidth = startWidth;

    setDragGuide({ type: 'hierarchy', pos: startX, value: startWidth });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) * 0.5;
      finalWidth = Math.round(Math.min(Math.max(startWidth + deltaX, 120), 420));
      setDragGuide({ type: 'hierarchy', pos: moveEvent.clientX, value: finalWidth });
    };

    const handlePointerUp = () => {
      setDragGuide(null);
      setHierarchyWidth(finalWidth);
      localStorage.setItem('ethanon_hierarchy_width', finalWidth.toString());
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetHierarchyWidth = () => {
    setHierarchyWidth(220);
    localStorage.setItem('ethanon_hierarchy_width', '220');
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isInspectorCollapsed) {
      setIsInspectorCollapsed(false);
      localStorage.setItem('ethanon_inspector_collapsed', 'false');
    }
    const startX = e.clientX;
    const startWidth = inspectorWidth;
    let finalWidth = startWidth;

    setDragGuide({ type: 'inspector', pos: startX, value: startWidth });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (startX - moveEvent.clientX) * 0.5;
      finalWidth = Math.round(Math.min(Math.max(startWidth + deltaX, 160), 600));
      setDragGuide({ type: 'inspector', pos: moveEvent.clientX, value: finalWidth });
    };

    const handlePointerUp = () => {
      setDragGuide(null);
      setInspectorWidth(finalWidth);
      localStorage.setItem('ethanon_inspector_width', finalWidth.toString());
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetWidth = () => {
    setInspectorWidth(240);
    localStorage.setItem('ethanon_inspector_width', '240');
  };

  const handleProjectResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isProjectCollapsed) {
      setIsProjectCollapsed(false);
      localStorage.setItem('ethanon_project_collapsed', 'false');
    }
    const startY = e.clientY;
    const startHeight = projectPanelHeight;
    let finalHeight = startHeight;

    setDragGuide({ type: 'project', pos: startY, value: startHeight });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = (startY - moveEvent.clientY) * 0.5; // dragging UP increases height
      finalHeight = Math.round(Math.min(Math.max(startHeight + deltaY, 100), 600));
      setDragGuide({ type: 'project', pos: moveEvent.clientY, value: finalHeight });
    };

    const handlePointerUp = () => {
      setDragGuide(null);
      setProjectPanelHeight(finalHeight);
      localStorage.setItem('ethanon_project_panel_height', finalHeight.toString());
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetProjectHeight = () => {
    setProjectPanelHeight(200);
    localStorage.setItem('ethanon_project_panel_height', '200');
  };

  const gridRows = `auto 1fr ${isProjectCollapsed ? '32px' : `${projectPanelHeight}px`}`;
  const gridCols = `${isHierarchyCollapsed ? '28px' : `${hierarchyWidth}px`} 1fr ${isInspectorCollapsed ? '28px' : `${inspectorWidth}px`}`;

  return (
    <div className="workspace-ui w-screen h-screen grid" style={{ gridTemplateRows: gridRows, gridTemplateColumns: gridCols }}>
      <Toolbar />
      <TauriCloseGuard />

      {/* Left panel: Scene Hierarchy */}
      <div className="workspace-panel workspace-panel-left col-start-1 row-start-2 row-span-2 relative flex flex-col overflow-hidden border-r border-gray-700 bg-gray-900 select-none">
        {!isHierarchyCollapsed ? (
          <>
            <div
              onPointerDown={handleHierarchyResizeStart}
              onDoubleClick={handleResetHierarchyWidth}
              className="workspace-resize-handle absolute top-0 bottom-0 right-0 z-30 -mr-1.5 flex w-3 cursor-col-resize select-none items-center justify-center group"
              title="Drag to resize Hierarchy (double click to reset to 220px)"
            >
              <div className="workspace-resize-track h-full w-0.5 transition-colors group-hover:bg-indigo-500 group-active:bg-indigo-400" />
            </div>
            <HierarchyPanel onToggleCollapse={toggleHierarchyCollapsed} />
          </>
        ) : (
          <div className="workspace-collapsed-strip flex flex-col items-center py-2 h-full bg-gray-900">
            <button
              onClick={toggleHierarchyCollapsed}
              title="Mở rộng Hierarchy (Expand)"
              className="p-1 text-gray-400 hover:text-white transition-colors text-xs"
            >
              ▶
            </button>
            <span className="mt-6 text-[10px] font-semibold uppercase text-gray-400 tracking-wider whitespace-nowrap vertical-lr-reverse">
              Hierarchy ({scene.entities.length})
            </span>
          </div>
        )}
      </div>

      {/* Center: Viewport */}
      <div className="col-start-2 row-start-2 overflow-hidden relative">
        <Viewport />
      </div>

      {/* Bottom panel: Project */}
      <div className="workspace-panel workspace-project-panel col-start-2 row-start-3 overflow-hidden relative border-t border-gray-700 flex flex-col bg-gray-900">
        {!isProjectCollapsed ? (
          <>
            {/* Resize Handle for Bottom Panel */}
            <div
              onPointerDown={handleProjectResizeStart}
              onDoubleClick={handleResetProjectHeight}
              className="workspace-resize-handle absolute top-0 left-0 right-0 h-3 -mt-1.5 cursor-row-resize z-30 group flex items-center justify-center select-none"
              title="Drag to resize Project panel (double click to reset to 200px)"
            >
              <div className="workspace-resize-track h-0.5 w-full group-hover:bg-indigo-500 group-active:bg-indigo-400 transition-colors" />
            </div>
            <ProjectPanel onToggleCollapse={toggleProjectCollapsed} />
          </>
        ) : (
          <div className="workspace-collapsed-strip flex items-center justify-between px-3 h-full bg-gray-900 select-none">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Project ({Object.keys(templates).length} ent, {projectSprites.length} sprites)
            </span>
            <button
              onClick={toggleProjectCollapsed}
              title="Expand Project panel"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
            >
              <span>Expand</span>
              <Icon name="chevron-up" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right panel: Inspector / Scene Props */}
      <div className="workspace-panel workspace-panel-right col-start-3 row-start-2 row-span-2 flex flex-col bg-gray-900 border-l border-gray-700 overflow-hidden relative select-none">
        {!isInspectorCollapsed ? (
          <>
            {/* Resize Handle for Inspector */}
            <div
              onPointerDown={handleResizeStart}
              onDoubleClick={handleResetWidth}
              className="workspace-resize-handle absolute top-0 bottom-0 left-0 w-3 -ml-1.5 cursor-col-resize z-30 group flex items-center justify-center select-none"
              title="Kéo để đổi kích thước Inspector (Nhấp kép để reset về 240px)"
            >
              <div className="workspace-resize-track w-0.5 h-full group-hover:bg-indigo-500 group-active:bg-indigo-400 transition-colors" />
            </div>

            <div className="workspace-tabs flex border-b border-gray-700 items-center">
              <button
                onClick={() => setRightTab('inspector')}
                className={`workspace-tab flex-1 text-xs py-2 ${rightTab === 'inspector' ? 'workspace-tab-active bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Inspector
              </button>
              <button
                onClick={() => setRightTab('scene')}
                className={`workspace-tab flex-1 text-xs py-2 ${rightTab === 'scene' ? 'workspace-tab-active bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Scene
              </button>
              <button
                onClick={toggleInspectorCollapsed}
                title="Thu nhỏ Inspector (Collapse)"
                className="workspace-tab workspace-collapse-button px-2 py-2 text-xs text-gray-400 hover:text-white transition-colors border-l border-gray-700"
              >
                ▶
              </button>
            </div>
            <div className="flex-1 overflow-y-auto hierarchy-scrollbar">
              {rightTab === 'inspector' ? <Inspector /> : <SceneProps />}
            </div>
          </>
        ) : (
          <div className="workspace-collapsed-strip flex flex-col items-center py-2 h-full bg-gray-900">
            <button
              onClick={toggleInspectorCollapsed}
              title="Mở rộng Inspector (Expand)"
              className="p-1 text-gray-400 hover:text-white transition-colors text-xs"
            >
              ◀
            </button>
            <span className="mt-6 text-[10px] font-semibold uppercase text-gray-400 tracking-wider whitespace-nowrap vertical-rl">
              Inspector
            </span>
          </div>
        )}
      </div>

      {/* Drag guide overlay when dragging panel splitters */}
      {dragGuide && (
        <div className="workspace-drag-guide fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {dragGuide.type === 'hierarchy' || dragGuide.type === 'inspector' ? (
            <>
              <div
                className="workspace-drag-line absolute top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                style={{ left: `${dragGuide.pos}px` }}
              />
              <div
                className="workspace-drag-label absolute top-4 px-2 py-1 bg-gray-900/90 text-indigo-300 border border-indigo-500/50 rounded text-xs shadow-lg font-mono"
                style={{ left: `${dragGuide.pos + 8}px` }}
              >
                {dragGuide.value}px
              </div>
            </>
          ) : (
            <>
              <div
                className="workspace-drag-line absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                style={{ top: `${dragGuide.pos}px` }}
              />
              <div
                className="workspace-drag-label absolute left-4 px-2 py-1 bg-gray-900/90 text-indigo-300 border border-indigo-500/50 rounded text-xs shadow-lg font-mono"
                style={{ top: `${dragGuide.pos - 28}px` }}
              >
                {dragGuide.value}px
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
