import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  BarChart2,
  Edit2,
  Filter,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import styles from './GmesMonitoringPage.module.css';

const PROCESSES = [
  'ALL',
  'VISUAL F/T(L)',
  'CAMERA MAIN F/T',
  'RF CAL LTE',
  'FINAL LTE'
];

export const GmesMonitoringPage = () => {
  const { t } = useTranslation();

  const [activeProcess, setActiveProcess] = useState('ALL');
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Auto switch logic
  const [isAutoSwitch, setIsAutoSwitch] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const autoSwitchRef = useRef(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState('worst_list'); // 'worst_list' | 'telemetry'
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [modalForm, setModalForm] = useState({
    process: 'VISUAL F/T(L)',
    line_name: 'Line 01',
    model: 'SM-S928B',
    test_item: '',
    share: '15.0%',
    fail_qty: 10,
    status: 'OPEN',
    pic: '',
    countermeasure: ''
  });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const params = {};
      if (activeProcess !== 'ALL') params.process = activeProcess;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/gmes/issues', { params });
      setIssues(res.data?.items || []);
    } catch (err) {
      console.error('Error fetching GMES issues:', err);
    }
  }, [activeProcess, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/gmes/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching GMES stats:', err);
    }
  }, []);

  const fetchMeasurements = useCallback(async () => {
    try {
      const params = {};
      if (activeProcess !== 'ALL') params.process = activeProcess;
      const res = await api.get('/gmes/measurements', { params });
      setMeasurements(res.data?.items || []);
    } catch (err) {
      console.error('Error fetching GMES measurements:', err);
    }
  }, [activeProcess]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchIssues(), fetchStats(), fetchMeasurements()]);
    setLoading(false);
  }, [fetchIssues, fetchStats, fetchMeasurements]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auto switch tab interval
  useEffect(() => {
    if (!isAutoSwitch) {
      if (autoSwitchRef.current) clearInterval(autoSwitchRef.current);
      setCountdown(6);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Switch to next tab
          setActiveProcess((curr) => {
            const currentIdx = PROCESSES.indexOf(curr);
            const nextIdx = (currentIdx + 1) % PROCESSES.length;
            return PROCESSES[nextIdx];
          });
          return 6;
        }
        return prev - 1;
      });
    }, 1000);

    autoSwitchRef.current = interval;
    return () => clearInterval(interval);
  }, [isAutoSwitch]);

  const toggleAutoSwitch = () => {
    setIsAutoSwitch((prev) => !prev);
  };

  const handleOpenCreateModal = () => {
    setModalForm({
      process: activeProcess !== 'ALL' ? activeProcess : 'VISUAL F/T(L)',
      line_name: 'Line 01',
      model: 'SM-S928B',
      test_item: '',
      share: '10.0%',
      fail_qty: 5,
      status: 'OPEN',
      pic: '',
      countermeasure: ''
    });
    setSubmitError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (issue) => {
    setSelectedIssue(issue);
    setModalForm({
      process: issue.process,
      line_name: issue.line_name,
      model: issue.model,
      test_item: issue.test_item,
      share: issue.share,
      fail_qty: issue.fail_qty,
      status: issue.status,
      pic: issue.pic,
      countermeasure: issue.countermeasure
    });
    setSubmitError('');
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!modalForm.test_item) {
      setSubmitError('Nama Test Item tidak boleh kosong');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/gmes/issues', modalForm);
      setIsCreateModalOpen(false);
      loadAllData();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Gagal menambahkan issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setSubmitting(true);
    try {
      await api.put(`/gmes/issues/${selectedIssue.id}`, modalForm);
      setIsEditModalOpen(false);
      loadAllData();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Gagal memperbarui issue');
    } finally {
      setSubmitting(false);
    }
  };

  const getProcessColor = (process) => {
    switch (process) {
      case 'VISUAL F/T(L)':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'CAMERA MAIN F/T':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'RF CAL LTE':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'FINAL LTE':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'OPEN':
        return styles.badgeOpen;
      case 'INVESTIGATING':
        return styles.badgeInvestigating;
      case 'ACTION_TAKEN':
        return styles.badgeAction;
      case 'RESOLVED':
        return styles.badgeResolved;
      default:
        return styles.badgeOpen;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <Activity className="text-blue-500" size={26} />
            {t('gmes.title', 'GMES Production Line Issue Monitoring')}
          </h1>
          <p className={styles.subtitle}>
            {t('gmes.subtitle', 'Real-time production line worst defect items & station failure analytics')}
          </p>
        </div>

        <div className={styles.headerActions}>
          {/* Auto Cycle Button (Play/Pause) */}
          <button
            type="button"
            className={`${styles.cycleButton} ${isAutoSwitch ? styles.cycleActive : styles.cyclePaused}`}
            onClick={toggleAutoSwitch}
            title={isAutoSwitch ? 'Pause Auto Cycle' : 'Start Auto Cycle'}
          >
            {isAutoSwitch ? (
              <>
                <Pause size={16} />
                <span>Pause Auto Cycle ({countdown}s)</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Start Auto Cycle</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={loadAllData}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} />
            <span>Laporkan Issue Line</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Defect Units</span>
            <span className={styles.kpiValue}>{stats ? stats.total_fail_qty.toLocaleString() : '0'}</span>
            <span className={styles.kpiSub}>Across all active lines</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Active Open Issues</span>
            <span className={styles.kpiValue}>{stats ? stats.active_issues : '0'}</span>
            <span className={styles.kpiSub}>Requires action / investigation</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <BarChart2 size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Top Defect Process</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.15rem' }}>{stats?.worst_process || '-'}</span>
            <span className={styles.kpiSub}>Highest fail contribution</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Layers size={24} />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Most Impacted Line</span>
            <span className={styles.kpiValue}>{stats?.worst_line || '-'}</span>
            <span className={styles.kpiSub}>Assembly Line bottleneck</span>
          </div>
        </div>
      </div>

      {/* Process Tabs */}
      <div className={styles.tabsContainer}>
        {PROCESSES.map((proc) => {
          const isActive = activeProcess === proc;
          return (
            <button
              key={proc}
              type="button"
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveProcess(proc);
                if (isAutoSwitch) setIsAutoSwitch(false); // Stop auto switch on manual click
              }}
            >
              {proc === 'ALL' && <Layers size={16} />}
              {proc === 'VISUAL F/T(L)' && <Cpu size={16} />}
              {proc === 'CAMERA MAIN F/T' && <Activity size={16} />}
              {proc === 'RF CAL LTE' && <BarChart2 size={16} />}
              {proc === 'FINAL LTE' && <CheckCircle2 size={16} />}
              {proc}
              {stats?.process_counts?.[proc] !== undefined && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  background: isActive ? 'var(--primary, #3b82f6)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff'
                }}>
                  {stats.process_counts[proc]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View Switch: Worst List vs Telemetry History */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTabSub('worst_list')}
          className={`${styles.tabBtn} ${activeTabSub === 'worst_list' ? styles.tabBtnActive : ''}`}
          style={{ borderRadius: '6px' }}
        >
          <AlertTriangle size={15} />
          Daftar Worst Defect ({issues.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTabSub('telemetry')}
          className={`${styles.tabBtn} ${activeTabSub === 'telemetry' ? styles.tabBtnActive : ''}`}
          style={{ borderRadius: '6px' }}
        >
          <FileSpreadsheet size={15} />
          Riwayat Pengukuran Station ({measurements.length})
        </button>
      </div>

      {/* Main Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            {activeTabSub === 'worst_list' ? (
              <>
                <AlertTriangle size={18} className="text-amber-500" />
                Worst List Issues — {activeProcess}
              </>
            ) : (
              <>
                <FileSpreadsheet size={18} className="text-blue-500" />
                Measurement Telemetry History — {activeProcess}
              </>
            )}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeTabSub === 'worst_list' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                  color: 'inherit',
                  fontSize: '0.85rem'
                }}
              >
                <option value="ALL">Semua Status</option>
                <option value="OPEN">OPEN</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="ACTION_TAKEN">ACTION_TAKEN</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            )}

            <div className={styles.searchBox}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari item / PIC / line..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab 1: Worst Defect List */}
        {activeTabSub === 'worst_list' && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Rank</th>
                  <th>Process</th>
                  <th>Line</th>
                  <th>Model</th>
                  <th>Test Item / Defect</th>
                  <th style={{ width: '180px' }}>Share % & Fail Qty</th>
                  <th>Status</th>
                  <th>PIC & Tindakan / Countermeasure</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                      Memuat data GMES...
                    </td>
                  </tr>
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Tidak ada issue defect untuk proses ini.
                    </td>
                  </tr>
                ) : (
                  issues.map((issue, idx) => {
                    const procStyle = getProcessColor(issue.process);
                    return (
                      <tr key={issue.id}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? '#ef4444' : 'inherit' }}>
                          #{idx + 1}
                        </td>
                        <td>
                          <span
                            className={styles.processTag}
                            style={{
                              background: procStyle.bg,
                              color: procStyle.text,
                              border: `1px solid ${procStyle.border}`
                            }}
                          >
                            {issue.process}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{issue.line_name}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{issue.model}</td>
                        <td style={{ fontWeight: 600 }}>{issue.test_item}</td>
                        <td>
                          <div className={styles.shareBarWrapper}>
                            <div className={styles.shareBarBg}>
                              <div
                                className={styles.shareBarFill}
                                style={{ width: issue.share }}
                              />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '45px' }}>
                              {issue.share}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              ({issue.fail_qty} pcs)
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${getStatusBadgeClass(issue.status)}`}>
                            {issue.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {issue.pic || 'Belum ada PIC'}
                            </span>
                            <span className={styles.countermeasureText} title={issue.countermeasure}>
                              {issue.countermeasure || 'Belum ada tindakan tercatat'}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(issue)}
                            className={styles.secondaryButton}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Update Tindakan"
                          >
                            <Edit2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Measurement Telemetry History */}
        {activeTabSub === 'telemetry' && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Process</th>
                  <th>Line</th>
                  <th>Model</th>
                  <th>SN (Serial Number)</th>
                  <th>Port / Station</th>
                  <th>Test Item</th>
                  <th>LSL</th>
                  <th>Measure Value</th>
                  <th>USL</th>
                  <th>Equip No</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {measurements.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Tidak ada riwayat pengukuran untuk proses ini.
                    </td>
                  </tr>
                ) : (
                  measurements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.test_time || new Date(m.created_at).toLocaleTimeString()}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{m.process}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.line_name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{m.model}</td>
                      <td style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{m.sn}</td>
                      <td>{m.port}</td>
                      <td style={{ fontWeight: 600 }}>{m.test_item}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.measure_lsl || '-'}</td>
                      <td style={{ fontWeight: 700, color: '#f87171' }}>{m.measure_value}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.measure_usl || '-'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{m.equip_no}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.remark}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Issue Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Laporkan Issue Baru GMES Line"
        maxWidth="640px"
      >
        <form onSubmit={handleCreateSubmit}>
          {submitError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Proses Produksi</label>
              <select
                value={modalForm.process}
                onChange={(e) => setModalForm({ ...modalForm, process: e.target.value })}
              >
                <option value="VISUAL F/T(L)">VISUAL F/T(L)</option>
                <option value="CAMERA MAIN F/T">CAMERA MAIN F/T</option>
                <option value="RF CAL LTE">RF CAL LTE</option>
                <option value="FINAL LTE">FINAL LTE</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Nama Line</label>
              <input
                type="text"
                value={modalForm.line_name}
                onChange={(e) => setModalForm({ ...modalForm, line_name: e.target.value })}
                placeholder="Contoh: Line 02"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Model Perangkat</label>
              <input
                type="text"
                value={modalForm.model}
                onChange={(e) => setModalForm({ ...modalForm, model: e.target.value })}
                placeholder="Contoh: SM-S928B"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fail Qty (Unit)</label>
              <input
                type="number"
                value={modalForm.fail_qty}
                onChange={(e) => setModalForm({ ...modalForm, fail_qty: parseInt(e.target.value, 10) || 0 })}
                min="1"
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Test Item / Defect Name</label>
            <input
              type="text"
              value={modalForm.test_item}
              onChange={(e) => setModalForm({ ...modalForm, test_item: e.target.value })}
              placeholder="Contoh: Main Camera OIS Tilt Fail"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Share Defect (%)</label>
              <input
                type="text"
                value={modalForm.share}
                onChange={(e) => setModalForm({ ...modalForm, share: e.target.value })}
                placeholder="Contoh: 24.5%"
              />
            </div>

            <div className={styles.formGroup}>
              <label>PIC Engineer</label>
              <input
                type="text"
                value={modalForm.pic}
                onChange={(e) => setModalForm({ ...modalForm, pic: e.target.value })}
                placeholder="Nama PIC penanggung jawab"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Tindakan Perbaikan / Countermeasure</label>
            <textarea
              rows={3}
              value={modalForm.countermeasure}
              onChange={(e) => setModalForm({ ...modalForm, countermeasure: e.target.value })}
              placeholder="Deskripsi langkah investigasi dan tindakan korektif..."
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan...' : 'Simpan Issue'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Issue Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Update Tindakan Issue #${selectedIssue?.id} (${selectedIssue?.line_name} - ${selectedIssue?.model})`}
        maxWidth="640px"
      >
        <form onSubmit={handleEditSubmit}>
          {submitError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              {submitError}
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Test Item / Defect</label>
            <input
              type="text"
              value={modalForm.test_item}
              onChange={(e) => setModalForm({ ...modalForm, test_item: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Status Issue</label>
              <select
                value={modalForm.status}
                onChange={(e) => setModalForm({ ...modalForm, status: e.target.value })}
              >
                <option value="OPEN">OPEN</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="ACTION_TAKEN">ACTION_TAKEN</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>PIC Engineer</label>
              <input
                type="text"
                value={modalForm.pic}
                onChange={(e) => setModalForm({ ...modalForm, pic: e.target.value })}
                placeholder="PIC penanggung jawab"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Tindakan Perbaikan / Countermeasure</label>
            <textarea
              rows={4}
              value={modalForm.countermeasure}
              onChange={(e) => setModalForm({ ...modalForm, countermeasure: e.target.value })}
              placeholder="Catatan update investigasi dan perbaikan station/part..."
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? 'Memperbarui...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
