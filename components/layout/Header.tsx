'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '../auth/LoginModal';
import { User as UserIcon, LogOut } from 'lucide-react';

export interface NavLink {
  label: string;
  href: string;
}

export interface HeaderProps {
  logo?: {
    text?: string;
    icon?: React.ReactNode;
    href?: string;
  };
  navLinks?: NavLink[];
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

/**
 * Header Component
 *
 * Responsive navigation header with mobile menu drawer.
 * Includes backdrop blur, sticky positioning, and keyboard accessibility.
 *
 * @example
 * <Header
 *   logo={{ text: "CalToPaper", href: "/" }}
 *   navLinks={[
 *     { label: "Features", href: "#features" },
 *     { label: "Pricing", href: "#pricing" },
 *   ]}
 *   primaryAction={{ label: "Get Started", href: "/upload" }}
 *   secondaryAction={{ label: "Dashboard", href: "/dashboard" }}
 * />
 */
export const Header: React.FC<HeaderProps> = ({
  logo = { text: 'LifeLog AI', href: '/' },
  navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Demo', href: '/#demo' },
    { label: 'Pricing', href: '/#pricing' },
  ],
  primaryAction = { label: 'Get Started', href: '/upload' },
  secondaryAction = { label: 'Dashboard', href: '/dashboard' },
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[var(--z-fixed)] backdrop-blur-glass border-b border-[var(--color-neutral-200)]"
      role="banner"
    >
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href={logo.href || '/'}
          className={cn(
            'flex items-center gap-2 font-bold text-xl',
            'text-[var(--color-neutral-900)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] rounded-lg'
          )}
        >
          {logo.icon || (
            <div className="w-8 h-8 bg-[var(--color-primary-600)] text-white rounded-lg flex items-center justify-center font-serif font-bold text-xl">
              L
            </div>
          )}
          <span className="tracking-tight">{logo.text || 'LifeLog AI'}</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium text-[var(--color-neutral-700)]',
                'hover:text-[var(--color-neutral-900)]',
                'transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] rounded-md px-2 py-1'
              )}
            >
              {link.label === 'Features' ? t('navFeatures') : link.label === 'Demo' ? t('navDemo') : link.label === 'Pricing' ? t('navPricing') : link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />

          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-sm font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] hidden sm:block">
                Dashboard
              </Link>
              <Link href="/diary" className="text-sm font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] hidden sm:block">
                Diary
              </Link>
              <div className="flex items-center gap-3 bg-[var(--color-neutral-100)] p-1 pr-3 rounded-full border border-[var(--color-neutral-200)] ml-2">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] flex items-center justify-center text-white overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={16} />
                  )}
                </div>
                <span className="text-sm font-medium text-[var(--color-neutral-700)] max-w-[100px] truncate">
                  {user.displayName || 'Guest'}
                </span>
                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded-full hover:bg-[var(--color-neutral-200)] text-[var(--color-neutral-500)] transition-colors"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {secondaryAction && (
                <Link href={secondaryAction.href}>
                  <Button variant="ghost" size="md">
                    {t('btnDashboard')}
                  </Button>
                </Link>
              )}
              <Button variant="primary" size="md" onClick={() => setIsLoginModalOpen(true)}>
                {t('btnGetStarted')}
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={cn(
            'md:hidden p-2 rounded-lg',
            'text-[var(--color-neutral-700)] hover:text-[var(--color-neutral-900)]',
            'hover:bg-[var(--color-neutral-100)]',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]'
          )}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden fixed inset-0 top-16 z-[var(--z-modal)] animate-fade-in"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[var(--bg-overlay)]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Panel */}
          <div className="relative bg-white h-full overflow-y-auto animate-slide-in-right">
            <div className="p-6 space-y-6">
              {/* Navigation Links */}
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block px-4 py-3 rounded-lg',
                      'text-base font-medium text-[var(--color-neutral-700)]',
                      'hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-900)]',
                      'transition-colors duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]'
                    )}
                  >
                    {link.label === 'Features' ? t('navFeatures') : link.label === 'Demo' ? t('navDemo') : link.label === 'Pricing' ? t('navPricing') : link.label}
                  </Link>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-6 border-t border-[var(--color-neutral-200)]">
                <div className="flex justify-start px-2">
                  <LanguageSwitcher />
                </div>
                {secondaryAction && (
                  <Link
                    href={secondaryAction.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="outline" size="lg" fullWidth>
                      {t('btnDashboard')}
                    </Button>
                  </Link>
                )}
                {primaryAction && (
                  <Link
                    href={primaryAction.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="primary" size="lg" fullWidth>
                      {t('btnGetStarted')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Login Modal */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </header>
  );
};
