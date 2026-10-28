// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';
import { SceneProps } from '../SceneProps';

beforeEach(() => {
  const state = useSceneStore.getState();
  useSceneStore.setState({
    scene: {
      ...state.scene,
      properties: {
        ambient: { r: 0.5, g: 0.5, b: 0.5 },
        lightIntensity: 2,
        zAxisDirection: { x: 0, y: -1 },
        parallaxIntensity: 3,
      },
    },
  });
});

afterEach(() => cleanup());

describe('SceneProps Ambient Light color control', () => {
  it('updates ambient RGB from the native picker without exposing alpha', () => {
    render(<SceneProps />);

    fireEvent.change(screen.getByLabelText('Ambient Light color picker'), {
      target: { value: '#336699' },
    });

    expect(useSceneStore.getState().scene.properties.ambient).toEqual({
      r: 0.2,
      g: 0.4,
      b: 0.6,
    });
    expect(screen.queryByLabelText('Ambient Light alpha')).toBeNull();
    expect(screen.queryByLabelText('Ambient Light A')).toBeNull();
  });

  it('supports presets, float/byte display, channel edits, and reset', () => {
    render(<SceneProps />);

    fireEvent.click(screen.getByLabelText('Ambient Light: Dark'));
    expect(useSceneStore.getState().scene.properties.ambient).toEqual({ r: 0.2, g: 0.2, b: 0.2 });

    fireEvent.click(screen.getByRole('button', { name: '0.0 - 1.0' }));
    expect((screen.getByLabelText('Ambient Light R') as HTMLInputElement).value).toBe('51');

    fireEvent.change(screen.getByLabelText('Ambient Light R'), { target: { value: '128' } });
    expect(useSceneStore.getState().scene.properties.ambient.r).toBeCloseTo(0.502, 3);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useSceneStore.getState().scene.properties.ambient).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
  });

  it('only changes a channel with the wheel when its input owns focus', () => {
    render(<SceneProps />);
    const redInput = screen.getByLabelText('Ambient Light R') as HTMLInputElement;

    fireEvent.wheel(redInput, { deltaY: -1 });
    expect(useSceneStore.getState().scene.properties.ambient.r).toBe(0.5);

    redInput.focus();
    fireEvent.wheel(redInput, { deltaY: -1 });
    expect(useSceneStore.getState().scene.properties.ambient.r).toBe(0.55);
  });
});
