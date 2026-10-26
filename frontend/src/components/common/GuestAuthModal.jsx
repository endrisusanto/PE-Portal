import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogIn, Eye, ArrowRight, X } from 'lucide-react';
import styles from './GuestAuthModal.module.css';

export const GuestAuthModal = ({
  isOpen,
  onClose,
  actionName = '',
}) => {
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
          aria-label="Tutup"
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
            <span>Mode Tamu (View Only)</span>
          </div>

          <h2 id="guest-modal-title" className={styles.title}>
            Wajib Login dengan ADCorp
          </h2>

          <p className={styles.description}>
            Anda saat ini mengakses <strong>PE-Portal</strong> dengan akses <strong>Guest (Hanya Lihat)</strong>.
            Untuk melakukan aksi penambahan, perubahan, atau penghapusan data
            {actionName ? (
              <span className={styles.actionHighlight}> ({actionName})</span>
            ) : (
              ' (Write / Update)'
            )}
            , Anda diwajibkan login menggunakan akun <strong>ADCorp SEIN</strong>.
          </p>

          <div className={styles.featureBox}>
            <div className={styles.featureRow}>
              <span className={styles.featureLabel}>Status Sesi</span>
              <span className={styles.featureValueGuest}>Guest (View Only)</span>
            </div>
            <div className={styles.featureRow}>
              <span className={styles.featureLabel}>Otentikasi</span>
              <span className={styles.featureValueAuth}>ADCorp LDAP / SSO</span>
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
            <span>Login dengan ADCorp</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            Tetap Sebagai Guest (Hanya Lihat)
          </button>
        </div>
      </div>
    </div>
  );
};
