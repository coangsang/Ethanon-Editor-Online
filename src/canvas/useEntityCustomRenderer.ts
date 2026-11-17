/* eslint react-hooks/immutability: off */
import { useEffect } from 'react';
import * as PIXI from 'pixi.js';
import type { SceneData } from '../types';
import { transformEventBus } from '../store/TransformEventBus';
import { getEntityCustomLabel } from './entityCustomRender';
import { transformBounds } from './viewportMath';
import type { ViewportRefs } from './viewportTypes';

type UseEntityCustomRendererParams = {
  refs: ViewportRefs;
  camera: { x: number; y: number; zoom: number };
  scene: SceneData;
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
  textureRevision,
  appReadyRevision,
}: UseEntityCustomRendererParams) {
  useEffect(() => {
    const app = refs.appRef.current;
    if (!app) return;

    const layer = new PIXI.Container();
    layer.eventMode = 'none';
    app.stage.addChild(layer);

    const labels = new Map<string, PIXI.Text>();
    const entityByUid = new Map(scene.entities.map(e => [e.editorEntityUID, e]));

    const place = (uid: string) => {
      const label = labels.get(uid);
      if (!label) return;
      const mesh = refs.spriteMapRef.current.get(uid);
      const bounds = refs.boundsMapRef.current.get(uid);
      if (!mesh || !bounds || !mesh.visible || !mesh.renderable) {
        label.visible = false;
        return;
      }
      const screen = transformBounds(bounds, camera);
      label.position.set(screen.x + screen.width / 2, screen.y - LABEL_GAP_PX);
      label.visible = true;
    };

    for (const entity of scene.entities) {
      if (entity.hide) continue;
      const text = getEntityCustomLabel(entity);
      if (!text) continue;
      const label = new PIXI.Text({
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
      labels.set(entity.editorEntityUID, label);
      place(entity.editorEntityUID);
    }

    const unsubscribe = transformEventBus.subscribe(updates => {
      for (const update of updates) {
        if (labels.has(update.uid) && entityByUid.has(update.uid)) place(update.uid);
      }
    });

    return () => {
      unsubscribe();
      app.stage.removeChild(layer);
      layer.destroy({ children: true });
    };
  }, [refs, camera, scene.entities, textureRevision, appReadyRevision]);
}
