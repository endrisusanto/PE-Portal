import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export const ErrorState = ({
  message = 'An error occurred while loading information.',
  onRetry,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      gap: '12px',
      textAlign: 'center',
      backgroundColor: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-error-subtle)',
      borderRadius: 'var(--radius-md)',
      margin: '16px 0',
    }}>
      <AlertCircle size={32} color="var(--color-error)" />
      <div style={{
        color: 'var(--color-text-primary)',
        fontWeight: 600,
        fontSize: 'var(--font-size-base)',
      }}>
        Operation Failed
      </div>
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        maxWidth: '400px',
      }}>
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm" style={{ marginTop: '8px' }}>
          Retry Request
        </Button>
      )}
    </div>
  );
};
