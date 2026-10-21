import React from 'react';

export const LoadingState = ({ message = 'Loading data...' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 16px',
      gap: '12px',
      color: 'var(--color-text-secondary)',
      fontSize: 'var(--font-size-sm)',
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span>{message}</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
