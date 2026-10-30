import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { getCursorSceneCoordinates } from './cursorCoordinates';
import type { ViewportRefs } from './viewportTypes';

// Leave enough room for the visible body of native cursors, whose graphic
// extends down and to the right from the pointer hotspot.
const CURSOR_OFFSET_PX = 45;
const VIEWPORT_PADDING_PX = 4;
const FALLBACK_READOUT_WIDTH_PX = 136;
const FALLBACK_READOUT_HEIGHT_PX = 28;

type CursorReadout = {
  visible: boolean;
  left: number;
  top: number;
  x: string;
  y: string;
  horizontalSide: 'left' | 'right';
  verticalSide: 'above' | 'below';
};

const HIDDEN_READOUT: CursorReadout = {
  visible: false,
  left: 0,
  top: 0,
  x: '0.0',
  y: '0.0',
  horizontalSide: 'right',
  verticalSide: 'below',
};

interface ViewportCursorCoordinatesProps {
  refs: ViewportRefs;
  appReadyRevision: number;
}

export function ViewportCursorCoordinates({ refs, appReadyRevision }: ViewportCursorCoordinatesProps) {
  const showCursorCoordinates = useSceneStore((state) => state.showCursorCoordinates);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [readout, setReadout] = useState<CursorReadout>(HIDDEN_READOUT);

  useEffect(() => {
    if (!showCursorCoordinates) return;

    const canvas = (refs.appRef.current?.canvas
      ?? refs.containerRef.current?.querySelector('canvas')) as HTMLCanvasElement | undefined;
    if (!canvas) return;

    let frameId: number | null = null;
    let pendingEvent: MouseEvent | null = null;

    const hide = () => {
      pendingEvent = null;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      setReadout((current) => current.visible ? { ...current, visible: false } : current);
    };

    const update = () => {
      frameId = null;
      const event = pendingEvent;
      pendingEvent = null;
      if (!event) return;

      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
        hide();
        return;
      }

      const { camera, snapToGrid, gridSize } = useSceneStore.getState();
      const scenePosition = getCursorSceneCoordinates(
        localX,
        localY,
        camera,
        snapToGrid,
        gridSize,
      );

      const overlayWidth = overlayRef.current?.offsetWidth || FALLBACK_READOUT_WIDTH_PX;
      const overlayHeight = overlayRef.current?.offsetHeight || FALLBACK_READOUT_HEIGHT_PX;
      const horizontalSide = localX + CURSOR_OFFSET_PX + overlayWidth > rect.width ? 'left' : 'right';
      const verticalSide = localY + CURSOR_OFFSET_PX + overlayHeight > rect.height ? 'above' : 'below';
      const desiredLeft = horizontalSide === 'left'
        ? localX - CURSOR_OFFSET_PX - overlayWidth
        : localX + CURSOR_OFFSET_PX;
      const desiredTop = verticalSide === 'above'
        ? localY - CURSOR_OFFSET_PX - overlayHeight
        : localY + CURSOR_OFFSET_PX;
      const maxLeft = Math.max(VIEWPORT_PADDING_PX, rect.width - overlayWidth - VIEWPORT_PADDING_PX);
      const maxTop = Math.max(VIEWPORT_PADDING_PX, rect.height - overlayHeight - VIEWPORT_PADDING_PX);

      setReadout({
        visible: true,
        left: Math.min(Math.max(desiredLeft, VIEWPORT_PADDING_PX), maxLeft),
        top: Math.min(Math.max(desiredTop, VIEWPORT_PADDING_PX), maxTop),
        x: scenePosition.x.toFixed(1),
        y: scenePosition.y.toFixed(1),
        horizontalSide,
        verticalSide,
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      pendingEvent = event;
      if (frameId === null) frameId = requestAnimationFrame(update);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', hide);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', hide);
      if (frameId !== null) cancelAnimationFrame(frameId);
      setReadout((current) => current.visible ? { ...current, visible: false } : current);
    };
  }, [refs, appReadyRevision, showCursorCoordinates]);

  if (!showCursorCoordinates || !readout.visible) return null;

  return (
    <div
      ref={overlayRef}
      data-testid="viewport-cursor-coordinates"
      data-horizontal-side={readout.horizontalSide}
      data-vertical-side={readout.verticalSide}
      aria-hidden="true"
      className="absolute z-20 pointer-events-none select-none whitespace-nowrap rounded border border-gray-700/80 bg-gray-950/80 px-2 py-1 font-mono text-[11px] tabular-nums text-gray-200 shadow-lg backdrop-blur-sm"
      style={{ left: readout.left, top: readout.top }}
    >
      <span className="text-gray-400">X:</span> {readout.x}
      <span className="ml-2 text-gray-400">Y:</span> {readout.y}
    </div>
  );
}
