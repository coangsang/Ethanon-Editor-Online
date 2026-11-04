import { useSceneStore } from '../store/sceneStore';

export function CharacterList() {
  const projectName = useSceneStore(s => s.projectName);
  const projectCharacters = useSceneStore(s => s.projectCharacters);

  if (!projectName) {
    return (
      <div className="project-empty-state flex h-full items-center justify-center px-4 text-center text-xs text-gray-500">
        No project open
      </div>
    );
  }

  if (projectCharacters.length === 0) {
    return (
      <div className="project-empty-state flex h-full flex-col items-center justify-center px-4 text-center text-xs text-gray-500 gap-1.5">
        <span>No characters in <code className="text-amber-400 font-mono">/npcs</code></span>
      </div>
    );
  }

  return (
    <div className="project-resource-list h-full overflow-y-auto p-2 pr-1.5 hierarchy-scrollbar">
      <div className="grid gap-2 grid-auto-scenes">
        {projectCharacters.map(character => {
          const lastSlash = character.relativePath.lastIndexOf('/');
          const dirPrefix = lastSlash !== -1 ? character.relativePath.slice(0, lastSlash + 1) : '/';
          const cleanName = character.name.replace(/\.character$/i, '') || character.name;

          return (
            <div
              key={character.relativePath}
              title={`npcs/${character.relativePath}`}
              className="project-resource-card project-resource-card-static flex min-w-0 items-center gap-2 rounded border border-gray-800 bg-gray-800/40 px-2.5 py-2 text-left text-gray-200 select-none cursor-default"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-amber-600/40 bg-amber-950/30">
                <span className="font-mono text-xs font-bold text-amber-400 select-none">C</span>
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-gray-200">
                  {cleanName}
                </span>
                <span className="block truncate text-[10px] text-gray-500 font-mono">
                  {dirPrefix}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

