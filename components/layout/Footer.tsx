import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  copyright?: string;
  links?: FooterLink[];
  className?: string;
}

/**
 * Footer Component
 *
 * Site footer with copyright information and navigation links.
 * Responsive layout that stacks on mobile.
 *
 * @example
 * <Footer
 *   copyright="© 2026 CalToPaper. All rights reserved."
 *   links={[
 *     { label: "Privacy", href: "/privacy" },
 *     { label: "Terms", href: "/terms" },
 *     { label: "Contact", href: "/contact" },
 *   ]}
 * />
 */
export const Footer: React.FC<FooterProps> = ({
  copyright = '© 2026 CalToPaper. All rights reserved.',
  links = [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Contact', href: '/contact' },
  ],
  className,
}) => {
  return (
    <footer
      className={cn(
        'py-12 px-4 sm:px-6 lg:px-8',
        'border-t border-[var(--color-neutral-200)]',
        'bg-[var(--color-neutral-50)]',
        className
      )}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Copyright */}
          <p className="text-sm text-[var(--color-neutral-600)]">
            {copyright}
          </p>

          {/* Links */}
          {links && links.length > 0 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-6"
              aria-label="Footer navigation"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm text-[var(--color-neutral-600)]',
                    'hover:text-[var(--color-neutral-900)]',
                    'transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] rounded-md px-2 py-1'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
};
