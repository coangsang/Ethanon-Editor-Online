/* eslint react-hooks/immutability: off, react-hooks/preserve-manual-memoization: off */
import { useCallback, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import type { SceneData } from '../types';
import { calculateSceneBounds, computeSceneFitCamera, transformBounds } from './viewportMath';
import type { AxisConstraint, ViewportRefs } from './viewportTypes';

type UseViewportSelectionParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  focusEntityRequest: { uid: string; nonce: number } | null;
  fitSceneRequest?: { nonce: number } | null;
  scene: SceneData;
  selectedUIDs: string[];
  tool: 'select' | 'grab' | 'move' | 'rotate';
  parallaxOriginNormalized: { x: number; y: number };
  parallaxPreviewActive: boolean;
  viewportSize: { width: number; height: number };
  appReadyRevision?: number;
  setCamera: (patch: Partial<{ x: number; y: number; zoom: number }>) => void;
  onStartGizmoDrag: (e: PIXI.FederatedPointerEvent, constraint: AxisConstraint) => void;
};

export function useViewportSelection({
  refs,
  camera,
  focusEntityRequest,
  fitSceneRequest,
  scene,
  selectedUIDs,
  tool,
  parallaxOriginNormalized,
  parallaxPreviewActive,
  viewportSize,
  appReadyRevision,
  setCamera,
  onStartGizmoDrag,
}: UseViewportSelectionParams) {
  useEffect(() => {
    const gizmoContainer = refs.moveGizmoContainerRef.current;
    if (!gizmoContainer || gizmoContainer.children.length > 0) return;

    const ARROW_LEN = 65;
    const HEAD_LEN = 12;
    const HEAD_W = 6;
    const SQ_SIZE = 20;

    // 1. Center Corner Square (Blue)
    const squareGfx = new PIXI.Graphics();
    squareGfx.eventMode = 'static';
    squareGfx.cursor = 'move';
    squareGfx.rect(0, -SQ_SIZE, SQ_SIZE, SQ_SIZE);
    squareGfx.fill({ color: 0x3498db, alpha: 0.4 });
    squareGfx.stroke({ width: 1.5, color: 0x2980b9, alpha: 0.9 });
    squareGfx.hitArea = new PIXI.Rectangle(0, -SQ_SIZE, SQ_SIZE, SQ_SIZE);
    gizmoContainer.addChild(squareGfx);

    // 2. X Arrow (Red)
    const xGfx = new PIXI.Graphics();
    xGfx.eventMode = 'static';
    xGfx.cursor = 'ew-resize';
    xGfx.moveTo(0, 0);
    xGfx.lineTo(ARROW_LEN, 0);
    xGfx.stroke({ width: 2.5, color: 0xe74c3c, alpha: 1 });
    xGfx.poly([
      ARROW_LEN, 0,
      ARROW_LEN - HEAD_LEN, -HEAD_W,
      ARROW_LEN - HEAD_LEN, HEAD_W,
    ]);
    xGfx.fill({ color: 0xe74c3c, alpha: 1 });
    xGfx.hitArea = new PIXI.Rectangle(0, -10, ARROW_LEN + 4, 20);
    gizmoContainer.addChild(xGfx);

    // 3. Y Arrow (Green - Pointing UP)
    const yGfx = new PIXI.Graphics();
    yGfx.eventMode = 'static';
    yGfx.cursor = 'ns-resize';
    yGfx.moveTo(0, 0);
    yGfx.lineTo(0, -ARROW_LEN);
    yGfx.stroke({ width: 2.5, color: 0x2ecc71, alpha: 1 });
    yGfx.poly([
      0, -ARROW_LEN,
      -HEAD_W, -ARROW_LEN + HEAD_LEN,
      HEAD_W, -ARROW_LEN + HEAD_LEN,
    ]);
    yGfx.fill({ color: 0x2ecc71, alpha: 1 });
    yGfx.hitArea = new PIXI.Rectangle(-10, -ARROW_LEN - 4, 20, ARROW_LEN + 4);
    gizmoContainer.addChild(yGfx);

    xGfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => onStartGizmoDrag(e, 'x'));
    yGfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => onStartGizmoDrag(e, 'y'));
    squareGfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => onStartGizmoDrag(e, 'free'));

    // Hover highlights
    xGfx.on('pointerover', () => { xGfx.tint = 0xff8888; });
    xGfx.on('pointerout', () => { xGfx.tint = 0xffffff; });
    yGfx.on('pointerover', () => { yGfx.tint = 0x88ff88; });
    yGfx.on('pointerout', () => { yGfx.tint = 0xffffff; });
    squareGfx.on('pointerover', () => { squareGfx.tint = 0x88ccff; });
    squareGfx.on('pointerout', () => { squareGfx.tint = 0xffffff; });
  }, [refs, appReadyRevision, onStartGizmoDrag]);

  // Draw selection outlines for all selected entities
  const updateSelectionOutlines = useCallback(() => {
    const sel = refs.selectionRef.current;
    if (!sel) return;
    sel.clear();

    for (const suid of selectedUIDs) {
      const sprite = refs.spriteMapRef.current.get(suid);
      if (!sprite || !sprite.visible) continue;

      const positions = sprite.geometry?.positions;
      if (!positions || positions.length < 8) {
        const cachedBounds = refs.boundsMapRef.current.get(suid);
        const bounds = cachedBounds ? transformBounds(cachedBounds, camera) : sprite.getBounds();
        const pad = 3;
        sel.rect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
        sel.stroke({ width: 2, color: 0x00ffff, alpha: 1 });
        continue;
      }

      // Convert local mesh quad vertices to global screen coordinates
      // Geometry indices: 0 = TL (u:0,v:0), 1 = TR (u:1,v:0), 2 = BL (u:0,v:1), 3 = BR (u:1,v:1)
      const p0 = sprite.toGlobal({ x: positions[0], y: positions[1] });
      const p1 = sprite.toGlobal({ x: positions[2], y: positions[3] });
      const p2 = sprite.toGlobal({ x: positions[4], y: positions[5] });
      const p3 = sprite.toGlobal({ x: positions[6], y: positions[7] });

      // Quad perimeter order: p0 (TL) -> p1 (TR) -> p3 (BR) -> p2 (BL)
      const pts = [p0, p1, p3, p2];

      // Calculate centroid and expand vertices slightly outward for visual padding
      const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
      const cy = (p0.y + p1.y + p2.y + p3.y) / 4;
      const pad = 3;

      const polyPoints: number[] = [];
      for (const pt of pts) {
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          polyPoints.push(pt.x + (dx / dist) * pad, pt.y + (dy / dist) * pad);
        } else {
          polyPoints.push(pt.x, pt.y);
        }
      }

      sel.poly(polyPoints);
      sel.stroke({ width: 2, color: 0x00ffff, alpha: 1 });
    }
  }, [refs, selectedUIDs, camera]);

  useEffect(() => {
    updateSelectionOutlines();
  }, [selectedUIDs, scene.entities, scene.properties, camera, parallaxOriginNormalized, parallaxPreviewActive, viewportSize, updateSelectionOutlines]);

  useEffect(() => {
    refs.updateSelectionOutlinesRef.current = updateSelectionOutlines;
  }, [refs, updateSelectionOutlines]);

  // Update Move Gizmo position & visibility
  useEffect(() => {
    const gizmo = refs.moveGizmoContainerRef.current;
    if (!gizmo) return;
    if (refs.isDraggingEntityRef.current) return;

    if (tool !== 'move' || selectedUIDs.length === 0) {
      gizmo.visible = false;
      return;
    }

    const selectedEntities = scene.entities.filter(e => selectedUIDs.includes(e.editorEntityUID) && !e.hide);
    if (selectedEntities.length === 0) {
      gizmo.visible = false;
      return;
    }

    let totalX = 0;
    let totalY = 0;
    for (const ent of selectedEntities) {
      totalX += ent.position.x;
      totalY += ent.position.y;
    }
    const centroidX = totalX / selectedEntities.length;
    const centroidY = totalY / selectedEntities.length;

    const screenX = camera.x + centroidX * camera.zoom;
    const screenY = camera.y + centroidY * camera.zoom;

    gizmo.position.set(screenX, screenY);
    gizmo.visible = true;
  }, [refs, tool, selectedUIDs, scene.entities, camera, viewportSize]);

  // Pan camera to the requested entity without changing zoom.
  useEffect(() => {
    if (!focusEntityRequest || refs.handledFocusNonceRef.current === focusEntityRequest.nonce) return;

    const app = refs.appRef.current;
    if (!app) return;

    const entity = scene.entities.find(item => item.editorEntityUID === focusEntityRequest.uid);
    refs.handledFocusNonceRef.current = focusEntityRequest.nonce;
    if (!entity) return;

    const bounds = entity.hide ? null : refs.boundsMapRef.current.get(entity.editorEntityUID);
    const targetX = bounds ? bounds.x + bounds.width / 2 : entity.position.x;
    const targetY = bounds ? bounds.y + bounds.height / 2 : entity.position.y;

    setCamera({
      x: app.renderer.width / 2 - targetX * camera.zoom,
      y: app.renderer.height / 2 - targetY * camera.zoom,
    });
  }, [refs, camera.zoom, focusEntityRequest, scene.entities, appReadyRevision, setCamera]);

  // Fit camera to full scene size
  useEffect(() => {
    if (!fitSceneRequest || refs.handledFitNonceRef.current === fitSceneRequest.nonce) return;

    const app = refs.appRef.current;
    if (!app) return;

    refs.handledFitNonceRef.current = fitSceneRequest.nonce;
    const vpSize = viewportSize.width > 0 && viewportSize.height > 0
      ? viewportSize
      : { width: app.renderer.width, height: app.renderer.height };
    const bounds = calculateSceneBounds(scene.entities, refs.boundsMapRef.current);
    const targetCam = computeSceneFitCamera(bounds, vpSize);
    setCamera(targetCam);
  }, [refs, fitSceneRequest, scene.entities, viewportSize, appReadyRevision, setCamera]);

  return { updateSelectionOutlines };
}
