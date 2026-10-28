import { invoke } from '@tauri-apps/api/core';
import type { ProjectDirectoryHandle, ProjectFileHandle } from './projectFolder';

interface NativeSession {
  sessionId: number;
  name: string;
}

interface NativeEntry {
  name: string;
  kind: 'file' | 'directory';
}

export interface NativeProjectDirectoryHandle extends ProjectDirectoryHandle {
  release: () => Promise<void>;
}

function joinPath(parent: string, name: string): string {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid project item name.');
  }
  return parent ? `${parent}/${name}` : name;
}

function mediaType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' } as Record<string, string>)[extension ?? ''] ?? '';
}

export async function openTauriProjectFolder(): Promise<NativeProjectDirectoryHandle> {
  const session = await invoke<NativeSession | null>('open_project_session');
  if (!session) throw new DOMException('User aborted', 'AbortError');
  const { sessionId } = session;
  let released = false;
  const args = (path: string) => ({ sessionId, path });

  const fileHandle = (path: string, name: string): ProjectFileHandle => ({
    kind: 'file',
    name,
    getFile: async () => {
      const bytes = await invoke<ArrayBuffer>('project_read_binary', args(path));
      return new File([bytes], name, { type: mediaType(name) });
    },
    createWritable: async () => {
      let data: string | Blob | BufferSource | null = null;
      return {
        write: async (value) => { data = value; },
        close: async () => {
          if (typeof data === 'string') {
            await invoke('project_write_text', { ...args(path), contents: data });
          } else if (data !== null) {
            const bytes = data instanceof Blob
              ? new Uint8Array(await data.arrayBuffer())
              : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer, data instanceof ArrayBuffer ? 0 : data.byteOffset, data instanceof ArrayBuffer ? data.byteLength : data.byteLength);
            await invoke('project_write_binary', { ...args(path), contents: Array.from(bytes) });
          }
        },
      };
    },
  });

  const directoryHandle = (path: string, name: string): ProjectDirectoryHandle => ({
    kind: 'directory',
    name,
    getDirectoryHandle: async (child, options) => {
      const childPath = joinPath(path, child);
      if (options?.create) {
        await invoke('project_create_directory', args(childPath));
      } else {
        const entries = await invoke<NativeEntry[]>('project_list_entries', args(path));
        if (!entries.some(entry => entry.name === child && entry.kind === 'directory')) {
          throw new Error(`Directory "${child}" was not found.`);
        }
      }
      return directoryHandle(childPath, child);
    },
    getFileHandle: async (child, options) => {
      const childPath = joinPath(path, child);
      if (!options?.create && !await invoke<boolean>('project_file_exists', args(childPath))) {
        throw new Error(`File "${child}" was not found.`);
      }
      return fileHandle(childPath, child);
    },
    entries: async function* () {
      const entries = await invoke<NativeEntry[]>('project_list_entries', args(path));
      for (const entry of entries) {
        const childPath = joinPath(path, entry.name);
        yield [entry.name, entry.kind === 'directory'
          ? directoryHandle(childPath, entry.name)
          : fileHandle(childPath, entry.name)] as [string, ProjectFileHandle | ProjectDirectoryHandle];
      }
    },
  });

  return {
    ...directoryHandle('', session.name),
    release: async () => {
      if (released) return;
      await invoke('release_project_session', { sessionId });
      released = true;
    },
  };
}

export async function releaseTauriProjectFolder(handle: ProjectDirectoryHandle | null): Promise<void> {
  if (handle && 'release' in handle && typeof handle.release === 'function') {
    await handle.release();
  }
}
