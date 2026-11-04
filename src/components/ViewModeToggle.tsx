export interface ViewModeToggleProps {
  mode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
  activeColor?: string;
}

export function ViewModeToggle({
  mode,
  onChange,
  activeColor = 'bg-[#4b4d52] text-[#eceeef] border border-[#bec1c5]/40 shadow-sm',
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 border border-[#46484d] bg-[#292a2d] rounded p-0.5">
      <button
        type="button"
        onClick={() => onChange('grid')}
        title="Grid View"
        aria-label="Grid View"
        aria-pressed={mode === 'grid'}
        className={`p-1 rounded text-xs transition-colors ${
          mode === 'grid' ? activeColor : 'text-[#a2a5aa] hover:bg-[#3a3c40] hover:text-[#eceeef]'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        title="List View"
        aria-label="List View"
        aria-pressed={mode === 'list'}
        className={`p-1 rounded text-xs transition-colors ${
          mode === 'list' ? activeColor : 'text-[#a2a5aa] hover:bg-[#3a3c40] hover:text-[#eceeef]'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
