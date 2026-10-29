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
  ArrowLeftRight,
  RotateCcw,
  Copy,
  Bell,
  Calendar,
  History,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import { EcnReminderModal } from '../components/ecn/EcnReminderModal';
import { RichMessageContent } from '../components/chat/AiChatWindow';
import { AiThinkingProgress } from '../components/common/AiThinkingProgress';
import { portalConfirm, portalAlert } from '../contexts/ConfirmContext';
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

// ponytail: Detect part number changes (e.g. GH63-23138A -> GH63-23137A or 0401-006201 -> 0401-006202)
const parsePartChange = (remark, ecTitle) => {
  const text = `${remark || ''} ${ecTitle || ''}`;
  const regex = /([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)\s*(?:->|➔|→|=>|to)\s*([A-Za-z0-9]{2,6}-[A-Za-z0-9]{4,7}[A-Za-z0-9]?)/i;
  const match = text.match(regex);
  if (match) {
    return { before: match[1].trim(), after: match[2].trim() };
  }
  return { before: '', after: '' };
};

const DEFAULT_COLUMN_WIDTHS = {
  ecn_no: 135,
  model: 115,
  function_type: 95,
  process: 90,
  ec_title: 220,
  part_before: 130,
  part_after: 130,
  child_code: 125,
  child_name: 180,
  specification: 180,
  quantity: 70,
  running_date_bom: 125,
  distribution_date: 125,
  status: 115,
  author_name: 150,
};

const MIN_COLUMN_WIDTHS = {
  ecn_no: 90,
  model: 70,
  function_type: 65,
  process: 65,
  ec_title: 110,
  part_before: 85,
  part_after: 85,
  child_code: 80,
  child_name: 90,
  specification: 90,
  quantity: 50,
  running_date_bom: 90,
  distribution_date: 90,
  status: 80,
  author_name: 90,
};

export const EcnMonitoringPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  // --- Column Widths & Drag Resize State (ponytail) ---
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('ecn_col_widths');
      if (saved) return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_COLUMN_WIDTHS;
  });
  const [resizingCol, setResizingCol] = useState(null);

  const handleStartResize = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = colWidths[columnKey] || DEFAULT_COLUMN_WIDTHS[columnKey] || 120;
    const minWidth = MIN_COLUMN_WIDTHS[columnKey] || 60;

    setResizingCol(columnKey);
    document.body.style.cursor = 'col-resize';
    const handlePointerMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.round(startWidth + delta));
      setColWidths((prev) => ({ ...prev, [columnKey]: newWidth }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizingCol(null);

      setColWidths((latest) => {
        try {
          localStorage.setItem('ecn_col_widths', JSON.stringify(latest));
        } catch (_) {}
        return latest;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  };

  const handleResetColWidth = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultW = DEFAULT_COLUMN_WIDTHS[columnKey] || 120;
    setColWidths((prev) => {
      const updated = { ...prev, [columnKey]: defaultW };
      try {
        localStorage.setItem('ecn_col_widths', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleResetAllColWidths = () => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem('ecn_col_widths');
    } catch (_) {}
  };

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
    part_before: '',
    part_after: '',
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
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  // ponytail: active reminder schedule & due count badge state
  const [reminderStatus, setReminderStatus] = useState(null);

  const fetchReminderStatus = useCallback(async () => {
    try {
      const res = await api.get('/ecn/reminder/settings');
      setReminderStatus(res.data);
    } catch {
      // silent fallback
    }
  }, []);

  const formatReminderSchedule = (settings) => {
    if (!settings || !settings.is_enabled) return null;
    const rawTimes = (settings.send_time || '08:00')
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const timesStr = rawTimes.length <= 2 ? rawTimes.join(', ') : `${rawTimes[0]}, ${rawTimes[1]} (+${rawTimes.length - 2})`;
    return `${timesStr} • H-${settings.days_before || 1}`;
  };

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
  const [ecnChangeLogs, setEcnChangeLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // ponytail: Shortcut filter to only show records with Part Number Changes
  const [onlyPartChanges, setOnlyPartChanges] = useState(false);

  // ponytail: Modal form accordion state for Sections 1, 2, 3, 4, 5 (default 1,2,3 collapsed, 4 expanded)
  const [openSections, setOpenSections] = useState({
    1: false,
    2: false,
    3: false,
    4: true,
    5: true,
  });

  const toggleSection = (secNum) => {
    setOpenSections((prev) => ({
      ...prev,
      [secNum]: !prev[secNum],
    }));
  };
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
    part_before: '',
    part_after: '',
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
      formData.part_before.trim() ||
      formData.part_after.trim() ||
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
      isWelcome: true,
      content: t(
        'ecn.ai.welcome_msg',
        'Halo! Saya asisten AI spesialis **ECN Monitoring SEIN PE**.\n\nSaya menganalisis seluruh database ECN yang sedang aktif (terfilter).\nAnda dapat menanyakan hal-hal seperti:\n- **Ringkasan ECN** model tertentu\n- **Analisis pergantian komponen/supplier** pada kolom *Remark*\n- Cek status **ECO Cancel** atau **In Progress**\n- Rekomendasi verifikasi **Running BOM**'
      ),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Dynamically update welcome message when language changes (ko, en, id)
  useEffect(() => {
    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.isWelcome
          ? {
              ...msg,
              content: t(
                'ecn.ai.welcome_msg',
                'Halo! Saya asisten AI spesialis **ECN Monitoring SEIN PE**.\n\nSaya menganalisis seluruh database ECN yang sedang aktif (terfilter).\nAnda dapat menanyakan hal-hal seperti:\n- **Ringkasan ECN** model tertentu\n- **Analisis pergantian komponen/supplier** pada kolom *Remark*\n- Cek status **ECO Cancel** atau **In Progress**\n- Rekomendasi verifikasi **Running BOM**'
              ),
            }
          : msg
      )
    );
  }, [i18n.language, t]);
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

  // Debounce column filters & reset to page 1 for whole-database search (ponytail)
  const [debouncedColFilters, setDebouncedColFilters] = useState(colFilters);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedColFilters(colFilters);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [colFilters]);

  // Reset page when toolbar filters change
  useEffect(() => {
    setPage(1);
  }, [selectedModel, selectedStatus, selectedProcess, selectedFunction]);

  // Fetch ECN Records List from Backend (Server-side whole database filter & pagination)
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
        // Header column filters for full DB search across pagination
        ecn_no: debouncedColFilters.ecn_no?.trim() || undefined,
        col_model: debouncedColFilters.model?.trim() || undefined,
        col_function_type: debouncedColFilters.function_type || undefined,
        col_process: debouncedColFilters.process || undefined,
        col_status: debouncedColFilters.status || undefined,
        ec_title: debouncedColFilters.ec_title?.trim() || undefined,
        col_part_before: debouncedColFilters.part_before?.trim() || undefined,
        col_part_after: debouncedColFilters.part_after?.trim() || undefined,
        has_part_change: onlyPartChanges ? 'true' : undefined,
        child_code: debouncedColFilters.child_code?.trim() || undefined,
        child_name: debouncedColFilters.child_name?.trim() || undefined,
        specification: debouncedColFilters.specification?.trim() || undefined,
        quantity: debouncedColFilters.quantity?.trim() || undefined,
        running_date_bom: debouncedColFilters.running_date_bom || undefined,
        distribution_date: debouncedColFilters.distribution_date || undefined,
        author_name: debouncedColFilters.author_name?.trim() || undefined,
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
  }, [
    page,
    limit,
    debouncedSearch,
    debouncedColFilters,
    selectedModel,
    selectedStatus,
    selectedProcess,
    selectedFunction,
    sortKey,
    sortDirection,
    onlyPartChanges,
  ]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchReminderStatus();
  }, [fetchReminderStatus]);

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
      part_before: '',
      part_after: '',
      child_code: '',
      child_name: '',
      specification: '',
      quantity: '',
      running_date_bom: '',
      distribution_date: '',
      status: '',
      author_name: '',
    });
    setOnlyPartChanges(false);
    setPage(1);
  };

  // ponytail: records are already filtered, sorted, and paginated by PostgreSQL across the entire database
  const displayedRecords = records;

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

  const totalColSpan = (isAdmin ? 1 : 0) + 1 + 15 + 1;

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
        running_date_bom: normalizeToDateInput(cols[16]) || cols[16] || '',
        distribution_date: normalizeToDateInput(cols[17]) || cols[17] || '',
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

      // ponytail: Auto-detect part number changes
      const partChange = parsePartChange(record.remark, record.ec_title);
      record.part_before = partChange.before || '';
      record.part_after = partChange.after || '';

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
    setEcnChangeLogs([]);
    if (item?.id) {
      setLogsLoading(true);
      api.get(`/ecn/${item.id}/logs`)
        .then((res) => setEcnChangeLogs(res.data || []))
        .catch(() => setEcnChangeLogs([]))
        .finally(() => setLogsLoading(false));
    }
    const detected = parsePartChange(item.remark, item.ec_title);
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
      part_before: item.part_before || detected.before || '',
      part_after: item.part_after || detected.after || '',
      before_after: item.before_after || '',
      dl: item.dl || '',
      child_code: item.child_code || '',
      child_name: item.child_name || '',
      specification: item.specification || '',
      quantity: item.quantity || '',
      marking_point: item.marking_point || '',
      running_date_bom: normalizeToDateInput(item.running_date_bom),
      distribution_date: normalizeToDateInput(item.distribution_date),
      status: item.status || 'Pending',
      remark: item.remark || '',
    });
    // ponytail: Default 1,2,3 collapse and 4 expand when editing (sections 1-5)
    setOpenSections({
      1: false,
      2: false,
      3: false,
      4: true,
      5: true,
    });
    setIsFormModalOpen(true);
  };

  // ponytail: Auto-detect part numbers from Remark/Title in form modal
  const handleAutoDetectPart = () => {
    const detected = parsePartChange(formData.remark, formData.ec_title);
    if (detected.before || detected.after) {
      setFormData((prev) => ({
        ...prev,
        part_before: detected.before || prev.part_before,
        part_after: detected.after || prev.part_after,
      }));
    }
  };

  // ponytail: Warning confirmation modal when picking/changing critical Running BOM date
  const handleRunningBomDateChange = async (newVal) => {
    const currentVal = normalizeToDateInput(formData.running_date_bom);
    const normalizedNew = normalizeToDateInput(newVal);
    if (normalizedNew === currentVal) return;

    const ok = await portalConfirm({
      title: t('ecn.alert_running_bom.title', 'Peringatan Perubahan Running Date BOM'),
      message: currentVal
        ? t(
            'ecn.alert_running_bom.msg_change',
            'Jadwal Running BOM adalah milestone KRITIKAL yang menentukan kesiapan material di lini produksi. Mengubah jadwal ini dapat mempengaruhi perencanaan produksi dan monitoring line. Apakah Anda yakin ingin mengubah jadwal ini?'
          )
        : t(
            'ecn.alert_running_bom.msg_set',
            'Jadwal Running BOM adalah milestone KRITIKAL yang menentukan kesiapan material di lini produksi. Pastikan tanggal yang dipilih telah diverifikasi bersama tim PPIC dan Line Leader.'
          ),
      highlight: currentVal ? `${currentVal} ➔ ${normalizedNew || '(Dikosongkan)'}` : `Jadwal Dipilih: ${normalizedNew}`,
      confirmText: t('ecn.alert_running_bom.confirm', 'Ya, Tetapkan Tanggal'),
      cancelText: t('common.cancel', 'Batal'),
      variant: 'warning',
    });

    if (!ok) {
      return;
    }

    setFormData((prev) => ({ ...prev, running_date_bom: normalizedNew }));
  };

  const handleDeleteClick = async (id, ecnNo) => {
    const ok = await portalConfirm({
      title: 'Hapus Data ECN',
      message: `Yakin ingin menghapus ECN ${ecnNo}? Data riwayat ECN ini akan dihapus dari sistem.`,
      confirmText: 'Hapus ECN',
      variant: 'danger',
    });
    if (!ok) return;
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
      portalAlert(`Gagal menghapus ECN: ${err.message}`);
    }
  };

  // ponytail: Bulk delete handler for admin
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    const ok = await portalConfirm({
      title: 'Hapus Massal ECN',
      message: `Yakin ingin menghapus ${count} data ECN yang dipilih? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: `Hapus ${count} ECN`,
      variant: 'danger',
    });
    if (!ok) return;
    setIsBulkDeleting(true);
    try {
      const res = await api.post('/ecn/bulk-delete', { ids: Array.from(selectedIds) });
      portalAlert(res.data?.message || `Berhasil menghapus ${count} data ECN.`);
      setSelectedIds(new Set());
      fetchRecords();
      fetchStats();
    } catch (err) {
      portalAlert(`Gagal menghapus data ECN: ${err.response?.data?.message || err.message}`);
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
        remark: r.remark ? (r.remark.length > 800 ? r.remark.substring(0, 800) + '...' : r.remark) : '',
      }));

      const activeColFilterList = Object.entries(colFilters)
        .filter(([_, val]) => Boolean(val && String(val).trim()))
        .map(([key, val]) => `${key.replace(/_/g, ' ')}: "${String(val).trim()}"`);

      const activeFilterSummary = [
        selectedModel ? `Model: ${selectedModel}` : '',
        selectedProcess ? `Process: ${selectedProcess}` : '',
        selectedStatus ? `Status: ${selectedStatus}` : '',
        search ? `Global Search: "${search}"` : '',
        ...activeColFilterList,
      ].filter(Boolean).join(', ');

      const systemPrompt = `Anda adalah asisten AI Production Engineering (PE) spesialis ECN Monitoring di PT Samsung Electronics Indonesia (SEIN).
Anda terhubung langsung dengan seluruh database PostgreSQL ECN melalui SEIN PE-Portal MCP Tools (pe_search_ecn & pe_get_ecn_statistics).
Tugas Anda adalah menganalisis data Engineering Change Notice (ECN) baik pada sampel aktif di tabel UI maupun seluruh database ribuan data ECN secara real-time.

=== INFORMASI TAMPILAN UI & FILTER AKTIF ===
Total Database: ${totalRecords} data
Baris Aktif Ditampilkan: ${displayedRecords.length} data
Filter UI yang Diterapkan User: ${activeFilterSummary || 'None (Semua Data)'}

=== SAMPEL DATA ECN TAMPILAN AKTIF (SAMPEL TERMUAT: ${contextSummary.length} BARIS) ===
${JSON.stringify(contextSummary, null, 2)}
========================================================================================

Catatan Penting:
- Anda memiliki akses langsung ke seluruh ribuan data ECN melalui MCP Server terintegrasi (pe_search_ecn & pe_get_ecn_statistics).
- Jika pengguna menanyakan ringkasan total, statistik menyeluruh, atau pencarian part di luar 35 baris tampilan UI di atas, gunakan data hasil MCP yang diinjeksi secara live oleh server.
- Penanganan Remark Panjang: Kolom Remark sering berisi catatan teknis krusial (alasan modifikasi komponen, instruksi rework lini, verifikasi QA, approval Korea HQ, atau kompatibilitas vendor). Jika ada pertanyaan mengenai Remark atau ECN tertentu, kutip atau jelaskan isi Remark secara LENGKAP dan DETAIL tanpa memotong instruksi teknis yang penting.

Panduan Format Respons:
1. Gunakan Markdown yang kaya dan terstruktur: **bold** untuk penekanan, *italic* untuk istilah teknis, \`code\` untuk nomor part/kode, dan blockquote (\`> \`) untuk peringatan teknis atau kutipan remark lengkap.
2. Gunakan bullet list (\`- \`) atau numbered list (\`1. \`) untuk poin-poin penjelasan.
3. Jika menampilkan komparasi data atau daftar ECN, gunakan Markdown Table (\`| ECN NO | Model | Status | Keterangan / Remark |\`) agar rapi.
${
  i18n.language === 'ko'
    ? '4. 답변은 한국어로 정중하고 전문적인 어조로 작성하며, 비고(Remark) 내용이 길더라도 핵심 기술 지침과 변경 사유를 누락 없이 상세히 설명하십시오.'
    : i18n.language === 'en'
    ? '4. Respond directly and concisely in English suitable for Production Engineers. Provide complete details from the Remark field without omitting technical instructions.'
    : '4. Jawablah langsung pada inti pertanyaan dengan bahasa Indonesia yang baku bagi Production Engineer. Jabarkan detail isi Remark secara utuh tanpa memangkas instruksi penting.'
}`;

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

      const reply = res.data?.reply || t('ecn.ai.no_reply', 'Tidak ada balasan dari AI.');
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
          content: t(
            'ecn.ai.comm_error',
            '⚠️ **Maaf, terjadi kendala komunikasi dengan AI**: {{error}}',
            { error: err.response?.data?.message || err.message }
          ),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Status Badge Class Helper
  // ponytail: Normalize multi-format date strings (M/D/YYYY, YYYY.MM.DD, etc.) into HTML5 input date 'YYYY-MM-DD'
  const normalizeToDateInput = (val) => {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'eco cancel') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const parts = trimmed.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      if (parts[2].length === 4) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const y = parts[2];
        const m = p1 > 12 ? String(p2).padStart(2, '0') : String(p1).padStart(2, '0');
        const d = p1 > 12 ? String(p1).padStart(2, '0') : String(p2).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    const d = new Date(trimmed);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  };

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
            <span>{t('sidebar.section_operations', 'Operations')}</span>
            <span>/</span>
            <span>{t('ecn.title', 'ECN Monitoring')}</span>
          </div>
          <h1 className={styles.pageTitle}>
            <FileSpreadsheet className="w-6 h-6 text-teal-600" />
            {t('ecn.title', 'ECN Monitoring')}
            <span className={styles.titleBadge}>SEIN Production Engineering</span>
          </h1>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsReminderModalOpen(true)}
            title={t('ecn.reminder.btn_title', 'Pengaturan Pengingat Email Running BOM')}
          >
            <Bell size={15} style={{ color: 'var(--color-accent, #0d7377)' }} />
            <span>{t('ecn.reminder.btn_label', 'Pengingat Running BOM')}</span>
            {/* ponytail: active schedule chip & due count badge */}
            {reminderStatus?.settings && (
              reminderStatus.settings.is_enabled ? (
                <>
                  <span className={styles.reminderChip}>
                    <span className={styles.reminderChipDot} />
                    <span>{formatReminderSchedule(reminderStatus.settings)}</span>
                  </span>
                  {reminderStatus.due_count > 0 && (
                    <span
                      className={styles.reminderDueBadge}
                      title={`${reminderStatus.due_count} ECN Running BOM jatuh tempo (${reminderStatus.target_date || ''})`}
                    >
                      {reminderStatus.due_count} Due
                    </span>
                  )}
                </>
              ) : (
                <span className={`${styles.reminderChip} ${styles.reminderChipDisabled}`}>
                  Off
                </span>
              )
            )}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsPasteModalOpen(true)}
            title={t('ecn.paste_excel', 'Paste Tabel Excel')}
          >
            <ClipboardPaste size={15} />
            {t('ecn.paste_excel', 'Paste Table')}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsUploadModalOpen(true)}
            title={t('ecn.upload_excel', 'Upload Excel')}
          >
            <Upload size={15} />
            {t('ecn.upload_excel', 'Upload Excel')}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleExportCSV}
            title={t('ecn.export_csv', 'Export CSV')}
          >
            <Download size={15} />
            {t('ecn.export_csv', 'Export CSV')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              setEditingItem(null);
              setEcnChangeLogs([]);
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
                part_before: '',
                part_after: '',
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
              setOpenSections({
                1: true,
                2: true,
                3: true,
                4: true,
                5: false,
              });
              setIsFormModalOpen(true);
            }}
          >
            <Plus size={15} />
            {t('ecn.add_ecn', 'Manual Entry')}
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
            <span className={styles.statLabel}>{t('ecn.stats.total', 'Total ECN Records')}</span>
            <span className={styles.statValue}>{stats.total.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{t('ecn.stats.completed', 'ECN Completed')}</span>
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
            <span className={styles.statLabel}>{t('ecn.stats.active_bom', 'Active Models')}</span>
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
              {t('ecn.ai.title', 'SEIN ECN Engineering AI Assistant')}
              <span className={styles.aiContextBadge}>
                {displayedRecords.length === totalRecords
                  ? t('ecn.ai.context_badge_full', {
                      total: totalRecords,
                      defaultValue: `⚡ Full DB MCP: ${totalRecords} data`,
                    })
                  : t('ecn.ai.context_badge_filtered', {
                      total: totalRecords,
                      active: displayedRecords.length,
                      defaultValue: `⚡ Full DB MCP: ${totalRecords} data (Tabel: ${displayedRecords.length} difilter)`,
                    })}
              </span>
            </h3>
            <span className={styles.aiOnlinePill}>
              <span className={styles.aiOnlineDot} />
              {t('ecn.ai.llm_ready', 'LLM Ready')}
            </span>
          </div>
          <div className={styles.aiAccordionActions}>
            <span className={styles.aiToggleText}>
              {isAiAccordionOpen
                ? t('ecn.ai.hide_assistant', 'Sembunyikan Asisten AI')
                : t('ecn.ai.show_assistant', 'Buka Asisten AI')}
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
                onClick={() =>
                  handleSendAiMessage(
                    t('ecn.ai.prompt_in_progress', 'Ringkas seluruh ECN yang berstatus Progress beserta dampaknya.')
                  )
                }
              >
                {t('ecn.ai.chip_in_progress', '💡 ECN Progress')}
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() =>
                  handleSendAiMessage(
                    t('ecn.ai.prompt_material', 'Apakah ada perubahan material kritis, FET, atau supplier pada kolom Remark?')
                  )
                }
              >
                {t('ecn.ai.chip_material', '⚠️ Isu Material & Supplier')}
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() =>
                  handleSendAiMessage(
                    t('ecn.ai.prompt_cancelled', 'Berapa banyak ECN yang statusnya ECO Cancel dan apa alasannya?')
                  )
                }
              >
                {t('ecn.ai.chip_cancelled', '❌ ECN Dibatalkan (Cancel)')}
              </button>
              <button
                type="button"
                className={styles.aiChipBtn}
                onClick={() =>
                  handleSendAiMessage(
                    t('ecn.ai.prompt_process', 'Jelaskan distribusi proses perubahan antara SMD, Mainline, dan Vendor.')
                  )
                }
              >
                {t('ecn.ai.chip_process', '📊 Distribusi Proses')}
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
                  <AiThinkingProgress
                    text={t('ecn.ai.thinking', 'AI sedang menganalisis database ECN...')}
                  />
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
                placeholder={t(
                  'ecn.ai.input_placeholder',
                  'Tanyakan analisis ECN, model, part number, perubahan spek, kendala material...'
                )}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isAiThinking}
              />
              <button
                type="button"
                className={styles.aiClearBtn}
                title={t('ecn.ai.clear_history', 'Bersihkan riwayat percakapan')}
                onClick={() =>
                  setChatMessages([
                    {
                      id: 'welcome',
                      role: 'assistant',
                      isWelcome: true,
                      content: t(
                        'ecn.ai.welcome_msg',
                        'Halo! Saya asisten AI spesialis **ECN Monitoring SEIN PE**.\n\nSaya menganalisis seluruh database ECN yang sedang aktif (terfilter).\nAnda dapat menanyakan hal-hal seperti:\n- **Ringkasan ECN** model tertentu\n- **Analisis pergantian komponen/supplier** pada kolom *Remark*\n- Cek status **ECO Cancel** atau **In Progress**\n- Rekomendasi verifikasi **Running BOM**'
                      ),
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="submit"
                className={styles.aiSendBtn}
                disabled={!chatInput.trim() || isAiThinking}
                title={t('ecn.ai.send_message', 'Kirim Pertanyaan')}
              >
                <Send size={14} />
                <span>{t('ecn.ai.send_btn', 'Kirim')}</span>
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
                placeholder={t('ecn.filter.search_placeholder', 'Pencarian cepat (ECN, Model, Title, Part)...')}
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
              <option value="">{t('ecn.filter.all_model', 'Semua Model')}</option>
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
              <option value="">{t('ecn.filter.all_status', 'Semua Status')}</option>
              <option value="Completed">Completed</option>
              <option value="Progress">Progress</option>
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
              <option value="">{t('ecn.filter.all_process', 'Semua Proses')}</option>
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
              <option value="">{t('ecn.filter.all_function', 'Semua Fungsi')}</option>
              <option value="Circuit">Circuit</option>
              <option value="Mechanism">Mechanism</option>
              <option value="Software">Software</option>
              <option value="Process">Process</option>
            </select>

            {/* ponytail: Shortcut filter for BOM Part Number Changes */}
            <button
              type="button"
              className={`${styles.shortcutFilterBtn} ${onlyPartChanges ? styles.shortcutFilterBtnActive : ''}`}
              onClick={() => {
                setOnlyPartChanges((prev) => !prev);
                setPage(1);
              }}
              title={t('ecn.filter.part_changes_tooltip', 'Tampilkan hanya data ECN yang memiliki perubahan Part Number (BOM Change)')}
            >
              <ArrowLeftRight size={13} />
              <span>{t('ecn.filter.part_changes_only', 'Part Change BOM')}</span>
              {onlyPartChanges && <span className={styles.activeDot} />}
            </button>
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
                title={t('ecn.filter.bulk_delete', 'Hapus data ECN terpilih')}
              >
                {isBulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{t('ecn.filter.bulk_delete', 'Hapus Terpilih')} ({selectedIds.size})</span>
              </button>
            )}

            {JSON.stringify(colWidths) !== JSON.stringify(DEFAULT_COLUMN_WIDTHS) && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleResetAllColWidths}
                title="Kembalikan semua lebar kolom ke ukuran standar"
                style={{ fontSize: '11px', padding: '0 8px', gap: '4px' }}
              >
                <RotateCcw size={11} />
                <span>Reset Kolom</span>
              </button>
            )}

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh', 'Refresh')}
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
                  <th
                    className={styles.stickyColCheckbox}
                    style={{ width: '38px', minWidth: '38px', maxWidth: '38px', textAlign: 'center' }}
                  >
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      title={t('ecn.filter.select_all', 'Pilih semua baris di halaman ini')}
                      style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                    />
                  </th>
                )}
                <th
                  className={isAdmin ? styles.stickyColHashAdmin : styles.stickyColHashUser}
                  style={{ width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center' }}
                >
                  #
                </th>
                {[
                  { key: 'ecn_no', label: t('ecn.table.ecn_no', 'ECN NO') },
                  { key: 'model', label: t('ecn.table.model', 'Model') },
                  { key: 'function_type', label: t('ecn.table.function', 'Function') },
                  { key: 'process', label: t('ecn.table.process', 'Process') },
                  { key: 'ec_title', label: t('ecn.table.ec_title', 'EC Title') },
                  { key: 'part_before', label: t('ecn.table.part_before', 'Part (Before)') },
                  { key: 'part_after', label: t('ecn.table.part_after', 'Part (After)') },
                  { key: 'child_code', label: t('ecn.table.child_code', 'Item Code') },
                  { key: 'child_name', label: t('ecn.table.child_name', 'Part Description') },
                  { key: 'specification', label: t('ecn.table.specification', 'Specification') },
                  { key: 'quantity', label: t('ecn.table.quantity', 'Qty') },
                  { key: 'running_date_bom', label: t('ecn.table.running_bom', 'Running BOM') },
                  { key: 'distribution_date', label: t('ecn.table.dist_date', 'Dist Date') },
                  { key: 'status', label: t('ecn.table.status', 'Status') },
                  { key: 'author_name', label: t('ecn.table.author', 'Uploader & Waktu') },
                ].map((col) => {
                  const width = colWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 120;
                  const minWidth = MIN_COLUMN_WIDTHS[col.key] || 60;
                  const isStickyEcn = col.key === 'ecn_no';
                  return (
                    <th
                      key={col.key}
                      className={`${styles.thSortable} ${
                        isStickyEcn ? (isAdmin ? styles.stickyColEcnAdmin : styles.stickyColEcnUser) : ''
                      }`}
                      onClick={() => handleSort(col.key)}
                      style={{
                        width: `${width}px`,
                        minWidth: `${minWidth}px`,
                        maxWidth: `${width}px`,
                      }}
                      title={`Sort: ${col.label}`}
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
                      <div
                        className={`${styles.colResizer} ${resizingCol === col.key ? styles.colResizerActive : ''}`}
                        onMouseDown={(e) => handleStartResize(e, col.key)}
                        onPointerDown={(e) => handleStartResize(e, col.key)}
                        onDoubleClick={(e) => handleResetColWidth(e, col.key)}
                        title="Tarik untuk ubah lebar kolom (Klik 2x untuk reset)"
                      />
                    </th>
                  );
                })}
                <th
                  className={styles.stickyColAction}
                  style={{ width: '85px', minWidth: '85px', maxWidth: '85px', textAlign: 'center' }}
                >
                  {t('ecn.table.actions', 'Aksi')}
                </th>
              </tr>

              {/* Row 2: Individual Column Filter Inputs */}
              <tr className={styles.columnFilterRow}>
                {isAdmin && (
                  <th
                    className={styles.stickyColCheckbox}
                    style={{ width: '38px', minWidth: '38px', maxWidth: '38px', textAlign: 'center', verticalAlign: 'middle' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>-</span>
                    </div>
                  </th>
                )}
                <th
                  className={isAdmin ? styles.stickyColHashAdmin : styles.stickyColHashUser}
                  style={{ width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center', verticalAlign: 'middle' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
                    <Filter size={12} style={{ opacity: 0.5 }} />
                  </div>
                </th>
                <th
                  className={isAdmin ? styles.stickyColEcnAdmin : styles.stickyColEcnUser}
                  style={{ width: `${colWidths.ecn_no}px`, minWidth: `${MIN_COLUMN_WIDTHS.ecn_no}px`, maxWidth: `${colWidths.ecn_no}px` }}
                >
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder={t('ecn.filter.filter_parent', 'Filter ECN...')}
                    value={colFilters.ecn_no}
                    onChange={(e) => setColFilters({ ...colFilters, ecn_no: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder={t('ecn.filter.model_placeholder', 'Filter model...')}
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
                    <option value="">{t('common.all', 'Semua')}</option>
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
                    <option value="">{t('common.all', 'Semua')}</option>
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
                    placeholder={t('ecn.filter.search_placeholder', 'Cari title...')}
                    value={colFilters.ec_title}
                    onChange={(e) => setColFilters({ ...colFilters, ec_title: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Part before..."
                    value={colFilters.part_before}
                    onChange={(e) => setColFilters({ ...colFilters, part_before: e.target.value })}
                  />
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder="Part after..."
                    value={colFilters.part_after}
                    onChange={(e) => setColFilters({ ...colFilters, part_after: e.target.value })}
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
                    title={t('ecn.table.running_bom', 'Pilih tanggal Running BOM')}
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
                    title={t('ecn.table.dist_date', 'Pilih tanggal Distribution Date')}
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
                    <option value="">{t('common.all', 'Semua')}</option>
                    <option value="Completed">Completed</option>
                    <option value="Progress">Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="ECO Cancel">ECO Cancel</option>
                  </select>
                </th>
                <th>
                  <input
                    type="text"
                    className={styles.colFilterInput}
                    placeholder={t('ecn.filter.filter_uploader', 'Filter uploader...')}
                    value={colFilters.author_name}
                    onChange={(e) => setColFilters({ ...colFilters, author_name: e.target.value })}
                  />
                </th>
                <th
                  className={styles.stickyColAction}
                  style={{ width: '85px', minWidth: '85px', maxWidth: '85px', textAlign: 'center' }}
                >
                  {hasActiveColFilters && (
                    <button
                      type="button"
                      className={styles.colFilterResetBtn}
                      title="Reset"
                      onClick={handleResetColFilters}
                    >
                      <RotateCcw size={10} />
                      {t('ecn.filter.reset', 'Reset')}
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
                      <span>{t('ecn.table.loading', 'Memuat data ECN Monitoring...')}</span>
                    </div>
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={totalColSpan} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <FileSpreadsheet size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {t('ecn.table.no_data', 'Tidak ada record ECN yang cocok')}
                      </span>
                      {hasActiveColFilters && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ marginTop: '0.5rem' }}
                          onClick={handleResetColFilters}
                        >
                          <RotateCcw size={13} />
                          {t('ecn.filter.reset', 'Bersihkan Filter Kolom')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((item, idx) => {
                  const isExpanded = expandedRowIds.has(item.id);
                  const partChange = parsePartChange(item.remark, item.ec_title);
                  const partBefore = item.part_before || partChange.before;
                  const partAfter = item.part_after || partChange.after;
                  const isEcnBom = Boolean(
                    (item.ec_title && item.ec_title.toUpperCase().includes('[ECN-BOM]')) ||
                    (partBefore && partAfter)
                  );
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`${isExpanded ? styles.rowExpanded : ''} ${selectedIds.has(item.id) ? styles.rowSelected : ''}`}>
                        {/* Checkbox for Admin */}
                        {isAdmin && (
                          <td
                            className={styles.stickyColCheckbox}
                            style={{ width: '38px', minWidth: '38px', maxWidth: '38px', textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
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
                        <td
                          className={isAdmin ? styles.stickyColHashAdmin : styles.stickyColHashUser}
                          style={{ width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center' }}
                        >
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
                        <td
                          className={isAdmin ? styles.stickyColEcnAdmin : styles.stickyColEcnUser}
                          style={{ width: `${colWidths.ecn_no}px`, minWidth: `${MIN_COLUMN_WIDTHS.ecn_no}px`, maxWidth: `${colWidths.ecn_no}px` }}
                        >
                          <span className={styles.ecnBadge} title={item.ecn_no}>
                            {item.ecn_no}
                          </span>
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
                            {isEcnBom && !item.ec_title?.toUpperCase().includes('[ECN-BOM]') && (
                              <span className={styles.ecnBomTag}>[ECN-BOM]</span>
                            )}
                            {item.ec_title || '-'}
                          </div>
                        </td>

                        {/* Part Before (Lama) - ponytail */}
                        <td>
                          {partBefore ? (
                            <span className={styles.partBeforeBadge} title={`Part Lama (Before): ${partBefore}`}>
                              <span className={styles.partSubTagOld}>OLD</span>
                              <span className={styles.partMono}>{partBefore}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </td>

                        {/* Part After (Baru) - ponytail */}
                        <td>
                          {partAfter ? (
                            <span className={styles.partAfterBadge} title={`Part Baru (After): ${partAfter}`}>
                              <span className={styles.partSubTagNew}>NEW</span>
                              <span className={styles.partMono}>{partAfter}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
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

                        {/* Running Date BOM (Highlighted Critical Milestone - ponytail) */}
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {item.running_date_bom ? (
                            <span className={styles.runningBomBadge} title={`Running BOM Target: ${item.running_date_bom}`}>
                              <Calendar size={12} className={styles.runningBomIcon} />
                              {item.running_date_bom}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </td>

                        {/* Distribution Date */}
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {item.distribution_date || '-'}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={getStatusBadgeClass(item.status)}>{item.status || 'Pending'}</span>
                        </td>

                        {/* Author & Timestamp (Latest Update - ponytail) */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                                {item.updater_name || item.author_name || 'System'}
                              </span>
                              <span className={`${styles.logBadge} ${item.updater_name ? styles.logBadgeUpdated : styles.logBadgeCreated}`}>
                                {item.updater_name ? 'Updated' : 'Created'}
                              </span>
                            </div>
                            <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {(item.updated_at || item.created_at)
                                ? new Date(item.updated_at || item.created_at).toLocaleString('id-ID', {
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
                        <td
                          className={styles.stickyColAction}
                          style={{ width: '85px', minWidth: '85px', maxWidth: '85px', textAlign: 'center', whiteSpace: 'nowrap' }}
                        >
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
                                <span className={styles.detailLabel}>{t('ecn.detail.parent_code', 'Parent Code')}</span>
                                <span className={styles.detailValue} style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                  {item.parent_code || '-'}
                                </span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.detail.parent_name', 'Parent Name')}</span>
                                <span className={styles.detailValue}>{item.parent_name || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.table.purpose', 'Purpose')}</span>
                                <span className={styles.detailValue}>{item.purpose || '-'}</span>
                              </div>
                              {(item.part_before || item.part_after || partBefore || partAfter) && (
                                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                  <span className={styles.detailLabel}>Perubahan Part (BOM Change)</span>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                    <span className={styles.partBeforeBadge}>
                                      <span className={styles.partSubTagOld}>OLD</span>
                                      <span className={styles.partMono}>{item.part_before || partBefore || '-'}</span>
                                    </span>
                                    <span style={{ color: 'var(--color-text-muted)' }}>➔</span>
                                    <span className={styles.partAfterBadge}>
                                      <span className={styles.partSubTagNew}>NEW</span>
                                      <span className={styles.partMono}>{item.part_after || partAfter || '-'}</span>
                                    </span>
                                  </div>
                                </div>
                              )}
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.table.inventory_mgmt', 'Inventory Mgmt')}</span>
                                <span className={styles.detailValue}>{item.inventory_mgmt || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.detail.before_after', 'Before / After')}</span>
                                <span className={styles.detailValue}>{item.before_after || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.detail.dl', 'D/L (Distribution Level)')}</span>
                                <span className={styles.detailValue}>{item.dl || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.detail.marking_point', 'Marking Point')}</span>
                                <span className={styles.detailValue}>{item.marking_point || '-'}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>{t('ecn.detail.uploader_data', 'Author / Uploader')}</span>
                                <span className={styles.detailValue} style={{ fontWeight: 600 }}>
                                  {item.author_name || 'System'}
                                </span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Record ID & Timestamp</span>
                                <span className={styles.detailValue} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  {item.id} ({item.created_at ? new Date(item.created_at).toLocaleString() : '-'})
                                </span>
                              </div>

                              <div className={styles.remarkBox}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span className={styles.detailLabel}>{t('ecn.detail.remark_title', 'Remark / Catatan Teknis:')}</span>
                                  {item.remark && item.remark.length > 200 && (
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                      {item.remark.length.toLocaleString()} {t('ecn.detail.characters', 'karakter')}
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
                                    {t('ecn.detail.no_remark', 'Tidak ada catatan remark untuk record ini.')}
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
            {t('ecn.pagination.showing', 'Menampilkan')} <strong>{displayedRecords.length}</strong> {t('ecn.pagination.of', 'dari')}{' '}
            <strong>{totalRecords}</strong> {t('ecn.pagination.data', 'data ECN')} ({t('ecn.pagination.page', 'Halaman')}{' '}
            <strong>{page}</strong> {t('ecn.pagination.of', 'dari')} <strong>{totalPages}</strong>)
          </div>

          <div className={styles.paginationControlsWrapper}>
            {/* Limit selector */}
            <div className={styles.paginationLimit}>
              <span className={styles.paginationSortLabel}>{t('ecn.pagination.display', 'Tampilkan:')}</span>
              <select
                className={styles.paginationSortSelect}
                value={limit >= 10000 ? 'all' : limit}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 10000 : parseInt(e.target.value, 10);
                  setLimit(val);
                  setPage(1);
                }}
                title="Limit per page"
              >
                <option value="10">10 {t('ecn.pagination.per_page', '/ hal')}</option>
                <option value="50">50 {t('ecn.pagination.per_page', '/ hal')}</option>
                <option value="100">100 {t('ecn.pagination.per_page', '/ hal')}</option>
                <option value="all">{t('ecn.pagination.all', 'Semua (All)')}</option>
              </select>
            </div>

            {/* Sort By controls */}
            <div className={styles.paginationSort}>
              <span className={styles.paginationSortLabel}>
                <ArrowUpDown size={12} />
                <span>{t('ecn.pagination.sort_by', 'Urutkan:')}</span>
              </span>
              <select
                className={styles.paginationSortSelect}
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value);
                  setPage(1);
                }}
                title="Sort column"
              >
                <option value="created_at">{t('ecn.table.author', 'Waktu Dibuat')}</option>
                <option value="ecn_no">{t('ecn.table.ecn_no', 'ECN NO')}</option>
                <option value="model">{t('ecn.table.model', 'Model')}</option>
                <option value="function_type">{t('ecn.table.function', 'Function')}</option>
                <option value="process">{t('ecn.table.process', 'Process')}</option>
                <option value="ec_title">{t('ecn.table.ec_title', 'EC Title')}</option>
                <option value="child_code">{t('ecn.table.child_code', 'Item Code')}</option>
                <option value="child_name">{t('ecn.table.child_name', 'Part Description')}</option>
                <option value="specification">{t('ecn.table.specification', 'Specification')}</option>
                <option value="quantity">{t('ecn.table.quantity', 'Qty')}</option>
                <option value="running_date_bom">{t('ecn.table.running_bom', 'Running BOM')}</option>
                <option value="distribution_date">{t('ecn.table.dist_date', 'Dist Date')}</option>
                <option value="status">{t('ecn.table.status', 'Status')}</option>
                <option value="author_name">{t('ecn.filter.filter_uploader', 'Uploader')}</option>
              </select>
              <button
                type="button"
                className={styles.paginationSortDirBtn}
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
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
                {t('ecn.pagination.prev', 'Sebelumnya')}
              </button>
              <span style={{ fontWeight: 600 }}>{page}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('ecn.pagination.next', 'Selanjutnya')}
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
          title={t('ecn.paste_modal.title', 'Bulk Import via Paste Table (Bypass DRM NASCA)')}
          maxWidth="900px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.drmAlertBox}>
              <Sparkles size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
              <div>
                <strong>{t('ecn.paste_modal.drm_notice_title', 'Metode Bypass Samsung NASCA DRM:')}</strong>
                <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  {t('ecn.paste_modal.drm_notice_desc', 'Buka dokumen Excel Anda di PC (aplikasi Microsoft Excel membuka data terdekripsi secara otomatis). Tekan Ctrl+A lalu Ctrl+C, kemudian paste di bawah.')}
                </p>
              </div>
            </div>

            <textarea
              className={styles.formTextarea}
              style={{ minHeight: '140px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px' }}
              placeholder={t('ecn.paste_modal.placeholder', 'Paste data sel dari Excel di sini (Ctrl+V)... Kolom: ECN NO, MODEL, Function Type, Purpose, Inventory, Process, EC Title, dll.')}
              value={pasteRawText}
              onChange={(e) => handleParsePasteText(e.target.value)}
            />

            {parsedPasteRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    {t('ecn.paste_modal.preview_title', 'Preview Data Siap Impor')} ({parsedPasteRows.length} {t('ecn.paste_modal.rows', 'baris')}):
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>{t('ecn.paste_modal.valid_format', '✓ Format Kolom Valid')}</span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                  <table className={styles.table} style={{ fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>{t('ecn.table.ecn_no', 'ECN NO')}</th>
                        <th>{t('ecn.table.model', 'Model')}</th>
                        <th>{t('ecn.table.process', 'Process')}</th>
                        <th>{t('ecn.table.ec_title', 'EC Title')}</th>
                        <th>{t('ecn.table.child_code', 'Child Code')}</th>
                        <th>{t('ecn.table.status', 'Status')}</th>
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
                    {t('ecn.pagination.showing', 'Menampilkan')} 10 {t('ecn.paste_modal.rows', 'baris')} {t('ecn.pagination.of', 'dari')} {parsedPasteRows.length} {t('ecn.paste_modal.rows', 'baris')}.
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
                {t('ecn.paste_modal.cancel', 'Batal')}
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
                    {t('ecn.paste_modal.importing', 'Mengimpor...')}
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    {t('ecn.paste_modal.import_btn', { count: parsedPasteRows.length, defaultValue: `Impor ${parsedPasteRows.length} Baris ECN` })}
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
          title={t('ecn.upload_modal.title', 'Upload Dokumen Excel (.xlsx)')}
          maxWidth="600px"
        >
          <form onSubmit={handleUploadExcelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {t('ecn.upload_modal.supported_format', 'Format Didukung: .xlsx (BOM / PLM Export SEIN)')}
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
                    {t('ecn.paste_excel', 'Buka Paste Table Sekarang')}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className={styles.formLabel}>{t('ecn.upload_modal.click_or_drag', 'Pilih File Excel:')}</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className={styles.formInput}
                disabled={isUploading}
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
              />
            </div>

            {/* Fallback Progress Container for Large Excel Uploads */}
            {isUploading && (
              <div className={styles.uploadProgressBox}>
                <div className={styles.progressHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                    <span>
                      {uploadStage === 'uploading'
                        ? `${t('ecn.paste_modal.importing', 'Mengunggah')} (${uploadProgress}%)`
                        : uploadStage === 'parsing'
                        ? 'Membaca & Memproses Excel...'
                        : uploadStage === 'importing'
                        ? 'Menyimpan Data ke Database...'
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
                  {uploadStatusText || t('ecn.upload_modal.drm_notice', 'Sedang memproses file...')}
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
                {t('ecn.upload_modal.cancel', 'Batal')}
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={!uploadFile || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {uploadStage === 'uploading'
                      ? `${t('ecn.paste_modal.importing', 'Mengunggah')} (${uploadProgress}%)...`
                      : 'Memproses File...'}
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {t('ecn.upload_modal.upload_parse', 'Unggah & Parse')}
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
          title={editingItem ? `${t('ecn.form_modal.edit_title', 'Edit Data ECN')} (${editingItem.ecn_no})` : t('ecn.form_modal.add_title', 'Tambah Data ECN Baru')}
          maxWidth="min(1380px, 98vw)"
          maxHeight="92vh"
          style={{ height: 'auto' }}
          closeOnOverlayClick={false}
          closeOnEsc={false}
        >
          <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* ponytail: Breadcrumb Log of Changes & Creation info */}
            {editingItem && (
              <div className={styles.breadcrumbLogStrip}>
                <div className={styles.breadcrumbLeft}>
                  <span className={styles.breadcrumbItem}>
                    <span className={`${styles.logBadge} ${styles.logBadgeCreated}`}>Dibuat</span>
                    <strong>{editingItem.created_by_name || editingItem.author_name || 'System'}</strong>
                    <span>({editingItem.created_at ? new Date(editingItem.created_at).toLocaleDateString('id-ID') : '-'})</span>
                  </span>
                  {editingItem.updater_name && (
                    <>
                      <span className={styles.breadcrumbArrow}>➔</span>
                      <span className={styles.breadcrumbItem}>
                        <span className={`${styles.logBadge} ${styles.logBadgeUpdated}`}>Diperbarui Terakhir</span>
                        <strong>{editingItem.updater_name}</strong>
                        <span>({editingItem.updated_at ? new Date(editingItem.updated_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'})</span>
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <History size={13} color="var(--color-accent)" />
                  <span>{ecnChangeLogs.length} Log Riwayat Tercatat</span>
                </div>
              </div>
            )}

            <div className={styles.accordionContainer}>
              {/* ================= SECTION 1 ACCORDION ================= */}
              <div className={`${styles.accordionSection} ${openSections[1] ? styles.accordionSectionActive : ''}`}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleSection(1)}
                  aria-expanded={openSections[1]}
                >
                  <div className={styles.accordionHeaderLeft}>
                    <span className={styles.accordionTitle}>
                      <Layers size={13} />
                      1. {t('ecn.form_modal.sec_general', 'Informasi Umum ECN')}
                    </span>
                    {!openSections[1] && (
                      <span className={styles.accordionSummary}>
                        {[formData.ecn_no, formData.model, formData.function_type, formData.process].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`${styles.accordionChevron} ${openSections[1] ? styles.accordionChevronRotated : ''}`}
                  />
                </button>

                {openSections[1] && (
                  <div className={styles.accordionBody}>
                    <div className={styles.formGrid}>
                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.table.ecn_no', 'ECN NO')} *</label>
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
                        <label className={styles.formLabel}>{t('ecn.table.model', 'Model')} *</label>
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
                        <label className={styles.formLabel}>{t('ecn.table.function', 'Function Type')}</label>
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
                        <label className={styles.formLabel}>{t('ecn.table.process', 'Proses')}</label>
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
                    </div>
                  </div>
                )}
              </div>

              {/* ================= SECTION 2 ACCORDION ================= */}
              <div className={`${styles.accordionSection} ${openSections[2] ? styles.accordionSectionActive : ''}`}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleSection(2)}
                  aria-expanded={openSections[2]}
                >
                  <div className={styles.accordionHeaderLeft}>
                    <span className={styles.accordionTitle}>
                      <Boxes size={13} />
                      2. {t('ecn.form_modal.sec_parent', 'Komponen Parent (Induk)')}
                    </span>
                    {!openSections[2] && (
                      <span className={styles.accordionSummary}>
                        {[formData.ec_title, formData.parent_name, formData.parent_code].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`${styles.accordionChevron} ${openSections[2] ? styles.accordionChevronRotated : ''}`}
                  />
                </button>

                {openSections[2] && (
                  <div className={styles.accordionBody}>
                    <div className={styles.formGrid}>
                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <label className={styles.formLabel}>{t('ecn.table.ec_title', 'EC Title')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: [CIRCUIT] Change diode due to supplier issue"
                          value={formData.ec_title}
                          onChange={(e) => setFormData({ ...formData, ec_title: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.detail.parent_code', 'Parent Code')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: GH82-39201A"
                          value={formData.parent_code}
                          onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.detail.parent_name', 'Parent Name')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: PBA MAIN-SM-S947B"
                          value={formData.parent_name}
                          onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <label className={styles.formLabel}>{t('ecn.table.purpose', 'Purpose')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: Quality Improvement"
                          value={formData.purpose}
                          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <label className={styles.formLabel}>{t('ecn.table.inventory_mgmt', 'Inventory Management')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: Use up old stock"
                          value={formData.inventory_mgmt}
                          onChange={(e) => setFormData({ ...formData, inventory_mgmt: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= SECTION 3 ACCORDION ================= */}
              <div className={`${styles.accordionSection} ${openSections[3] ? styles.accordionSectionActive : ''}`}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleSection(3)}
                  aria-expanded={openSections[3]}
                >
                  <div className={styles.accordionHeaderLeft}>
                    <span className={styles.accordionTitle}>
                      <Cpu size={13} />
                      3. {t('ecn.form_modal.sec_child', 'Komponen Child (Anak / Komponen Baru)')}
                    </span>
                    {!openSections[3] && (
                      <span className={styles.accordionSummary}>
                        {[formData.child_code, formData.child_name, formData.specification].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`${styles.accordionChevron} ${openSections[3] ? styles.accordionChevronRotated : ''}`}
                  />
                </button>

                {openSections[3] && (
                  <div className={styles.accordionBody}>
                    <div className={styles.formGrid}>
                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.table.child_code', 'Child Code (Part Code)')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: 0401-006201"
                          value={formData.child_code}
                          onChange={(e) => setFormData({ ...formData, child_code: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <label className={styles.formLabel}>{t('ecn.table.child_name', 'Child Name (Part Description)')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: DIODE-SCHOTTKY"
                          value={formData.child_name}
                          onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.table.specification', 'Specification')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: 30V, 1A, SOD-323"
                          value={formData.specification}
                          onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.table.quantity', 'Quantity')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: 1"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.detail.before_after', 'Before / After')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: Before / After"
                          value={formData.before_after}
                          onChange={(e) => setFormData({ ...formData, before_after: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.detail.dl', 'D/L (Distribution Level)')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: Level 1"
                          value={formData.dl}
                          onChange={(e) => setFormData({ ...formData, dl: e.target.value })}
                        />
                      </div>

                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <label className={styles.formLabel}>{t('ecn.detail.marking_point', 'Marking Point')}</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: D201"
                          value={formData.marking_point}
                          onChange={(e) => setFormData({ ...formData, marking_point: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= SECTION 4 ACCORDION (EXPANDED BY DEFAULT) ================= */}
              <div className={`${styles.accordionSection} ${openSections[4] ? styles.accordionSectionActive : ''}`}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleSection(4)}
                  aria-expanded={openSections[4]}
                >
                  <div className={styles.accordionHeaderLeft}>
                    <span className={styles.accordionTitle}>
                      <Clock size={13} />
                      4. {t('ecn.form_modal.sec_classification', 'Jadwal & Status Implementasi')}
                    </span>
                    {!openSections[4] && (
                      <span className={styles.accordionSummary}>
                        {[formData.running_date_bom ? `BOM: ${formData.running_date_bom}` : null, formData.distribution_date ? `Dist: ${formData.distribution_date}` : null, formData.status ? `Status: ${formData.status}` : null].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`${styles.accordionChevron} ${openSections[4] ? styles.accordionChevronRotated : ''}`}
                  />
                </button>

                {openSections[4] && (
                  <div className={styles.accordionBody}>
                    <div className={styles.formGrid}>
                      {/* Running Date BOM (Highlighted Critical Milestone - ponytail equal height) */}
                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <div className={styles.formLabelRow}>
                          <label className={`${styles.formLabel} ${styles.formLabelCritical}`}>
                            <Calendar size={13} color="#f59e0b" />
                            <span>{t('ecn.table.running_bom', 'Running Date BOM')}</span>
                          </label>
                          <span className={styles.criticalChip}>CRITICAL</span>
                        </div>
                        <input
                          key={`running-bom-${normalizeToDateInput(formData.running_date_bom)}`}
                          type="date"
                          className={`${styles.formInput} ${styles.formInputCritical}`}
                          value={normalizeToDateInput(formData.running_date_bom)}
                          onChange={(e) => handleRunningBomDateChange(e.target.value)}
                          onClick={(e) => {
                            try {
                              e.target.showPicker?.();
                            } catch (_) {}
                          }}
                        />
                        {editingItem?.running_date_bom && !normalizeToDateInput(editingItem.running_date_bom) && (
                          <span className={styles.formHint}>
                            Teks asli: <strong>{editingItem.running_date_bom}</strong>
                          </span>
                        )}
                      </div>

                      {/* Distribution Date (Identical height & label alignment) */}
                      <div className={`${styles.formGroup} ${styles.colSpan1}`}>
                        <div className={styles.formLabelRow}>
                          <label className={styles.formLabel}>
                            <Calendar size={13} style={{ opacity: 0.6 }} />
                            <span>{t('ecn.table.dist_date', 'Distribution Date')}</span>
                          </label>
                        </div>
                        <input
                          type="date"
                          className={styles.formInput}
                          value={normalizeToDateInput(formData.distribution_date)}
                          onChange={(e) => setFormData({ ...formData, distribution_date: e.target.value })}
                          onClick={(e) => {
                            try {
                              e.target.showPicker?.();
                            } catch (_) {}
                          }}
                        />
                        {editingItem?.distribution_date && !normalizeToDateInput(editingItem.distribution_date) && (
                          <span className={styles.formHint}>
                            Teks asli: <strong>{editingItem.distribution_date}</strong>
                          </span>
                        )}
                      </div>

                      {/* Status (Identical height & label alignment) */}
                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <div className={styles.formLabelRow}>
                          <label className={styles.formLabel}>
                            <Clock size={13} style={{ opacity: 0.6 }} />
                            <span>{t('ecn.table.status', 'Status')}</span>
                          </label>
                        </div>
                        <select
                          className={styles.formSelect}
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                          <option value="Completed">Completed</option>
                          <option value="Progress">Progress</option>
                          <option value="Pending">Pending</option>
                          <option value="ECO Cancel">ECO Cancel</option>
                        </select>
                      </div>

                      {/* ponytail: Part Before (Lama) */}
                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <div className={styles.formLabelRow}>
                          <label className={styles.formLabel}>
                            <span className={styles.partSubTagOld} style={{ marginRight: '5px' }}>OLD</span>
                            <span>{t('ecn.table.part_before', 'Part (Before / Lama)')}</span>
                          </label>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>BOM Lama</span>
                        </div>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: GH63-23138A"
                          value={formData.part_before}
                          onChange={(e) => setFormData({ ...formData, part_before: e.target.value })}
                        />
                      </div>

                      {/* ponytail: Part After (Baru) with Detect button */}
                      <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                        <div className={styles.formLabelRow}>
                          <label className={styles.formLabel}>
                            <span className={styles.partSubTagNew} style={{ marginRight: '5px' }}>NEW</span>
                            <span>{t('ecn.table.part_after', 'Part (After / Baru)')}</span>
                          </label>
                          <button
                            type="button"
                            className={styles.btnDetectPart}
                            onClick={handleAutoDetectPart}
                            title="Deteksi otomatis part lama & baru dari Remark / Title"
                          >
                            ⚡ Deteksi Part
                          </button>
                        </div>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Contoh: GH63-23137A"
                          value={formData.part_after}
                          onChange={(e) => setFormData({ ...formData, part_after: e.target.value })}
                        />
                      </div>

                      {/* Remark (Catatan Detail Teknis & Instruksi Khusus) */}
                      <div className={`${styles.formGroup} ${styles.colSpan4}`}>
                        <div className={styles.formLabelRow}>
                          <label className={styles.formLabel}>{t('ecn.form_modal.sec_remark', 'Remark (Catatan Detail Teknis & Instruksi Khusus)')}</label>
                        </div>
                        <textarea
                          className={styles.formTextarea}
                          placeholder="Tuliskan catatan teknis, nomor dokumen pendukung, nama engineer PIC, instruksi verifikasi line..."
                          value={formData.remark}
                          onChange={(e) => {
                            const newRemark = e.target.value;
                            const nextForm = { ...formData, remark: newRemark };
                            if (!formData.part_before || !formData.part_after) {
                              const auto = parsePartChange(newRemark, formData.ec_title);
                              if (auto.before && !formData.part_before) nextForm.part_before = auto.before;
                              if (auto.after && !formData.part_after) nextForm.part_after = auto.after;
                            }
                            setFormData(nextForm);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= SECTION 5 ACCORDION (AUDIT TRAIL) ================= */}
              {editingItem && (
                <div className={`${styles.accordionSection} ${openSections[5] ? styles.accordionSectionActive : ''}`}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => toggleSection(5)}
                    aria-expanded={openSections[5]}
                  >
                    <div className={styles.accordionHeaderLeft}>
                      <span className={styles.accordionTitle}>
                        <History size={13} />
                        5. {t('ecn.form_modal.sec_history', 'Riwayat Perubahan & Audit Trail')} ({ecnChangeLogs.length})
                      </span>
                      {!openSections[5] && ecnChangeLogs.length > 0 && (
                        <span className={styles.accordionSummary}>
                          Terakhir oleh {ecnChangeLogs[0].changed_by_name || 'System'} ({new Date(ecnChangeLogs[0].created_at).toLocaleDateString('id-ID')})
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      size={16}
                      className={`${styles.accordionChevron} ${openSections[5] ? styles.accordionChevronRotated : ''}`}
                    />
                  </button>

                  {openSections[5] && (
                    <div className={styles.accordionBody}>
                      {logsLoading ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          <Loader2 size={16} className={styles.spin} style={{ margin: '0 auto 6px', display: 'block' }} />
                          Memuat log riwayat perubahan...
                        </div>
                      ) : ecnChangeLogs.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '11.5px', color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', borderRadius: '6px', border: '1px dashed var(--color-border)' }}>
                          Belum ada riwayat perubahan manual tercatat untuk ECN ini. Log akan otomatis bertambah setiap kali ada pembaruan status, tanggal Running BOM, proses, atau catatan remark.
                        </div>
                      ) : (
                        <div className={styles.changeLogTimeline}>
                          {ecnChangeLogs.map((log) => (
                            <div key={log.id} className={styles.changeLogItem}>
                              <div className={styles.changeLogIconWrap}>
                                {log.action === 'STATUS_CHANGE' ? (
                                  <ShieldCheck size={12} color="#10b981" />
                                ) : log.action === 'BOM_CHANGE' ? (
                                  <Calendar size={12} color="#f59e0b" />
                                ) : log.action === 'CREATE' ? (
                                  <CheckCircle2 size={12} color="#2563eb" />
                                ) : (
                                  <Edit3 size={12} color="#6366f1" />
                                )}
                              </div>
                              <div className={styles.changeLogBody}>
                                <div className={styles.changeLogHeader}>
                                  <span className={styles.changeLogUser}>{log.changed_by_name || 'System'}</span>
                                  <span className={styles.changeLogTime}>
                                    {new Date(log.created_at).toLocaleString('id-ID', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div className={styles.changeLogNote}>{log.note || log.action}</div>
                                {log.changes && Object.keys(log.changes).length > 0 && (
                                  <div className={styles.diffChipsWrap}>
                                    {Object.entries(log.changes).map(([k, val]) => (
                                      <span key={k} className={styles.diffChip}>
                                        <strong>{k}:</strong> {typeof val === 'object' && val !== null ? `${val.from || '-'} ➔ ${val.to || '-'}` : String(val)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleRequestCloseForm}
              >
                {t('ecn.form_modal.cancel', 'Batal')}
              </button>
              <button type="submit" className={styles.btnPrimary}>
                {editingItem ? t('ecn.form_modal.save_changes', 'Simpan Perubahan') : t('ecn.form_modal.save_new', 'Simpan Record ECN')}
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

      {/* ECN Running BOM Deadline Email Reminder Modal (ponytail) */}
      <EcnReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => {
          setIsReminderModalOpen(false);
          fetchReminderStatus();
        }}
      />
    </div>
  );
};

export default EcnMonitoringPage;
