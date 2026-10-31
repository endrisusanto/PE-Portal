import React from 'react';
import styles from './AiThinkingProgress.module.css';

/**
 * AiThinkingProgress - Emil Kowalski & Ponytail style
 * Zero-dependency, fluid, responsive thinking indicator with smooth pulse & shimmer.
 */
export const AiThinkingProgress = ({ text, subtext, className = '' }) => {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.mainInfo}>
        <svg
          className={styles.circleProgress}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className={styles.circleTrack} cx="12" cy="12" r="9.5" />
          <circle className={styles.circleIndicator} cx="12" cy="12" r="9.5" />
        </svg>
        <span className={styles.shimmerText}>{text}</span>
      </div>
      {subtext && (
        <div className={styles.subtextWrapper} title={subtext}>
          <span className={styles.subtext}>
            {typeof subtext === 'string' && subtext.includes('/') ? subtext.split('/').pop() : subtext}
          </span>
          <span className={styles.pulseDot} />
        </div>
      )}
    </div>
  );
};

export default AiThinkingProgress;
