import { useSceneStore } from '../store/sceneStore';
import { useEntityMeshRenderer } from './useEntityMeshRenderer';
import { usePixiStage } from './usePixiStage';
import { usePlacePreviewRenderer } from './usePlacePreviewRenderer';
import { useViewportInteractions } from './useViewportInteractions';
import { useViewportRefs } from './useViewportRefs';
import { useViewportSelection } from './useViewportSelection';
import { ViewportStatsOverlay } from './ViewportStatsOverlay';
import { ViewportRuntimeOverlay } from './ViewportRuntimeOverlay';
import { ViewportZoomControls } from './ViewportZoomControls';
import { useViewportTextures } from './useViewportTextures';

export function Viewport() {
  const refs = useViewportRefs();
  const { containerRef } = refs;

  const camera = useSceneStore(s => s.camera);
  const focusEntityRequest = useSceneStore(s => s.focusEntityRequest);
  const fitSceneRequest = useSceneStore(s => s.fitSceneRequest);
  const scene = useSceneStore(s => s.scene);
  const selectedUIDs = useSceneStore(s => s.selectedUIDs);
  const tool = useSceneStore(s => s.tool);
  const placingTemplate = useSceneStore(s => s.placingTemplate);
  const templates = useSceneStore(s => s.templates);
  const templateAtlases = useSceneStore(s => s.templateAtlases);
  const templateImageUrls = useSceneStore(s => s.templateImageUrls);
  const showGrid = useSceneStore(s => s.showGrid);
  const snapToGrid = useSceneStore(s => s.snapToGrid);
  const showParticles = useSceneStore(s => s.showParticles);
  const parallaxOriginNormalized = useSceneStore(s => s.parallaxOriginNormalized);
  const parallaxPreviewActive = useSceneStore(s => s.parallaxPreviewActive);

  const setCamera = useSceneStore(s => s.setCamera);
  const addEntity = useSceneStore(s => s.addEntity);
  const updateWorldTransform = useSceneStore(s => s.updateWorldTransform);
  const setParallaxOriginNormalized = useSceneStore(s => s.setParallaxOriginNormalized);

  const { viewportSize, appReadyRevision, runtimeState, retryViewport } = usePixiStage({ refs, camera, showGrid });
  const { textureRevision, getRenderFrame } = useViewportTextures({
    refs,
    sceneEntities: scene.entities,
    templates,
    templateAtlases,
    templateImageUrls,
    placingTemplate,
  });
  const { onEntityPointerDown, onStartGizmoDrag, onViewportClick, zoomIn, zoomOut } = useViewportInteractions({
    refs,
    appReadyRevision,
    setCamera,
    addEntity,
    updateWorldTransform,
    setParallaxOriginNormalized,
  });

  useEntityMeshRenderer({
    refs,
    camera,
    scene,
    templates,
    templateAtlases,
    textureRevision,
    appReadyRevision,
    getRenderFrame,
    parallaxOriginNormalized,
    parallaxPreviewActive,
    showParticles,
    viewportSize,
    onEntityPointerDown,
  });

  usePlacePreviewRenderer({
    refs,
    camera,
    placingTemplate,
    templates,
    snapToGrid,
    textureRevision,
    getRenderFrame,
    parallaxIntensity: scene.properties.parallaxIntensity,
    parallaxOriginNormalized,
    parallaxPreviewActive,
    ambient: scene.properties.ambient,
  });

  useViewportSelection({
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
  });

  const cursorStyle =
    placingTemplate ? 'crosshair' :
    tool === 'grab' ? 'grab' :
    tool === 'move' ? 'default' :
    tool === 'rotate' ? 'crosshair' :
    'default';

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: cursorStyle }}
        onClick={onViewportClick}
      />
      <ViewportZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
      <ViewportStatsOverlay refs={refs} />
      <ViewportRuntimeOverlay runtimeState={runtimeState} onRetry={retryViewport} />
    </div>
  );
}
