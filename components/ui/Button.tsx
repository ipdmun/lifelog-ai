import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Button Component
 *
 * Accessible, keyboard-navigable button with multiple variants and sizes.
 * Meets WCAG 2.1 AA standards with proper focus indicators and touch targets.
 *
 * @example
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Get Started
 * </Button>
 *
 * @example
 * <Button variant="outline" leftIcon={<Upload />} loading={isUploading}>
 *   Upload File
 * </Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles = [
      // Base styles
      'inline-flex items-center justify-center gap-2',
      'font-semibold rounded-lg',
      'transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',

      // Prevent text selection on click
      'select-none',

      // Smooth transform for interactive feedback
      'active:scale-[0.98]',
    ];

    const variants = {
      primary: [
        'bg-[var(--color-primary-600)] text-white',
        'hover:bg-[var(--color-primary-700)]',
        'focus-visible:ring-[var(--color-primary-500)]',
        'shadow-md hover:shadow-lg',
      ],
      secondary: [
        'bg-[var(--color-neutral-900)] text-white',
        'hover:bg-[var(--color-neutral-800)]',
        'focus-visible:ring-[var(--color-neutral-500)]',
        'shadow-md hover:shadow-lg',
      ],
      outline: [
        'bg-transparent border-2 border-[var(--color-neutral-300)]',
        'text-[var(--color-neutral-900)]',
        'hover:bg-[var(--color-neutral-100)]',
        'focus-visible:ring-[var(--color-primary-500)]',
      ],
      ghost: [
        'bg-transparent text-[var(--color-neutral-700)]',
        'hover:bg-[var(--color-neutral-100)]',
        'focus-visible:ring-[var(--color-primary-500)]',
      ],
      danger: [
        'bg-[var(--color-error-600)] text-white',
        'hover:bg-[var(--color-error-700)]',
        'focus-visible:ring-[var(--color-error-500)]',
        'shadow-md hover:shadow-lg',
      ],
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm min-h-[36px]', // Above minimum 32px for better UX
      md: 'px-5 py-2.5 text-base min-h-[44px]', // Minimum touch target
      lg: 'px-6 py-3 text-lg min-h-[48px]', // Comfortable large target
    };

    const widthClass = fullWidth ? 'w-full' : '';

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          widthClass,
          className
        )}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <Loader2
            className="animate-spin"
            size={size === 'sm' ? 14 : size === 'md' ? 16 : 18}
            aria-hidden="true"
          />
        )}

        {/* Left icon */}
        {!loading && leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Button text */}
        {children}

        {/* Right icon */}
        {!loading && rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
