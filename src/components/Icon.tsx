import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  FolderOpen,
  Hand,
  Lock,
  MousePointer2,
  Maximize,
  Move,
  PackageOpen,
  RotateCw,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2,
  Unlock,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "chevron-down"
  | "chevron-right"
  | "chevron-up"
  | "copy"
  | "custom"
  | "cursor"
  | "fit-view"
  | "hand"
  | "lock"
  | "move"
  | "ping"
  | "prefab"
  | "project-open"
  | "rotate"
  | "save"
  | "settings"
  | "trash"
  | "unpack"
  | "unlock";

interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  title?: string;
}

const ICONS: Record<IconName, LucideIcon> = {
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  copy: Copy,
  custom: SlidersHorizontal,
  cursor: MousePointer2,
  "fit-view": Maximize,
  hand: Hand,
  lock: Lock,
  move: Move,
  ping: Crosshair,
  prefab: Boxes,
  "project-open": FolderOpen,
  rotate: RotateCw,
  save: Save,
  settings: Settings,
  trash: Trash2,
  unpack: PackageOpen,
  unlock: Unlock,
};

export function Icon({ name, size = 16, className = "", title }: IconProps) {
  const IconComponent = ICONS[name];

  return (
    <IconComponent
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      size={size}
      strokeWidth={1.75}
    >
      {title ? <title>{title}</title> : null}
    </IconComponent>
  );
}
