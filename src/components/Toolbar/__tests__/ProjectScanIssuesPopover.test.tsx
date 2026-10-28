// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectScanIssuesPopover } from '../ProjectScanIssuesPopover';
import { useSceneStore } from '../../../store/sceneStore';

describe('ProjectScanIssuesPopover', () => {
  beforeEach(() => {
    useSceneStore.setState({
      projectScanIssues: [{
        path: 'legacy/broken.ent',
        stage: 'parse',
        message: 'Invalid entity template: missing <Ethanon><Entity> root.',
      }],
    });
  });

  afterEach(() => cleanup());

  it('shows the number of skipped files and their causes in a dismissible popover', () => {
    render(<ProjectScanIssuesPopover />);

    fireEvent.click(screen.getByRole('button', { name: /1 entity files skipped/i }));
    expect(screen.getByRole('dialog', { name: 'Skipped entity template files' }).textContent).toContain('legacy/broken.ent');
    expect(screen.getByRole('dialog').textContent).toContain('missing <Ethanon><Entity> root');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides itself when the current scan has no issues', () => {
    useSceneStore.setState({ projectScanIssues: [] });
    render(<ProjectScanIssuesPopover />);
    expect(screen.queryByRole('button', { name: /entity files skipped/i })).toBeNull();
  });
});
