/* eslint react-hooks/immutability: off */
import { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import type { ProjectCharacterEntry, SceneData } from '../types';
import { transformEventBus } from '../store/TransformEventBus';
import { getEntityCustomLabel } from './entityCustomRender';
import { transformBounds } from './viewportMath';
import type { ViewportRefs } from './viewportTypes';

type UseEntityCustomRendererParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  scene: SceneData;
  characters: readonly ProjectCharacterEntry[];
  textureRevision: number;
  appReadyRevision?: number;
};

const LABEL_GAP_PX = 2;

/**
 * Draws entity-name based custom visuals (currently text labels) in screen
 * space above each entity's sprite. Must be called after useEntityMeshRenderer
 * so cached bounds are already up to date for the same render.
 */
export function useEntityCustomRenderer({
  refs,
  camera,
  scene,
  characters,
  textureRevision,
  appReadyRevision,
}: UseEntityCustomRendererParams) {
  const cameraRef = useRef(camera);
  const layerRef = useRef<PIXI.Container | null>(null);
  const labelsRef = useRef(new Map<string, PIXI.Text>());

  const place = useCallback((uid: string) => {
    const label = labelsRef.current.get(uid);
    if (!label) return;
    const mesh = refs.spriteMapRef.current.get(uid);
    const bounds = refs.boundsMapRef.current.get(uid);
    if (!mesh || !bounds || !mesh.visible || !mesh.renderable) {
      label.visible = false;
      return;
    }
    const screen = transformBounds(bounds, cameraRef.current);
    label.position.set(screen.x + screen.width / 2, screen.y - LABEL_GAP_PX);
    label.visible = true;
  }, [refs]);

  // Effect L: own the PIXI layer and transformEventBus subscription
  useEffect(() => {
    const app = refs.appRef.current;
    if (!app) return;

    const layer = new PIXI.Container();
    layer.eventMode = 'none';
    app.stage.addChild(layer);
    layerRef.current = layer;

    const labels = labelsRef.current;
    const unsubscribe = transformEventBus.subscribe(updates => {
      for (const update of updates) {
        if (labels.has(update.uid)) place(update.uid);
      }
    });

    return () => {
      unsubscribe();
      app.stage.removeChild(layer);
      layer.destroy({ children: true });
      labels.clear();
      layerRef.current = null;
    };
  }, [refs, appReadyRevision, place]);

  // Effect S: reconcile labels with scene entities and characters
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    cameraRef.current = camera;
    const labels = labelsRef.current;
    const wanted = new Map<string, string>();
    for (const entity of scene.entities) {
      if (entity.hide) continue;
      const text = getEntityCustomLabel(entity, { characters });
      if (!text) continue;
      wanted.set(entity.editorEntityUID, text);
    }

    for (const [uid, label] of labels) {
      if (!wanted.has(uid)) {
        label.destroy();
        labels.delete(uid);
      }
    }

    for (const [uid, text] of wanted) {
      let label = labels.get(uid);
      if (label) {
        if (label.text !== text) label.text = text;
      } else {
        label = new PIXI.Text({
          text,
          style: {
            fontFamily: 'sans-serif',
            fontSize: 11,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        label.eventMode = 'none';
        layer.addChild(label);
        labels.set(uid, label);
      }
    }

    for (const uid of labels.keys()) {
      place(uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs, scene.entities, characters, textureRevision, appReadyRevision]);

  // Effect C: reposition labels on camera change without recreating them
  useEffect(() => {
    cameraRef.current = camera;
    for (const uid of labelsRef.current.keys()) {
      place(uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);
}
