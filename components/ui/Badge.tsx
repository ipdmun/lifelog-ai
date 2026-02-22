import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

/**
 * Badge Component
 *
 * Small status indicators with semantic colors.
 * Use for tags, statuses, counts, and labels.
 *
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" dot>Pending</Badge>
 * <Badge variant="info" size="sm">New</Badge>
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'neutral',
      size = 'md',
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = [
      'inline-flex items-center gap-1.5',
      'font-semibold rounded-full',
      'whitespace-nowrap',
    ];

    const variants = {
      success: 'bg-[var(--color-success-100)] text-[var(--color-success-700)] border border-[var(--color-success-200)]',
      warning: 'bg-[var(--color-warning-100)] text-[var(--color-warning-700)] border border-[var(--color-warning-200)]',
      error: 'bg-[var(--color-error-100)] text-[var(--color-error-700)] border border-[var(--color-error-200)]',
      info: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]',
      neutral: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] border border-[var(--color-neutral-200)]',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    };

    const dotColors = {
      success: 'bg-[var(--color-success-500)]',
      warning: 'bg-[var(--color-warning-500)]',
      error: 'bg-[var(--color-error-500)]',
      info: 'bg-[var(--color-primary-500)]',
      neutral: 'bg-[var(--color-neutral-500)]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
