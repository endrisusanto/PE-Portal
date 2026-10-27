// TaskAnalystTechnicalReportCard.jsx
// Renders the SEIN MX Product Engineering - OQC Technical Report format for Task Analyst
import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Printer,
  Edit3,
} from 'lucide-react';
import { RichNotesViewer } from './RichNotesViewer';
import styles from './TaskAnalystTechnicalReportCard.module.css';

export const TaskAnalystTechnicalReportCard = ({ project = {}, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Safely extract metadata report if stored, default to empty so PIC can fill
  const meta = (() => {
    try {
      if (!project.metadata) return {};
      if (typeof project.metadata === 'object') return project.metadata;
      return JSON.parse(project.metadata);
    } catch {
      return {};
    }
  })();

  const report = meta.technical_report || {};

  // Report fields with clean actual data from task/PIC, no fake hardcoded defaults
  const drafter = report.drafter || project.owner_name || '—';
  const partLeader = report.part_leader || '—';
  const groupLeader = report.group_leader || '—';

  const modelCode = report.model || project.model_id || '—';
  const defectDate = report.defect_date || (project.start_date ? project.start_date.substring(0, 10) : (project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'));
  const problemTitle = report.problem || project.title || '—';
  const defectLocation = report.defect_location || '—';
  const cnCode = report.cn || '—';
  const defectQty = report.defect_qty || '—';

  // Detail Report: 2 textareas (Symptoms & Analysis + Conclusion & Countermeasure)
  const symptomsAnalysis = report.symptoms_analysis || report.symptoms || '';
  const conclusionCountermeasure = report.conclusion_countermeasure || report.countermeasure || '';
  const hasDetailContent = !!(symptomsAnalysis.trim() || conclusionCountermeasure.trim());

  const handlePrint = (e) => {
    e.stopPropagation();
    window.print();
  };

  return (
    <div className={styles.reportCardWrapper}>
      {/* Collapsible Card Header Bar */}
      <div
        className={styles.reportCardHeader}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className={styles.headerTitleGroup}>
          <FileText size={16} className={styles.headerIcon} />
          <span className={styles.headerTitle}>
            Format OQC Technical Report (SEIN MX Product Engineering)
          </span>
          <span className={styles.headerBadge}>Standard ISO/OQC</span>
        </div>

        <div className={styles.headerActions}>
          {onEdit && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit dan perbarui data Technical Report ini"
            >
              <Edit3 size={13} />
              <span>Edit Laporan</span>
            </button>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handlePrint}
            title="Cetak atau Simpan PDF Laporan Teknis"
          >
            <Printer size={13} />
            <span>Cetak / PDF</span>
          </button>
          <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Main Report Body Sheet */}
      {isExpanded && (
        <div className={styles.reportContentBody}>
          <div className={styles.reportSheet}>
            {/* Top Corporate Document Header */}
            <div className={styles.sheetTopHeader}>
              <div className={styles.docMainTitle}>
                SEIN MX Product Engineering – TECHNICAL REPORT
              </div>
            </div>

            {/* Banner 1: OQC TECHNICAL REPORT */}
            <div className={styles.sectionBanner}>
              OQC TECHNICAL REPORT
            </div>

            {/* Approval & Sign-Off Header Table */}
            <table className={styles.engTable}>
              <tbody>
                <tr>
                  <td className={styles.headerCell} style={{ width: '12%' }}>Drafter</td>
                  <td className={styles.valueCell} style={{ width: '22%', fontWeight: 600 }}>{drafter}</td>
                  <td className={styles.headerCell} style={{ width: '14%' }}>Part Leader</td>
                  <td className={styles.valueCell} style={{ width: '20%', fontWeight: 600 }}>{partLeader}</td>
                  <td className={styles.headerCell} style={{ width: '14%' }}>Group Leader</td>
                  <td className={styles.valueCell} style={{ width: '18%', fontWeight: 600 }}>{groupLeader}</td>
                </tr>
              </tbody>
            </table>

            {/* Banner 2: PROBLEM INFORMATION */}
            <div className={styles.sectionBanner}>
              PROBLEM INFORMATION
            </div>

            {/* Problem Information Grid Table */}
            <table className={styles.engTable}>
              <tbody>
                <tr>
                  <td className={styles.headerCell} style={{ width: '12%' }}>Model</td>
                  <td className={styles.valueCell} style={{ width: '38%', fontWeight: 700 }}>{modelCode}</td>
                  <td className={styles.headerCell} style={{ width: '16%' }}>Defect date</td>
                  <td className={styles.valueCell} style={{ width: '34%' }}>{defectDate}</td>
                </tr>
                <tr>
                  <td className={styles.headerCell}>Problem</td>
                  <td className={styles.valueCell} style={{ fontWeight: 600, color: '#dc2626' }}>{problemTitle}</td>
                  <td className={styles.headerCell}>Defect location</td>
                  <td className={styles.valueCell}>{defectLocation}</td>
                </tr>
                <tr>
                  <td className={styles.headerCell}>CN</td>
                  <td className={styles.valueCell}>{cnCode}</td>
                  <td className={styles.headerCell}>Defect Qty</td>
                  <td className={styles.valueCell} style={{ fontWeight: 700 }}>{defectQty}</td>
                </tr>
              </tbody>
            </table>

            {/* Banner 3: DETAIL REPORT */}
            <div className={styles.sectionBanner}>
              DETAIL REPORT
            </div>

            {/* Detail Report Rendering with Dynamic Column Layout */}
            {!hasDetailContent ? (
              <div className={styles.emptyDetailNotice}>
                <span>Format Detail Report belum diisi oleh PIC. Klik tombol Edit Laporan untuk mengisi analisis gejala, tabel pengukuran, dan countermeasure.</span>
                {onEdit && (
                  <button type="button" className={styles.editReportBtn} onClick={onEdit}>
                    <Edit3 size={13} />
                    <span>Lengkapi Detail Report Sekarang</span>
                  </button>
                )}
              </div>
            ) : symptomsAnalysis.trim() && conclusionCountermeasure.trim() ? (
              /* Both columns filled: 2-column split side-by-side */
              <div className={styles.detailGrid}>
                {/* Column 1: Symptoms & Technical Analysis */}
                <div className={styles.detailColLeft}>
                  <h4 className={styles.subSectionTitle}>Symptoms & Analysis</h4>
                  <RichNotesViewer content={symptomsAnalysis} />
                </div>

                {/* Column 2: Conclusion & Action Countermeasures */}
                <div className={styles.detailColRight}>
                  <h4 className={styles.subSectionTitle}>Conclusion & Action Countermeasure</h4>
                  <RichNotesViewer content={conclusionCountermeasure} />
                </div>
              </div>
            ) : symptomsAnalysis.trim() ? (
              /* Only Column 1 filled: Full width */
              <div className={styles.detailColSingle}>
                <h4 className={styles.subSectionTitle}>Symptoms & Analysis</h4>
                <RichNotesViewer content={symptomsAnalysis} />
              </div>
            ) : (
              /* Only Column 2 filled: Full width */
              <div className={styles.detailColSingle}>
                <h4 className={styles.subSectionTitle}>Conclusion & Action Countermeasure</h4>
                <RichNotesViewer content={conclusionCountermeasure} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
