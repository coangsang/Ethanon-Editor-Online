import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../../store/sceneStore';

export function ProjectScanIssuesPopover() {
  const issues = useSceneStore(s => s.projectScanIssues);
  const [openIssues, setOpenIssues] = useState<typeof issues | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isOpen = openIssues === issues && issues.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const closeIfOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpenIssues(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIssues(null);
    };

    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  if (issues.length === 0) return null;

  const issueLabel = `${issues.length} entity template ${issues.length === 1 ? 'file was' : 'files were'} skipped`;

  return (
    <div ref={popoverRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`${issueLabel}. Open details.`}
        onClick={() => setOpenIssues(open => open === issues ? null : issues)}
        className="rounded border border-amber-800/80 bg-amber-950/40 px-2 py-1 text-xs text-amber-300 transition-colors hover:border-amber-600 hover:bg-amber-950/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300"
      >
        {issues.length} entity files skipped
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Skipped entity template files"
          className="absolute right-0 mt-1.5 w-96 max-w-[calc(100vw-1rem)] rounded border border-gray-700 bg-gray-900 p-2 text-gray-200 shadow-2xl z-50"
        >
          <div className="px-1 pb-1.5 text-xs font-medium text-amber-300">{issueLabel}</div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-gray-800 select-text">
            {issues.map(issue => (
              <li key={`${issue.path}:${issue.stage}:${issue.message}`} className="px-1 py-1.5">
                <div className="font-mono text-[11px] text-gray-200 break-all">{issue.path}</div>
                <div className="mt-0.5 text-[10px] text-gray-400">
                  <span className="uppercase text-amber-400">{issue.stage}</span>: {issue.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
