import { create } from 'zustand';
import type { SceneData, SceneProperties, EntityInstance, EntityTemplate, ProjectPrefabEntry, ProjectSpriteItem, SpriteAtlas, PrefabExportOptions } from '../types';
import { parseScene, parseEntityTemplate } from '../io/parseScene';
import { parseTextureAtlas } from '../io/parseTextureAtlas';
import { serializeScene } from '../io/serializeScene';
import { serializePrefab } from '../io/serializePrefab';
import { computeLocalFromWorld } from '../utils/transformMath';
import { ensureEntExtension, entityHasFileNameTag } from '../utils/entityTemplate';
import { instantiatePrefab, cloneEntityTree } from '../utils/prefabUtils';
import { collectAffectedSubscriberUids, syncEntitiesCustomDataRefs } from '../utils/customDataRef';
import {
  applyLocalTransformPatch,
  applyWorldTransformPatches,
  buildHierarchyIndex,
  cascadeWorldTransforms,
  findEntityInIndex,
  getAllDescendantUIDs,
  normalizeHierarchy,
  syncLocalPositions,
  type LocalTransformPatch,
  type WorldTransformPatch,
} from '../utils/sceneHierarchy';
import {
  isUserAbortError,
  openProjectFolder,
  readSceneFile,
  refreshProjectPrefabs,
  refreshProjectScenes,
  rescanProject,
  revokeObjectUrls,
  writePrefabAs,
  writeSceneAs,
  writeSceneFile,
  getOrCreateThumbnailsHandle,
  writePrefabThumbnail,
  type ProjectDirectoryHandle,
  type ProjectFileHandle,
  type ProjectScanIssue,
  type ProjectSceneEntry,
} from '../io/projectFolder';
import { releaseTauriProjectFolder } from '../io/tauriProjectFolder';
import { generatePrefabThumbnail } from '../utils/generatePrefabThumbnail';
import { decodeProjectText } from '../io/decodeProjectText';
import { pushHistorySnapshot, type HistoryEntry } from './sceneHistory';
import { resetPerformanceProfiler, setPerformanceProfilerEnabled } from '../utils/performanceProfiler';

function snapVal(v: number, active: boolean, step = 16): number {
  return active ? Math.round(v / step) * step : Math.round(v);
}

const DEFAULT_SCENE: SceneData = {
  properties: {
    ambient: { r: 0.5, g: 0.5, b: 0.5 },
    lightIntensity: 2.0,
    zAxisDirection: { x: 0, y: -1 },
    parallaxIntensity: 3.0,
  },
  entities: [],
};

export type InspectorEditKey = 'identity' | 'transform' | 'scale' | 'spriteFlags' | 'spriteData' | 'material' | 'customData';
export type InspectorEditMutation = (entity: EntityInstance) => EntityInstance;

type FileWithRelativePath = File & { webkitRelativePath?: string };

const RECENT_PROJECTS_KEY = 'ethanon_editor_recent_projects';
const CLEAN_SCENE_FILE_KEY = 'ethanon_clean_scene_file';

function getCleanSceneFileFromStorage(): boolean {
  try {
    return localStorage.getItem(CLEAN_SCENE_FILE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getRecentProjectsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentProjectToStorage(name: string): string[] {
  try {
    const list = getRecentProjectsFromStorage().filter(p => p !== name);
    list.unshift(name);
    const updated = list.slice(0, 10);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getRecentProjectsFromStorage();
  }
}


interface SceneStore {
  scene: SceneData;
  selectedUIDs: string[];
  templates: Record<string, EntityTemplate>;
  templateImageUrls: Record<string, string>;
  templateAtlases: Record<string, SpriteAtlas>;
  projectSprites: ProjectSpriteItem[];

  projectName: string | null;
  rootHandle: ProjectDirectoryHandle | null;
  scenesHandle: ProjectDirectoryHandle | null;
  entitiesHandle: ProjectDirectoryHandle | null;
  prefabsHandle: ProjectDirectoryHandle | null;
  projectScenes: ProjectSceneEntry[];
  projectPrefabs: ProjectPrefabEntry[];
  prefabThumbnailUrls: Record<string, string>;
  activeSceneName: string | null;
  activeSceneHandle: ProjectFileHandle | null;
  projectStatus: 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  projectError: string | null;
  projectScanIssues: ProjectScanIssue[];
  recentProjects: string[];
  camera: { x: number; y: number; zoom: number };
  focusEntityRequest: { uid: string; nonce: number } | null;
  scrollHierarchyRequest: { uid: string; nonce: number } | null;
  pingTemplateRequest: { name: string; nonce: number } | null;
  pingSpriteRequest: { name: string; nonce: number } | null;
  tool: 'select' | 'grab' | 'move' | 'rotate';
  placingTemplate: string | null;
  placingPrefab: { name: string; entities: EntityInstance[] } | null;
  axisConstraint: 'free' | 'x' | 'y';
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showParticles: boolean;
  updateParticlesWhileMoving: boolean;
  showFps: boolean;
  showParticleFps: boolean;
  showPlacementProfiler: boolean;
  cleanSceneFile: boolean;
  parallaxOriginNormalized: { x: number; y: number };
  parallaxPreviewActive: boolean;
  history: HistoryEntry[];
  historyIndex: number;

  queueInspectorEdit: (uid: string, key: InspectorEditKey, mutation: InspectorEditMutation) => void;
  flushInspectorEdits: () => void;
  hasUnsavedChanges: () => boolean;

  loadScene: (xml: string) => void;
  openProject: () => Promise<void>;
  refreshProject: () => Promise<void>;
  openProjectScene: (sceneName: string) => Promise<void>;
  saveActiveScene: (options?: { clean?: boolean }) => Promise<void>;
  saveSceneAs: (filename: string, options?: { clean?: boolean }) => Promise<void>;
  exportEntityAsPrefab: (entityUid: string, options: PrefabExportOptions, filename: string) => Promise<void>;
  autoLoadPublicTemplates: () => Promise<void>;
  saveScene: (options?: { clean?: boolean }) => string;
  addEntity: (templateName: string, x: number, y: number) => void;
  addEmptyEntity: (parentUid?: string | null) => void;
  applyLive: (updates: Array<{ uid: string; x?: number; y?: number; angle?: number }>) => void;
  batchUpdate: (patches: Array<{ uid: string; patch: Partial<EntityInstance> }>) => void;
  updateEntity: (uid: string, patch: Partial<EntityInstance>) => void;
  updateWorldTransform: (patches: WorldTransformPatch[], preservePatchedTransforms?: boolean) => void;
  updateLocalTransform: (uid: string, patch: LocalTransformPatch) => void;
  clipboard: EntityInstance[] | null;
  deleteEntity: (uid: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  setParentEntities: (childUids: string[], parentUid: string | null) => void;
  selectEntity: (uid: string | null) => void;
  setSelection: (uids: string[]) => void;
  toggleSelection: (uid: string) => void;
  focusEntity: (uid: string) => void;
  scrollHierarchyToEntity: (uid: string) => void;
  pingTemplate: (name: string) => void;
  pingSprite: (name: string) => void;

  updateSceneProps: (patch: Partial<SceneProperties>) => void;
  setCamera: (patch: Partial<{ x: number; y: number; zoom: number }>) => void;
  loadTemplates: (files: FileList) => Promise<void>;
  setTool: (tool: 'select' | 'grab' | 'move' | 'rotate') => void;
  setAxisConstraint: (c: 'free' | 'x' | 'y') => void;
  setPlacingTemplate: (name: string | null) => void;
  setPlacingPrefab: (prefab: { name: string; entities: EntityInstance[] } | null) => void;
  instantiatePlacingPrefab: (x: number, y: number) => void;
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleSnap: () => void;
  toggleParticles: () => void;
  toggleUpdateParticlesWhileMoving: () => void;
  toggleFps: () => void;
  toggleParticleFps: () => void;
  togglePlacementProfiler: () => void;
  toggleCleanSceneFile: () => void;
  setParallaxOriginNormalized: (origin: { x: number; y: number }) => void;
  setParallaxPreviewActive: (active: boolean) => void;
  undo: () => void;
  redo: () => void;
}

export { getAllDescendantUIDs, getAllDescendantIds } from '../utils/sceneHierarchy';

export const useSceneStore = create<SceneStore>((set, get) => {
  let inspectorEdits = new Map<string, Map<InspectorEditKey, InspectorEditMutation>>();
  let inspectorTimer: ReturnType<typeof setTimeout> | null = null;
  let sceneVersion = 0;
  let savedSceneSnapshot = JSON.stringify(DEFAULT_SCENE);

  const clearInspectorEdits = () => {
    if (inspectorTimer) clearTimeout(inspectorTimer);
    inspectorTimer = null;
    inspectorEdits.clear();
    sceneVersion += 1;
  };

  const replaceScene = (state: Partial<SceneStore>) => {
    clearInspectorEdits();
    resetPerformanceProfiler();
    set(state);
  };

  return ({
  scene: DEFAULT_SCENE,
  selectedUIDs: [],
  templates: {},
  templateImageUrls: {},
  templateAtlases: {},

  projectName: null,
  rootHandle: null,
  scenesHandle: null,
  entitiesHandle: null,
  prefabsHandle: null,
  projectScenes: [],
  projectPrefabs: [],
  prefabThumbnailUrls: {},
  projectSprites: [],
  activeSceneName: null,
  activeSceneHandle: null,
  projectStatus: 'idle',
  projectError: null,
  projectScanIssues: [],
  recentProjects: getRecentProjectsFromStorage(),
  camera: { x: 0, y: 0, zoom: 1 },
  focusEntityRequest: null,
  scrollHierarchyRequest: null,
  pingTemplateRequest: null,
  pingSpriteRequest: null,
  tool: 'select',
  placingTemplate: null,
  placingPrefab: null,
  clipboard: null,
  axisConstraint: 'free',
  showGrid: true,
  gridSize: 16,
  snapToGrid: false,
  showParticles: true,
  updateParticlesWhileMoving: true,
  showFps: false,
  showParticleFps: false,
  showPlacementProfiler: false,
  cleanSceneFile: getCleanSceneFileFromStorage(),
  parallaxOriginNormalized: { x: 0.5, y: 0.5 },
  parallaxPreviewActive: false,
  history: [{ entities: [] }],
  historyIndex: 0,

  queueInspectorEdit: (uid, key, mutation) => {
    let editsForEntity = inspectorEdits.get(uid);
    if (!editsForEntity) {
      editsForEntity = new Map();
      inspectorEdits.set(uid, editsForEntity);
    }
    // Keep one queue slot per field group while composing the latest draft with
    // the prior draft. This lets sprite file/cut and other nested fields share a
    // group without either edit discarding the other.
    const previous = editsForEntity.get(key);
    editsForEntity.set(key, previous ? (entity => mutation(previous(entity))) : mutation);
    if (inspectorTimer) clearTimeout(inspectorTimer);
    const version = sceneVersion;
    inspectorTimer = setTimeout(() => {
      if (version === sceneVersion) get().flushInspectorEdits();
    }, 250);
  },

  flushInspectorEdits: () => {
    if (inspectorTimer) clearTimeout(inspectorTimer);
    inspectorTimer = null;
    if (inspectorEdits.size === 0) return;

    const batch = inspectorEdits;
    inspectorEdits = new Map();
    const { scene, history, historyIndex } = get();
    let entities = scene.entities;
    try {
      const depth = (uid: string) => {
        const byUid = new Map(entities.map(entity => [entity.editorEntityUID, entity]));
        let value = 0;
        let cursor = byUid.get(uid);
        while (cursor?.editorParentEntity) {
          value += 1;
          cursor = byUid.get(cursor.editorParentEntity);
        }
        return value;
      };
      for (const [uid, edits] of [...batch.entries()].sort(([a], [b]) => depth(a) - depth(b))) {
        for (const [key, mutation] of edits) {
          const current = entities.find(entity => entity.editorEntityUID === uid);
          if (!current) continue;
          const next = mutation(current);
          if (key === 'transform') {
            if (current.editorParentEntity) {
              entities = applyLocalTransformPatch(entities, uid, next.localPosition ?? {});
            } else {
              entities = applyWorldTransformPatches(entities, [{ uid, position: next.position, angle: next.angle }]);
            }
          } else {
            entities = entities.map(entity => entity.editorEntityUID === uid ? next : entity);
          }
        }
      }
      const affectedUids = collectAffectedSubscriberUids(entities, batch.keys());
      if (affectedUids.size > 0) {
        entities = syncEntitiesCustomDataRefs(entities, affectedUids);
      }
    } catch (error) {
      // Preserve the entire transaction; a later flush can retry it without publishing a partial scene.
      inspectorEdits = batch;
      throw error;
    }
    if (JSON.stringify(entities) === JSON.stringify(scene.entities)) return;
    const hist = pushHistorySnapshot(history, historyIndex, entities);
    set({ scene: { ...scene, entities }, ...hist });
  },

  hasUnsavedChanges: () => {
    get().flushInspectorEdits();
    return JSON.stringify(get().scene) !== savedSceneSnapshot;
  },

  loadScene: (xml) => {
    get().flushInspectorEdits();
    const scene = parseScene(xml);
    replaceScene({
      scene,
      selectedUIDs: [],
      history: [{ entities: JSON.parse(JSON.stringify(scene.entities)) }],
      historyIndex: 0,
    });
    savedSceneSnapshot = JSON.stringify(scene);
  },

  openProject: async () => {
    if (get().projectStatus === 'loading' || get().projectStatus === 'saving') return;
    get().flushInspectorEdits();
    if (JSON.stringify(get().scene) !== savedSceneSnapshot &&
        !window.confirm('Current scene has unsaved changes. Discard them and open another project?')) return;
    const sceneBeforeLoading = JSON.stringify(get().scene);
    const previousStatus = get().projectStatus;
    set({ projectStatus: 'loading', projectError: null });
    let loadedProject: Awaited<ReturnType<typeof openProjectFolder>> | null = null;
    try {
      const project = await openProjectFolder();
      loadedProject = project;

      const firstScene = project.scenes[0] ?? null;
      const scene = firstScene ? parseScene(await readSceneFile(firstScene.handle)) : DEFAULT_SCENE;
      if (JSON.stringify(get().scene) !== sceneBeforeLoading) {
        throw new Error('The current scene changed while the project was loading. Open Project was cancelled.');
      }

      const name = project.rootHandle.name;
      const recent = saveRecentProjectToStorage(name);
      const previousRootHandle = get().rootHandle;
      const currentUrls = get().templateImageUrls;
      const currentSprites = get().projectSprites;
      const currentThumbnailUrls = get().prefabThumbnailUrls;

      replaceScene({
        scene,
        selectedUIDs: [],
        templates: project.templates,
        templateImageUrls: project.templateImageUrls,
        templateAtlases: project.templateAtlases,
        projectSprites: project.sprites,

        projectName: name,
        rootHandle: project.rootHandle,
        scenesHandle: project.scenesHandle,
        entitiesHandle: project.entitiesHandle,
        prefabsHandle: project.prefabsHandle,
        projectScenes: project.scenes,
        projectPrefabs: project.prefabs,
        prefabThumbnailUrls: project.prefabThumbnailUrls,
        activeSceneName: firstScene?.name ?? null,
        activeSceneHandle: firstScene?.handle ?? null,
        projectStatus: 'ready',
        projectError: null,
        projectScanIssues: project.scanIssues,
        recentProjects: recent,
        camera: { x: 0, y: 0, zoom: 1 },
        focusEntityRequest: null,
        pingTemplateRequest: null,
        pingSpriteRequest: null,
        placingTemplate: null,
        placingPrefab: null,
        tool: 'select',
        parallaxPreviewActive: false,
        parallaxOriginNormalized: { x: 0.5, y: 0.5 },
        history: [{ entities: JSON.parse(JSON.stringify(scene.entities)) }],
        historyIndex: 0,
      });
      savedSceneSnapshot = JSON.stringify(scene);
      revokeObjectUrls(currentUrls, currentSprites.map(sprite => sprite.url));
      revokeObjectUrls(currentThumbnailUrls);
      void releaseTauriProjectFolder(previousRootHandle).catch(console.warn);
    } catch (e) {
      if (loadedProject) {
        revokeObjectUrls(loadedProject.templateImageUrls, loadedProject.sprites.map(sprite => sprite.url));
        revokeObjectUrls(loadedProject.prefabThumbnailUrls);
        void releaseTauriProjectFolder(loadedProject.rootHandle).catch(console.warn);
      }
      if (isUserAbortError(e)) {
        set({
          projectStatus: previousStatus === 'loading' ? 'idle' : previousStatus,
          projectError: null,
        });
        return;
      }
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : 'Failed to open project folder.',
      });
    }
  },

  refreshProject: async () => {
    if (get().projectStatus === 'loading' || get().projectStatus === 'saving') return;
    const { rootHandle, scenesHandle, entitiesHandle, prefabsHandle } = get();
    if (!rootHandle || !scenesHandle || !entitiesHandle) return;

    set({ projectStatus: 'loading', projectError: null });

    let rescanned: Awaited<ReturnType<typeof rescanProject>> | null = null;
    try {
      const currentUrls = get().templateImageUrls;
      const currentSprites = get().projectSprites;
      const currentThumbnailUrls = get().prefabThumbnailUrls;
      rescanned = await rescanProject(rootHandle, scenesHandle, entitiesHandle, prefabsHandle);

      set({
        prefabsHandle: rescanned.prefabsHandle,
        templates: rescanned.templates,
        templateImageUrls: rescanned.templateImageUrls,
        templateAtlases: rescanned.templateAtlases,
        projectSprites: rescanned.sprites,
        projectScenes: rescanned.scenes,
        projectPrefabs: rescanned.prefabs,
        prefabThumbnailUrls: rescanned.prefabThumbnailUrls,
        projectStatus: 'ready',
        projectError: null,
        projectScanIssues: rescanned.scanIssues,
      });
      revokeObjectUrls(currentUrls, currentSprites.map(sprite => sprite.url));
      revokeObjectUrls(currentThumbnailUrls);
    } catch (e) {
      if (rescanned) {
        revokeObjectUrls(rescanned.templateImageUrls, rescanned.sprites.map(sprite => sprite.url));
        revokeObjectUrls(rescanned.prefabThumbnailUrls);
      }
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : 'Failed to refresh project.',
      });
    }
  },

  openProjectScene: async (sceneName) => {
    if (get().projectStatus === 'loading' || get().projectStatus === 'saving') return;
    get().flushInspectorEdits();
    if (JSON.stringify(get().scene) !== savedSceneSnapshot &&
        !window.confirm('Current scene has unsaved changes. Discard them and open another scene?')) return;
    const sceneBeforeLoading = JSON.stringify(get().scene);
    const entry = get().projectScenes.find(scene => scene.name === sceneName);
    if (!entry) {
      set({ projectStatus: 'error', projectError: `Scene "${sceneName}" was not found in the project.` });
      return;
    }

    set({ projectStatus: 'loading', projectError: null });
    try {
      const scene = parseScene(await readSceneFile(entry.handle));
      if (JSON.stringify(get().scene) !== sceneBeforeLoading) {
        throw new Error('The current scene changed while the new scene was loading. Open Scene was cancelled.');
      }
      replaceScene({
        scene,
        selectedUIDs: [],
        activeSceneName: entry.name,
        activeSceneHandle: entry.handle,
        projectStatus: 'ready',
        projectError: null,
        placingTemplate: null,
        tool: 'select',
        history: [{ entities: JSON.parse(JSON.stringify(scene.entities)) }],
        historyIndex: 0,
      });
      savedSceneSnapshot = JSON.stringify(scene);
    } catch (e) {
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : `Failed to open scene "${sceneName}".`,
      });
    }
  },

  saveActiveScene: async (options) => {
    get().flushInspectorEdits();
    const { activeSceneHandle, scene } = get();
    if (!activeSceneHandle) {
      set({ projectStatus: 'error', projectError: 'No active project scene to save.' });
      return;
    }

    const syncedEntities = syncEntitiesCustomDataRefs(scene.entities);
    const syncedScene = syncedEntities !== scene.entities ? { ...scene, entities: syncedEntities } : scene;
    set({ projectStatus: 'saving', projectError: null, ...(syncedScene !== scene ? { scene: syncedScene } : {}) });
    try {
      await writeSceneFile(activeSceneHandle, serializeScene(syncedScene, options));
      savedSceneSnapshot = JSON.stringify(syncedScene);
      set({ projectStatus: 'ready', projectError: null });
    } catch (e) {
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : 'Failed to save scene.',
      });
    }
  },

  saveSceneAs: async (filename, options) => {
    get().flushInspectorEdits();
    const { scenesHandle, scene } = get();
    const trimmed = filename.trim();
    if (!trimmed) {
      set({ projectStatus: 'error', projectError: 'Scene filename cannot be empty.' });
      return;
    }
    if (!scenesHandle) {
      set({ projectStatus: 'error', projectError: 'Open a project before using Save As.' });
      return;
    }

    const syncedEntities = syncEntitiesCustomDataRefs(scene.entities);
    const syncedScene = syncedEntities !== scene.entities ? { ...scene, entities: syncedEntities } : scene;
    set({ projectStatus: 'saving', projectError: null, ...(syncedScene !== scene ? { scene: syncedScene } : {}) });
    try {
      const entry = await writeSceneAs(scenesHandle, trimmed, serializeScene(syncedScene, options));
      savedSceneSnapshot = JSON.stringify(syncedScene);
      set(state => ({
        projectScenes: [...state.projectScenes.filter(item => item.name !== entry.name), entry]
          .sort((a, b) => a.name.localeCompare(b.name)),
        activeSceneName: entry.name,
        activeSceneHandle: entry.handle,
      }));
      try {
        const scenes = await refreshProjectScenes(scenesHandle);
        const refreshedEntry = scenes.find(item => item.name === entry.name) ?? entry;
        set({
          projectScenes: scenes,
          activeSceneHandle: refreshedEntry.handle,
          projectStatus: 'ready',
          projectError: null,
        });
      } catch (e) {
        set({
          projectStatus: 'ready',
          projectError: `Scene saved, but failed to refresh project scenes: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    } catch (e) {
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : 'Failed to save scene as a new file.',
      });
    }
  },

  exportEntityAsPrefab: async (entityUid, options, filename) => {
    get().flushInspectorEdits();
    const { scene, rootHandle, prefabsHandle, templates, templateImageUrls, templateAtlases } = get();
    const rootEntity = scene.entities.find(e => e.editorEntityUID === entityUid);
    if (!rootEntity) {
      set({ projectStatus: 'error', projectError: 'Selected entity not found.' });
      return;
    }
    if (!rootHandle) {
      set({ projectStatus: 'error', projectError: 'Open a project before exporting a Prefab.' });
      return;
    }

    const trimmed = filename.trim();
    if (!trimmed) {
      set({ projectStatus: 'error', projectError: 'Prefab filename cannot be empty.' });
      return;
    }

    set({ projectStatus: 'saving', projectError: null });
    try {
      const targetPrefabsHandle = prefabsHandle ?? await rootHandle.getDirectoryHandle('prefabs', { create: true });
      const xml = serializePrefab(rootEntity, scene.entities, options, templates);
      const entry = await writePrefabAs(targetPrefabsHandle, trimmed, xml);
      const prefabs = await refreshProjectPrefabs(targetPrefabsHandle);

      // Generate and save thumbnail (non-blocking on failure)
      let newThumbnailUrls = get().prefabThumbnailUrls;
      try {
        const thumbnailBlob = await generatePrefabThumbnail(
          rootEntity,
          scene.entities,
          templates,
          templateImageUrls,
          templateAtlases,
        );
        if (thumbnailBlob) {
          // Get or create .thumbnails directory
          const thumbnailsHandle = await getOrCreateThumbnailsHandle(targetPrefabsHandle);
          if (thumbnailsHandle) {
            await writePrefabThumbnail(thumbnailsHandle, entry.name, thumbnailBlob);
            // Revoke old URL to avoid memory leak
            const oldUrl = newThumbnailUrls[entry.name];
            if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
            // Create a new blob URL for immediate display
            const newUrl = URL.createObjectURL(thumbnailBlob);
            newThumbnailUrls = { ...newThumbnailUrls, [entry.name]: newUrl };
            console.info(`[Prefab] 📸 Thumbnail saved for "${entry.name}" (${(thumbnailBlob.size / 1024).toFixed(1)} KB)`);
          } else {
            console.warn('[Prefab] ⚠️ Could not access or create .thumbnails folder.');
          }
        } else {
          console.info(`[Prefab] ℹ️ No visible sprites found in "${entry.name}", skipped thumbnail generation.`);
        }
      } catch (thumbErr) {
        console.warn('[Prefab] Failed to generate thumbnail:', thumbErr);
      }

      set({
        prefabsHandle: targetPrefabsHandle,
        projectPrefabs: prefabs,
        prefabThumbnailUrls: newThumbnailUrls,
        projectStatus: 'ready',
        projectError: null,
      });
    } catch (e) {
      set({
        projectStatus: 'error',
        projectError: e instanceof Error ? e.message : 'Failed to export Prefab.',
      });
    }
  },

  autoLoadPublicTemplates: async () => {
    const { scene, templates } = get();
    const names = [...new Set(
      scene.entities
        .filter(e => entityHasFileNameTag(e))
        .map(e => (e.entityName || '').replace(/\.ent$/i, ''))
        .filter(name => name && !templates[name]),
    )];
    if (names.length === 0) return;

    const newTemplates: Record<string, EntityTemplate> = {};
    const newAtlases: Record<string, SpriteAtlas> = {};
    await Promise.all(names.map(async (name) => {
      try {
        const resp = await fetch(`/entities/${name}.ent`);
        if (!resp.ok) return;
        const text = decodeProjectText(await resp.arrayBuffer());
        const template = parseEntityTemplate(name, text);
        newTemplates[name] = template;

        const basename = template.spriteFile.split('/').pop() ?? template.spriteFile;
        if (!basename) return;

        try {
          const atlasResp = await fetch(`/entities/${basename.replace(/\.[^.]+$/i, '.xml')}`);
          if (!atlasResp.ok) return;
          const atlas = parseTextureAtlas(decodeProjectText(await atlasResp.arrayBuffer()));
          newAtlases[template.spriteFile] = atlas;
          newAtlases[basename] = atlas;
          newAtlases[`entities/${basename}`] = atlas;
        } catch {
          // no atlas for this texture
        }
      } catch {
        // no .ent for this name
      }
    }));

    if (Object.keys(newTemplates).length > 0 || Object.keys(newAtlases).length > 0) {
      set(state => ({
        templates: { ...state.templates, ...newTemplates },
        templateAtlases: { ...state.templateAtlases, ...newAtlases },
      }));
    }
  },

  saveScene: (options) => {
    get().flushInspectorEdits();
    const { scene } = get();
    const syncedEntities = syncEntitiesCustomDataRefs(scene.entities);
    const syncedScene = syncedEntities !== scene.entities ? { ...scene, entities: syncedEntities } : scene;
    if (syncedScene !== scene) {
      set({ scene: syncedScene });
    }
    return serializeScene(syncedScene, options);
  },

  addEntity: (templateName, x, y) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex, snapToGrid, templates } = get();
    const maxId = scene.entities.length > 0
      ? Math.max(...scene.entities.map(e => e.id))
      : -1;
    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(templateName);
    const cleanEntityName = isImage
      ? templateName.replace(/\.[^.]+$/i, '')
      : templateName.replace(/\.ent$/i, '');
    const fileNameWithExt = isImage
      ? `${cleanEntityName}.ent`
      : ensureEntExtension(templateName);

    const newEntity: EntityInstance = {
      id: maxId + 1,
      entityName: fileNameWithExt,
      editorEntityName: fileNameWithExt,
      editorEntityUID: crypto.randomUUID(),
      position: { x: snapVal(x, snapToGrid), y: snapVal(y, snapToGrid), z: 0 },
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
      inlineTemplate: isImage && !templates[cleanEntityName] ? {
        name: cleanEntityName,
        spriteFile: templateName,
        spriteCut: { x: 1, y: 1 },
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 0,
      } : undefined,
      inlineEntityData: {
        FileName: fileNameWithExt,
      },
    };
    const newEntities = [...scene.entities, newEntity];
    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, selectedUIDs: [newEntity.editorEntityUID], ...hist });
  },

  addEmptyEntity: (parentUid = null) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex, camera, snapToGrid } = get();
    const maxId = scene.entities.length > 0
      ? Math.max(...scene.entities.map(e => e.id))
      : -1;
    const newUid = crypto.randomUUID();

    const parentEntity = parentUid
      ? scene.entities.find(e => e.editorEntityUID === parentUid)
      : null;

    let position = { x: snapVal(camera.x, snapToGrid), y: snapVal(camera.y, snapToGrid), z: 0 };
    let localPosition: { x: number; y: number; z: number; angle: number } | undefined = undefined;

    if (parentEntity) {
      position = { ...parentEntity.position };
      localPosition = { x: 0, y: 0, z: 0, angle: 0 };
    }

    const newEntity: EntityInstance = {
      id: maxId + 1,
      entityName: '',
      editorEntityName: 'Empty Entity',
      editorEntityUID: newUid,
      position,
      angle: 0,
      spriteFrame: 0,
      hide: false,
      flipX: false,
      flipY: false,
      customData: [],
      ...(parentEntity ? {
        editorParentEntity: parentEntity.editorEntityUID,
        localPosition,
      } : {}),
      inlineTemplate: {
        name: '',
        type: 'horizontal',
        pivotAdjust: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        parallaxIntensity: 1,
        blendMode: 0,
      },
      inlineEntityData: {
        shape: 1,
        sensor: 0,
        bullet: 0,
        fixedRotation: 0,
        friction: 1,
        density: 1,
        restitution: 0,
        gravityScale: 1,
        applyLight: 0,
        castShadow: 0,
        type: 0,
        static: 0,
        blendMode: 0,
        Particles: {},
      },
    };

    const newEntities = normalizeHierarchy([...scene.entities, newEntity]);
    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set(state => ({
      scene: { ...scene, entities: newEntities },
      selectedUIDs: [newUid],
      scrollHierarchyRequest: {
        uid: newUid,
        nonce: (state.scrollHierarchyRequest?.nonce ?? 0) + 1,
      },
      ...hist,
    }));
  },

  applyLive: (updates) => {
    const { scene } = get();
    const patches: WorldTransformPatch[] = updates.map(u => ({
      uid: u.uid,
      ...(u.x !== undefined && u.y !== undefined ? { position: { x: u.x, y: u.y } } : {}),
      ...(u.angle !== undefined ? { angle: u.angle } : {}),
    }));
    const newEntities = applyWorldTransformPatches(scene.entities, patches);

    set({
      scene: {
        ...scene,
        entities: newEntities,
      },
    });
  },

  batchUpdate: (patches) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex } = get();
    const patchMap = new Map(patches.map(p => [p.uid, p.patch]));
    let newEntities = scene.entities.map(e => {
      const patch = patchMap.get(e.editorEntityUID);
      return patch ? { ...e, ...patch } : e;
    });
    const updatedUids = new Set(patches.map(p => p.uid));
    newEntities = syncLocalPositions(newEntities, updatedUids);
    newEntities = cascadeWorldTransforms(newEntities, updatedUids);

    const affectedUids = collectAffectedSubscriberUids(newEntities, updatedUids);
    if (affectedUids.size > 0) {
      newEntities = syncEntitiesCustomDataRefs(newEntities, affectedUids);
    }

    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, ...hist });
  },

  updateEntity: (uidOrId, patch) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex } = get();
    const index = buildHierarchyIndex(scene.entities);
    const target = findEntityInIndex(index, uidOrId);
    if (!target) return;
    let newEntities = scene.entities.map(e => e.editorEntityUID === target.editorEntityUID ? { ...e, ...patch } : e);

    const affectedUids = collectAffectedSubscriberUids(newEntities, [target.editorEntityUID]);
    if (affectedUids.size > 0) {
      newEntities = syncEntitiesCustomDataRefs(newEntities, affectedUids);
    }

    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, ...hist });
  },

  updateWorldTransform: (patches, preservePatchedTransforms = false) => {
    get().flushInspectorEdits();
    if (patches.length === 0) return;
    const { scene, history, historyIndex } = get();
    const newEntities = applyWorldTransformPatches(scene.entities, patches, preservePatchedTransforms);
    if (newEntities === scene.entities) return;

    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, ...hist });
  },

  updateLocalTransform: (uidOrId, patch) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex } = get();
    const newEntities = applyLocalTransformPatch(scene.entities, uidOrId, patch);
    if (newEntities === scene.entities) return;

    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, ...hist });
  },

  deleteEntity: (uidOrId) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex, selectedUIDs } = get();
    const toDelete = getAllDescendantUIDs(scene.entities, new Set([uidOrId]));
    const newEntities = scene.entities.filter(e => !toDelete.has(e.editorEntityUID));
    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({
      scene: { ...scene, entities: newEntities },
      selectedUIDs: selectedUIDs.filter(suid => !toDelete.has(suid)),
      ...hist,
    });
  },

  deleteSelected: () => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex, selectedUIDs } = get();
    if (selectedUIDs.length === 0) return;
    const toDelete = getAllDescendantUIDs(scene.entities, new Set(selectedUIDs));
    const newEntities = scene.entities.filter(e => !toDelete.has(e.editorEntityUID));
    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, selectedUIDs: selectedUIDs.filter(suid => !toDelete.has(suid)), ...hist });
  },

  duplicateSelected: () => {
    get().flushInspectorEdits();
    const { scene, selectedUIDs, history, historyIndex } = get();
    if (selectedUIDs.length === 0) return;

    const allTargetUIDs = getAllDescendantUIDs(scene.entities, new Set(selectedUIDs));
    const entitiesToDuplicate = scene.entities.filter(e => allTargetUIDs.has(e.editorEntityUID));
    if (entitiesToDuplicate.length === 0) return;

    const { combinedEntities, newRootUids } = cloneEntityTree(entitiesToDuplicate, scene.entities, {
      positionOffset: { x: 16, y: 16 },
    });

    const hist = pushHistorySnapshot(history, historyIndex, combinedEntities);
    set({
      scene: { ...scene, entities: combinedEntities },
      selectedUIDs: newRootUids,
      ...hist,
    });
  },

  copySelected: () => {
    get().flushInspectorEdits();
    const { scene, selectedUIDs } = get();
    if (selectedUIDs.length === 0) return;

    const allTargetUIDs = getAllDescendantUIDs(scene.entities, new Set(selectedUIDs));
    const copiedEntities = scene.entities.filter(e => allTargetUIDs.has(e.editorEntityUID));
    if (copiedEntities.length === 0) return;

    set({ clipboard: JSON.parse(JSON.stringify(copiedEntities)) });
  },

  pasteClipboard: () => {
    get().flushInspectorEdits();
    const { scene, clipboard, history, historyIndex } = get();
    if (!clipboard || clipboard.length === 0) return;

    const { combinedEntities, newRootUids } = cloneEntityTree(clipboard, scene.entities, {
      positionOffset: { x: 16, y: 16 },
    });

    const hist = pushHistorySnapshot(history, historyIndex, combinedEntities);
    set({
      scene: { ...scene, entities: combinedEntities },
      selectedUIDs: newRootUids,
      ...hist,
    });
  },

  setParentEntities: (childUidsOrIds, parentUidOrId) => {
    get().flushInspectorEdits();
    const { scene, history, historyIndex } = get();
    const index = buildHierarchyIndex(scene.entities);
    const parentEntity = (parentUidOrId !== null && parentUidOrId !== undefined) ? findEntityInIndex(index, parentUidOrId) : null;
    const requestedChildUidSet = new Set<string>();
    for (const c of childUidsOrIds) {
      const ent = findEntityInIndex(index, c);
      if (ent) requestedChildUidSet.add(ent.editorEntityUID);
    }

    if (requestedChildUidSet.size === 0) return;

    const childUidSet = new Set([...requestedChildUidSet].filter(uid => {
      const seen = new Set<string>([uid]);
      let parentUid = index.byUid.get(uid)?.editorParentEntity;
      while (parentUid && !seen.has(parentUid)) {
        if (requestedChildUidSet.has(parentUid)) return false;
        seen.add(parentUid);
        parentUid = index.byUid.get(parentUid)?.editorParentEntity;
      }
      return true;
    }));

    if (parentEntity) {
      const descendantsOfChildren = getAllDescendantUIDs(scene.entities, childUidSet);
      if (descendantsOfChildren.has(parentEntity.editorEntityUID)) return;
    }

    const parentUID = parentEntity?.editorEntityUID;
    const movedOrderBase = Number.MAX_SAFE_INTEGER - childUidSet.size;
    let movedIndex = 0;

    const newEntities = normalizeHierarchy(scene.entities.map(e => {
      if (!childUidSet.has(e.editorEntityUID)) return e;

      if (!parentEntity || parentUidOrId === null) {
        return {
          ...e,
          editorParentEntity: undefined,
          localPosition: undefined,
          editorHierarchyOrder: movedOrderBase + movedIndex++,
        };
      }

      const local = computeLocalFromWorld(
        { x: parentEntity.position.x, y: parentEntity.position.y, angle: parentEntity.angle },
        { x: e.position.x, y: e.position.y, angle: e.angle }
      );

      return {
        ...e,
        editorParentEntity: parentUID,
        editorHierarchyOrder: movedOrderBase + movedIndex++,
        localPosition: {
          x: local.x,
          y: local.y,
          z: (e.position.z ?? 0) - (parentEntity.position.z ?? 0),
          angle: local.angle,
        },
      };
    }));

    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    set({ scene: { ...scene, entities: newEntities }, ...hist });
  },

  selectEntity: (uid) => {
    get().flushInspectorEdits();
    const { scene } = get();
    const nextSelectedUIDs = uid !== null ? [uid] : [];
    const syncedEntities = nextSelectedUIDs.length > 0
      ? syncEntitiesCustomDataRefs(scene.entities, nextSelectedUIDs)
      : scene.entities;
    set({
      selectedUIDs: nextSelectedUIDs,
      ...(syncedEntities !== scene.entities ? { scene: { ...scene, entities: syncedEntities } } : {}),
    });
  },
  setSelection: (uids) => {
    get().flushInspectorEdits();
    const { scene } = get();
    const syncedEntities = uids.length > 0
      ? syncEntitiesCustomDataRefs(scene.entities, uids)
      : scene.entities;
    set({
      selectedUIDs: uids,
      ...(syncedEntities !== scene.entities ? { scene: { ...scene, entities: syncedEntities } } : {}),
    });
  },
  toggleSelection: (uid) => {
    get().flushInspectorEdits();
    const { selectedUIDs, scene } = get();
    const nextSelectedUIDs = selectedUIDs.includes(uid)
      ? selectedUIDs.filter(suid => suid !== uid)
      : [...selectedUIDs, uid];
    const syncedEntities = nextSelectedUIDs.length > 0
      ? syncEntitiesCustomDataRefs(scene.entities, nextSelectedUIDs)
      : scene.entities;
    set({
      selectedUIDs: nextSelectedUIDs,
      ...(syncedEntities !== scene.entities ? { scene: { ...scene, entities: syncedEntities } } : {}),
    });
  },
  focusEntity: (uid) => set(state => ({
    focusEntityRequest: {
      uid,
      nonce: (state.focusEntityRequest?.nonce ?? 0) + 1,
    },
  })),
  scrollHierarchyToEntity: (uid) => set(state => ({
    scrollHierarchyRequest: {
      uid,
      nonce: (state.scrollHierarchyRequest?.nonce ?? 0) + 1,
    },
  })),
  pingTemplate: (name: string) => set(state => ({
    pingTemplateRequest: {
      name,
      nonce: (state.pingTemplateRequest?.nonce ?? 0) + 1,
    },
  })),
  pingSprite: (name: string) => set(state => ({
    pingSpriteRequest: {
      name,
      nonce: (state.pingSpriteRequest?.nonce ?? 0) + 1,
    },
  })),

  updateSceneProps: (patch) => {
    const { scene } = get();
    set({ scene: { ...scene, properties: { ...scene.properties, ...patch } } });
  },

  setCamera: (patch) => set(state => ({ camera: { ...state.camera, ...patch } })),

  loadTemplates: async (files: FileList) => {
    const templates: Record<string, EntityTemplate> = { ...get().templates };
    const imageUrls: Record<string, string> = { ...get().templateImageUrls };
    const atlases: Record<string, SpriteAtlas> = { ...get().templateAtlases };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = (file as FileWithRelativePath).webkitRelativePath || file.name;

      if (/\.ent$/i.test(file.name)) {
        const name = file.name.replace(/\.ent$/i, '');
        try {
          const text = decodeProjectText(await file.arrayBuffer());
          templates[name] = parseEntityTemplate(name, text);
        } catch (e) {
          console.warn('Failed to parse entity:', file.name, e);
        }
      } else if (file.name.toLowerCase().endsWith('.xml')) {
        try {
          const text = decodeProjectText(await file.arrayBuffer());
          const atlas = parseTextureAtlas(text);
          const imageName = file.name.replace(/\.xml$/i, '.png');
          const basename = imageName.split('/').pop() ?? imageName;
          atlases[imageName] = atlas;
          atlases[basename] = atlas;
          atlases[`entities/${basename}`] = atlas;
          atlases[relativePath.replace(/\.xml$/i, '.png')] = atlas;
        } catch (e) {
          console.warn('Failed to parse texture atlas:', file.name, e);
        }
      } else if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) {
        const url = URL.createObjectURL(file);
        const basename = file.name;
        imageUrls[file.name] = url;
        imageUrls['entities/' + basename] = url;
        imageUrls[relativePath] = url;
        if (basename !== relativePath) imageUrls[basename] = url;
      }
    }

    // Build projectSprites list from imageUrls and templates
    const rawImageKeys = Object.keys(imageUrls).filter(k =>
      /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(k) && !k.toLowerCase().startsWith('entities/')
    );
    const uniqueImages = Array.from(new Set(rawImageKeys));
    const projectSprites: ProjectSpriteItem[] = uniqueImages.map(key => {
      const filename = key.split('/').pop() ?? key;
      const url = imageUrls[key];
      const atlas = atlases[key] ?? atlases[filename];
      const usedBy: string[] = [];
      const lowerKey = key.toLowerCase();
      const lowerFilename = filename.toLowerCase();

      for (const [tName, tmpl] of Object.entries(templates)) {
        if (tmpl.spriteFile) {
          const normSprite = tmpl.spriteFile.replace(/\\/g, '/').toLowerCase();
          const baseSprite = normSprite.split('/').pop() ?? normSprite;
          if (normSprite === lowerKey || baseSprite === lowerFilename) {
            if (!usedBy.includes(tName)) {
              usedBy.push(tName);
            }
          }
        }
      }

      return {
        name: filename,
        relativePath: key,
        url,
        hasAtlas: Boolean(atlas),
        atlasFrameCount: atlas?.frames?.length,
        usedByTemplates: usedBy.sort(),
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    set({ templates, templateImageUrls: imageUrls, templateAtlases: atlases, projectSprites });
  },

  setTool: (tool) => set({ tool, axisConstraint: 'free', placingTemplate: null, placingPrefab: null }),
  setAxisConstraint: (c) => set({ axisConstraint: c }),
  setPlacingTemplate: (name) => set({ placingTemplate: name, placingPrefab: null }),
  setPlacingPrefab: (prefab) => set({ placingPrefab: prefab, placingTemplate: null, tool: 'select' }),
  instantiatePlacingPrefab: (x, y) => {
    get().flushInspectorEdits();
    const { scene, placingPrefab, history, historyIndex, snapToGrid, gridSize } = get();
    if (!placingPrefab || placingPrefab.entities.length === 0) return;

    const posX = snapVal(x, snapToGrid, gridSize);
    const posY = snapVal(y, snapToGrid, gridSize);

    const oldLength = scene.entities.length;
    const newEntities = instantiatePrefab(placingPrefab.entities, { x: posX, y: posY }, scene.entities);
    const hist = pushHistorySnapshot(history, historyIndex, newEntities);
    const newRootUid = newEntities[oldLength]?.editorEntityUID;

    set({
      scene: { ...scene, entities: newEntities },
      selectedUIDs: newRootUid ? [newRootUid] : [],
      ...hist,
    });
  },
  toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
  setGridSize: (size) => set({ gridSize: size }),
  toggleSnap: () => set(state => ({ snapToGrid: !state.snapToGrid })),
  toggleParticles: () => set(state => ({ showParticles: !state.showParticles })),
  toggleUpdateParticlesWhileMoving: () => set(state => ({ updateParticlesWhileMoving: !state.updateParticlesWhileMoving })),
  toggleFps: () => set(state => ({ showFps: !state.showFps })),
  toggleParticleFps: () => set(state => ({ showParticleFps: !state.showParticleFps })),
  togglePlacementProfiler: () => set(state => {
    const showPlacementProfiler = import.meta.env.DEV && !state.showPlacementProfiler;
    setPerformanceProfilerEnabled(showPlacementProfiler);
    return { showPlacementProfiler };
  }),
  toggleCleanSceneFile: () => {
    const next = !get().cleanSceneFile;
    try {
      localStorage.setItem(CLEAN_SCENE_FILE_KEY, String(next));
    } catch {
      // ignore
    }
    set({ cleanSceneFile: next });
  },
  setParallaxOriginNormalized: (origin) => set({ parallaxOriginNormalized: origin }),
  setParallaxPreviewActive: (active) => set({ parallaxPreviewActive: active }),

  undo: () => {
    get().flushInspectorEdits();
    const { history, historyIndex, scene } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({
      scene: { ...scene, entities: JSON.parse(JSON.stringify(history[newIndex].entities)) },
      historyIndex: newIndex,
      selectedUIDs: [],
    });
  },

  redo: () => {
    get().flushInspectorEdits();
    const { history, historyIndex, scene } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({
      scene: { ...scene, entities: JSON.parse(JSON.stringify(history[newIndex].entities)) },
      historyIndex: newIndex,
      selectedUIDs: [],
    });
  },
  });
});
