import { XMLParser } from 'fast-xml-parser';
import type { SpriteAtlas, SpriteAtlasFrame } from '../types';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

type RawTextureAtlas = {
  imagePath?: string | number;
  width?: string | number;
  height?: string | number;
  sprite?: RawAtlasSprite | RawAtlasSprite[];
};

type RawAtlasSprite = {
  n?: string | number;
  x?: string | number;
  y?: string | number;
  w?: string | number;
  h?: string | number;
  pX?: string | number;
  pY?: string | number;
  oX?: string | number;
  oY?: string | number;
  oW?: string | number;
  oH?: string | number;
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toFiniteNumber(value: string | number | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAtlasFrame(sprite: RawAtlasSprite): SpriteAtlasFrame {
  const width = Math.max(0, toFiniteNumber(sprite.w, 0));
  const height = Math.max(0, toFiniteNumber(sprite.h, 0));

  return {
    name: String(sprite.n ?? ''),
    x: Math.max(0, toFiniteNumber(sprite.x, 0)),
    y: Math.max(0, toFiniteNumber(sprite.y, 0)),
    width,
    height,
    pivotX: toFiniteNumber(sprite.pX, 0.5),
    pivotY: toFiniteNumber(sprite.pY, 0.5),
    offsetX: toFiniteNumber(sprite.oX, 0),
    offsetY: toFiniteNumber(sprite.oY, 0),
    originalWidth: Math.max(1, toFiniteNumber(sprite.oW, width || 1)),
    originalHeight: Math.max(1, toFiniteNumber(sprite.oH, height || 1)),
  };
}

export function parseTextureAtlas(xmlString: string): SpriteAtlas {
  const doc = parser.parse(xmlString);
  const root: RawTextureAtlas = doc.TextureAtlas;
  if (!root) {
    throw new Error('TextureAtlas root element was not found.');
  }

  return {
    imagePath: String(root.imagePath ?? ''),
    width: Math.max(1, toFiniteNumber(root.width, 1)),
    height: Math.max(1, toFiniteNumber(root.height, 1)),
    frames: toArray(root.sprite)
      .map(parseAtlasFrame)
      .filter(frame => frame.width > 0 && frame.height > 0),
  };
}
