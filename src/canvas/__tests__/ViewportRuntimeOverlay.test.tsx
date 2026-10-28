// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportRuntimeOverlay } from '../ViewportRuntimeOverlay';

afterEach(cleanup);

describe('ViewportRuntimeOverlay', () => {
  it('shows an initialization failure and retries without reloading the page', () => {
    const retry = vi.fn();
    render(
      <ViewportRuntimeOverlay
        runtimeState={{ status: 'error', message: 'WebGL unavailable', canRetry: true }}
        onRetry={retry}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('WebGL unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry Viewport' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps retry hidden during the initial context recovery window', () => {
    render(
      <ViewportRuntimeOverlay
        runtimeState={{ status: 'recovering', message: 'Restoring WebGL', canRetry: false }}
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Recovering viewport');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not cover a ready viewport', () => {
    const { container } = render(
      <ViewportRuntimeOverlay
        runtimeState={{ status: 'ready', message: null, canRetry: false }}
        onRetry={() => undefined}
      />,
    );

    expect(container.innerHTML).toBe('');
  });
});
