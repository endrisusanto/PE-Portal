import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './LanguageSwitcher.module.css';

// ponytail: Compact segmented switch button replacing select dropdown (0 bloat, 1-click instant language switch)
const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'id', label: 'Bahasa Indonesia', short: 'ID' },
  { code: 'ko', label: '한국어', short: 'KO' },
];

export const LanguageSwitcher = () => {
  const { currentLang, changeLanguage } = useLanguage();

  return (
    <div className={styles.container} role="group" aria-label="Select display language">
      <Globe size={13} className={styles.globe} />
      <div className={styles.switchGroup}>
        {LANGUAGES.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLanguage(lang.code)}
              className={`${styles.switchBtn} ${isActive ? styles.switchBtnActive : ''}`}
              aria-pressed={isActive}
              title={lang.label}
            >
              {lang.short}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
