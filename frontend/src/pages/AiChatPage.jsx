import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiChatWindow } from '../components/chat/AiChatWindow';

export const AiChatPage = () => {
  const [searchParams] = useSearchParams();
  const isStandalone = searchParams.get('standalone') === '1';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-primary)',
        overflow: 'hidden',
      }}
    >
      <AiChatWindow isDrawer={false} />
    </div>
  );
};
