import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityTemplate } from '../types';
import { useSceneStore } from '../store/sceneStore';
import { resolveImageUrl } from '../utils/resolveImageUrl';

const PING_HIGHLIGHT_MS = 1200;
const GRID_CARD_HEIGHT = 96;
const GRID_ROW_HEIGHT = 104;
const GRID_GAP = 8;
const GRID_CARD_TARGET_WIDTH = 88;
const LIST_ROW_HEIGHT = 44;
const LIST_ITEM_HEIGHT = 40;

interface EntityListProps {
  onToggleCollapse?: () => void;
  headerMode?: 'standalone' | 'embedded';
}

interface EntityItemProps {
  name: string;
  template: EntityTemplate;
  imgUrl: string | null;
  isActive: boolean;
  isPingHighlighted: boolean;
  style?: React.CSSProperties;
  onSelect: (name: string, isActive: boolean) => void;
}

/* Memoized Grid View Card Component */
const EntityGridCard = React.memo(function EntityGridCard({
  name,
  template,
  imgUrl,
  isActive,
  isPingHighlighted,
  style,
  onSelect,
}: EntityItemProps) {
  const hasParticles = (template.particleSystems?.length ?? 0) > 0;
  const isNonHorizontal = template.type && template.type !== 'horizontal';

  return (
    <div
      style={style}
      onClick={() => onSelect(name, isActive)}
      title={`${name}.ent${isNonHorizontal ? ` (${template.type})` : ''}\nSprite: ${template.spriteFile || 'none'}\nClick to place`}
      className={`entity-resource-card group absolute flex flex-col items-center p-2 rounded cursor-pointer border bg-gray-800/80 hover:bg-gray-700/80 hover:border-gray-500 transition-all ${
        isPingHighlighted
          ? 'entity-resource-card-ping border-cyan-300 ring-2 ring-cyan-300/70 bg-cyan-950/50'
          : isActive
          ? 'entity-resource-card-active border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-950/60'
          : 'border-gray-700/60'
      }`}
    >

      <div className="w-12 h-12 flex-shrink-0 bg-gray-900 rounded border border-gray-700/50 overflow-hidden flex items-center justify-center p-1 mb-1 relative">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-full object-contain pointer-events-none pixelated"
          />
        ) : (
          <div className="w-6 h-6 bg-purple-700 rounded-sm" />
        )}
        {hasParticles && (
          <span
            className="absolute bottom-0.5 right-0.5 px-0.5 py-0.2 bg-amber-950/90 text-amber-300 border border-amber-700/80 rounded text-[7px] font-mono leading-none"
            title={`Has ${template.particleSystems?.length} particle system(s)`}
          >
            ✨
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-200 text-center truncate w-full leading-tight font-medium" title={`${name}.ent`}>
        {name}
      </span>
      {isNonHorizontal && (
        <span className="text-[9px] text-gray-400 truncate w-full text-center mt-0.5 font-mono">
          {template.type}
        </span>
      )}
    </div>
  );
});

/* Memoized List View Row Component */
const EntityListItem = React.memo(function EntityListItem({
  name,
  template,
  imgUrl,
  isActive,
  isPingHighlighted,
  style,
  onSelect,
}: EntityItemProps) {
  const hasParticles = (template.particleSystems?.length ?? 0) > 0;
  const isNonHorizontal = template.type && template.type !== 'horizontal';

  return (
    <div
      style={style}
      onClick={() => onSelect(name, isActive)}
      title={`${name}.ent${isNonHorizontal ? ` (${template.type})` : ''}\nSprite: ${template.spriteFile || 'none'}\nClick to place`}
      className={`entity-resource-card group absolute inset-x-0 flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer border transition-all ${
        isPingHighlighted
          ? 'entity-resource-card-ping bg-cyan-950/60 border-cyan-300 ring-2 ring-cyan-300/70 text-white'
          : isActive
          ? 'entity-resource-card-active bg-indigo-950/80 border-indigo-500 text-white'
          : 'bg-gray-800/40 border-gray-800 hover:bg-gray-700/60 hover:border-gray-600'
      }`}
    >
      <div className="w-8 h-8 flex-shrink-0 bg-gray-900 rounded border border-gray-700/60 overflow-hidden flex items-center justify-center p-0.5 relative">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-full object-contain pointer-events-none pixelated"
          />
        ) : (
          <div className="w-5 h-5 bg-purple-700 rounded-sm" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="text-xs text-gray-200 truncate font-medium">{name}</span>
          <span className="text-[9px] text-indigo-400 font-mono">.ent</span>
          {template.spriteFile && (
            <span className="text-[10px] text-gray-500 truncate font-mono hidden sm:inline" title={template.spriteFile}>
              ({template.spriteFile})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasParticles && (
            <span
              className="text-[10px] text-amber-300 font-mono px-1 py-0.5 bg-amber-950/80 rounded border border-amber-800/60"
              title={`${template.particleSystems?.length} Particle System(s)`}
            >
              ✨ {template.particleSystems?.length}
            </span>
          )}
          {isNonHorizontal && (
            <span className="text-[10px] text-gray-400 font-mono px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700/60">
              {template.type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export function EntityList({ onToggleCollapse, headerMode = 'standalone' }: EntityListProps = {}) {
  const templates = useSceneStore(s => s.templates);
  const placingTemplate = useSceneStore(s => s.placingTemplate);
  const setPlacingTemplate = useSceneStore(s => s.setPlacingTemplate);
  const loadTemplates = useSceneStore(s => s.loadTemplates);
  const templateImageUrls = useSceneStore(s => s.templateImageUrls);
  const pingTemplateRequest = useSceneStore(s => s.pingTemplateRequest);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('ethanon_entity_view_mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedTemplate, setHighlightedTemplate] = useState<string | null>(null);

  /* Container viewport measurement & scroll tracking for Virtualization */
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState({ width: 300, height: 300 });
  const [scrollTop, setScrollTop] = useState(0);

  const filesRef = useRef<HTMLInputElement>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const pingFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      if (pingFrameRef.current !== null) {
        window.cancelAnimationFrame(pingFrameRef.current);
      }
    };
  }, []);

  /* Observe container dimensions */
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
    localStorage.setItem('ethanon_entity_view_mode', mode);
  };

  /* Memoized sorting and filtering */
  const sortedNames = useMemo(() => Object.keys(templates).sort(), [templates]);

  const filteredNames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedNames;
    return sortedNames.filter(n => {
      const tmpl = templates[n];
      return n.toLowerCase().includes(query) ||
        (tmpl?.spriteFile && tmpl.spriteFile.toLowerCase().includes(query)) ||
        (tmpl?.type && tmpl.type !== 'horizontal' && tmpl.type.toLowerCase().includes(query));
    });
  }, [sortedNames, templates, searchQuery]);

  /* Grid Layout calculations */
  const innerWidth = Math.max(100, containerBounds.width - 16);
  const cols = Math.max(1, Math.floor((innerWidth + GRID_GAP) / (GRID_CARD_TARGET_WIDTH + GRID_GAP)));
  const colWidth = cols > 1 ? (innerWidth - (cols - 1) * GRID_GAP) / cols : innerWidth;
  const totalGridRows = Math.ceil(filteredNames.length / cols);
  const totalGridHeight = totalGridRows * GRID_ROW_HEIGHT;

  /* List Layout calculations */
  const totalListHeight = filteredNames.length * LIST_ROW_HEIGHT;

  /* Ping highlight scrolling to virtualized item position */
  useEffect(() => {
    if (!pingTemplateRequest) return;

    const templateName = pingTemplateRequest.name.replace(/\.ent$/i, '');
    if (!templates[templateName]) return;

    if (pingFrameRef.current !== null) {
      window.cancelAnimationFrame(pingFrameRef.current);
    }

    pingFrameRef.current = window.requestAnimationFrame(() => {
      pingFrameRef.current = null;
      setSearchQuery('');
      setHighlightedTemplate(templateName);

      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedTemplate(current => current === templateName ? null : current);
        highlightTimerRef.current = null;
      }, PING_HIGHLIGHT_MS);

      window.requestAnimationFrame(() => {
        const idx = sortedNames.indexOf(templateName);
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
  }, [pingTemplateRequest, templates, sortedNames, viewMode, cols, containerBounds.height]);

  /* Callback handlers */
  const handleSelectEntity = useCallback((name: string, isActive: boolean) => {
    if (isActive) {
      setPlacingTemplate(null);
    } else {
      setPlacingTemplate(name);
    }
  }, [setPlacingTemplate]);

  /* Virtualization Index Ranges */
  let startIdx = 0;
  let endIdx = filteredNames.length - 1;

  if (viewMode === 'grid') {
    const startRow = Math.max(0, Math.floor(scrollTop / GRID_ROW_HEIGHT) - 2);
    const endRow = Math.min(totalGridRows - 1, Math.ceil((scrollTop + containerBounds.height) / GRID_ROW_HEIGHT) + 2);
    startIdx = Math.max(0, startRow * cols);
    endIdx = Math.min(filteredNames.length - 1, (endRow + 1) * cols - 1);
  } else {
    const startRow = Math.max(0, Math.floor(scrollTop / LIST_ROW_HEIGHT) - 3);
    const endRow = Math.min(filteredNames.length - 1, Math.ceil((scrollTop + containerBounds.height) / LIST_ROW_HEIGHT) + 3);
    startIdx = startRow;
    endIdx = endRow;
  }

  const visibleItems = useMemo(() => {
    if (filteredNames.length === 0) return [];
    const items = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (i >= 0 && i < filteredNames.length) {
        items.push({ index: i, name: filteredNames[i] });
      }
    }
    return items;
  }, [filteredNames, startIdx, endIdx]);

  return (
    <div className="entity-list-ui flex flex-col h-full bg-gray-900 select-none">
      {/* Header bar */}
      <div className="asset-list-header px-3 py-2 border-b border-gray-700 bg-gray-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {headerMode === 'standalone' && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Thu nhỏ Entity Panel (Collapse)"
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded hover:bg-gray-800"
            >
              ▼
            </button>
          )}
          {headerMode === 'standalone' && (
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Entities ({filteredNames.length})
            </span>
          )}

          {/* Quick search input */}
          <input
            type="text"
            placeholder="Filter entities (.ent)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="asset-list-search editor-input placeholder-gray-500 w-44"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Optional fallback/debug loader */}
          <button
            onClick={() => filesRef.current?.click()}
            title="Load individual .ent / image files"
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
          >
            Load files
          </button>

          <div className="w-px h-4 bg-gray-700 mx-0.5" />

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 border border-gray-700 bg-gray-800 rounded p-0.5">
            <button
              onClick={() => handleSetViewMode('grid')}
              title="Grid View"
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
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
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={filesRef}
          type="file"
          accept=".ent,.xml,image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {/* Templates list / grid content with Virtualization */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar relative"
      >
        {filteredNames.length === 0 && (
          <div className="px-3 py-6 text-xs text-gray-500 text-center italic">
            {sortedNames.length === 0 ? 'No entity templates loaded' : 'No matching entity templates found'}
          </div>
        )}

        {viewMode === 'grid' ? (
          /* Grid View Layout (Virtualized) */
          <div className="relative w-full" style={{ height: `${totalGridHeight}px` }}>
            {visibleItems.map(({ index: i, name }) => {
              const tmpl = templates[name];
              if (!tmpl) return null;
              const imgUrl = resolveImageUrl(templateImageUrls, tmpl.spriteFile);
              const isActive = placingTemplate === name;
              const isPingHighlighted = highlightedTemplate === name;

              const row = Math.floor(i / cols);
              const col = i % cols;
              const left = col * (colWidth + GRID_GAP);
              const top = row * GRID_ROW_HEIGHT;

              return (
                <EntityGridCard
                  key={name}
                  name={name}
                  template={tmpl}
                  imgUrl={imgUrl}
                  isActive={isActive}
                  isPingHighlighted={isPingHighlighted}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${colWidth}px`,
                    height: `${GRID_CARD_HEIGHT}px`,
                  }}
                  onSelect={handleSelectEntity}
                />
              );
            })}
          </div>
        ) : (
          /* List View Layout (Virtualized) */
          <div className="relative w-full" style={{ height: `${totalListHeight}px` }}>
            {visibleItems.map(({ index: i, name }) => {
              const tmpl = templates[name];
              if (!tmpl) return null;
              const imgUrl = resolveImageUrl(templateImageUrls, tmpl.spriteFile);
              const isActive = placingTemplate === name;
              const isPingHighlighted = highlightedTemplate === name;

              const top = i * LIST_ROW_HEIGHT;

              return (
                <EntityListItem
                  key={name}
                  name={name}
                  template={tmpl}
                  imgUrl={imgUrl}
                  isActive={isActive}
                  isPingHighlighted={isPingHighlighted}
                  style={{
                    top: `${top}px`,
                    height: `${LIST_ITEM_HEIGHT}px`,
                  }}
                  onSelect={handleSelectEntity}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
