/* eslint react-hooks/immutability: off, react-hooks/preserve-manual-memoization: off */
import { useCallback, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { useSceneStore } from '../store/sceneStore';
import { getAllDescendantUIDs, type WorldTransformPatch } from '../utils/sceneHierarchy';
import { clamp01, computeDragDelta, screenToWorld, transformBounds } from './viewportMath';
import type { AxisConstraint, LiveUpdate, ViewportRefs } from './viewportTypes';
import { transformEventBus } from '../store/TransformEventBus';

type UseViewportInteractionsParams = {
  refs: ViewportRefs;
  appReadyRevision?: number;
  setCamera: (patch: Partial<{ x: number; y: number; zoom: number }>) => void;
  addEntity: (templateName: string, x: number, y: number) => void;
  updateWorldTransform: (patches: WorldTransformPatch[], preservePatchedTransforms?: boolean) => void;
  setParallaxOriginNormalized: (origin: { x: number; y: number }) => void;
};

export function useViewportInteractions({
  refs,
  appReadyRevision,
  setCamera,
  addEntity,
  updateWorldTransform,
  setParallaxOriginNormalized,
}: UseViewportInteractionsParams) {
  const scheduleLiveUpdates = useCallback((updates: LiveUpdate[]) => {
    refs.pendingLiveUpdatesRef.current = updates;
    refs.latestDragUpdatesRef.current = updates;
    if (refs.liveFrameRef.current !== null) return;

    refs.liveFrameRef.current = requestAnimationFrame(() => {
      refs.liveFrameRef.current = null;
      const pending = refs.pendingLiveUpdatesRef.current;
      refs.pendingLiveUpdatesRef.current = null;
      if (pending && pending.length > 0) {
        // Chỉ emit event để Inspector/UI update, thay vì bắt toàn bộ ứng dụng re-render qua Zustand
        transformEventBus.emit(pending);
      }
    });
  }, [refs]);

  const flushLiveUpdates = useCallback(() => {
    if (refs.liveFrameRef.current !== null) {
      cancelAnimationFrame(refs.liveFrameRef.current);
      refs.liveFrameRef.current = null;
    }

    const pending = refs.pendingLiveUpdatesRef.current;
    refs.pendingLiveUpdatesRef.current = null;
    if (pending && pending.length > 0) {
      transformEventBus.emit(pending);
    }
  }, [refs]);

  const startSelectedDrag = useCallback((constraint: AxisConstraint, worldPos: { x: number; y: number }) => {
    useSceneStore.getState().flushInspectorEdits();
    const store = useSceneStore.getState();
    const { scene: currentScene, selectedUIDs } = store;
    if (selectedUIDs.length === 0) return;

    store.setAxisConstraint(constraint);

    refs.isDraggingEntityRef.current = true;
    refs.hasDraggedRef.current = false;
    refs.dragStartMouseRef.current = worldPos;
    refs.dragStartPositionsRef.current.clear();
    refs.dragPreviewPositionsRef.current.clear();
    refs.dragStartVerticesRef.current.clear();
    refs.dragStartBoundsRef.current.clear();

    const currentEntityByUid = new Map(currentScene.entities.map(ent => [ent.editorEntityUID, ent]));
    const descendants = getAllDescendantUIDs(currentScene.entities, new Set(selectedUIDs));
    const allDraggedUIDs = new Set([...selectedUIDs, ...descendants]);

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    const selectedUidSet = new Set(selectedUIDs);
    for (const suid of allDraggedUIDs) {
      const ent = currentEntityByUid.get(suid);
      if (ent) {
        refs.dragStartPositionsRef.current.set(suid, { x: ent.position.x, y: ent.position.y });
        refs.dragPreviewPositionsRef.current.set(suid, { x: ent.position.x, y: ent.position.y });
        if (selectedUidSet.has(suid) && !ent.hide) {
          sumX += ent.position.x;
          sumY += ent.position.y;
          count++;
        }

        const mesh = refs.spriteMapRef.current.get(suid);
        if (mesh) {
          const verts = mesh.geometry.positions;
          if (verts) {
            refs.dragStartVerticesRef.current.set(suid, new Float32Array(verts));
          }
        }
        const b = refs.boundsMapRef.current.get(suid);
        if (b) {
          refs.dragStartBoundsRef.current.set(suid, { ...b });
        }
      }
    }
    if (count > 0) {
      refs.dragStartCentroidRef.current = { x: sumX / count, y: sumY / count };
    }
  }, [refs]);

  const onStartGizmoDrag = useCallback((e: PIXI.FederatedPointerEvent, constraint: AxisConstraint) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    refs.entityClickHandledRef.current = true;

    const store = useSceneStore.getState();
    const { camera } = store;
    const rect = (refs.appRef.current?.view as HTMLCanvasElement | undefined)?.getBoundingClientRect();
    if (!rect) return;
    const worldPos = screenToWorld(e.global.x, e.global.y, camera);
    startSelectedDrag(constraint, worldPos);
  }, [refs, startSelectedDrag]);

  const onEntityPointerDown = useCallback((capturedUID: string, e: PIXI.FederatedPointerEvent) => {
    if (e.button !== 0) return;
    useSceneStore.getState().flushInspectorEdits();
    const store = useSceneStore.getState();
    const { tool, camera, selectedUIDs } = store;
    if (tool !== 'select' && tool !== 'move' && tool !== 'rotate') return;
    e.stopPropagation();

    const worldPos = screenToWorld(e.global.x, e.global.y, camera);

    if (e.shiftKey) {
      // Shift+click: toggle selection, no drag
      store.toggleSelection(capturedUID);
      refs.entityClickHandledRef.current = true;
      return;
    }

    refs.entityClickHandledRef.current = true;

    // Double-click check: 2 clicks on same entity within 350ms scrolls Hierarchy list to entity
    const now = Date.now();
    const lastClick = refs.lastSceneEntityClickRef.current;
    if (lastClick && lastClick.uid === capturedUID && (now - lastClick.time) <= 350) {
      store.scrollHierarchyToEntity(capturedUID);
      refs.lastSceneEntityClickRef.current = null;
    } else {
      refs.lastSceneEntityClickRef.current = { uid: capturedUID, time: now };
    }

    // Select entity (keep selection if already included)
    if (!selectedUIDs.includes(capturedUID)) {
      store.selectEntity(capturedUID);
    }

    // Re-read selection after potential update
    const refreshedStore = useSceneStore.getState();
    const currentUIDs = refreshedStore.selectedUIDs;
    const currentEntityByUid = new Map(refreshedStore.scene.entities.map(ent => [ent.editorEntityUID, ent]));

    if (tool === 'rotate') {
      refs.isRotatingRef.current = true;
      refs.hasDraggedRef.current = false;
      const selectedUIDSet = new Set(currentUIDs);
      const selectedRootUIDs = currentUIDs.filter(uid => {
        const ent = currentEntityByUid.get(uid);
        if (!ent) return false;

        let parentUid = ent.editorParentEntity;
        while (parentUid) {
          const parent = currentEntityByUid.get(parentUid);
          if (!parent) return true;
          if (selectedUIDSet.has(parent.editorEntityUID)) return false;
          parentUid = parent.editorParentEntity;
        }
        return true;
      });
      if (selectedRootUIDs.length === 0) return;

    const allRotatedUIDs = getAllDescendantUIDs(refreshedStore.scene.entities, new Set(selectedRootUIDs));
      const pivotPositions = selectedRootUIDs
        .map(suid => currentEntityByUid.get(suid)?.position)
        .filter(Boolean) as Array<{ x: number; y: number }>;
      if (pivotPositions.length === 0) return;
      const pivotX = pivotPositions.reduce((s, p) => s + p.x, 0) / pivotPositions.length;
      const pivotY = pivotPositions.reduce((s, p) => s + p.y, 0) / pivotPositions.length;
      refs.rotateStartRef.current = {
        mouseAngle: Math.atan2(worldPos.y - pivotY, worldPos.x - pivotX),
        pivotX,
        pivotY,
      };
      refs.rotateStartDataRef.current.clear();
      refs.dragStartVerticesRef.current.clear();
      refs.dragStartBoundsRef.current.clear();
      for (const suid of allRotatedUIDs) {
        const ent = currentEntityByUid.get(suid);
        if (ent) {
          refs.rotateStartDataRef.current.set(suid, {
            angle: ent.angle,
            x: ent.position.x,
            y: ent.position.y,
          });
          const mesh = refs.spriteMapRef.current.get(suid);
          if (mesh) {
            const verts = mesh.geometry.positions;
            if (verts) {
              refs.dragStartVerticesRef.current.set(suid, new Float32Array(verts));
            }
          }
          const b = refs.boundsMapRef.current.get(suid);
          if (b) {
            refs.dragStartBoundsRef.current.set(suid, { ...b });
          }
        }
      }
    }
  }, [refs]);

  useEffect(() => {
    const canvas = (refs.appRef.current?.canvas || refs.containerRef.current?.querySelector('canvas')) as HTMLCanvasElement | undefined;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { camera } = useSceneStore.getState();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.1, Math.min(10, camera.zoom * zoomFactor));
      setCamera({
        zoom: newZoom,
        x: mx - (mx - camera.x) * (newZoom / camera.zoom),
        y: my - (my - camera.y) * (newZoom / camera.zoom),
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        refs.isPanningRef.current = true;
        refs.lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        const { tool } = useSceneStore.getState();
        if (tool === 'grab') {
          refs.isPanningRef.current = true;
          refs.lastPanPosRef.current = { x: e.clientX, y: e.clientY };
          e.preventDefault();
          return;
        }

        // entityClickHandledRef is set synchronously by Pixi sprite pointerdown
        // which fires before this native listener
        if (
          (tool === 'select' || tool === 'move' || tool === 'rotate') &&
          !refs.entityClickHandledRef.current
        ) {
          // Mousedown on background — start marquee
          const rect = canvas.getBoundingClientRect();
          refs.isMarqueeRef.current = true;
          refs.marqueeStartRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { camera, placingTemplate, placingPrefab } = useSceneStore.getState();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera);
      const isOver = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      refs.placePreviewMouseRef.current = { x: world.x, y: world.y, isOver };

      if (placingTemplate || placingPrefab) {
        refs.updatePlacePreviewRef.current(world.x, world.y, isOver);
      }

      if (useSceneStore.getState().parallaxPreviewActive) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        if (sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height) {
          setParallaxOriginNormalized({
            x: clamp01(sx / Math.max(rect.width, 1)),
            y: clamp01(sy / Math.max(rect.height, 1)),
          });
        }
      }

      if (refs.isPanningRef.current) {
        const dx = e.clientX - refs.lastPanPosRef.current.x;
        const dy = e.clientY - refs.lastPanPosRef.current.y;
        refs.lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        setCamera({ x: camera.x + dx, y: camera.y + dy });
      }

      if (refs.isMarqueeRef.current) {
        const ex = e.clientX - rect.left;
        const ey = e.clientY - rect.top;
        const { x: sx, y: sy } = refs.marqueeStartRef.current;
        const mg = refs.marqueeGraphicsRef.current;
        if (mg) {
          mg.clear();
          mg.rect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
          mg.fill({ color: 0x4488ff, alpha: 0.08 });
          mg.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
        }
      }

      if (refs.isDraggingEntityRef.current) {
        const { axisConstraint, snapToGrid, gridSize, selectedUIDs } = useSceneStore.getState();
        const rawDx = world.x - refs.dragStartMouseRef.current.x;
        const rawDy = world.y - refs.dragStartMouseRef.current.y;

        const primaryUid = selectedUIDs[0];
        const refPos = (primaryUid !== undefined ? refs.dragStartPositionsRef.current.get(primaryUid) : null) ?? refs.dragStartCentroidRef.current;
        const { x: dx, y: dy } = computeDragDelta(
          refPos,
          { x: rawDx, y: rawDy },
          axisConstraint,
          snapToGrid,
          gridSize,
        );

        if (Math.abs(rawDx) > 0.1 || Math.abs(rawDy) > 0.1) {
          refs.hasDraggedRef.current = true;
        }

        // Direct GPU mesh translation for dragged entities
        for (const [uid, origPos] of refs.dragStartPositionsRef.current) {
          const nextPos = { x: origPos.x + dx, y: origPos.y + dy };
          refs.dragPreviewPositionsRef.current.set(uid, nextPos);
          const mesh = refs.spriteMapRef.current.get(uid);
          const isParallaxMesh = refs.parallaxEntityUIDsRef.current.has(uid);
          if (mesh && !isParallaxMesh) {
            mesh.position.set(nextPos.x, nextPos.y);
          }
          const startBounds = refs.dragStartBoundsRef.current.get(uid);
          if (startBounds && !isParallaxMesh) {
            refs.boundsMapRef.current.set(uid, {
              x: startBounds.x + dx,
              y: startBounds.y + dy,
              width: startBounds.width,
              height: startBounds.height,
            });
          }
        }

        // Direct update Gizmo position in screen space
        const gizmo = refs.moveGizmoContainerRef.current;
        if (gizmo) {
          const screenX = camera.x + (refs.dragStartCentroidRef.current.x + dx) * camera.zoom;
          const screenY = camera.y + (refs.dragStartCentroidRef.current.y + dy) * camera.zoom;
          gizmo.position.set(screenX, screenY);
        }

        // Direct update Selection Box
        refs.updateSelectionOutlinesRef.current();

        const updates = Array.from(refs.dragStartPositionsRef.current.entries()).map(([uid, orig]) => ({
          uid,
          x: orig.x + dx,
          y: orig.y + dy,
        }));
        scheduleLiveUpdates(updates);
      }

      if (refs.isRotatingRef.current) {
        const { pivotX, pivotY, mouseAngle } = refs.rotateStartRef.current;
        const currentAngle = Math.atan2(world.y - pivotY, world.x - pivotX);
        const deltaAngle = currentAngle - mouseAngle;

        refs.hasDraggedRef.current = true;

        const updates: LiveUpdate[] = [];

        for (const [uid, orig] of refs.rotateStartDataRef.current.entries()) {
          const dx = orig.x - pivotX;
          const dy = orig.y - pivotY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let newX = orig.x;
          let newY = orig.y;
          const newAngle = orig.angle - deltaAngle * (180 / Math.PI);

          if (dist >= 0.5) {
            const origAngleFromPivot = Math.atan2(dy, dx);
            newX = pivotX + dist * Math.cos(origAngleFromPivot + deltaAngle);
            newY = pivotY + dist * Math.sin(origAngleFromPivot + deltaAngle);
          }

          const mesh = refs.spriteMapRef.current.get(uid);
          if (mesh) {
            mesh.position.set(newX, newY);
            mesh.rotation = -newAngle * (Math.PI / 180);

            const angleRad = -newAngle * (Math.PI / 180);
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
            const localVerts = mesh.geometry.positions;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let i = 0; i < localVerts.length; i += 2) {
              const lx = localVerts[i];
              const ly = localVerts[i + 1];
              const wx = newX + lx * cosA - ly * sinA;
              const wy = newY + lx * sinA + ly * cosA;
              if (wx < minX) minX = wx;
              if (wy < minY) minY = wy;
              if (wx > maxX) maxX = wx;
              if (wy > maxY) maxY = wy;
            }
            refs.boundsMapRef.current.set(uid, { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
          }

          updates.push({
            uid,
            x: Math.round(newX),
            y: Math.round(newY),
            angle: Math.round(newAngle),
          });
        }

        refs.updateSelectionOutlinesRef.current();
        scheduleLiveUpdates(updates);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const store = useSceneStore.getState();
      if (store.placingTemplate || store.placingPrefab) {
        e.preventDefault();
        store.setPlacingTemplate(null);
        store.setPlacingPrefab(null);
      }
    };

    const onMouseLeave = () => {
      refs.placePreviewMouseRef.current.isOver = false;
      refs.updatePlacePreviewRef.current(undefined, undefined, false);
    };

    const onMouseEnter = () => {
      refs.placePreviewMouseRef.current.isOver = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        refs.isPanningRef.current = false;
        return;
      }

      if (e.button === 0) {
        if (refs.isPanningRef.current) {
          refs.isPanningRef.current = false;
        }

        // End marquee
        if (refs.isMarqueeRef.current) {
          refs.isMarqueeRef.current = false;
          refs.marqueeJustCompletedRef.current = true;
          const rect = canvas.getBoundingClientRect();
          const ex = e.clientX - rect.left;
          const ey = e.clientY - rect.top;
          const { x: sx, y: sy } = refs.marqueeStartRef.current;
          const marX = Math.min(sx, ex);
          const marY = Math.min(sy, ey);
          const marW = Math.abs(ex - sx);
          const marH = Math.abs(ey - sy);

          if (marW > 4 || marH > 4) {
            const selected: string[] = [];
            const currentCamera = useSceneStore.getState().camera;
            for (const [uid, sprite] of refs.spriteMapRef.current) {
              if (!sprite.visible) continue;
              const cachedBounds = refs.boundsMapRef.current.get(uid);
              const b = cachedBounds ? transformBounds(cachedBounds, currentCamera) : sprite.getBounds();
              if (b.x < marX + marW && b.x + b.width > marX &&
                  b.y < marY + marH && b.y + b.height > marY) {
                selected.push(uid);
              }
            }
            useSceneStore.getState().setSelection(selected);
          } else {
            useSceneStore.getState().setSelection([]);
          }

          refs.marqueeGraphicsRef.current?.clear();
        }

        // End move drag
        if (refs.isDraggingEntityRef.current) {
          refs.isDraggingEntityRef.current = false;
          if (refs.hasDraggedRef.current) {
            const pending = refs.latestDragUpdatesRef.current;
            flushLiveUpdates();
            refs.latestDragUpdatesRef.current = null;
            if (pending && pending.length > 0) {
              const patches: WorldTransformPatch[] = pending.map(u => ({
                uid: u.uid,
                ...(u.x !== undefined && u.y !== undefined ? { position: { x: u.x, y: u.y } } : {}),
              }));
              updateWorldTransform(patches, true);
            }
          }
          refs.dragPreviewPositionsRef.current.clear();
          refs.hasDraggedRef.current = false;
          refs.dragStartVerticesRef.current.clear();
          refs.dragStartBoundsRef.current.clear();
        }

        // End rotate
        if (refs.isRotatingRef.current) {
          refs.isRotatingRef.current = false;
          if (refs.hasDraggedRef.current) {
            const pending = refs.latestDragUpdatesRef.current;
            flushLiveUpdates();
            refs.latestDragUpdatesRef.current = null;
            if (pending && pending.length > 0) {
              const patches: WorldTransformPatch[] = pending.map(u => ({
                uid: u.uid,
                ...(u.x !== undefined && u.y !== undefined ? { position: { x: u.x, y: u.y } } : {}),
                ...(u.angle !== undefined ? { angle: u.angle } : {}),
              }));
              updateWorldTransform(patches);
            }
          }
          refs.hasDraggedRef.current = false;
          refs.dragStartVerticesRef.current.clear();
          refs.dragStartBoundsRef.current.clear();
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { placingTemplate, placingPrefab, camera, instantiatePlacingPrefab } = useSceneStore.getState();

      if (placingPrefab) {
        const rect = canvas.getBoundingClientRect();
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera);
        instantiatePlacingPrefab(world.x, world.y);
        return;
      }

      if (placingTemplate) {
        const rect = canvas.getBoundingClientRect();
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, camera);
        addEntity(placingTemplate, world.x, world.y);
        return;
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('mouseenter', onMouseEnter);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [refs, appReadyRevision, setCamera, addEntity, updateWorldTransform, setParallaxOriginNormalized, scheduleLiveUpdates, flushLiveUpdates]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const store = useSceneStore.getState();

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (
          refs.isDraggingEntityRef.current ||
          refs.isRotatingRef.current ||
          refs.isMarqueeRef.current ||
          store.selectedUIDs.length === 0
        ) {
          return;
        }
        store.deleteSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        store.duplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        store.copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        store.pasteClipboard();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'q' || e.key === 'Q') store.setTool('grab');
      if (e.key === 's' || e.key === 'S') store.setTool('select');
      if (e.key === 'w' || e.key === 'W') store.setTool('move');
      if (e.key === 'e' || e.key === 'E') store.setTool('rotate');
      if (e.key === 'g' || e.key === 'G') store.toggleGrid();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refs]);

  const onViewportClick = useCallback(() => {
    const { tool } = useSceneStore.getState();

    // Consume marquee-complete flag to prevent deselect
    if (refs.marqueeJustCompletedRef.current) {
      refs.marqueeJustCompletedRef.current = false;
      return;
    }

    if (tool === 'select' || tool === 'move' || tool === 'rotate') {
      if (refs.entityClickHandledRef.current) {
        refs.entityClickHandledRef.current = false;
        return;
      }
      useSceneStore.getState().setSelection([]);
    }
  }, [refs]);

  return {
    onEntityPointerDown,
    onStartGizmoDrag,
    onViewportClick,
  };
}
