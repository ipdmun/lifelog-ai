import React from 'react';
import { cn } from '@/lib/utils';
import { Clock, Calendar, FileText } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';

export interface LogItem {
  id: string;
  type: 'digital' | 'analog';
  title: string;
  timestamp: Date;
  eventCount?: number;
}

export interface LogTimelineProps {
  logs: LogItem[];
  onLogClick?: (log: LogItem) => void;
  className?: string;
}

/**
 * LogTimeline Component
 *
 * Display recent activity logs with icons and timestamps.
 * Includes empty state and touch-friendly tap targets.
 *
 * @example
 * <LogTimeline
 *   logs={recentLogs}
 *   onLogClick={(log) => viewLogDetails(log)}
 * />
 */
export const LogTimeline: React.FC<LogTimelineProps> = ({
  logs,
  onLogClick,
  className,
}) => {
  const { t, locale } = useLanguage();

  const getLogIcon = (type: 'digital' | 'analog') => {
    return type === 'digital' ? Calendar : FileText;
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('justNow');
    if (hours < 24) return `${hours}${t('hAgo')}`;
    if (days < 7) return `${days}${t('dAgo')}`;
    return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'jp' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card variant="outlined" padding="none" className={className}>
      <CardHeader padding="md">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-[var(--color-primary-600)]" />
          <h3 className="text-lg font-bold text-[var(--color-neutral-900)]">
            {t('recentActivity')}
          </h3>
        </div>
      </CardHeader>

      <CardContent padding="none">
        {logs.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={<Clock size={48} />}
              title={t('noActivity')}
              description={t('noActivityDesc')}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)]" role="list">
            {logs.map((log) => {
              const Icon = getLogIcon(log.type);
              return (
                <li key={log.id}>
                  <button
                    onClick={() => onLogClick?.(log)}
                    className={cn(
                      'w-full px-6 py-4 flex items-center gap-4',
                      'hover:bg-[var(--color-neutral-50)]',
                      'transition-colors duration-200',
                      'text-left',
                      'min-h-[var(--min-touch-target)]', // Touch-friendly
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-500)]'
                    )}
                    aria-label={`View details for ${log.title}`}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                        log.type === 'digital'
                          ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]'
                          : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                      )}
                    >
                      <Icon size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-neutral-900)] truncate">
                        {log.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--color-neutral-600)]">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.eventCount !== undefined && (
                          <>
                            <span className="text-xs text-[var(--color-neutral-400)]">•</span>
                            <span className="text-xs text-[var(--color-neutral-600)]">
                              {log.eventCount} {log.eventCount === 1 ? t('eventSingle') : t('eventPlural')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div
                      className={cn(
                        'flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold',
                        log.type === 'digital'
                          ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
                          : 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-700)]'
                      )}
                    >
                      {log.type === 'digital' ? t('typeDigital') : t('typeAnalog')}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
