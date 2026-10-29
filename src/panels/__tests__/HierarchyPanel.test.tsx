// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../../store/sceneStore';
import { HierarchyPanel } from '../HierarchyPanel';

const HIERARCHY_XML = `
<Ethanon>
  <SceneProperties><Ambient r="1" g="1" b="1" /><ZAxisDirection x="0" y="-1" /></SceneProperties>
  <EntitiesInScene>
    <Entity id="1" spriteFrame="0" editorEntityUID="parent" editorEntityName="Parent" editorHierarchyOrder="0">
      <Position x="0" y="0" z="0" angle="0" /><Entity><FileName>parent.ent</FileName></Entity>
    </Entity>
    <Entity id="2" spriteFrame="0" editorEntityUID="child" editorEntityName="Child" editorParentEntity="parent" editorHierarchyOrder="0">
      <Position x="10" y="0" z="0" angle="0" /><Entity><FileName>child.ent</FileName></Entity>
    </Entity>
    <Entity id="3" spriteFrame="0" editorEntityUID="grandchild" editorEntityName="Grandchild" editorParentEntity="child" editorHierarchyOrder="0">
      <Position x="20" y="0" z="0" angle="0" /><Entity><FileName>grandchild.ent</FileName></Entity>
    </Entity>
  </EntitiesInScene>
</Ethanon>
`;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useSceneStore.getState().loadScene(HIERARCHY_XML);
  vi.restoreAllMocks();
});

function renderHierarchy() {
  useSceneStore.getState().loadScene(HIERARCHY_XML);
  useSceneStore.setState({ scrollHierarchyRequest: null });
  const result = render(<HierarchyPanel />);
  const panel = result.container.querySelector('.hierarchy-ui') as HTMLElement;
  const scroller = result.container.querySelector('.hierarchy-scrollbar') as HTMLDivElement;
  return { ...result, panel, scroller };
}

describe('HierarchyPanel interactions', () => {
  it('handles duplicate and paste shortcuts once without bubbling to window', () => {
    const { panel } = renderHierarchy();
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);

    act(() => useSceneStore.getState().selectEntity('parent'));
    fireEvent.keyDown(panel, { key: 'd', ctrlKey: true });
    expect(useSceneStore.getState().scene.entities).toHaveLength(6);
    expect(windowKeyDown).not.toHaveBeenCalled();

    act(() => {
      useSceneStore.getState().selectEntity('parent');
      useSceneStore.getState().copySelected();
    });
    fireEvent.keyDown(panel, { key: 'v', ctrlKey: true });
    expect(useSceneStore.getState().scene.entities).toHaveLength(9);
    expect(windowKeyDown).not.toHaveBeenCalled();

    window.removeEventListener('keydown', windowKeyDown);
  });

  it('does not capture editor shortcuts while the search input owns focus', () => {
    renderHierarchy();
    act(() => useSceneStore.getState().selectEntity('parent'));
    const search = screen.getByPlaceholderText('Search name, #ID...');

    fireEvent.keyDown(search, { key: 'd', ctrlKey: true });

    expect(useSceneStore.getState().scene.entities).toHaveLength(3);
  });

  it('extends and shrinks a keyboard range using a stable anchor and moving caret', () => {
    const { panel } = renderHierarchy();
    fireEvent.click(screen.getByText('Parent'));

    fireEvent.keyDown(panel, { key: 'ArrowDown', shiftKey: true });
    expect(useSceneStore.getState().selectedUIDs).toEqual(['parent', 'child']);

    fireEvent.keyDown(panel, { key: 'ArrowDown', shiftKey: true });
    expect(useSceneStore.getState().selectedUIDs).toEqual(['parent', 'child', 'grandchild']);

    fireEvent.keyDown(panel, { key: 'ArrowUp', shiftKey: true });
    expect(useSceneStore.getState().selectedUIDs).toEqual(['parent', 'child']);
  });

  it('expands collapsed ancestors before scrolling to a requested descendant', async () => {
    const { scroller } = renderHierarchy();
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    fireEvent.click(screen.getAllByTitle('Collapse children')[0]);
    expect(screen.queryByText('Grandchild')).toBeNull();

    act(() => useSceneStore.getState().scrollHierarchyToEntity('grandchild'));

    await act(async () => {});
    expect(screen.getByText('Grandchild')).toBeTruthy();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledOnce());
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('clears an incompatible search before revealing the requested entity', async () => {
    const { scroller } = renderHierarchy();
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    const search = screen.getByPlaceholderText('Search name, #ID...') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Parent' } });
    expect(screen.queryByText('Grandchild')).toBeNull();

    act(() => useSceneStore.getState().scrollHierarchyToEntity('grandchild'));

    await waitFor(() => expect(search.value).toBe(''));
    await waitFor(() => expect(screen.getByText('Grandchild')).toBeTruthy());
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });

  it('pings a hidden descendant without changing selection and clears the highlight after 1.2 seconds', async () => {
    vi.useFakeTimers();
    const { scroller } = renderHierarchy();
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    act(() => useSceneStore.getState().selectEntity('parent'));
    fireEvent.click(screen.getAllByTitle('Collapse children')[0]);
    expect(screen.queryByText('Grandchild')).toBeNull();

    act(() => useSceneStore.getState().pingHierarchyEntity('grandchild'));

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Grandchild')).toBeTruthy();
    const grandchildRow = screen.getByText('Grandchild').closest('.hierarchy-row');
    expect(grandchildRow?.classList.contains('hierarchy-row-ping')).toBe(true);
    expect(useSceneStore.getState().selectedUIDs).toEqual(['parent']);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    act(() => vi.advanceTimersByTime(1200));
    expect(grandchildRow?.classList.contains('hierarchy-row-ping')).toBe(false);
  });
});
