import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Trash2 } from 'lucide-react';
import styles from '../components/common/ConfirmModal.module.css';

const ConfirmContext = createContext(null);

let globalConfirmHandler = null;
let globalAlertHandler = null;

/**
 * Standalone bridge for use outside of React component render trees or in standard async functions.
 * @param {string|object} options
 * @returns {Promise<boolean>}
 */
export const portalConfirm = (options) => {
  if (globalConfirmHandler) {
    return globalConfirmHandler(options);
  }
  const msg = typeof options === 'string' ? options : (options.message || options.title || 'Konfirmasi?');
  return Promise.resolve(window.confirm(msg));
};

/**
 * Standalone bridge for replacement of native alert()
 * @param {string|object} options
 * @returns {Promise<void>}
 */
export const portalAlert = (options) => {
  if (globalAlertHandler) {
    return globalAlertHandler(options);
  }
  const msg = typeof options === 'string' ? options : (options.message || options.title || '');
  window.alert(msg);
  return Promise.resolve();
};

export const ConfirmProvider = ({ children }) => {
  const [modalState, setModalState] = useState(null);
  const resolveRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;

      let config = {
        title: 'Konfirmasi Tindakan',
        message: '',
        confirmText: 'Lanjutkan',
        cancelText: 'Batal',
        variant: 'danger', // default to danger since most confirms are deletions
        highlight: '',
        isAlert: false,
      };

      if (typeof options === 'string') {
        config.message = options;
        const lower = options.toLowerCase();
        if (lower.includes('hapus') || lower.includes('delete') || lower.includes('remove') || lower.includes('revoke')) {
          config.title = 'Konfirmasi Hapus';
          config.confirmText = 'Hapus';
          config.variant = 'danger';
        } else if (lower.includes('reset') || lower.includes('revert') || lower.includes('nonaktifkan')) {
          config.title = 'Konfirmasi Perubahan';
          config.confirmText = 'Ya, Lanjutkan';
          config.variant = 'warning';
        } else {
          config.title = 'Konfirmasi';
          config.confirmText = 'Ya';
          config.variant = 'info';
        }
      } else if (typeof options === 'object' && options !== null) {
        config = { ...config, ...options };
      }

      setModalState(config);
    });
  }, []);

  const alertModal = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve();

      let config = {
        title: 'Pemberitahuan',
        message: '',
        confirmText: 'Mengerti',
        variant: 'info',
        isAlert: true,
      };

      if (typeof options === 'string') {
        config.message = options;
        const lower = options.toLowerCase();
        if (lower.includes('gagal') || lower.includes('failed') || lower.includes('error')) {
          config.title = 'Terjadi Kesalahan';
          config.variant = 'danger';
        } else if (lower.includes('berhasil') || lower.includes('success')) {
          config.title = 'Berhasil';
          config.variant = 'success';
        } else if (lower.includes('peringatan') || lower.includes('warning') || lower.includes('pilih') || lower.includes('wajib')) {
          config.title = 'Perhatian';
          config.variant = 'warning';
        }
      } else if (typeof options === 'object' && options !== null) {
        config = { ...config, ...options, isAlert: true };
      }

      setModalState(config);
    });
  }, []);

  useEffect(() => {
    globalConfirmHandler = confirm;
    globalAlertHandler = alertModal;
    return () => {
      globalConfirmHandler = null;
      globalAlertHandler = null;
    };
  }, [confirm, alertModal]);

  const handleConfirm = useCallback(() => {
    const resolve = resolveRef.current;
    setModalState(null);
    resolveRef.current = null;
    if (resolve) resolve(true);
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolveRef.current;
    setModalState(null);
    resolveRef.current = null;
    if (resolve) resolve(false);
  }, []);

  // Keyboard navigation (Esc cancels, Enter confirms)
  useEffect(() => {
    if (!modalState) return;

    // Focus confirm button when modal opens
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // If not focusing on cancel button
        if (document.activeElement?.getAttribute('data-action') !== 'cancel') {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalState, handleCancel, handleConfirm]);

  const getVariantClass = (variant) => {
    switch (variant) {
      case 'danger': return styles.variantDanger;
      case 'warning': return styles.variantWarning;
      case 'success': return styles.variantSuccess;
      default: return styles.variantInfo;
    }
  };

  const renderIcon = (variant) => {
    switch (variant) {
      case 'danger':
        return <Trash2 size={22} />;
      case 'warning':
        return <AlertTriangle size={22} />;
      case 'success':
        return <CheckCircle2 size={22} />;
      default:
        return <Info size={22} />;
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert: alertModal }}>
      {children}
      {modalState && (
        <div
          className={styles.overlay}
          onClick={handleCancel}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`${styles.modal} ${getVariantClass(modalState.variant)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.accentBar} />
            <div className={styles.body}>
              <div className={styles.headerRow}>
                <div className={styles.iconCircle}>
                  {renderIcon(modalState.variant)}
                </div>
                <div className={styles.titleArea}>
                  <h3 className={styles.title}>{modalState.title}</h3>
                  <p className={styles.message}>{modalState.message}</p>
                </div>
              </div>

              {modalState.highlight && (
                <div className={styles.highlightBox}>
                  {modalState.highlight}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              {!modalState.isAlert && (
                <button
                  type="button"
                  data-action="cancel"
                  className={styles.btnCancel}
                  onClick={handleCancel}
                >
                  {modalState.cancelText || 'Batal'}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                data-action="confirm"
                className={styles.btnConfirm}
                onClick={handleConfirm}
              >
                {modalState.confirmText || 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return {
      confirm: portalConfirm,
      alert: portalAlert,
    };
  }
  return ctx;
};
