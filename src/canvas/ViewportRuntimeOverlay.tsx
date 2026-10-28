import type { ViewportRuntimeState } from './usePixiStage';

type ViewportRuntimeOverlayProps = {
  runtimeState: ViewportRuntimeState;
  onRetry: () => void;
};

export function ViewportRuntimeOverlay({ runtimeState, onRetry }: ViewportRuntimeOverlayProps) {
  if (runtimeState.status === 'ready') return null;

  const isError = runtimeState.status === 'error';
  const title = runtimeState.status === 'initializing'
    ? 'Initializing viewport'
    : runtimeState.status === 'recovering'
      ? 'Recovering viewport'
      : 'Viewport unavailable';
  const message = runtimeState.message ?? (
    runtimeState.status === 'initializing'
      ? 'Preparing the WebGL renderer...'
      : 'The viewport could not be initialized.'
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950/70 px-6">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className="w-full max-w-md border border-gray-600 bg-gray-900 px-4 py-3 text-gray-200 shadow-lg"
      >
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 select-text text-xs leading-5 text-gray-400">{message}</div>
        {runtimeState.canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-7 border border-gray-600 bg-gray-800 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
          >
            Retry Viewport
          </button>
        )}
      </div>
    </div>
  );
}
