// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewportZoomControls } from '../ViewportZoomControls';
import { useSceneStore } from '../../store/sceneStore';

afterEach(cleanup);

describe('ViewportZoomControls', () => {
  beforeEach(() => {
    useSceneStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
    });
  });

  it('renders current zoom percentage correctly', () => {
    useSceneStore.setState({
      camera: { x: 0, y: 0, zoom: 1.25 },
    });

    render(<ViewportZoomControls />);
    expect(screen.getByText('125%')).toBeDefined();
  });

  it('triggers fitViewToScene when clicking Fit Scene button', () => {
    const fitSpy = vi.fn();
    useSceneStore.setState({ fitViewToScene: fitSpy });

    render(<ViewportZoomControls />);
    const fitButton = screen.getByRole('button', { name: 'Fit Scene to Viewport' });
    fireEvent.click(fitButton);

    expect(fitSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers onZoomIn callback on Zoom In click', () => {
    const zoomInSpy = vi.fn();
    render(<ViewportZoomControls onZoomIn={zoomInSpy} />);
    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    fireEvent.click(zoomInBtn);

    expect(zoomInSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers onZoomOut callback on Zoom Out click', () => {
    const zoomOutSpy = vi.fn();
    render(<ViewportZoomControls onZoomOut={zoomOutSpy} />);
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom Out' });
    fireEvent.click(zoomOutBtn);

    expect(zoomOutSpy).toHaveBeenCalledTimes(1);
  });

  it('collapses on ChevronUp click and expands on ChevronDown click', () => {
    render(<ViewportZoomControls />);

    // Initially expanded
    const hideBtn = screen.getByRole('button', { name: 'Hide Zoom Controls' });
    expect(hideBtn).toBeDefined();

    // Click to collapse
    fireEvent.click(hideBtn);

    // Now ChevronDown tab is visible
    const showBtn = screen.getByRole('button', { name: 'Show Zoom Controls' });
    expect(showBtn).toBeDefined();

    // Click to expand again
    fireEvent.click(showBtn);
    expect(screen.getByRole('button', { name: 'Hide Zoom Controls' })).toBeDefined();
  });
});

