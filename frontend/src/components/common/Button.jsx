import React from 'react';
import styles from './Button.module.css';

export const Button = ({
  children,
  variant = 'primary', // primary, secondary, outline, danger, ghost
  size = 'md',        // sm, md, lg
  disabled = false,
  loading = false,
  type = 'button',
  icon: Icon,
  onClick,
  className = '',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : Icon ? (
        <Icon className={styles.icon} size={size === 'sm' ? 14 : 16} />
      ) : null}
      <span>{children}</span>
    </button>
  );
};
