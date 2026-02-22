import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

/**
 * LoadingState Component
 *
 * Loading spinner with optional text and ARIA announcements.
 *
 * @example
 * <LoadingState text="Loading data..." />
 * <LoadingState size="lg" fullScreen />
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2
        className={cn('animate-spin text-[var(--color-primary-600)]', sizes[size])}
        aria-hidden="true"
      />
      {text && (
        <p className={cn('text-[var(--color-neutral-600)] font-medium', textSizes[size])}>
          {text}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {text || 'Loading...'}
      </span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/90 z-[var(--z-modal)]">
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Skeleton Component
 *
 * Placeholder for loading content with shimmer effect.
 *
 * @example
 * <Skeleton width="100%" height="20px" />
 * <Skeleton circle width="48px" height="48px" />
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width = '100%',
  height = '20px',
  circle = false,
  ...props
}) => {
  const styles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={cn(
        'bg-[var(--color-neutral-200)] animate-pulse',
        circle ? 'rounded-full' : 'rounded-md',
        className
      )}
      style={styles}
      aria-hidden="true"
      {...props}
    />
  );
};

/**
 * SkeletonCard Component
 *
 * Pre-built skeleton for card layouts.
 */
export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton circle width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height="16px" />
          <Skeleton width="40%" height="14px" />
        </div>
      </div>
      <Skeleton width="100%" height="12px" />
      <Skeleton width="90%" height="12px" />
      <Skeleton width="95%" height="12px" />
    </div>
  );
};
