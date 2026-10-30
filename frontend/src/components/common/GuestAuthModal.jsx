import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, LogIn, Eye, ArrowRight, X } from 'lucide-react';
import styles from './GuestAuthModal.module.css';

export const GuestAuthModal = ({
  isOpen,
  onClose,
  actionName = '',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  const handleLoginClick = () => {
    onClose();
    // Redirect to login page while saving current page to return after login
    navigate('/login', { state: { from: location } });
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-modal-title"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label={t('auth.close', 'Tutup')}
        >
          <X size={18} />
        </button>

        <div className={styles.iconWrapper}>
          <div className={styles.iconPulse} />
          <ShieldAlert className={styles.shieldIcon} size={36} />
        </div>

        <div className={styles.content}>
          <div className={styles.badge}>
            <Eye size={13} />
            <span>{t('auth.guest_badge', 'Mode Tamu (Sidebar Only)')}</span>
          </div>

          <h2 id="guest-modal-title" className={styles.title}>
            {t('auth.guest_required_title', 'Wajib Login dengan Akun ADCorp')}
          </h2>

          <p className={styles.description}>
            {t('auth.guest_required_intro', 'Akun Guest (Tamu) hanya diizinkan untuk melihat menu pada Sidebar.')}{' '}
            {t('auth.guest_required_action', 'Untuk mengakses, melihat detail penuh, atau berinteraksi dengan konten portal')}
            {actionName ? (
              <span className={styles.actionHighlight}> ({actionName})</span>
            ) : (
              ''
            )}
            {t('auth.guest_required_outro', ', Anda diwajibkan login menggunakan akun ADCorp SEIN.')}
          </p>

          <div className={styles.featureBox}>
            <div className={styles.featureRow}>
              <span className={styles.featureLabel}>{t('auth.current_access', 'Akses Saat Ini')}</span>
              <span className={styles.featureValueGuest}>{t('auth.guest_access_val', 'Guest (Sidebar Only)')}</span>
            </div>
            <div className={styles.featureRow}>
              <span className={styles.featureLabel}>{t('auth.auth_required', 'Otentikasi Diperlukan')}</span>
              <span className={styles.featureValueAuth}>{t('auth.adcorp_auth_val', 'ADCorp LDAP / SSO')}</span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleLoginClick}
            autoFocus
          >
            <LogIn size={16} />
            <span>{t('auth.login_with_adcorp', 'Login dengan ADCorp')}</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            {t('auth.stay_as_guest', 'Tetap Sebagai Guest (Hanya Lihat Menu)')}
          </button>
        </div>
      </div>
    </div>
  );
};
