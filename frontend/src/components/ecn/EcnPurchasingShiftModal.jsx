import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Truck,
  AlertTriangle,
  ArrowRight,
  Send,
  Info,
  Clock,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../api/client';
import styles from './EcnPurchasingShiftModal.module.css';

const REASON_CATEGORIES = [
  'Keterlambatan Pengiriman Vendor (Vendor Shipment Delay)',
  'Kekurangan Material / Buffer Stock Rendah (Part Shortage)',
  'Kendala Bea Cukai / Perpanjangan Lead Time (Customs / Lead Time)',
  'Isu Kualitas Material Vendor (Vendor Quality Issue)',
  'Penyesuaian Jadwal Produksi (Line Balancing / Production Shift)',
  'Lainnya (Other)',
];

export const EcnPurchasingShiftModal = ({ isOpen, onClose, item, onSuccess }) => {
  const { t } = useTranslation();

  const [newDate, setNewDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [clarificationNote, setClarificationNote] = useState('');
  const [vendorEta, setVendorEta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (item && isOpen) {
      setNewDate(item.running_date_bom || '');
      setReasonCategory(REASON_CATEGORIES[0]);
      setClarificationNote(item.plm_change_reason ? item.plm_change_reason.replace(/^\[.*?\]\s*/, '') : '');
      setVendorEta(item.plm_vendor_eta || '');
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!newDate.trim()) {
      setError('Tanggal Running BOM baru wajib diisi.');
      return;
    }
    if (!clarificationNote.trim() || clarificationNote.trim().length < 5) {
      setError('Catatan klarifikasi Purchasing wajib diisi dengan jelas (minimal 5 karakter).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post(`/ecn/${item.id}/purchasing-shift`, {
        new_running_date_bom: newDate,
        reason_category: reasonCategory,
        clarification_note: clarificationNote.trim(),
        vendor_eta: vendorEta ? vendorEta : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Truck size={18} style={{ color: '#d97706' }} />
      <span>Klarifikasi Perubahan Running BOM (Purchasing / PIC A)</span>
    </div>
  );

  const modalFooter = (
    <div className={styles.modalFooter}>
      <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
        {t('common.cancel', 'Batal')}
      </Button>
      <Button
        variant="primary"
        size="md"
        icon={Send}
        onClick={handleSubmit}
        loading={loading}
        style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
      >
        Simpan & Ajukan ke BOM Team
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      footer={modalFooter}
      maxWidth="620px"
    >
      <div className={styles.container}>
        {error && (
          <div className={styles.alertError}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* ECN Summary Box */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryRowTop}>
            <span className={styles.ecnChip}>{item.ecn_no}</span>
            <span className={styles.modelPill}>{item.model || 'Model'}</span>
            <span className={styles.processBadge}>{item.process || 'SMD'}</span>
          </div>

          <div className={styles.ecnTitleText}>
            {item.ec_title || '-'}
          </div>

          <div className={styles.summaryMetaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Jadwal Running BOM Saat Ini:</span>
              <span className={styles.currentDateValue}>
                <Calendar size={13} /> {item.running_date_bom || '(Belum ditetapkan)'}
              </span>
            </div>

            {(item.part_before || item.part_after) && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Part Change:</span>
                <span className={styles.partDiffText}>
                  {item.part_before || '-'} <ArrowRight size={11} /> {item.part_after || '-'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className={styles.infoBanner}>
          <Info size={15} className={styles.infoIcon} />
          <span>
            Perubahan tanggal Running BOM akan memicu antrean verifikasi di <strong>BOM Team (PIC B)</strong> dan persetujuan kesiapan lini oleh <strong>PIC Model (PIC C)</strong>.
          </span>
        </div>

        {/* Input Form Fields */}
        <form onSubmit={handleSubmit} className={styles.formSection}>
          {/* New Running BOM Date */}
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>
              Jadwal Running BOM Baru <span className={styles.requiredMark}>*</span>:
            </label>
            <div className={styles.dateInputWrapper}>
              <Calendar size={15} className={styles.inputIcon} />
              <input
                type="date"
                className={styles.inputField}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reason Category */}
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>
              Kategori Alasan Perubahan <span className={styles.requiredMark}>*</span>:
            </label>
            <select
              className={styles.selectField}
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              required
            >
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Clarification Note */}
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>
              Catatan Klarifikasi Purchasing <span className={styles.requiredMark}>*</span>:
            </label>
            <textarea
              rows={3}
              className={styles.textareaField}
              placeholder="Contoh: Vendor supplier ABC mengonfirmasi shipment batch part baru mengalami delay 1 minggu akibat kendala customs. Buffer stock part lama di gudang masih cukup untuk 4 hari produksi..."
              value={clarificationNote}
              onChange={(e) => setClarificationNote(e.target.value)}
              required
            />
            <span className={styles.fieldHelpText}>
              Wajib diisi jelas agar PIC BOM & PIC Model memahami latar belakang dan risiko pergeseran jadwal.
            </span>
          </div>

          {/* Vendor ETA */}
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>
              Estimasi Kedatangan Material Vendor (Vendor ETA) <span className={styles.optionalMark}>(Opsional)</span>:
            </label>
            <div className={styles.dateInputWrapper}>
              <Clock size={15} className={styles.inputIcon} />
              <input
                type="date"
                className={styles.inputField}
                value={vendorEta}
                onChange={(e) => setVendorEta(e.target.value)}
                placeholder="Pilih tanggal estimasi tiba di pabrik"
              />
            </div>
            <span className={styles.fieldHelpText}>
              Estimasi tanggal fisik part baru tiba di gudang penerimaan material SEIN.
            </span>
          </div>
        </form>
      </div>
    </Modal>
  );
};

