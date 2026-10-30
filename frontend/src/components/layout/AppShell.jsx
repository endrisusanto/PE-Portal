import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AiChatWindow } from '../chat/AiChatWindow';
import styles from './AppShell.module.css';

export const AppShell = () => {
  const { t } = useTranslation();
  const { isGuest, showGuestModal } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleBodyInteractionAttempt = (e) => {
    if (!isGuest) return;
    e.preventDefault();
    e.stopPropagation();
    showGuestModal(t('auth.page_content_access', 'Akses Konten Halaman'));
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleChat={() => {
          if (isGuest) {
            showGuestModal('AI Assistant');
            return;
          }
          setIsChatOpen((prev) => !prev);
        }}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      <div className={styles.mainContainer}>
        <TopBar />
        <main
          className={`${styles.content} ${isGuest ? styles.contentRestricted : ''}`}
          onClickCapture={isGuest ? handleBodyInteractionAttempt : undefined}
        >
          <div
            className={isGuest ? styles.bodyContentDisabled : undefined}
            inert={isGuest ? '' : undefined}
          >
            <Outlet />
          </div>

          {isGuest && (
            <div
              className={styles.guestGuardOverlay}
              onClick={handleBodyInteractionAttempt}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleBodyInteractionAttempt(e);
                }
              }}
              title={t('auth.guest_banner_tooltip', 'Akses konten terkunci untuk Guest. Klik untuk Login ADCorp.')}
            >
              <div className={styles.guestFloatingBanner}>
                <div className={styles.guestBannerIcon}>
                  <Lock size={15} />
                </div>
                <div className={styles.guestBannerText}>
                  <strong>{t('auth.guest_banner_title', 'Akses Konten Terkunci:')}</strong>{' '}
                  {t('auth.guest_banner_desc', 'Mode Tamu dapat mengakses menu sidebar & navbar atas (View Only). Silakan login dengan akun ADCorp SEIN untuk berinteraksi dengan konten.')}
                </div>
                <button
                  type="button"
                  className={styles.guestBannerBtn}
                  onClick={handleBodyInteractionAttempt}
                >
                  <LogIn size={13} />
                  <span>{t('auth.login_with_adcorp', 'Login ADCorp')}</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating AI Engineering Assistant */}
      {isChatOpen && (
        <AiChatWindow isDrawer={true} onClose={() => setIsChatOpen(false)} />
      )}
    </div>
  );
};

