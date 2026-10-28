import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet,
  Layers,
  Search,
  Plus,
  ClipboardPaste,
  Upload,
  Download,
  Bot,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  X,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Check,
  Loader2,
  Cpu,
  Boxes
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import styles from './EcnMonitoringPage.module.css';

export const EcnMonitoringPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  // --- Data State ---
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // --- Stats State ---
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    eco_cancel: 0,
    unique_models: 0,
    model_counts: {},
  });

  // --- Filter State ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');

  // --- Expanded Rows State ---
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // --- Modals State ---
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [parsedPasteRows, setParsedPasteRows] = useState([]);
  const [isImportingPaste, setIsImportingPaste] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDrmNotice, setUploadDrmNotice] = useState(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    ecn_no: '',
    model: '',
    function_type: 'Circuit',
    purpose: '',
    inventory_mgmt: '',
    process: 'SMD',
    ec_title: '',
    parent_code: '',
    parent_name: '',
    before_after: '',
    dl: '',
    child_code: '',
    child_name: '',
    specification: '',
    quantity: '',
    marking_point: '',
    running_date_bom: '',
    distribution_date: '',
    status: 'Pending',
    remark: '',
  });

  // --- AI Chatbot Drawer State ---
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo! Saya asisten AI spesialis **ECN Monitoring**. Saya dapat membantu menganalisis perubahan engineering, ringkasan model, status implementasi, dan catatan kendala material/supplier. Ada yang bisa saya bantu?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/ecn/stats');
      setStats(res.data);
    } catch (err) {
      console.warn('Failed to fetch ECN stats:', err);
    }
  }, []);

  // Fetch ECN Records List
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
        model: selectedModel,
        status: selectedStatus,
        process: selectedProcess,
        function_type: selectedFunction,
      };
      const res = await api.get('/ecn', { params });
      setRecords(res.data.records || []);
      setTotalRecords(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error('Failed to fetch ECN list:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedModel, selectedStatus, selectedProcess, selectedFunction]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Row Expand Toggle
  const toggleRowExpand = (id) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // --- TSV / Clipboard Paste Parsing (Bypass DRM) ---
  const handleParseClipboard = (text) => {
    setPasteRawText(text);
    if (!text.trim()) {
      setParsedPasteRows([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    // Detect header row or check if first row contains 'ECN' or 'MODEL'
    const firstLineCols = lines[0].split('\t');
    let startIdx = 0;
    let colMap = {};

    const normalizeHeader = (raw) => {
      const h = (raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (h.includes('ecn') || h.includes('ecnno')) return 'ecn_no';
      if (h === 'model' || h.includes('model')) return 'model';
      if (h.includes('function') || h.includes('type')) return 'function_type';
      if (h.includes('purpose')) return 'purpose';
      if (h.includes('inventory') || h.includes('mgmt')) return 'inventory_mgmt';
      if (h.includes('proses') || h.includes('process')) return 'process';
      if (h.includes('ectitle') || h.includes('title')) return 'ec_title';
      if (h.includes('parentcode')) return 'parent_code';
      if (h.includes('parentname')) return 'parent_name';
      if (h.includes('beforeafter') || h.includes('before')) return 'before_after';
      if (h === 'dl' || h === 'd_l') return 'dl';
      if (h.includes('childcode')) return 'child_code';
      if (h.includes('childname')) return 'child_name';
      if (h.includes('spec')) return 'specification';
      if (h.includes('qty') || h.includes('quantity')) return 'quantity';
      if (h.includes('marking')) return 'marking_point';
      if (h.includes('running') || h.includes('bom')) return 'running_date_bom';
      if (h.includes('dist')) return 'distribution_date';
      if (h.includes('status')) return 'status';
      if (h.includes('remark') || h.includes('note')) return 'remark';
      return null;
    };

    const isHeaderRow = firstLineCols.some((c) => {
      const k = normalizeHeader(c);
      return k === 'ecn_no' || k === 'model' || k === 'process';
    });

    if (isHeaderRow) {
      startIdx = 1;
      firstLineCols.forEach((col, i) => {
        const k = normalizeHeader(col);
        if (k) colMap[i] = k;
      });
    } else {
      // Positional fallback matching table order
      const defaultOrder = [
        'ecn_no', 'model', 'function_type', 'purpose', 'inventory_mgmt',
        'process', 'ec_title', 'parent_code', 'parent_name', 'before_after',
        'dl', 'child_code', 'child_name', 'specification', 'quantity',
        'marking_point', 'running_date_bom', 'distribution_date', 'status', 'remark'
      ];
      defaultOrder.forEach((k, i) => {
        colMap[i] = k;
      });
    }

    const parsed = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length === 0 || !cols.some((c) => c.trim())) continue;

      const row = {};
      cols.forEach((val, cIdx) => {
        const key = colMap[cIdx];
        if (key) {
          row[key] = val.trim();
        }
      });

      if (row.ecn_no || row.model || row.ec_title) {
        if (!row.status) row.status = 'Pending';
        parsed.push(row);
      }
    }

    setParsedPasteRows(parsed);
  };

  const handleCommitPaste = async () => {
    if (parsedPasteRows.length === 0) return;
    setIsImportingPaste(true);
    try {
      const res = await api.post('/ecn/bulk', { records: parsedPasteRows });
      alert(res.data.message || `Berhasil mengimpor ${parsedPasteRows.length} baris ECN.`);
      setIsPasteModalOpen(false);
      setPasteRawText('');
      setParsedPasteRows([]);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal menyimpan data import: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsImportingPaste(false);
    }
  };

  // --- Excel File Upload Handler ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadDrmNotice(null);

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setIsUploading(true);
    try {
      const res = await api.post('/ecn/parse-excel', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.is_drm) {
        setUploadDrmNotice(res.data.message);
      } else if (res.data?.success && Array.isArray(res.data?.records)) {
        const count = res.data.records.length;
        if (window.confirm(`File Excel berhasil diparsing! Ditemukan ${count} baris ECN. Simpan ke database sekarang?`)) {
          const bulkRes = await api.post('/ecn/bulk', { records: res.data.records });
          alert(bulkRes.data.message || `Berhasil menyimpan ${count} baris.`);
          setIsUploadModalOpen(false);
          setUploadFile(null);
          fetchRecords();
          fetchStats();
        }
      } else {
        alert(res.data?.error || 'Gagal membaca isi file Excel.');
      }
    } catch (err) {
      alert(`Gagal upload Excel: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Manual Entry Form Submit ---
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.ecn_no.trim()) {
      alert('ECN NO wajib diisi.');
      return;
    }

    try {
      if (editingItem?.id) {
        await api.put(`/ecn/${editingItem.id}`, formData);
      } else {
        await api.post('/ecn', formData);
      }
      setIsFormModalOpen(false);
      setEditingItem(null);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal menyimpan ECN: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setFormData({
      ecn_no: item.ecn_no || '',
      model: item.model || '',
      function_type: item.function_type || 'Circuit',
      purpose: item.purpose || '',
      inventory_mgmt: item.inventory_mgmt || '',
      process: item.process || 'SMD',
      ec_title: item.ec_title || '',
      parent_code: item.parent_code || '',
      parent_name: item.parent_name || '',
      before_after: item.before_after || '',
      dl: item.dl || '',
      child_code: item.child_code || '',
      child_name: item.child_name || '',
      specification: item.specification || '',
      quantity: item.quantity || '',
      marking_point: item.marking_point || '',
      running_date_bom: item.running_date_bom || '',
      distribution_date: item.distribution_date || '',
      status: item.status || 'Pending',
      remark: item.remark || '',
    });
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = async (id, ecnNo) => {
    if (!window.confirm(`Yakin ingin menghapus ECN ${ecnNo}?`)) return;
    try {
      await api.delete(`/ecn/${id}`);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal menghapus ECN: ${err.message}`);
    }
  };

  // --- Export Clean CSV ---
  const handleExportCSV = () => {
    if (records.length === 0) {
      alert('Tidak ada data ECN untuk diekspor.');
      return;
    }

    const headers = [
      'ECN NO', 'MODEL', 'Function Type', 'Purpose', 'Inventory Management',
      'Proses', 'EC Title', 'PARENT CODE', 'PARENT NAME', 'Before After',
      'D/L', 'CHILD CODE', 'CHILD NAME', 'SPECIFICATION', 'Quantity',
      'Marking point', 'Running Date BOM', 'Distribution Date', 'Status', 'Remark'
    ];

    const csvRows = [headers.join(',')];
    records.forEach((r) => {
      const vals = [
        r.ecn_no, r.model, r.function_type, r.purpose, r.inventory_mgmt,
        r.process, r.ec_title, r.parent_code, r.parent_name, r.before_after,
        r.dl, r.child_code, r.child_name, r.specification, r.quantity,
        r.marking_point, r.running_date_bom, r.distribution_date, r.status, r.remark
      ].map((v) => `"${(v || '').replace(/"/g, '""')}"`);
      csvRows.push(vals.join(','));
    });

    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECN_Monitoring_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- AI Chatbot Message Handler ---
  const handleSendAiMessage = async (customPrompt) => {
    const text = (customPrompt || chatInput).trim();
    if (!text || isAiThinking) return;

    const userMsg = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsAiThinking(true);

    try {
      // Build compact context from currently active records
      const contextSummary = records.slice(0, 40).map((r) => ({
        ecn: r.ecn_no,
        model: r.model,
        process: r.process,
        func: r.function_type,
        status: r.status,
        title: r.ec_title,
        bom_date: r.running_date_bom,
        remark: r.remark,
      }));

      const systemPrompt = `Anda adalah asisten AI Production Engineering (PE) spesialis ECN Monitoring di PT Samsung Electronics Indonesia (SEIN).
Tugas Anda adalah menganalisis data Engineering Change Notice (ECN) berikut, memberikan ringkasan status implementasi, melacak dampak perubahan model, mendeteksi risiko material, dan memberikan rekomendasi teknis.

=== DATA AKTIF ECN (TOTAL ${totalRecords} DATA, SAMPEL TAMPIL: ${contextSummary.length} BARIS) ===
${JSON.stringify(contextSummary, null, 2)}
========================================================================================

Instruksi Analisis:
1. Jawab pertanyaan dengan terstruktur, profesional, dan to-the-point menggunakan terminologi SEIN PE (ECN NO, Model, Proses SMD/Mainline/Vendor, Running Date BOM, Status, Remark).
2. Jika ditanya status In Progress / ECO Cancel, sebutkan ECN NO dan modelnya.
3. Rujuk kolom Remark jika ditanya detail perubahan komponen/supplier (misal: penggantian Diode/FET, modifikasi JIG, dsb).`;

      const history = [
        ...chatMessages.filter((m) => m.id !== 'welcome').slice(-4).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const res = await api.post('/ai/chat', {
        messages: history,
        system_prompt: systemPrompt,
      });

      const reply = res.data?.reply || 'Tidak ada balasan dari AI.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `⚠️ Maaf, AI mengalami kendala: ${err.response?.data?.message || err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Status Badge Class Helper
  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return `${styles.statusBadge} ${styles.statusCompleted}`;
    if (s.includes('progress')) return `${styles.statusBadge} ${styles.statusInProgress}`;
    if (s === 'pending') return `${styles.statusBadge} ${styles.statusPending}`;
    if (s.includes('cancel')) return `${styles.statusBadge} ${styles.statusCancel}`;
    return `${styles.statusBadge} ${styles.statusDefault}`;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.breadcrumbs}>
            <span>Operations</span>
            <span>/</span>
            <span>Engineering Changes</span>
          </div>
          <h1 className={styles.pageTitle}>
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            ECN Monitoring
            <span className={styles.titleBadge}>SEIN Production Engineering</span>
          </h1>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => setIsPasteModalOpen(true)}
            title="Salin tabel dari Excel lalu tempel langsung (Bypass NASCA DRM)"
          >
            <ClipboardPaste className="w-4 h-4 text-blue-600" />
            <span>Paste Table (Bypass DRM)</span>
          </button>

          <button
            className={styles.btnSecondary}
            onClick={() => setIsUploadModalOpen(true)}
            title="Upload file spreadsheet .xlsx"
          >
            <Upload className="w-4 h-4 text-teal-600" />
            <span>Upload Excel</span>
          </button>

          <button
            className={styles.btnPrimary}
            onClick={() => {
              setEditingItem(null);
              setFormData({
                ecn_no: '',
                model: '',
                function_type: 'Circuit',
                purpose: '',
                inventory_mgmt: '',
                process: 'SMD',
                ec_title: '',
                parent_code: '',
                parent_name: '',
                before_after: '',
                dl: '',
                child_code: '',
                child_name: '',
                specification: '',
                quantity: '',
                marking_point: '',
                running_date_bom: '',
                distribution_date: '',
                status: 'Pending',
                remark: '',
              });
              setIsFormModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Manual Entry</span>
          </button>

          <button className={styles.btnSecondary} onClick={handleExportCSV} title="Export data ke CSV">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            className={styles.btnAi}
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            title="Buka asisten AI untuk analisis data ECN"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tanya AI ECN</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Layers className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total ECN</span>
            <span className={styles.statValue}>{stats.total.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Completed</span>
            <span className={styles.statValue}>{stats.completed.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <Clock className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>In Progress</span>
            <span className={styles.statValue}>{stats.in_progress.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{stats.pending.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fee2e2', color: '#dc2626' }}>
            <XCircle className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>ECO Cancel</span>
            <span className={styles.statValue}>{stats.eco_cancel.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <Cpu className="w-6 h-6" />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Models</span>
            <span className={styles.statValue}>{stats.unique_models.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarRow}>
          <div className={styles.searchBox}>
            <Search className={`w-4 h-4 ${styles.searchIcon}`} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Cari ECN No, Model, Judul EC, Remark, Part Code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filtersGroup}>
            {/* Filter Status */}
            <select
              className={styles.selectInput}
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Status</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
              <option value="ECO Cancel">ECO Cancel</option>
            </select>

            {/* Filter Process */}
            <select
              className={styles.selectInput}
              value={selectedProcess}
              onChange={(e) => {
                setSelectedProcess(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Proses</option>
              <option value="SMD">SMD</option>
              <option value="Mainline">Mainline</option>
              <option value="Vendor">Vendor</option>
              <option value="Sub-line">Sub-line</option>
            </select>

            {/* Filter Function */}
            <select
              className={styles.selectInput}
              value={selectedFunction}
              onChange={(e) => {
                setSelectedFunction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Fungsi</option>
              <option value="Circuit">Circuit</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Software">Software</option>
            </select>

            {(search || selectedStatus || selectedProcess || selectedFunction || selectedModel) && (
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setSearch('');
                  setSelectedStatus('');
                  setSelectedProcess('');
                  setSelectedFunction('');
                  setSelectedModel('');
                  setPage(1);
                }}
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              className={styles.btnSecondary}
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>ECN NO</th>
                <th>MODEL</th>
                <th>FUNCTION</th>
                <th>PROSES</th>
                <th>EC TITLE</th>
                <th>RUNNING DATE BOM</th>
                <th>DISTRIBUTION DATE</th>
                <th>STATUS</th>
                <th style={{ width: '90px', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b' }}>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Memuat data ECN...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                      <FileSpreadsheet className="w-12 h-12 stroke-1 text-slate-300" />
                      <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#475569', margin: 0 }}>Belum ada data ECN Monitoring</p>
                      <p style={{ fontSize: '0.8125rem', maxWidth: '420px', margin: 0 }}>
                        Gunakan tombol <strong>Paste Table</strong> untuk menempel data langsung dari Microsoft Excel (Bypass DRM), atau lakukan Manual Entry.
                      </p>
                      <button className={styles.btnPrimary} onClick={() => setIsPasteModalOpen(true)} style={{ marginTop: '0.5rem' }}>
                        <ClipboardPaste className="w-4 h-4" />
                        <span>Mulai Paste Table</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isExpanded = expandedRowIds.has(r.id);
                  return (
                    <React.Fragment key={r.id}>
                      <tr className={isExpanded ? styles.rowExpanded : ''}>
                        <td>
                          <button className={styles.expandBtn} onClick={() => toggleRowExpand(r.id)} title="Lihat detail">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td>
                          <span className={styles.ecnBadge}>{r.ecn_no || '-'}</span>
                        </td>
                        <td>
                          <span className={styles.modelBadge}>{r.model || '-'}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{r.function_type || '-'}</span>
                        </td>
                        <td>
                          <span className={styles.processBadge}>{r.process || '-'}</span>
                        </td>
                        <td style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ec_title}>
                          {r.ec_title || '-'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.running_date_bom || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.distribution_date || '-'}</td>
                        <td>
                          <span className={getStatusBadgeClass(r.status)}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                            {r.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              className={styles.expandBtn}
                              onClick={() => handleEditClick(r)}
                              title="Edit ECN"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            {isAdmin && (
                              <button
                                className={styles.expandBtn}
                                onClick={() => handleDeleteClick(r.id, r.ecn_no)}
                                title="Hapus ECN"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="10" style={{ padding: 0 }}>
                            <div className={styles.detailGrid}>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Purpose of Modification</span>
                                <span className={styles.detailValue}>{r.purpose || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Inventory Management</span>
                                <span className={styles.detailValue}>{r.inventory_mgmt || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Parent Code / Name</span>
                                <span className={styles.detailValue}>{r.parent_code || '-'} {r.parent_name ? `(${r.parent_name})` : ''}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Child Code / Name</span>
                                <span className={styles.detailValue}>{r.child_code || '-'} {r.child_name ? `(${r.child_name})` : ''}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Before / After</span>
                                <span className={styles.detailValue}>{r.before_after || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Specification & Qty</span>
                                <span className={styles.detailValue}>{r.specification || '-'} (Qty: {r.quantity || '-'})</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>D/L & Marking Point</span>
                                <span className={styles.detailValue}>{r.dl || '-'} / {r.marking_point || '-'}</span>
                              </div>
                              <div className={styles.remarkBox}>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.35rem' }}>
                                  Catatan Teknis (Remark):
                                </div>
                                {r.remark || 'Tidak ada catatan teknis.'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className={styles.pagination}>
          <div>
            Menampilkan <strong>{records.length}</strong> dari <strong>{totalRecords.toLocaleString()}</strong> data ECN (Halaman {page} dari {totalPages})
          </div>

          <div className={styles.pageControls}>
            <button
              className={styles.btnSecondary}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Sebelumnya
            </button>
            <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>{page}</span>
            <button
              className={styles.btnSecondary}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Selanjutnya
            </button>

            <select
              className={styles.selectInput}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
              <option value={100}>100 baris</option>
              <option value={200}>200 baris</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: PASTE TABLE (Bypass DRM) --- */}
      {isPasteModalOpen && (
        <Modal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          title="Paste Table (Bypass Enkripsi NASCA DRM)"
          maxWidth="900px"
        >
          <div className={styles.pasteModalContent}>
            <div className={styles.drmNoticeBox}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <div>
                <strong>Solusi Cepat Bebas DRM:</strong> Buka file Excel di Microsoft Excel PC Anda, blok tabel (Ctrl+A atau drag baris), tekan <strong>Ctrl+C</strong>, lalu tempelkan (Ctrl+V) di area bawah ini.
                Format Clipboard otomatis terdekripsi dan siap diimpor ke database tanpa hambatan.
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                Tempel data tabel di sini (Ctrl+V):
              </label>
              <textarea
                className={styles.pasteTextarea}
                placeholder="Paste baris dari Excel di sini (format TSV / Tab-Separated)..."
                value={pasteRawText}
                onChange={(e) => handleParseClipboard(e.target.value)}
              />
            </div>

            {parsedPasteRows.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#16a34a' }}>
                    ✓ Terdeteksi {parsedPasteRows.length} baris valid siap diimpor
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Menampilkan pratinjau 5 baris pertama:
                  </span>
                </div>

                <div className={styles.previewTableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ECN NO</th>
                        <th>MODEL</th>
                        <th>FUNGSI</th>
                        <th>PROSES</th>
                        <th>EC TITLE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPasteRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td><span className={styles.ecnBadge}>{row.ecn_no || '-'}</span></td>
                          <td><span className={styles.modelBadge}>{row.model || '-'}</span></td>
                          <td>{row.function_type || '-'}</td>
                          <td>{row.process || '-'}</td>
                          <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.ec_title || '-'}
                          </td>
                          <td><span className={getStatusBadgeClass(row.status)}>{row.status || 'Pending'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem', marginTop: '0.5rem' }}>
              <button className={styles.btnSecondary} onClick={() => setIsPasteModalOpen(false)}>
                Batal
              </button>
              <button
                className={styles.btnPrimary}
                disabled={parsedPasteRows.length === 0 || isImportingPaste}
                onClick={handleCommitPaste}
              >
                {isImportingPaste ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Impor {parsedPasteRows.length} Baris ke Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- MODAL 2: UPLOAD EXCEL --- */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Upload Berkas Excel ECN (.xlsx)"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
              Pilih file Microsoft Excel <code>.xlsx</code> yang sudah bersih/tidak ber-DRM untuk diparsing langsung oleh backend Python handler.
            </p>

            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '0.75rem',
                padding: '2rem',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('ecnFileInput')?.click()}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <input
                id="ecnFileInput"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                {uploadFile ? uploadFile.name : 'Klik untuk memilih file .xlsx'}
              </span>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Ukuran maksimum 25 MB
              </p>
            </div>

            {isUploading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', fontSize: '0.8125rem' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengeksekusi parser backend Python...</span>
              </div>
            )}

            {uploadDrmNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.875rem', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚠️ Terdeteksi Enkripsi Dokumen:</div>
                {uploadDrmNotice}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className={styles.btnPrimary}
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setIsPasteModalOpen(true);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    Buka Fitur Paste Table Sekarang
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className={styles.btnSecondary} onClick={() => setIsUploadModalOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- MODAL 3: MANUAL ENTRY FORM --- */}
      {isFormModalOpen && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingItem ? `Edit ECN: ${editingItem.ecn_no}` : 'Tambah ECN Baru (Manual Entry)'}
          maxWidth="760px"
        >
          <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ECN NO *</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder="e.g. GHW20260076"
                  value={formData.ecn_no}
                  onChange={(e) => setFormData({ ...formData, ecn_no: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>MODEL</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. SM-S947B, SM-X400"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Function Type</label>
                <select
                  className={styles.formInput}
                  value={formData.function_type}
                  onChange={(e) => setFormData({ ...formData, function_type: e.target.value })}
                >
                  <option value="Circuit">Circuit</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Software">Software</option>
                  <option value="Quality">Quality</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Proses</label>
                <select
                  className={styles.formInput}
                  value={formData.process}
                  onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                >
                  <option value="SMD">SMD</option>
                  <option value="Mainline">Mainline</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Sub-line">Sub-line</option>
                </select>
              </div>

              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>EC Title</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Deskripsi singkat judul perubahan engineering..."
                  value={formData.ec_title}
                  onChange={(e) => setFormData({ ...formData, ec_title: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Purpose of Modification</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Material supply and demand, Quality Improvement"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Inventory Management</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Running change_Materials Mixed"
                  value={formData.inventory_mgmt}
                  onChange={(e) => setFormData({ ...formData, inventory_mgmt: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Parent Code / Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Parent Part Code & Name"
                  value={formData.parent_code}
                  onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Child Code / Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Child Part Code & Name"
                  value={formData.child_code}
                  onChange={(e) => setFormData({ ...formData, child_code: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Running Date BOM</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. 1/15/2026 atau ECO Cancel"
                  value={formData.running_date_bom}
                  onChange={(e) => setFormData({ ...formData, running_date_bom: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status</label>
                <select
                  className={styles.formInput}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="ECO Cancel">ECO Cancel</option>
                </select>
              </div>

              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Remark (Catatan Detail Teknis)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Tuliskan catatan teknis, nomor dokumen pendukung, nama engineer PIC, dll..."
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className={styles.btnSecondary} onClick={() => setIsFormModalOpen(false)}>
                Batal
              </button>
              <button type="submit" className={styles.btnPrimary}>
                Simpan Record
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- SLIDE-OVER DRAWER: INTERACTIVE AI CHATBOT --- */}
      <div className={`${styles.chatDrawer} ${isAiDrawerOpen ? styles.chatDrawerOpen : ''}`}>
        <div className={styles.chatHeader}>
          <div className={styles.chatTitleArea}>
            <Bot className="w-5 h-5 text-indigo-600" />
            <h3 className={styles.chatTitle}>AI Insight & ECN Chat</h3>
            <span className={styles.chatContextBadge}>Konteks: {records.length} data</span>
          </div>
          <button className={styles.chatCloseBtn} onClick={() => setIsAiDrawerOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Question Chips */}
        <div className={styles.chatQuickChips}>
          <button
            className={styles.chipBtn}
            onClick={() => handleSendAiMessage('Ringkas seluruh ECN yang berstatus In Progress beserta dampaknya.')}
          >
            💡 ECN In Progress
          </button>
          <button
            className={styles.chipBtn}
            onClick={() => handleSendAiMessage('Apakah ada perubahan material kritis atau supplier pada kolom Remark?')}
          >
            ⚠️ Isu Material & Supplier
          </button>
          <button
            className={styles.chipBtn}
            onClick={() => handleSendAiMessage('Berapa banyak ECN yang statusnya ECO Cancel dan apa alasannya?')}
          >
            ❌ ECN Dibatalkan (Cancel)
          </button>
          <button
            className={styles.chipBtn}
            onClick={() => handleSendAiMessage('Jelaskan distribusi proses perubahan antara SMD, Mainline, dan Vendor.')}
          >
            📊 Distribusi Proses
          </button>
        </div>

        {/* Chat Messages List */}
        <div className={styles.chatMessagesList}>
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleAssistant}`}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              <div
                style={{
                  fontSize: '0.625rem',
                  marginTop: '0.35rem',
                  opacity: 0.7,
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                {msg.timestamp}
              </div>
            </div>
          ))}

          {isAiThinking && (
            <div className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI sedang menganalisis database ECN...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className={styles.chatInputArea}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder="Ketik pertanyaan terkait data ECN..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendAiMessage();
            }}
          />
          <button
            className={styles.chatSendBtn}
            disabled={!chatInput.trim() || isAiThinking}
            onClick={() => handleSendAiMessage()}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EcnMonitoringPage;
