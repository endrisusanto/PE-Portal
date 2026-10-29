import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Clock,
  Send,
  Check,
  AlertCircle,
  Calendar,
  Sparkles,
  RefreshCw,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { EmailChipInput } from '../common/EmailChipInput';
import api from '../../api/client';
import styles from './EcnReminderModal.module.css';

const TIME_PRESETS = [
  { label: '07:00 (Awal Shift 1)', time: '07:00' },
  { label: '08:00 (Pagi Masuk Kerja)', time: '08:00' },
  { label: '13:00 (Setelah Ishoma)', time: '13:00' },
  { label: '16:00 (Awal Shift 2)', time: '16:00' },
];

export const EcnReminderModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Form State
  const [isEnabled, setIsEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState(1);
  const [sendTime, setSendTime] = useState('08:00');
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
      setSendTime(s.send_time || '08:00');
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
        message: err.response?.data?.message || 'Gagal memuat konfigurasi pengingat.',
      });
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Save Settings
  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        is_enabled: isEnabled,
        days_before: Number(daysBefore) || 1,
        send_time: sendTime || '08:00',
        recipients,
        cc_recipients: ccRecipients,
        email_subject: emailSubject,
        include_overdue: includeOverdue,
      };

      await api.put('/ecn/reminder/settings', payload);
      setFeedback({
        type: 'success',
        message: 'Pengaturan pengingat email Running BOM berhasil disimpan!',
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to save ECN reminder settings:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Gagal menyimpan pengaturan.',
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
        message: 'Harap isi minimal 1 email penerima sebelum mengirim tes!',
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
        send_time: sendTime || '08:00',
        recipients,
        cc_recipients: ccRecipients,
        email_subject: emailSubject,
        include_overdue: includeOverdue,
      });

      const res = await api.post('/ecn/reminder/test');
      setFeedback({
        type: 'success',
        message: res.data?.message || 'Email tes pengingat berhasil dikirim!',
      });
      // Re-fetch to update lastLog
      fetchSettings();
    } catch (err) {
      console.error('Failed to trigger test email:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Gagal mengirim email tes.',
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
        title="Kirim email uji coba saat ini juga ke daftar penerima"
      >
        Kirim Tes Email Sekarang
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
          <span>Pengaturan Pengingat Running BOM (Email Reminder Worker)</span>
        </div>
      }
      footer={modalFooter}
      maxWidth="780px"
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

        {/* Live Running BOM Status Card */}
        <div className={`${styles.statusCard} ${dueCount > 0 ? styles.statusCardWarning : ''}`}>
          <div className={styles.statusIconBadge}>
            <Calendar size={18} />
          </div>
          <div className={styles.statusContent}>
            <div className={styles.statusTitleRow}>
              <h4 className={styles.statusTitle}>
                {dueCount > 0
                  ? `⚡ Terdeteksi ${dueCount} Dokumen ECN Jatuh Tempo`
                  : '✓ Tidak Ada Dokumen ECN Jatuh Tempo'}
              </h4>
              <span className={styles.statusBadge}>Target: {targetDate || 'H-1'}</span>
            </div>
            <p className={styles.statusDesc}>
              {dueCount > 0
                ? `Terdapat ${dueCount} ECN aktif (Pending/In Progress) yang jatuh tempo Running BOM untuk target ${targetDate}. Seluruhnya akan dikirimkan otomatis ke PIC.`
                : `Tidak ada ECN berstatus Pending yang jatuh tempo pada target tanggal ${targetDate}. Worker akan melewati pengiriman email kosong.`}
            </p>

            {/* List of ECN Chips preview */}
            {dueRecords && dueRecords.length > 0 && (
              <div className={styles.dueChipList}>
                {dueRecords.slice(0, 8).map((r) => (
                  <span key={r.id || r.ecn_no} className={styles.dueChip} title={`${r.model} - ${r.ec_title}`}>
                    {r.ecn_no} ({r.model || 'Model'})
                  </span>
                ))}
                {dueRecords.length > 8 && (
                  <span className={styles.dueChip}>+{dueRecords.length - 8} lainnya</span>
                )}
              </div>
            )}

            {lastLog && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Terakhir dikirim: {new Date(lastLog.sent_at).toLocaleString('id-ID')} ({lastLog.item_count} ECN) • Status:{' '}
                <strong style={{ color: lastLog.status === 'SUCCESS' ? '#10b981' : '#ef4444' }}>
                  {lastLog.status}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Worker Active */}
        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>Aktifkan Pengingat Otomatis Harian</span>
            <span className={styles.toggleSub}>
              Worker Go akan memantau waktu harian dan mengirim email alert secara otomatis
            </span>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        {/* Form Inputs Grid */}
        <div className={styles.formGrid}>
          {/* Custom Time Input (ponytail: native time picker + quick chips) */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Clock size={14} />
              <span>Jam Pengiriman Harian (WIB)</span>
            </label>
            <div className={styles.timeWrapper}>
              <input
                type="time"
                className={styles.timeInput}
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
              />
              <div className={styles.quickChipsRow}>
                {TIME_PRESETS.map((p) => (
                  <button
                    key={p.time}
                    type="button"
                    className={`${styles.quickChipBtn} ${
                      sendTime === p.time ? styles.quickChipActive : ''
                    }`}
                    onClick={() => setSendTime(p.time)}
                  >
                    {p.time}
                  </button>
                ))}
              </div>
            </div>
            <span className={styles.helperText}>
              Waktu di mana worker otomatis mengecek & mengirim email (Zona Waktu: WIB).
            </span>
          </div>

          {/* Lead Time (Days Before) */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Calendar size={14} />
              <span>Ambang Hari Sebelum Deadline (Lead Time)</span>
            </label>
            <input
              type="number"
              min="0"
              max="30"
              className={styles.input}
              value={daysBefore}
              onChange={(e) => setDaysBefore(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className={styles.helperText}>
              Contoh: <strong>1</strong> berarti pengingat dikirim 1 hari sebelum Running BOM date (H-1).
            </span>
          </div>

          {/* Email Subject */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              <Mail size={14} />
              <span>Subjek Email Pengingat</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="[REMINDER] ECN Running BOM Deadline Alert - SEIN PE"
            />
          </div>

          {/* Recipients (To) with EmailChipInput */}
          <div className={styles.formGroupFull}>
            <EmailChipInput
              label="Daftar Email Penerima (To) - Wajib"
              value={recipients}
              onChange={setRecipients}
              placeholder="Ketik email penerima (misal endri.s@samsung.com) lalu tekan Enter atau koma..."
              required
            />
            <span className={styles.helperText}>
              Bisa memasukkan banyak email sekaligus. Tekan <strong>Enter</strong> atau <strong>koma</strong> untuk menambah chip email.
            </span>
          </div>

          {/* CC Recipients */}
          <div className={styles.formGroupFull}>
            <EmailChipInput
              label="Daftar Email Tembusan (CC) - Opsional"
              value={ccRecipients}
              onChange={setCcRecipients}
              placeholder="Ketik email tembusan (CC) lalu tekan Enter..."
            />
          </div>

          {/* Checkbox include overdue */}
          <div className={styles.formGroupFull}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={includeOverdue}
                onChange={(e) => setIncludeOverdue(e.target.checked)}
              />
              <span>
                <strong>Sertakan ECN Overdue:</strong> Tetap ingatkan ECN berstatus Pending yang tanggal Running BOM-nya telah lewat hari ini namun belum selesai.
              </span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
