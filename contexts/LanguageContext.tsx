'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries, Locale, DictionaryKey } from '../lib/dictionaries';

type LanguageContextType = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: DictionaryKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');

    useEffect(() => {
        // Check local storage for saved language
        const savedLocale = localStorage.getItem('app-locale') as Locale;
        if (savedLocale && dictionaries[savedLocale]) {
            setLocaleState(savedLocale);
        } else {
            // Otherwise use browser language
            const browserLang = navigator.language.split('-')[0];
            if (dictionaries[browserLang as Locale]) {
                setLocaleState(browserLang as Locale);
            }
        }
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('app-locale', newLocale);
    };

    const t = (key: DictionaryKey): string => {
        return dictionaries[locale][key] || dictionaries['en'][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
