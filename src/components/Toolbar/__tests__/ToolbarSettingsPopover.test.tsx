// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolbarSettingsPopover } from '../ToolbarSettingsPopover';
import { useSceneStore } from '../../../store/sceneStore';

describe('ToolbarSettingsPopover', () => {
  beforeEach(() => {
    useSceneStore.setState({
      showGrid: false,
      showCursorCoordinates: false,
      snapToGrid: false,
      gridSize: 32,
      showParticles: false,
      clampZoomToScene: false,
      updateParticlesWhileMoving: false,
      showFps: false,
      showParticleFps: false,
      showPlacementProfiler: false,
      cleanSceneFile: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Settings button and toggles the popover', () => {
    render(<ToolbarSettingsPopover />);

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    expect(settingsButton).toBeDefined();

    // Initially popover is closed
    expect(screen.queryByText('Viewport Display')).toBeNull();

    // Click to open
    fireEvent.click(settingsButton);
    expect(screen.getByText('Viewport Display')).toBeDefined();
    expect(screen.getByText('Performance Overlays')).toBeDefined();
    expect(screen.getByText('Scene File Export')).toBeDefined();

    // Contains Lucide SVG icons
    const popover = screen.getByText('Viewport Display').closest('.toolbar-settings-popover');
    expect(popover).not.toBeNull();
    const svgs = popover?.querySelectorAll('svg');
    expect(svgs && svgs.length).toBeGreaterThan(0);

    // Click Close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(screen.queryByText('Viewport Display')).toBeNull();
  });

  it('toggles settings options and updates sceneStore', () => {
    render(<ToolbarSettingsPopover />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    // Toggle Grid Lines
    const gridToggle = screen.getByText('Grid Lines').closest('label')?.querySelector('button[role="switch"]');
    expect(gridToggle).not.toBeNull();
    expect(useSceneStore.getState().showGrid).toBe(false);

    fireEvent.click(gridToggle!);
    expect(useSceneStore.getState().showGrid).toBe(true);

    // Toggle Clean Scene File
    const cleanToggle = screen.getByText('Clean Scene File').closest('label')?.querySelector('button[role="switch"]');
    expect(cleanToggle).not.toBeNull();
    expect(useSceneStore.getState().cleanSceneFile).toBe(false);

    fireEvent.click(cleanToggle!);
    expect(useSceneStore.getState().cleanSceneFile).toBe(true);
  });

  it('toggles the cursor coordinate readout and includes it in the active count', () => {
    render(<ToolbarSettingsPopover />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByText('0 active settings')).toBeDefined();

    const coordinateToggle = screen
      .getByText('Live Cursor Coordinates')
      .closest('label')
      ?.querySelector('button[role="switch"]');
    expect(coordinateToggle).not.toBeNull();

    fireEvent.click(coordinateToggle!);
    expect(useSceneStore.getState().showCursorCoordinates).toBe(true);
    expect(screen.getByText('1 active settings')).toBeDefined();
  });

  it('closes popover on Escape key', () => {
    render(<ToolbarSettingsPopover />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByText('Viewport Display')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Viewport Display')).toBeNull();
  });
});

