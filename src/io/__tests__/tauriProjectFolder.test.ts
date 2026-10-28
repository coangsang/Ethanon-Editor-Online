import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openTauriProjectFolder } from '../tauriProjectFolder';
import { readProjectText } from '../projectFolder';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('Tauri project folder adapter', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation(async (command: string) => {
      if (command === 'open_project_session') return { sessionId: 7, name: 'project' };
      if (command === 'project_list_entries') return [{ name: 'scenes', kind: 'directory' }];
      if (command === 'project_file_exists') return true;
      if (command === 'project_read_binary') return new TextEncoder().encode('<scene />').buffer;
      return undefined;
    });
  });

  it('uses relative paths within the selected session for scene I/O', async () => {
    const root = await openTauriProjectFolder();
    const scenes = await root.getDirectoryHandle('scenes');
    const file = await scenes.getFileHandle('one.esc');
    expect(await readProjectText(file)).toBe('<scene />');
    const writable = await file.createWritable();
    await writable.write('<updated />');
    await writable.close();
    expect(invoke).toHaveBeenCalledWith('project_read_binary', { sessionId: 7, path: 'scenes/one.esc' });
    expect(invoke).toHaveBeenCalledWith('project_write_text', { sessionId: 7, path: 'scenes/one.esc', contents: '<updated />' });
    await root.release();
    await root.release();
    expect(invoke.mock.calls.filter(([command]) => command === 'release_project_session')).toHaveLength(1);
  });

  it('maps cancellation to AbortError', async () => {
    invoke.mockResolvedValueOnce(null);
    await expect(openTauriProjectFolder()).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes UTF-16LE bytes through the same project text decoder as web handles', async () => {
    const text = '<Ethanon><Entity><Sprite>legacy.png</Sprite></Entity></Ethanon>';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let index = 0; index < text.length; index++) {
      const unit = text.charCodeAt(index);
      bytes[2 + index * 2] = unit & 0xff;
      bytes[3 + index * 2] = unit >> 8;
    }
    invoke.mockImplementation(async (command: string) => {
      if (command === 'open_project_session') return { sessionId: 7, name: 'project' };
      if (command === 'project_list_entries') return [{ name: 'scenes', kind: 'directory' }];
      if (command === 'project_file_exists') return true;
      if (command === 'project_read_binary') return bytes.buffer;
      return undefined;
    });

    const root = await openTauriProjectFolder();
    const file = await (await root.getDirectoryHandle('scenes')).getFileHandle('legacy.esc');
    expect(await readProjectText(file)).toBe(text);
  });
});
