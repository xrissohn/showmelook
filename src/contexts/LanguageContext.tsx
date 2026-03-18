import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ko } from '@/lib/translations/ko';
import { en } from '@/lib/translations/en';
import type { TranslationKeys } from '@/lib/translations';

type Language = 'ko' | 'en';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const dictionaries: Record<Language, TranslationKeys> = { ko, en };

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('lang') as Language) || 'ko'
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next = prev === 'ko' ? 'en' : 'ko';
      localStorage.setItem('lang', next);
      return next;
    });
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: any = dictionaries[language];
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback to Korean
        let fallback: any = dictionaries['ko'];
        for (const fk of keys) fallback = fallback?.[fk];
        return fallback ?? key;
      }
    }
    return value ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
