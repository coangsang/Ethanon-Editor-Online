import { useEffect } from 'react';
import { SpriteList } from '../panels/SpriteList';

interface SpritePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sprite: string) => void;
  currentSprite: string | null;
}

export function SpritePickerModal({ isOpen, onClose, onSelect, currentSprite }: SpritePickerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-[600px] h-[80vh] max-h-[800px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Select Sprite</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 min-h-0 relative">
          <SpriteList
            headerMode="embedded"
            selectedSprite={currentSprite || undefined}
            onSelectSprite={(sprite) => {
              onSelect(sprite.relativePath || sprite.name);
            }}
          />
        </div>
        
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/80 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
