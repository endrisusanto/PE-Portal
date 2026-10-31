import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  UserCheck,
  Database,
  Calendar,
  Layers,
  FileText,
  ArrowRight,
  Info,
  Truck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../api/client';
import styles from './EcnWorkflowModal.module.css';

/**
 * EcnWorkflowModal
 * Handles 3 interactive workflow stages:
 * 1. 'request_approval' : BOM Team requests approval from PIC Model
 * 2. 'model_approval'   : PIC Model approves or rejects the change
 * 3. 'confirm_plm'      : BOM Team confirms change is active in Samsung PLM
 */
export const EcnWorkflowModal = ({ isOpen, onClose, item, mode, onSuccess }) => {
  const { t } = useTranslation();

  const [notes, setNotes] = useState('');
  const [ecoNo, setEcoNo] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !item) return null;

  const isMpStage = (item.plm_model_stage || '').toLowerCase() === 'mp';

  // Handle Request Approval (BOM Team -> PIC Model)
  const handleRequestApproval = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/ecn/${item.id}/request-approval`, {
        notes,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle PIC Model Approve
  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/ecn/${item.id}/approve-plm`, {
        notes: notes || t('ecn.workflow.default_approve_note', 'Disetujui. Kesiapan lini produksi dan buffer stock part lama aman.'),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle PIC Model Reject
  const handleReject = async () => {
    if (!notes.trim()) {
      setError(t('ecn.workflow.err_reject_reason', 'Harap masukkan alasan penolakan agar tim Purchasing dapat menegosiasikan opsi ke vendor.'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/ecn/${item.id}/reject-plm`, {
        reason: notes,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Confirm PLM Update (BOM Team -> Complete)
  const handleConfirmPLM = async () => {
    if (!ecoNo.trim()) {
      setError(t('ecn.workflow.err_eco_required', 'Harap masukkan Nomor ECO / Dokumen referensi PLM Samsung.'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/ecn/${item.id}/confirm-plm-update`, {
        eco_no: ecoNo,
        feedback_note: feedbackNote || t('ecn.workflow.default_plm_feedback', 'Running BOM Date telah resmi disinkronkan di sistem PLM Samsung.'),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Title and Actions according to mode
  let modalTitle = 'Workflow Tindakan ECN';
  let modalFooter = null;

  if (mode === 'request_approval') {
    modalTitle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UserCheck size={18} style={{ color: '#d97706' }} />
        <span>{t('ecn.workflow.title_request', 'Minta Persetujuan PIC Model')}</span>
      </div>
    );
    modalFooter = (
      <div className={styles.modalFooter}>
        <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Batal')}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={Send}
          onClick={handleRequestApproval}
          loading={loading}
        >
          {t('ecn.workflow.submit_request', 'Kirim Permohonan ke PIC Model')}
        </Button>
      </div>
    );
  } else if (mode === 'model_approval') {
    modalTitle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={18} style={{ color: '#0d7377' }} />
        <span>{t('ecn.workflow.title_approval', 'Persetujuan PIC Model (Line Readiness)')}</span>
      </div>
    );
    modalFooter = (
      <div className={styles.modalFooter}>
        <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Batal')}
        </Button>
        <Button
          variant="danger"
          size="md"
          icon={XCircle}
          onClick={handleReject}
          loading={loading}
        >
          {t('ecn.workflow.reject_btn', 'Tolak (Reject)')}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={CheckCircle2}
          onClick={handleApprove}
          loading={loading}
          style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
        >
          {t('ecn.workflow.approve_btn', 'Setujui (Approve)')}
        </Button>
      </div>
    );
  } else if (mode === 'confirm_plm') {
    modalTitle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Database size={18} style={{ color: '#2563eb' }} />
        <span>{t('ecn.workflow.title_plm', 'Konfirmasi Update Sistem PLM Samsung')}</span>
      </div>
    );
    modalFooter = (
      <div className={styles.modalFooter}>
        <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Batal')}
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={CheckCircle2}
          onClick={handleConfirmPLM}
          loading={loading}
        >
          {t('ecn.workflow.submit_plm', 'Konfirmasi Selesai di PLM & Kirim Feedback')}
        </Button>
      </div>
    );
  }

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

        {/* ECN Summary Card */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryRowTop}>
            <span className={styles.ecnChip}>{item.ecn_no}</span>
            <span className={styles.modelPill}>{item.model || 'Model'}</span>
            {item.plm_model_stage && (
              <span className={`${styles.stagePill} ${isMpStage ? styles.stagePillMp : ''}`}>
                Stage: {item.plm_model_stage.toUpperCase()}
              </span>
            )}
            <span className={styles.processBadge}>{item.process || 'SMD'}</span>
          </div>

          <div className={styles.ecnTitleText}>
            {item.ec_title || '-'}
          </div>

          <div className={styles.summaryMetaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{t('ecn.table.running_bom', 'Target Running BOM')}:</span>
              <span className={styles.metaValueHighlight}>
                <Calendar size={12} /> {item.running_date_bom || '-'}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>{t('ecn.workflow.related_pic_model', 'PIC Model Terkait:')}</span>
              <strong className={styles.metaValue}>
                {item.plm_pic_model_name || `PIC ${item.model || 'Model'}`}
              </strong>
            </div>

            {(item.part_before || item.part_after) && (
              <div className={styles.metaItem} style={{ gridColumn: 'span 2' }}>
                <span className={styles.metaLabel}>{t('ecn.table.part_change_label', 'Perubahan Part:')}</span>
                <span className={styles.partDiffText}>
                  {item.part_before || '-'} <ArrowRight size={11} /> {item.part_after || '-'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Purchasing (PIC A) Clarification Note Card */}
        {item.plm_change_reason && (
          <div className={styles.purchasingClarificationCard}>
            <div className={styles.purchasingCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} className={styles.purchasingIcon} />
                <span className={styles.purchasingTitle}>{t('ecn.workflow.purchasing_clarification_title', 'Klarifikasi Perubahan dari Purchasing (PIC A)')}</span>
              </div>
              {item.plm_vendor_eta && (
                <span className={styles.purchasingEtaBadge}>
                  {t('ecn.workflow.vendor_eta_prefix', 'ETA Vendor:')} {item.plm_vendor_eta}
                </span>
              )}
            </div>
            <div className={styles.purchasingReasonText}>
              {item.plm_change_reason}
            </div>
          </div>
        )}

        {/* Mode 1: Request Approval (BOM Team -> PIC Model) */}
        {mode === 'request_approval' && (
          <div className={styles.formSection}>
            <div className={styles.infoBanner}>
              <Info size={15} className={styles.infoIcon} />
              <span>
                {t('ecn.workflow.info_request_routing', 'Permohonan akan diarahkan secara otomatis ke {{name}} sesuai master New Model Development.', {
                  name: item.plm_pic_model_name || 'PIC Model',
                })}
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {t('ecn.workflow.bom_notes_label', 'Catatan Telaah BOM Team untuk PIC Model (Opsional):')}
              </label>
              <textarea
                rows={3}
                className={styles.textareaField}
                placeholder={t('ecn.workflow.bom_notes_placeholder', 'Contoh: Struktur part BOM sudah dicek dan konsisten. Mohon verifikasi kecukupan buffer stock part lama dan jadwal trial lini.')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Mode 2: Model Approval (PIC Model Approves/Rejects) */}
        {mode === 'model_approval' && (
          <div className={styles.formSection}>
            {isMpStage ? (
              <div className={styles.warningBanner}>
                <AlertTriangle size={16} color="#d97706" />
                <div>
                  <strong>{t('ecn.workflow.warning_mp_title', 'Peringatan Mass Production (MP):')}</strong>
                  <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                    {t('ecn.workflow.warning_mp_desc', 'Model ini berada pada tahap MP. Pergeseran Running BOM berisiko menghentikan lini produksi jika part lama habis sebelum part baru tiba.')}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.infoBanner}>
                <ShieldCheck size={15} color="#0d7377" />
                <span>
                  {t('ecn.workflow.info_model_eval', 'Silakan evaluasi kesiapan lini perakitan, ketersediaan sample/material, dan buffer stock part lama sebelum menyetujui.')}
                </span>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {t('ecn.workflow.model_decision_notes_label', 'Catatan Keputusan Kesiapan Lini (Wajib diisi jika menolak):')}
              </label>
              <textarea
                rows={3}
                className={styles.textareaField}
                placeholder={t('ecn.workflow.model_decision_placeholder', 'Masukkan catatan evaluasi, kesiapan line balancing, atau instruksi alternatif jika menolak...')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Mode 3: Confirm PLM Update (BOM Team -> Complete) */}
        {mode === 'confirm_plm' && (
          <div className={styles.formSection}>
            <div className={styles.successBanner}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>
                {t('ecn.workflow.success_approved_banner', 'Perubahan jadwal telah disetujui oleh PIC Model. Masukkan nomor referensi ECO sistem PLM Samsung untuk menandai penyelesaian.')}
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {t('ecn.workflow.eco_no_label', 'Nomor ECO / Dokumen Referensi PLM Samsung')} <span style={{ color: '#ef4444' }}>*</span>:
              </label>
              <input
                type="text"
                className={styles.inputField}
                placeholder={t('ecn.workflow.eco_no_placeholder', 'Contoh: PLM-2026-09811 atau ECO-S26-004')}
                value={ecoNo}
                onChange={(e) => setEcoNo(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>
                {t('ecn.workflow.feedback_label', 'Pesan Konfirmasi Feedback untuk Purchasing:')}
              </label>
              <textarea
                rows={2}
                className={styles.textareaField}
                placeholder={t('ecn.workflow.feedback_placeholder', 'Contoh: Running BOM Date telah resmi disesuaikan di PLM Samsung. Jadwal pengiriman material supplier dapat dieksekusi sesuai tanggal ini.')}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

