import React, { useState, useRef } from 'react';
import { Mail, X } from 'lucide-react';
import styles from './EmailChipInput.module.css';

export const EmailChipInput = ({
  label,
  value = '',
  onChange,
  placeholder = 'Add email and press Enter or comma...',
  required = false,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Parse comma-separated string to clean array
  const emails = typeof value === 'string'
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(value) ? value : [];

  const updateEmails = (newList) => {
    // Return as comma-separated string
    onChange(newList.join(', '));
  };

  const addEmail = (raw) => {
    const trimmed = raw.trim().replace(/^,+|,+$/g, '');
    if (!trimmed) return;

    // Support comma or whitespace separated bulk paste
    const parts = trimmed.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const updated = [...emails];

    parts.forEach((p) => {
      if (p && !updated.includes(p)) {
        updated.push(p);
      }
    });

    updateEmails(updated);
    setInputValue('');
  };

  const removeEmail = (indexToRemove, e) => {
    if (e) e.stopPropagation();
    const updated = emails.filter((_, idx) => idx !== indexToRemove);
    updateEmails(updated);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      // Remove last chip when deleting on empty input
      removeEmail(emails.length - 1);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      addEmail(pasted);
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {label && (
        <label className={styles.label}>
          <span>{label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}</span>
          {emails.length > 0 && (
            <span className={styles.countBadge}>
              {emails.length} recipient{emails.length > 1 ? 's' : ''}
            </span>
          )}
        </label>
      )}

      <div
        className={`${styles.chipBox} ${isFocused ? styles.chipBoxFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, index) => (
          <span key={`${email}-${index}`} className={styles.chip}>
            <Mail size={12} className={styles.chipIcon} />
            <span className={styles.chipText}>{email}</span>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={(e) => removeEmail(index, e)}
              title={`Remove ${email}`}
              aria-label={`Remove ${email}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? placeholder : 'Add more...'}
          className={styles.input}
        />
      </div>
    </div>
  );
};
