'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right';
  className?: string;
}

/**
 * Sidebar Component
 *
 * Responsive sidebar with drawer behavior on mobile.
 * - Desktop: Fixed sidebar (320px)
 * - Tablet: Collapsible sidebar (240px)
 * - Mobile: Full-screen drawer overlay
 *
 * @example
 * const [isOpen, setIsOpen] = useState(true);
 *
 * <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)}>
 *   <nav>...</nav>
 * </Sidebar>
 */
export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  children,
  position = 'right',
  className,
}) => {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      // Only prevent scroll on mobile/tablet
      if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && !isOpen) {
        // On desktop, sidebar is always visible, so we don't auto-close
        return;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile/Tablet Backdrop (< 1024px) */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-[var(--bg-overlay)] z-[var(--z-modal-backdrop)] animate-fade-in"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base styles
          'fixed top-0 h-screen bg-white border-[var(--color-neutral-200)] z-[var(--z-modal)] overflow-y-auto',

          // Desktop (>= 1024px): Always visible, fixed width
          'lg:sticky lg:top-0 lg:z-auto',

          // Position
          position === 'left' ? [
            'left-0 border-r',
            'lg:left-auto',
          ] : [
            'right-0 border-l',
            'lg:right-auto',
          ],

          // Width
          'w-full sm:w-80 lg:w-80', // 320px on desktop

          // Show/hide based on isOpen
          isOpen ? 'translate-x-0' : [
            position === 'left' ? '-translate-x-full lg:translate-x-0' : 'translate-x-full lg:translate-x-0',
          ],

          // Transition
          'transition-transform duration-300 ease-in-out',

          className
        )}
        aria-label={`${position} sidebar`}
      >
        {/* Close button (Mobile/Tablet only) */}
        <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-[var(--color-neutral-200)] p-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-[var(--color-neutral-900)]">
            Settings
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg',
              'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]',
              'hover:bg-[var(--color-neutral-100)]',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]'
            )}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar content */}
        <div className="p-6">
          {children}
        </div>
      </aside>
    </>
  );
};
