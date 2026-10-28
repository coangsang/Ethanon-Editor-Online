import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';

export function TauriCloseGuard() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitingForSave, setWaitingForSave] = useState(false);
  const [filename, setFilename] = useState('scene.esc');
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(false);
  const pendingCloseRef = useRef(false);
  const resolvingCloseRef = useRef(false);
  const destroyRequestedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeSceneName = useSceneStore(state => state.activeSceneName);
  const projectScenes = useSceneStore(state => state.projectScenes);
  const scenesHandle = useSceneStore(state => state.scenesHandle);
  const projectStatus = useSceneStore(state => state.projectStatus);

  const destroyWindow = useCallback(async () => {
    if (destroyRequestedRef.current) return;
    destroyRequestedRef.current = true;
    pendingCloseRef.current = false;
    try {
      await getCurrentWindow().destroy();
    } catch (cause) {
      destroyRequestedRef.current = false;
      pendingCloseRef.current = true;
      openRef.current = true;
      setOpen(true);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const resolvePendingClose = useCallback(() => {
    if (!pendingCloseRef.current || resolvingCloseRef.current) return;
    const state = useSceneStore.getState();
    if (state.projectStatus === 'saving') return;

    resolvingCloseRef.current = true;
    setWaitingForSave(false);
    try {
      if (state.projectStatus === 'ready' && !state.hasUnsavedChanges()) {
        void destroyWindow();
      } else {
        setError(state.projectError ?? 'The scene changed while saving. Save it again before closing.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      resolvingCloseRef.current = false;
    }
  }, [destroyWindow]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    const unsubscribe = useSceneStore.subscribe((state, previousState) => {
      if (
        pendingCloseRef.current &&
        previousState.projectStatus === 'saving' &&
        state.projectStatus !== 'saving'
      ) {
        resolvePendingClose();
      }
    });
    void getCurrentWindow().onCloseRequested(event => {
      event.preventDefault();
      if (openRef.current || destroyRequestedRef.current) return;
      try {
        const state = useSceneStore.getState();
        if (state.projectStatus === 'saving') {
          pendingCloseRef.current = true;
          openRef.current = true;
          setWaitingForSave(true);
          setError(null);
          setOpen(true);
          queueMicrotask(() => dialogRef.current?.focus());
          return;
        }
        if (!state.hasUnsavedChanges()) {
          void destroyWindow();
          return;
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      pendingCloseRef.current = true;
      openRef.current = true;
      setOpen(true);
      queueMicrotask(() => dialogRef.current?.focus());
    }).then(listener => {
      if (active) unlisten = listener;
      else listener();
    }).catch(cause => console.error('Cannot register close handler:', cause));
    return () => {
      active = false;
      pendingCloseRef.current = false;
      unsubscribe();
      unlisten?.();
    };
  }, [destroyWindow, resolvePendingClose]);

  if (!isTauri() || !open) return null;

  const saveInProgress = saving || waitingForSave || projectStatus === 'saving';

  const cancel = () => {
    if (saveInProgress) return;
    pendingCloseRef.current = false;
    openRef.current = false;
    setOpen(false);
    setWaitingForSave(false);
    setError(null);
  };

  const discard = () => {
    if (!saveInProgress) void destroyWindow();
  };

  const saveAndClose = async () => {
    if (saveInProgress) return;
    const state = useSceneStore.getState();
    if (!activeSceneName) {
      const name = filename.trim().toLowerCase().endsWith('.esc') ? filename.trim() : `${filename.trim()}.esc`;
      if (!scenesHandle || !filename.trim()) {
        setError('Open a project and enter a scene filename before saving.');
        return;
      }
      if (projectScenes.some(entry => entry.name.toLowerCase() === name.toLowerCase())) {
        setError('A scene with this name already exists. Choose another name.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      if (activeSceneName) await state.saveActiveScene();
      else await state.saveSceneAs(filename.trim());
      resolvePendingClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-guard-title"
        tabIndex={-1}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Escape') cancel();
        }}
        className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-xl"
      >
        <h2 id="close-guard-title" className="text-sm font-semibold text-gray-100">
          {saveInProgress ? 'Saving scene changes' : 'Unsaved scene changes'}
        </h2>
        <p className="mt-2 text-xs text-gray-300">
          {saveInProgress ? 'The editor will close when the current save completes.' : 'Save the current scene before closing the editor?'}
        </p>
        {!activeSceneName && (
          <label className="mt-3 block text-xs text-gray-300">
            Scene filename
            <input autoFocus disabled={saveInProgress} value={filename} onChange={event => setFilename(event.target.value)} className="editor-input mt-1 w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-gray-100 disabled:opacity-50" />
          </label>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2 text-xs">
          <button autoFocus={Boolean(activeSceneName) && !saveInProgress} disabled={saveInProgress} onClick={cancel} className="rounded border border-gray-700 px-3 py-1.5 text-gray-200 hover:bg-gray-800 disabled:opacity-50">Cancel</button>
          <button disabled={saveInProgress} onClick={discard} className="rounded border border-gray-700 px-3 py-1.5 text-gray-200 hover:bg-gray-800 disabled:opacity-50">Discard</button>
          <button disabled={saveInProgress} onClick={() => void saveAndClose()} className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500 disabled:opacity-50">{saveInProgress ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
