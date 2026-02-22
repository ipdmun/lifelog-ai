import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card Component
 *
 * Flexible container component with three visual variants.
 * Use for grouping related content with clear visual boundaries.
 *
 * @example
 * <Card variant="elevated">
 *   <CardHeader>
 *     <h3>Title</h3>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Content goes here</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'elevated',
      padding = 'md',
      hover = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = [
      'rounded-xl',
      'transition-all duration-200',
    ];

    const variants = {
      elevated: [
        'bg-white',
        'shadow-md',
        hover && 'hover:shadow-lg hover:-translate-y-0.5',
      ],
      outlined: [
        'bg-white',
        'border-2 border-[var(--color-neutral-200)]',
        hover && 'hover:border-[var(--color-neutral-300)] hover:shadow-sm',
      ],
      filled: [
        'bg-[var(--color-neutral-100)]',
        hover && 'hover:bg-[var(--color-neutral-200)]',
      ],
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * CardHeader - Top section of card, typically for titles and actions
 */
export const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding = 'md', children, ...props }, ref) => {
    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'border-b border-[var(--color-neutral-200)]',
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

/**
 * CardContent - Main content area of card
 */
export const CardContent = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding = 'md', children, ...props }, ref) => {
    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

/**
 * CardFooter - Bottom section of card, typically for actions
 */
export const CardFooter = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding = 'md', children, ...props }, ref) => {
    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'border-t border-[var(--color-neutral-200)]',
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
