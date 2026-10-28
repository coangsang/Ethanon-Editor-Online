/* eslint react-hooks/immutability: off */
import { useCallback, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { isTauri } from '@tauri-apps/api/core';
import { useSceneStore } from '../store/sceneStore';
import { PARTICLE_SYSTEM_UPDATE_TIME_MS, computeAdaptiveGridStep } from './viewportMath';
import type { ViewportRefs } from './viewportTypes';

type UsePixiStageParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  showGrid: boolean;
};

export type ViewportRuntimeState = {
  status: 'initializing' | 'ready' | 'recovering' | 'error';
  message: string | null;
  canRetry: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resetStageRefs(refs: ViewportRefs) {
  refs.appRef.current = null;
  refs.worldRef.current = null;
  refs.gridRef.current = null;
  refs.entitiesContainerRef.current = null;
  refs.selectionRef.current = null;
  refs.marqueeGraphicsRef.current = null;
  refs.moveGizmoContainerRef.current = null;
  refs.spriteMapRef.current.clear();
  refs.boundsMapRef.current.clear();
  refs.activeParticleRuntimeKeysRef.current.clear();
  refs.particleHostStatesRef.current.clear();
  refs.particleCullingEntriesRef.current.clear();
  refs.drawSortSignatureRef.current = '';
  refs.parallaxGeometryActiveRef.current = false;
  refs.parallaxEntityUIDsRef.current.clear();
  refs.placePreviewMeshRef.current = null;
  refs.placePreviewGraphicsRef.current = null;
  refs.meshSyncRefsRef.current = {
    entities: null,
    parallaxIntensity: null,
    zAxisDirection: null,
    templates: null,
    templateAtlases: null,
    textureRevision: -1,
    parallaxOrigin: null,
    parallaxActive: false,
  };
}

export function usePixiStage({ refs, camera, showGrid }: UsePixiStageParams) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [appReadyRevision, setAppReadyRevision] = useState(0);
  const [retryRevision, setRetryRevision] = useState(0);
  const [runtimeState, setRuntimeState] = useState<ViewportRuntimeState>({
    status: 'initializing',
    message: null,
    canRetry: false,
  });
  const retryViewport = useCallback(() => {
    setRuntimeState({ status: 'initializing', message: null, canRetry: false });
    setRetryRevision(revision => revision + 1);
  }, []);

  useEffect(() => {
    if (!refs.containerRef.current) return;

    let destroyed = false;
    let canvas: HTMLCanvasElement | null = null;
    let contextRecoveryTimer: number | null = null;
    const app = new PIXI.Application();

    let particleAccMs = 0;

    const onTicker = () => {
      const app = refs.appRef.current;
      if (!app) return;
      const dtMs = app.ticker.deltaMS;
      const state = useSceneStore.getState();
      const isParticleActive = state.showParticles;
      if (!isParticleActive) return;

      particleAccMs += dtMs;
      if (particleAccMs < PARTICLE_SYSTEM_UPDATE_TIME_MS) return;

      const updateDt = particleAccMs;
      particleAccMs = 0;

      const ambient = state.scene.properties.ambient;
      const zAxisDir = state.scene.properties.zAxisDirection;
      const livePositions = state.updateParticlesWhileMoving && refs.isDraggingEntityRef.current
        ? refs.dragPreviewPositionsRef.current
        : null;

      for (const rKey of refs.activeParticleRuntimeKeysRef.current) {
        const runtime = refs.particleRuntimesRef.current.get(rKey);
        if (!runtime) {
          refs.activeParticleRuntimeKeysRef.current.delete(rKey);
          continue;
        }
        const entityUid = rKey.split(':')[0];
        const host = refs.particleHostStatesRef.current.get(entityUid);
        if (!host || host.hide) {
          runtime.container.renderable = false;
          refs.activeParticleRuntimeKeysRef.current.delete(rKey);
          continue;
        }
        const livePosition = livePositions?.get(entityUid);
        if (livePosition) {
          const liveWorldPosition = { ...host.position, ...livePosition };
          runtime.update(updateDt, liveWorldPosition, liveWorldPosition, host.angle, ambient, zAxisDir);
          continue;
        }
        runtime.update(updateDt, host.position, host.position, host.angle, ambient, zAxisDir);
      }
    };

    const handleVisibilityChange = () => {
      const app = refs.appRef.current;
      if (!app) return;
      if (document.hidden) {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (destroyed) return;
      setRuntimeState({
        status: 'recovering',
        message: 'WebGL context was lost. Pixi is attempting to restore it.',
        canRetry: false,
      });
      if (contextRecoveryTimer !== null) window.clearTimeout(contextRecoveryTimer);
      contextRecoveryTimer = window.setTimeout(() => {
        if (!destroyed) {
          setRuntimeState(state => state.status === 'recovering'
            ? { ...state, canRetry: true }
            : state);
        }
      }, 3000);
    };
    const handleContextRestored = () => {
      if (contextRecoveryTimer !== null) window.clearTimeout(contextRecoveryTimer);
      contextRecoveryTimer = null;
      if (!destroyed) {
        setRuntimeState({ status: 'ready', message: null, canRetry: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const particleRuntimes = refs.particleRuntimesRef.current;
    const particleRuntimeSignatures = refs.particleRuntimeSignaturesRef.current;

    void (async () => {
      try {
        if (isTauri()) await import('pixi.js/unsafe-eval');
        if (destroyed) return;

        await app.init({
          resizeTo: refs.containerRef.current!,
          backgroundColor: 0x1a1a2e,
          antialias: false,
          preference: 'webgl',
          powerPreference: 'high-performance',
        });
        if (destroyed) {
          app.destroy(true);
          return;
        }
        canvas = app.canvas;

        const container = refs.containerRef.current;
        if (!container) throw new Error('Viewport container is unavailable.');
        container.appendChild(canvas);
        refs.appRef.current = app;

        const world = new PIXI.Container();
        app.stage.addChild(world);
        refs.worldRef.current = world;

        const grid = new PIXI.Graphics();
        world.addChild(grid);
        refs.gridRef.current = grid;

        const entities = new PIXI.Container();
        world.addChild(entities);
        refs.entitiesContainerRef.current = entities;

        const selection = new PIXI.Graphics();
        app.stage.addChild(selection);
        refs.selectionRef.current = selection;

        const marquee = new PIXI.Graphics();
        app.stage.addChild(marquee);
        refs.marqueeGraphicsRef.current = marquee;

        const gizmo = new PIXI.Container();
        gizmo.visible = false;
        app.stage.addChild(gizmo);
        refs.moveGizmoContainerRef.current = gizmo;

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        app.ticker.add(onTicker);

        const width = Math.round(container.getBoundingClientRect().width);
        const height = Math.round(container.getBoundingClientRect().height);
        if (width > 0 && height > 0) {
          app.renderer.resize(width, height);
          setViewportSize({ width, height });
        }
        setRuntimeState({ status: 'ready', message: null, canRetry: false });
        setAppReadyRevision(revision => revision + 1);
      } catch (error) {
        if (destroyed) {
          try {
            app.destroy(true);
          } catch {
            // The renderer may only be partially initialized.
          }
          return;
        }
        console.error('[Viewport] Pixi application initialization failed:', error);
        try {
          app.destroy(true);
        } catch {
          // The renderer may only be partially initialized.
        }
        resetStageRefs(refs);
        setRuntimeState({
          status: 'error',
          message: errorMessage(error),
          canRetry: true,
        });
      }
    })();

    return () => {
      destroyed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (contextRecoveryTimer !== null) window.clearTimeout(contextRecoveryTimer);
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      if (refs.appRef.current !== app) return;

      app.ticker.remove(onTicker);
      for (const runtime of particleRuntimes.values()) {
        try {
          runtime.destroy();
        } catch {
          // Continue destroying the rest of the particle runtimes.
        }
      }
      particleRuntimes.clear();
      particleRuntimeSignatures.clear();
      refs.activeParticleRuntimeKeysRef.current.clear();
      refs.particleHostStatesRef.current.clear();
      refs.particleCullingEntriesRef.current.clear();

      if (refs.liveFrameRef.current !== null) {
        cancelAnimationFrame(refs.liveFrameRef.current);
        refs.liveFrameRef.current = null;
      }
      try {
        refs.placeholderTextureRef.current?.destroy(true);
      } catch {
        // Pixi cleanup can throw after the renderer has already been torn down.
      }
      refs.placeholderTextureRef.current = null;
      resetStageRefs(refs);
      try {
        app.destroy(true);
      } catch (error) {
        console.warn('[Viewport] App destroy warning:', error);
      }
    };
  }, [refs, retryRevision]);

  // Handle container resizing (e.g. when panels expand/collapse or window resizes)
  useEffect(() => {
    const container = refs.containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);
        if (w > 0 && h > 0 && refs.appRef.current) {
          refs.appRef.current.renderer.resize(w, h);
          setViewportSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [refs]);

  // Draw grid
  const gridSize = useSceneStore(s => s.gridSize);

  useEffect(() => {
    const grid = refs.gridRef.current;
    const app = refs.appRef.current;
    if (!grid || !app || !showGrid) {
      if (grid) grid.clear();
      return;
    }

    grid.clear();
    const zoom = Math.max(0.001, camera.zoom);
    const { majorStep, minorStep } = computeAdaptiveGridStep(gridSize, zoom);

    // Scale-independent line thickness (1px on screen for all grid lines)
    const mainLineWidth = 1 / zoom;

    const viewW = app.renderer.width / zoom;
    const viewH = app.renderer.height / zoom;
    const viewLeft = -camera.x / zoom;
    const viewTop = -camera.y / zoom;
    const viewRight = viewLeft + viewW;
    const viewBottom = viewTop + viewH;

    // 1. Minor grid lines (if active)
    if (minorStep) {
      const startX = (Math.floor(viewLeft / minorStep) - 1) * minorStep;
      const endX = (Math.ceil(viewRight / minorStep) + 1) * minorStep;
      const startY = (Math.floor(viewTop / minorStep) - 1) * minorStep;
      const endY = (Math.ceil(viewBottom / minorStep) + 1) * minorStep;

      for (let x = startX; x <= endX; x += minorStep) {
        if (Math.abs(x) < 0.001) continue;
        const rem = Math.abs(x % majorStep);
        if (rem < 0.001 || Math.abs(rem - majorStep) < 0.001) continue;
        grid.moveTo(x, startY);
        grid.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += minorStep) {
        if (Math.abs(y) < 0.001) continue;
        const rem = Math.abs(y % majorStep);
        if (rem < 0.001 || Math.abs(rem - majorStep) < 0.001) continue;
        grid.moveTo(startX, y);
        grid.lineTo(endX, y);
      }
      grid.stroke({ width: mainLineWidth, color: 0x25293d, alpha: 0.45 });
    }

    // 2. Major grid lines
    const startMajorX = (Math.floor(viewLeft / majorStep) - 1) * majorStep;
    const endMajorX = (Math.ceil(viewRight / majorStep) + 1) * majorStep;
    const startMajorY = (Math.floor(viewTop / majorStep) - 1) * majorStep;
    const endMajorY = (Math.ceil(viewBottom / majorStep) + 1) * majorStep;

    for (let x = startMajorX; x <= endMajorX; x += majorStep) {
      if (Math.abs(x) < 0.001) continue; // Skip X = 0 (Y Axis)
      grid.moveTo(x, startMajorY);
      grid.lineTo(x, endMajorY);
    }
    for (let y = startMajorY; y <= endMajorY; y += majorStep) {
      if (Math.abs(y) < 0.001) continue; // Skip Y = 0 (X Axis)
      grid.moveTo(startMajorX, y);
      grid.lineTo(endMajorX, y);
    }
    grid.stroke({ width: mainLineWidth, color: 0x3b4262, alpha: 0.85 });

    // 3. Origin Axes (X = 0, Y = 0) - Simple, clean 1px lines with soft opacity
    // X Axis (Y = 0) - Soft Red
    if (0 >= startMajorY && 0 <= endMajorY) {
      grid.moveTo(startMajorX, 0);
      grid.lineTo(endMajorX, 0);
      grid.stroke({ width: mainLineWidth, color: 0xe55353, alpha: 0.65 });
    }

    // Y Axis (X = 0) - Soft Green
    if (0 >= startMajorX && 0 <= endMajorX) {
      grid.moveTo(0, startMajorY);
      grid.lineTo(0, endMajorY);
      grid.stroke({ width: mainLineWidth, color: 0x34d399, alpha: 0.65 });
    }
  }, [refs, camera, showGrid, gridSize, viewportSize, appReadyRevision]);

  // Apply camera transform
  useEffect(() => {
    const world = refs.worldRef.current;
    if (!world) return;
    world.position.set(camera.x, camera.y);
    world.scale.set(camera.zoom);
  }, [refs, camera, appReadyRevision]);

  return { viewportSize, appReadyRevision, runtimeState, retryViewport };
}
