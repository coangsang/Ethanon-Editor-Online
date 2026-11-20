import type { EntityInstance } from '../../types';
import type { EntityCustomInspectorKind } from './entityCustomInspectors';
import { CharacterCustomInspector } from './CharacterCustomInspector';

export function EntityCustomInspector({ kind, entity }: { kind: EntityCustomInspectorKind; entity: EntityInstance }) {
  switch (kind) {
    case 'character':
      return <CharacterCustomInspector entity={entity} />;
  }
}
