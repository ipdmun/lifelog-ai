import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

/**
 * EmptyState Component
 *
 * Display when there's no content or data to show.
 * Provides clear messaging and optional call-to-action.
 *
 * @example
 * <EmptyState
 *   icon={<FileText size={48} />}
 *   title="No logs yet"
 *   description="Upload your calendar to see your activity logs."
 *   action={{
 *     label: "Upload Calendar",
 *     onClick: () => router.push('/upload'),
 *     icon: <Upload size={18} />
 *   }}
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'text-center',
        'py-12 px-4',
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div
          className="text-[var(--color-neutral-400)] mb-4"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-bold text-[var(--color-neutral-900)] mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-[var(--color-neutral-600)] max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <Button
          variant="primary"
          size="lg"
          onClick={action.onClick}
          leftIcon={action.icon}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
