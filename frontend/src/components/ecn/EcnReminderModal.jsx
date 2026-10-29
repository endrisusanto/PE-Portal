import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Clock,
  Send,
  Check,
  AlertCircle,
  Calendar,
  Mail,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { EmailChipInput } from '../common/EmailChipInput';
import api from '../../api/client';
import styles from './EcnReminderModal.module.css';

const parseSendTimes = (str) => {
  if (!str) return ['08:00'];
  const matches = str.match(/\b\d{1,2}:\d{2}\b/g);
  if (!matches || matches.length === 0) return ['08:00'];
  const normalized = matches.map((m) => {
    const [h, min] = m.split(':');
    return `${h.padStart(2, '0')}:${min}`;
  });
  return Array.from(new Set(normalized)).sort();
};

export const EcnReminderModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const timePresets = useMemo(() => [
    { time: '07:00', label: t('ecn.reminder.preset_shift1', 'Shift 1') },
    { time: '08:00', label: t('ecn.reminder.preset_morning', 'Pagi') },
    { time: '13:00', label: t('ecn.reminder.preset_afternoon', 'Siang') },
    { time: '16:00', label: t('ecn.reminder.preset_shift2', 'Shift 2') },
  ], [t]);

  // Form State
  const [isEnabled, setIsEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState(1);
  const [selectedTimes, setSelectedTimes] = useState(['08:00']);
  const [customTime, setCustomTime] = useState('09:00');
  const [recipients, setRecipients] = useState('');
  const [ccRecipients, setCcRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('[REMINDER] ECN Running BOM Deadline Alert - SEIN PE');
  const [includeOverdue, setIncludeOverdue] = useState(true);

  // Status & Info from Backend
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [dueRecords, setDueRecords] = useState([]);
  const [targetDate, setTargetDate] = useState('');
  const [lastLog, setLastLog] = useState(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Load Settings from Backend
  const fetchSettings = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.get('/ecn/reminder/settings');
      const data = res.data || {};
      const s = data.settings || {};

      setIsEnabled(Boolean(s.is_enabled));
      setDaysBefore(s.days_before || 1);
      setSelectedTimes(parseSendTimes(s.send_time));
      setRecipients(s.recipients || '');
      setCcRecipients(s.cc_recipients || '');
      setEmailSubject(s.email_subject || '[REMINDER] ECN Running BOM Deadline Alert - SEIN PE');
      setIncludeOverdue(s.include_overdue !== false);

      setDueCount(data.due_count || 0);
      setDueRecords(data.due_records || []);
      setTargetDate(data.target_date || '');
      setLastLog(data.last_log || null);
    } catch (err) {
      console.error('Failed to load ECN reminder settings:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || t('ecn.reminder.load_error', 'Gagal memuat konfigurasi pengingat.'),
      });
    } finally {
      setLoading(false);
    }
  }, [isOpen, t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Toggle preset time in selectedTimes
  const handleTogglePresetTime = (timeStr) => {
    setSelectedTimes((prev) => {
      if (prev.includes(timeStr)) {
        const next = prev.filter((t) => t !== timeStr);
        return next.length > 0 ? next : ['08:00'];
      } else {
        return [...prev, timeStr].sort();
      }
    });
  };

  // Add custom time into selectedTimes
  const handleAddCustomTime = () => {
    if (!customTime) return;
    const [h, m] = customTime.split(':');
    const formatted = `${h.padStart(2, '0')}:${m}`;
    setSelectedTimes((prev) => {
      if (prev.includes(formatted)) return prev;
      return [...prev, formatted].sort();
    });
  };

  // Remove specific time from selectedTimes
  const handleRemoveTime = (timeStr) => {
    setSelectedTimes((prev) => {
      const next = prev.filter((t) => t !== timeStr);
      return next.length > 0 ? next : ['08:00'];
    });
  };

  // Handle Save Settings
  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        is_enabled: isEnabled,
        days_before: Number(daysBefore) || 1,
        send_time: selectedTimes.join(', ') || '08:00',
        recipients,
        cc_recipients: ccRecipients,
        email_subject: emailSubject,
        include_overdue: includeOverdue,
      };

      await api.put('/ecn/reminder/settings', payload);
      setFeedback({
        type: 'success',
        message: t('ecn.reminder.save_success', 'Pengaturan pengingat email Running BOM berhasil disimpan!'),
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to save ECN reminder settings:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || t('ecn.reminder.save_error', 'Gagal menyimpan pengaturan.'),
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Immediate Test Dispatch
  const handleTestSend = async () => {
    if (!recipients.trim()) {
      setFeedback({
        type: 'error',
        message: t('ecn.reminder.require_recipient', 'Harap isi minimal 1 email penerima sebelum mengirim tes!'),
      });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      // First save current draft settings so test uses latest inputs
      await api.put('/ecn/reminder/settings', {
        is_enabled: isEnabled,
        days_before: Number(daysBefore) || 1,
        send_time: selectedTimes.join(', ') || '08:00',
        recipients,
        cc_recipients: ccRecipients,
        email_subject: emailSubject,
        include_overdue: includeOverdue,
      });

      const res = await api.post('/ecn/reminder/test');
      setFeedback({
        type: 'success',
        message: res.data?.message || t('ecn.reminder.test_success', 'Email tes pengingat berhasil dikirim!'),
      });
      // Re-fetch to update lastLog
      fetchSettings();
    } catch (err) {
      console.error('Failed to trigger test email:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || t('ecn.reminder.test_error', 'Gagal mengirim email tes.'),
      });
    } finally {
      setTesting(false);
    }
  };

  const modalFooter = (
    <div className={styles.footerActions}>
      <Button
        variant="secondary"
        size="md"
        icon={Send}
        onClick={handleTestSend}
        loading={testing}
        disabled={saving || loading}
        title={t('ecn.reminder.test_send_title', 'Kirim email uji coba saat ini juga ke daftar penerima')}
      >
        {t('ecn.reminder.test_send_btn', 'Kirim Tes Email Sekarang')}
      </Button>

      <div className={styles.footerRight}>
        <Button variant="ghost" size="md" onClick={onClose} disabled={saving || testing}>
          {t('common.cancel', 'Batal')}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={Check}
          onClick={handleSave}
          loading={saving}
          disabled={testing || loading}
        >
          {t('common.save', 'Simpan Pengaturan')}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} style={{ color: 'var(--color-accent, #0d7377)' }} />
          <span>{t('ecn.reminder.modal_title', 'Pengaturan Pengingat Running BOM')}</span>
        </div>
      }
      footer={modalFooter}
      maxWidth="min(1080px, 94vw)"
    >
      <div className={styles.container}>
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`${styles.alertBox} ${
              feedback.type === 'success' ? styles.alertSuccess : styles.alertError
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 1. Context Strip (Live Running BOM Status) */}
        <div className={`${styles.statusBar} ${dueCount > 0 ? styles.statusBarWarning : ''}`}>
          <div className={styles.statusLeft}>
            <div className={`${styles.statusIconWrapper} ${dueCount > 0 ? styles.statusIconWarning : ''}`}>
              <Calendar size={15} />
            </div>
            <div className={styles.statusDetails}>
              <div className={styles.statusMainRow}>
                <span className={styles.statusHeading}>
                  {dueCount > 0
                    ? t('ecn.reminder.status_due', '{{count}} Dokumen ECN Jatuh Tempo', { count: dueCount })
                    : t('ecn.reminder.status_none_due', 'Tidak Ada Dokumen ECN Jatuh Tempo')}
                </span>
                <span className={styles.targetDatePill}>
                  {t('ecn.reminder.target_pill', 'Target: {{target}}', { target: targetDate || 'H-1' })}
                </span>
              </div>
              <span className={styles.statusSubText}>
                {dueCount > 0
                  ? t('ecn.reminder.desc_due', 'ECN aktif (Pending / Progress) yang mendekati Running BOM akan dikirim otomatis ke PIC.')
                  : t('ecn.reminder.desc_none_due', 'Semua ECN terpantau aman. Worker akan melewati pengiriman jika tidak ada data jatuh tempo.')}
              </span>

              {/* Inline list of ECN Chips preview */}
              {dueRecords && dueRecords.length > 0 && (
                <div className={styles.dueInlineChips}>
                  {dueRecords.slice(0, 8).map((r) => (
                    <span
                      key={r.id || r.ecn_no}
                      className={styles.dueChipItem}
                      title={`${r.model} - ${r.ec_title}`}
                    >
                      {r.ecn_no} ({r.model || 'Model'})
                    </span>
                  ))}
                  {dueRecords.length > 8 && (
                    <span className={styles.dueChipItem}>+{dueRecords.length - 8} lainnya</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right side audit trail */}
          {lastLog && (
            <div className={styles.statusRightAudit}>
              <span>
                {t('ecn.reminder.audit_label', 'Status Email Terakhir')}:{' '}
                {new Date(lastLog.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </span>
              {lastLog.status === 'SUCCESS' && (
                <span
                  className={`${styles.auditStatusBadge} ${styles.auditSuccess}`}
                  title={t('ecn.reminder.audit_success_tooltip', 'Email pengingat berhasil dikirim ke daftar penerima')}
                >
                  <Check size={11} />
                  <span>{t('ecn.reminder.audit_success', 'Terkirim ({{count}} ECN)', { count: lastLog.item_count })}</span>
                </span>
              )}
              {lastLog.status === 'SKIPPED' && (
                <span
                  className={`${styles.auditStatusBadge} ${styles.auditSkipped}`}
                  title={t('ecn.reminder.audit_skipped_tooltip', 'Pengecekan selesai. Tidak ada ECN jatuh tempo, pengiriman dilewati secara aman.')}
                >
                  <CheckCircle2 size={11} />
                  <span>{t('ecn.reminder.audit_skipped', 'Aman (0 ECN - Dilewati)')}</span>
                </span>
              )}
              {lastLog.status === 'FAILED' && (
                <span
                  className={`${styles.auditStatusBadge} ${styles.auditFailed}`}
                  title={`${t('ecn.reminder.audit_tooltip_prefix', 'Penyebab Gagal:')} ${lastLog.error_message || t('ecn.reminder.smtp_error_tooltip', 'Koneksi ke server gateway SMTP gagal')}`}
                >
                  <AlertCircle size={11} />
                  <span>{t('ecn.reminder.audit_failed_smtp', 'Gagal Kirim (SMTP)')}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. Structured Two-Column Body */}
        <div className={styles.bodyGrid}>
          {/* Column 1: Penjadwalan & Waktu */}
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h5 className={styles.panelTitle}>
                <Clock size={13} />
                <span>{t('ecn.reminder.panel_schedule', 'Jadwal & Waktu Pengecekan')}</span>
              </h5>
            </div>

            {/* Master Switch Row */}
            <div className={styles.masterSwitchRow}>
              <div className={styles.masterSwitchInfo}>
                <div className={styles.masterSwitchTitleRow}>
                  <span className={styles.masterSwitchTitle}>
                    {t('ecn.reminder.worker_toggle', 'Worker Otomatis')}
                  </span>
                  <span
                    className={`${styles.masterStatusPill} ${
                      isEnabled ? styles.masterActive : styles.masterInactive
                    }`}
                  >
                    {isEnabled
                      ? t('ecn.reminder.worker_active', 'Aktif')
                      : t('ecn.reminder.worker_inactive', 'Nonaktif')}
                  </span>
                </div>
                <span className={styles.masterSwitchSub}>
                  {t('ecn.reminder.worker_sub', 'Scheduler Go mengecek target Running BOM setiap hari')}
                </span>
              </div>
              <label className={styles.switch} title="Aktifkan atau nonaktifkan scheduler worker">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <hr className={styles.panelDivider} />

            {/* Multi-Schedule Slot Section */}
            <div className={styles.scheduleSection}>
              <div className={styles.scheduleHeaderRow}>
                <label className={styles.scheduleLabel}>
                  <span>{t('ecn.reminder.send_time_label', 'Jam Pengiriman Harian (WIB)')}</span>
                </label>
                <span className={styles.scheduleCountBadge}>
                  {t('ecn.reminder.times_per_day', '{{count}}x sehari', { count: selectedTimes.length })}
                </span>
              </div>

              {/* Quick Preset Segmented Buttons */}
              <div className={styles.presetsGrid}>
                {timePresets.map((p) => {
                  const isSelected = selectedTimes.includes(p.time);
                  return (
                    <button
                      key={p.time}
                      type="button"
                      className={`${styles.presetChipBtn} ${
                        isSelected ? styles.presetChipActive : ''
                      }`}
                      onClick={() => handleTogglePresetTime(p.time)}
                      title={`Klik untuk ${isSelected ? 'menonaktifkan' : 'mengaktifkan'} jadwal ${p.time}`}
                    >
                      <span className={styles.presetChipTime}>{p.time}</span>
                      <span className={styles.presetChipSub}>{p.label}</span>
                      <span className={styles.presetChipIcon}>
                        {isSelected ? <Check size={12} /> : <Plus size={12} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Time Adder */}
              <div className={styles.customTimeAdderRow}>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  title="Pilih jam kustom"
                />
                <button
                  type="button"
                  className={styles.addScheduleBtn}
                  onClick={handleAddCustomTime}
                  title={t('ecn.reminder.add_custom_title', 'Tambahkan jam kustom ke daftar jadwal aktif')}
                >
                  <Plus size={13} />
                  <span>{t('ecn.reminder.add_schedule_btn', 'Tambah')}</span>
                </button>
              </div>

              {/* Active Slots Bar */}
              <div className={styles.activeSlotsBar}>
                {selectedTimes.map((tVal) => (
                  <span key={tVal} className={styles.activeSlotItem}>
                    <Clock size={11} />
                    <span>{t('ecn.reminder.active_wib', '{{time}} WIB', { time: tVal })}</span>
                    <button
                      type="button"
                      className={styles.slotDeleteBtn}
                      onClick={() => handleRemoveTime(tVal)}
                      title={t('ecn.reminder.remove_time_title', 'Hapus jadwal {{time}}', { time: tVal })}
                      disabled={selectedTimes.length === 1}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <hr className={styles.panelDivider} />

            {/* Lead Time (Days Before) */}
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                <Calendar size={13} />
                <span>{t('ecn.reminder.lead_time_label', 'Ambang Batas Hari Sebelum Deadline (Lead Time)')}</span>
              </label>
              <input
                type="number"
                min="0"
                max="30"
                className={styles.inputField}
                value={daysBefore}
                onChange={(e) => setDaysBefore(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span className={styles.fieldHelper}>
                {t('ecn.reminder.lead_time_helper', 'Contoh: 1 berarti pengingat dikirim 1 hari sebelum Running BOM date (H-1).')}
              </span>
            </div>
          </div>

          {/* Column 2: Notifikasi & Penerima */}
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h5 className={styles.panelTitle}>
                <Mail size={13} />
                <span>{t('ecn.reminder.panel_email', 'Notifikasi & Penerima Email')}</span>
              </h5>
            </div>

            {/* Email Subject */}
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                <Mail size={13} />
                <span>{t('ecn.reminder.subject_label', 'Subjek Email Pengingat')}</span>
              </label>
              <input
                type="text"
                className={styles.inputField}
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={t('ecn.reminder.subject_placeholder', '[REMINDER] ECN Running BOM Deadline Alert - SEIN PE')}
              />
            </div>

            {/* Recipients (To) */}
            <div className={styles.formGroup}>
              <EmailChipInput
                label={t('ecn.reminder.recipients_label', 'Daftar Email Penerima (To) - Wajib')}
                value={recipients}
                onChange={setRecipients}
                placeholder={t('ecn.reminder.recipients_placeholder', 'Ketik email (misal endri.s@samsung.com) lalu tekan Enter...')}
                required
              />
              <span className={styles.fieldHelper}>
                {t('ecn.reminder.recipients_helper', 'Tekan Enter atau koma untuk menambah chip email.')}
              </span>
            </div>

            {/* CC Recipients */}
            <div className={styles.formGroup}>
              <EmailChipInput
                label={t('ecn.reminder.cc_label', 'Daftar Email Tembusan (CC) - Opsional')}
                value={ccRecipients}
                onChange={setCcRecipients}
                placeholder={t('ecn.reminder.cc_placeholder', 'Ketik email tembusan (CC) lalu tekan Enter...')}
              />
            </div>

            <hr className={styles.panelDivider} />

            {/* Include Overdue Option */}
            <label className={styles.checkboxContainer}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={includeOverdue}
                onChange={(e) => setIncludeOverdue(e.target.checked)}
              />
              <div className={styles.checkboxTextCol}>
                <span className={styles.checkboxTitle}>
                  {t('ecn.reminder.overdue_title', 'Sertakan ECN Overdue')}
                </span>
                <span className={styles.checkboxDesc}>
                  {t('ecn.reminder.overdue_desc', 'Tetap kirimkan dokumen ECN jika tanggal Running BOM telah lewat hari ini namun status belum Completed / ECO Cancel.')}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
