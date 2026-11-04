import { useMemo, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { ViewModeToggle } from '../components/ViewModeToggle';

const ACTIVE_CHARACTER_VIEW_MODE_KEY = 'ethanon_character_view_mode';

function getSavedCharacterViewMode(): 'grid' | 'list' {
  const saved = localStorage.getItem(ACTIVE_CHARACTER_VIEW_MODE_KEY);
  return saved === 'list' || saved === 'grid' ? saved : 'grid';
}

export function CharacterList() {
  const projectName = useSceneStore(s => s.projectName);
  const projectCharacters = useSceneStore(s => s.projectCharacters);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(getSavedCharacterViewMode);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(ACTIVE_CHARACTER_VIEW_MODE_KEY, mode);
  };

  const filteredCharacters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projectCharacters;

    return projectCharacters.filter(character => {
      const cleanName =
        character.name.replace(/\.character$/i, '') || character.name;
      return (
        cleanName.toLowerCase().includes(query) ||
        character.name.toLowerCase().includes(query) ||
        character.relativePath.toLowerCase().includes(query)
      );
    });
  }, [projectCharacters, searchQuery]);

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-[#a2a5aa]">
        No project open
      </div>
    );
  }

  if (projectCharacters.length === 0) {
    return (
      <div className="project-empty-state flex h-full flex-col items-center justify-center px-4 text-center text-xs text-[#a2a5aa] gap-1.5">
        <span>
          No characters in <code className="text-[#eceeef] font-mono px-1 py-0.5 bg-[#292a2d] rounded border border-[#46484d]">/npcs</code>
        </span>
      </div>
    );
  }

  return (
    <div className="character-list-ui flex flex-col h-full bg-[#252629] select-none">
      {/* Header bar */}
      <div className="asset-list-header px-3 py-1.5 min-h-[34px] border-b border-[#46484d] bg-[#2c2d30] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter characters (.character)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="asset-list-search editor-input bg-[#303135] border-[#46484d] text-[#eceeef] placeholder-[#a2a5aa] focus:border-[#d2d5db] w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle mode={viewMode} onChange={handleSetViewMode} />
        </div>
      </div>

      {/* Content list / grid */}
      <div className="project-resource-list flex-1 overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar">
        {filteredCharacters.length === 0 ? (
          <div className="px-3 py-6 text-xs text-[#a2a5aa] text-center italic">
            No matching characters found
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-2 grid-auto-scenes">
            {filteredCharacters.map(character => {
              const lastSlash = character.relativePath.lastIndexOf('/');
              const dirPrefix =
                lastSlash !== -1
                  ? character.relativePath.slice(0, lastSlash + 1)
                  : '/';
              const cleanName =
                character.name.replace(/\.character$/i, '') || character.name;

              return (
                <div
                  key={character.relativePath}
                  title={`npcs/${character.relativePath}`}
                  className="project-resource-card project-resource-card-static flex min-w-0 items-center gap-2 rounded border border-[#46484d] bg-[#2b2c2f] px-2.5 py-2 text-left text-[#eceeef] select-none cursor-default"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#46484d] bg-[#202124]">
                    <span className="font-mono text-xs font-bold text-[#bec1c5] select-none">
                      C
                    </span>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[#eceeef]">
                      {cleanName}
                    </span>
                    <span className="block truncate text-[10px] text-[#bec1c5] font-mono">
                      {dirPrefix}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredCharacters.map(character => {
              const lastSlash = character.relativePath.lastIndexOf('/');
              const dirPrefix =
                lastSlash !== -1
                  ? character.relativePath.slice(0, lastSlash + 1)
                  : '/';
              const cleanName =
                character.name.replace(/\.character$/i, '') || character.name;

              return (
                <div
                  key={character.relativePath}
                  title={`npcs/${character.relativePath}`}
                  className="project-resource-card project-resource-card-static flex min-w-0 items-center justify-between gap-2 rounded border border-[#46484d] bg-[#2b2c2f] px-2.5 py-1.5 text-left text-[#eceeef] select-none cursor-default"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#46484d] bg-[#202124]">
                      <span className="font-mono text-xs font-bold text-[#bec1c5] select-none">
                        C
                      </span>
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-xs text-[#eceeef] truncate font-medium">
                        {cleanName}
                      </span>
                      <span className="text-[10px] text-[#bec1c5] font-mono px-1 py-0.2 bg-[#292a2d] rounded border border-[#46484d]">
                        .character
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-[#bec1c5] font-mono px-1.5 py-0.5 rounded border border-[#46484d] bg-[#292a2d]">
                      {dirPrefix}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
