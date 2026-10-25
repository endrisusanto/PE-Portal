import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Trash2, Calendar, CheckCircle2, AlertCircle, Info, Tag } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import {
  getCustomHolidaysList,
  saveCustomHoliday,
  deleteCustomHoliday,
} from '../../utils/indonesianHolidays';
import styles from './CustomHolidayModal.module.css';

export const CustomHolidayModal = ({ isOpen, onClose, initialDate }) => {
  const { t } = useTranslation();
  const [customList, setCustomList] = useState([]);
  const [dateStr, setDateStr] = useState('');
  const [name, setName] = useState('');
  const [isCutiBersama, setIsCutiBersama] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Refresh custom holidays list
  const refreshList = () => {
    setCustomList(getCustomHolidaysList());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      const today = new Date();
      const defaultDate = initialDate
        ? initialDate
        : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setDateStr(defaultDate);
      setName('');
      setIsCutiBersama(false);
      setFeedback({ type: '', message: '' });
    }
  }, [isOpen, initialDate]);

  // Listen to customHolidaysChanged
  useEffect(() => {
    const handleSync = () => refreshList();
    window.addEventListener('customHolidaysChanged', handleSync);
    return () => window.removeEventListener('customHolidaysChanged', handleSync);
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!dateStr) {
      setFeedback({ type: 'error', message: t('custom_holiday.error_no_date', 'Harap pilih tanggal libur.') });
      return;
    }
    if (!name.trim()) {
      setFeedback({ type: 'error', message: t('custom_holiday.error_no_name', 'Harap masukkan nama atau keterangan hari libur.') });
      return;
    }

    const success = saveCustomHoliday(dateStr, name, isCutiBersama);
    if (success) {
      setFeedback({
        type: 'success',
        message: t('custom_holiday.success_save', { name: name.trim(), defaultValue: `Hari libur "${name.trim()}" berhasil disimpan!` })
      });
      setName('');
      setIsCutiBersama(false);
      refreshList();
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    } else {
      setFeedback({ type: 'error', message: t('common.error', 'Gagal menyimpan hari libur custom.') });
    }
  };

  const handleDelete = (targetDate) => {
    const success = deleteCustomHoliday(targetDate);
    if (success) {
      refreshList();
      setFeedback({
        type: 'success',
        message: t('custom_holiday.success_delete', { date: targetDate, defaultValue: `Tanggal libur ${targetDate} berhasil dihapus.` })
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 2500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('custom_holiday.modal_title', 'Kelola & Tambah Tanggal Libur')}
      maxWidth="620px"
    >
      <div className={styles.modalBody}>
        {/* Information Banner */}
        <div className={styles.infoBanner}>
          <Info size={16} className={styles.infoIcon} />
          <span>
            {t('custom_holiday.banner_info', 'Tanggal libur akan otomatis muncul bertanda merah pada Kalender Kerja Bulanan di Dashboard dan Project Calendar.')}
          </span>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`${styles.feedbackBox} ${feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Form Tambah Hari Libur */}
        <form onSubmit={handleAdd} className={styles.addForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="custom-holiday-date" className={styles.formLabel}>
                <Calendar size={13} />
                <span>{t('custom_holiday.field_date', 'Tanggal Libur')}:</span>
              </label>
              <input
                id="custom-holiday-date"
                type="date"
                className={styles.inputDate}
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroupWide}>
              <label htmlFor="custom-holiday-name" className={styles.formLabel}>
                <Tag size={13} />
                <span>{t('custom_holiday.field_name', 'Keterangan / Nama Libur')}:</span>
              </label>
              <input
                id="custom-holiday-name"
                type="text"
                placeholder={t('custom_holiday.field_name', 'Nama libur atau kegiatan...')}
                className={styles.inputText}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.formActionsRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isCutiBersama}
                onChange={(e) => setIsCutiBersama(e.target.checked)}
                className={styles.checkboxInput}
              />
              <span>{t('custom_holiday.field_cuti_bersama', 'Tandai sebagai Cuti Bersama')}</span>
            </label>

            <button type="submit" className={styles.submitBtn}>
              <CalendarPlus size={15} />
              <span>{t('custom_holiday.btn_save', 'Simpan Tanggal Libur')}</span>
            </button>
          </div>
        </form>

        {/* Daftar Tanggal Libur Custom Tersimpan */}
        <div className={styles.listSection}>
          <div className={styles.listHeader}>
            <h4 className={styles.listTitle}>
              {t('custom_holiday.saved_list_title', 'Daftar Hari Libur Tersimpan')} ({customList.length})
            </h4>
          </div>

          {customList.length === 0 ? (
            <div className={styles.emptyList}>
              {t('custom_holiday.empty', 'Belum ada tanggal libur custom yang ditambahkan.')}
            </div>
          ) : (
            <div className={styles.customGrid}>
              {customList.map((item) => (
                <div key={item.dateStr} className={styles.customItem}>
                  <div className={styles.customItemLeft}>
                    <div className={styles.customDateBadge}>{item.dateStr}</div>
                    <div className={styles.customDetails}>
                      <span className={styles.customName}>{item.name}</span>
                      <span className={item.isCutiBersama ? styles.badgeCuti : styles.badgeLibur}>
                        {item.isCutiBersama
                          ? t('custom_holiday.badge_cuti_bersama', 'Cuti Bersama')
                          : t('custom_holiday.badge_national', 'Libur')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item.dateStr)}
                    title={`${t('common.delete', 'Hapus')} ${item.dateStr}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} style={{ fontSize: '12px' }}>
            {t('common.close', 'Tutup')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomHolidayModal;
