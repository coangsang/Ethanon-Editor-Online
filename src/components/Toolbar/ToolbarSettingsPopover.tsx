import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  BarChart3,
  Broom,
  Cpu,
  Gauge,
  Grid3X3,
  Magnet,
  MoveHorizontal,
  RotateCcw,
  Ruler,
  ScanSearch,
  Sparkles,
  X,
} from 'lucide-react';
import { useSceneStore } from '../../store/sceneStore';
import { ALLOWED_SNAP_SIZES } from '../../canvas/viewportMath';
import { ToolbarButton } from './ToolbarButton';
import { resetPerformanceProfiler } from '../../utils/performanceProfiler';

interface ToggleItemProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  icon?: ReactNode;
}

function ToggleItem({ label, description, checked, onChange, icon }: ToggleItemProps) {
  return (
    <label className="toolbar-settings-item flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/80 cursor-pointer select-none group transition-colors">
      <div className="flex flex-col pr-2">
        <span className="text-xs font-medium text-gray-200 group-hover:text-white flex items-center gap-2">
          {icon && <span className="flex items-center justify-center shrink-0">{icon}</span>}
          {label}
        </span>
        {description && <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange();
        }}
        className={`toolbar-switch relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-indigo-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

export function ToolbarSettingsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const gridSize = useSceneStore((s) => s.gridSize);
  const setGridSize = useSceneStore((s) => s.setGridSize);
  const snapToGrid = useSceneStore((s) => s.snapToGrid);
  const toggleSnap = useSceneStore((s) => s.toggleSnap);
  const showParticles = useSceneStore((s) => s.showParticles);
  const toggleParticles = useSceneStore((s) => s.toggleParticles);
  const updateParticlesWhileMoving = useSceneStore((s) => s.updateParticlesWhileMoving);
  const toggleUpdateParticlesWhileMoving = useSceneStore((s) => s.toggleUpdateParticlesWhileMoving);
  const showFps = useSceneStore((s) => s.showFps);
  const toggleFps = useSceneStore((s) => s.toggleFps);
  const showParticleFps = useSceneStore((s) => s.showParticleFps);
  const toggleParticleFps = useSceneStore((s) => s.toggleParticleFps);
  const showPlacementProfiler = useSceneStore((s) => s.showPlacementProfiler);
  const togglePlacementProfiler = useSceneStore((s) => s.togglePlacementProfiler);
  const cleanSceneFile = useSceneStore((s) => s.cleanSceneFile);
  const toggleCleanSceneFile = useSceneStore((s) => s.toggleCleanSceneFile);
  const clampZoomToScene = useSceneStore((s) => s.clampZoomToScene);
  const toggleClampZoomToScene = useSceneStore((s) => s.toggleClampZoomToScene);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeCount = [
    showGrid,
    snapToGrid,
    showParticles,
    updateParticlesWhileMoving,
    showFps,
    showParticleFps,
    showPlacementProfiler,
    cleanSceneFile,
    clampZoomToScene,
  ].filter(Boolean).length;

  return (
    <div className="toolbar-settings relative inline-block text-left" ref={popoverRef}>
      <ToolbarButton
        icon="settings"
        iconSize={15}
        title="Editor & Viewport Settings"
        active={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Settings
      </ToolbarButton>

      {isOpen && (
        <div className="toolbar-settings-popover absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-64 rounded-lg bg-gray-900 border border-gray-700/80 shadow-2xl z-50 p-2 text-gray-200 divide-y divide-gray-800 font-sans">
          {/* Section 1: Display & Viewport */}
          <div className="pb-1.5">
            <div className="toolbar-settings-heading px-2 py-1 text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
              Viewport Display
            </div>
            <ToggleItem
              icon={<Grid3X3 size={14} className="text-indigo-400/80 group-hover:text-indigo-300" />}
              label="Grid Lines"
              description="Show canvas alignment grid"
              checked={showGrid}
              onChange={toggleGrid}
            />
            <ToggleItem
              icon={<Magnet size={14} className="text-indigo-400/80 group-hover:text-indigo-300" />}
              label="Snap to Grid"
              description={`Snap transforms to ${gridSize}px step`}
              checked={snapToGrid}
              onChange={toggleSnap}
            />
            <div className="toolbar-settings-item flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/80 transition-colors">
              <div className="flex flex-col pr-2">
                <span className="text-xs font-medium text-gray-200 flex items-center gap-2">
                  <span className="flex items-center justify-center shrink-0">
                    <Ruler size={14} className="text-indigo-400/80" />
                  </span>
                  Snap Step
                </span>
                <span className="text-[10px] text-gray-400 leading-tight mt-0.5">Grid step size in pixels</span>
              </div>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="toolbar-settings-select bg-gray-800 text-indigo-300 text-xs font-mono rounded px-2 py-0.5 border border-gray-700 hover:border-gray-600 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {ALLOWED_SNAP_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
            <ToggleItem
              icon={<Sparkles size={14} className="text-indigo-400/80 group-hover:text-indigo-300" />}
              label="Particle Simulation"
              description="Render live particle emitters"
              checked={showParticles}
              onChange={toggleParticles}
            />
            <ToggleItem
              icon={<ScanSearch size={14} className="text-indigo-400/80 group-hover:text-indigo-300" />}
              label="Clamp Zoom to Scene"
              description="Limit maximum zoom-out to fit the scene bounds"
              checked={clampZoomToScene}
              onChange={toggleClampZoomToScene}
            />
            <ToggleItem
              icon={<MoveHorizontal size={14} className="text-indigo-400/80 group-hover:text-indigo-300" />}
              label="Update particles while moving"
              description="Move particle emitters with their entities during a drag"
              checked={updateParticlesWhileMoving}
              onChange={toggleUpdateParticlesWhileMoving}
            />
          </div>

          {/* Section 2: Performance & Stats */}
          <div className="pt-1.5 pb-1">
            <div className="toolbar-settings-heading px-2 py-1 text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
              Performance Overlays
            </div>
            <ToggleItem
              icon={<Gauge size={14} className="text-emerald-400/80 group-hover:text-emerald-300" />}
              label="FPS Counter"
              description="Real-time frame rate & render time HUD"
              checked={showFps}
              onChange={toggleFps}
            />
            <ToggleItem
              icon={<BarChart3 size={14} className="text-emerald-400/80 group-hover:text-emerald-300" />}
              label="Particle Stats & FPS"
              description="Active particle count & update tick time"
              checked={showParticleFps}
              onChange={toggleParticleFps}
            />
            {import.meta.env.DEV && (
              <>
                <ToggleItem
                  icon={<Cpu size={14} className="text-emerald-400/80 group-hover:text-emerald-300" />}
                  label="Placement Profiler"
                  description="History, texture and renderer timing"
                  checked={showPlacementProfiler}
                  onChange={togglePlacementProfiler}
                />
                {showPlacementProfiler && (
                  <button
                    type="button"
                    onClick={resetPerformanceProfiler}
                    className="mx-2 mb-1 flex items-center justify-center gap-1.5 w-[calc(100%-1rem)] rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:border-gray-600 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <RotateCcw size={11} className="shrink-0 text-emerald-400/80" />
                    Reset profiler samples
                  </button>
                )}
              </>
            )}
          </div>

          {/* Section 3: File Export Options */}
          <div className="pt-1.5 pb-1">
            <div className="toolbar-settings-heading px-2 py-1 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
              Scene File Export
            </div>
            <ToggleItem
              icon={<Broom size={14} className="text-amber-400/80 group-hover:text-amber-300" />}
              label="Clean Scene File"
              description="Enable Clean Save button to export without editor metadata"
              checked={cleanSceneFile}
              onChange={toggleCleanSceneFile}
            />
          </div>

          {/* Footer note */}
          <div className="pt-1.5 px-2 flex justify-between items-center text-[10px] text-gray-500">
            <span>{activeCount} active settings</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="toolbar-settings-close inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <X size={11} />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
