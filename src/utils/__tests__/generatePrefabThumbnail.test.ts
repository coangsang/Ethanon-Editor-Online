import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EntityInstance, EntityTemplate } from '../../types';
import {
  generatePrefabThumbnail,
  prefabThumbnailFileName,
  prefabNameFromThumbnailFile,
} from '../generatePrefabThumbnail';

describe('generatePrefabThumbnail', () => {
  it('correctly converts between prefab name and hidden thumbnail filename', () => {
    expect(prefabThumbnailFileName('chest.prf')).toBe('.chest.jpg');
    expect(prefabThumbnailFileName('chest')).toBe('.chest.jpg');
    expect(prefabThumbnailFileName('subfolder/hero.prf')).toBe('.subfolder/hero.jpg');

    expect(prefabNameFromThumbnailFile('.chest.jpg')).toBe('chest.prf');
    expect(prefabNameFromThumbnailFile('chest.jpg')).toBe('chest.prf');
  });

  describe('Ethanon entity reference resolution and thumbnail generation', () => {
    beforeEach(() => {
      // Mock Image if not in browser environment
      if (typeof globalThis.Image === 'undefined') {
        class MockImage {
          src = '';
          naturalWidth = 64;
          naturalHeight = 64;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor() {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        }
        // @ts-expect-error mock
        globalThis.Image = MockImage;
      }

      // Mock OffscreenCanvas if not in browser environment
      if (typeof globalThis.OffscreenCanvas === 'undefined') {
        class MockOffscreenCanvas {
          width: number;
          height: number;
          constructor(w: number, h: number) {
            this.width = w;
            this.height = h;
          }
          getContext() {
            return {
              fillStyle: '',
              fillRect: vi.fn(),
              drawImage: vi.fn(),
              save: vi.fn(),
              restore: vi.fn(),
              translate: vi.fn(),
              rotate: vi.fn(),
              scale: vi.fn(),
              imageSmoothingEnabled: true,
              imageSmoothingQuality: 'high',
              globalAlpha: 1,
              globalCompositeOperation: 'source-over',
            };
          }
          async convertToBlob() {
            return new Blob(['fake-jpg'], { type: 'image/jpeg' });
          }
        }
        // @ts-expect-error mock
        globalThis.OffscreenCanvas = MockOffscreenCanvas;
      }
    });

    it('resolves entity using entityName when FileName tag is present (reference entity)', async () => {
      // Standard Ethanon entity: has FileName tag marking it as reference,
      // and entityName is the actual reference template name
      const chestEntity: EntityInstance = {
        id: 1,
        entityName: 'chest',
        editorEntityUID: 'uid-chest',
        position: { x: 100, y: 200, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: {
          FileName: 'chest.ent', // Note: marks as reference, NOT a sprite image!
        },
      };

      const templates: Record<string, EntityTemplate> = {
        chest: {
          name: 'chest',
          spriteFile: 'chest.png',
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 1,
        },
      };

      const templateImageUrls: Record<string, string> = {
        'chest.png': 'blob:http://localhost:5173/fake-chest-uuid',
      };

      const blob = await generatePrefabThumbnail(
        chestEntity,
        [chestEntity],
        templates,
        templateImageUrls,
        {},
      );

      expect(blob).not.toBeNull();
      expect(blob?.type).toBe('image/jpeg');
    });

    it('returns null if entity has hide: true (hidden entities skipped)', async () => {
      const hiddenEntity: EntityInstance = {
        id: 1,
        entityName: 'chest',
        editorEntityUID: 'uid-chest-hidden',
        position: { x: 100, y: 200, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: true, // Marked as hidden!
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: {
          FileName: 'chest.ent',
        },
      };

      const templates: Record<string, EntityTemplate> = {
        chest: {
          name: 'chest',
          spriteFile: 'chest.png',
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 1,
        },
      };

      const templateImageUrls: Record<string, string> = {
        'chest.png': 'blob:http://localhost:5173/fake-chest-uuid',
      };

      const blob = await generatePrefabThumbnail(
        hiddenEntity,
        [hiddenEntity],
        templates,
        templateImageUrls,
        {},
      );

      expect(blob).toBeNull();
    });

    it('returns null if no entities in prefab have resolvable sprites', async () => {
      const invisibleLogicEntity: EntityInstance = {
        id: 1,
        entityName: 'trigger_zone',
        editorEntityUID: 'uid-trigger',
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        spriteFrame: 0,
        hide: false,
        flipX: false,
        flipY: false,
        customData: [],
        inlineEntityData: {
          FileName: 'trigger_zone.ent',
        },
      };

      const templates: Record<string, EntityTemplate> = {
        trigger_zone: {
          name: 'trigger_zone',
          spriteFile: '', // No sprite!
          spriteCut: { x: 1, y: 1 },
          type: 'horizontal',
          pivotAdjust: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          parallaxIntensity: 1,
        },
      };

      const blob = await generatePrefabThumbnail(
        invisibleLogicEntity,
        [invisibleLogicEntity],
        templates,
        {},
        {},
      );

      expect(blob).toBeNull();
    });
  });
});

