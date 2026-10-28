import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export interface ToolbarButtonProps {
  children?: ReactNode;
  icon?: IconName;
  iconSize?: number;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'purple';
  className?: string;
}

export function ToolbarButton({
  children,
  icon,
  iconSize = 14,
  title,
  onClick,
  disabled = false,
  active = false,
  variant = 'default',
  className = '',
}: ToolbarButtonProps) {
  let colorClasses = 'toolbar-button';

  if (disabled) {
    colorClasses = 'toolbar-button toolbar-button-disabled';
  } else if (variant === 'purple') {
    colorClasses = active
      ? 'toolbar-button toolbar-button-active'
      : 'toolbar-button';
  } else if (active) {
    colorClasses = 'toolbar-button toolbar-button-active';
  }

  const isIconOnly = Boolean(icon && !children);
  const paddingClass = isIconOnly ? 'p-1.5' : 'px-2 py-1';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`toolbar-button flex items-center gap-1.5 text-xs rounded transition-colors select-none ${paddingClass} ${colorClasses} ${className}`}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
    </button>
  );
}
