import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * ChartCard Component
 *
 * Wrapper for charts with accessible header and optional actions.
 * Provides consistent styling for dashboard visualizations.
 *
 * @example
 * <ChartCard
 *   title="Event Distribution"
 *   description="Events by hour of day"
 * >
 *   <BarChart data={chartData} />
 * </ChartCard>
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  children,
  action,
  className,
}) => {
  return (
    <Card variant="outlined" padding="none" className={className}>
      <CardHeader padding="md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--color-neutral-900)] mb-1">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-[var(--color-neutral-600)]">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="flex-shrink-0">
              {action}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent padding="md">
        {/* Chart container with accessible label */}
        <div
          role="img"
          aria-label={`${title} chart${description ? ': ' + description : ''}`}
          className="w-full"
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
};
