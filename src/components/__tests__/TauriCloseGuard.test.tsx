// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TauriCloseGuard } from '../TauriCloseGuard';
import { useSceneStore } from '../../store/sceneStore';

const destroy = vi.fn(async () => {});
let closeHandler: ((event: { preventDefault: () => void }) => void) | undefined;
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: typeof closeHandler) => {
      closeHandler = handler;
      return () => { closeHandler = undefined; };
    },
    destroy,
  }),
}));

describe('Tauri close guard', () => {
  beforeEach(() => {
    destroy.mockClear();
    useSceneStore.getState().loadScene('<Ethanon><SceneProperties /><EntitiesInScene /></Ethanon>');
    useSceneStore.setState({ activeSceneName: 'one.esc', activeSceneHandle: null, projectStatus: 'ready', projectError: null });
  });
  afterEach(() => cleanup());

  async function requestClose() {
    await waitFor(() => expect(closeHandler).toBeDefined());
    const preventDefault = vi.fn();
    act(() => closeHandler?.({ preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
  }

  it('closes a clean scene immediately', async () => {
    render(<TauriCloseGuard />);
    await requestClose();
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it('cancels or discards an unsaved scene as selected', async () => {
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
    render(<TauriCloseGuard />);
    await requestClose();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(destroy).not.toHaveBeenCalled();
    await requestClose();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it('keeps the window open when saving fails', async () => {
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
    useSceneStore.setState({ activeSceneHandle: {
      kind: 'file', name: 'one.esc',
      getFile: async () => new File([], 'one.esc'),
      createWritable: async () => { throw new Error('Disk full'); },
    } });
    render(<TauriCloseGuard />);
    await requestClose();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Disk full'));
    expect(destroy).not.toHaveBeenCalled();
  });

  it('saves an unsaved scene before closing', async () => {
    const write = vi.fn(async () => {});
    useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
    useSceneStore.setState({ activeSceneHandle: {
      kind: 'file', name: 'one.esc',
      getFile: async () => new File([], 'one.esc'),
      createWritable: async () => ({ write, close: async () => {} }),
    } });
    render(<TauriCloseGuard />);
    await requestClose();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledOnce();
  });

  it('queues a close request while saving and closes once the clean save completes', async () => {
    useSceneStore.setState({ projectStatus: 'saving' });
    render(<TauriCloseGuard />);

    await requestClose();
    expect(screen.getByRole('heading', { name: 'Saving scene changes' })).toBeTruthy();
    expect(screen.getByText('The editor will close when the current save completes.')).toBeTruthy();
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(destroy).not.toHaveBeenCalled();

    act(() => useSceneStore.setState({ projectStatus: 'ready' }));
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it('keeps the queued close dialog open when the in-flight save fails', async () => {
    useSceneStore.setState({ projectStatus: 'saving' });
    render(<TauriCloseGuard />);
    await requestClose();

    act(() => useSceneStore.setState({ projectStatus: 'error', projectError: 'Disk disconnected' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Disk disconnected'));
    expect(screen.getByRole('heading', { name: 'Unsaved scene changes' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('keeps the queued close dialog open when the scene changes during the save', async () => {
    useSceneStore.setState({ projectStatus: 'saving' });
    render(<TauriCloseGuard />);
    await requestClose();

    act(() => {
      useSceneStore.getState().updateSceneProps({ lightIntensity: 4 });
      useSceneStore.setState({ projectStatus: 'ready' });
    });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('changed while saving'));
    expect(destroy).not.toHaveBeenCalled();
  });

  it('coalesces repeated close requests while the current save is pending', async () => {
    useSceneStore.setState({ projectStatus: 'saving' });
    render(<TauriCloseGuard />);
    await requestClose();
    await requestClose();

    act(() => useSceneStore.setState({ projectStatus: 'ready' }));
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });
});
