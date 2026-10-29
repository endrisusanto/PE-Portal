import React from 'react';
import styles from './AiThinkingProgress.module.css';

/**
 * AiThinkingProgress - Ponytail style
 * Lightweight, zero-dependency circular progress indicator with animated shimmer label text.
 */
export const AiThinkingProgress = ({ text, subtext, className = '' }) => {
  return (
    <div className={`${styles.container} ${className}`}>
      <svg
        className={styles.circleProgress}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className={styles.circleTrack} cx="12" cy="12" r="9.5" />
        <circle className={styles.circleIndicator} cx="12" cy="12" r="9.5" />
      </svg>
      <span className={styles.shimmerText}>{text}</span>
      {subtext && <span className={styles.subtext}>({subtext})</span>}
      <span className={styles.pulseDot} />
    </div>
  );
};

export default AiThinkingProgress;
