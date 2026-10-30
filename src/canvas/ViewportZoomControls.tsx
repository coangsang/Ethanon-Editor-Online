import { useState } from 'react';
import { ChevronDown, ChevronUp, Maximize, Minus, Plus } from 'lucide-react';
import { useSceneStore } from '../store/sceneStore';

interface ViewportZoomControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function ViewportZoomControls({ onZoomIn, onZoomOut }: ViewportZoomControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const zoom = useSceneStore(s => s.camera.zoom);
  const fitViewToScene = useSceneStore(s => s.fitViewToScene);

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center select-none pointer-events-auto transition-opacity duration-200 opacity-40 hover:opacity-100">
      <div
        className={`flex items-center gap-1 bg-gray-900/90 backdrop-blur-md border-x border-b border-gray-700/80 shadow-lg rounded-b-md px-1.5 py-1 text-gray-200 transition-all duration-200 ease-in-out ${
          isCollapsed ? '-translate-y-full opacity-0 pointer-events-none absolute' : 'translate-y-0 opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom In"
          className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom Out"
          className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={fitViewToScene}
          title="Fit Scene to Viewport (0)"
          aria-label="Fit Scene to Viewport"
          className="p-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
        >
          <Maximize size={14} />
        </button>
        <div className="w-px h-3.5 bg-gray-700 mx-0.5" />
        <span
          className="px-1 text-[11px] font-mono font-medium text-gray-300 min-w-10 text-center select-none cursor-default"
          title={`Current Zoom: ${zoomPercent}`}
        >
          {zoomPercent}
        </span>
        <div className="w-px h-3.5 bg-gray-700 mx-0.5" />
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          title="Hide Zoom Controls"
          aria-label="Hide Zoom Controls"
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Show Zoom Controls"
          aria-label="Show Zoom Controls"
          className="flex items-center justify-center bg-gray-900/90 backdrop-blur-md border-x border-b border-gray-700/80 px-2 py-0.5 rounded-b-md shadow-lg text-gray-400 hover:text-white transition-colors"
        >
          <ChevronDown size={14} />
        </button>
      )}
    </div>
  );
}

