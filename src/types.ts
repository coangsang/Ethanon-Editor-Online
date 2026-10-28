import type { ProjectFileHandle } from './io/projectFolder';

export interface SceneProperties {
  ambient: { r: number; g: number; b: number };
  lightIntensity: number;
  zAxisDirection: { x: number; y: number };
  parallaxIntensity: number;
}

export interface EntityInstance {
  id: number;
  entityName: string;
  editorEntityName?: string;
  editorEntityUID: string;
  position: { x: number; y: number; z: number };
  angle: number;
  spriteFrame: number;
  hide: boolean;
  flipX: boolean;
  flipY: boolean;
  color?: { r: number; g: number; b: number; a: number };
  diffuseColor?: { r: number; g: number; b: number; a: number };
  customData: CustomDataVariable[];
  inlineTemplate?: InlineEntityTemplate;
  inlineEntityData?: Record<string, unknown>;
  editorParentEntity?: string;
  editorHierarchyOrder?: number;
  localPosition?: { x: number; y: number; z: number; angle: number };
}

export type EntityType = 'horizontal' | 'ground_decal' | 'vertical' | 'opaque_decal' | 'overall' | 'layerable';

export type CustomDataVectorValue = {
  x: number;
  y: number;
  z?: number;
};

export type CustomDataValue = string | CustomDataVectorValue;

export interface CustomDataVariable {
  type: string;
  name: string;
  value: CustomDataValue;
}

export interface ParticleSystemConfig {
  particles: number;
  allAtOnce: boolean;
  alphaMode: number;
  repeat: number;
  animationMode: number;
  boundingSphere: number;
  lifeTime: number;
  randomLifeTime: number;
  angleDir: number;
  randAngle: number;
  size: number;
  randomizeSize: number;
  growth: number;
  minSize: number;
  maxSize: number;
  angleStart: number;
  randAngleStart: number;
  bitmap: string;
  gravity: { x: number; y: number };
  direction: { x: number; y: number };
  randomizeDir: { x: number; y: number };
  spriteCut: { x: number; y: number };
  startPoint: { x: number; y: number; z: number };
  randStartPoint: { x: number; y: number };
  color0: { r: number; g: number; b: number; a: number };
  color1: { r: number; g: number; b: number; a: number };
  luminance: { r: number; g: number; b: number };
}

export interface EntityTemplate {
  name: string;
  spriteFile: string;
  spriteCut: { x: number; y: number };
  type: EntityType;
  pivotAdjust: { x: number; y: number };
  scale: { x: number; y: number };
  parallaxIntensity: number;
  blendMode?: number;
  diffuseColor?: { r: number; g: number; b: number; a: number };
  emissiveColor?: { r: number; g: number; b: number; a: number };
  particleSystems?: ParticleSystemConfig[];
  customData?: CustomDataVariable[];
  rawEntityData?: Record<string, unknown>;
}

export type InlineEntityTemplate = Partial<Omit<EntityTemplate, 'name'>> & {
  name: string;
};

export interface SpriteAtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  offsetX: number;
  offsetY: number;
  originalWidth: number;
  originalHeight: number;
}

export interface SpriteAtlas {
  imagePath: string;
  width: number;
  height: number;
  frames: SpriteAtlasFrame[];
}

export interface ProjectSpriteItem {
  name: string;
  relativePath: string;
  url: string;
  hasAtlas: boolean;
  atlasFrameCount?: number;
  usedByTemplates: string[];
}

export interface ProjectSceneEntry {
  name: string;
  handle: ProjectFileHandle;
}

export interface ProjectPrefabEntry {
  name: string;
  handle: ProjectFileHandle;
  entities: EntityInstance[];
}

export interface PrefabExportOptions {
  mode: 'keepReference' | 'unpack';
}

export interface SceneData {
  properties: SceneProperties;
  entities: EntityInstance[];
}

