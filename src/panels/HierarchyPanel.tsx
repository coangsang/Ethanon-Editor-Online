import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import type { EntityInstance } from '../types';

const ROW_HEIGHT = 28;
const BUFFER_ROWS = 4;

interface HierarchyPanelProps {
  onToggleCollapse?: () => void;
}

interface HierarchyItemProps {
  uid: string;
  id: number;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
  hide?: boolean;
  isSelected: boolean;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isDragTarget?: boolean;
  isPrefab: boolean;
  style?: React.CSSProperties;
  onSelect: (uid: string, e: React.MouseEvent) => void;
  onFocus: (uid: string) => void;
  onToggleExpand: (uid: string, e: React.MouseEvent) => void;
  onToggleHide: (uid: string, e: React.MouseEvent) => void;
  onAddEmptyChild?: (uid: string) => void;
  onDragStart: (e: React.DragEvent, uid: string) => void;
  onDragOver: (e: React.DragEvent, uid: string) => void;
  onDragLeave: (e: React.DragEvent, uid: string) => void;
  onDrop: (e: React.DragEvent, uid: string | null) => void;
}

/* SVG Icons for clean Unity/VSCode style tree display */
function ChevronRightIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 3l5 5-5 5V3z" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 6l5 5 5-5H3z" />
    </svg>
  );
}

function PrefabIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M3 8h10M8 3v10" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.75 3A1.75 1.75 0 000 4.75v6.5C0 12.22.78 13 1.75 13h12.5A1.75 1.75 0 0014.25 4.5H7.44L5.97 3.03A1.75 1.75 0 004.73 2.5H1.75z" />
    </svg>
  );
}

function EntityDefaultIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  );
}

function EyeVisibleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeHiddenIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l12 12M6.26 6.26A2 2 0 0010.8 10.8M4.2 4.2C2.8 5.2 1.8 6.7 1.5 8c.7 1.7 2.7 4.5 6.5 4.5 1.3 0 2.4-.3 3.4-.8M7 3.6c.3-.06.67-.1.97-.1 3.8 0 5.8 2.8 6.5 4.5-.4.9-1.2 2.2-2.4 3.1" />
    </svg>
  );
}

/* Memoized Hierarchy Row Item Component */
const HierarchyItem = React.memo(function HierarchyItem({
  uid,
  id,
  name,
  posX,
  posY,
  posZ,
  hide,
  isSelected,
  depth,
  hasChildren,
  isCollapsed,
  isDragTarget,
  isPrefab,
  style,
  onSelect,
  onFocus,
  onToggleExpand,
  onToggleHide,
  onAddEmptyChild,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: HierarchyItemProps) {
  const displayName = name || '(unnamed)';
  const indentPadding = depth * 16 + 8;

  return (
    <div
      draggable={true}
      onDragStart={(e) => onDragStart(e, uid)}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(e, uid);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeave(e, uid);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(e, uid);
      }}
      onClick={(e) => onSelect(uid, e)}
      onDoubleClick={() => onFocus(uid)}
      title={`${displayName} | id: ${id} | x: ${posX}, y: ${posY}, z: ${posZ} (Drag onto entity to parent)`}
      className={`hierarchy-row group absolute inset-x-0 flex items-center justify-between h-[28px] pr-2 transition-colors cursor-pointer select-none border-b border-gray-800/30 ${
        isDragTarget
          ? 'hierarchy-row-drop-target bg-indigo-900/90 text-white outline outline-1 outline-indigo-400 z-10'
          : isSelected
          ? 'hierarchy-row-selected bg-indigo-600/35 text-white font-medium border-l-2 border-l-indigo-400'
          : 'hierarchy-row-idle text-gray-300 hover:bg-gray-800/60'
      }`}
      style={{
        ...style,
        paddingLeft: `${indentPadding}px`,
      }}
    >
      {/* Indentation guide lines for depth > 0 */}
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0 pointer-events-none flex">
          {Array.from({ length: depth }).map((_, i) => (
            <div
              key={i}
              className="border-l border-gray-800/70 h-full"
              style={{
                position: 'absolute',
                left: `${i * 16 + 14}px`,
              }}
            />
          ))}
        </div>
      )}

      <div className="min-w-0 flex items-center gap-1.5 truncate relative z-1">
        {/* Expand / Collapse Chevron Button */}
        {hasChildren ? (
          <button
            onClick={(e) => onToggleExpand(uid, e)}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
            title={isCollapsed ? 'Expand children' : 'Collapse children'}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </button>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}

        {/* Entity Icon Badge */}
        {isPrefab ? (
          <PrefabIcon />
        ) : hasChildren ? (
          <GroupIcon />
        ) : (
          <EntityDefaultIcon />
        )}

        {/* Entity Display Name */}
        <span
          className={`truncate text-xs ${
            hide
              ? 'text-gray-500 opacity-60 line-through decoration-gray-600'
              : isSelected
              ? 'text-white'
              : 'text-gray-200'
          }`}
        >
          {displayName}
        </span>
      </div>

      {/* Quick Action Controls (Add Empty Child & Eye Hide Toggle) */}
      <div className="flex items-center gap-0.5 shrink-0 relative z-1">
        {onAddEmptyChild && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddEmptyChild(uid);
            }}
            title="Create Empty Child under this entity"
            className="p-1 text-[11px] font-bold leading-none rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-300 hover:bg-gray-700/70 transition-colors"
          >
            +
          </button>
        )}
        <button
          onClick={(e) => onToggleHide(uid, e)}
          title={hide ? 'Unhide entity' : 'Hide entity'}
          className={`p-1 rounded transition-colors ${
            hide
              ? 'opacity-100 text-amber-400 hover:bg-amber-950/50'
              : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60'
          }`}
        >
          {hide ? <EyeHiddenIcon /> : <EyeVisibleIcon />}
        </button>
      </div>
    </div>
  );
});

interface FlatNode {
  entity: EntityInstance;
  depth: number;
  hasChildren: boolean;
}

function matchesHierarchySearch(entity: EntityInstance, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  const editorName = (entity.editorEntityName || '').toLowerCase();
  const rawName = (entity.entityName || '').toLowerCase();
  const displayName = (entity.editorEntityName || entity.entityName || '(unnamed)').toLowerCase();
  const idStr = String(entity.id);
  const hashIdStr = `#${entity.id}`;

  if (idStr.includes(normalizedQuery) || hashIdStr.includes(normalizedQuery)) return true;
  if (editorName.includes(normalizedQuery) || rawName.includes(normalizedQuery) || displayName.includes(normalizedQuery)) return true;
  return !entity.editorEntityName && !entity.entityName && 'unnamed'.includes(normalizedQuery);
}

export function HierarchyPanel({ onToggleCollapse }: HierarchyPanelProps = {}) {
  const entities = useSceneStore(s => s.scene.entities);
  const selectedUIDs = useSceneStore(s => s.selectedUIDs);
  const activeSceneName = useSceneStore(s => s.activeSceneName);
  const sceneNameDisplay = activeSceneName ? activeSceneName.replace(/\.esc$/i, '') : '';
  const selectEntity = useSceneStore(s => s.selectEntity);
  const setSelection = useSceneStore(s => s.setSelection);
  const toggleSelection = useSceneStore(s => s.toggleSelection);
  const focusEntity = useSceneStore(s => s.focusEntity);
  const updateEntity = useSceneStore(s => s.updateEntity);
  const scrollHierarchyRequest = useSceneStore(s => s.scrollHierarchyRequest);
  const scrollHierarchyToEntity = useSceneStore(s => s.scrollHierarchyToEntity);
  const setParentEntities = useSceneStore(s => s.setParentEntities);
  const addEmptyEntity = useSceneStore(s => s.addEmptyEntity);
  const duplicateSelected = useSceneStore(s => s.duplicateSelected);
  const copySelected = useSceneStore(s => s.copySelected);
  const pasteClipboard = useSceneStore(s => s.pasteClipboard);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const handledScrollNonceRef = useRef<number | null>(null);
  const [containerBounds, setContainerBounds] = useState({ height: 400 });
  const [scrollTop, setScrollTop] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [dragTargetUid, setDragTargetUid] = useState<string | null>(null);
  const [selectionAnchorUid, setSelectionAnchorUid] = useState<string | null>(null);
  const [selectionCaretUid, setSelectionCaretUid] = useState<string | null>(null);
  const [collapsedUIDs, setCollapsedUIDs] = useState<Set<string>>(new Set());

  /* ResizeObserver to measure container viewport height */
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateBounds = () => {
      setContainerBounds({ height: el.clientHeight });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleToggleExpand = useCallback((uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedUIDs(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  const handleToggleHide = useCallback((uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = entities.find(ent => ent.editorEntityUID === uid);
    if (target) {
      updateEntity(uid, { hide: !target.hide });
    }
  }, [entities, updateEntity]);

  /* Build Hierarchy Tree and flatten it */
  const flatEntities = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    const childrenMap = new Map<string, EntityInstance[]>();
    const rootNodes: EntityInstance[] = [];

    for (const e of entities) {
      if (e.editorParentEntity) {
        let siblings = childrenMap.get(e.editorParentEntity);
        if (!siblings) {
          siblings = [];
          childrenMap.set(e.editorParentEntity, siblings);
        }
        siblings.push(e);
      } else {
        rootNodes.push(e);
      }
    }

    if (trimmedQuery) {
      const displayEntities = entities.filter(entity => matchesHierarchySearch(entity, trimmedQuery));
      return displayEntities.map(e => ({
        entity: e,
        depth: 0,
        hasChildren: Boolean(childrenMap.get(e.editorEntityUID)?.length),
      }));
    }

    const sortEntities = (arr: EntityInstance[]) => {
      arr.sort((a, b) => (a.editorHierarchyOrder ?? 0) - (b.editorHierarchyOrder ?? 0));
    };

    const flatList: FlatNode[] = [];

    const traverse = (node: EntityInstance, depth: number) => {
      const children = childrenMap.get(node.editorEntityUID);
      const hasChildren = Boolean(children && children.length > 0);

      flatList.push({ entity: node, depth, hasChildren });

      if (hasChildren && !collapsedUIDs.has(node.editorEntityUID)) {
        sortEntities(children!);
        for (const child of children!) {
          traverse(child, depth + 1);
        }
      }
    };

    sortEntities(rootNodes);
    for (const root of rootNodes) {
      traverse(root, 0);
    }

    return flatList;
  }, [entities, searchQuery, collapsedUIDs]);

  /* Virtualization Index Ranges */
  const totalHeight = flatEntities.length * ROW_HEIGHT;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endRow = Math.min(
    flatEntities.length - 1,
    Math.ceil((scrollTop + containerBounds.height) / ROW_HEIGHT) + BUFFER_ROWS
  );

  const visibleEntities = useMemo(() => {
    if (flatEntities.length === 0) return [];
    const items: Array<{ index: number; flatNode: FlatNode }> = [];
    for (let i = startRow; i <= endRow; i++) {
      if (i >= 0 && i < flatEntities.length) {
        items.push({ index: i, flatNode: flatEntities[i] });
      }
    }
    return items;
  }, [flatEntities, startRow, endRow]);

  /* Handle scroll Hierarchy Request from Canvas / Store */
  useEffect(() => {
    if (!scrollHierarchyRequest || handledScrollNonceRef.current === scrollHierarchyRequest.nonce) return;

    const target = entities.find(entity => entity.editorEntityUID === scrollHierarchyRequest.uid);
    if (!target) {
      handledScrollNonceRef.current = scrollHierarchyRequest.nonce;
      return;
    }

    const byUid = new Map(entities.map(entity => [entity.editorEntityUID, entity]));
    const ancestorUIDs: string[] = [];
    const seen = new Set<string>([target.editorEntityUID]);
    let parentUid = target.editorParentEntity;
    while (parentUid && !seen.has(parentUid)) {
      seen.add(parentUid);
      ancestorUIDs.push(parentUid);
      parentUid = byUid.get(parentUid)?.editorParentEntity;
    }

    const hasCollapsedAncestor = ancestorUIDs.some(uid => collapsedUIDs.has(uid));
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchHidesTarget = normalizedQuery !== '' && !matchesHierarchySearch(target, normalizedQuery);

    if (hasCollapsedAncestor) {
      setCollapsedUIDs(previous => {
        const next = new Set(previous);
        ancestorUIDs.forEach(uid => next.delete(uid));
        return next;
      });
    }
    if (searchHidesTarget) {
      setSearchQuery('');
    }
    if (hasCollapsedAncestor || searchHidesTarget) return;

    const targetIdx = flatEntities.findIndex(n => n.entity.editorEntityUID === scrollHierarchyRequest.uid);
    if (targetIdx === -1 || !scrollContainerRef.current) {
      handledScrollNonceRef.current = scrollHierarchyRequest.nonce;
      return;
    }

    const targetY = targetIdx * ROW_HEIGHT;
    const targetScroll = Math.max(0, targetY - containerBounds.height / 2 + ROW_HEIGHT / 2);

    scrollContainerRef.current.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });
    handledScrollNonceRef.current = scrollHierarchyRequest.nonce;
  }, [scrollHierarchyRequest, entities, flatEntities, containerBounds.height, collapsedUIDs, searchQuery]);

  const handleSelectEntity = useCallback((uid: string, e: React.MouseEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isShift) {
      let anchorUid = selectionAnchorUid;
      if (anchorUid === null || !flatEntities.some(n => n.entity.editorEntityUID === anchorUid)) {
        anchorUid = selectedUIDs.length > 0 ? selectedUIDs[0] : uid;
      }

      const anchorIdx = flatEntities.findIndex(n => n.entity.editorEntityUID === anchorUid);
      const targetIdx = flatEntities.findIndex(n => n.entity.editorEntityUID === uid);

      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        const rangeUids = flatEntities.slice(start, end + 1).map(n => n.entity.editorEntityUID);

        if (isCtrl) {
          const combined = Array.from(new Set([...selectedUIDs, ...rangeUids]));
          setSelection(combined);
        } else {
          setSelection(rangeUids);
        }
      } else {
        selectEntity(uid);
      }
      setSelectionAnchorUid(anchorUid);
      setSelectionCaretUid(uid);
    } else if (isCtrl) {
      toggleSelection(uid);
      setSelectionAnchorUid(uid);
      setSelectionCaretUid(uid);
    } else {
      selectEntity(uid);
      setSelectionAnchorUid(uid);
      setSelectionCaretUid(uid);
    }
  }, [flatEntities, selectionAnchorUid, selectedUIDs, selectEntity, setSelection, toggleSelection]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      const allUids = flatEntities.map(n => n.entity.editorEntityUID);
      setSelection(allUids);
      setSelectionAnchorUid(allUids[0] ?? null);
      setSelectionCaretUid(allUids[allUids.length - 1] ?? null);
    } else if (isCtrl && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      e.stopPropagation();
      duplicateSelected();
    } else if (isCtrl && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      e.stopPropagation();
      copySelected();
    } else if (isCtrl && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      e.stopPropagation();
      pasteClipboard();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      selectEntity(null);
      setSelectionAnchorUid(null);
      setSelectionCaretUid(null);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatEntities.length === 0) return;

      let currentUid = selectionCaretUid;
      if (currentUid === null || !flatEntities.some(n => n.entity.editorEntityUID === currentUid)) {
        currentUid = [...selectedUIDs].reverse().find(uid => flatEntities.some(n => n.entity.editorEntityUID === uid))
          ?? flatEntities[0].entity.editorEntityUID;
      }

      const currentIdx = flatEntities.findIndex(n => n.entity.editorEntityUID === currentUid);
      if (currentIdx === -1) return;

      const nextIdx = e.key === 'ArrowDown'
        ? Math.min(flatEntities.length - 1, currentIdx + 1)
        : Math.max(0, currentIdx - 1);

      const nextEntity = flatEntities[nextIdx].entity;

      if (e.shiftKey) {
        let anchorUid = selectionAnchorUid;
        if (anchorUid === null || !flatEntities.some(n => n.entity.editorEntityUID === anchorUid)) {
          anchorUid = flatEntities[currentIdx]?.entity.editorEntityUID ?? nextEntity.editorEntityUID;
        }
        const anchorIdx = flatEntities.findIndex(n => n.entity.editorEntityUID === anchorUid);
        const start = Math.min(anchorIdx, nextIdx);
        const end = Math.max(anchorIdx, nextIdx);
        const rangeUids = flatEntities.slice(start, end + 1).map(n => n.entity.editorEntityUID);
        setSelection(rangeUids);
        setSelectionAnchorUid(anchorUid);
        setSelectionCaretUid(nextEntity.editorEntityUID);
      } else {
        selectEntity(nextEntity.editorEntityUID);
        setSelectionAnchorUid(nextEntity.editorEntityUID);
        setSelectionCaretUid(nextEntity.editorEntityUID);
      }
      scrollHierarchyToEntity(nextEntity.editorEntityUID);
    }
  }, [flatEntities, selectionAnchorUid, selectionCaretUid, selectedUIDs, selectEntity, setSelection, scrollHierarchyToEntity, duplicateSelected, copySelected, pasteClipboard]);

  const handleFocusEntity = useCallback((uid: string) => {
    focusEntity(uid);
  }, [focusEntity]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, uid: string) => {
    const uidsToDrag = selectedUIDs.includes(uid) ? selectedUIDs : [uid];
    e.dataTransfer.setData('text/plain', JSON.stringify(uidsToDrag));
    e.dataTransfer.effectAllowed = 'move';
  }, [selectedUIDs]);

  const handleDragOver = useCallback((_e: React.DragEvent, uid: string) => {
    if (dragTargetUid !== uid) {
      setDragTargetUid(uid);
    }
  }, [dragTargetUid]);

  const handleDragLeave = useCallback((_e: React.DragEvent, uid: string) => {
    if (dragTargetUid === uid) {
      setDragTargetUid(null);
    }
  }, [dragTargetUid]);

  const handleDrop = useCallback((e: React.DragEvent, uid: string | null) => {
    setDragTargetUid(null);
    try {
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;
      const childUids: string[] = JSON.parse(data);
      setParentEntities(childUids, uid);
    } catch (err) {
      console.error('Invalid drop data', err);
    }
  }, [setParentEntities]);

  const trimmedQuery = searchQuery.trim();

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="hierarchy-ui flex h-full select-none flex-col bg-gray-900 outline-none border-r border-gray-800"
    >
      {/* Header Panel */}
      <div className="hierarchy-header flex items-center justify-between border-b border-gray-800 bg-gray-900/90 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Thu nhỏ Hierarchy (Collapse)"
            className="hierarchy-collapse-button text-xs text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded hover:bg-gray-800"
            >
              ◀
            </button>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
            Hierarchy
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedUIDs.length === 1 ? (
            <button
              type="button"
              onClick={() => addEmptyEntity(selectedUIDs[0])}
            className="hierarchy-header-action hierarchy-add-child flex items-center gap-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-[10px] font-medium px-2 py-0.5 rounded border border-indigo-700/60 transition-colors shadow-xs"
              title={`Tạo Empty Child dưới node đang chọn`}
            >
              <span>+ Child</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => addEmptyEntity(null)}
            className="hierarchy-header-action hierarchy-add-root flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-medium px-2 py-0.5 rounded border border-gray-700 transition-colors"
            title="Tạo Empty Entity ở cấp Root"
          >
            <span>+ Empty</span>
          </button>
          <span className="hierarchy-count text-[11px] font-mono text-gray-500 bg-gray-800/80 px-1.5 py-0.5 rounded">
            {trimmedQuery ? `${flatEntities.length}/${entities.length}` : entities.length}
          </span>
        </div>
      </div>

      {/* Search Bar & Active Scene Name */}
      <div className="hierarchy-search-area px-2 py-1.5 border-b border-gray-800 bg-gray-900/60 flex flex-col gap-1.5">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search name, #ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setSearchQuery('');
              }
            }}
            className="hierarchy-search w-full editor-input pl-2 pr-6 py-1 placeholder-gray-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="Clear search (Esc)"
              className="hierarchy-search-clear absolute right-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded"
            >
              ✕
            </button>
          )}
        </div>
        {sceneNameDisplay && (
          <div className="hierarchy-scene-context flex items-center px-1 text-gray-400 gap-1 truncate">
            <span className="hierarchy-scene-label text-[10px] uppercase font-bold tracking-wider text-gray-500 shrink-0">SCENE:</span>
            <span className="hierarchy-scene-name text-[11px] font-medium truncate text-gray-300" title={activeSceneName!}>
              {sceneNameDisplay}
            </span>
          </div>
        )}
      </div>

      {/* Virtualized Tree List Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(e, null);
        }}
        className="flex-1 overflow-y-auto hierarchy-scrollbar relative overflow-x-hidden"
      >
        {entities.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs italic text-gray-500">
            No entities in scene
          </div>
        ) : flatEntities.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-gray-500">
            <p>No entities match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-indigo-400 hover:text-indigo-300 underline text-xs transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: `${totalHeight}px` }}>
            {visibleEntities.map(({ index: i, flatNode }) => {
              const { entity, depth, hasChildren } = flatNode;
              const isSelected = selectedUIDs.includes(entity.editorEntityUID);
              const top = i * ROW_HEIGHT;
              const isDragTarget = dragTargetUid === entity.editorEntityUID;
              const isCollapsed = collapsedUIDs.has(entity.editorEntityUID);
              const isPrefab = Boolean(entity.entityName && entity.entityName.toLowerCase().endsWith('.ent'));

              return (
                <HierarchyItem
                  key={entity.editorEntityUID}
                  uid={entity.editorEntityUID}
                  id={entity.id}
                  name={entity.editorEntityName || entity.entityName || ''}
                  posX={entity.position.x}
                  posY={entity.position.y}
                  posZ={entity.position.z}
                  hide={entity.hide}
                  isSelected={isSelected}
                  depth={depth}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  isDragTarget={isDragTarget}
                  isPrefab={isPrefab}
                  style={{
                    top: `${top}px`,
                    height: `${ROW_HEIGHT}px`,
                  }}
                  onSelect={handleSelectEntity}
                  onFocus={handleFocusEntity}
                  onToggleExpand={handleToggleExpand}
                  onToggleHide={handleToggleHide}
                  onAddEmptyChild={addEmptyEntity}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
