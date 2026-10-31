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
  ArrowRight,
  Layers,
  User,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Inbox,
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

  // Form State: Tab & Deadline Reminder
  const [activeTab, setActiveTab] = useState('deadline'); // 'deadline' | 'bom_change'
  const [isEnabled, setIsEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState(1);
  const [selectedTimes, setSelectedTimes] = useState(['08:00']);
  const [customTime, setCustomTime] = useState('09:00');
  const [recipients, setRecipients] = useState('');
  const [ccRecipients, setCcRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('[REMINDER] ECN Running BOM Deadline Alert - SEIN PE');
  const [includeOverdue, setIncludeOverdue] = useState(true);

  // Form State: Batch Running BOM Change Notification (ponytail)
  const [bomChangeNotifyEnabled, setBomChangeNotifyEnabled] = useState(true);
  const [bomChangeSelectedTimes, setBomChangeSelectedTimes] = useState(['08:00', '13:00', '16:00']);
  const [bomChangeCustomTime, setBomChangeCustomTime] = useState('11:00');
  const [bomChangeRecipients, setBomChangeRecipients] = useState('');
  const [bomChangeCcRecipients, setBomChangeCcRecipients] = useState('');
  const [bomChangeEmailSubject, setBomChangeEmailSubject] = useState('[UPDATE] Perubahan Jadwal Running BOM ({count} ECN)');
  const [bomChangePendingCount, setBomChangePendingCount] = useState(0);
  const [bomChangeRecords, setBomChangeRecords] = useState([]);
  const [isBatchPreviewExpanded, setIsBatchPreviewExpanded] = useState(true);
  const [testingBomChange, setTestingBomChange] = useState(false);

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

      // Batch BOM change settings
      setBomChangeNotifyEnabled(s.bom_change_notify_enabled !== false);
      setBomChangeSelectedTimes(parseSendTimes(s.bom_change_send_time || '08:00, 13:00, 16:00'));
      setBomChangeRecipients(s.bom_change_recipients || '');
      setBomChangeCcRecipients(s.bom_change_cc_recipients || '');
      setBomChangeEmailSubject(s.bom_change_email_subject || '[UPDATE] Perubahan Jadwal Running BOM ({count} ECN)');
      setBomChangePendingCount(data.bom_change_pending_count || 0);
      setBomChangeRecords(data.pending_bom_records || []);

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

  // Toggle preset time in bomChangeSelectedTimes (ponytail: batch at scheduled hours)
  const handleToggleBOMPresetTime = (timeStr) => {
    setBomChangeSelectedTimes((prev) => {
      if (prev.includes(timeStr)) {
        const next = prev.filter((t) => t !== timeStr);
        return next.length > 0 ? next : ['08:00'];
      } else {
        return [...prev, timeStr].sort();
      }
    });
  };

  // Add custom time into bomChangeSelectedTimes
  const handleAddBOMCustomTime = () => {
    if (!bomChangeCustomTime) return;
    const [h, m] = bomChangeCustomTime.split(':');
    const formatted = `${h.padStart(2, '0')}:${m}`;
    setBomChangeSelectedTimes((prev) => {
      if (prev.includes(formatted)) return prev;
      return [...prev, formatted].sort();
    });
  };

  // Remove specific time from bomChangeSelectedTimes
  const handleRemoveBOMTime = (timeStr) => {
    setBomChangeSelectedTimes((prev) => {
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
        bom_change_notify_enabled: bomChangeNotifyEnabled,
        bom_change_send_time: bomChangeSelectedTimes.join(', ') || '08:00, 13:00, 16:00',
        bom_change_recipients: bomChangeRecipients,
        bom_change_cc_recipients: bomChangeCcRecipients,
        bom_change_email_subject: bomChangeEmailSubject,
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

  // Handle Immediate Test Dispatch (Deadline Reminder)
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
        bom_change_notify_enabled: bomChangeNotifyEnabled,
        bom_change_send_time: bomChangeSelectedTimes.join(', ') || '08:00, 13:00, 16:00',
        bom_change_recipients: bomChangeRecipients,
        bom_change_cc_recipients: bomChangeCcRecipients,
        bom_change_email_subject: bomChangeEmailSubject,
      });

      const res = await api.post('/ecn/reminder/test');
      setFeedback({
        type: 'success',
        message: res.data?.message || t('ecn.reminder.test_success', 'Email tes pengingat deadline berhasil dikirim!'),
      });
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

  // Handle Test Dispatch for BOM Date Change Batch
  const handleTestBomChange = async () => {
    const targetTo = bomChangeRecipients.trim() || recipients.trim();
    if (!targetTo) {
      setFeedback({
        type: 'error',
        message: t('ecn.reminder.require_recipient', 'Harap isi minimal 1 email penerima sebelum mengirim tes!'),
      });
      return;
    }

    setTestingBomChange(true);
    setFeedback(null);
    try {
      await api.put('/ecn/reminder/settings', {
        is_enabled: isEnabled,
        days_before: Number(daysBefore) || 1,
        send_time: selectedTimes.join(', ') || '08:00',
        recipients,
        cc_recipients: ccRecipients,
        email_subject: emailSubject,
        include_overdue: includeOverdue,
        bom_change_notify_enabled: bomChangeNotifyEnabled,
        bom_change_send_time: bomChangeSelectedTimes.join(', ') || '08:00, 13:00, 16:00',
        bom_change_recipients: bomChangeRecipients,
        bom_change_cc_recipients: bomChangeCcRecipients,
        bom_change_email_subject: bomChangeEmailSubject,
      });

      const res = await api.post('/ecn/reminder/test-bom-change');
      setFeedback({
        type: 'success',
        message: res.data?.message || t('ecn.reminder.test_bom_success', 'Email tes notifikasi batch perubahan Running BOM berhasil dikirim!'),
      });
      fetchSettings();
    } catch (err) {
      console.error('Failed to trigger test BOM change email:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || t('ecn.reminder.test_bom_error', 'Gagal mengirim email tes perubahan Running BOM.'),
      });
    } finally {
      setTestingBomChange(false);
    }
  };

  const modalFooter = (
    <div className={styles.footerActions}>
      {activeTab === 'deadline' ? (
        <Button
          variant="secondary"
          size="md"
          icon={Send}
          onClick={handleTestSend}
          loading={testing}
          disabled={saving || loading || testingBomChange}
          title={t('ecn.reminder.test_send_title', 'Kirim email uji coba saat ini juga ke daftar penerima')}
        >
          {t('ecn.reminder.test_deadline_btn', 'Kirim Tes Pengingat Deadline')}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="md"
          icon={Send}
          onClick={handleTestBomChange}
          loading={testingBomChange}
          disabled={saving || loading || testing}
          title="Kirim email uji coba perubahan jadwal Running BOM"
        >
          {t('ecn.reminder.test_bom_btn', 'Kirim Tes Notifikasi Perubahan')}
        </Button>
      )}

      <div className={styles.footerRight}>
        <Button variant="ghost" size="md" onClick={onClose} disabled={saving || testing || testingBomChange}>
          {t('common.cancel', 'Batal')}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={Check}
          onClick={handleSave}
          loading={saving}
          disabled={testing || testingBomChange || loading}
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

        {/* Tab Navigation (ponytail) */}
        <div className={styles.tabNav}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'deadline' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('deadline')}
          >
            <Clock size={14} />
            <span>{t('ecn.reminder.tab_deadline', 'Pengingat Deadline Running BOM')}</span>
            {dueCount > 0 && <span className={styles.tabBadge}>{dueCount}</span>}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'bom_change' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('bom_change')}
          >
            <Bell size={14} />
            <span>{t('ecn.reminder.tab_bom_change', 'Notifikasi Perubahan Jadwal BOM')}</span>
            {bomChangePendingCount > 0 && <span className={styles.tabBadge}>{bomChangePendingCount}</span>}
          </button>
        </div>

        {activeTab === 'deadline' ? (
          <>
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

                  {/* Part filter highlight pill */}
                  <div className={styles.partFilterPill}>
                    ⚡ {t('ecn.reminder.filter_part_only_pill', 'Filter Aktif: Khusus ECN Part Change BOM (Verifikasi Berubah/Tetap)')}
                  </div>

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
          </>
        ) : (
          /* Tab 2: Perubahan Jadwal BOM Batch Notification Settings (ponytail) */
          <div className={styles.fullPanelCard}>
            <div className={styles.panelHeader}>
              <h5 className={styles.panelTitle}>
                <Bell size={14} />
                <span>{t('ecn.reminder.bom_change_title', 'Notifikasi Batch Perubahan Jadwal Running BOM')}</span>
              </h5>
            </div>

            <div className={styles.infoBanner}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  {t(
                    'ecn.reminder.bom_change_info_banner',
                    'Sistem secara otomatis mengumpulkan (batch) seluruh riwayat perubahan tanggal Running BOM dan mengirimkannya dalam 1 email ringkasan pada jam-jam batch terjadwal di bawah ini.'
                  )}
                </span>
                <span className={styles.tabBadge} style={{ fontSize: '11.5px', padding: '3px 9px' }}>
                  {bomChangePendingCount > 0
                    ? t('ecn.reminder.pending_batch_count', '{{count}} Perubahan Menunggu Batch', { count: bomChangePendingCount })
                    : t('ecn.reminder.no_pending_batch', '0 Perubahan Menunggu')}
                </span>
              </div>
            </div>

            {/* Live Pending Batch Preview Section */}
            <div className={styles.batchPreviewSection}>
              <div
                className={styles.batchPreviewHeader}
                onClick={() => setIsBatchPreviewExpanded(!isBatchPreviewExpanded)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.batchPreviewTitleRow}>
                  <CalendarDays size={14} className={styles.batchPreviewIcon} />
                  <span className={styles.batchPreviewTitle}>
                    {t('ecn.reminder.preview_title', 'Daftar Perubahan Jadwal yang Menunggu Batch')}
                  </span>
                  <span className={`${styles.batchPreviewCountPill} ${bomChangeRecords.length > 0 ? styles.batchPreviewCountActive : ''}`}>
                    {bomChangeRecords.length} ECN
                  </span>
                </div>
                <div className={styles.batchPreviewToggle}>
                  <span className={styles.batchPreviewToggleText}>
                    {isBatchPreviewExpanded
                      ? t('common.collapse', 'Tutup')
                      : t('common.expand', 'Lihat Detail')}
                  </span>
                  {isBatchPreviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {isBatchPreviewExpanded && (
                <div className={styles.batchPreviewBody}>
                  {bomChangeRecords.length > 0 ? (
                    <div className={styles.batchPreviewList}>
                      {bomChangeRecords.map((item, idx) => (
                        <div key={item.log_id || `${item.ecn_no}-${idx}`} className={styles.batchPreviewCard}>
                          <div className={styles.batchCardTop}>
                            <div className={styles.batchCardBadges}>
                              <span className={styles.batchEcnChip} title={item.ecn_no}>
                                {item.ecn_no}
                              </span>
                              {item.model && (
                                <span className={styles.batchModelBadge}>
                                  {item.model}
                                </span>
                              )}
                              {item.process && (
                                <span className={styles.batchProcessBadge}>
                                  {item.process}
                                </span>
                              )}
                              {item.status && (
                                <span className={styles.batchStatusBadge}>
                                  {item.status}
                                </span>
                              )}
                            </div>
                            <span className={styles.batchTimestamp}>
                              {item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              }) + ' WIB' : '-'}
                            </span>
                          </div>

                          {item.ec_title && (
                            <div className={styles.batchCardTitle}>
                              {item.ec_title}
                            </div>
                          )}

                          <div className={styles.batchDiffRow}>
                            <div className={styles.batchDiffCol}>
                              <span className={styles.batchDiffLabel}>
                                {t('ecn.reminder.diff_running_bom', 'Running BOM Date')}:
                              </span>
                              <div className={styles.batchDiffValues}>
                                <span className={styles.batchOldDate} title="Jadwal Lama">
                                  {item.old_date || '-'}
                                </span>
                                <ArrowRight size={13} className={styles.batchDiffArrow} />
                                <span className={styles.batchNewDate} title="Jadwal Baru">
                                  {item.new_date || '-'}
                                </span>
                              </div>
                            </div>

                            {(item.part_before || item.part_after) && (
                              <div className={styles.batchDiffCol}>
                                <span className={styles.batchDiffLabel}>Part BOM:</span>
                                <div className={styles.batchPartValues}>
                                  <span className={styles.batchPartOld}>{item.part_before || '-'}</span>
                                  <ArrowRight size={12} className={styles.batchDiffArrow} />
                                  <span className={styles.batchPartNew}>{item.part_after || '-'}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className={styles.batchCardFooter}>
                            <div className={styles.batchAuthorInfo}>
                              <User size={12} style={{ opacity: 0.7 }} />
                              <span>{t('ecn.reminder.changed_by', 'Diubah oleh')}: <strong>{item.changed_by_name || 'Purchasing / System'}</strong></span>
                            </div>
                            {item.remark && (
                              <div className={styles.batchRemarkText} title={item.remark}>
                                {item.remark}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.batchEmptyCard}>
                      <Inbox size={22} className={styles.batchEmptyIcon} />
                      <div className={styles.batchEmptyText}>
                        <span className={styles.batchEmptyTitle}>
                          {t('ecn.reminder.no_changes_title', 'Belum Ada Perubahan Running BOM yang Menunggu')}
                        </span>
                        <span className={styles.batchEmptySubtitle}>
                          {t('ecn.reminder.no_changes_sub', 'Semua perubahan jadwal Running BOM telah diproses dan terkirim dalam batch sebelumnya.')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Master Switch Row */}
            <div className={styles.masterSwitchRow}>
              <div className={styles.masterSwitchInfo}>
                <div className={styles.masterSwitchTitleRow}>
                  <span className={styles.masterSwitchTitle}>
                    {t('ecn.reminder.bom_change_toggle', 'Worker Batch Perubahan')}
                  </span>
                  <span
                    className={`${styles.masterStatusPill} ${
                      bomChangeNotifyEnabled ? styles.masterActive : styles.masterInactive
                    }`}
                  >
                    {bomChangeNotifyEnabled
                      ? t('ecn.reminder.bom_change_active', 'Aktif')
                      : t('ecn.reminder.bom_change_inactive', 'Nonaktif')}
                  </span>
                </div>
                <span className={styles.masterSwitchSub}>
                  {t('ecn.reminder.bom_change_sub', 'Kirim email ringkasan batch secara otomatis pada jam-jam tertentu yang ditentukan')}
                </span>
              </div>
              <label className={styles.switch} title="Aktifkan atau nonaktifkan notifikasi batch perubahan Running BOM">
                <input
                  type="checkbox"
                  checked={bomChangeNotifyEnabled}
                  onChange={(e) => setBomChangeNotifyEnabled(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <hr className={styles.panelDivider} />

            {/* Multi-Schedule Slot Section for BOM Change Batch (ponytail) */}
            <div className={styles.scheduleSection}>
              <div className={styles.scheduleHeaderRow}>
                <label className={styles.scheduleLabel}>
                  <span>{t('ecn.reminder.bom_change_send_time_label', 'Jam Pengiriman Batch Perubahan (WIB)')}</span>
                </label>
                <span className={styles.scheduleCountBadge}>
                  {t('ecn.reminder.times_per_day', '{{count}}x sehari', { count: bomChangeSelectedTimes.length })}
                </span>
              </div>

              {/* Quick Preset Segmented Buttons */}
              <div className={styles.presetsGrid}>
                {timePresets.map((p) => {
                  const isSelected = bomChangeSelectedTimes.includes(p.time);
                  return (
                    <button
                      key={p.time}
                      type="button"
                      className={`${styles.presetChipBtn} ${
                        isSelected ? styles.presetChipActive : ''
                      }`}
                      onClick={() => handleToggleBOMPresetTime(p.time)}
                      title={`Klik untuk ${isSelected ? 'menonaktifkan' : 'mengaktifkan'} jadwal batch ${p.time}`}
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
                  value={bomChangeCustomTime}
                  onChange={(e) => setBomChangeCustomTime(e.target.value)}
                  title="Pilih jam kustom"
                />
                <button
                  type="button"
                  className={styles.addScheduleBtn}
                  onClick={handleAddBOMCustomTime}
                  title={t('ecn.reminder.add_custom_title', 'Tambahkan jam kustom ke daftar jadwal batch')}
                >
                  <Plus size={13} />
                  <span>{t('ecn.reminder.add_schedule_btn', 'Tambah')}</span>
                </button>
              </div>

              {/* Active Slots Bar */}
              <div className={styles.activeSlotsBar}>
                {bomChangeSelectedTimes.map((tVal) => (
                  <span key={tVal} className={styles.activeSlotItem}>
                    <Clock size={11} />
                    <span>{t('ecn.reminder.active_wib', '{{time}} WIB', { time: tVal })}</span>
                    <button
                      type="button"
                      className={styles.slotDeleteBtn}
                      onClick={() => handleRemoveBOMTime(tVal)}
                      title={t('ecn.reminder.remove_time_title', 'Hapus jadwal {{time}}', { time: tVal })}
                      disabled={bomChangeSelectedTimes.length === 1}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <hr className={styles.panelDivider} />

            {/* Email Subject Template */}
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                <Mail size={13} />
                <span>{t('ecn.reminder.bom_change_subject_label', 'Subjek Email Notifikasi Batch')}</span>
              </label>
              <input
                type="text"
                className={styles.inputField}
                value={bomChangeEmailSubject}
                onChange={(e) => setBomChangeEmailSubject(e.target.value)}
                placeholder="[UPDATE] Perubahan Jadwal Running BOM ({count} ECN)"
              />
              <span className={styles.fieldHelper}>
                {t('ecn.reminder.bom_change_subject_helper', 'Placeholder otomatis: {count}, {ecn_no}, {model}')}
              </span>
            </div>

            {/* Recipients (To) */}
            <div className={styles.formGroup}>
              <EmailChipInput
                label={t('ecn.reminder.bom_change_recipients_label', 'Daftar Email Penerima Khusus Perubahan (To) - Opsional')}
                value={bomChangeRecipients}
                onChange={setBomChangeRecipients}
                placeholder={t('ecn.reminder.bom_change_recipients_placeholder', 'Ketik email (misal manager@samsung.com) lalu tekan Enter...')}
              />
              <span className={styles.fieldHelper}>
                {t(
                  'ecn.reminder.bom_change_recipients_helper',
                  'Kosongkan jika ingin otomatis menggunakan daftar penerima default dari tab Pengingat Deadline.'
                )}
              </span>
            </div>

            {/* CC Recipients */}
            <div className={styles.formGroup}>
              <EmailChipInput
                label={t('ecn.reminder.bom_change_cc_label', 'Daftar Email Tembusan Khusus Perubahan (CC) - Opsional')}
                value={bomChangeCcRecipients}
                onChange={setBomChangeCcRecipients}
                placeholder={t('ecn.reminder.cc_placeholder', 'Ketik email tembusan (CC) lalu tekan Enter...')}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
