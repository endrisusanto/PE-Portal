import React, { forwardRef } from 'react';
import styles from './Input.module.css';

export const Input = forwardRef(({
  label,
  error,
  hint,
  id,
  type = 'text',
  className = '',
  required = false,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`${styles.input} ${error ? styles.hasError : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className={styles.errorText}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className={styles.hintText}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
