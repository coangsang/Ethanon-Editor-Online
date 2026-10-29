// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityRefPickerModal } from '../EntityRefPickerModal';
import type { EntityInstance } from '../../types';

function createMockEntity(id: number, uid: string, name: string): EntityInstance {
  return {
    id,
    editorEntityUID: uid,
    entityName: name,
    editorEntityName: name,
    position: { x: 0, y: 0, z: 0 },
    angle: 0,
    spriteFrame: 0,
    hide: false,
    flipX: false,
    flipY: false,
    customData: [],
  };
}

describe('EntityRefPickerModal', () => {
  const entities: EntityInstance[] = [
    createMockEntity(1, 'uid-alpha', 'Alpha Chest'),
    createMockEntity(2, 'uid-beta', 'Beta Key'),
    createMockEntity(3, 'uid-gamma', 'Gamma Door'),
  ];

  it('preserves search query when parent component re-renders with a new onClose reference', () => {
    function ParentComponent() {
      const [count, setCount] = useState(0);

      return (
        <div>
          <button onClick={() => setCount(c => c + 1)}>Trigger Parent Re-render ({count})</button>
          <EntityRefPickerModal
            isOpen={true}
            entities={entities}
            onSelect={() => {}}
            // An inline function reference changes on every parent re-render
            onClose={() => {}}
          />
        </div>
      );
    }

    render(<ParentComponent />);

    const searchInput = screen.getByLabelText('Search reference entity') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Door' } });
    expect(searchInput.value).toBe('Door');

    // Trigger parent re-render by clicking button
    fireEvent.click(screen.getByRole('button', { name: /Trigger Parent Re-render/i }));

    // Search query should NOT be wiped clean
    expect(searchInput.value).toBe('Door');
    expect(screen.getByText('Gamma Door')).toBeTruthy();
    expect(screen.queryByText('Alpha Chest')).toBeNull();
  });
});
