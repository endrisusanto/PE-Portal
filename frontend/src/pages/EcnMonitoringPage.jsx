import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Copy
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import { RichMessageContent } from '../components/chat/AiChatWindow';
import styles from './EcnMonitoringPage.module.css';

// ponytail: normalizes heterogeneous dates (1/15/2026, 2026-01-15, 2026.01.15) to YYYY-MM-DD for fast matching
const normalizeDateStr = (str) => {
  if (!str) return '';
  const s = String(str).trim();
  const mIso = s.match(/^(\d{4})[-\.\/](\d{1,2})[-\.\/](\d{1,2})/);
  if (mIso) return `${mIso[1]}-${String(mIso[2]).padStart(2, '0')}-${String(mIso[3]).padStart(2, '0')}`;
  const mSlash = s.match(/^(\d{1,2})[-\.\/](\d{1,2})[-\.\/](\d{4})/);
  if (mSlash) return `${mSlash[3]}-${String(mSlash[1]).padStart(2, '0')}-${String(mSlash[2]).padStart(2, '0')}`;
  return s.replace(/[\.\/]/g, '-').toLowerCase();
};

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

  // --- Global Toolbar Filter State ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');

  // --- Individual Column Search Filters ---
  const [colFilters, setColFilters] = useState({
    ecn_no: '',
    model: '',
    function_type: '',
    process: '',
    ec_title: '',
    child_code: '',
    child_name: '',
    specification: '',
    quantity: '',
    running_date_bom: '',
    distribution_date: '',
    status: '',
    author_name: '',
  });

  // --- Table Header Sorting ---
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  // --- Expanded Rows State ---
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // --- Bulk Selection & Delete State (ponytail) ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // --- Modals State ---
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [parsedPasteRows, setParsedPasteRows] = useState([]);
  const [isImportingPaste, setIsImportingPaste] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDrmNotice, setUploadDrmNotice] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle');
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadSeconds, setUploadSeconds] = useState(0);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
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

  // Guard closing manual entry form to prevent accidental loss of data
  const handleRequestCloseForm = () => {
    const isFormDirty = Boolean(
      formData.ecn_no.trim() ||
      formData.model.trim() ||
      formData.ec_title.trim() ||
      formData.child_code.trim() ||
      formData.child_name.trim() ||
      formData.specification.trim() ||
      formData.remark.trim()
    );

    if (isFormDirty) {
      setIsCloseConfirmOpen(true);
    } else {
      setIsFormModalOpen(false);
      setEditingItem(null);
    }
  };

  // --- AI Chatbot Accordion State ---
  const [isAiAccordionOpen, setIsAiAccordionOpen] = useState(true);
  const chatScrollRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Halo! Saya asisten AI spesialis **ECN Monitoring SEIN PE**.\n\nSaya menganalisis seluruh database ECN yang sedang aktif (terfilter).\nAnda dapat menanyakan hal-hal seperti:\n- **Ringkasan ECN** model tertentu\n- **Analisis pergantian komponen/supplier** pada kolom *Remark*\n- Cek status **ECO Cancel** atau **In Progress**\n- Rekomendasi verifikasi **Running BOM**',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Debounce global search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiThinking]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/ecn/stats');
      setStats(res.data);
    } catch (err) {
      console.warn('Failed to fetch ECN stats:', err);
    }
  }, []);

  // Fetch ECN Records List from Backend
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
        sort_by: sortKey,
        sort_order: sortDirection,
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
  }, [page, limit, debouncedSearch, selectedModel, selectedStatus, selectedProcess, selectedFunction, sortKey, sortDirection]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // --- Sorting Handler ---
  const handleSort = (key) => {
    let nextDir = 'asc';
    if (sortKey === key) {
      if (sortDirection === 'asc') nextDir = 'desc';
      else if (sortDirection === 'desc') {
        setSortKey('created_at');
        setSortDirection('desc');
        return;
      }
    }
    setSortKey(key);
    setSortDirection(nextDir);
  };

  // --- Reset All Column Filters ---
  const hasActiveColFilters = useMemo(() => {
    return Object.values(colFilters).some((val) => Boolean(val));
  }, [colFilters]);

  const handleResetColFilters = () => {
    setColFilters({
      ecn_no: '',
      model: '',
      function_type: '',
      process: '',
      ec_title: '',
      child_code: '',
      child_name: '',
      specification: '',
      quantity: '',
      running_date_bom: '',
      distribution_date: '',
      status: '',
      author_name: '',
    });
  };

  // --- Filtered & Sorted Records (Client-side fast responsiveness) ---
  const displayedRecords = useMemo(() => {
    let result = [...records];

    if (colFilters.ecn_no) {
      const q = colFilters.ecn_no.toLowerCase();
      result = result.filter((r) => (r.ecn_no || '').toLowerCase().includes(q));
    }
    if (colFilters.model) {
      const q = colFilters.model.toLowerCase();
      result = result.filter((r) => (r.model || '').toLowerCase().includes(q));
    }
    if (colFilters.function_type) {
      const q = colFilters.function_type.toLowerCase();
      result = result.filter((r) => (r.function_type || '').toLowerCase().includes(q));
    }
    if (colFilters.process) {
      const q = colFilters.process.toLowerCase();
      result = result.filter((r) => (r.process || '').toLowerCase().includes(q));
    }
    if (colFilters.ec_title) {
      const q = colFilters.ec_title.toLowerCase();
      result = result.filter((r) => (r.ec_title || '').toLowerCase().includes(q));
    }
    if (colFilters.child_code) {
      const q = colFilters.child_code.toLowerCase();
      result = result.filter((r) => (r.child_code || '').toLowerCase().includes(q));
    }
    if (colFilters.child_name) {
      const q = colFilters.child_name.toLowerCase();
      result = result.filter((r) => (r.child_name || '').toLowerCase().includes(q));
    }
    if (colFilters.specification) {
      const q = colFilters.specification.toLowerCase();
      result = result.filter((r) => (r.specification || '').toLowerCase().includes(q));
    }
    if (colFilters.quantity) {
      const q = colFilters.quantity.toLowerCase();
      result = result.filter((r) => String(r.quantity || '').toLowerCase().includes(q));
    }
    if (colFilters.running_date_bom) {
      const qNorm = normalizeDateStr(colFilters.running_date_bom);
      result = result.filter((r) => {
        const raw = String(r.running_date_bom || '');
        if (!raw) return false;
        return normalizeDateStr(raw).includes(qNorm) || raw.includes(colFilters.running_date_bom);
      });
    }
    if (colFilters.distribution_date) {
      const qNorm = normalizeDateStr(colFilters.distribution_date);
      result = result.filter((r) => {
        const raw = String(r.distribution_date || '');
        if (!raw) return false;
        return normalizeDateStr(raw).includes(qNorm) || raw.includes(colFilters.distribution_date);
      });
    }
    if (colFilters.status) {
      const q = colFilters.status.toLowerCase();
      result = result.filter((r) => (r.status || '').toLowerCase() === q);
    }
    if (colFilters.author_name) {
      const q = colFilters.author_name.toLowerCase();
      result = result.filter((r) => (r.author_name || 'system').toLowerCase().includes(q));
    }

    // In-memory sort fallback
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined || valA === '') return 1;
        if (valB === null || valB === undefined || valB === '') return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
          : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return result;
  }, [records, colFilters, sortKey, sortDirection]);

  // Toggle Row Expansion
  const toggleRow = (id) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Bulk Selection & Delete Helpers (ponytail) ---
  const isAllSelected = useMemo(() => {
    return displayedRecords.length > 0 && displayedRecords.every((r) => selectedIds.has(r.id));
  }, [displayedRecords, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return displayedRecords.some((r) => selectedIds.has(r.id)) && !isAllSelected;
  }, [displayedRecords, selectedIds, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      displayedRecords.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const totalColSpan = (isAdmin ? 1 : 0) + 1 + 13 + 1;

  // Helper to parse TSV clipboard copied from Excel, handling multiline quoted cells, quotes in text, and escaped quotes
  const parseExcelClipboard = (rawText) => {
    if (!rawText) return [];
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotedCell = false;

    for (let i = 0; i < rawText.length; i++) {
      const char = rawText[i];
      const nextChar = rawText[i + 1];

      if (!inQuotedCell) {
        // If quote is the first character in the cell, it starts a quoted cell
        if (char === '"' && currentCell.length === 0) {
          inQuotedCell = true;
          continue;
        }

        if (char === '\t') {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\r' || char === '\n') {
          if (char === '\r' && nextChar === '\n') {
            i++; // skip LF
          }
          currentRow.push(currentCell.trim());
          currentCell = '';
          if (currentRow.some((c) => c !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
        } else {
          currentCell += char;
        }
      } else {
        // Inside a quoted cell
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote: "" -> "
            currentCell += '"';
            i++;
          } else if (nextChar === '\t' || nextChar === '\r' || nextChar === '\n' || i === rawText.length - 1) {
            // Valid closing quote followed by delimiter or newline or EOF
            inQuotedCell = false;
          } else {
            // Unescaped quote inside cell content (e.g. 2.5" screen), keep as character
            currentCell += '"';
          }
        } else {
          currentCell += char;
        }
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // --- Parse Clipboard TSV (Paste Table) ---
  const handleParsePasteText = (text) => {
    setPasteRawText(text);
    if (!text || !text.trim()) {
      setParsedPasteRows([]);
      return;
    }

    const rows = parseExcelClipboard(text);
    if (rows.length === 0) {
      setParsedPasteRows([]);
      return;
    }

    // Header detection: only skip row 0 if it is genuinely a column header label,
    // NOT a data row that happens to contain 'ECN' or 'MODEL' in the remark/title
    let startIdx = 0;
    if (rows.length > 0) {
      const col0 = (rows[0][0] || '').trim().toLowerCase();
      const col1 = (rows[0][1] || '').trim().toLowerCase();
      const isCol0Header =
        col0 === 'ecn no' ||
        col0 === 'ecn' ||
        col0 === 'ecn_no' ||
        col0 === 'ecn number' ||
        col0 === 'no ecn';
      const isCol1Header =
        col1 === 'model' &&
        !col0.toUpperCase().startsWith('GHW') &&
        !col0.toUpperCase().startsWith('ECO');

      if (isCol0Header || isCol1Header) {
        startIdx = 1;
      }
    }

    const parsed = [];
    let currentCache = {};
    let lastEcnNo = '';

    const ALL_KEYS = [
      'ecn_no', 'model', 'function_type', 'purpose', 'inventory_mgmt',
      'process', 'ec_title', 'parent_code', 'parent_name', 'before_after',
      'dl', 'child_code', 'child_name', 'specification', 'quantity',
      'marking_point', 'running_date_bom', 'distribution_date', 'status', 'remark'
    ];

    for (let i = startIdx; i < rows.length; i++) {
      const cols = rows[i];
      if (!cols || cols.length === 0) continue;

      const record = {
        ecn_no: cols[0] || '',
        model: cols[1] || '',
        function_type: cols[2] || '',
        purpose: cols[3] || '',
        inventory_mgmt: cols[4] || '',
        process: cols[5] || '',
        ec_title: cols[6] || '',
        parent_code: cols[7] || '',
        parent_name: cols[8] || '',
        before_after: cols[9] || '',
        dl: cols[10] || '',
        child_code: cols[11] || '',
        child_name: cols[12] || '',
        specification: cols[13] || '',
        quantity: cols[14] || '',
        marking_point: cols[15] || '',
        running_date_bom: cols[16] || '',
        distribution_date: cols[17] || '',
        status: cols[18] || '',
        remark: cols[19] || (cols.length > 20 ? cols.slice(19).join(' ') : ''),
      };

      const hasContent = Object.values(record).some((v) => v !== '');
      if (!hasContent) continue;

      const rowEcnNo = record.ecn_no.trim();
      if (rowEcnNo && rowEcnNo !== lastEcnNo) {
        currentCache = {};
        lastEcnNo = rowEcnNo;
      }

      // Forward-fill all columns for merged cells (parent_code through marking_point, headers, dates)
      for (const k of ALL_KEYS) {
        const val = (record[k] || '').trim();
        if (val) {
          currentCache[k] = val;
        } else if (currentCache[k]) {
          record[k] = currentCache[k];
        }
      }

      if (!record.ecn_no) record.ecn_no = '-';
      if (!record.status) record.status = 'Pending';

      parsed.push(record);
    }

    setParsedPasteRows(parsed);
  };

  // Submit Bulk Import from Paste Table
  const handleSubmitPasteBulk = async () => {
    if (parsedPasteRows.length === 0) {
      alert('Tidak ada data ECN valid yang dapat diimpor.');
      return;
    }

    setIsImportingPaste(true);
    try {
      const res = await api.post('/ecn/bulk', { records: parsedPasteRows });
      alert(`Berhasil mengimpor ${res.data?.count || res.data?.imported || parsedPasteRows.length} baris data ECN!`);
      setIsPasteModalOpen(false);
      setPasteRawText('');
      setParsedPasteRows([]);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal import data: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsImportingPaste(false);
    }
  };

  // Submit Excel File Upload with Fallback Progress (Ponytail)
  const handleUploadExcelSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Pilih file Excel terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadDrmNotice(null);
    setUploadProgress(0);
    setUploadStage('uploading');
    setUploadStatusText('Mengunggah berkas Excel ke server (0%)...');
    setUploadSeconds(0);

    const timer = setInterval(() => {
      setUploadSeconds((prev) => prev + 1);
    }, 1000);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await api.post('/ecn/parse-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
            if (percent < 100) {
              setUploadStatusText(`Mengunggah berkas Excel ke server (${percent}%)...`);
            } else {
              setUploadStage('parsing');
              setUploadStatusText('Berkas terunggah. Membaca & mengurai struktur Excel di server (file besar sedang diekstrak)...');
            }
          }
        },
      });

      if (res.data?.is_drm) {
        setUploadDrmNotice({
          message: res.data.message || 'File terenkripsi oleh Samsung NASCA DRM.',
          recommendation:
            'Gunakan menu Paste Table: Buka file di Microsoft Excel, tekan Ctrl+A -> Ctrl+C, lalu paste di form Paste Table.',
        });
        return;
      }

      if (res.data?.records && res.data.records.length > 0) {
        setUploadStage('importing');
        setUploadStatusText(`Mengekstrak ${res.data.records.length} data. Menyimpan ke database...`);

        const importRes = await api.post('/ecn/bulk', { records: res.data.records });
        const importedCount = importRes.data?.imported ?? importRes.data?.count ?? res.data.records.length;
        alert(`Berhasil mengimpor ${importedCount} data ECN dari Excel!`);
        setIsUploadModalOpen(false);
        setUploadFile(null);
        fetchRecords();
        fetchStats();
      } else {
        alert('Tidak ada data valid yang ditemukan pada file Excel.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      alert(`Gagal upload Excel: ${errMsg}`);
    } finally {
      clearInterval(timer);
      setIsUploading(false);
      setUploadStage('idle');
      setUploadProgress(0);
    }
  };

  // Manual Entry Form Submit
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal menghapus ECN: ${err.message}`);
    }
  };

  // ponytail: Bulk delete handler for admin
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${count} data ECN yang dipilih? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      const res = await api.post('/ecn/bulk-delete', { ids: Array.from(selectedIds) });
      alert(res.data?.message || `Berhasil menghapus ${count} data ECN.`);
      setSelectedIds(new Set());
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(`Gagal menghapus data ECN: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (displayedRecords.length === 0) {
      alert('Tidak ada data ECN untuk diekspor.');
      return;
    }

    const headers = [
      'ECN NO',
      'MODEL',
      'Function Type',
      'Purpose',
      'Inventory Management',
      'Proses',
      'EC Title',
      'PARENT CODE',
      'PARENT NAME',
      'Before After',
      'D/L',
      'CHILD CODE',
      'CHILD NAME',
      'SPECIFICATION',
      'Quantity',
      'Marking point',
      'Running Date BOM',
      'Distribution Date',
      'Status',
      'Author / Uploader',
      'Upload Timestamp',
      'Remark',
    ];

    const csvRows = [headers.join(',')];
    displayedRecords.forEach((r) => {
      const vals = [
        r.ecn_no,
        r.model,
        r.function_type,
        r.purpose,
        r.inventory_mgmt,
        r.process,
        r.ec_title,
        r.parent_code,
        r.parent_name,
        r.before_after,
        r.dl,
        r.child_code,
        r.child_name,
        r.specification,
        r.quantity,
        r.marking_point,
        r.running_date_bom,
        r.distribution_date,
        r.status,
        r.author_name || 'System',
        r.created_at || '',
        r.remark,
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
      const contextSummary = displayedRecords.slice(0, 35).map((r) => ({
        ecn: r.ecn_no,
        model: r.model,
        process: r.process,
        func: r.function_type,
        status: r.status,
        title: r.ec_title,
        part_code: r.child_code,
        part_name: r.child_name,
        spec: r.specification,
        bom_date: r.running_date_bom,
        remark: r.remark ? (r.remark.length > 250 ? r.remark.substring(0, 250) + '...' : r.remark) : '',
      }));

      const systemPrompt = `Anda adalah asisten AI Production Engineering (PE) spesialis ECN Monitoring di PT Samsung Electronics Indonesia (SEIN).
Tugas Anda adalah menganalisis data Engineering Change Notice (ECN) berikut, melacak perubahan part, mendeteksi status kendala material/supplier, dan menyajikan jawaban yang rapi, profesional, dan to-the-point.

=== KONTEKS DATA ECN AKTIF (TOTAL ${totalRecords} DATA, SAMPEL TERMUAT: ${contextSummary.length} BARIS) ===
${JSON.stringify(contextSummary, null, 2)}
========================================================================================

Panduan Format Respons:
1. Gunakan Markdown yang kaya dan terstruktur: **bold** untuk penekanan, *italic* untuk istilah teknis, \`code\` untuk nomor part/kode, dan blockquote (\`> \`) untuk peringatan teknis atau kutipan remark.
2. Gunakan bullet list (\`- \`) atau numbered list (\`1. \`) untuk poin-poin penjelasan.
3. Jika menampilkan komparasi data atau daftar ECN, gunakan Markdown Table (\`| ECN NO | Model | Status | Keterangan |\`) agar rapi.
4. Jawablah langsung pada inti pertanyaan dengan bahasa Indonesia yang baku dan ramah bagi Production Engineer.`;

      const history = [
        ...chatMessages
          .filter((m) => m.id !== 'welcome')
          .slice(-4)
          .map((m) => ({ role: m.role, content: m.content })),
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
          content: `⚠️ **Maaf, terjadi kendala komunikasi dengan AI**: ${err.response?.data?.message || err.message}`,
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
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.breadcrumbs}>
            <span>Operations</span>
            <span>/</span>
            <span>Engineering Changes</span>
          </div>
          <h1 className={styles.pageTitle}>
            <FileSpreadsheet className="w-6 h-6 text-teal-600" />
            ECN Monitoring
            <span className={styles.titleBadge}>SEIN Production Engineering</span>
          </h1>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsPasteModalOpen(true)}
            title="Paste tabel langsung dari Excel clipboard (Bypass DRM NASCA)"
          >
            <ClipboardPaste size={15} />
            Paste Table
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsUploadModalOpen(true)}
            title="Upload file dokumen Excel (.xlsx)"
          >
            <Upload size={15} />
            Upload Excel
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleExportCSV}
            title="Ekspor data aktif ke CSV"
          >
            <Download size={15} />
            Export CSV
          </button>
          <button
            type="button"
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
            <Plus size={15} />
            Manual Entry
          </button>
        </div>
      </div>

      {/* Metric KPI Cards Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            <Layers size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total ECN Records</span>
            <span className={styles.statValue}>{stats.total.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>ECN Completed</span>
            <span className={styles.statValue}>{stats.completed.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}>
            <XCircle size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>ECO Cancel</span>
            <span className={styles.statValue}>{stats.eco_cancel.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(13, 115, 119, 0.12)', color: 'var(--color-accent)' }}>
            <Boxes size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Models</span>
            <span className={styles.statValue}>{stats.unique_models.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================
          AI CHATBOX ACCORDION (Placed Above Table with Rich Formatting)
          ======================================================================== */}
      <div className={`${styles.aiAccordionCard} ${isAiAccordionOpen ? styles.aiAccordionCardOpen : ''}`}>
        <div className={styles.aiAccordionHeader} onClick={() => setIsAiAccordionOpen(!isAiAccordionOpen)}>
          <div className={styles.aiAccordionTitleArea}>
            <div className={styles.aiIconWrapper}>
              <Sparkles size={16} />
            </div>
            <h3 className={styles.aiAccordionTitle}>
              SEIN ECN Engineering AI Assistant
              <span className={styles.aiContextBadge}>
                Konteks: {totalRecords} data ({displayedRecords.length} baris aktif)
              </span>
            </h3>
            <span className={styles.aiOnlinePill}>
              <span className={styles.aiOnlineDot} />
              LLM Ready
            </span>
          </div>
          <div className={styles.aiAccordionActions}>
            <span className={styles.aiToggleText}>
              {isAiAccordionOpen ? 'Sembunyikan Asisten AI' : 'Buka Asisten AI'}
            </span>
            <ChevronDown
              size={18}
              className={`${styles.aiChevron} ${isAiAccordionOpen ? styles.aiChevronOpen : ''}`}
            />
          </div>
        </div>

        {isAiAccordionOpen && (
          <div className={styles.aiAccordionBody}>
            {/* Quick Suggestion Chips */}
            <div className={styles.aiQuickChips}>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() => handleSendAiMessage('Ringkas seluruh ECN yang berstatus In Progress beserta dampaknya.')}
              >
                💡 ECN In Progress
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() => handleSendAiMessage('Apakah ada perubahan material kritis, FET, atau supplier pada kolom Remark?')}
              >
                ⚠️ Isu Material & Supplier
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() => handleSendAiMessage('Berapa banyak ECN yang statusnya ECO Cancel dan apa alasannya?')}
              >
                ❌ ECN Dibatalkan (Cancel)
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() => handleSendAiMessage('Jelaskan distribusi proses perubahan antara SMD, Mainline, dan Vendor.')}
              >
                📊 Distribusi Proses
              </button>
            </div>

            {/* Chat Messages List */}
            <div className={styles.aiMessagesContainer} ref={chatScrollRef}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.aiMessageBubble} ${
                    msg.role === 'user' ? styles.aiMessageUser : styles.aiMessageAssistant
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <RichMessageContent content={msg.content} />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  )}
                  <div className={styles.aiMessageTime}>{msg.timestamp}</div>
                </div>
              ))}

              {isAiThinking && (
                <div className={`${styles.aiMessageBubble} ${styles.aiMessageAssistant}`}>
                  <div className={styles.aiThinkingBox}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI sedang menganalisis database ECN...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Composer Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiMessage();
              }}
              className={styles.aiComposerBar}
            >
              <input
                type="text"
                className={styles.aiInput}
                placeholder="Tanyakan analisis ECN, model, part number, perubahan spek, kendala material..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isAiThinking}
              />
              <button
                type="button"
                className={styles.aiClearBtn}
                title="Bersihkan riwayat percakapan"
                onClick={() => setChatMessages([chatMessages[0]])}
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="submit"
                className={styles.aiSendBtn}
                disabled={!chatInput.trim() || isAiThinking}
              >
                <Send size={14} />
                <span>Kirim</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ========================================================================
          MAIN TABLE CONTAINER & TOOLBAR
          ======================================================================== */}
      <div className={styles.tableContainer}>
        {/* Global Toolbar */}
        <div className={styles.tableToolbar}>
          <div className={styles.toolbarFilters}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} size={15} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Pencarian cepat (ECN, Model, Title, Part)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className={styles.selectInput}
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Model</option>
              {Object.keys(stats.model_counts || {}).map((m) => (
                <option key={m} value={m}>
                  {m} ({stats.model_counts[m]})
                </option>
              ))}
            </select>

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
              <option value="PBA">PBA</option>
            </select>

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
              <option value="Mechanism">Mechanism</option>
              <option value="Software">Software</option>
              <option value="Process">Process</option>
            </select>
          </div>

          <div className={styles.toolbarActions}>
            {isAdmin && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  height: '32px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isBulkDeleting ? 'not-allowed' : 'pointer',
                  opacity: isBulkDeleting ? 0.7 : 1,
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
                }}
                title="Hapus data ECN terpilih"
              >
                {isBulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Hapus Terpilih ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
              title="Muat ulang data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Data Table with Sortable Columns & Individual Column Search */}
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              {/* Row 1: Sortable Column Headers */}
              <tr>
                {isAdmin && (
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      title="Pilih semua baris di halaman ini"
                      style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                    />
                  </th>
                )}
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                {[
                  { key: 'ecn_no', label: 'ECN NO', width: '135px' },
                  { key: 'model', label: 'Model', width: '115px' },
                  { key: 'function_type', label: 'Function', width: '95px' },
                  { key: 'process', label: 'Process', width: '90px' },
                  { key: 'ec_title', label: 'EC Title', minWidth: '180px' },
                  { key: 'child_code', label: 'Item Code', width: '125px' },
                  { key: 'child_name', label: 'Part Description', minWidth: '160px' },
                  { key: 'specification', label: 'Specification', minWidth: '160px' },
                  { key: 'quantity', label: 'Qty', width: '70px' },
                  { key: 'running_date_bom', label: 'Running BOM', width: '125px', minWidth: '120px' },
                  { key: 'distribution_date', label: 'Dist Date', width: '125px', minWidth: '120px' },
                  { key: 'status', label: 'Status', width: '115px' },
                  { key: 'author_name', label: 'Uploader & Waktu', width: '150px', minWidth: '140px' },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={styles.thSortable}
                    onClick={() => handleSort(col.key)}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    title={`Klik untuk mengurutkan berdasarkan ${col.label}`}
                  >
                    <div className={styles.thSortContent}>
                      <span>{col.label}</span>
                      {sortKey === col.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={12} className={styles.sortIconActive} />
                        ) : (
                          <ArrowDown size={12} className={styles.sortIconActive} />
                        )
                      ) : (
                        <ArrowUpDown size={11} className={styles.sortIconInactive} />
                      )}
                    </div>
                  </th>
                ))}
                <th style={{ width: '85px', textAlign: 'center' }}>Aksi</th>
              </tr>

              {/* Row 2: Individual Column Filter Inputs */}
              <tr className={styles.columnFilterRow}>
                {isAdmin && (
                  <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>-</span>
                    </div>
                  </th>
                )}
                <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
                    <Filter size={12} style={{ opacity: 0.5 }} />
                  </div>
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Filter ECN..."
                    value={colFilters.ecn_no}
                    onChange={(e) => setColFilters({ ...colFilters, ecn_no: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Filter model..."
                    value={colFilters.model}
                    onChange={(e) => setColFilters({ ...colFilters, model: e.target.value })}
                  />
                </th>
                <th>
                  <select
                    className={styles.colFilterSelect}
                    value={colFilters.function_type}
                    onChange={(e) => setColFilters({ ...colFilters, function_type: e.target.value })}
                  >
                    <option value="">Semua</option>
                    <option value="Circuit">Circuit</option>
                    <option value="Mechanism">Mechanism</option>
                    <option value="Software">Software</option>
                    <option value="Process">Process</option>
                  </select>
                </th>
                <th>
                  <select
                    className={styles.colFilterSelect}
                    value={colFilters.process}
                    onChange={(e) => setColFilters({ ...colFilters, process: e.target.value })}
                  >
                    <option value="">Semua</option>
                    <option value="SMD">SMD</option>
                    <option value="Mainline">Mainline</option>
                    <option value="Vendor">Vendor</option>
                    <option value="PBA">PBA</option>
                  </select>
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Cari title..."
                    value={colFilters.ec_title}
                    onChange={(e) => setColFilters({ ...colFilters, ec_title: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Part code..."
                    value={colFilters.child_code}
                    onChange={(e) => setColFilters({ ...colFilters, child_code: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Part desc..."
                    value={colFilters.child_name}
                    onChange={(e) => setColFilters({ ...colFilters, child_name: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Spec..."
                    value={colFilters.specification}
                    onChange={(e) => setColFilters({ ...colFilters, specification: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Qty..."
                    value={colFilters.quantity}
                    onChange={(e) => setColFilters({ ...colFilters, quantity: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="date"
                    className={styles.colFilterDate}
                    title="Pilih tanggal Running BOM"
                    value={colFilters.running_date_bom}
                    onChange={(e) => setColFilters({ ...colFilters, running_date_bom: e.target.value })}
                    onClick={(e) => {
                      try {
                        e.target.showPicker?.();
                      } catch (_) {}
                    }}
                  />
                </th>
                <th>
                  <input
                    type="date"
                    className={styles.colFilterDate}
                    title="Pilih tanggal Distribution Date"
                    value={colFilters.distribution_date}
                    onChange={(e) => setColFilters({ ...colFilters, distribution_date: e.target.value })}
                    onClick={(e) => {
                      try {
                        e.target.showPicker?.();
                      } catch (_) {}
                    }}
                  />
                </th>
                <th>
                  <select
                    className={styles.colFilterSelect}
                    value={colFilters.status}
                    onChange={(e) => setColFilters({ ...colFilters, status: e.target.value })}
                  >
                    <option value="">Semua</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="ECO Cancel">ECO Cancel</option>
                  </select>
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Filter uploader..."
                    value={colFilters.author_name}
                    onChange={(e) => setColFilters({ ...colFilters, author_name: e.target.value })}
                  />
                </th>
                <th style={{ textAlign: 'center' }}>
                  {hasActiveColFilters && (
                    <button
                      type="button"
                      className={styles.colFilterResetBtn}
                      title="Reset semua filter kolom"
                      onClick={handleResetColFilters}
                    >
                      <RotateCcw size={10} />
                      Reset
                    </button>
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalColSpan} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      <span>Memuat data ECN Monitoring...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={totalColSpan} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <FileSpreadsheet size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        Tidak ada record ECN yang cocok
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        Coba sesuaikan kata kunci pencarian, filter kolom di header, atau lakukan import baru.
                      </span>
                      {hasActiveColFilters && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ marginTop: '0.5rem' }}
                          onClick={handleResetColFilters}
                        >
                          <RotateCcw size={13} />
                          Bersihkan Filter Kolom
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((item, idx) => {
                  const isExpanded = expandedRowIds.has(item.id);
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={isExpanded ? styles.rowExpanded : ''}>
                        {/* Checkbox for Admin */}
                        {isAdmin && (
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => handleToggleSelectRow(item.id)}
                              title={`Pilih ${item.ecn_no}`}
                              style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                            />
                          </td>
                        )}

                        {/* Expand Trigger */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => toggleRow(item.id)}
                            title={isExpanded ? 'Tutup Detail' : 'Buka Detail Lengkap'}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        {/* ECN No */}
                        <td>
                          <span className={styles.ecnBadge}>{item.ecn_no}</span>
                        </td>

                        {/* Model */}
                        <td>
                          <span className={styles.modelBadge}>{item.model || '-'}</span>
                        </td>

                        {/* Function Type */}
                        <td>{item.function_type || '-'}</td>

                        {/* Process */}
                        <td>
                          <span className={styles.processBadge}>{item.process || '-'}</span>
                        </td>

                        {/* EC Title */}
                        <td style={{ maxWidth: '240px', fontWeight: 500 }} title={item.ec_title}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.ec_title || '-'}
                          </div>
                        </td>

                        {/* Child Code */}
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>
                            {item.child_code || '-'}
                          </span>
                        </td>

                        {/* Child Name */}
                        <td style={{ maxWidth: '200px' }} title={item.child_name}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.child_name || '-'}
                          </div>
                        </td>

                        {/* Specification */}
                        <td style={{ maxWidth: '200px' }} title={item.specification}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.specification || '-'}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td style={{ textAlign: 'center' }}>{item.quantity || '-'}</td>

                        {/* Running Date BOM */}
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {item.running_date_bom || '-'}
                        </td>

                        {/* Distribution Date */}
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {item.distribution_date || '-'}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={getStatusBadgeClass(item.status)}>{item.status || 'Pending'}</span>
                        </td>

                        {/* Author & Timestamp */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                              {item.author_name || 'System'}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {item.created_at
                                ? new Date(item.created_at).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              title="Edit Record"
                              onClick={() => handleEditClick(item)}
                            >
                              <Edit size={14} />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                title="Hapus Record"
                                onClick={() => handleDeleteClick(item.id, item.ecn_no)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Full Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={totalColSpan} style={{ padding: 0 }}>
                            <div className={styles.detailGrid}>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Parent Code</span>
                                <span className={styles.detailValue} style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                  {item.parent_code || '-'}
                                </span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Parent Name</span>
                                <span className={styles.detailValue}>{item.parent_name || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Purpose</span>
                                <span className={styles.detailValue}>{item.purpose || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Inventory Mgmt</span>
                                <span className={styles.detailValue}>{item.inventory_mgmt || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Before / After</span>
                                <span className={styles.detailValue}>{item.before_after || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>D/L (Distribution Level)</span>
                                <span className={styles.detailValue}>{item.dl || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Marking Point</span>
                                <span className={styles.detailValue}>{item.marking_point || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Author / Uploader</span>
                                <span className={styles.detailValue} style={{ fontWeight: 600 }}>
                                  {item.author_name || 'System'}
                                </span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Record ID & Timestamp</span>
                                <span className={styles.detailValue} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  {item.id} (Dibuat: {item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-'})
                                </span>
                              </div>

                              <div className={styles.remarkBox}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span className={styles.detailLabel}>Remark / Catatan Teknis:</span>
                                  {item.remark && item.remark.length > 200 && (
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                      {item.remark.length.toLocaleString('id-ID')} karakter
                                    </span>
                                  )}
                                </div>
                                {item.remark ? (
                                  <div
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      lineHeight: 1.55,
                                      maxHeight: '280px',
                                      overflowY: 'auto',
                                      paddingRight: '6px',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {item.remark}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                    Tidak ada catatan remark untuk record ini.
                                  </span>
                                )}
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

        {/* Table Pagination Footer */}
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Menampilkan <strong>{displayedRecords.length}</strong> dari <strong>{totalRecords}</strong> data ECN (Halaman{' '}
            <strong>{page}</strong> dari <strong>{totalPages}</strong>)
          </div>

          <div className={styles.paginationControlsWrapper}>
            {/* ponytail: Limit selector (10, 50, 100, All) */}
            <div className={styles.paginationLimit}>
              <span className={styles.paginationSortLabel}>Tampilkan:</span>
              <select
                className={styles.paginationSortSelect}
                value={limit >= 10000 ? 'all' : limit}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 10000 : parseInt(e.target.value, 10);
                  setLimit(val);
                  setPage(1);
                }}
                title="Jumlah baris data per halaman"
              >
                <option value="10">10 / hal</option>
                <option value="50">50 / hal</option>
                <option value="100">100 / hal</option>
                <option value="all">Semua (All)</option>
              </select>
            </div>

            {/* ponytail: Sort By controls in table footer pagination */}
            <div className={styles.paginationSort}>
              <span className={styles.paginationSortLabel}>
                <ArrowUpDown size={12} />
                <span>Urutkan:</span>
              </span>
              <select
                className={styles.paginationSortSelect}
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value);
                  setPage(1);
                }}
                title="Urutkan berdasarkan kolom"
              >
                <option value="created_at">Waktu Dibuat (Terbaru)</option>
                <option value="ecn_no">ECN NO</option>
                <option value="model">Model</option>
                <option value="function_type">Function</option>
                <option value="process">Process</option>
                <option value="ec_title">EC Title</option>
                <option value="child_code">Item Code</option>
                <option value="child_name">Part Description</option>
                <option value="specification">Specification</option>
                <option value="quantity">Qty</option>
                <option value="running_date_bom">Running BOM</option>
                <option value="distribution_date">Dist Date</option>
                <option value="status">Status</option>
                <option value="author_name">Uploader</option>
              </select>
              <button
                type="button"
                className={styles.paginationSortDirBtn}
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Urutan Naik (A-Z / Lama ke Baru)' : 'Urutan Turun (Z-A / Baru ke Lama)'}
              >
                {sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                <span>{sortDirection === 'asc' ? 'ASC' : 'DESC'}</span>
              </button>
            </div>

            <div className={styles.pageControls}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </button>
              <span style={{ fontWeight: 600 }}>{page}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================
          MODAL 1: BULK IMPORT VIA PASTE TABLE (Bypass DRM NASCA)
          ======================================================================== */}
      {isPasteModalOpen && (
        <Modal
          isOpen={isPasteModalOpen}
          onClose={() => {
            setIsPasteModalOpen(false);
            setPasteRawText('');
            setParsedPasteRows([]);
          }}
          title="Bulk Import via Paste Table (Bypass DRM NASCA)"
          maxWidth="900px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.drmAlertBox}>
              <Sparkles size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
              <div>
                <strong>Metode Bypass Samsung NASCA DRM:</strong>
                <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Buka dokumen Excel Anda di PC (aplikasi Microsoft Excel membuka data terdekripsi secara otomatis). Tekan{' '}
                  <kbd style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '3px', border: '1px solid var(--color-border)' }}>Ctrl+A</kbd> lalu{' '}
                  <kbd style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '3px', border: '1px solid var(--color-border)' }}>Ctrl+C</kbd>, kemudian paste di bawah.
                </p>
              </div>
            </div>

            <textarea
              className={styles.formTextarea}
              style={{ minHeight: '140px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px' }}
              placeholder="Paste data sel dari Excel di sini (Ctrl+V)... Kolom: ECN NO, MODEL, Function Type, Purpose, Inventory, Process, EC Title, dll."
              value={pasteRawText}
              onChange={(e) => handleParsePasteText(e.target.value)}
            />

            {parsedPasteRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    Preview Data Siap Impor ({parsedPasteRows.length} baris):
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>✓ Format Kolom Valid</span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                  <table className={styles.table} style={{ fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>ECN NO</th>
                        <th>Model</th>
                        <th>Process</th>
                        <th>EC Title</th>
                        <th>Child Code</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPasteRows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{row.ecn_no}</td>
                          <td>{row.model}</td>
                          <td>{row.process}</td>
                          <td>{row.ec_title}</td>
                          <td>{row.child_code}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedPasteRows.length > 10 && (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                    Menampilkan 10 baris pertama dari total {parsedPasteRows.length} baris.
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPasteRawText('');
                  setParsedPasteRows([]);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={parsedPasteRows.length === 0 || isImportingPaste}
                onClick={handleSubmitPasteBulk}
              >
                {isImportingPaste ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Impor {parsedPasteRows.length} Baris ECN
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================
          MODAL 2: UPLOAD EXCEL (.XLSX) DENGAN PENDETEKSI DRM
          ======================================================================== */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadDrmNotice(null);
          }}
          title="Upload Dokumen Excel (.xlsx)"
          maxWidth="600px"
        >
          <form onSubmit={handleUploadExcelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Pilih file format <code>.xlsx</code> yang berisi daftar ECN. Sistem akan membaca baris tabel secara otomatis melalui script parsing Python.
            </p>

            {uploadDrmNotice && (
              <div className={styles.drmAlertBox} style={{ background: 'var(--color-error-subtle)', borderColor: 'var(--color-error)' }}>
                <AlertCircle size={20} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--color-error)' }}>{uploadDrmNotice.message}</strong>
                  <p style={{ margin: '4px 0 0 0', lineHeight: 1.4, fontSize: '12px' }}>
                    {uploadDrmNotice.recommendation}
                  </p>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setIsPasteModalOpen(true);
                    }}
                  >
                    Buka Paste Table Sekarang
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className={styles.formLabel}>Pilih File Excel:</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className={styles.formInput}
                disabled={isUploading}
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
              />
            </div>

            {/* Fallback Progress Container for Large Excel Uploads (Ponytail) */}
            {isUploading && (
              <div className={styles.uploadProgressBox}>
                <div className={styles.progressHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                    <span>
                      {uploadStage === 'uploading'
                        ? `Tahap 1/2: Mengunggah berkas (${uploadProgress}%)`
                        : uploadStage === 'parsing'
                        ? 'Tahap 2/2: Membaca & Memproses Excel'
                        : uploadStage === 'importing'
                        ? 'Menyimpan Data ke Database'
                        : 'Memproses data...'}
                    </span>
                  </div>
                  <span className={styles.progressTimer}>
                    ⏱️ {uploadSeconds}s
                  </span>
                </div>

                <div className={styles.progressBarTrack}>
                  {uploadStage === 'uploading' ? (
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  ) : (
                    <div className={styles.progressBarIndeterminate} />
                  )}
                </div>

                <p className={styles.progressDetailText}>
                  {uploadStatusText || 'Sedang memproses... File Excel berukuran besar memerlukan beberapa detik untuk diekstrak. Browser tidak freeze/hang.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={isUploading}
                onClick={() => {
                  if (isUploading) return;
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadDrmNotice(null);
                }}
              >
                Batal
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={!uploadFile || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {uploadStage === 'uploading'
                      ? `Mengunggah (${uploadProgress}%)...`
                      : uploadStage === 'parsing'
                      ? 'Mengekstrak Excel...'
                      : uploadStage === 'importing'
                      ? 'Menyimpan ke DB...'
                      : 'Memproses File...'}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Mulai Parsing & Simpan
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================
          MODAL 3: MANUAL ENTRY / EDIT SINGLE RECORD (Wide Horizontal Layout)
          ======================================================================== */}
      {isFormModalOpen && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={handleRequestCloseForm}
          title={editingItem ? `Edit ECN Record (${editingItem.ecn_no})` : 'Manual Entry ECN Record'}
          maxWidth="min(1240px, 96vw)"
          closeOnOverlayClick={false}
          closeOnEsc={false}
        >
          <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className={styles.formGrid}>
              {/* Section 1: Identifikasi ECN & Model */}
              <div className={styles.formSectionHeader}>
                <Layers size={13} />
                <span>1. Identifikasi ECN & Model</span>
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>ECN NO *</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder="Contoh: GHW260105001"
                  value={formData.ecn_no}
                  onChange={(e) => setFormData({ ...formData, ecn_no: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Model *</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder="Contoh: SM-S947B"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Function Type</label>
                <select
                  className={styles.formSelect}
                  value={formData.function_type}
                  onChange={(e) => setFormData({ ...formData, function_type: e.target.value })}
                >
                  <option value="Circuit">Circuit</option>
                  <option value="Mechanism">Mechanism</option>
                  <option value="Software">Software</option>
                  <option value="Process">Process</option>
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Proses</label>
                <select
                  className={styles.formSelect}
                  value={formData.process}
                  onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                >
                  <option value="SMD">SMD</option>
                  <option value="Mainline">Mainline</option>
                  <option value="Vendor">Vendor</option>
                  <option value="PBA">PBA</option>
                </select>
              </div>

              {/* Section 2: Deskripsi & Parent Assembly */}
              <div className={styles.formSectionHeader}>
                <Boxes size={13} />
                <span>2. Deskripsi Perubahan & Parent Assembly</span>
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                <label className={styles.formLabel}>EC Title (Deskripsi Singkat Perubahan)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: [CIRCUIT] Change diode due to supplier issue"
                  value={formData.ec_title}
                  onChange={(e) => setFormData({ ...formData, ec_title: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Parent Code</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: GH82-39201A"
                  value={formData.parent_code}
                  onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Parent Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: PBA MAIN-SM-S947B"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                <label className={styles.formLabel}>Purpose</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: Quality Improvement"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                <label className={styles.formLabel}>Inventory Management</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: Use up old stock"
                  value={formData.inventory_mgmt}
                  onChange={(e) => setFormData({ ...formData, inventory_mgmt: e.target.value })}
                />
              </div>

              {/* Section 3: Detail Komponen & Spesifikasi */}
              <div className={styles.formSectionHeader}>
                <Cpu size={13} />
                <span>3. Detail Komponen & Spesifikasi</span>
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Child Code (Part Code)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: 0401-006201"
                  value={formData.child_code}
                  onChange={(e) => setFormData({ ...formData, child_code: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                <label className={styles.formLabel}>Child Name (Part Description)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: DIODE-SCHOTTKY"
                  value={formData.child_name}
                  onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Specification</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: 30V, 1A, SOD-323"
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Quantity</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: 1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Before / After</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: Before / After"
                  value={formData.before_after}
                  onChange={(e) => setFormData({ ...formData, before_after: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>D/L (Distribution Level)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: Level 1"
                  value={formData.dl}
                  onChange={(e) => setFormData({ ...formData, dl: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Marking Point</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: D201"
                  value={formData.marking_point}
                  onChange={(e) => setFormData({ ...formData, marking_point: e.target.value })}
                />
              </div>

              {/* Section 4: Jadwal & Status Implementasi */}
              <div className={styles.formSectionHeader}>
                <Clock size={13} />
                <span>4. Jadwal & Status Implementasi</span>
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Running Date BOM</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={formData.running_date_bom}
                  onChange={(e) => setFormData({ ...formData, running_date_bom: e.target.value })}
                  onClick={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (_) {}
                  }}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                <label className={styles.formLabel}>Distribution Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={formData.distribution_date}
                  onChange={(e) => setFormData({ ...formData, distribution_date: e.target.value })}
                  onClick={(e) => {
                    try {
                      e.target.showPicker?.();
                    } catch (_) {}
                  }}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                <label className={styles.formLabel}>Status</label>
                <select
                  className={styles.formSelect}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                  <option value="ECO Cancel">ECO Cancel</option>
                </select>
              </div>

              {/* Section 5: Remark Detail */}
              <div className={`${styles.formGroup} ${styles.colSpan4}`}>
                <label className={styles.formLabel}>Remark (Catatan Detail Teknis & Instruksi Khusus)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Tuliskan catatan teknis, nomor dokumen pendukung, nama engineer PIC, instruksi verifikasi line..."
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleRequestCloseForm}
              >
                Batal
              </button>
              <button type="submit" className={styles.btnPrimary}>
                Simpan Record ECN
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================
          MODAL 4: KONFIRMASI PERINGATAN TUTUP FORM (UNSAVED CHANGES GUARD)
          ======================================================================== */}
      {isCloseConfirmOpen && (
        <Modal
          isOpen={isCloseConfirmOpen}
          onClose={() => setIsCloseConfirmOpen(false)}
          title="Konfirmasi Tutup Form ECN"
          maxWidth="460px"
          zIndex={1100}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: 'var(--color-warning-subtle)',
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Batalkan pengisian form ECN?
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  Data yang telah Anda isi atau ubah pada form ini belum disimpan. Jika form ditutup sekarang, seluruh data yang diinput akan hilang.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsCloseConfirmOpen(false)}
              >
                Lanjutkan Mengisi
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => {
                  setIsCloseConfirmOpen(false);
                  setIsFormModalOpen(false);
                  setEditingItem(null);
                }}
              >
                Ya, Tutup Form
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EcnMonitoringPage;
