import {
  Boxes,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Hand,
  MousePointer2,
  Maximize,
  Move,
  RotateCw,
  Save,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'chevron-down'
  | 'chevron-up'
  | 'cursor'
  | 'fit-view'
  | 'hand'
  | 'move'
  | 'prefab'
  | 'project-open'
  | 'rotate'
  | 'save'
  | 'settings'
  | 'trash';

interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  title?: string;
}

const ICONS: Record<IconName, LucideIcon> = {
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  cursor: MousePointer2,
  'fit-view': Maximize,
  hand: Hand,
  move: Move,
  prefab: Boxes,
  'project-open': FolderOpen,
  rotate: RotateCw,
  save: Save,
  settings: Settings,
  trash: Trash2,
};

export function Icon({ name, size = 16, className = '', title }: IconProps) {
  const IconComponent = ICONS[name];

  return (
    <IconComponent
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      size={size}
      strokeWidth={1.75}
    >
      {title ? <title>{title}</title> : null}
    </IconComponent>
  );
}
