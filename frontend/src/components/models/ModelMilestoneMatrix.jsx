import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  Edit3,
  Check,
  X,
  Layers,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Compass,
  CheckCircle2,
  FileText,
  Cpu,
  ShieldCheck,
  Tag,
  Paperclip,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  Flag,
  MessageSquare,
  Crown,
  Zap,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { FormattingTextarea } from '../common/FormattingTextarea';
import { CommentTimelineSection } from '../common/CommentTimelineSection';
import api from '../../api/client';
import styles from './ModelMilestoneMatrix.module.css';

// ponytail: Model classification categories (Flagship / Premium, Mass Product, TNP)
export const MODEL_CATEGORY_CONFIG = {
  flagship: {
    key: 'flagship',
    label: 'Flagship / Premium',
    shortLabel: 'Flagship',
    icon: Crown,
    color: '#d97706',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    activeBg: 'rgba(245, 158, 11, 0.2)',
  },
  mass_product: {
    key: 'mass_product',
    label: 'Mass Product',
    shortLabel: 'Mass Product',
    icon: Layers,
    color: '#2563eb',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    activeBg: 'rgba(59, 130, 246, 0.2)',
  },
  tnp: {
    key: 'tnp',
    label: 'TNP',
    shortLabel: 'TNP',
    icon: Zap,
    color: '#7c3aed',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    activeBg: 'rgba(139, 92, 246, 0.2)',
  },
};

export const getModelCategory = (m) => {
  if (!m) return 'mass_product';
  let cat = m.category || m.specifications?.category;
  if (!cat && typeof m.specifications === 'string') {
    try {
      const parsed = JSON.parse(m.specifications);
      cat = parsed?.category;
    } catch {}
  }
  if (cat && MODEL_CATEGORY_CONFIG[cat.toLowerCase()]) {
    return cat.toLowerCase();
  }

  // Smart heuristic based on Samsung model naming
  const name = (m.model_name || '').toUpperCase();
  const mkt = (m.marketing_name || '').toUpperCase();
  const code = (m.codename || '').toUpperCase();

  if (
    name.includes('S95') ||
    name.includes('S9') ||
    name.includes('S2') ||
    name.includes('FOLD') ||
    name.includes('FLIP') ||
    mkt.includes('ULTRA') ||
    mkt.includes('PLUS') ||
    code.includes('PARADIGM')
  ) {
    return 'flagship';
  }
  if (name.includes('TNP') || mkt.includes('TNP') || code.includes('TNP')) {
    return 'tnp';
  }
  return 'mass_product';
};

export const getModelCategoryInfo = (modelOrKey) => {
  const key = typeof modelOrKey === 'string' ? modelOrKey : getModelCategory(modelOrKey);
  return MODEL_CATEGORY_CONFIG[key] || MODEL_CATEGORY_CONFIG.mass_product;
};

// Master milestone categories with modern visual groupings
export const MODERN_CATEGORIES = [
  {
    id: 'gating',
    title: 'Gating Approval & Schedule',
    subtitle: 'Tahapan gerbang kelayakan desain & produksi SEIN',
    badge: 'Core Gates',
    color: 'blue',
    items: [
      { key: 'pvr_basic', label: 'PVR (BASIC)', hint: 'Pre-Verification Review' },
      { key: 'pra_sea', label: 'PRA (SEA)', hint: 'Pre-Release Assessment' },
      { key: 'sra_sea', label: 'SRA (SEA)', hint: 'Safety & Reliability Assessment' },
      { key: 'mp_sop', label: 'MP (Target SOP Plan)', hint: 'Mass Production kick-off target', isMilestoneKey: true },
    ],
  },
  {
    id: 'lqv',
    title: 'LQV & LQVA Line Quality Verification',
    subtitle: 'Verifikasi kesiapan line produksi, perakitan & inspeksi',
    badge: 'Line Quality',
    color: 'emerald',
    items: [
      { key: 'lqv_subline', label: 'Subline Build', hint: 'Kesiapan lini feeder / modular' },
      { key: 'lqv_smd_sec', label: 'SMD Secondary', hint: 'Surface mount device secondary' },
      { key: 'lqv_smd_main', label: 'SMD Main Line', hint: 'Main PCB SMD line test' },
      { key: 'lqv_assembly', label: 'Assembly Line', hint: 'Main assembly trial run' },
      { key: 'lqv_inspection', label: 'Inspection & Test', hint: 'Quality control & testing' },
      { key: 'lqva', label: 'LQVA Full Audit', hint: 'Line Quality Verification Audit' },
    ],
  },
  {
    id: 'bom_sample',
    title: 'BOM Readiness & Sample Builds',
    subtitle: 'Status rilis Bill of Materials dan fabrikasi sampel verifikasi',
    badge: 'Material & Sample',
    color: 'purple',
    items: [
      { key: 'bom_hq', label: 'BOM Release (HQ)', hint: 'Headquarter release status' },
      { key: 'bom_sein', label: 'BOM Release (SEIN)', hint: 'Local factory release status' },
      { key: 'sample_tkdn_bom', label: 'Sample TKDN / BOM', hint: 'Sample compliance check' },
      { key: 'sample_std_oqc', label: 'Sample STD OQC', hint: 'Outgoing Quality Control' },
      { key: 'sample_std_main', label: 'Sample STD Main', hint: 'Standard main build sample' },
      { key: 'sample_disassembly', label: 'Disassembly Analysis', hint: 'Analisa kemudahan bongkar & rework' },
    ],
  },
  {
    id: 'eng_verification',
    title: 'Engineering & Software Verification',
    subtitle: 'Spesifikasi kerja lini, konfirmasi firmware & verifikasi program',
    badge: 'Engineering',
    color: 'amber',
    items: [
      { key: 'working_spec_register', label: 'Working Spec Register', hint: 'Pendaftaran spesifikasi kerja SOP' },
      { key: 'sw_confirm_verify', label: 'S/W Confirm & Verify', hint: 'Verifikasi versi firmware / binary' },
      { key: 'pgm_verify', label: 'PGM Flashing Verify', hint: 'Verifikasi instrumen flashing program' },
    ],
  },
  {
    id: 'tooling_equipment',
    title: 'JIG Tooling & Cable Hardware',
    subtitle: 'Pengadaan, estimasi tiba (ETA), dan kualifikasi JIG manufaktur',
    badge: 'Tooling Hardware',
    color: 'indigo',
    items: [
      { key: 'jig_list', label: 'JIG List Requirement', hint: 'Daftar kebutuhan tooling fixture' },
      { key: 'jig_pr_po', label: 'JIG PR & PO Release', hint: 'Purchase Request & Purchase Order' },
      { key: 'jig_eta', label: 'JIG Arrival (ETA)', hint: 'Estimasi kedatangan JIG' },
      { key: 'jig_verify', label: 'JIG Line Verification', hint: 'Verifikasi fungsional JIG di lini' },
      { key: 'cable_list', label: 'Equipment Cable List', hint: 'Daftar kabel instrumen' },
      { key: 'cable_pr_po', label: 'Cable PR & PO', hint: 'Pengadaan kabel RF / flash' },
      { key: 'cable_eta', label: 'Cable Arrival (ETA)', hint: 'Kedatangan perlengkapan kabel' },
    ],
  },
  {
    id: 'part_cert',
    title: 'Local Part Approval & Certification',
    subtitle: 'Validasi komponen lokal (packing, label), sertifikasi TKDN & Postel',
    badge: 'Compliance & Local',
    color: 'teal',
    items: [
      { key: 'part_drawing', label: 'Drawing Data Review', hint: 'Gambar teknis kemasan & stiker' },
      { key: 'part_bidding', label: 'Bidding Vendor', hint: 'Penetapan vendor komponen' },
      { key: 'part_sample', label: 'Sample Review', hint: 'Sampel fisik komponen lokal' },
      { key: 'part_iqc', label: 'IQC Test Verification', hint: 'Pengujian incoming quality control' },
      { key: 'part_approval', label: 'Final Part Approval', hint: 'Persetujuan resmi komponen' },
      { key: 'tkdn_approved', label: 'TKDN Approval', hint: 'Sertifikasi Tingkat Komponen Dalam Negeri' },
      { key: 'tkdn_value', label: 'TKDN Target Value', hint: 'Persentase nilai TKDN' },
      { key: 'postel_approved', label: 'Postel Certification', hint: 'Sertifikasi Kominfo / Postel' },
      { key: 'mkg_approved', label: 'MKG (Manual & Garansi)', hint: 'Buku panduan & kartu garansi' },
    ],
  },
  {
    id: 'special_process',
    title: 'Special Process Capability',
    subtitle: 'Kesiapan proses kritikal: bonding, waterproof, dispenser & inspeksi',
    badge: 'Critical Process',
    color: 'rose',
    items: [
      { key: 'sp_bonding', label: 'Display & Glass Bonding', hint: 'Kesiapan mesin bonding' },
      { key: 'sp_wpt_bonding', label: 'WPT Wireless Power Bonding', hint: 'Perakitan koil wireless charging' },
      { key: 'sp_octa_pad', label: 'Octa Pad Assembly', hint: 'Dispenser pad & heat dissipation' },
      { key: 'sp_act', label: 'ACT Auto Calibration', hint: 'Kalibrasi otomatis parameter perangkat' },
      { key: 'sp_final_insp', label: 'Final Cosmetic Inspection', hint: 'Pemeriksaan akhir kerapihan unit' },
      { key: 'sp_waterproof', label: 'Waterproof Pressure Test', hint: 'Uji kedap air & IP rating' },
    ],
  },
];

// Reference date for current time: 2026-10-27 (Week 44)
export const CURRENT_REFERENCE_DATE = new Date(2026, 9, 27); // 27 Oct 2026
export const CURRENT_ISO_WEEK = 44;

// Helper to calculate ISO Week number
export const getIsoWeekNumber = (d) => {
  if (!d || isNaN(d.getTime())) return 1;
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
};

// Helper to convert ISO week to start date (Monday) & end date (Friday)
export const getWeekDates = (weekNum, year = 2026) => {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monWeek1 = new Date(year, 0, 4 - dayOfWeek + 1);
  const startDate = new Date(monWeek1.getTime() + (weekNum - 1) * 7 * 86400000);
  const endDate = new Date(startDate.getTime() + 4 * 86400000); // Mon to Fri

  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: toYMD(startDate),
    endDate: toYMD(endDate),
    startObj: startDate,
    endObj: endDate,
  };
};

// Helper to calculate ISO Week and format "23-Oct (W43)"
export const formatDateWithWeek = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = monthNames[d.getMonth()];
  const weekNo = getIsoWeekNumber(d);

  return `${day}-${month} (W${weekNo})`;
};

// Helper to format date range with ISO week "26-Oct ~ 30-Oct (W44)"
export const formatDateRangeWithWeek = (startDateStr, endDateStr) => {
  if (!startDateStr) return '';
  const sDate = new Date(startDateStr);
  if (isNaN(sDate.getTime())) return startDateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sFmt = `${sDate.getDate()}-${monthNames[sDate.getMonth()]}`;
  const wNo = getIsoWeekNumber(sDate);

  if (!endDateStr || endDateStr === startDateStr) {
    return `${sFmt} (W${wNo})`;
  }
  const eDate = new Date(endDateStr);
  if (isNaN(eDate.getTime())) return `${sFmt} (W${wNo})`;
  const eFmt = `${eDate.getDate()}-${monthNames[eDate.getMonth()]}`;
  return `${sFmt} ~ ${eFmt} (W${wNo})`;
};

// ponytail: lightweight date range parser from any milestone string
export const parseDateRangeFromText = (rawTarget, val) => {
  let s = '';
  let e = '';
  const text = (rawTarget || val || '').trim();
  const isoMatches = text.match(/\d{4}-\d{2}-\d{2}/g);
  if (isoMatches && isoMatches.length >= 2) {
    s = isoMatches[0];
    e = isoMatches[1];
  } else if (isoMatches && isoMatches.length === 1) {
    s = isoMatches[0];
    e = isoMatches[0];
  } else {
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const dmMatches = [...text.matchAll(/(\d{1,2})-([A-Za-z]{3})/g)];
    if (dmMatches.length >= 1) {
      const year = 2026;
      const d1 = parseInt(dmMatches[0][1], 10);
      const m1 = monthMap[dmMatches[0][2].toLowerCase()] ?? 9;
      const y1 = m1 < 3 ? year + 1 : year;
      s = `${y1}-${String(m1 + 1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
      if (dmMatches.length >= 2) {
        const d2 = parseInt(dmMatches[1][1], 10);
        const m2 = monthMap[dmMatches[1][2].toLowerCase()] ?? 9;
        const y2 = m2 < 3 ? year + 1 : year;
        e = `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
      } else {
        e = s;
      }
    } else {
      const wMatch = text.match(/W(\d{1,2})/i);
      if (wMatch) {
        const wNum = parseInt(wMatch[1], 10);
        const { startDate, endDate } = getWeekDates(wNum, wNum <= 10 ? 2027 : 2026);
        s = startDate;
        e = endDate;
      }
    }
  }
  return { startDate: s, endDate: e };
};

// ponytail: format milestone table date value without week part (e.g. "3-Dec (W49)" -> "3-Dec")
export const formatTableCellValue = (val) => {
  if (!val || val === '-') return '-';
  const clean = val.replace(/\s*\([wW]\d+\)/g, '').trim();
  return clean || val;
};

// Check if milestone value indicates deadline is approaching or passed
export const getMilestoneDeadlineAlert = (value) => {
  if (!value || value === '-' || value.toUpperCase() === 'N/A') return null;

  const upper = value.toUpperCase();
  if (upper.includes('PASS') || upper.includes('OK') || upper.includes('DONE')) {
    return null; // Already completed
  }

  const now = CURRENT_REFERENCE_DATE;
  const currentYear = now.getFullYear();

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // 1. Explicit date pattern e.g. "23-Oct"
  const dateMatch = value.match(/(\d{1,2})-([A-Za-z]{3})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const mStr = dateMatch[2].toLowerCase();
    const month = monthMap[mStr];

    if (month !== undefined) {
      let targetYear = currentYear;
      if (now.getMonth() >= 9 && month < 3) {
        targetYear = currentYear + 1;
      }
      const targetDate = new Date(targetYear, month, day, 23, 59, 59);
      const diffMs = targetDate - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return {
          level: 'critical',
          days: diffDays,
          message: `Overdue ${Math.abs(diffDays)} hari yang lalu`,
          badge: 'OVERDUE',
        };
      } else if (diffDays <= 7) {
        return {
          level: 'critical',
          days: diffDays,
          message: diffDays === 0 ? 'Hari ini deadline!' : `Mendekati deadline (${diffDays} hari lagi)`,
          badge: `${diffDays}d LEFT`,
        };
      } else if (diffDays <= 21) {
        return {
          level: 'warning',
          days: diffDays,
          message: `Target ${diffDays} hari lagi (${dateMatch[0]})`,
          badge: `${diffDays}d`,
        };
      }
    }
  }

  // 2. Week format e.g. "W44", "W48", "W51", "W1"
  const weekMatch = value.match(/W(\d{1,2})/i);
  if (weekMatch) {
    const targetWeek = parseInt(weekMatch[1], 10);
    const currentWeek = CURRENT_ISO_WEEK;

    if (targetWeek >= 40) {
      const diffWeeks = targetWeek - currentWeek;
      if (diffWeeks < 0) {
        return {
          level: 'critical',
          weeks: diffWeeks,
          message: `Overdue (${Math.abs(diffWeeks)} minggu lalu: W${targetWeek})`,
          badge: `W${targetWeek} EXPIRED`,
        };
      } else if (diffWeeks <= 1) {
        return {
          level: 'critical',
          weeks: diffWeeks,
          message: diffWeeks === 0 ? `Target minggu ini (W${targetWeek})!` : `Target minggu depan (W${targetWeek})`,
          badge: diffWeeks === 0 ? 'THIS WEEK' : 'NEXT WEEK',
        };
      } else if (diffWeeks <= 3) {
        return {
          level: 'warning',
          weeks: diffWeeks,
          message: `Target dalam ${diffWeeks} minggu (W${targetWeek})`,
          badge: `IN ${diffWeeks}W`,
        };
      }
    }
  }

  return null;
};

// Checkpoint status resolver for badge display
export const getCheckpointStatus = (value, explicitStatus) => {
  if (explicitStatus && explicitStatus !== 'pending' && explicitStatus !== 'auto') {
    const map = {
      completed: { label: 'Completed', type: 'completed' },
      in_progress: { label: 'In Progress', type: 'progress' },
      warning: { label: 'Warning', type: 'warning' },
      overdue: { label: 'Overdue', type: 'overdue' },
      tbd: { label: 'TBD', type: 'tbd' },
      not_applicable: { label: 'N/A', type: 'muted' },
    };
    if (map[explicitStatus]) return map[explicitStatus];
  }

  if (!value || value === '-') return { label: '-', type: 'muted' };
  const u = value.toUpperCase();
  if (u === 'TBD') return { label: 'TBD', type: 'tbd' };
  if (u === 'N/A') return { label: 'N/A', type: 'muted' };
  if (u.includes('PASS') || u.includes('OK') || u.includes('DONE')) {
    return { label: 'Completed', type: 'completed' };
  }

  const alert = getMilestoneDeadlineAlert(value);
  if (alert) {
    if (alert.level === 'critical') return { label: 'Overdue', type: 'overdue' };
    if (alert.level === 'warning') return { label: 'Warning', type: 'warning' };
  }

  if (value.startsWith('W') || value.includes('(W')) {
    return { label: 'Scheduled', type: 'scheduled' };
  }
  return { label: 'Planned', type: 'scheduled' };
};

// Formatter for tag chip style
export const getPillStyle = (value) => {
  if (!value || value === '-') {
    return { type: 'muted', label: '-' };
  }
  const u = value.toUpperCase();
  if (u === 'TBD') return { type: 'amber', label: 'TBD' };
  if (u === 'N/A') return { type: 'muted', label: 'N/A' };
  if (u.includes('PASS') || u.includes('OK') || u.includes('DONE')) {
    return { type: 'emerald', label: value };
  }
  if (value.startsWith('W') || value.includes('(W')) {
    return { type: 'indigo', label: value };
  }
  return { type: 'blue', label: value };
};

// Helper to compute progress metrics
export const calculateModelStats = (milestonesMap = {}) => {
  const checkKeys = [
    'pvr_basic', 'pra_sea', 'sra_sea', 'mp_sop',
    'lqv_subline', 'lqv_assembly', 'lqv_inspection', 'lqva',
    'bom_hq', 'bom_sein',
    'sample_std_oqc', 'sample_std_main',
    'working_spec_register', 'sw_confirm_verify', 'pgm_verify',
    'jig_eta', 'jig_verify',
    'cable_eta',
    'part_sample', 'part_approval',
    'tkdn_approved', 'postel_approved', 'mkg_approved',
  ];

  let verifiedCount = 0;
  let plannedCount = 0;
  let tbdCount = 0;
  let totalApplicable = 0;

  checkKeys.forEach((k) => {
    const keyVal = milestonesMap[k];
    const raw = typeof keyVal === 'object' && keyVal !== null
      ? (keyVal['']?.plan_value || keyVal[''] || Object.values(keyVal)[0]?.plan_value || '')
      : (keyVal || '');
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed === '-') return;
    const upper = trimmed.toUpperCase();
    if (upper === 'N/A') return;

    totalApplicable++;
    if (upper === 'TBD') {
      tbdCount++;
    } else if (upper.includes('PASS') || upper.includes('OK') || upper.includes('DONE')) {
      verifiedCount++;
    } else {
      plannedCount++;
    }
  });

  const percentage = totalApplicable > 0 ? Math.round((verifiedCount / totalApplicable) * 100) : 0;
  return { percentage, verifiedCount, plannedCount, tbdCount, totalApplicable };
};

export const ModelMilestoneMatrix = ({ models = [], onRefresh, onEditModel }) => {
  const { t } = useTranslation();
  const [modelMilestones, setModelMilestones] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(() => {
    return MODERN_CATEGORIES.map((c) => c.id);
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [modalActiveTab, setModalActiveTab] = useState('checkpoint'); // 'checkpoint' | 'comments'
  const [savingCell, setSavingCell] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [calMonth, setCalMonth] = useState({ year: 2026, month: 9 });
  const [rangeStep, setRangeStep] = useState('start');
  const fileInputRef = useRef(null);

  // Bulk Import state
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkParsedModels, setBulkParsedModels] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportSuccess, setBulkImportSuccess] = useState('');
  const [bulkImportError, setBulkImportError] = useState('');
  const [bulkImportTab, setBulkImportTab] = useState('paste'); // 'paste' | 'upload'
  const bulkFileInputRef = useRef(null);

  const monthNamesFull = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calMonth.year, calMonth.month, 1);
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;
    const totalDays = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(calMonth.year, calMonth.month, 0).getDate();

    const prevPadding = [];
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      prevPadding.push(prevMonthTotalDays - i);
    }

    const currentMonthDays = [];
    for (let d = 1; d <= totalDays; d++) {
      currentMonthDays.push(d);
    }

    return { prevPadding, currentMonthDays };
  }, [calMonth.year, calMonth.month]);

  // Load all milestones data
  const fetchAllMilestones = async () => {
    const map = {};
    for (const m of models) {
      try {
        const res = await api.get(`/models/${m.id}/milestones`);
        const itemMap = {};
        (res.data || []).forEach((item) => {
          const vCode = item.variant_code || '';
          if (!itemMap[item.milestone_key]) {
            itemMap[item.milestone_key] = {};
          }
          let atts = [];
          try {
            atts = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : (item.attachments || []);
          } catch {}
          itemMap[item.milestone_key][vCode] = {
            plan_value: item.plan_value || '',
            status: item.status || 'pending',
            notes: item.notes || '',
            target_date: item.target_date || '',
            attachments: Array.isArray(atts) ? atts : [],
          };
        });
        map[m.id] = itemMap;
      } catch (err) {
        console.error(`Failed to load milestones for ${m.model_name}`, err);
      }
    }
    setModelMilestones(map);
  };

  React.useEffect(() => {
    if (models.length > 0) {
      fetchAllMilestones();
    }
  }, [models]);

  // Helper to parse basic model array
  const getModelVariants = (m) => {
    let bsmList = [];
    try {
      bsmList = typeof m.basic_models === 'string' ? JSON.parse(m.basic_models) : m.basic_models;
    } catch {}
    return Array.isArray(bsmList) ? bsmList : [];
  };

  // Resolve active milestone display value
  const resolveMilestoneValue = (modelId, milestoneKey) => {
    const modelData = modelMilestones[modelId] || {};
    const keyData = modelData[milestoneKey] || {};
    const sharedObj = keyData[''] || {};
    const baseVal = sharedObj.plan_value || '';

    return {
      display: baseVal || '',
      baseVal,
      status: sharedObj.status || 'pending',
      notes: sharedObj.notes || '',
      target_date: sharedObj.target_date || '',
      attachments: sharedObj.attachments || [],
    };
  };

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      const n = (m.model_name || '').toLowerCase();
      const mkt = (m.marketing_name || '').toLowerCase();
      const code = (m.codename || '').toLowerCase();
      return n.includes(q) || mkt.includes(q) || code.includes(q);
    });
  }, [models, filterQuery]);

  const toggleCategory = (catId) => {
    setExpandedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleCellClick = (modelId, milestoneKey, resolved, itemDef, catTitle) => {
    const keyData = (modelMilestones[modelId] || {})[milestoneKey] || {};
    const targetObj = keyData[''] || {};

    const rawTarget = targetObj.target_date || resolved.target_date || '';
    const { startDate: parsedStart, endDate: parsedEnd } = parseDateRangeFromText(rawTarget, resolved.display);

    if (parsedStart) {
      const y = parseInt(parsedStart.slice(0, 4), 10);
      const m = parseInt(parsedStart.slice(5, 7), 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        setCalMonth({ year: y, month: m });
      }
    } else {
      setCalMonth({ year: CURRENT_REFERENCE_DATE.getFullYear(), month: CURRENT_REFERENCE_DATE.getMonth() });
    }
    setRangeStep('start');

    const resolveInitialStatus = (s1, s2) => {
      const valid = ['completed', 'in_progress', 'warning', 'overdue', 'tbd'];
      if (s1 && valid.includes(s1)) return s1;
      if (s2 && valid.includes(s2)) return s2;
      return 'auto';
    };

    setEditingCell({
      modelId,
      milestoneKey,
      label: itemDef.label,
      category: catTitle,
      subCategory: catTitle,
      value: targetObj.plan_value !== undefined ? targetObj.plan_value : (resolved.baseVal || resolved.display || ''),
      status: resolveInitialStatus(targetObj.status, resolved.status),
      notes: targetObj.notes || resolved.notes || '',
      startDate: parsedStart,
      endDate: parsedEnd,
      targetDate: parsedStart && parsedEnd && parsedStart !== parsedEnd ? `${parsedStart} ~ ${parsedEnd}` : parsedStart,
      attachments: targetObj.attachments || resolved.attachments || [],
    });
    setModalActiveTab('checkpoint');
  };

  const handleWeekChange = (wStr) => {
    if (!wStr) return;
    const pureNum = parseInt(wStr.replace(/\D/g, ''), 10);
    if (!pureNum) return;
    const year = pureNum <= 10 ? 2027 : 2026;
    const { startDate, endDate, startObj } = getWeekDates(pureNum, year);
    const formatted = formatDateRangeWithWeek(startDate, endDate);

    setEditingCell((prev) => ({
      ...prev,
      startDate,
      endDate,
      targetDate: `${startDate} ~ ${endDate}`,
      value: formatted,
    }));
    setCalMonth({ year: startObj.getFullYear(), month: startObj.getMonth() });
    setRangeStep('start');
  };

  const handleCalendarDayClick = (dayStr) => {
    if (
      rangeStep === 'start' ||
      !editingCell.startDate ||
      (editingCell.startDate !== editingCell.endDate && rangeStep !== 'end')
    ) {
      // 1st click: selects 1 single date (range 1 hari / 1 tanggal)
      const formatted = formatDateRangeWithWeek(dayStr, dayStr);
      setEditingCell((prev) => ({
        ...prev,
        startDate: dayStr,
        endDate: dayStr,
        targetDate: dayStr,
        value: formatted,
      }));
      setRangeStep('end');
    } else {
      // 2nd click: selects range
      let start = editingCell.startDate;
      let end = dayStr;
      if (end < start) {
        end = start;
        start = dayStr;
      }
      const formatted = formatDateRangeWithWeek(start, end);
      setEditingCell((prev) => ({
        ...prev,
        startDate: start,
        endDate: end,
        targetDate: start === end ? start : `${start} ~ ${end}`,
        value: formatted,
      }));
      setRangeStep('start');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingCell) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/comments/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditingCell((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), res.data],
      }));
    } catch (err) {
      alert('Gagal mengunggah lampiran: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (idx) => {
    setEditingCell((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveCell = async (e) => {
    if (e) e.preventDefault();
    if (!editingCell) return;
    setSavingCell(true);
    try {
      const finalTargetDate = editingCell.startDate && editingCell.endDate && editingCell.startDate !== editingCell.endDate
        ? `${editingCell.startDate} ~ ${editingCell.endDate}`
        : (editingCell.startDate || editingCell.targetDate || null);

      await api.patch(`/models/${editingCell.modelId}/milestones`, {
        milestone_key: editingCell.milestoneKey,
        variant_code: '',
        label: editingCell.label,
        category: editingCell.category,
        sub_category: editingCell.subCategory,
        plan_value: editingCell.value,
        status: editingCell.status === 'auto' ? 'pending' : editingCell.status,
        notes: editingCell.notes,
        target_date: finalTargetDate,
        attachments: editingCell.attachments || [],
      });

      // Update local state
      setModelMilestones((prev) => {
        const modelObj = { ...(prev[editingCell.modelId] || {}) };
        const keyObj = { ...(modelObj[editingCell.milestoneKey] || {}) };
        keyObj[''] = {
          plan_value: editingCell.value,
          status: editingCell.status === 'auto' ? 'pending' : editingCell.status,
          notes: editingCell.notes,
          target_date: finalTargetDate,
          attachments: editingCell.attachments,
        };
        modelObj[editingCell.milestoneKey] = keyObj;
        return {
          ...prev,
          [editingCell.modelId]: modelObj,
        };
      });
      setEditingCell(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menyimpan nilai milestone');
    } finally {
      setSavingCell(false);
    }
  };

  // ponytail: robust milestone key mapper matching user's matrix table layout
  const findMilestoneKey = (col0 = '', col1 = '') => {
    const combined = `${col0} ${col1}`.toLowerCase();
    const c0 = col0.toLowerCase();
    const c1 = col1.toLowerCase();

    if (combined.includes('pvr')) return 'pvr_basic';
    if (combined.includes('pra')) return 'pra_sea';
    if (combined.includes('sra')) return 'sra_sea';

    if (combined.includes('lqva')) return 'lqva';
    if (combined.includes('subline')) return 'lqv_subline';
    if (combined.includes('smd sec') || combined.includes('smd secondary')) return 'lqv_smd_sec';
    if (combined.includes('smd main')) return 'lqv_smd_main';
    if (combined.includes('assembly')) return 'lqv_assembly';
    if (combined.includes('inspection') && !combined.includes('final')) return 'lqv_inspection';

    if (combined.includes('mp') && (combined.includes('sop') || combined.includes('base') || combined.includes('target') || combined.includes('plan'))) return 'mp_sop';

    if (combined.includes('bom')) {
      if (combined.includes('hq')) return 'bom_hq';
      if (combined.includes('sein')) return 'bom_sein';
    }
    if (c0.includes('bom') && c1.includes('hq')) return 'bom_hq';
    if (c0.includes('bom') && c1.includes('sein')) return 'bom_sein';

    if (combined.includes('tkdn') && combined.includes('bom')) return 'sample_tkdn_bom';
    if (combined.includes('std oqc') || combined.includes('oqc')) return 'sample_std_oqc';
    if (combined.includes('std main')) return 'sample_std_main';
    if (combined.includes('disassembly')) return 'sample_disassembly';

    if (combined.includes('working spec')) return 'working_spec_register';
    if (combined.includes('s/w') || combined.includes('sw confirm')) return 'sw_confirm_verify';
    if (combined.includes('pgm')) return 'pgm_verify';

    if (combined.includes('jig')) {
      if (combined.includes('list')) return 'jig_list';
      if (combined.includes('pr') || combined.includes('po')) return 'jig_pr_po';
      if (combined.includes('eta')) return 'jig_eta';
      if (combined.includes('verify')) return 'jig_verify';
    }

    if (combined.includes('cable')) {
      if (combined.includes('list')) return 'cable_list';
      if (combined.includes('pr') || combined.includes('po')) return 'cable_pr_po';
      if (combined.includes('eta')) return 'cable_eta';
    }

    if (combined.includes('drawing')) return 'part_drawing';
    if (combined.includes('bidding')) return 'part_bidding';
    if (combined.includes('iqc')) return 'part_iqc';
    if (combined.includes('local part') && combined.includes('sample')) return 'part_sample';
    if (combined.includes('part') && combined.includes('approval')) return 'part_approval';

    if (combined.includes('tkdn')) {
      if (combined.includes('value')) return 'tkdn_value';
      if (combined.includes('approved') || combined.includes('approval')) return 'tkdn_approved';
    }

    if (combined.includes('postel')) return 'postel_approved';
    if (combined.includes('mkg') || combined.includes('kartu garansi') || combined.includes('manual')) return 'mkg_approved';

    if (combined.includes('wpt')) return 'sp_wpt_bonding';
    if (combined.includes('bonding')) return 'sp_bonding';
    if (combined.includes('octa')) return 'sp_octa_pad';
    if (combined.includes('act')) return 'sp_act';
    if (combined.includes('final inspection') || combined.includes('final insp')) return 'sp_final_insp';
    if (combined.includes('waterproof')) return 'sp_waterproof';

    return null;
  };

  // ponytail: robust zero-dependency parser for Excel TSV and CSV
  const parseBulkMatrixData = (rawText) => {
    if (!rawText || !rawText.trim()) return null;

    const lines = rawText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return null;

    // Detect delimiter: tab (Excel copy/paste) or comma (CSV) or semicolon
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';') && !firstLine.includes(',')) {
      delimiter = ';';
    } else {
      delimiter = ',';
    }

    // Split line with delimiter handling quotes
    const splitLine = (line) => {
      if (delimiter === '\t') {
        return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
      }
      const cells = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          cells.push(cur.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          cur = '';
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      return cells;
    };

    const parsedRows = lines.map(splitLine);

    // Find header row with model names
    let modelRowIndex = -1;
    let modelColStartIndex = -1;

    for (let r = 0; r < Math.min(5, parsedRows.length); r++) {
      const row = parsedRows[r];
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] || '').toLowerCase();
        if (cell === 'model' || cell.includes('sm-') || cell.includes('galaxy') || models.some((m) => m.model_name?.toLowerCase() === cell)) {
          modelRowIndex = r;
          modelColStartIndex = cell === 'model' ? c + 1 : c;
          break;
        }
      }
      if (modelRowIndex !== -1) break;
    }

    if (modelRowIndex === -1 || modelColStartIndex === -1) {
      modelRowIndex = 0;
      modelColStartIndex = parsedRows[0].length > 2 && (parsedRows[0][0].toLowerCase().includes('cat') || parsedRows[0][1].toLowerCase().includes('item') || parsedRows[0][1].toLowerCase().includes('milestone')) ? 2 : 1;
    }

    const modelRow = parsedRows[modelRowIndex];
    const detectedModels = [];

    for (let c = modelColStartIndex; c < modelRow.length; c++) {
      const rawName = (modelRow[c] || '').trim();
      if (rawName && rawName !== '-' && !rawName.toLowerCase().startsWith('doc') && !rawName.toLowerCase().startsWith('status')) {
        detectedModels.push({
          colIndex: c,
          modelName: rawName,
          marketingName: '',
          basicModels: [],
          milestones: [],
        });
      }
    }

    if (detectedModels.length === 0) return null;

    // Process rows after modelRowIndex
    for (let r = modelRowIndex + 1; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      const col0 = (row[0] || '').trim();
      const col1 = (row[1] || '').trim();
      const rowLabel = `${col0} ${col1}`.trim().toLowerCase();

      // Check if Marketing name row
      if (rowLabel.includes('marketing') || rowLabel.includes('project name')) {
        detectedModels.forEach((dm) => {
          const val = (row[dm.colIndex] || '').trim();
          if (val && val !== '-') dm.marketingName = val;
        });
        continue;
      }

      // Check if Basic model row
      if (rowLabel.includes('basic model')) {
        detectedModels.forEach((dm) => {
          const val = (row[dm.colIndex] || '').trim();
          if (val && val !== '-') {
            const bsm = val.split(/[\r\n;]+/).map((s) => s.trim()).filter(Boolean);
            dm.basicModels = bsm;
          }
        });
        continue;
      }

      // Match milestone key
      const milestoneKey = findMilestoneKey(col0, col1);
      if (!milestoneKey) continue;

      let itemDef = null;
      let catDef = null;
      for (const cat of MODERN_CATEGORIES) {
        const found = cat.items.find((it) => it.key === milestoneKey);
        if (found) {
          itemDef = found;
          catDef = cat;
          break;
        }
      }
      if (!itemDef) continue;

      detectedModels.forEach((dm) => {
        const rawVal = (row[dm.colIndex] || '').trim();
        if (!rawVal || rawVal === '') return;

        const { startDate, endDate } = parseDateRangeFromText(rawVal, rawVal);
        let status = 'pending';
        const u = rawVal.toUpperCase();
        if (u.includes('PASS') || u.includes('OK') || u.includes('DONE')) {
          status = 'completed';
        } else if (u === 'N/A') {
          status = 'not_applicable';
        } else if (u === 'TBD') {
          status = 'tbd';
        } else if (rawVal !== '-') {
          status = 'in_progress';
        }

        dm.milestones.push({
          milestone_key: itemDef.key,
          label: itemDef.label,
          category: catDef.id,
          sub_category: catDef.title,
          plan_value: rawVal,
          target_date: startDate && endDate && startDate !== endDate ? `${startDate} ~ ${endDate}` : (startDate || rawVal),
          status,
          variant_code: '',
        });
      });
    }

    return detectedModels;
  };

  // ponytail: Safe client-side file downloader that avoids Chromium blob-destruction race condition
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      } catch (err) {
        // ignore cleanup error
      }
    }, 15000);
  };

  // ponytail: Export directly to native Excel document (.xls) with full formatting, styling & gridlines
  const handleExportExcel = () => {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>SEIN Milestone Matrix</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          th, td { font-family: Calibri, Arial, sans-serif; font-size: 11pt; border: 1px solid #cbd5e1; padding: 6px 10px; }
          .header-main { background-color: #dbeafe; font-weight: bold; text-align: center; color: #1e3a8a; }
          .header-sub { background-color: #f1f5f9; font-weight: bold; }
          .cat-title { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
          .val-tbd { background-color: #fef3c7; color: #92400e; font-weight: 600; text-align: center; }
          .val-ok { background-color: #d1fae5; color: #065f46; font-weight: 600; text-align: center; }
          .val-mp { background-color: #fef08a; font-weight: bold; text-align: center; color: #854d0e; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th class="header-main" style="min-width: 140px;">Category</th>
              <th class="header-main" style="min-width: 220px;">Milestone Task</th>
              ${filteredModels.map((m) => `<th class="header-main" style="min-width: 160px;">${m.model_name}</th>`).join('')}
            </tr>
            <tr>
              <td class="header-sub"></td>
              <td class="header-sub">Marketing/Project Name</td>
              ${filteredModels.map((m) => `<td class="header-sub" style="text-align: center;">${m.marketing_name || m.codename || '-'}</td>`).join('')}
            </tr>
            <tr>
              <td class="header-sub"></td>
              <td class="header-sub">Basic Model</td>
              ${filteredModels.map((m) => `<td style="font-size: 10pt; text-align: center;">${getModelVariants(m).join(' / ') || '-'}</td>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${MODERN_CATEGORIES.map((cat) => `
              <tr>
                <td colspan="${filteredModels.length + 2}" style="background-color: #e2e8f0; font-weight: bold; padding: 8px;">
                  ${cat.title}
                </td>
              </tr>
              ${cat.items.map((item) => `
                <tr>
                  <td style="color: #64748b; font-size: 10pt;">${cat.title}</td>
                  <td style="font-weight: 600;">${item.label}</td>
                  ${filteredModels.map((m) => {
                    const resolved = resolveMilestoneValue(m.id, item.key);
                    const val = resolved.display || '-';
                    let cls = '';
                    if (item.key === 'mp_sop') cls = 'val-mp';
                    else if (val.toUpperCase() === 'TBD') cls = 'val-tbd';
                    else if (val.toUpperCase().includes('PASS') || val.toUpperCase().includes('OK') || val.toUpperCase().includes('DONE')) cls = 'val-ok';
                    return `<td class="${cls}" style="text-align: center;">${val}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    triggerDownload(blob, `SEIN_Milestone_Matrix_${new Date().toISOString().slice(0, 10)}.xls`);
  };

  // ponytail: Native zero-dependency CSV download with UTF-8 BOM so Excel opens with proper matrix layout
  const handleExportCSV = () => {
    const rows = [];

    // Row 1: Model names
    const r1 = ['Category', 'Milestone Item'];
    filteredModels.forEach((m) => r1.push(m.model_name));
    rows.push(r1.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));

    // Row 2: Marketing/Project Name
    const r2 = ['', 'Marketing/Project Name'];
    filteredModels.forEach((m) => r2.push(m.marketing_name || m.codename || ''));
    rows.push(r2.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));

    // Row 3: Basic Model
    const r3 = ['', 'Basic Model'];
    filteredModels.forEach((m) => {
      const bsm = getModelVariants(m);
      r3.push(bsm.join('; '));
    });
    rows.push(r3.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));

    // Category and milestone item rows
    MODERN_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        const row = [cat.title, item.label];
        filteredModels.forEach((m) => {
          const resolved = resolveMilestoneValue(m.id, item.key);
          row.push(resolved.display || '-');
        });
        rows.push(row.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));
      });
    });

    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `SEIN_Milestone_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ponytail: Download blank / populated template CSV
  const handleDownloadTemplateCSV = () => {
    const rows = [];
    const r1 = ['Category', 'Milestone Item'];
    const r2 = ['', 'Marketing/Project Name'];
    const r3 = ['', 'Basic Model'];

    const targetModels = filteredModels.length > 0 ? filteredModels : [
      { model_name: 'SM-S952BE', marketing_name: 'ON1', basic_models: ['BSM-S952BE/2D1', 'BSM-S952BE/5D1'] },
      { model_name: 'SM-S956BE', marketing_name: 'ON2', basic_models: ['BSM-S956BE/2D1', 'BSM-S956BE/5D1'] },
      { model_name: 'SM-S957BE', marketing_name: 'ON3', basic_models: ['BSM-S957BE/2D1', 'BSM-S957BE/5D1'] },
      { model_name: 'SM-S958BE', marketing_name: 'ON4', basic_models: ['BSM-S958BE/2D1', 'BSM-S958BE/5D1'] },
      { model_name: 'SM-A086B (Luxshare)', marketing_name: 'Galaxy A08 5G', basic_models: ['BSM-A086B/6R4D'] },
      { model_name: 'SM-A186', marketing_name: 'Galaxy A18 5G', basic_models: ['BSM-A186BE/1D8'] },
    ];

    targetModels.forEach((m) => {
      r1.push(m.model_name);
      r2.push(m.marketing_name || m.codename || '');
      r3.push(getModelVariants(m).join('; '));
    });

    rows.push(r1.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));
    rows.push(r2.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));
    rows.push(r3.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));

    MODERN_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        const row = [cat.title, item.label];
        targetModels.forEach((m) => {
          const resolved = m.id ? resolveMilestoneValue(m.id, item.key) : {};
          row.push(resolved.display || '-');
        });
        rows.push(row.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','));
      });
    });

    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `Template_Milestone_Matrix_SEIN.csv`);
  };

  // ponytail: Execute bulk import & save into PostgreSQL database
  const handleExecuteBulkImport = async () => {
    if (!bulkParsedModels || bulkParsedModels.length === 0) return;
    setBulkImporting(true);
    setBulkImportError('');
    setBulkImportSuccess('');

    try {
      let savedCount = 0;
      let newModelCount = 0;

      for (const item of bulkParsedModels) {
        let targetModel = models.find(
          (m) =>
            m.model_name.trim().toLowerCase() === item.modelName.trim().toLowerCase() ||
            (m.codename && m.codename.trim().toLowerCase() === item.modelName.trim().toLowerCase())
        );

        if (!targetModel) {
          const createRes = await api.post('/models', {
            model_name: item.modelName,
            marketing_name: item.marketingName || '',
            codename: item.marketingName || item.modelName,
            basic_models: item.basicModels || [],
            stage: 'concept',
            description: `Imported via Bulk Matrix on ${new Date().toLocaleDateString('id-ID')}`,
          });
          targetModel = createRes.data;
          newModelCount++;
        } else if (item.marketingName || (item.basicModels && item.basicModels.length > 0)) {
          try {
            await api.put(`/models/${targetModel.id}`, {
              model_name: targetModel.model_name,
              marketing_name: item.marketingName || targetModel.marketing_name,
              codename: targetModel.codename,
              basic_models: item.basicModels.length > 0 ? item.basicModels : targetModel.basic_models,
              stage: targetModel.stage,
              description: targetModel.description,
            });
          } catch (_) {}
        }

        if (item.milestones.length > 0) {
          await api.post(`/models/${targetModel.id}/milestones/batch`, {
            milestones: item.milestones,
          });
          savedCount += item.milestones.length;
        }
      }

      setBulkImportSuccess(
        `Berhasil menyimpan ${savedCount} checkpoint milestone untuk ${bulkParsedModels.length} model${
          newModelCount > 0 ? ` (${newModelCount} model baru berhasil didaftarkan)` : ''
        }.`
      );

      if (onRefresh) onRefresh();
      await fetchAllMilestones();

      setTimeout(() => {
        setIsBulkImportModalOpen(false);
        setBulkInputText('');
        setBulkParsedModels(null);
        setBulkImportSuccess('');
      }, 1500);
    } catch (err) {
      console.error('Bulk import error:', err);
      setBulkImportError(err.response?.data?.message || err.message || 'Gagal menyimpan data bulk import.');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleTextChange = (text) => {
    setBulkInputText(text);
    const parsed = parseBulkMatrixData(text);
    setBulkParsedModels(parsed);
  };

  const handleBulkCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setBulkInputText(content);
        const parsed = parseBulkMatrixData(content);
        setBulkParsedModels(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper to determine row checkpoint status across models
  const getRowHealth = (itemKey) => {
    let hasOverdue = false;
    let hasWarning = false;
    let allCompleted = true;
    let hasData = false;

    filteredModels.forEach((m) => {
      const res = resolveMilestoneValue(m.id, itemKey);
      if (!res.display || res.display === '-' || res.display === 'N/A') return;
      hasData = true;
      const st = getCheckpointStatus(res.display, res.status);
      if (st.type === 'overdue') hasOverdue = true;
      if (st.type === 'warning') hasWarning = true;
      if (st.type !== 'completed') allCompleted = false;
    });

    if (!hasData) return 'muted';
    if (hasOverdue) return 'overdue';
    if (hasWarning) return 'warning';
    if (allCompleted) return 'completed';
    return 'scheduled';
  };

  return (
    <div className={styles.modernContainer}>
      {/* 1. TOP HERO / OVERVIEW DASHBOARD DECK */}
      <div className={styles.heroDeck}>
        <div className={styles.heroTextSection}>
          <div className={styles.heroBadge}>
            <Compass size={13} />
            <span>{t('models.matrix_hero_badge', 'SEIN Product Engineering • New Model Program')}</span>
          </div>
          <h2 className={styles.heroTitle}>{t('models.milestone_matrix_title', 'Model Development Milestone Matrix')}</h2>
          <p className={styles.heroDesc}>
            {t('models.milestone_matrix_subtitle', 'Pelacakan terpadu jadwal (Week / Tanggal), status checkpoint, dan lampiran dokumen teknis per model & varian SKU.')}
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className={styles.deckToolbar}>
          <div className={styles.searchBox}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t('models.matrix_search_placeholder', 'Filter model / project name...')}
              className={styles.modernInput}
            />
            {filterQuery && (
              <button className={styles.clearSearchBtn} onClick={() => setFilterQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div className={styles.deckButtons}>
            <button className={styles.btnSecondary} onClick={fetchAllMilestones} title="Muat ulang milestone">
              <RefreshCw size={14} />
              <span>{t('models.matrix_refresh', 'Segarkan')}</span>
            </button>

            {/* Switch Toolbar: Export Matrix (Excel / CSV) & Bulk Import */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                gap: '2px',
              }}
            >
              {/* Ekspor Excel (.xls) */}
              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Unduh matriks dalam format spreadsheet Microsoft Excel (.xls) lengkap dengan format tabel & warna"
              >
                <FileSpreadsheet size={14} style={{ color: 'var(--color-success, #10b981)' }} />
                <span>{t('models.matrix_export_excel', 'Excel (.xls)')}</span>
              </button>

              {/* Ekspor CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Unduh matriks dalam format teks CSV standar (.csv)"
              >
                <FileText size={14} style={{ color: 'var(--color-info, #0ea5e9)' }} />
                <span>{t('models.matrix_export_csv', 'CSV')}</span>
              </button>

              <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--color-border)', margin: '0 2px' }} />

              {/* Bulk Import */}
              <button
                type="button"
                onClick={() => {
                  setIsBulkImportModalOpen(true);
                  setBulkImportError('');
                  setBulkImportSuccess('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: 'var(--color-accent, #0d9488)',
                  color: '#ffffff',
                }}
                title="Bulk Insert / Import data milestone dari Excel atau CSV"
              >
                <Upload size={14} />
                <span>{t('models.matrix_bulk_import', 'Bulk Import')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MODEL HERO CARDS PARENT CARD CONTAINER */}
      <div className={styles.projectCardsParentCard}>
        <div className={styles.parentCardHeader}>
          <div className={styles.parentCardTitleGroup}>
            <Layers size={14} className={styles.parentCardIcon} />
            <span className={styles.parentCardTitle}>{t('models.matrix_active_projects', 'Daftar Project Active Model')}</span>
            <span className={styles.parentCardBadge}>{t('models.matrix_models_count', { count: filteredModels.length, defaultValue: `${filteredModels.length} Model` })}</span>
          </div>
        </div>

        <div className={styles.modelCardsGrid}>
          {filteredModels.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', width: '100%', gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>{t('models.matrix_no_models', 'Tidak ada model yang sesuai dengan kriteria filter saat ini.')}</p>
            </div>
          ) : (
            filteredModels.map((m) => {
            const stats = calculateModelStats(modelMilestones[m.id] || {});
            const variants = getModelVariants(m);
            return (
              <div key={m.id} className={styles.modelOverviewCard}>
                <div className={styles.modelCardTop}>
                  <div className={styles.modelIdentity}>
                    <div className={styles.modelCodenameBadge}>
                      <Cpu size={12} />
                      <span>{m.marketing_name || m.codename || 'Project'}</span>
                    </div>
                    <h3 className={styles.modelHeading}>{m.model_name}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* ponytail: Badge Icon kecil disamping button edit di card */}
                    {(() => {
                      const catInfo = getModelCategoryInfo(m);
                      const CatIcon = catInfo.icon;
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '12px',
                            backgroundColor: catInfo.bgColor,
                            border: `1px solid ${catInfo.borderColor}`,
                            color: catInfo.color,
                            fontSize: '10.5px',
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                          title={`Kategori: ${catInfo.label}`}
                        >
                          <CatIcon size={12} />
                          <span>{catInfo.shortLabel}</span>
                        </div>
                      );
                    })()}
                    <button
                      className={styles.editModelIconBtn}
                      onClick={() => onEditModel && onEditModel(m)}
                      title="Edit metadata model"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>

                {/* Basic Model variants (Informative Only) */}
                {variants.length > 0 && (
                  <div className={styles.variantStaticList}>
                    {variants.map((v, i) => (
                      <span key={i} className={styles.variantStaticChip} title={`SKU: ${v}`}>
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Clean Milestone Status Summary (No Progress Bar) */}
                <div className={styles.cardFooterStats}>
                  <span className={styles.statVerified}>
                    {stats.verifiedCount > 0
                      ? t('models.matrix_verified_count', { count: stats.verifiedCount, defaultValue: `${stats.verifiedCount} Terverifikasi` })
                      : t('models.matrix_planned_count', { count: stats.plannedCount, defaultValue: `${stats.plannedCount} Terjadwal` })}
                  </span>
                  {stats.tbdCount > 0 && (
                    <span className={styles.tbdCounter}>{stats.tbdCount} TBD</span>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* 4. MODERN 3-SUBCOLUMN MATRIX TABLE */}
      <div className={styles.matrixSurface}>
        <div className={styles.tableHeaderBar}>
          <div className={styles.tableHeaderTitle}>
            <SlidersHorizontal size={16} />
            <span>{t('models.matrix_table_title', 'Matriks Rincian & Status Eksekusi Semua Model')}</span>
          </div>
          <div className={styles.legendBar}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotEmerald}`} />
              <span>{t('models.matrix_legend_completed', 'Completed / PASS')}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotIndigo}`} />
              <span>{t('models.matrix_legend_scheduled', 'Scheduled (Wxx)')}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotAmber}`} />
              <span>{t('models.matrix_legend_warning', 'Warning / Approaching')}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotRose}`} />
              <span>{t('models.matrix_legend_overdue', 'Terlambat / Overdue')}</span>
            </div>
          </div>
        </div>

        <div className={styles.matrixScrollContainer}>
          <table className={styles.matrixModernTable}>
            <thead>
              <tr>
                <th rowSpan={2} className={styles.thTaskName}>
                  {t('models.matrix_col_task', 'Milestone Task / Tahapan')}
                </th>
                {filteredModels.map((m) => {
                  const catInfo = getModelCategoryInfo(m);
                  const CatIcon = catInfo.icon;
                  return (
                    <th key={m.id} colSpan={3} className={styles.thModelColumn}>
                      <div className={styles.thModelWrap}>
                        {/* ponytail: Chip kecil di pojok kiri tiap kolom title model */}
                        <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginBottom: '3px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: catInfo.bgColor,
                              border: `1px solid ${catInfo.borderColor}`,
                              color: catInfo.color,
                              fontSize: '9.5px',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              lineHeight: 1.3,
                            }}
                            title={`Kategori Model: ${catInfo.label}`}
                          >
                            <CatIcon size={10} />
                            <span>{catInfo.shortLabel}</span>
                          </span>
                        </div>
                        <span className={styles.thModelTitle}>{m.model_name}</span>
                        <span className={styles.thModelSub}>
                          {m.marketing_name || m.codename || 'Standard'}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className={styles.subHeaderRow}>
                {filteredModels.map((m) => (
                  <React.Fragment key={m.id}>
                    <th className={styles.thSubDate}>{t('models.matrix_col_target', 'Jadwal')}</th>
                    <th className={styles.thSubStatus}>{t('models.matrix_col_status', 'Status')}</th>
                    <th className={styles.thSubAttach}>{t('models.matrix_col_attachments', 'Doc')}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {t('models.matrix_no_models', 'Tidak ada data model untuk ditampilkan.')}
                  </td>
                </tr>
              ) : (
                MODERN_CATEGORIES.map((cat) => {
                const isExpanded = expandedCategories.includes(cat.id);

                return (
                  <React.Fragment key={cat.id}>
                    {/* Category Divider Header Row */}
                    <tr className={styles.categoryDividerRow} onClick={() => toggleCategory(cat.id)}>
                      <td colSpan={filteredModels.length * 3 + 1} className={styles.categoryDividerCell}>
                        <div className={styles.catDividerContent}>
                          <div className={styles.catLeftInfo}>
                            <button className={styles.toggleChevronBtn}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className={styles.catTitle}>{t(`models.categories.${cat.id}.title`, cat.title)}</span>
                            <span className={styles.catSubtitle}>• {t(`models.categories.${cat.id}.subtitle`, cat.subtitle)}</span>
                          </div>
                          <span className={styles.catBadge}>{t(`models.categories.${cat.id}.badge`, cat.badge)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Milestone Items under this category */}
                    {isExpanded &&
                      cat.items.map((item) => {
                        const rowHealth = getRowHealth(item.key);

                        return (
                          <tr key={item.key} className={styles.milestoneItemRow}>
                            <td className={`${styles.itemLabelCell} ${styles[`health_${rowHealth}`]}`}>
                              <div className={styles.itemLabelWrapper}>
                                <div className={styles.itemTitleRow}>
                                  <span className={styles.itemTitle}>{item.label}</span>
                                  {rowHealth === 'overdue' && (
                                    <span className={styles.rowOverdueBadge} title="Ada model yang melewati garis waktu hari ini!">
                                      OVERDUE
                                    </span>
                                  )}
                                </div>
                                {item.hint && <span className={styles.itemHint}>{item.hint}</span>}
                              </div>
                            </td>

                            {/* 3 Sub-Columns per Model */}
                            {filteredModels.map((m) => {
                              const resolved = resolveMilestoneValue(m.id, item.key);
                              const pill = getPillStyle(resolved.baseVal || resolved.display);
                              const alertInfo = getMilestoneDeadlineAlert(resolved.display);
                              const statusObj = getCheckpointStatus(resolved.display, resolved.status);
                              const attachments = resolved.attachments || [];
                              const statusClass = styles[`cellStatus_${statusObj.type}`] || '';

                              return (
                                <React.Fragment key={m.id}>
                                  {/* Sub-col 1: Date */}
                                  <td
                                    className={`${styles.itemDateCell} ${statusClass} ${
                                      alertInfo ? (alertInfo.level === 'critical' ? styles.cellCriticalAlert : styles.cellWarningAlert) : ''
                                    }`}
                                    onClick={() =>
                                      handleCellClick(m.id, item.key, resolved, item, cat.title)
                                    }
                                    title={`Klik untuk edit: ${m.model_name} • ${item.label}`}
                                  >
                                    <div className={styles.pillBox}>
                                      <div className={styles.fullBaseValWrap}>
                                        <span
                                          className={`${styles.statusPill} ${styles[`pill_${getPillStyle(resolved.baseVal || resolved.display).type}`]}`}
                                          title={resolved.display || 'Milestone Value'}
                                        >
                                          {formatTableCellValue(resolved.baseVal || resolved.display)}
                                        </span>
                                      </div>
                                      <Edit3 size={11} className={styles.hoverEditMarker} />
                                    </div>
                                  </td>

                                  {/* Sub-col 2: Status Badge */}
                                  <td
                                    className={`${styles.itemStatusCell} ${statusClass}`}
                                    onClick={() =>
                                      handleCellClick(m.id, item.key, resolved, item, cat.title)
                                    }
                                    title={`Status: ${statusObj.label} (Klik untuk ubah)`}
                                  >
                                    <span className={`${styles.statusBadge} ${styles[`status_${statusObj.type}`]}`}>
                                      {statusObj.label}
                                    </span>
                                  </td>

                                  {/* Sub-col 3: Attachments */}
                                  <td
                                    className={`${styles.itemAttachCell} ${statusClass}`}
                                    onClick={() =>
                                      handleCellClick(m.id, item.key, resolved, item, cat.title)
                                    }
                                    title={
                                      attachments.length > 0
                                        ? `${attachments.length} Dokumen: ${attachments.map((a) => a.name).join(', ')}`
                                        : 'Klik untuk lampirkan file'
                                    }
                                  >
                                    {attachments.length > 0 ? (
                                      <span className={styles.attachBadge}>
                                        <Paperclip size={11} />
                                        <span>{attachments.length}</span>
                                      </span>
                                    ) : (
                                      <span className={styles.attachEmpty}>-</span>
                                    )}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. FAST INLINE CELL EDIT MODAL (Date/Week Picker, Status, FormattingTextarea, & Comments) */}
      {editingCell && (
        <Modal
          isOpen={!!editingCell}
          onClose={() => setEditingCell(null)}
          title={`Edit Checkpoint: ${editingCell.label}`}
        >
          {/* Top Path and Model Indicator */}
          <div className={styles.modalHeaderBar}>
            <div className={styles.modalPathText}>
              <span>{editingCell.category}</span>
              <span> / </span>
              <strong>{editingCell.label}</strong>
            </div>
            <span className={styles.modalModelName}>
              {filteredModels.find((m) => m.id === editingCell.modelId)?.model_name || ''}
            </span>
          </div>

          {/* Modal Tab Selector */}
          <div className={styles.modalTabBar}>
            <button
              type="button"
              className={`${styles.modalTabBtn} ${modalActiveTab === 'checkpoint' ? styles.modalTabBtnActive : ''}`}
              onClick={() => setModalActiveTab('checkpoint')}
            >
              <SlidersHorizontal size={13} />
              <span>{t('models.modal_tab_details', 'Data Checkpoint & Catatan')}</span>
            </button>
            <button
              type="button"
              className={`${styles.modalTabBtn} ${modalActiveTab === 'comments' ? styles.modalTabBtnActive : ''}`}
              onClick={() => setModalActiveTab('comments')}
            >
              <MessageSquare size={13} />
              <span>{t('models.modal_tab_comments', 'Diskusi & Komentar Tim')}</span>
            </button>
          </div>

          {modalActiveTab === 'checkpoint' ? (
            <form onSubmit={handleSaveCell} className={styles.modalVerticalForm}>
              {/* Vertical Form Components */}
              <div className={styles.modalVerticalForm}>
              {/* Single Date Range Picker with Auto Week Range */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel}>
                    {t('models.modal_target_schedule', 'Rentang Jadwal / Tanggal Checkpoint:')}
                  </label>
                  {editingCell.value && (
                    <span className={styles.scheduleBadgePreview}>
                      {editingCell.value}
                    </span>
                  )}
                </div>

                <div className={styles.singleDateRangeWrapper}>
                  {/* Top Control Bar: Display + Clear + Week Selector */}
                  <div className={styles.datePickerControlRow}>
                    <div className={styles.dateDisplayInputWrap}>
                      <Calendar size={14} className={styles.dateInputIcon} />
                      <span className={editingCell.value ? styles.dateDisplayText : styles.dateDisplayPlaceholder}>
                        {editingCell.value ? editingCell.value : 'Pilih tanggal atau rentang tanggal...'}
                      </span>
                      {editingCell.value && (
                        <button
                          type="button"
                          className={styles.dateClearBtn}
                          onClick={() => {
                            setEditingCell((prev) => ({
                              ...prev,
                              startDate: '',
                              endDate: '',
                              targetDate: '',
                              value: '',
                            }));
                            setRangeStep('start');
                          }}
                          title="Kosongkan tanggal"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className={styles.weekSelectWrap}>
                      <select
                        className={styles.uniformInput}
                        value={
                          ['W40', 'W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W1', 'W2', 'W3'].find(
                            (w) => editingCell.value === w || editingCell.value?.includes(w)
                          ) || ''
                        }
                        onChange={(e) => handleWeekChange(e.target.value)}
                      >
                        <option value="">Auto Range by Week...</option>
                        {['W40', 'W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W1', 'W2', 'W3'].map((wStr) => (
                          <option key={wStr} value={wStr}>
                            {wStr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Compact Interactive Calendar Card */}
                  <div className={styles.compactCalendarCard}>
                    <div className={styles.calendarHeaderRow}>
                      <button
                        type="button"
                        className={styles.calNavBtn}
                        onClick={() => {
                          setCalMonth((prev) =>
                            prev.month === 0
                              ? { year: prev.year - 1, month: 11 }
                              : { ...prev, month: prev.month - 1 }
                          );
                        }}
                        title={t('models.modal_cal_prev', 'Bulan sebelumnya')}
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <span className={styles.calMonthTitle}>
                        {monthNamesFull[calMonth.month]} {calMonth.year}
                      </span>

                      <button
                        type="button"
                        className={styles.calNavBtn}
                        onClick={() => {
                          setCalMonth((prev) =>
                            prev.month === 11
                              ? { year: prev.year + 1, month: 0 }
                              : { ...prev, month: prev.month + 1 }
                          );
                        }}
                        title={t('models.modal_cal_next', 'Bulan berikutnya')}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Day of Week Headers */}
                    <div className={styles.calDaysHeader}>
                      {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((dayName) => (
                        <span key={dayName} className={styles.calDayHeaderCell}>
                          {dayName}
                        </span>
                      ))}
                    </div>

                    {/* Calendar Days Grid */}
                    <div className={styles.calGrid}>
                      {calendarDays.prevPadding.map((pDay) => (
                        <span key={`p-${pDay}`} className={styles.calDayEmptyCell}>
                          {pDay}
                        </span>
                      ))}

                      {calendarDays.currentMonthDays.map((dayNum) => {
                        const dayStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const isStart = editingCell.startDate === dayStr;
                        const isEnd = editingCell.endDate === dayStr;
                        const isSingle = isStart && isEnd;
                        const isInRange =
                          editingCell.startDate &&
                          editingCell.endDate &&
                          dayStr > editingCell.startDate &&
                          dayStr < editingCell.endDate;
                        const isToday = dayStr === '2026-10-27';

                        let cellClass = styles.calDayCell;
                        if (isSingle) cellClass += ` ${styles.calDaySingle}`;
                        else if (isStart) cellClass += ` ${styles.calDayStart}`;
                        else if (isEnd) cellClass += ` ${styles.calDayEnd}`;
                        else if (isInRange) cellClass += ` ${styles.calDayInRange}`;
                        if (isToday) cellClass += ` ${styles.calDayToday}`;

                        return (
                          <button
                            key={dayStr}
                            type="button"
                            className={cellClass}
                            onClick={() => handleCalendarDayClick(dayStr)}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selection Status Helper */}
                    <div className={styles.calFooterBar}>
                      <span className={styles.calFooterHelp}>
                        {editingCell.startDate ? (
                          editingCell.startDate === editingCell.endDate ? (
                            <>Terpilih: <strong>{editingCell.value}</strong> (1 Hari)</>
                          ) : (
                            <>Terpilih: <strong>{editingCell.value}</strong> (Rentang Hari)</>
                          )
                        ) : (
                          t('models.modal_select_hint', 'Klik tanggal untuk 1 hari, atau klik tanggal kedua untuk rentang.')
                        )}
                      </span>
                      {editingCell.startDate && (
                        <button
                          type="button"
                          className={styles.calResetHintBtn}
                          onClick={() => {
                            setEditingCell((prev) => ({
                              ...prev,
                              startDate: '',
                              endDate: '',
                              targetDate: '',
                              value: '',
                            }));
                            setRangeStep('start');
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Checkpoint: Button states with distinct outline */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  {t('models.modal_status_label', 'Status Checkpoint:')}
                </label>
                <div className={styles.statusSegmentedBar}>
                  {[
                    { id: 'auto', label: 'Auto', color: '#6366f1' },
                    { id: 'completed', label: 'PASS', color: '#10b981' },
                    { id: 'in_progress', label: 'Progress', color: '#0ea5e9' },
                    { id: 'warning', label: 'Alert', color: '#f59e0b' },
                    { id: 'overdue', label: 'Overdue', color: '#f43f5e' },
                    { id: 'tbd', label: 'TBD', color: '#f97316' },
                  ].map((st) => {
                    const isActive = (editingCell.status || 'auto') === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        className={`${styles.statusDotBtn} ${
                          isActive ? styles.statusDotBtnActive : ''
                        }`}
                        onClick={() => setEditingCell((prev) => ({ ...prev, status: st.id }))}
                        style={{
                          borderColor: isActive ? st.color : `${st.color}50`,
                          color: isActive ? st.color : 'var(--color-text-secondary)',
                          backgroundColor: isActive ? `${st.color}15` : 'var(--color-bg-primary)',
                          boxShadow: isActive ? `0 0 0 1.5px ${st.color}` : 'none',
                        }}
                      >
                        <span
                          className={styles.dotCircle}
                          style={{
                            backgroundColor: st.color,
                            boxShadow: isActive ? `0 0 6px ${st.color}` : 'none',
                          }}
                        />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catatan / Kendala Teknis dengan FormattingTextarea (Full Toolbar, Table Insert, Image Render) */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  {t('models.modal_notes_label', 'Catatan / Kendala Teknis & Kriteria:')}
                </label>
                <FormattingTextarea
                  value={editingCell.notes || ''}
                  onChange={(e) => setEditingCell((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('models.modal_notes_placeholder', 'Catat kendala kualifikasi, drawing, tooling, parameter uji, atau sisipkan tabel parameter & foto...')}
                  rows={6}
                  minHeight="140px"
                />
              </div>

              {/* Lampiran Dokumen */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  {t('models.modal_attachments_label', { count: editingCell.attachments?.length || 0, defaultValue: `Lampiran Dokumen (${editingCell.attachments?.length || 0}):` })}
                </label>
                <div className={styles.compactUploadBox}>
                  <div className={styles.uploadTriggerRow}>
                    <span className={styles.uploadHintText}>PDF, PPTX, XLSX, Drawing</span>
                    <button
                      type="button"
                      className={styles.btnUploadMini}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      <Upload size={12} />
                      <span>{uploadingFile ? t('models.modal_uploading', 'Mengunggah...') : t('models.modal_upload_file', 'Unggah File')}</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </div>

                  {editingCell.attachments && editingCell.attachments.length > 0 ? (
                    <div className={styles.attChipsList}>
                      {editingCell.attachments.map((att, idx) => (
                        <div key={idx} className={styles.attChip}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.attChipLink}
                            title={att.name}
                          >
                            <Paperclip size={11} />
                            <span>{att.name}</span>
                          </a>
                          <button
                            type="button"
                            className={styles.attChipDelete}
                            onClick={() => handleRemoveAttachment(idx)}
                            title="Hapus"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.uploadHintText}>
                      {t('models.modal_no_attachments', 'Belum ada dokumen yang dilampirkan.')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.modalFooterBar}>
              <Button variant="outline" type="button" onClick={() => setEditingCell(null)}>
                {t('common.cancel', 'Batal')}
              </Button>
              <Button variant="primary" type="submit" loading={savingCell} icon={Check}>
                {t('common.save', 'Simpan')}
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.modalCommentsWrap}>
            <CommentTimelineSection
              entityType="model"
              entityId={editingCell.modelId}
              entityTitle={`${filteredModels.find((m) => m.id === editingCell.modelId)?.model_name || 'Model'} - ${editingCell.label}`}
              refreshKey={`${editingCell.modelId}_${editingCell.milestoneKey}`}
            />
            <div className={styles.modalFooterBar}>
              <Button variant="outline" type="button" onClick={() => setEditingCell(null)}>
                {t('common.close', 'Tutup')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    )}

      {/* 6. BULK IMPORT / UPDATE MILESTONE MATRIX MODAL */}
      {isBulkImportModalOpen && (
        <Modal
          isOpen={isBulkImportModalOpen}
          onClose={() => {
            setIsBulkImportModalOpen(false);
            setBulkImportError('');
            setBulkImportSuccess('');
          }}
          title={t('models.bulk_import_title', 'Bulk Import / Update Milestone Matrix (Excel & CSV)')}
          maxWidth="900px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Informative Subtitle */}
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {t(
                'models.bulk_import_subtitle',
                'Salin data tabel langsung dari Microsoft Excel / Spreadsheet atau unggah file CSV untuk memperbarui seluruh jadwal milestone secara massal.'
              )}
            </p>

            {/* Quick Actions & Tab Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  gap: '3px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setBulkImportTab('paste')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: bulkImportTab === 'paste' ? 'var(--color-accent)' : 'transparent',
                    color: bulkImportTab === 'paste' ? '#ffffff' : 'var(--color-text-secondary)',
                  }}
                >
                  📋 {t('models.bulk_import_tab_paste', 'Paste dari Excel')}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkImportTab('upload')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: bulkImportTab === 'upload' ? 'var(--color-accent)' : 'transparent',
                    color: bulkImportTab === 'upload' ? '#ffffff' : 'var(--color-text-secondary)',
                  }}
                >
                  📁 {t('models.bulk_import_tab_upload', 'Upload File CSV')}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplateCSV}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px dashed var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
                title="Download template file CSV untuk format tabel matriks"
              >
                <Download size={13} />
                <span>{t('models.bulk_import_template_btn', 'Unduh Template CSV')}</span>
              </button>
            </div>

            {/* Tab 1: Paste Textarea */}
            {bulkImportTab === 'paste' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={bulkInputText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={t(
                    'models.bulk_import_paste_placeholder',
                    'Tempel (Ctrl+V) data tabel yang disalin dari Microsoft Excel di sini...'
                  )}
                  style={{
                    width: '100%',
                    height: '180px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
            ) : (
              /* Tab 2: File Upload */
              <div
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: '8px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-bg-primary)',
                  cursor: 'pointer',
                }}
                onClick={() => bulkFileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={bulkFileInputRef}
                  accept=".csv,.txt,.tsv"
                  style={{ display: 'none' }}
                  onChange={handleBulkCSVUpload}
                />
                <Upload size={32} style={{ color: 'var(--color-accent)', marginBottom: '8px' }} />
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px' }}>
                  Klik untuk memilih file CSV matriks
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Mendukung file .csv, .txt, atau .tsv yang diekspor dari Excel
                </p>
              </div>
            )}

            {/* Error or Success notification */}
            {bulkImportError && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '13px' }}>
                ⚠️ {bulkImportError}
              </div>
            )}
            {bulkImportSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', fontSize: '13px' }}>
                ✅ {bulkImportSuccess}
              </div>
            )}

            {/* Parsed Models Summary & Preview */}
            {bulkParsedModels && bulkParsedModels.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    🎯 {t('models.bulk_import_detected_summary', {
                      modelCount: bulkParsedModels.length,
                      itemCount: bulkParsedModels.reduce((acc, m) => acc + m.milestones.length, 0),
                      defaultValue: `${bulkParsedModels.length} Model terdeteksi • ${bulkParsedModels.reduce((acc, m) => acc + m.milestones.length, 0)} Checkpoint milestone siap disimpan`
                    })}
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg-primary)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Model</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Marketing / Codename</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Basic Model</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Jumlah Checkpoint</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status DB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkParsedModels.map((bm, idx) => {
                        const exists = models.some(
                          (m) => m.model_name?.trim().toLowerCase() === bm.modelName.trim().toLowerCase()
                        );
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.05))' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{bm.modelName}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{bm.marketingName || '-'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                              {bm.basicModels.length > 0 ? bm.basicModels.join(', ') : '-'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}>
                                {bm.milestones.length} Item
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {exists ? (
                                <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 600 }}>
                                  ✓ Model Terdaftar
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>
                                  + Buat Model Baru
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsBulkImportModalOpen(false);
                  setBulkImportError('');
                  setBulkImportSuccess('');
                }}
              >
                {t('common.cancel', 'Batal')}
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={!bulkParsedModels || bulkParsedModels.length === 0 || bulkImporting}
                loading={bulkImporting}
                icon={Check}
                onClick={handleExecuteBulkImport}
              >
                {t('models.bulk_import_save_btn', 'Terapkan & Simpan Bulk Data')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
