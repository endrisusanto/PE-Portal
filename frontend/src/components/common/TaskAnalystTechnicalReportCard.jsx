// TaskAnalystTechnicalReportCard.jsx
// Renders the SEIN MX Product Engineering - OQC Technical Report format for Task Analyst
import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Printer,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import styles from './TaskAnalystTechnicalReportCard.module.css';

export const TaskAnalystTechnicalReportCard = ({ project = {} }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Safely extract metadata report if stored, otherwise default to user's exact report specs
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

  // Report fields with graceful fallbacks to the provided SEIN MX Technical Report
  const drafter = report.drafter || project.owner_name || 'Santono, Rifki Z';
  const partLeader = report.part_leader || 'Aulia AM';
  const groupLeader = report.group_leader || 'Hendra N.';

  const modelCode = report.model || project.model_id || 'SM-A276B';
  const defectDate = report.defect_date || (project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'July, 20, 2026');
  const problemTitle = report.problem || project.title || 'LTE B1,B2) TX POWER Fail';
  const defectLocation = report.defect_location || 'Main Line Production (Block6-3 07)';
  const cnCode = report.cn || '—';
  const defectQty = report.defect_qty || '14 ea';

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

            {/* 2-Column Split: Symptoms/Analysis vs Investigation/Countermeasure */}
            <div className={styles.detailGrid}>
              {/* LEFT COLUMN: Symptoms & Technical Analysis */}
              <div className={styles.detailColLeft}>
                <div>
                  <h4 className={styles.subSectionTitle}>Symptoms & Analysis</h4>
                  <ul className={styles.bulletList}>
                    <li className={styles.bulletItem}>
                      <strong>LTE B1,B2) TX POWER</strong> was happen in line production process.
                    </li>
                    <li className={styles.bulletItem}>
                      <strong>Actual Defect :</strong>
                      <div style={{ paddingLeft: '8px', marginTop: '4px' }}>
                        <div>Value : <strong>20.37</strong></div>
                        <div>Spec : <strong>[LSL] 20.66 ~ [USL] 22.66</strong></div>
                      </div>

                      {/* Mini Log Snapshot */}
                      <table className={styles.miniMatrixTable} style={{ width: '100%', marginTop: '6px' }}>
                        <thead>
                          <tr>
                            <th>Test Item</th>
                            <th>Mode</th>
                            <th>Value</th>
                            <th>LSL ~ USL</th>
                            <th>Judg.</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>TX_PWR_B1</td>
                            <td>MAX_PRX</td>
                            <td style={{ color: '#dc2626', fontWeight: 700 }}>20.37</td>
                            <td>20.66 ~ 22.66</td>
                            <td className={styles.statusNg}>FAIL</td>
                          </tr>
                          <tr>
                            <td>TX_PWR_B2</td>
                            <td>MAX_PRX</td>
                            <td style={{ color: '#dc2626', fontWeight: 700 }}>20.41</td>
                            <td>20.66 ~ 22.66</td>
                            <td className={styles.statusNg}>FAIL</td>
                          </tr>
                        </tbody>
                      </table>
                    </li>

                    <li className={styles.bulletItem}>
                      <strong>Swap MEA Front & Assy Main PBA</strong>
                      <div style={{ marginTop: '2px', color: '#1e3a8a', fontWeight: 600 }}>
                        ➔ The problem came from Assy Main PBA
                      </div>

                      {/* Swap Matrix Verification Table */}
                      <table className={styles.miniMatrixTable} style={{ width: '100%', marginTop: '4px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '38%', background: '#e2e8f0' }}></th>
                            <th style={{ width: '31%' }}>MEA Front OK</th>
                            <th style={{ width: '31%' }}>MEA Front NG</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 700, background: '#f8fafc' }}>Assy PBA OK</td>
                            <td className={styles.statusOk}>OK</td>
                            <td className={styles.statusOk}>OK</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 700, background: '#f8fafc' }}>Assy PBA NG</td>
                            <td className={styles.statusNg}>NG</td>
                            <td className={styles.statusNg}>NG</td>
                          </tr>
                        </tbody>
                      </table>
                    </li>

                    <li className={styles.bulletItem}>
                      <strong>Check Assy Main PBA condition :</strong>
                      <div style={{ paddingLeft: '4px', marginTop: '3px' }}>
                        <div>➔ Not found abnormalities (missing material, damage, etc)</div>
                        <div style={{ color: '#16a34a', fontWeight: 700 }}>
                          ➔ Swap Material PAM IC (PAM1002) ➔ OK (samples 3/3 OK)
                        </div>
                      </div>

                      {/* Visual PBA & Schematic Block Mockup */}
                      <div className={styles.visualPreviewBox}>
                        <div className={styles.pbaVisual} title="Main PBA Component Placement">
                          <div style={{ fontSize: '9px', marginBottom: '4px', opacity: 0.8 }}>MAIN PBA TOP</div>
                          <div className={styles.pbaHighlightBox}>
                            PAM1002 [IC]
                          </div>
                          <div style={{ fontSize: '8px', marginTop: '4px', opacity: 0.7 }}>Power Amp Module</div>
                        </div>

                        <div className={styles.schematicVisual} title="Circuit Schematic Excerpt">
                          <div style={{ color: '#2563eb', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                            PAM1002 PINOUT
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginTop: '4px' }}>
                            <div>1: RFOUT_LB1</div>
                            <div>8: VCC1</div>
                            <div>2: RFOUT_LB2</div>
                            <div>9: VBAT</div>
                            <div>3: RFOUT_LB3</div>
                            <div>10: SCLK</div>
                            <div>4: RFOUT_LB4</div>
                            <div>11: SDATA</div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* RIGHT COLUMN: Micro Inspection, Conclusion & Countermeasures */}
              <div className={styles.detailColRight}>
                {/* 1. Micro-Inspection LOT IC */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', marginBottom: '4px' }}>
                    ▪ Same LOT IC occurred to this issue.
                  </div>

                  <div className={styles.chipsContainer}>
                    <div className={styles.icChipBox}>
                      <div className={styles.icChipDot} />
                      <div className={styles.icChipLine1}>0663-11S</div>
                      <div className={styles.icChipLine2}>H0GH2545</div>
                      <div className={styles.icQrCode}>[#1]</div>
                    </div>
                    <div className={styles.icChipBox}>
                      <div className={styles.icChipDot} />
                      <div className={styles.icChipLine1}>0663-11S</div>
                      <div className={styles.icChipLine2}>H0GH2545</div>
                      <div className={styles.icQrCode}>[#2]</div>
                    </div>
                    <div className={styles.icChipBox}>
                      <div className={styles.icChipDot} />
                      <div className={styles.icChipLine1}>0663-11S</div>
                      <div className={styles.icChipLine2}>H0GH2545</div>
                      <div className={styles.icQrCode}>[#3]</div>
                    </div>
                  </div>
                </div>

                {/* 2. Conclusion */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', marginBottom: '4px' }}>
                    ▪ Conclusion
                  </div>
                  <div style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>
                      ➔ The problem occurs is came from Assy MPBA
                    </div>
                    <div style={{ color: '#1e3a8a', fontWeight: 700 }}>
                      ➔ Based on analysis, it’s related the PAM IC (PAM1002) after the new one can fixed.
                    </div>
                  </div>
                </div>

                {/* 3. Action & Countermeasure */}
                <div>
                  <h4 className={styles.subSectionTitle}>Action & Countermeasure</h4>
                  <ul className={styles.bulletList} style={{ gap: '4px' }}>
                    <li className={styles.bulletItem}>
                      Keep monitoring same problem with same case
                    </li>
                    <li className={styles.bulletItem}>
                      Share this issue to related dept.
                    </li>
                    <li className={styles.bulletItem}>
                      Need screening & separate defective IC
                    </li>
                    <li className={styles.bulletItem}>
                      <strong>Feedback the PAM IC to the maker for further analysis.</strong>
                      <div className={styles.countermeasureMeta}>
                        <div><strong>Part number:</strong> 1201-004509</div>
                        <div><strong>Description:</strong> IC-POWER AMP</div>
                        <div><strong>Maker:</strong> SMMIC</div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
