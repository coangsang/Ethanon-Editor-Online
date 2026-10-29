import { useEffect, useMemo, useState } from 'react';
import type { EntityInstance } from '../types';

interface EntityRefPickerModalProps {
  isOpen: boolean;
  entities: EntityInstance[];
  excludeEntityUid?: string;
  selectedEntityUid?: string;
  onSelect: (editorEntityUID: string) => void;
  onClose: () => void;
}

export function EntityRefPickerModal({
  isOpen,
  entities,
  excludeEntityUid,
  selectedEntityUid,
  onSelect,
  onClose,
}: EntityRefPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const availableEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entities.filter(e => {
      if (excludeEntityUid && e.editorEntityUID === excludeEntityUid) return false;
      if (!q) return true;
      const displayName = (e.editorEntityName || e.entityName || '').toLowerCase();
      const rawName = (e.entityName || '').toLowerCase();
      const idStr = String(e.id);
      const uidStr = e.editorEntityUID.toLowerCase();
      return (
        displayName.includes(q) ||
        rawName.includes(q) ||
        idStr.includes(q) ||
        uidStr.includes(q)
      );
    });
  }, [entities, excludeEntityUid, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select Reference Entity"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
          <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Select Target Entity
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700"
            title="Close (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-gray-800 bg-gray-900/90">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Name, ID, or EID..."
            aria-label="Search reference entity"
            autoFocus
            className="w-full editor-input text-xs px-2.5 py-1.5 font-mono"
          />
        </div>

        {/* Vertical Entity List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2 hierarchy-scrollbar">
          {availableEntities.length === 0 ? (
            <div className="text-xs text-gray-500 italic text-center py-6">
              No matching entities found in scene
            </div>
          ) : (
            availableEntities.map(item => {
              const displayName = item.editorEntityName || item.entityName || '(unnamed)';
              const isSelected = item.editorEntityUID === selectedEntityUid;
              return (
                <button
                  key={item.editorEntityUID}
                  type="button"
                  onClick={() => {
                    onSelect(item.editorEntityUID);
                    onClose();
                  }}
                  className={`w-full text-left rounded border p-2.5 flex flex-col gap-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/50 text-gray-100'
                      : 'border-gray-800 bg-gray-950/60 hover:border-gray-600 hover:bg-gray-800/70 text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-200 truncate" title={displayName}>
                      Name: <span className="font-mono text-indigo-300">{displayName}</span>
                    </span>
                    {item.entityName && item.entityName !== displayName && (
                      <span className="text-[10px] font-mono text-gray-400 truncate max-w-[140px]" title={item.entityName}>
                        ({item.entityName})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-gray-400">
                    ID: <span className="text-gray-200">{item.id}</span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 truncate" title={item.editorEntityUID}>
                    EID: <span className="text-gray-300">{item.editorEntityUID}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-700 bg-gray-800/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

