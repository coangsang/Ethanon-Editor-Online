import React, { useState, useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import type { PrefabExportOptions } from '../types';

interface ExportPrefabModalProps {
  isOpen: boolean;
  entityUid: string | null;
  defaultName?: string;
  onClose: () => void;
}

export function ExportPrefabModal({
  isOpen,
  entityUid,
  defaultName = '',
  onClose,
}: ExportPrefabModalProps) {
  const exportEntityAsPrefab = useSceneStore(s => s.exportEntityAsPrefab);
  const [filename, setFilename] = useState('');
  const [mode, setMode] = useState<'keepReference' | 'unpack'>('keepReference');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && defaultName) {
      const cleanName = defaultName.replace(/\.ent$/i, '').replace(/\.prf$/i, '');
      setFilename(`${cleanName}.prf`);
      setMode('keepReference');
    }
  }, [isOpen, defaultName]);

  if (!isOpen || entityUid === null) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;

    setIsSubmitting(true);
    try {
      const options: PrefabExportOptions = { mode };
      await exportEntityAsPrefab(entityUid, options, filename.trim());
      onClose();
    } catch (err) {
      console.error('Failed to export prefab:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/50">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="10" height="10" rx="1.5" />
              <path d="M3 8h10M8 3v10" />
            </svg>
            Export Entity as Prefab (.prf)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-xs p-1 rounded hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Prefab Filename:
            </label>
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="my_prefab.prf"
              required
              className="w-full editor-input px-3 py-1.5 text-xs rounded border border-gray-700 bg-gray-950 text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              File will be saved under the project's <code className="text-cyan-400 font-mono">/prefabs</code> directory.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Export Mode:
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 p-2 rounded bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="exportMode"
                  value="keepReference"
                  checked={mode === 'keepReference'}
                  onChange={() => setMode('keepReference')}
                  className="mt-0.5 text-indigo-500 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-gray-200 block">Keep Entity Reference</span>
                  <span className="text-[11px] text-gray-400 leading-tight block mt-0.5">
                    Retain <code className="text-indigo-300">&lt;FileName&gt;</code> tags referencing existing <code className="text-indigo-300">.ent</code> entity template files.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="exportMode"
                  value="unpack"
                  checked={mode === 'unpack'}
                  onChange={() => setMode('unpack')}
                  className="mt-0.5 text-indigo-500 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-gray-200 block">Unpack Entity (Inline Data)</span>
                  <span className="text-[11px] text-gray-400 leading-tight block mt-0.5">
                    Inline all template attributes directly into XML elements and remove <code className="text-amber-300">&lt;FileName&gt;</code> dependencies.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !filename.trim()}
              className="px-4 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 font-medium text-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Exporting...' : 'Export Prefab'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
