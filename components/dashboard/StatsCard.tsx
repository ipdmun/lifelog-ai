import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

/**
 * StatsCard Component
 *
 * Display key metrics with icon, value, and optional trend indicator.
 * Fully responsive with touch-friendly sizing.
 *
 * @example
 * <StatsCard
 *   label="Total Events"
 *   value={342}
 *   icon={Calendar}
 *   change={{ value: 12, trend: 'up' }}
 * />
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon: Icon,
  change,
  className,
}) => {
  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-[var(--color-success-700)]';
      case 'down':
        return 'text-[var(--color-error-700)]';
      case 'neutral':
        return 'text-[var(--color-neutral-600)]';
    }
  };

  const getTrendSymbol = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'neutral':
        return '→';
    }
  };

  return (
    <Card variant="outlined" padding="md" hover className={className}>
      <div className="flex items-start justify-between gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] flex items-center justify-center text-[var(--color-primary-600)]">
          <Icon size={24} />
        </div>

        {/* Change Indicator */}
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full',
              change.trend === 'up' && 'bg-[var(--color-success-50)]',
              change.trend === 'down' && 'bg-[var(--color-error-50)]',
              change.trend === 'neutral' && 'bg-[var(--color-neutral-100)]',
              getTrendColor(change.trend)
            )}
            aria-label={`${change.trend === 'up' ? 'Increased' : change.trend === 'down' ? 'Decreased' : 'No change'} by ${Math.abs(change.value)}%`}
          >
            <span aria-hidden="true">{getTrendSymbol(change.trend)}</span>
            <span>{Math.abs(change.value)}%</span>
          </div>
        )}
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-[var(--color-neutral-600)] mt-4 mb-1">
        {label}
      </p>

      {/* Value */}
      <p className="text-3xl font-bold text-[var(--color-neutral-900)]">
        {value}
      </p>
    </Card>
  );
};
