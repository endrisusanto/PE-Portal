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
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { FormattingTextarea } from '../common/FormattingTextarea';
import { CommentTimelineSection } from '../common/CommentTimelineSection';
import api from '../../api/client';
import styles from './ModelMilestoneMatrix.module.css';

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

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    const headerCols = ['Category', 'Milestone Task'];
    filteredModels.forEach((m) => {
      headerCols.push(`"${m.model_name} [Jadwal]"`, `"${m.model_name} [Status]"`, `"${m.model_name} [Doc]"`);
    });
    csvContent += headerCols.join(',') + '\r\n';

    MODERN_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        const row = [`"${cat.title}"`, `"${item.label}"`];
        filteredModels.forEach((m) => {
          const resolved = resolveMilestoneValue(m.id, item.key);
          const st = getCheckpointStatus(resolved.display, resolved.status);
          row.push(`"${resolved.display || '-'}"`, `"${st.label}"`, `"${resolved.attachments?.length || 0}"`);
        });
        csvContent += row.join(',') + '\r\n';
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SEIN_New_Model_Milestone_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <button className={styles.btnPrimary} onClick={handleExportCSV} title="Ekspor ke Excel / CSV">
              <FileSpreadsheet size={14} />
              <span>{t('models.matrix_export', 'Ekspor Data')}</span>
            </button>
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
          {filteredModels.map((m) => {
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
                  <button
                    className={styles.editModelIconBtn}
                    onClick={() => onEditModel && onEditModel(m)}
                    title="Edit metadata model"
                  >
                    <Edit3 size={13} />
                  </button>
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
          })}
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
                {filteredModels.map((m) => (
                  <th key={m.id} colSpan={3} className={styles.thModelColumn}>
                    <div className={styles.thModelWrap}>
                      <span className={styles.thModelTitle}>{m.model_name}</span>
                      <span className={styles.thModelSub}>
                        {m.marketing_name || m.codename || 'Standard'}
                      </span>
                    </div>
                  </th>
                ))}
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
              {MODERN_CATEGORIES.map((cat) => {
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
              })}
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
    </div>
  );
};
