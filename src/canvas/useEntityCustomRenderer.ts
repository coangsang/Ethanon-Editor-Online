/* eslint react-hooks/immutability: off */
import { createElement, useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { Heart } from 'lucide-react';
import type { ProjectCharacterEntry, SceneData } from '../types';
import { transformEventBus } from '../store/TransformEventBus';
import { ATTACK_MINIMUM_DISTANCE_COLOR, FIELD_OF_VIEW_COLOR, getCharacterEntityInfo, getEntityCustomLabel } from './entityCustomRender';
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
// An angle guide only: fieldOfView does not supply a sight distance.
const FIELD_OF_VIEW_RADIUS = 80;
const HEART_SVG = renderToStaticMarkup(createElement(Heart, { color: '#ffffff', fill: '#ffffff' }));

/**
 * Draws entity-name based labels, attack distances, and view angles in screen
 * space. Must be called after useEntityMeshRenderer
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
  const distancesRef = useRef(new Map<string, { graphics: PIXI.Graphics; distance: number; x: number; y: number }>());
  const fieldsOfViewRef = useRef(new Map<string, { graphics: PIXI.Graphics; halfAngle: number; x: number; y: number; flipX: boolean }>());
  const { spriteMapRef, boundsMapRef } = refs;

  const place = useCallback((uid: string) => {
    const distance = distancesRef.current.get(uid);
    const mesh = spriteMapRef.current.get(uid);
    const fieldOfView = fieldsOfViewRef.current.get(uid);
    if (fieldOfView) {
      const { graphics, halfAngle, flipX } = fieldOfView;
      const { x, y, zoom } = cameraRef.current;
      graphics.visible = !!mesh?.visible && mesh.renderable;
      graphics.position.set(fieldOfView.x * zoom + x, fieldOfView.y * zoom + y);
      graphics.clear();
      const radius = FIELD_OF_VIEW_RADIUS * zoom;
      const direction = flipX ? Math.PI : 0;
      // Values >= 180 cover every direction after doubling; avoid wrapping the arc.
      const angle = Math.min(halfAngle, 180) * Math.PI / 180;
      if (angle === Math.PI) {
        graphics.circle(0, 0, radius);
      } else if (angle > 0) {
        const start = direction - angle;
        graphics.moveTo(0, 0)
          .lineTo(Math.cos(start) * radius, Math.sin(start) * radius)
          .arc(0, 0, radius, start, direction + angle)
          .lineTo(0, 0);
      }
      if (angle > 0) {
        graphics.fill({ color: FIELD_OF_VIEW_COLOR, alpha: 0.08 })
          .stroke({ color: FIELD_OF_VIEW_COLOR, width: 1.5 });
      }
      graphics.moveTo(0, 0).lineTo(flipX ? -radius : radius, 0)
        .stroke({ color: FIELD_OF_VIEW_COLOR, width: 1, alpha: 0.6 })
        .circle(0, 0, 2).fill(FIELD_OF_VIEW_COLOR);
    }
    if (distance) {
      const { graphics } = distance;
      graphics.visible = !!mesh?.visible && mesh.renderable;
      const { x, y, zoom } = cameraRef.current;
      const extent = distance.distance * zoom;
      graphics.position.set(distance.x * zoom + x, distance.y * zoom + y);
      graphics.clear()
        .moveTo(-extent, 0).lineTo(extent, 0)
        .stroke({ color: ATTACK_MINIMUM_DISTANCE_COLOR, width: 1.5 })
        .circle(-extent, 0, 3).circle(0, 0, 3).circle(extent, 0, 3)
        .fill(ATTACK_MINIMUM_DISTANCE_COLOR);
    }
    const label = labelsRef.current.get(uid);
    if (!label) return;
    const heart = heartsRef.current.get(uid);
    const bounds = boundsMapRef.current.get(uid);
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
  }, [spriteMapRef, boundsMapRef]);

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
    const distances = distancesRef.current;
    const fieldsOfView = fieldsOfViewRef.current;
    const unsubscribe = transformEventBus.subscribe(updates => {
      for (const update of updates) {
        const distance = distances.get(update.uid);
        if (distance) {
          if (update.x !== undefined) distance.x = update.x;
          if (update.y !== undefined) distance.y = update.y;
        }
        const fieldOfView = fieldsOfView.get(update.uid);
        if (fieldOfView) {
          if (update.x !== undefined) fieldOfView.x = update.x;
          if (update.y !== undefined) fieldOfView.y = update.y;
          if (update.flipX !== undefined) fieldOfView.flipX = update.flipX;
        }
        if (labels.has(update.uid)) place(update.uid);
      }
    });

    return () => {
      unsubscribe();
      app.stage.removeChild(layer);
      layer.destroy({ children: true });
      labels.clear();
      hearts.clear();
      distances.clear();
      fieldsOfView.clear();
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
    const distances = distancesRef.current;
    const withDistances = new Set<string>();
    const fieldsOfView = fieldsOfViewRef.current;
    const withFieldsOfView = new Set<string>();
    for (const entity of scene.entities) {
      if (entity.hide) continue;
      const text = getEntityCustomLabel(entity, { characters });
      if (!text) continue;
      const info = getCharacterEntityInfo(entity, characters);
      const resistance = info?.resistance;
      const halfAngle = info?.fieldOfView;
      if (halfAngle != null && halfAngle >= 0) {
        const uid = entity.editorEntityUID;
        withFieldsOfView.add(uid);
        let entry = fieldsOfView.get(uid);
        if (!entry) {
          const graphics = new PIXI.Graphics();
          graphics.eventMode = 'none';
          layer.addChild(graphics);
          entry = { graphics, halfAngle, x: entity.position.x, y: entity.position.y, flipX: entity.flipX };
          fieldsOfView.set(uid, entry);
        }
        entry.halfAngle = halfAngle;
        entry.x = entity.position.x;
        entry.y = entity.position.y;
        entry.flipX = entity.flipX;
      }
      const distance = info?.attackMinimumDistance;
      if (distance != null && distance >= 0) {
        const uid = entity.editorEntityUID;
        withDistances.add(uid);
        let entry = distances.get(uid);
        if (!entry) {
          const graphics = new PIXI.Graphics();
          graphics.eventMode = 'none';
          layer.addChild(graphics);
          entry = { graphics, distance, x: entity.position.x, y: entity.position.y };
          distances.set(uid, entry);
        }
        entry.distance = distance;
        entry.x = entity.position.x;
        entry.y = entity.position.y;
      }
      wanted.set(entity.editorEntityUID, resistance != null ? `${text} x${resistance / 20}` : text);
      if (resistance != null) withHearts.add(entity.editorEntityUID);
    }

    for (const [uid, entry] of fieldsOfView) {
      if (!withFieldsOfView.has(uid)) {
        entry.graphics.destroy();
        fieldsOfView.delete(uid);
      }
    }

    for (const [uid, entry] of distances) {
      if (!withDistances.has(uid)) {
        entry.graphics.destroy();
        distances.delete(uid);
      }
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
