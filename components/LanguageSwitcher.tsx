'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Locale } from '@/lib/dictionaries';
import { Globe } from 'lucide-react';

const LANGUAGE_MAP: Record<Locale, string> = {
    en: 'English',
    ko: '한국어',
    jp: '日本語',
};

export function LanguageSwitcher() {
    const { locale, setLocale } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                aria-label="Select Language"
            >
                <Globe size={20} />
                <span className="text-sm font-medium hidden sm:inline-block">
                    {LANGUAGE_MAP[locale]}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg py-1 z-50 border border-[var(--color-neutral-200)] animate-fade-in">
                    {(Object.entries(LANGUAGE_MAP) as [Locale, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setLocale(key);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-neutral-100)] transition-colors ${locale === key ? 'text-[var(--color-primary-600)] font-bold bg-[var(--color-primary-50)]' : 'text-[var(--color-neutral-700)]'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
