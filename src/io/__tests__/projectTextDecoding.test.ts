import { describe, expect, it } from 'vitest';
import { decodeProjectText } from '../decodeProjectText';
import { readProjectText, rescanProject, type ProjectDirectoryHandle, type ProjectFileHandle } from '../projectFolder';

const ENTITY_XML = `<Ethanon><Entity type="2"><Sprite>legacy.png</Sprite><SpriteCut x="2" y="3" /><Particles><ParticleSystem particles="4"><Bitmap>dust.png</Bitmap></ParticleSystem></Particles></Entity></Ethanon>`;

function utf16(value: string, littleEndian: boolean) {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes.set(littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    bytes[2 + index * 2] = littleEndian ? unit & 0xff : unit >> 8;
    bytes[3 + index * 2] = littleEndian ? unit >> 8 : unit & 0xff;
  }
  return bytes.buffer;
}

function file(name: string, buffer: ArrayBuffer): ProjectFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => ({ arrayBuffer: async () => buffer } as File),
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  };
}

function directory(name: string, entries: Array<[string, ProjectFileHandle | ProjectDirectoryHandle]> = []): ProjectDirectoryHandle {
  return {
    kind: 'directory',
    name,
    getDirectoryHandle: async () => { throw new Error('Not found'); },
    getFileHandle: async () => { throw new Error('Not found'); },
    entries: async function* () { yield* entries; },
  };
}

describe('project text decoding', () => {
  it('decodes UTF-8, UTF-8 BOM, UTF-16LE BOM, and UTF-16BE BOM', () => {
    const utf8 = new TextEncoder().encode(ENTITY_XML);
    const utf8Bom = new Uint8Array(utf8.length + 3);
    utf8Bom.set([0xef, 0xbb, 0xbf]);
    utf8Bom.set(utf8, 3);

    expect(decodeProjectText(utf8.buffer)).toBe(ENTITY_XML);
    expect(decodeProjectText(utf8Bom.buffer)).toBe(ENTITY_XML);
    expect(decodeProjectText(utf16(ENTITY_XML, true))).toBe(ENTITY_XML);
    expect(decodeProjectText(utf16(ENTITY_XML, false))).toBe(ENTITY_XML);
  });

  it('rejects invalid UTF-8 instead of producing an empty template', async () => {
    const invalid = Uint8Array.from([0x3c, 0x80, 0x2f, 0x3e]).buffer;
    await expect(readProjectText(file('broken.ent', invalid))).rejects.toThrow();
  });

  it('loads UTF-8 and UTF-16LE templates with identical parsed fields and reports invalid templates', async () => {
    const utf8 = new TextEncoder().encode(ENTITY_XML).buffer;
    const entities = directory('entities', [
      ['utf8.ent', file('utf8.ent', utf8)],
      ['utf16.ent', file('utf16.ent', utf16(ENTITY_XML, true))],
      ['broken.ent', file('broken.ent', Uint8Array.from([0x3c, 0x80, 0x2f, 0x3e]).buffer)],
      ['missing-root.ent', file('missing-root.ent', new TextEncoder().encode('<Ethanon />').buffer)],
    ]);
    const root = directory('project');
    const scenes = directory('scenes');

    const scanned = await rescanProject(root, scenes, entities, null);

    expect(scanned.templates.utf8).toMatchObject({
      spriteFile: 'legacy.png',
      spriteCut: { x: 2, y: 3 },
      type: 'vertical',
      particleSystems: [{ bitmap: 'dust.png', particles: 4 }],
    });
    expect({ ...scanned.templates.utf16, name: 'utf8' }).toEqual(scanned.templates.utf8);
    expect(scanned.scanIssues).toEqual([
      expect.objectContaining({ path: 'broken.ent', stage: 'read' }),
      expect.objectContaining({ path: 'missing-root.ent', stage: 'parse', message: expect.stringContaining('missing <Ethanon><Entity> root') }),
    ]);
  });
});
