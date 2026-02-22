import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  warning?: string;
  fullWidth?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Input Component
 *
 * Accessible form input with label, validation states, and error messages.
 * Meets WCAG 2.1 AA standards with proper ARIA attributes.
 *
 * @example
 * <Input
 *   label="Email Address"
 *   type="email"
 *   placeholder="you@example.com"
 *   required
 *   error={errors.email}
 * />
 *
 * @example
 * <Input
 *   label="Search"
 *   leftIcon={<Search size={18} />}
 *   placeholder="Search files..."
 * />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      success,
      warning,
      fullWidth = false,
      inputSize = 'md',
      leftIcon,
      rightIcon,
      id,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const inputId = id || React.useId();
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const successId = success ? `${inputId}-success` : undefined;
    const warningId = warning ? `${inputId}-warning` : undefined;

    // Determine current state
    const hasError = !!error;
    const hasSuccess = !!success;
    const hasWarning = !!warning;

    // Aria-describedby includes all relevant IDs
    const ariaDescribedBy = [helperId, errorId, successId, warningId]
      .filter(Boolean)
      .join(' ') || undefined;

    const inputBaseStyles = [
      // Base styles
      'w-full rounded-lg border-2',
      'font-normal text-[var(--color-neutral-900)]',
      'placeholder:text-[var(--color-neutral-400)]',
      'transition-all duration-200',

      // Focus styles
      'focus:outline-none focus:ring-3 focus:ring-offset-1',

      // Disabled styles
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-neutral-100)]',
    ];

    const inputSizes = {
      sm: 'px-3 py-1.5 text-sm min-h-[36px]',
      md: 'px-4 py-2.5 text-base min-h-[44px]', // Minimum touch target
      lg: 'px-5 py-3 text-lg min-h-[48px]',
    };

    const inputStates = {
      default: [
        'border-[var(--color-neutral-300)] bg-white',
        'hover:border-[var(--color-neutral-400)]',
        'focus:border-[var(--color-primary-500)] focus:ring-[var(--color-primary-500)]/20',
      ],
      error: [
        'border-[var(--color-error-500)] bg-[var(--color-error-50)]',
        'focus:border-[var(--color-error-600)] focus:ring-[var(--color-error-500)]/20',
      ],
      success: [
        'border-[var(--color-success-500)] bg-[var(--color-success-50)]',
        'focus:border-[var(--color-success-600)] focus:ring-[var(--color-success-500)]/20',
      ],
      warning: [
        'border-[var(--color-warning-500)] bg-[var(--color-warning-50)]',
        'focus:border-[var(--color-warning-600)] focus:ring-[var(--color-warning-500)]/20',
      ],
    };

    const currentState = hasError
      ? 'error'
      : hasSuccess
      ? 'success'
      : hasWarning
      ? 'warning'
      : 'default';

    const widthClass = fullWidth ? 'w-full' : '';

    // Icon styles
    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!rightIcon || hasError || hasSuccess || hasWarning;
    const paddingWithIcon = {
      sm: hasLeftIcon ? 'pl-9' : '',
      md: hasLeftIcon ? 'pl-10' : '',
      lg: hasLeftIcon ? 'pl-12' : '',
    };

    // Status icon
    const StatusIcon = hasError
      ? AlertCircle
      : hasSuccess
      ? CheckCircle
      : hasWarning
      ? AlertTriangle
      : null;

    return (
      <div className={cn('flex flex-col gap-1.5', widthClass)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-[var(--color-neutral-900)]"
          >
            {label}
            {required && (
              <span className="text-[var(--color-error-600)] ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-500)]"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputBaseStyles,
              inputSizes[inputSize],
              inputStates[currentState],
              paddingWithIcon[inputSize],
              hasRightIcon && 'pr-10',
              className
            )}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            aria-required={required}
            disabled={disabled}
            {...props}
          />

          {/* Right Icon / Status Icon */}
          {(rightIcon || StatusIcon) && (
            <div
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                hasError && 'text-[var(--color-error-600)]',
                hasSuccess && 'text-[var(--color-success-600)]',
                hasWarning && 'text-[var(--color-warning-600)]',
                !hasError && !hasSuccess && !hasWarning && 'text-[var(--color-neutral-500)]'
              )}
              aria-hidden="true"
            >
              {StatusIcon ? <StatusIcon size={18} /> : rightIcon}
            </div>
          )}
        </div>

        {/* Helper Text */}
        {helperText && !error && !success && !warning && (
          <p id={helperId} className="text-sm text-[var(--color-neutral-600)]">
            {helperText}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <p id={errorId} className="text-sm text-[var(--color-error-700)] font-medium" role="alert">
            {error}
          </p>
        )}

        {/* Success Message */}
        {success && (
          <p id={successId} className="text-sm text-[var(--color-success-700)] font-medium">
            {success}
          </p>
        )}

        {/* Warning Message */}
        {warning && (
          <p id={warningId} className="text-sm text-[var(--color-warning-700)] font-medium">
            {warning}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
