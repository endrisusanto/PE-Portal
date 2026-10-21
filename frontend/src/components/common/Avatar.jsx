import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';

export const Avatar = ({ name = '', src = null, size = 'md' }) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`${styles.avatar} ${styles[size]}`} title={name}>
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          className={styles.image}
          onError={() => setImageError(true)}
        />
      ) : (
        <span className={styles.initials}>{getInitials(name)}</span>
      )}
    </div>
  );
};
