/* eslint react-hooks/immutability: off */
import { createElement, useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { Heart } from 'lucide-react';
import type { ProjectCharacterEntry, SceneData } from '../types';
import { transformEventBus } from '../store/TransformEventBus';
import { getCharacterEntityInfo, getEntityCustomLabel } from './entityCustomRender';
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
const HEART_SIZE_PX = 12;
const HEART_SVG = renderToStaticMarkup(createElement(Heart, { color: '#ffffff', fill: '#ffffff' }));

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
  const heartsRef = useRef(new Map<string, PIXI.Graphics>());

  const place = useCallback((uid: string) => {
    const label = labelsRef.current.get(uid);
    if (!label) return;
    const heart = heartsRef.current.get(uid);
    const mesh = refs.spriteMapRef.current.get(uid);
    const bounds = refs.boundsMapRef.current.get(uid);
    if (!mesh || !bounds || !mesh.visible || !mesh.renderable) {
      label.visible = false;
      if (heart) heart.visible = false;
      return;
    }
    const screen = transformBounds(bounds, cameraRef.current);
    const centerX = screen.x + screen.width / 2;
    const bottomY = screen.y - LABEL_GAP_PX;
    label.position.set(centerX - (heart ? (HEART_SIZE_PX + 2) / 2 : 0), bottomY);
    label.visible = true;
    if (heart) {
      heart.position.set(centerX + label.width / 2 - HEART_SIZE_PX / 2 + 1, bottomY - HEART_SIZE_PX);
      heart.visible = true;
    }
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
    const hearts = heartsRef.current;
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
      hearts.clear();
      layerRef.current = null;
    };
  }, [refs, appReadyRevision, place]);

  // Effect S: reconcile labels with scene entities and characters
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    cameraRef.current = camera;
    const labels = labelsRef.current;
    const hearts = heartsRef.current;
    const wanted = new Map<string, string>();
    const withHearts = new Set<string>();
    for (const entity of scene.entities) {
      if (entity.hide) continue;
      const text = getEntityCustomLabel(entity, { characters });
      if (!text) continue;
      const resistance = getCharacterEntityInfo(entity, characters)?.resistance;
      wanted.set(entity.editorEntityUID, resistance != null ? `${text} x${resistance / 20}` : text);
      if (resistance != null) withHearts.add(entity.editorEntityUID);
    }

    for (const [uid, heart] of hearts) {
      if (!withHearts.has(uid)) {
        heart.destroy();
        hearts.delete(uid);
      }
    }

    for (const [uid, label] of labels) {
      if (!wanted.has(uid)) {
        label.destroy();
        labels.delete(uid);
      }
    }

    for (const [uid, text] of wanted) {
      if (withHearts.has(uid) && !hearts.has(uid)) {
        const heart = new PIXI.Graphics().svg(HEART_SVG);
        heart.scale.set(HEART_SIZE_PX / 24);
        heart.eventMode = 'none';
        layer.addChild(heart);
        hearts.set(uid, heart);
      }
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
