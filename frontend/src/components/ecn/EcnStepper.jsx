import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Clock,
  AlertCircle,
  X,
  FileCheck,
  ShieldCheck,
  Layers,
  Database,
  UserCheck,
} from 'lucide-react';
import styles from './EcnStepper.module.css';

/**
 * EcnStepper
 * Visual breadcrumb / stepper showing 4-stage lifecycle:
 * Step 1: Pengajuan (Procurement / Purchasing / Originator)
 * Step 2: Review BOM (BOM Team / ECN Coordinator)
 * Step 3: Approval PIC Model (Model Owner / New Model Development)
 * Step 4: Update PLM (PLM Samsung System Sync & Feedback)
 */
export const EcnStepper = ({ item, detailed = false }) => {
  const { t } = useTranslation();

  if (!item) return null;

  const isCancelled = item.status === 'ECO Cancel';
  const isRejected = item.plm_status === 'REJECTED';
  const isCompleted = item.status === 'Completed' || item.plm_status === 'PLM_UPDATED';

  // Determine stage status ('done' | 'active' | 'pending' | 'rejected')
  const getStepStatus = (stepNumber) => {
    if (isCancelled || isRejected) {
      if (stepNumber === 1) return 'done';
      if (item.plm_status === 'REJECTED' && stepNumber === 3) return 'rejected';
      return 'cancelled';
    }

    if (isCompleted) return 'done';

    switch (item.plm_status) {
      case 'APPROVED_FOR_PLM':
        if (stepNumber <= 3) return 'done';
        if (stepNumber === 4) return 'active';
        return 'pending';

      case 'WAITING_MODEL_APPROVAL':
        if (stepNumber <= 2) return 'done';
        if (stepNumber === 3) return 'active';
        return 'pending';

      case 'PENDING_BOM_REVIEW':
        if (stepNumber === 1) return 'done';
        if (stepNumber === 2) return 'active';
        return 'pending';

      default:
        // Standar ECN workflow tanpa explicit PLM status
        if (item.status === 'Progress' || item.status === 'In Progress') {
          if (stepNumber === 1) return 'done';
          if (stepNumber === 2) return 'active';
          return 'pending';
        }
        // Pending
        if (stepNumber === 1) return 'done';
        return 'pending';
    }
  };

  const steps = [
    {
      num: 1,
      title: t('ecn.stepper.step1_title', '1. Purchasing'),
      sub: t('ecn.stepper.step1_sub', 'Pengajuan'),
      icon: Layers,
      pic: item.created_by_name || item.author_name || 'Purchasing',
      desc: item.running_date_bom
        ? `Target BOM: ${item.running_date_bom}`
        : t('ecn.stepper.init_ecn', 'Inisiasi ECN'),
    },
    {
      num: 2,
      title: t('ecn.stepper.step2_title', '2. BOM Team'),
      sub: t('ecn.stepper.step2_sub', 'Review BOM'),
      icon: FileCheck,
      pic: item.updater_name || 'BOM Coordinator',
      desc: item.part_before && item.part_after
        ? `${item.part_before} ➔ ${item.part_after}`
        : t('ecn.stepper.check_bom', 'Cek struktur part BOM'),
    },
    {
      num: 3,
      title: t('ecn.stepper.step3_title', '3. PIC Model'),
      sub: item.plm_model_stage ? `Approval (${item.plm_model_stage})` : t('ecn.stepper.step3_sub', 'Approval Model'),
      icon: UserCheck,
      pic: item.plm_pic_model_name
        ? `${item.plm_pic_model_name}`
        : (item.model ? `PIC ${item.model}` : 'PIC Model'),
      desc: item.plm_model_stage
        ? `Model: ${item.model || ''} (${item.plm_model_stage})`
        : t('ecn.stepper.validate_line', 'Validasi kesiapan lini'),
    },
    {
      num: 4,
      title: t('ecn.stepper.step4_title', '4. PLM Sync'),
      sub: t('ecn.stepper.step4_sub', 'Selesai di PLM'),
      icon: Database,
      pic: item.plm_updated_by_name || 'BOM Specialist',
      desc: item.plm_eco_no
        ? `ECO: ${item.plm_eco_no}`
        : (isCompleted ? t('ecn.stepper.synced_to_plm', 'Disinkronkan ke PLM') : t('ecn.stepper.waiting_plm', 'Menunggu update PLM')),
    },
  ];

  if (!detailed) {
    // Compact Horizontal Stepper for Table Rows
    return (
      <div className={styles.compactContainer} title={t('ecn.stepper.tooltip', 'Progress Workflow Running BOM')}>
        {steps.map((st, index) => {
          const status = getStepStatus(st.num);
          return (
            <React.Fragment key={st.num}>
              <div
                className={`${styles.compactStep} ${styles[`step_${status}`]}`}
                title={`${st.title} (${st.sub}): ${st.desc} • PIC: ${st.pic}`}
              >
                <span className={styles.compactDot}>
                  {status === 'done' ? (
                    <Check size={9} strokeWidth={3} />
                  ) : status === 'rejected' ? (
                    <X size={9} strokeWidth={3} />
                  ) : status === 'active' ? (
                    <span className={styles.pulseDot} />
                  ) : (
                    st.num
                  )}
                </span>
                <span className={styles.compactLabel}>{st.title.replace(/^\d+\.\s*/, '')}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`${styles.compactConnector} ${
                    status === 'done' && getStepStatus(steps[index + 1].num) !== 'pending'
                      ? styles.connectorDone
                      : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Detailed Stepper for Expanded Rows or Dialogs
  return (
    <div className={styles.detailedContainer}>
      <div className={styles.detailedHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} className={styles.detailedHeaderIcon} />
          <span className={styles.detailedHeaderTitle}>
            {t('ecn.stepper.detailed_title', 'Workflow & Approval Stepper Running BOM')}
          </span>
          {item.plm_model_stage && (
            <span className={styles.stagePill} title="Development Stage dari New Model Development">
              Stage: {item.plm_model_stage.toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.detailedStatusBadge}>
          {isCompleted ? (
            <span className={styles.badgeSuccess}>
              <Check size={12} /> {t('ecn.stepper.status_completed', 'PLM Selesai & Sinkron')}
            </span>
          ) : isRejected ? (
            <span className={styles.badgeDanger}>
              <AlertCircle size={12} /> {t('ecn.stepper.status_rejected', 'Ditolak PIC Model')}
            </span>
          ) : (
            <span className={styles.badgeActive}>
              <Clock size={12} /> {t('ecn.stepper.status_in_progress', 'Dalam Proses')}
            </span>
          )}
        </div>
      </div>

      <div className={styles.detailedStepsGrid}>
        {steps.map((st, index) => {
          const status = getStepStatus(st.num);
          const StepIcon = st.icon;

          return (
            <div
              key={st.num}
              className={`${styles.detailedCard} ${styles[`card_${status}`]}`}
            >
              <div className={styles.detailedCardTop}>
                <div className={`${styles.detailedIconWrap} ${styles[`iconWrap_${status}`]}`}>
                  <StepIcon size={14} />
                </div>
                <div className={styles.detailedStepTitles}>
                  <span className={styles.stepNumTitle}>{st.title}</span>
                  <span className={styles.stepSubTitle}>{st.sub}</span>
                </div>
                <div className={styles.stepStatusPillWrap}>
                  {status === 'done' && (
                    <span className={styles.pillDone}>
                      <Check size={10} /> Selesai
                    </span>
                  )}
                  {status === 'active' && (
                    <span className={styles.pillActive}>
                      <Clock size={10} /> Sedang Berjalan
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className={styles.pillPending}>Menunggu</span>
                  )}
                  {status === 'rejected' && (
                    <span className={styles.pillRejected}>
                      <X size={10} /> Ditolak
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.detailedCardBottom}>
                <div className={styles.detailedPicRow}>
                  <span className={styles.picLabel}>PIC:</span>
                  <strong className={styles.picValue}>{st.pic}</strong>
                </div>
                <div className={styles.detailedDescRow}>{st.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

