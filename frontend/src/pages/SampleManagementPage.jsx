import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PackageCheck,
  Boxes,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Plus,
  FileSpreadsheet,
  Trash2,
  Edit,
  Layers,
  ChevronRight,
  UserCheck,
  Smartphone,
  ShieldCheck,
  X,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { FormattingTextarea } from '../components/common/FormattingTextarea';
import { portalConfirm } from '../contexts/ConfirmContext';
import styles from './SampleManagementPage.module.css';

export const SampleManagementPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  // Active Tab: 'peminjaman' | 'matrix' | 'table'
  const [activeTab, setActiveTab] = useState('peminjaman');

  // Stats
  const [stats, setStats] = useState({
    total_samples: 0,
    borrowed: 0,
    available: 0,
    defects: 0,
    active_borrowers: 0
  });

  // Borrower Groups (Tab 1)
  const [borrowers, setBorrowers] = useState([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(false);

  // Model Matrix (Tab 2)
  const [matrixData, setMatrixData] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixFilter, setMatrixFilter] = useState('all'); // 'all', 'borrowed', 'ready', 'defects'
  const [matrixSearch, setMatrixSearch] = useState('');

  // Table Inventory (Tab 3)
  const [tableData, setTableData] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit] = useState(30);
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState('');
  const [tableCondition, setTableCondition] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  // Table Sorting State
  const [tableSortKey, setTableSortKey] = useState(null);
  const [tableSortDirection, setTableSortDirection] = useState(null);

  const handleTableSort = (key) => {
    if (tableSortKey === key) {
      if (tableSortDirection === 'asc') setTableSortDirection('desc');
      else if (tableSortDirection === 'desc') {
        setTableSortKey(null);
        setTableSortDirection(null);
      } else setTableSortDirection('asc');
    } else {
      setTableSortKey(key);
      setTableSortDirection('asc');
    }
  };

  const sortedTableData = useMemo(() => {
    if (!tableSortKey || !tableSortDirection || !tableData.length) return tableData;
    return [...tableData].sort((a, b) => {
      const valA = a[tableSortKey];
      const valB = b[tableSortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return tableSortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return tableSortDirection === 'asc'
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [tableData, tableSortKey, tableSortDirection]);

  // Scanner Form State
  const [scanAsset, setScanAsset] = useState('');
  const [scanBorrower, setScanBorrower] = useState(user?.username?.toUpperCase() || '');
  const [scanAction, setScanAction] = useState(''); // '' auto, 'PINJAM', 'KEMBALI'
  const [scanLoading, setScanLoading] = useState(false);
  const [scanAlert, setScanAlert] = useState(null);

  // Selected Borrower Modal State
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [borrowerModalOpen, setBorrowerModalOpen] = useState(false);
  const [selectedBorrowerAssets, setSelectedBorrowerAssets] = useState([]);

  // Selected Model Modal State (from Matrix)
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelModalOpen, setModelModalOpen] = useState(false);

  // Add / Edit Sample Modal State
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [editingSample, setEditingSample] = useState(null);
  const [sampleForm, setSampleForm] = useState({
    asset_number: '',
    model: '',
    serial_number: '',
    category: 'Engineering Sample',
    condition_status: 'Normal',
    location: 'Dynamics Building Lt 2 | PE Lab',
    pic_sample: '',
    notes: ''
  });

  // Bulk Import Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Initial Sync with user
  useEffect(() => {
    if (user?.username && !scanBorrower) {
      setScanBorrower(user.username.toUpperCase());
    }
  }, [user, scanBorrower]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/samples/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Fetch Borrower Cards
  const fetchBorrowers = useCallback(async () => {
    setLoadingBorrowers(true);
    try {
      const { data } = await api.get('/samples/borrowers');
      setBorrowers(data || []);
    } catch (err) {
      console.error('Failed to fetch borrowers:', err);
    } finally {
      setLoadingBorrowers(false);
    }
  }, []);

  // Fetch Model Matrix
  const fetchMatrix = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const url = matrixSearch
        ? `/samples/matrix?search=${encodeURIComponent(matrixSearch)}`
        : '/samples/matrix';
      const { data } = await api.get(url);
      setMatrixData(data || []);
    } catch (err) {
      console.error('Failed to fetch matrix:', err);
    } finally {
      setLoadingMatrix(false);
    }
  }, [matrixSearch]);

  // Fetch Table Inventory
  const fetchTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const params = {
        page: tablePage,
        limit: tableLimit
      };
      if (tableSearch) params.search = tableSearch;
      if (tableStatus) params.status_pinjam = tableStatus;
      if (tableCondition) params.condition = tableCondition;

      const { data } = await api.get('/samples', { params });
      setTableData(data.items || []);
      setTableTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch sample table:', err);
    } finally {
      setLoadingTable(false);
    }
  }, [tablePage, tableLimit, tableSearch, tableStatus, tableCondition]);

  // Load active tab data
  useEffect(() => {
    fetchStats();
    if (activeTab === 'peminjaman') fetchBorrowers();
    if (activeTab === 'matrix') fetchMatrix();
    if (activeTab === 'table') fetchTable();
  }, [activeTab, fetchStats, fetchBorrowers, fetchMatrix, fetchTable]);

  // Quick Barcode / Asset Scan handler
  const handleScanSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!scanAsset.trim()) return;

    setScanLoading(true);
    setScanAlert(null);

    try {
      const payload = {
        asset_number: scanAsset.trim(),
        borrower_name: scanBorrower.trim() || user?.username?.toUpperCase() || 'PE ENGINEER',
        action: scanAction
      };

      const { data } = await api.post('/samples/scan', payload);
      if (data.success) {
        setScanAlert({
          type: 'success',
          message: data.message || 'Transaksi berhasil disimpan',
          action: data.action,
          sample: data.sample
        });
        setScanAsset('');
        // Refresh all lists
        fetchStats();
        if (activeTab === 'peminjaman') fetchBorrowers();
        if (activeTab === 'matrix') fetchMatrix();
        if (activeTab === 'table') fetchTable();
      } else {
        setScanAlert({
          type: 'error',
          message: data.message || 'Gagal memproses transaksi sample'
        });
      }
    } catch (err) {
      setScanAlert({
        type: 'error',
        message: err.response?.data?.message || 'Koneksi gagal atau terjadi error internal'
      });
    } finally {
      setScanLoading(false);
    }
  };

  // Quick 1-click Return from Card
  const handleQuickReturn = async (assetNumber, borrowerName) => {
    try {
      const { data } = await api.post('/samples/scan', {
        asset_number: assetNumber,
        borrower_name: borrowerName,
        action: 'KEMBALI'
      });
      if (data.success) {
        fetchStats();
        fetchBorrowers();
        if (borrowerModalOpen && selectedBorrower) {
          setSelectedBorrower(prev => ({
            ...prev,
            count: prev.count - 1,
            items: prev.items.filter(i => i.asset_number !== assetNumber)
          }));
        }
      }
    } catch (err) {
      console.error('Quick return error:', err);
    }
  };

  // Bulk Return from Borrower Modal
  const handleExecuteBulkReturn = async () => {
    if (!selectedBorrower || selectedBorrowerAssets.length === 0) return;
    try {
      const { data } = await api.post('/samples/bulk-return', {
        borrower_name: selectedBorrower.borrower_name,
        assets: selectedBorrowerAssets
      });
      if (data.success) {
        setBorrowerModalOpen(false);
        setSelectedBorrowerAssets([]);
        fetchStats();
        fetchBorrowers();
      }
    } catch (err) {
      console.error('Bulk return error:', err);
    }
  };

  // Open Borrower Modal
  const handleOpenBorrowerModal = (borrower) => {
    setSelectedBorrower(borrower);
    setSelectedBorrowerAssets(borrower.items.map(i => i.asset_number));
    setBorrowerModalOpen(true);
  };

  // Filtered Matrix Data
  const filteredMatrix = useMemo(() => {
    return matrixData.filter(m => {
      if (matrixFilter === 'borrowed') return m.borrowed > 0;
      if (matrixFilter === 'ready') return m.borrowed === 0;
      if (matrixFilter === 'defects') return m.defects > 0;
      return true;
    });
  }, [matrixData, matrixFilter]);

  // Open Model Detail Modal
  const handleOpenModelModal = (card) => {
    setSelectedModel(card);
    setModelModalOpen(true);
  };

  // Handle Add/Edit Sample Form Submit
  const handleSampleFormSubmit = async (e) => {
    e.preventDefault();
    if (!sampleForm.asset_number || !sampleForm.model) return;

    try {
      if (editingSample) {
        await api.put(`/samples/${editingSample.id}`, sampleForm);
      } else {
        await api.post('/samples', sampleForm);
      }

      setSampleModalOpen(false);
      setEditingSample(null);
      fetchStats();
      fetchTable();
      if (activeTab === 'matrix') fetchMatrix();
    } catch (err) {
      console.error('Save sample error:', err);
    }
  };

  // Open Edit Sample Modal
  const handleOpenEditSample = (sample) => {
    setEditingSample(sample);
    setSampleForm({
      asset_number: sample.asset_number,
      model: sample.model,
      serial_number: sample.serial_number || '',
      category: sample.category || 'Engineering Sample',
      condition_status: sample.condition_status || 'Normal',
      location: sample.location || '',
      pic_sample: sample.pic_sample || '',
      notes: sample.notes || ''
    });
    setSampleModalOpen(true);
  };

  // Delete Sample
  const handleDeleteSample = async (id) => {
    if (!await portalConfirm({
      title: 'Hapus Data Sample',
      message: 'Yakin ingin menghapus sample ini? Data sample yang dihapus tidak dapat dikembalikan.',
      confirmText: 'Hapus',
      variant: 'danger',
    })) return;
    try {
      await api.delete(`/samples/${id}`);
      fetchStats();
      fetchTable();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Parse Bulk TSV Text
  const handleParseBulk = (text) => {
    setBulkText(text);
    if (!text.trim()) {
      setBulkParsed([]);
      return;
    }

    const lines = text.trim().split('\n');
    const parsed = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split('\t').map(c => c.trim());

      // If header row, skip
      if (i === 0 && (cols[0].toLowerCase().includes('model') || cols[0].toLowerCase().includes('asset'))) {
        continue;
      }

      if (cols.length >= 2) {
        parsed.push({
          model: cols[0],
          asset_number: cols[1],
          serial_number: cols[2] || '',
          category: cols[3] || 'Engineering Sample',
          condition_status: cols[4] || 'Normal',
          location: cols[5] || 'Dynamics Building Lt 2 | PE Lab'
        });
      } else if (cols.length === 1 && cols[0]) {
        parsed.push({
          model: 'SM-GENERIC',
          asset_number: cols[0],
          serial_number: '',
          category: 'Engineering Sample',
          condition_status: 'Normal',
          location: 'Dynamics Building Lt 2 | PE Lab'
        });
      }
    }

    setBulkParsed(parsed);
  };

  // Submit Bulk Import
  const handleBulkSubmit = async () => {
    if (bulkParsed.length === 0) return;
    setBulkSubmitting(true);
    try {
      await api.post('/samples/bulk', { samples: bulkParsed });
      setBulkModalOpen(false);
      setBulkText('');
      setBulkParsed([]);
      fetchStats();
      fetchTable();
      if (activeTab === 'matrix') fetchMatrix();
    } catch (err) {
      console.error('Bulk import error:', err);
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <PackageCheck size={26} color="var(--color-accent)" />
            {t('samples.title', 'Database Sample PE')}
          </h1>
          <p className={styles.subtitle}>
            {t('samples.subtitle', 'Sistem Inventaris, Pelacakan Peminjaman & Matriks Kondisi Sample Perangkat Engineering')}
          </p>
        </div>

        <div className={styles.topControls}>
          {/* View Tab Switcher */}
          <div className={styles.tabSwitcher}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'peminjaman' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('peminjaman')}
            >
              <Users size={15} />
              {t('samples.tab_borrowing', 'Status Peminjaman')}
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'matrix' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              <Boxes size={15} />
              Matrix Card View
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'table' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <FileSpreadsheet size={15} />
              Table View
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchStats();
              if (activeTab === 'peminjaman') fetchBorrowers();
              if (activeTab === 'matrix') fetchMatrix();
              if (activeTab === 'table') fetchTable();
            }}
          >
            <RefreshCw size={14} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Top KPI Bar */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('samples.kpi_total', 'Total Sample')}</span>
            <span className={styles.kpiValue} style={{ color: 'var(--color-text-primary)' }}>
              {stats.total_samples.toLocaleString()} Unit
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('samples.kpi_borrowed', 'Sedang Dipinjam')}</span>
            <span className={styles.kpiValue} style={{ color: '#f87171' }}>
              {stats.borrowed.toLocaleString()} Unit
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
            <Clock size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('samples.kpi_available', 'Tersedia (Ready)')}</span>
            <span className={styles.kpiValue} style={{ color: '#34d399' }}>
              {stats.available.toLocaleString()} Unit
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('samples.kpi_defects', 'Kondisi Defect / Perbaikan')}</span>
            <span className={styles.kpiValue} style={{ color: '#fbbf24' }}>
              {stats.defects.toLocaleString()} Unit
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* TAB 1: STATUS PEMINJAMAN */}
      {activeTab === 'peminjaman' && (
        <>
          {/* Quick Barcode Scanner Form */}
          <div className={styles.scannerCard}>
            <div className={styles.scannerHeader}>
              <span className={styles.scannerTitle}>
                <PackageCheck size={18} color="var(--color-accent)" />
                {t('samples.scan_header', 'Scan / Input Peminjaman & Pengembalian Sample')}
              </span>
              <span className={styles.userBadge}>
                <UserCheck size={14} />
                User: {user?.username?.toUpperCase() || 'PE ENGINEER'}
              </span>
            </div>

            <form onSubmit={handleScanSubmit} className={styles.scanForm}>
              {/* Borrower Name */}
              <div className={styles.inputGroup}>
                <UserCheck size={16} color="var(--color-text-muted)" />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder={t('samples.borrower_placeholder', 'Nama Peminjam / PIC...')}
                  value={scanBorrower}
                  onChange={(e) => setScanBorrower(e.target.value)}
                  required
                />
              </div>

              {/* Asset Barcode */}
              <div className={styles.inputGroup}>
                <Smartphone size={16} color="var(--color-accent)" />
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder={t('samples.scan_placeholder', 'Scan No. Asset / Serial (misal: AS10001)...')}
                  value={scanAsset}
                  onChange={(e) => setScanAsset(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Action Mode */}
              <select
                className={styles.scanSelect}
                value={scanAction}
                onChange={(e) => setScanAction(e.target.value)}
              >
                <option value="">{t('samples.scan_auto', 'Auto Toggle (Pinjam / Kembali)')}</option>
                <option value="PINJAM">{t('samples.scan_force_borrow', 'Paksa Status PINJAM')}</option>
                <option value="KEMBALI">{t('samples.scan_force_return', 'Paksa Status KEMBALI')}</option>
              </select>

              {/* Submit */}
              <button type="submit" className={styles.btnSubmit} disabled={scanLoading}>
                {scanLoading ? <RefreshCw size={15} className="spin" /> : <RotateCcw size={15} />}
                {t('samples.submit_tx', 'Submit Transaksi')}
              </button>
            </form>

            {/* Alert Notification */}
            {scanAlert && (
              <div className={`${styles.alertBanner} ${scanAlert.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
                <span>{scanAlert.message}</span>
                <button
                  type="button"
                  onClick={() => setScanAlert(null)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Active Borrowers Card Section */}
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Users size={20} color="#f87171" />
              {t('samples.active_borrowers_title', 'Daftar Peminjam Aktif & Sample yang Sedang Dipinjam')}
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {borrowers.length} {t('samples.borrowers_count', 'PIC Meminjam Sample')}
            </span>
          </div>

          {loadingBorrowers ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              {t('common.loading', 'Memuat data kartu peminjaman...')}
            </div>
          ) : borrowers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              <CheckCircle2 size={36} color="#34d399" style={{ marginBottom: 8 }} />
              <p>{t('samples.all_available', 'Semua sample saat ini tersedia di rak / tidak ada peminjaman aktif.')}</p>
            </div>
          ) : (
            <div className={styles.borrowerGrid}>
              {borrowers.map((b) => (
                <div key={b.borrower_name} className={styles.borrowerCard}>
                  <div className={styles.borrowerCardHeader}>
                    <span className={styles.borrowerName}>
                      <UserCheck size={16} />
                      {b.borrower_name}
                    </span>
                    <span className={styles.borrowerCountBadge}>
                      {b.count} {t('samples.kpi_borrowed', 'Dipinjam')}
                    </span>
                  </div>

                  <div className={styles.borrowerCardBody}>
                    <table className={styles.denseTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t('samples.col_asset_no', 'No. Asset')}</th>
                          <th>{t('samples.col_model', 'Model')}</th>
                          <th>{t('common.time', 'Durasi')}</th>
                          <th style={{ textAlign: 'right' }}>{t('common.actions', 'Aksi')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.items.map((it, idx) => (
                          <tr key={it.id}>
                            <td style={{ color: 'var(--color-text-muted)', width: 24 }}>{idx + 1}</td>
                            <td>
                              <span className={styles.badgeMono}>{it.asset_number}</span>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{it.model}</td>
                            <td style={{ color: '#fbbf24', fontSize: 11 }}>{it.duration_formatted}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className={styles.btnReturnCard}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickReturn(it.asset_number, b.borrower_name);
                                }}
                                title={t('samples.btn_return', 'Kembalikan unit ini')}
                              >
                                {t('samples.btn_return', 'Return')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.borrowerCardFooter}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Total {b.count} unit aktif
                    </span>
                    <button
                      type="button"
                      className={styles.btnReturnCard}
                      onClick={() => handleOpenBorrowerModal(b)}
                    >
                      {t('samples.view_all_bulk_return', 'Lihat Semua & Bulk Return')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MATRIX CARD VIEW */}
      {activeTab === 'matrix' && (
        <>
          {/* Controls Bar */}
          <div className={styles.sectionHeader}>
            <div className={styles.chipFilterBar}>
              <button
                type="button"
                className={`${styles.chip} ${matrixFilter === 'all' ? styles.chipActive : ''}`}
                onClick={() => setMatrixFilter('all')}
              >
                {t('common.all_models', 'Semua Model')}
              </button>
              <button
                type="button"
                className={`${styles.chip} ${matrixFilter === 'borrowed' ? styles.chipActive : ''}`}
                onClick={() => setMatrixFilter('borrowed')}
              >
                {t('samples.filter_borrowed', 'Ada yang Dipinjam')}
              </button>
              <button
                type="button"
                className={`${styles.chip} ${matrixFilter === 'ready' ? styles.chipActive : ''}`}
                onClick={() => setMatrixFilter('ready')}
              >
                {t('samples.filter_ready', 'Semua Ready (Tersedia)')}
              </button>
              <button
                type="button"
                className={`${styles.chip} ${matrixFilter === 'defects' ? styles.chipActive : ''}`}
                onClick={() => setMatrixFilter('defects')}
              >
                {t('samples.filter_defects', 'Ada Defect')}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Cari model / serial..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {filteredMatrix.length} Model
              </span>
            </div>
          </div>

          {loadingMatrix ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              Memuat model matrix...
            </div>
          ) : filteredMatrix.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              Tidak ada model yang cocok dengan filter.
            </div>
          ) : (
            <div className={styles.matrixGrid}>
              {filteredMatrix.map((m) => (
                <div
                  key={m.model}
                  className={styles.matrixCard}
                  onClick={() => handleOpenModelModal(m)}
                  title="Klik untuk membuka detail unit model ini"
                >
                  <div className={styles.matrixCardHeader}>
                    <span className={styles.matrixModelTitle}>
                      <Smartphone size={15} color="var(--color-accent)" />
                      {m.model}
                    </span>
                    <div className={styles.badgeGroup}>
                      <span className={styles.badgeTotal}>{m.total} Unit</span>
                      {m.borrowed > 0 && (
                        <span className={styles.badgeBorrowed}>{m.borrowed} Pinjam</span>
                      )}
                      <span className={styles.badgeAvailable}>{m.available} Ready</span>
                    </div>
                  </div>

                  <div className={styles.matrixCardBody}>
                    <table className={styles.denseTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>No. Asset</th>
                          <th>Serial</th>
                          <th style={{ textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.items.slice(0, 6).map((it, idx) => (
                          <tr key={it.id}>
                            <td style={{ color: 'var(--color-text-muted)', width: 20 }}>{idx + 1}</td>
                            <td>
                              <span className={styles.badgeMono}>{it.asset_number}</span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{it.serial_number || '-'}</td>
                            <td style={{ textAlign: 'right' }}>
                              {it.status_pinjam === 'PINJAM' ? (
                                <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>
                                  PINJAM ({it.borrower_name?.split(' ')[0]})
                                </span>
                              ) : (
                                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                                  READY
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.matrixCardFooter}>
                    <span>
                      {m.items.length > 6 ? `+${m.items.length - 6} unit lainnya` : `${m.items.length} unit total`}
                    </span>
                    <span style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 2 }}>
                      Detail <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: TABLE VIEW */}
      {activeTab === 'table' && (
        <div className={styles.tableContainer}>
          <div className={styles.tableToolbar}>
            <div className={styles.tableFilters}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder={t('samples.search_table_placeholder', 'Cari asset, serial, model, peminjam...')}
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
              />

              <select
                className={styles.filterSelect}
                value={tableStatus}
                onChange={(e) => {
                  setTableStatus(e.target.value);
                  setTablePage(1);
                }}
              >
                <option value="">{t('common.all_status', 'Semua Status')}</option>
                <option value="AVAILABLE">{t('samples.available', 'Tersedia (Ready)')}</option>
                <option value="PINJAM">{t('samples.kpi_borrowed', 'Sedang Dipinjam')}</option>
              </select>

              <select
                className={styles.filterSelect}
                value={tableCondition}
                onChange={(e) => {
                  setTableCondition(e.target.value);
                  setTablePage(1);
                }}
              >
                <option value="">{t('samples.all_conditions', 'Semua Kondisi')}</option>
                <option value="Normal">{t('samples.normal_only', 'Normal Saja')}</option>
                <option value="Defect">{t('samples.kpi_defects', 'Ada Defect / Kerusakan')}</option>
              </select>
            </div>

            <div className={styles.tableActions}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingSample(null);
                  setSampleForm({
                    asset_number: '',
                    model: '',
                    serial_number: '',
                    category: 'Engineering Sample',
                    condition_status: 'Normal',
                    location: 'Dynamics Building Lt 2 | PE Lab',
                    pic_sample: '',
                    notes: ''
                  });
                  setSampleModalOpen(true);
                }}
              >
                <Plus size={14} />
                {t('samples.btn_add_sample', 'Tambah Sample')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkModalOpen(true)}
              >
                <FileSpreadsheet size={14} />
                {t('samples.btn_bulk_add', 'Bulk Add / TSV')}
              </Button>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.mainTable}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {[
                    { key: 'asset_number', label: t('samples.col_asset_no', 'No. Asset') },
                    { key: 'model', label: t('samples.col_model', 'Model') },
                    { key: 'serial_number', label: t('samples.col_serial_no', 'Serial Number') },
                    { key: 'status_pinjam', label: t('samples.col_loan_status', 'Status Pinjam') },
                    { key: 'condition_status', label: t('samples.col_condition', 'Kondisi Fisik') },
                    { key: 'location', label: t('samples.col_location', 'Lokasi') },
                    { key: 'pic_sample', label: t('samples.col_pic_sample', 'PIC Sample') },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleTableSort(col.key)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title={col.label}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{col.label}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {tableSortKey === col.key ? (
                            tableSortDirection === 'asc' ? (
                              <ArrowUp size={12} color="var(--color-accent)" />
                            ) : (
                              <ArrowDown size={12} color="var(--color-accent)" />
                            )
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>{t('common.actions', 'Aksi')}</th>
                </tr>
              </thead>
              <tbody>
                {loadingTable ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                      {t('common.loading', 'Memuat daftar sample...')}
                    </td>
                  </tr>
                ) : sortedTableData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                      {t('samples.empty_search', 'Tidak ada sample yang cocok dengan kriteria pencarian.')}
                    </td>
                  </tr>
                ) : (
                  sortedTableData.map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>
                        {(tablePage - 1) * tableLimit + idx + 1}
                      </td>
                      <td>
                        <span className={styles.badgeMono}>{s.asset_number}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.model}</td>
                      <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5 }}>
                        {s.serial_number || '-'}
                      </td>
                      <td>
                        {s.status_pinjam === 'PINJAM' ? (
                          <div className={styles.statusPillBorrowed}>
                            <Clock size={12} />
                            <span>{s.borrower_name} ({s.duration_formatted})</span>
                          </div>
                        ) : (
                          <div className={styles.statusPillAvailable}>
                            <CheckCircle2 size={12} />
                            <span>{t('samples.available', 'Tersedia (Ready)')}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {s.condition_status === 'Normal' || !s.condition_status ? (
                          <div className={styles.conditionBadgeNormal}>
                            <ShieldCheck size={13} />
                            <span>{t('samples.normal', 'Normal')}</span>
                          </div>
                        ) : (
                          <div className={styles.conditionBadgeDefect}>
                            <AlertTriangle size={13} />
                            <span>{s.condition_status}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                        {s.location || '-'}
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                        {s.pic_sample || '-'}
                      </td>
                      <td>
                        <div className={styles.actionCell} style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${s.status_pinjam === 'PINJAM' ? styles.btnKembaliToggle : styles.btnPinjamToggle}`}
                            onClick={() => {
                              const bName = s.status_pinjam === 'PINJAM' ? s.borrower_name : (user?.username?.toUpperCase() || 'PE ENGINEER');
                              handleQuickReturn(s.asset_number, bName);
                              fetchTable();
                            }}
                            title={s.status_pinjam === 'PINJAM' ? t('samples.btn_return', 'Kembalikan Sample') : t('samples.btn_borrow', 'Pinjam Sample')}
                          >
                            <RotateCcw size={12} />
                            {s.status_pinjam === 'PINJAM' ? t('samples.btn_return', 'Kembali') : t('samples.btn_borrow', 'Pinjam')}
                          </button>

                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnEdit}`}
                            onClick={() => handleOpenEditSample(s)}
                            title={t('common.edit', 'Edit Sample')}
                          >
                            <Edit size={12} />
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className={`${styles.btnAction} ${styles.btnDelete}`}
                              onClick={() => handleDeleteSample(s.id)}
                              title={t('common.delete', 'Hapus Sample')}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className={styles.pagination}>
            <span>
              {t('common.showing', 'Menampilkan')} {tableData.length} {t('common.of', 'dari')} {tableTotal} sample
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={tablePage <= 1}
                onClick={() => setTablePage(p => Math.max(1, p - 1))}
              >
                {t('common.prev', 'Sebelumnya')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={tablePage * tableLimit >= tableTotal}
                onClick={() => setTablePage(p => p + 1)}
              >
                {t('common.next', 'Selanjutnya')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BORROWER DETAIL & BULK RETURN */}
      <Modal
        isOpen={borrowerModalOpen}
        onClose={() => setBorrowerModalOpen(false)}
        title={`${t('samples.borrowed_detail', 'Detail Sample Dipinjam')}: ${selectedBorrower?.borrower_name || ''}`}
        maxWidth="min(960px, 92vw)"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {selectedBorrowerAssets.length} unit dipilih untuk dikembalikan
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setBorrowerModalOpen(false)}>
                {t('common.close', 'Tutup')}
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteBulkReturn}
                disabled={selectedBorrowerAssets.length === 0}
              >
                <RotateCcw size={14} />
                Kembalikan {selectedBorrowerAssets.length} Unit Terpilih
              </Button>
            </div>
          </div>
        }
      >
        {selectedBorrower && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Daftar unit yang sedang dipinjam:
              </span>
              <button
                type="button"
                className={styles.btnReturnCard}
                onClick={() => {
                  if (selectedBorrowerAssets.length === selectedBorrower.items.length) {
                    setSelectedBorrowerAssets([]);
                  } else {
                    setSelectedBorrowerAssets(selectedBorrower.items.map(i => i.asset_number));
                  }
                }}
              >
                {selectedBorrowerAssets.length === selectedBorrower.items.length ? t('common.deselect_all', 'Batal Pilih Semua') : t('common.select_all', 'Pilih Semua')}
              </button>
            </div>

            <table className={styles.denseTable}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>{t('common.select', 'Pilih')}</th>
                  <th>{t('samples.col_asset_no', 'No. Asset')}</th>
                  <th>{t('samples.col_model', 'Model')}</th>
                  <th>{t('samples.col_serial_no', 'Serial')}</th>
                  <th>{t('common.time', 'Durasi Pinjam')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.actions', 'Aksi Langsung')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedBorrower.items.map((it) => {
                  const isChecked = selectedBorrowerAssets.includes(it.asset_number);
                  return (
                    <tr key={it.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBorrowerAssets(prev => [...prev, it.asset_number]);
                            } else {
                              setSelectedBorrowerAssets(prev => prev.filter(a => a !== it.asset_number));
                            }
                          }}
                        />
                      </td>
                      <td><span className={styles.badgeMono}>{it.asset_number}</span></td>
                      <td style={{ fontWeight: 600 }}>{it.model}</td>
                      <td>{it.serial_number || '-'}</td>
                      <td style={{ color: '#fbbf24' }}>{it.duration_formatted}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={styles.btnReturnCard}
                          onClick={() => handleQuickReturn(it.asset_number, selectedBorrower.borrower_name)}
                        >
                          Kembalikan Unit Ini
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* MODAL 2: MODEL MATRIX DETAIL */}
      <Modal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        title={`Matriks Unit: ${selectedModel?.model || ''} (${selectedModel?.total || 0} Unit Total)`}
        maxWidth="min(1080px, 94vw)"
      >
        {selectedModel && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <span className={styles.badgeTotal}>{selectedModel.total} Total</span>
              <span className={styles.badgeAvailable}>{selectedModel.available} Tersedia (Ready)</span>
              {selectedModel.borrowed > 0 && (
                <span className={styles.badgeBorrowed}>{selectedModel.borrowed} Sedang Dipinjam</span>
              )}
              {selectedModel.defects > 0 && (
                <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                  {selectedModel.defects} Defect
                </span>
              )}
            </div>

            <table className={styles.denseTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('samples.col_asset_no', 'No. Asset')}</th>
                  <th>{t('samples.col_serial_no', 'Serial')}</th>
                  <th>IMEI / UN</th>
                  <th>{t('samples.col_loan_status', 'Status Pinjam')}</th>
                  <th>{t('samples.col_condition', 'Kondisi Fisik')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.actions', 'Aksi Cepat')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedModel.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                    <td><span className={styles.badgeMono}>{it.asset_number}</span></td>
                    <td style={{ fontWeight: 600 }}>{it.serial_number || '-'}</td>
                    <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>{it.imei || it.un_code || '-'}</td>
                    <td>
                      {it.status_pinjam === 'PINJAM' ? (
                        <span style={{ color: '#f87171', fontWeight: 600 }}>
                          PINJAM: {it.borrower_name} ({it.duration_formatted})
                        </span>
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>
                          TERSEDIA
                        </span>
                      )}
                    </td>
                    <td>
                      {it.condition_status === 'Normal' ? (
                        <span style={{ color: '#34d399' }}>🟢 Normal</span>
                      ) : (
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>⚠️ {it.condition_status}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`${styles.btnAction} ${it.status_pinjam === 'PINJAM' ? styles.btnKembaliToggle : styles.btnPinjamToggle}`}
                        onClick={async () => {
                          const action = it.status_pinjam === 'PINJAM' ? 'KEMBALI' : 'PINJAM';
                          const bName = it.status_pinjam === 'PINJAM' ? it.borrower_name : (user?.username?.toUpperCase() || 'PE ENGINEER');
                          await handleQuickReturn(it.asset_number, bName);
                          fetchStats();
                          fetchMatrix();
                          setSelectedModel(prev => ({
                            ...prev,
                            borrowed: action === 'KEMBALI' ? prev.borrowed - 1 : prev.borrowed + 1,
                            available: action === 'KEMBALI' ? prev.available + 1 : prev.available - 1,
                            items: prev.items.map(item => item.id === it.id ? {
                              ...item,
                              status_pinjam: action === 'KEMBALI' ? 'AVAILABLE' : 'PINJAM',
                              borrower_name: action === 'KEMBALI' ? '' : bName
                            } : item)
                          }));
                        }}
                      >
                        {it.status_pinjam === 'PINJAM' ? 'Kembalikan' : 'Pinjam'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* MODAL 3: TAMBAH / EDIT SAMPLE */}
      <Modal
        isOpen={sampleModalOpen}
        onClose={() => setSampleModalOpen(false)}
        title={editingSample ? `${t('common.edit', 'Edit')} Sample: ${editingSample.asset_number}` : t('samples.btn_add_sample', 'Tambah Sample Baru')}
        maxWidth="min(800px, 90vw)"
      >
        <form onSubmit={handleSampleFormSubmit} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.col_asset_no', 'Nomor Asset / Barcode')} *</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={t('samples.placeholder_asset_no', 'Contoh: AS10444 atau OF0007510')}
              value={sampleForm.asset_number}
              onChange={(e) => setSampleForm({ ...sampleForm, asset_number: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.col_model', 'Model Perangkat')} *</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={t('samples.placeholder_model', 'Contoh: SM-S928B, Galaxy A55...')}
              value={sampleForm.model}
              onChange={(e) => setSampleForm({ ...sampleForm, model: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.col_serial_no', 'Nomor Serial (SN)')}</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={t('samples.placeholder_serial', 'Contoh: R58M123456')}
              value={sampleForm.serial_number}
              onChange={(e) => setSampleForm({ ...sampleForm, serial_number: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.category', 'Kategori Sample')}</label>
            <select
              className={styles.formSelect}
              value={sampleForm.category}
              onChange={(e) => setSampleForm({ ...sampleForm, category: e.target.value })}
            >
              <option value="Engineering Sample">Engineering Sample</option>
              <option value="Commercial Unit">Commercial Unit</option>
              <option value="Fixture / Tooling">Fixture / Tooling</option>
              <option value="Lab Equipment">Lab Equipment</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.col_condition', 'Status Kondisi Fisik')}</label>
            <select
              className={styles.formSelect}
              value={sampleForm.condition_status}
              onChange={(e) => setSampleForm({ ...sampleForm, condition_status: e.target.value })}
            >
              <option value="Normal">🟢 {t('samples.normal', 'Normal')}</option>
              <option value="Defect (LCD / Layar Rusak)">🔴 Defect (LCD)</option>
              <option value="Defect (Baterai / Charging)">🔴 Defect (Battery)</option>
              <option value="Defect (Touchscreen)">🔴 Defect (Touchscreen)</option>
              <option value="Defect (Kamera)">🔴 Defect (Camera)</option>
              <option value="Defect (Mati Total / No Power)">🔴 Defect (No Power)</option>
              <option value="Scratch / Fisik Lecet / Casing Pecah">🟡 Scratch</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('samples.col_location', 'Lokasi Rak / Penyimpanan')}</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={t('samples.placeholder_location', 'Contoh: Dynamics Building Lt 2 | PE Lab Rak A1')}
              value={sampleForm.location}
              onChange={(e) => setSampleForm({ ...sampleForm, location: e.target.value })}
            />
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>{t('samples.col_pic_sample', 'PIC Sample / Pemilik')}</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={t('samples.placeholder_pic', 'Contoh: Endri Susanto, Apta Prana...')}
              value={sampleForm.pic_sample}
              onChange={(e) => setSampleForm({ ...sampleForm, pic_sample: e.target.value })}
            />
          </div>

          <div className={styles.formGroupFull}>
            <FormattingTextarea
              label={t('samples.col_notes', 'Catatan Tambahan')}
              rows={3}
              placeholder={t('samples.placeholder_notes', 'Keterangan kondisi khusus perangkat...')}
              value={sampleForm.notes}
              onChange={(e) => setSampleForm({ ...sampleForm, notes: e.target.value })}
              minHeight="90px"
            />
          </div>

          <div className={styles.formGroupFull} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setSampleModalOpen(false)}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button variant="primary" type="submit">
              {editingSample ? t('common.save', 'Simpan Perubahan') : t('samples.btn_add_sample', 'Tambah Sample')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: BULK TSV IMPORT */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Bulk Import Sample (Paste dari Excel / TSV)"
        maxWidth="min(980px, 94vw)"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {bulkParsed.length} baris sample siap diimpor
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setBulkModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkSubmit}
                disabled={bulkParsed.length === 0 || bulkSubmitting}
              >
                {bulkSubmitting ? 'Mengimpor...' : `Impor ${bulkParsed.length} Sample`}
              </Button>
            </div>
          </div>
        }
      >
        <div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Salin (Copy) tabel dari Excel atau TSV dengan format kolom: <strong>Model [Tab] No. Asset [Tab] Serial Number [Tab] Kategori [Tab] Kondisi</strong>.
          </p>

          <textarea
            className={styles.bulkTextarea}
            placeholder={`SM-S928B\tAS15001\tR58M001\tEngineering Sample\tNormal\nSM-A546E\tAS15002\tR58M002\tEngineering Sample\tDefect (LCD)`}
            value={bulkText}
            onChange={(e) => handleParseBulk(e.target.value)}
          />

          {bulkParsed.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Pratinjau Hasil Parsing ({bulkParsed.length} baris):
              </span>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className={styles.denseTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Model</th>
                      <th>No. Asset</th>
                      <th>Serial</th>
                      <th>Kondisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkParsed.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.model}</td>
                        <td><span className={styles.badgeMono}>{r.asset_number}</span></td>
                        <td>{r.serial_number || '-'}</td>
                        <td>{r.condition_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bulkParsed.length > 10 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                  +{bulkParsed.length - 10} baris lainnya akan ikut diimpor.
                </span>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
