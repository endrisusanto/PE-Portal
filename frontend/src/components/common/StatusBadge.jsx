import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StatusBadge.module.css';

export const StatusBadge = ({ status, label }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const normalized = String(status).toLowerCase().replace(/[\s-]/g, '_');
  const labelKey = label ? String(label).toLowerCase().replace(/[\s-]/g, '_') : null;
  const displayLabel = label
    ? t(`status.${labelKey}`, label)
    : t(`status.${normalized}`, status.replace(/_/g, ' '));

  return (
    <span className={`${styles.badge} ${styles[normalized] || styles.default}`}>
      <span className={styles.dot} />
      {displayLabel}
    </span>
  );
};
