import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectSpriteItem } from '../types';
import { useSceneStore } from '../store/sceneStore';

const GRID_CARD_HEIGHT = 110;
const GRID_ROW_HEIGHT = 118;
const GRID_GAP = 8;
const GRID_CARD_TARGET_WIDTH = 96;
const LIST_ROW_HEIGHT = 48;
const LIST_ITEM_HEIGHT = 44;

interface SpriteListProps {
  onToggleCollapse?: () => void;
  headerMode?: 'standalone' | 'embedded';
  onSelectSprite?: (sprite: ProjectSpriteItem) => void;
  selectedSprite?: string;
}

interface SpriteItemProps {
  sprite: ProjectSpriteItem;
  isActive: boolean;
  isPinged?: boolean;
  style?: React.CSSProperties;
  onSelect: (sprite: ProjectSpriteItem, isActive: boolean) => void;
}

const SpriteGridCard = React.memo(function SpriteGridCard({
  sprite,
  isActive,
  isPinged,
  style,
  onSelect,
}: SpriteItemProps) {
  const usageCount = sprite.usedByTemplates.length;

  return (
    <div
      style={style}
      onClick={() => onSelect(sprite, isActive)}
      title={`${sprite.name}\nPath: ${sprite.relativePath}\nUsed by: ${usageCount > 0 ? sprite.usedByTemplates.join(', ') : 'No entities'}`}
      className={`sprite-resource-card group absolute flex flex-col items-center p-2 rounded cursor-pointer border bg-gray-800/80 transition-all ${
        isPinged
          ? 'sprite-resource-card-ping border-emerald-400 ring-2 ring-emerald-400 bg-emerald-950/60 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse'
          : isActive
          ? 'sprite-resource-card-active border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-950/60'
          : 'border-gray-700/60 hover:bg-gray-700/80 hover:border-gray-500'
      }`}
    >
      {/* Thumbnail with checkerboard background for transparent pngs */}
      <div className="w-14 h-14 flex-shrink-0 bg-checkerboard rounded border border-gray-700/60 overflow-hidden flex items-center justify-center p-1 mb-1 relative">
        <img
          src={sprite.url}
          alt={sprite.name}
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-full object-contain pointer-events-none pixelated"
        />
        {sprite.hasAtlas && (
          <span
            className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-indigo-900/90 text-indigo-300 border border-indigo-700/80 rounded text-[8px] font-mono leading-none"
            title={`Texture Atlas (${sprite.atlasFrameCount ?? 0} frames)`}
          >
            ATLAS
          </span>
        )}
      </div>

      <span className="text-[11px] text-gray-200 text-center truncate w-full leading-tight font-medium" title={sprite.name}>
        {sprite.name}
      </span>

      <div className="flex items-center justify-center gap-1 w-full mt-0.5">
        <span
          className={`text-[9px] px-1 py-0.2 rounded font-mono truncate ${
            usageCount > 0
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
              : 'bg-gray-900/80 text-gray-400 border border-gray-700/50'
          }`}
          title={usageCount > 0 ? `Used by: ${sprite.usedByTemplates.join(', ')}` : 'Unused sprite'}
        >
          {usageCount > 0 ? `${usageCount} ent` : 'unused'}
        </span>
      </div>
    </div>
  );
});

/* Memoized List View Row Component for Sprites */
const SpriteListItem = React.memo(function SpriteListItem({
  sprite,
  isActive,
  isPinged,
  style,
  onSelect,
}: SpriteItemProps) {
  const usageCount = sprite.usedByTemplates.length;

  return (
    <div
      style={style}
      onClick={() => onSelect(sprite, isActive)}
      title={`${sprite.name}\nPath: ${sprite.relativePath}\nUsed by: ${usageCount > 0 ? sprite.usedByTemplates.join(', ') : 'No entities'}`}
      className={`sprite-resource-card group absolute inset-x-0 flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer border transition-all ${
        isPinged
          ? 'sprite-resource-card-ping border-emerald-400 ring-2 ring-emerald-400 bg-emerald-950/60 shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse'
          : isActive
          ? 'sprite-resource-card-active bg-emerald-950/80 border-emerald-500 text-white'
          : 'bg-gray-800/40 border-gray-800 hover:bg-gray-700/60 hover:border-gray-600'
      }`}
    >
      <div className="w-8 h-8 flex-shrink-0 bg-checkerboard rounded border border-gray-700/60 overflow-hidden flex items-center justify-center p-0.5 relative">
        <img
          src={sprite.url}
          alt={sprite.name}
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-full object-contain pointer-events-none pixelated"
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs text-gray-200 truncate font-medium block">{sprite.name}</span>
          <span className="text-[10px] text-gray-400 truncate block font-mono">
            {sprite.relativePath}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {sprite.hasAtlas && (
            <span
              className="text-[10px] text-indigo-300 font-mono px-1.5 py-0.5 bg-indigo-950/80 rounded border border-indigo-800/60"
              title={`Atlas with ${sprite.atlasFrameCount ?? 0} frames`}
            >
              Atlas ({sprite.atlasFrameCount ?? 0})
            </span>
          )}
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              usageCount > 0
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                : 'bg-gray-800 text-gray-400 border-gray-700/60'
            }`}
            title={usageCount > 0 ? `Used by: ${sprite.usedByTemplates.join(', ')}` : 'Unused sprite'}
          >
            {usageCount > 0 ? `${usageCount} ent` : 'Unused'}
          </span>
        </div>
      </div>
    </div>
  );
});

export function SpriteList({ onToggleCollapse, headerMode = 'standalone', onSelectSprite, selectedSprite }: SpriteListProps = {}) {
  const projectSprites = useSceneStore(s => s.projectSprites);
  const placingTemplate = useSceneStore(s => s.placingTemplate);
  const setPlacingTemplate = useSceneStore(s => s.setPlacingTemplate);
  const loadTemplates = useSceneStore(s => s.loadTemplates);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('ethanon_sprite_view_mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSprite, setHighlightedSprite] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState({ width: 300, height: 300 });
  const [scrollTop, setScrollTop] = useState(0);
  const filesRef = useRef<HTMLInputElement>(null);
  
  const pingSpriteRequest = useSceneStore(s => s.pingSpriteRequest);
  const pingFrameRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const PING_HIGHLIGHT_MS = 2500;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateBounds = () => {
      setContainerBounds({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await loadTemplates(e.target.files);
      e.target.value = '';
    }
  };

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('ethanon_sprite_view_mode', mode);
  };

  /* Filter and search sprites */
  const filteredSprites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projectSprites;

    return projectSprites.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.relativePath.toLowerCase().includes(query)
    );
  }, [projectSprites, searchQuery]);

  /* Grid Layout calculations */
  const innerWidth = Math.max(100, containerBounds.width - 16);
  const cols = Math.max(1, Math.floor((innerWidth + GRID_GAP) / (GRID_CARD_TARGET_WIDTH + GRID_GAP)));
  const colWidth = cols > 1 ? (innerWidth - (cols - 1) * GRID_GAP) / cols : innerWidth;
  const totalGridRows = Math.ceil(filteredSprites.length / cols);
  const totalGridHeight = totalGridRows * GRID_ROW_HEIGHT;

  /* List Layout calculations */
  const totalListHeight = filteredSprites.length * LIST_ROW_HEIGHT;

  /* Ping highlight scrolling to virtualized item position */
  useEffect(() => {
    if (!pingSpriteRequest) return;

    const spriteName = pingSpriteRequest.name;
    
    if (pingFrameRef.current !== null) {
      window.cancelAnimationFrame(pingFrameRef.current);
    }

    pingFrameRef.current = window.requestAnimationFrame(() => {
      pingFrameRef.current = null;
      setSearchQuery('');
      setHighlightedSprite(spriteName);

      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedSprite(current => current === spriteName ? null : current);
        highlightTimerRef.current = null;
      }, PING_HIGHLIGHT_MS);

      window.requestAnimationFrame(() => {
        const idx = projectSprites.findIndex(s => s.relativePath === spriteName || s.name === spriteName);
        if (idx !== -1 && containerRef.current) {
          const targetY = viewMode === 'grid'
            ? Math.floor(idx / cols) * GRID_ROW_HEIGHT
            : idx * LIST_ROW_HEIGHT;
          const targetScroll = Math.max(0, targetY - containerBounds.height / 2 + 30);
          containerRef.current.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
          });
        }
      });
    });
  }, [pingSpriteRequest, projectSprites, viewMode, cols, containerBounds.height]);

  /* Placement selection */
  const handleSelectSprite = useCallback((sprite: ProjectSpriteItem, isActive: boolean) => {
    if (onSelectSprite) {
      onSelectSprite(sprite);
      return;
    }
    if (isActive) {
      setPlacingTemplate(null);
    } else {
      setPlacingTemplate(sprite.relativePath || sprite.name);
    }
  }, [setPlacingTemplate, onSelectSprite]);

  /* Virtualization Index Ranges */
  let startIdx = 0;
  let endIdx = filteredSprites.length - 1;

  if (viewMode === 'grid') {
    const startRow = Math.max(0, Math.floor(scrollTop / GRID_ROW_HEIGHT) - 2);
    const endRow = Math.min(totalGridRows - 1, Math.ceil((scrollTop + containerBounds.height) / GRID_ROW_HEIGHT) + 2);
    startIdx = Math.max(0, startRow * cols);
    endIdx = Math.min(filteredSprites.length - 1, (endRow + 1) * cols - 1);
  } else {
    const startRow = Math.max(0, Math.floor(scrollTop / LIST_ROW_HEIGHT) - 3);
    const endRow = Math.min(filteredSprites.length - 1, Math.ceil((scrollTop + containerBounds.height) / LIST_ROW_HEIGHT) + 3);
    startIdx = startRow;
    endIdx = endRow;
  }

  const visibleItems = useMemo(() => {
    if (filteredSprites.length === 0) return [];
    const items = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (i >= 0 && i < filteredSprites.length) {
        items.push({ index: i, sprite: filteredSprites[i] });
      }
    }
    return items;
  }, [filteredSprites, startIdx, endIdx]);

  return (
    <div className="sprite-list-ui flex flex-col h-full bg-gray-900 select-none">
      {/* Header bar */}
      <div className="asset-list-header px-3 py-2 border-b border-gray-700 bg-gray-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {headerMode === 'standalone' && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse Sprites Panel"
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded hover:bg-gray-800"
            >
              ▼
            </button>
          )}
          {headerMode === 'standalone' && (
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Sprites ({filteredSprites.length})
            </span>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="Filter sprites (.png)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="asset-list-search editor-input placeholder-gray-500 w-44"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => filesRef.current?.click()}
            title="Load individual image files"
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
          >
            Load images
          </button>

          <div className="w-px h-4 bg-gray-700 mx-0.5" />

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 border border-gray-700 bg-gray-800 rounded p-0.5">
            <button
              onClick={() => handleSetViewMode('grid')}
              title="Grid View"
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => handleSetViewMode('list')}
              title="List View"
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <input
          ref={filesRef}
          type="file"
          accept="image/*,.xml"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {/* Sprites list / grid content with Virtualization */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar relative"
      >
        {filteredSprites.length === 0 && (
          <div className="px-3 py-6 text-xs text-gray-500 text-center italic">
            {projectSprites.length === 0 ? 'No sprite images loaded in project' : 'No matching sprites found'}
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="relative w-full" style={{ height: `${totalGridHeight}px` }}>
            {visibleItems.map(({ index: i, sprite }) => {
              const isPinged = highlightedSprite === sprite.relativePath || highlightedSprite === sprite.name;
              const isActive = onSelectSprite
                ? (selectedSprite === sprite.relativePath || selectedSprite === sprite.name)
                : (placingTemplate === sprite.relativePath || placingTemplate === sprite.name);

              const row = Math.floor(i / cols);
              const col = i % cols;
              const left = col * (colWidth + GRID_GAP);
              const top = row * GRID_ROW_HEIGHT;

              return (
                <SpriteGridCard
                  key={sprite.relativePath || sprite.name}
                  sprite={sprite}
                  isActive={isActive}
                  isPinged={isPinged}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${colWidth}px`,
                    height: `${GRID_CARD_HEIGHT}px`,
                  }}
                  onSelect={handleSelectSprite}
                />
              );
            })}
          </div>
        ) : (
          <div className="relative w-full" style={{ height: `${totalListHeight}px` }}>
            {visibleItems.map(({ index: i, sprite }) => {
              const isPinged = highlightedSprite === sprite.relativePath || highlightedSprite === sprite.name;
              const isActive = onSelectSprite
                ? (selectedSprite === sprite.relativePath || selectedSprite === sprite.name)
                : (placingTemplate === sprite.relativePath || placingTemplate === sprite.name);
              const top = i * LIST_ROW_HEIGHT;

              return (
                <SpriteListItem
                  key={sprite.relativePath || sprite.name}
                  sprite={sprite}
                  isActive={isActive}
                  isPinged={isPinged}
                  style={{
                    top: `${top}px`,
                    height: `${LIST_ITEM_HEIGHT}px`,
                  }}
                  onSelect={handleSelectSprite}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
