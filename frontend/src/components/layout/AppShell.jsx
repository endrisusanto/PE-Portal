import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AiChatWindow } from '../chat/AiChatWindow';
import styles from './AppShell.module.css';

export const AppShell = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      <div className={styles.mainContainer}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {/* Floating AI Engineering Assistant */}
      {isChatOpen && (
        <AiChatWindow isDrawer={true} onClose={() => setIsChatOpen(false)} />
      )}
    </div>
  );
};
