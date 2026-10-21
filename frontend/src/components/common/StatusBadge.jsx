import React from 'react';
import styles from './StatusBadge.module.css';

export const StatusBadge = ({ status, label }) => {
  if (!status) return null;

  const normalized = String(status).toLowerCase().replace(/[\s-]/g, '_');
  const displayLabel = label || status.replace(/_/g, ' ');

  return (
    <span className={`${styles.badge} ${styles[normalized] || styles.default}`}>
      <span className={styles.dot} />
      {displayLabel}
    </span>
  );
};
