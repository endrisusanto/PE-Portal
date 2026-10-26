import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  Eye,
  Plus,
  Trash2,
  Database,
  CheckSquare,
  Heading,
  AlignLeft,
  Server,
  Layers,
  Cpu,
  Kanban,
  CheckCircle2,
  AlertTriangle,
  Users,
  Mail,
  Truck,
  GitCompare,
  Filter,
  Calculator,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Timer,
  Vote,
  LineChart,
  BarChart3,
  PieChart,
  CircleDot,
  Settings,
  Calendar,
  Table,
  Shield,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { EmailChipInput } from '../components/common/EmailChipInput';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import { FormattingTextarea } from '../components/common/FormattingTextarea';
import styles from './ReportEditorPage.module.css';

// Column definitions for filter rules per DB source
const WIDGET_COLUMNS = {
  tasks: [
    { key: 'title', label: 'Task Title' },
    { key: 'status', label: 'Status' },
    { key: 'assignee_name', label: 'Assignee' },
  ],
  models: [
    { key: 'model_name', label: 'Model Name' },
    { key: 'codename', label: 'Codename' },
    { key: 'stage', label: 'Development Stage' },
  ],
  projects: [
    { key: 'title', label: 'Project Title' },
    { key: 'status', label: 'Status' },
    { key: 'progress', label: 'Progress (%)' },
    { key: 'owner_name', label: 'Owner' },
  ],
  dhl: [
    { key: 'tracking_number', label: 'AWB / Tracking' },
    { key: 'status_label', label: 'Status Label' },
    { key: 'status_code', label: 'Status Code' },
    { key: 'pic', label: 'PIC' },
    { key: 'origin_country', label: 'Origin' },
    { key: 'dest_country', label: 'Destination' },
    { key: 'is_collected', label: 'Collected (true/false)' },
  ],
  software_mr: [
    { key: 'model', label: 'Model' },
    { key: 'pic', label: 'PIC' },
    { key: 'ap', label: 'AP' },
    { key: 'cp', label: 'CP' },
    { key: 'csc', label: 'CSC' },
    { key: 'csc_version_up', label: 'CSC Up' },
  ],
  gba_tasks: [
    { key: 'model_name', label: 'Model' },
    { key: 'project_name', label: 'Project' },
    { key: 'stage', label: 'Stage' },
    { key: 'status', label: 'Status' },
    { key: 'pic_email', label: 'PIC Email' },
    { key: 'is_urgent', label: 'Urgent (1/0)' },
  ],
};

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals (=)' },
  { value: 'not_equals', label: 'Not Equals (!=)' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater', label: 'Greater Than (>)' },
  { value: 'less', label: 'Less Than (<)' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const WIDGET_FORMULA_SUGGESTIONS = {
  tasks: ['=COUNT(rows)', '=COUNTIF(status, "done")', '=COUNTIF(status, "in_progress")'],
  models: ['=COUNT(rows)', '=COUNTIF(stage, "concept")', '=COUNTIF(stage, "mass_production")'],
  projects: ['=COUNT(rows)', '=AVERAGE(progress)', '=SUM(progress)', '=COUNTIF(status, "active")'],
  dhl: ['=COUNT(rows)', '=COUNTIF(status_code, "delivered")', '=COUNTIF(is_collected, "true")'],
  software_mr: ['=COUNT(rows)', '=COUNTA(model)', '=COUNTA(csc_version_up)'],
  gba_tasks: ['=COUNT(rows)', '=COUNTIF(status, "Approved")', '=COUNTIF(is_urgent, "1")'],
};

const WIDGET_PRESETS = {
  tasks: [
    { label: 'Done', field: 'status', operator: 'equals', value: 'done' },
    { label: 'In Progress', field: 'status', operator: 'equals', value: 'in_progress' },
  ],
  models: [
    { label: 'Concept Stage', field: 'stage', operator: 'equals', value: 'concept' },
    { label: 'Mass Production', field: 'stage', operator: 'equals', value: 'mass_production' },
  ],
  projects: [
    { label: 'Progress > 50%', field: 'progress', operator: 'greater', value: '50' },
    { label: 'Active Status', field: 'status', operator: 'equals', value: 'active' },
  ],
  dhl: [
    { label: 'Delivered', field: 'status_label', operator: 'contains', value: 'Delivered' },
    { label: 'In Transit', field: 'status_label', operator: 'contains', value: 'Transit' },
  ],
  software_mr: [
    { label: 'Has CSC Up', field: 'csc_version_up', operator: 'is_not_empty', value: '' },
  ],
  gba_tasks: [
    { label: 'Urgent Only', field: 'is_urgent', operator: 'equals', value: '1' },
    { label: 'Approved', field: 'status', operator: 'equals', value: 'Approved' },
    { label: 'Test Ongoing', field: 'status', operator: 'equals', value: 'Test Ongoing' },
  ],
};

const COLOR_PALETTE = ['#0d7377', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444'];

// Polar to cartesian & SVG Arc generator for Pie and Donut
const polarToCartesian = (cx, cy, r, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', end.x, end.y,
    'A', r, r, 0, largeArcFlag, 0, start.x, start.y,
    'Z',
  ].join(' ');
};

// Generates CSS conic-gradient for 100% mathematically perfect Pie & Donut circles
const getConicGradient = (data = []) => {
  if (!data || data.length === 0) return 'conic-gradient(#cbd5e1 0deg 360deg)';
  const total = data.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
  if (total <= 0) return 'conic-gradient(#cbd5e1 0deg 360deg)';

  let currentDeg = 0;
  const stops = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const sliceDeg = (val / total) * 360;
    const startDeg = currentDeg;
    const endDeg = currentDeg + sliceDeg;
    currentDeg = endDeg;
    const color = d.color || COLOR_PALETTE[i % COLOR_PALETTE.length];
    return `${color} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`;
  });

  return `conic-gradient(${stops.join(', ')})`;
};

// Calculate countdown
const getCountdown = (targetDate, now = Date.now()) => {
  if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isPast: false,
  };
};

// ponytail: smart, lightweight auto-aggregation of DB records for Chart View
const getDbChartData = (widgetType, rows = [], chartType = 'bar') => {
  if (!rows || rows.length === 0) return [];

  // For projects in bar chart view: show each project's progress percentage
  if (widgetType === 'projects' && chartType === 'bar') {
    return rows.slice(0, 8).map((p, i) => ({
      label: (p.title || 'Project').substring(0, 16),
      value: Math.min(Math.max(Number(p.progress) || 0, 0), 100),
      color: COLOR_PALETTE[i % COLOR_PALETTE.length],
    }));
  }

  // Determine categorical group field per DB widget
  let groupField = 'status';
  if (widgetType === 'models') groupField = 'stage';
  else if (widgetType === 'dhl') groupField = 'status_label';
  else if (widgetType === 'software_mr') groupField = 'model';
  else if (widgetType === 'gba_tasks') groupField = 'status';

  const counts = {};
  rows.forEach((r) => {
    let key = r[groupField];
    if (!key && widgetType === 'dhl') key = r.status_code;
    if (!key && widgetType === 'gba_tasks') key = r.stage;
    const cleanKey = String(key || 'Other').trim();
    const label = cleanKey.length <= 4 ? cleanKey.toUpperCase() : cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1).replace(/_/g, ' ');
    counts[label] = (counts[label] || 0) + 1;
  });

  return Object.entries(counts).map(([label, val], idx) => ({
    label,
    value: val,
    color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
  }));
};

// Factory for default blocks
const createDefaultBlock = (type) => {
  const baseId = String(Date.now() + Math.floor(Math.random() * 1000));
  switch (type) {
    case 'countdown': {
      const defaultDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      return {
        id: baseId,
        type: 'countdown',
        title: 'Mass Production Launch Milestone',
        targetDate: defaultDate,
      };
    }
    case 'vote':
      return {
        id: baseId,
        type: 'vote',
        question: 'Approval for Line JIG Firmware Protocol?',
        isAnonymous: true,
        options: [
          { text: 'Approve & Release to Line', votes: 12, voters: [] },
          { text: 'Requires Mecha Fine-Tuning', votes: 4, voters: [] },
          { text: 'Pending Further Review', votes: 1, voters: [] },
        ],
      };
    case 'chart_line':
      return {
        id: baseId,
        type: 'chart_line',
        title: 'Daily Line Pass Yield Trend (%)',
        color: '#0d7377',
        data: [
          { label: 'Mon', value: 96.2 },
          { label: 'Tue', value: 97.5 },
          { label: 'Wed', value: 98.4 },
          { label: 'Thu', value: 97.9 },
          { label: 'Fri', value: 99.1 },
        ],
      };
    case 'chart_bar':
      return {
        id: baseId,
        type: 'chart_bar',
        title: 'Defects / Issues by Station',
        color: '#0284c7',
        data: [
          { label: 'SMT', value: 14 },
          { label: 'FATP', value: 8 },
          { label: 'Mecha JIG', value: 22 },
          { label: 'Final Test', value: 5 },
          { label: 'Packing', value: 2 },
        ],
      };
    case 'chart_pie':
      return {
        id: baseId,
        type: 'chart_pie',
        title: 'Task Distribution by Category',
        data: [
          { label: 'Firmware & Flashing', value: 40, color: '#0d7377' },
          { label: 'Calibration', value: 25, color: '#0284c7' },
          { label: 'Hardware Maintenance', value: 20, color: '#f59e0b' },
          { label: 'Documentation', value: 15, color: '#10b981' },
        ],
      };
    case 'chart_donut':
      return {
        id: baseId,
        type: 'chart_donut',
        title: 'Model Milestone Stage Breakdown',
        data: [
          { label: 'Concept Stage', value: 30, color: '#8b5cf6' },
          { label: 'EVT / DVT', value: 45, color: '#0d7377' },
          { label: 'Mass Production', value: 25, color: '#10b981' },
        ],
      };
    default:
      return { id: baseId, type };
  }
};

// In-memory filter rule engine
const applyFilterRules = (rows = [], rules = []) => {
  if (!Array.isArray(rows)) return [];
  if (!Array.isArray(rules) || rules.length === 0) return rows;

  return rows.filter((row) => {
    return rules.every((rule) => {
      if (!rule || !rule.field) return true;
      const rawVal = row[rule.field];
      const valStr = String(rawVal ?? '').trim().toLowerCase();
      const targetStr = String(rule.value ?? '').trim().toLowerCase();

      switch (rule.operator) {
        case 'equals':
        case '=':
          return valStr === targetStr;
        case 'not_equals':
        case '!=':
          return valStr !== targetStr;
        case 'contains':
          return valStr.includes(targetStr);
        case 'not_contains':
          return !valStr.includes(targetStr);
        case 'greater':
        case '>':
          return (parseFloat(rawVal) || 0) > (parseFloat(rule.value) || 0);
        case 'less':
        case '<':
          return (parseFloat(rawVal) || 0) < (parseFloat(rule.value) || 0);
        case 'is_empty':
          return rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
        case 'is_not_empty':
          return rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
        default:
          return true;
      }
    });
  });
};

// Excel-like formula engine
const evalExcelFormula = (formulaStr, rows = []) => {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.trim().startsWith('=')) return null;
  const expr = formulaStr.trim().substring(1).trim();
  const match = expr.match(/^([A-Z_]+)\s*\((.*)\)$/i);
  if (!match) return null;
  const fn = match[1].toUpperCase();
  const rawArg = match[2].trim();
  const args = rawArg ? rawArg.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')) : [];
  const col = args[0] || '';
  const targetVal = args[1] !== undefined ? args[1] : '';

  switch (fn) {
    case 'COUNT':
      return { fn, result: rows.length, label: `COUNT(${col || 'rows'})` };
    case 'COUNTA': {
      const count = rows.filter((r) => r[col] !== undefined && r[col] !== null && String(r[col]).trim() !== '').length;
      return { fn, result: count, label: `COUNTA(${col})` };
    }
    case 'COUNTIF': {
      const count = rows.filter((r) => String(r[col] || '').trim().toLowerCase() === String(targetVal).trim().toLowerCase()).length;
      return { fn, result: count, label: `COUNTIF(${col}, "${targetVal}")` };
    }
    case 'SUM': {
      const sum = rows.reduce((acc, r) => acc + (parseFloat(r[col]) || 0), 0);
      return { fn, result: Math.round(sum * 100) / 100, label: `SUM(${col})` };
    }
    case 'AVERAGE':
    case 'AVG': {
      if (rows.length === 0) return { fn, result: 0, label: `AVERAGE(${col})` };
      const sum = rows.reduce((acc, r) => acc + (parseFloat(r[col]) || 0), 0);
      const avg = Math.round((sum / rows.length) * 100) / 100;
      return { fn, result: avg, label: `AVERAGE(${col})` };
    }
    case 'MAX': {
      if (rows.length === 0) return { fn, result: 0, label: `MAX(${col})` };
      const max = Math.max(...rows.map((r) => parseFloat(r[col]) || 0));
      return { fn, result: isFinite(max) ? max : 0, label: `MAX(${col})` };
    }
    case 'MIN': {
      if (rows.length === 0) return { fn, result: 0, label: `MIN(${col})` };
      const min = Math.min(...rows.map((r) => parseFloat(r[col]) || 0));
      return { fn, result: isFinite(min) ? min : 0, label: `MIN(${col})` };
    }
    default:
      return null;
  }
};

export const ReportEditorPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const templateIdParam = searchParams.get('templateId');
  const ragParam = searchParams.get('rag');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeMcpList, setActiveMcpList] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (isAiModalOpen) {
      api.get('/ai/mcp-connectors')
        .then((res) => {
          if (res.data?.mcp_connectors) {
            setActiveMcpList(res.data.mcp_connectors);
          }
        })
        .catch(() => {});
    }
  }, [isAiModalOpen]);

  // Global ticker for countdown widgets
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Document state
  const [reportId, setReportId] = useState(id || null);
  const [title, setTitle] = useState('Daily Engineering Work Report');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [toRecipients, setToRecipients] = useState('manager@samsung.com');
  const [ccRecipients, setCcRecipients] = useState('');
  const [status, setStatus] = useState('draft');
  const [blocks, setBlocks] = useState([
    { id: '1', type: 'heading', content: '1. Daily Operations & Technical Accomplishments' },
    { id: '2', type: 'paragraph', content: 'Conducted routine line inspection, monitored JIG sensor repeatability, and checked parameter offsets.' },
    {
      id: '3',
      type: 'db_widget',
      widget: 'tasks',
      title: 'Live Assigned Tasks',
      filterRules: [],
      excelFormula: '=COUNT(rows)',
      limit: 5,
    },
    { id: '4', type: 'heading', content: '2. Issues, Blockers & Tomorrow Action Plan' },
    {
      id: '5',
      type: 'checklist',
      items: [
        { text: 'Confirm updated firmware flash timing with Solution Team', done: true },
        { text: 'Submit JIG calibration report to Mecha Leader', done: false },
      ],
    },
  ]);

  // Live DB Scraped Data Cache (includes tasks, models, projects, dhl, software_mr, gba_tasks)
  const [liveDbData, setLiveDbData] = useState(null);
  const [emailLists, setEmailLists] = useState([]);

  // Panel toggles per block
  const [filterPanelOpen, setFilterPanelOpen] = useState({});
  const [formulaPanelOpen, setFormulaPanelOpen] = useState({});
  const [widgetSettingsOpen, setWidgetSettingsOpen] = useState({});

  const toggleFilterPanel = (blockId) => {
    setFilterPanelOpen((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const toggleFormulaPanel = (blockId) => {
    setFormulaPanelOpen((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const toggleWidgetSettings = (blockId) => {
    setWidgetSettingsOpen((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load live DB data and custom email lists on load
  const loadDbActivities = async () => {
    try {
      const [scrapedRes, dhlRes, swRes, gbaRes] = await Promise.allSettled([
        api.get('/reports/scrape/activities'),
        api.get('/dhl/shipments'),
        api.get('/software-mr?limit=100'),
        api.get('/gba-tasks'),
      ]);

      const baseData = scrapedRes.status === 'fulfilled' && scrapedRes.value?.data ? scrapedRes.value.data : {};

      let gbaList = [];
      if (gbaRes.status === 'fulfilled' && gbaRes.value?.data) {
        const rawGba = gbaRes.value.data;
        if (rawGba.columns && typeof rawGba.columns === 'object') {
          Object.entries(rawGba.columns).forEach(([st, tasks]) => {
            if (Array.isArray(tasks)) {
              tasks.forEach((t) => gbaList.push({ ...t, status: t.status || st }));
            }
          });
        } else if (Array.isArray(rawGba)) {
          gbaList = rawGba;
        }
      }

      setLiveDbData({
        ...baseData,
        dhl: dhlRes.status === 'fulfilled' && Array.isArray(dhlRes.value?.data) ? dhlRes.value.data : [],
        software_mr: swRes.status === 'fulfilled' && Array.isArray(swRes.value?.data?.items)
          ? swRes.value.data.items
          : (swRes.status === 'fulfilled' && Array.isArray(swRes.value?.data) ? swRes.value.data : []),
        gba_tasks: gbaList,
      });
    } catch (e) {
      console.warn('Could not load DB activities cache', e);
    }
  };

  const loadEmailLists = async () => {
    try {
      const res = await api.get('/users/me/email-lists');
      setEmailLists(res.data || []);
    } catch (e) {
      // ignore
    }
  };

  const appendRecipients = (emails, target = 'to') => {
    const current = target === 'to' ? toRecipients : ccRecipients;
    const currList = current.split(',').map((s) => s.trim()).filter(Boolean);
    const addList = emails.split(',').map((s) => s.trim()).filter(Boolean);
    const combined = Array.from(new Set([...currList, ...addList])).join(', ');
    if (target === 'to') {
      setToRecipients(combined);
    } else {
      setCcRecipients(combined);
    }
    showNotification('success', `Quick added recipients to ${target.toUpperCase()}`);
  };

  useEffect(() => {
    loadDbActivities();
    loadEmailLists();

    if (id) {
      setLoading(true);

      api.get(`/reports/${id}`)
        .then((res) => {
          const rep = res.data;
          setReportId(rep.id);
          setTitle(rep.title);
          setReportDate(rep.report_date);
          setStatus(rep.status);
          if (rep.content) {
            try {
              const parsed = typeof rep.content === 'string' ? JSON.parse(rep.content) : rep.content;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setBlocks(parsed);
              }
            } catch (e) {
              // keep default
            }
          }
          if (rep.recipients) {
            try {
              const rec = typeof rep.recipients === 'string' ? JSON.parse(rep.recipients) : rep.recipients;
              setToRecipients((rec.to || []).join(', '));
              setCcRecipients((rec.cc || []).join(', '));
            } catch (e) {
              // keep default
            }
          }
        })
        .finally(() => setLoading(false));
    } else if (templateIdParam) {
      setLoading(true);
      api.get(`/reports/templates/${templateIdParam}`)
        .then((res) => {
          const tmpl = res.data;
          setTitle(tmpl.title);
          if (tmpl.content) {
            try {
              const parsed = typeof tmpl.content === 'string' ? JSON.parse(tmpl.content) : tmpl.content;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setBlocks(parsed);
              }
            } catch (e) {
              // keep default
            }
          }
        })
        .finally(() => setLoading(false));
    } else if (ragParam) {
      handleSynthesizeFromDB();
    }
  }, [id, templateIdParam]);

  // Synthesize via RAG from database activities with optional custom prompt
  const handleSynthesizeFromDB = async (promptOverride) => {
    setSynthesizing(true);
    const activePrompt = typeof promptOverride === 'string' ? promptOverride : customPrompt;
    try {
      const res = await api.post('/reports/ai-synthesize', { prompt: activePrompt || '' });
      if (res.data.title) setTitle(res.data.title);
      if (res.data.blocks && res.data.blocks.length > 0) {
        // ponytail: robust block normalization for chart selection and IDs
        const normalized = res.data.blocks.map((b, idx) => {
          const id = b.id || `blk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          let type = b.type || 'paragraph';
          if (type === 'pie' || type === 'pie_chart' || type === 'piechart') type = 'chart_pie';
          else if (type === 'donut' || type === 'donut_chart' || type === 'donutchart') type = 'chart_donut';
          else if (type === 'bar' || type === 'bar_chart' || type === 'barchart') type = 'chart_bar';
          else if (type === 'line' || type === 'line_chart' || type === 'linechart') type = 'chart_line';

          const block = { ...b, id, type };

          if (block.type === 'db_widget') {
            if (['pie', 'donut', 'bar'].includes(block.displayMode)) {
              block.chartType = block.displayMode;
              block.displayMode = 'chart';
            }
            if (block.displayMode === 'chart' && !block.chartType) {
              block.chartType = 'bar';
            }
          } else if ((block.type === 'chart_pie' || block.type === 'chart_donut') && (!block.data || block.data.length === 0)) {
            block.data = [
              { label: 'Completed', value: 65, color: '#10b981' },
              { label: 'In Progress', value: 25, color: '#0284c7' },
              { label: 'Pending', value: 10, color: '#f59e0b' },
            ];
          } else if (block.type === 'chart_bar' && (!block.data || block.data.length === 0)) {
            block.data = [
              { label: 'SMT', value: 14 },
              { label: 'FATP', value: 8 },
              { label: 'Mecha JIG', value: 22 },
            ];
          }

          return block;
        });
        setBlocks(normalized);
      }
      setIsAiModalOpen(false);
      showNotification('success', t('reports.ai_synthesize_success', 'Report draft successfully synthesized by AI!'));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  // Block management
  const updateBlockContent = (index, newContent) => {
    setBlocks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], content: newContent };
      return copy;
    });
  };

  const updateBlockProp = (index, prop, value) => {
    setBlocks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [prop]: value };
      return copy;
    });
  };

  const addFilterRule = (blockIndex, preset = null) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const targetWidget = copy[blockIndex].widget || 'tasks';
      const defaultField = WIDGET_COLUMNS[targetWidget]?.[0]?.key || 'status';
      const newRule = preset || { field: defaultField, operator: 'equals', value: '' };
      const currentRules = Array.isArray(copy[blockIndex].filterRules) ? copy[blockIndex].filterRules : [];
      copy[blockIndex] = { ...copy[blockIndex], filterRules: [...currentRules, newRule] };
      return copy;
    });
  };

  const updateFilterRule = (blockIndex, ruleIndex, field, operator, value) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const currentRules = [...(copy[blockIndex].filterRules || [])];
      currentRules[ruleIndex] = { field, operator, value };
      copy[blockIndex] = { ...copy[blockIndex], filterRules: currentRules };
      return copy;
    });
  };

  const removeFilterRule = (blockIndex, ruleIndex) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const currentRules = (copy[blockIndex].filterRules || []).filter((_, i) => i !== ruleIndex);
      copy[blockIndex] = { ...copy[blockIndex], filterRules: currentRules };
      return copy;
    });
  };

  const updateChecklistItem = (blockIndex, itemIndex, done, text) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const items = [...(copy[blockIndex].items || [])];
      items[itemIndex] = { ...items[itemIndex], done, text };
      copy[blockIndex] = { ...copy[blockIndex], items };
      return copy;
    });
  };

  const addChecklistItem = (blockIndex) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const items = [...(copy[blockIndex].items || []), { text: '', done: false }];
      copy[blockIndex] = { ...copy[blockIndex], items };
      return copy;
    });
  };

  // ponytail: smart vote casting (1 vote per user, switch vote support, anti-spam)
  const handleCastVote = (blockIndex, optIndex) => {
    const voterId = user?.username || user?.email || user?.name || 'CurrentUser';
    const voterName = user?.name || user?.username || 'User';

    setBlocks((prev) => {
      const copy = [...prev];
      const blk = { ...copy[blockIndex] };
      const opts = (blk.options || []).map((o) => ({
        ...o,
        voters: Array.isArray(o.voters) ? [...o.voters] : [],
      }));

      const prevVoteIndex = blk.userVoted;

      // Anti-spam: if clicked the exact same option already, do nothing
      if (prevVoteIndex === optIndex) {
        return prev;
      }

      // If previously voted for another option, decrement old and remove voter
      if (typeof prevVoteIndex === 'number' && opts[prevVoteIndex]) {
        opts[prevVoteIndex] = {
          ...opts[prevVoteIndex],
          votes: Math.max((Number(opts[prevVoteIndex].votes) || 0) - 1, 0),
          voters: opts[prevVoteIndex].voters.filter((v) => (typeof v === 'string' ? v !== voterId : v?.id !== voterId)),
        };
      }

      // Increment new option and append voter
      if (opts[optIndex]) {
        const existingWithoutCurrent = opts[optIndex].voters.filter((v) => (typeof v === 'string' ? v !== voterId : v?.id !== voterId));
        opts[optIndex] = {
          ...opts[optIndex],
          votes: (Number(opts[optIndex].votes) || 0) + 1,
          voters: [...existingWithoutCurrent, { id: voterId, name: voterName }],
        };
      }

      blk.options = opts;
      blk.userVoted = optIndex;
      copy[blockIndex] = blk;
      return copy;
    });
  };

  const removeBlock = (index) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const addBlock = (type, extra = {}) => {
    const defaultData = createDefaultBlock(type);
    const newBlock = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      type,
      content: type === 'heading' ? 'New Section' : type === 'paragraph' ? '' : undefined,
      ...defaultData,
      ...extra,
    };
    setBlocks([...blocks, newBlock]);
  };

  // Dedicated Email SVG generators for charts
  const generateLineChartHtml = (b) => {
    const data = b.data || [];
    if (data.length === 0) return '';
    const pad = 36;
    const width = 500;
    const height = 180;
    const color = b.color || '#0d7377';
    const vals = data.map((d) => Number(d.value) || 0);
    const minVal = Math.min(...vals, 0);
    const maxVal = Math.max(...vals, 100);
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (width - 2 * pad);
      const y = height - pad - (((Number(d.value) || 0) - minVal) / range) * (height - 2 * pad);
      return { x: Math.round(x), y: Math.round(y), ...d };
    });

    const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath = points.length > 0
      ? `M ${points[0].x},${height - pad} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x},${height - pad} Z`
      : '';

    let pointsSvg = '';
    points.forEach((p) => {
      pointsSvg += `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="${color}" stroke-width="2.5" />
        <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${p.value}</text>
        <text x="${p.x}" y="${height - pad + 16}" text-anchor="middle" font-size="10" fill="#64748b">${p.label}</text>
      `;
    });

    return `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin:14px 0; text-align:center;">
        <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:12px; text-transform:uppercase; text-align:left;">📈 LINE CHART: ${b.title || 'Trend'}</div>
        <div style="width:100%; max-width:520px; margin:0 auto; overflow:visible;">
          <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; max-width:520px; margin:0 auto;">
            <defs>
              <linearGradient id="emailLineGrad-${b.id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.3" />
                <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}" stroke="#e2e8f0" stroke-dasharray="3 3" />
            <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}" stroke="#e2e8f0" stroke-dasharray="3 3" />
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#cbd5e1" />
            ${areaPath ? `<path d="${areaPath}" fill="url(#emailLineGrad-${b.id})" />` : ''}
            ${polylineStr ? `<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylineStr}" />` : ''}
            ${pointsSvg}
          </svg>
        </div>
      </div>
    `;
  };

  const generateBarChartHtml = (b) => {
    const data = b.data || [];
    if (data.length === 0) return '';
    const pad = 36;
    const width = 500;
    const height = 180;
    const color = b.color || '#0284c7';
    const vals = data.map((d) => Number(d.value) || 0);
    const maxVal = Math.max(...vals, 10);
    const availWidth = width - 2 * pad;
    const barWidth = Math.min(availWidth / Math.max(data.length, 1) - 12, 42);

    let barsSvg = '';
    data.forEach((d, i) => {
      const h = ((Number(d.value) || 0) / maxVal) * (height - 2 * pad);
      const x = pad + (i + 0.5) * (availWidth / data.length) - barWidth / 2;
      const y = height - pad - h;
      barsSvg += `
        <rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(barWidth)}" height="${Math.round(h)}" rx="4" fill="${color}" opacity="0.88" />
        <text x="${Math.round(x + barWidth / 2)}" y="${Math.round(y - 6)}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${d.value}</text>
        <text x="${Math.round(x + barWidth / 2)}" y="${height - pad + 16}" text-anchor="middle" font-size="10" fill="#64748b">${d.label}</text>
      `;
    });

    return `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin:14px 0; text-align:center;">
        <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:12px; text-transform:uppercase; text-align:left;">📊 BAR CHART: ${b.title || 'Bar Chart'}</div>
        <div style="width:100%; max-width:520px; margin:0 auto;">
          <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; max-width:520px; margin:0 auto;">
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#cbd5e1" />
            ${barsSvg}
          </svg>
        </div>
      </div>
    `;
  };

  const generatePieOrDonutHtml = (b, isDonut = false) => {
    const data = b.data || [];
    if (data.length === 0) return '';
    const total = data.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;
    const gradient = getConicGradient(data);

    let legendHtml = '';
    data.forEach((d, i) => {
      const color = d.color || COLOR_PALETTE[i % COLOR_PALETTE.length];
      const pct = Math.round(((Number(d.value) || 0) / total) * 100);
      legendHtml += `
        <div style="display:inline-flex; align-items:center; gap:6px; margin:4px 8px; font-size:11px; color:#334155;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${color}; flex-shrink:0;"></span>
          <strong>${d.label}:</strong>&nbsp;${d.value}&nbsp;(${pct}%)
        </div>
      `;
    });

    const chartTypeLabel = isDonut ? '🍩 DONUT CHART' : '🥧 PIE CHART';

    const circleHtml = isDonut
      ? `
        <div style="width:170px; height:170px; min-width:170px; min-height:170px; aspect-ratio:1/1; border-radius:50%; background:${gradient}; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.08); margin:0 auto;">
          <div style="width:102px; height:102px; min-width:102px; min-height:102px; aspect-ratio:1/1; border-radius:50%; background-color:#ffffff; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <div style="font-size:20px; font-weight:800; font-family:monospace; color:#0f172a; line-height:1;">${total}</div>
            <div style="font-size:9px; font-weight:700; color:#64748b; letter-spacing:1px; margin-top:2px;">TOTAL</div>
          </div>
        </div>
      `
      : `
        <div style="width:170px; height:170px; min-width:170px; min-height:170px; aspect-ratio:1/1; border-radius:50%; background:${gradient}; display:inline-block; box-shadow:0 3px 10px rgba(0,0,0,0.08); margin:0 auto;"></div>
      `;

    return `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin:14px 0; text-align:center;">
        <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:14px; text-transform:uppercase; text-align:left;">${chartTypeLabel}: ${b.title || 'Distribution'}</div>
        <table align="center" style="margin:0 auto; width:100%; border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:8px 0;">
              ${circleHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:12px;">
              <div style="display:flex; justify-content:center; flex-wrap:wrap;">
                ${legendHtml}
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  // Compile to HTML (incorporating filtered tables, DHL, SW Release, GBA tasks, and interactive widgets)
  const generateEmailHtml = () => {
    let bodyRows = '';

    blocks.forEach((b) => {
      if (b.type === 'heading') {
        bodyRows += `<h3 style="color:#0f172a; margin-top:20px; margin-bottom:8px; border-bottom:2px solid #e2e8f0; padding-bottom:6px; font-size:16px;">${b.content || ''}</h3>`;
      } else if (b.type === 'paragraph') {
        bodyRows += `<p style="color:#334155; line-height:1.6; margin:8px 0; font-size:13px;">${(b.content || '').replace(/\n/g, '<br>')}</p>`;
      } else if (b.type === 'checklist') {
        bodyRows += '<ul style="list-style:none; padding-left:0; margin:10px 0;">';
        (b.items || []).forEach((item) => {
          const checkIcon = item.done ? '☑' : '☐';
          const textStyle = item.done ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
          bodyRows += `<li style="margin:4px 0; font-size:13px;"><span style="color:#0d7377; font-weight:bold; margin-right:6px;">${checkIcon}</span><span style="${textStyle}">${item.text}</span></li>`;
        });
        bodyRows += '</ul>';
      } else if (b.type === 'countdown') {
        const tl = getCountdown(b.targetDate, Date.now());
        bodyRows += `
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin:14px 0; text-align:center;">
            <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:12px; text-transform:uppercase;">⏳ COUNTDOWN: ${b.title || 'Event Milestone'}</div>
            <table align="center" style="margin:0 auto; width:360px; max-width:100%; border-collapse:separate; border-spacing:8px; table-layout:fixed;">
              <tr>
                <td width="25%" style="width:25%; height:74px; background:#0d7377; color:#ffffff; border-radius:8px; padding:10px 4px; text-align:center; vertical-align:middle; box-sizing:border-box;">
                  <div style="font-size:24px; font-weight:800; font-family:monospace; line-height:1;">${tl.days}</div>
                  <div style="font-size:10px; font-weight:700; opacity:0.85; margin-top:4px; letter-spacing:0.8px;">DAYS</div>
                </td>
                <td width="25%" style="width:25%; height:74px; background:#0f172a; color:#ffffff; border-radius:8px; padding:10px 4px; text-align:center; vertical-align:middle; box-sizing:border-box;">
                  <div style="font-size:24px; font-weight:800; font-family:monospace; line-height:1;">${String(tl.hours).padStart(2, '0')}</div>
                  <div style="font-size:10px; font-weight:700; opacity:0.85; margin-top:4px; letter-spacing:0.8px;">HOURS</div>
                </td>
                <td width="25%" style="width:25%; height:74px; background:#0f172a; color:#ffffff; border-radius:8px; padding:10px 4px; text-align:center; vertical-align:middle; box-sizing:border-box;">
                  <div style="font-size:24px; font-weight:800; font-family:monospace; line-height:1;">${String(tl.minutes).padStart(2, '0')}</div>
                  <div style="font-size:10px; font-weight:700; opacity:0.85; margin-top:4px; letter-spacing:0.8px;">MINUTES</div>
                </td>
                <td width="25%" style="width:25%; height:74px; background:#0f172a; color:#ffffff; border-radius:8px; padding:10px 4px; text-align:center; vertical-align:middle; box-sizing:border-box;">
                  <div style="font-size:24px; font-weight:800; font-family:monospace; line-height:1;">${String(tl.seconds).padStart(2, '0')}</div>
                  <div style="font-size:10px; font-weight:700; opacity:0.85; margin-top:4px; letter-spacing:0.8px;">SECONDS</div>
                </td>
              </tr>
            </table>
            <div style="margin-top:10px; font-size:11px; color:#64748b;">Target Date: ${b.targetDate ? new Date(b.targetDate).toLocaleString() : '-'}</div>
          </div>
        `;
      } else if (b.type === 'vote') {
        const total = (b.options || []).reduce((acc, o) => acc + (Number(o.votes) || 0), 0) || 1;
        const isAnon = b.isAnonymous !== false;
        bodyRows += `
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin:14px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-weight:700; color:#0d7377; font-size:12px; text-transform:uppercase;">🗳️ POLL / VOTE: ${b.question || 'Survey'}</div>
              <span style="font-size:10px; font-weight:600; padding:2px 8px; border-radius:12px; background:${isAnon ? '#f1f5f9' : '#ecfdf5'}; color:${isAnon ? '#64748b' : '#059669'}; border:1px solid ${isAnon ? '#cbd5e1' : '#a7f3d0'};">
                ${isAnon ? '🕶️ Anonymous' : '👥 Visible Partisipan'}
              </span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
        `;
        (b.options || []).forEach((o) => {
          const pct = Math.round(((Number(o.votes) || 0) / total) * 100);
          const votersList = (!isAnon && Array.isArray(o.voters) && o.voters.length > 0)
            ? `<div style="font-size:10px; color:#64748b; margin-top:4px;">👥 Partisipan: ${o.voters.map((v) => (typeof v === 'string' ? v : v?.name || v?.id)).join(', ')}</div>`
            : '';
          bodyRows += `
            <div style="margin:6px 0; background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; padding:8px 12px;">
              <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:#1e293b; margin-bottom:4px;">
                <span>${o.text}</span>
                <span style="color:#0d7377;">${o.votes || 0} votes (${pct}%)</span>
              </div>
              <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:#0d7377;"></div>
              </div>
              ${votersList}
            </div>
          `;
        });
        bodyRows += '</div></div>';
      } else if (b.type === 'chart_line') {
        bodyRows += generateLineChartHtml(b);
      } else if (b.type === 'chart_bar') {
        bodyRows += generateBarChartHtml(b);
      } else if (b.type === 'chart_pie') {
        bodyRows += generatePieOrDonutHtml(b, false);
      } else if (b.type === 'chart_donut') {
        bodyRows += generatePieOrDonutHtml(b, true);
      } else if (b.type === 'db_widget') {
        const rawRows = liveDbData?.[b.widget] || [];
        const filteredRows = applyFilterRules(rawRows, b.filterRules);
        const limit = b.limit || 5;
        const visibleRows = filteredRows.slice(0, limit);
        const formulaRes = evalExcelFormula(b.excelFormula, filteredRows);

        // ponytail: support chart view in email preview
        if (b.displayMode === 'chart') {
          const chartData = getDbChartData(b.widget, filteredRows, b.chartType || 'bar');
          const chartPayload = {
            title: `LIVE DB (${b.title || b.widget}) - ${b.chartType === 'donut' ? 'Donut' : b.chartType === 'pie' ? 'Pie' : 'Bar'} View`,
            data: chartData,
            color: '#0d7377',
          };

          if (b.chartType === 'donut') {
            bodyRows += generatePieOrDonutHtml(chartPayload, true);
          } else if (b.chartType === 'pie') {
            bodyRows += generatePieOrDonutHtml(chartPayload, false);
          } else {
            bodyRows += generateBarChartHtml(chartPayload);
          }

          if (formulaRes) {
            bodyRows += `<div style="margin:-10px 0 14px; padding:6px 12px; background:#e2e8f0; font-size:11px; font-weight:bold; color:#0f172a; border-radius:0 0 6px 6px; text-align:center;">📐 fx Formula Result (${formulaRes.label}): <span style="color:#0d7377;">${formulaRes.result}</span></div>`;
          }
        } else {
          bodyRows += `<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:12px; margin:12px 0;">
            <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:8px; text-transform:uppercase;">📊 LIVE DATABASE: ${b.title || b.widget}</div>`;

          if (b.widget === 'tasks') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">Title</th><th style="padding:4px 6px;">Status</th><th style="padding:4px 6px;">Assignee</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="3" style="padding:8px; text-align:center; color:#94a3b8;">No matching tasks</td></tr>';
            } else {
              visibleRows.forEach((t) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:500;">${t.title}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1; text-transform:uppercase;">${t.status}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#64748b;">${t.assignee_name || '-'}</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          } else if (b.widget === 'models') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">Model</th><th style="padding:4px 6px;">Codename</th><th style="padding:4px 6px;">Stage</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="3" style="padding:8px; text-align:center; color:#94a3b8;">No matching models</td></tr>';
            } else {
              visibleRows.forEach((m) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0d7377;">${m.model_name}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-family:monospace;">${m.codename || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1;">${(m.stage || '').toUpperCase()}</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          } else if (b.widget === 'projects') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">Project</th><th style="padding:4px 6px;">Status</th><th style="padding:4px 6px;">Progress</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="3" style="padding:8px; text-align:center; color:#94a3b8;">No matching projects</td></tr>';
            } else {
              visibleRows.forEach((p) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600;">${p.title}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; text-transform:uppercase;">${p.status}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#10b981; font-weight:bold;">${p.progress}%</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          } else if (b.widget === 'dhl') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">AWB / Tracking</th><th style="padding:4px 6px;">Status</th><th style="padding:4px 6px;">Origin → Dest</th><th style="padding:4px 6px;">PIC</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8;">No matching DHL shipments</td></tr>';
            } else {
              visibleRows.forEach((d) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600; font-family:monospace; color:#0d7377;">${d.tracking_number}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1;">${d.status_label || d.status_code || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0;">${d.origin_country || '-'} → ${d.dest_country || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#64748b;">${d.pic || '-'}</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          } else if (b.widget === 'software_mr') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">Model</th><th style="padding:4px 6px;">PIC</th><th style="padding:4px 6px;">AP</th><th style="padding:4px 6px;">CP</th><th style="padding:4px 6px;">CSC</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="5" style="padding:8px; text-align:center; color:#94a3b8;">No matching SW releases</td></tr>';
            } else {
              visibleRows.forEach((s) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0d7377;">${s.model}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0;">${s.pic || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-family:monospace; font-size:11px;">${s.ap || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-family:monospace; font-size:11px;">${s.cp || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-family:monospace; font-size:11px;">${s.csc || '-'}</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          } else if (b.widget === 'gba_tasks') {
            bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
            bodyRows += '<thead><tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 6px;">Model / Project</th><th style="padding:4px 6px;">Stage</th><th style="padding:4px 6px;">Status</th><th style="padding:4px 6px;">PIC</th></tr></thead><tbody>';
            if (visibleRows.length === 0) {
              bodyRows += '<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8;">No matching GBA tasks</td></tr>';
            } else {
              visibleRows.forEach((g) => {
                bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600;">${g.model_name || g.project_name || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0;">${g.stage || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1; text-transform:uppercase;">${g.status || '-'}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#64748b;">${g.pic_email || '-'}</td></tr>`;
              });
            }
            bodyRows += '</tbody>';
          }

          if (formulaRes && b.widget !== 'mcp_gba') {
            bodyRows += `<tfoot><tr><td colspan="6" style="padding:8px 6px; background:#e2e8f0; font-size:11px; font-weight:bold; color:#0f172a; border-top:1px solid #cbd5e1;">📐 fx Formula Result (${formulaRes.label}): <span style="color:#0d7377;">${formulaRes.result}</span></td></tr></tfoot>`;
            bodyRows += '</table>';
          } else if (b.widget !== 'mcp_gba') {
            bodyRows += '</table>';
          } else {
            bodyRows += '<div style="padding:6px; font-size:12px; color:#475569;">MCP: Google Build Approval Status connected to http://107.102.39.55:3800/mcp</div>';
          }

          bodyRows += '</div>';
        }
      }
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px 16px; margin: 0; color: #1e293b; }
    .email-container { width: 100%; max-width: 960px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05); }
    .email-header { background: #0d7377; padding: 24px 28px; color: #ffffff; }
    .email-content { padding: 28px; }
    .email-footer { background: #f8fafc; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
    @media only screen and (max-width: 600px) {
      body { padding: 8px !important; }
      .email-header { padding: 16px !important; }
      .email-content { padding: 16px !important; }
      .email-footer { padding: 12px 14px !important; }
    }
  </style>
</head>
<body>
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table class="email-container" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 960px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <tr>
            <td class="email-header" style="background-color: #0d7377; padding: 24px 28px; color: #ffffff;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px;">SEIN PE PORTAL</span>
              <h1 style="margin: 10px 0 4px 0; font-size: 22px;">${title}</h1>
              <p style="margin: 0; font-size: 12px; opacity: 0.9;">Report Date: ${reportDate}</p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding: 28px;">
              ${bodyRows}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="background: #f8fafc; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
              Production Engineer Team Portal • PT. Samsung Electronics Indonesia
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  };

  const handleOpenPreview = () => {
    setPreviewHtml(generateEmailHtml());
    setIsPreviewOpen(true);
  };

  // Save report
  const handleSave = async (saveStatus = status) => {
    setSaving(true);
    const toList = toRecipients.split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = ccRecipients.split(',').map((s) => s.trim()).filter(Boolean);
    const html = generateEmailHtml();

    const payload = {
      title,
      report_date: reportDate,
      status: saveStatus,
      content: blocks,
      rendered_html: html,
      recipients: { to: toList, cc: ccList },
    };

    try {
      let saved;
      if (reportId) {
        const res = await api.put(`/reports/${reportId}`, payload);
        saved = res.data;
      } else {
        const res = await api.post('/reports', payload);
        saved = res.data;
        setReportId(saved.id);
      }
      showNotification('success', 'Report saved successfully');
      return saved;
    } catch (err) {
      alert(err.response?.data?.message || err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Send via SMTP
  const handleSendViaSMTP = async () => {
    setSending(true);
    try {
      const saved = await handleSave('sent');
      if (!saved) return;

      await api.post(`/reports/${saved.id}/send`);
      setStatus('sent');
      showNotification('success', 'Email sent successfully!');
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState message="Loading report editor..." />;

  return (
    <div className={styles.container}>
      {/* Top action bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/reports')}
          >
            Back to Reports
          </Button>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Status: <strong style={{ textTransform: 'uppercase', color: status === 'sent' ? 'var(--color-success)' : 'var(--color-accent)' }}>{status}</strong>
          </span>
        </div>

        <div className={styles.topBarRight}>
          <Button
            variant="outline"
            size="sm"
            icon={Sparkles}
            loading={synthesizing}
            onClick={() => setIsAiModalOpen(true)}
            title="Auto-draft from DB tasks & projects or Custom AI Prompt"
          >
            {t('reports.btn_ai_draft', 'AI Prompt Draft')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Eye}
            onClick={handleOpenPreview}
          >
            Preview Email
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={Save}
            loading={saving}
            onClick={() => handleSave(status)}
          >
            Save Draft
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            onClick={handleSendViaSMTP}
          >
            Send Email
          </Button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor:
              notification.type === 'success'
                ? 'var(--color-success-subtle)'
                : 'var(--color-error-subtle)',
            color:
              notification.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)',
            border: `1px solid ${
              notification.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)'
            }`,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Document header / metadata */}
      <div className={styles.documentMetaCard}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Report Title..."
          className={styles.titleInput}
        />

        <div className={styles.metaRow}>
          <Input
            label="Report Date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className={styles.metaField}
          />

          <EmailChipInput
            label="Recipients (To)"
            value={toRecipients}
            onChange={(val) => setToRecipients(val)}
            placeholder="Type email & press Enter or comma..."
            required
            className={styles.metaField}
          />

          <EmailChipInput
            label="Recipients (CC)"
            value={ccRecipients}
            onChange={(val) => setCcRecipients(val)}
            placeholder="Optional CC recipients..."
            className={styles.metaField}
          />
        </div>

        {/* Quick Action: Insert from My Email Lists */}
        {emailLists.length > 0 && (
          <div className={styles.quickActionRow}>
            <span className={styles.quickActionLabel}>
              <Users size={13} />
              Quick Recipient Groups:
            </span>
            {emailLists.map((list) => (
              <div key={list.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  className={styles.quickActionChip}
                  onClick={() => appendRecipients(list.emails, 'to')}
                  title={`Click to add into TO: ${list.emails}`}
                >
                  <Mail size={11} />
                  + To: {list.name}
                </button>
                <button
                  type="button"
                  className={styles.quickActionChip}
                  onClick={() => appendRecipients(list.emails, 'cc')}
                  style={{ opacity: 0.8 }}
                  title={`Click to add into CC: ${list.emails}`}
                >
                  + CC
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notion-style Document Canvas */}
      <div className={styles.editorCanvas}>
        {blocks.map((block, index) => (
          <div key={block.id || index} className={styles.blockRow}>
            <div className={styles.blockActions}>
              <button
                type="button"
                className={styles.blockActionBtn}
                onClick={() => removeBlock(index)}
                title="Remove block"
              >
                <Trash2 size={13} color="var(--color-error)" />
              </button>
            </div>

            <div className={styles.blockContent}>
              {/* Heading Block */}
              {block.type === 'heading' && (
                <input
                  type="text"
                  value={block.content || ''}
                  onChange={(e) => updateBlockContent(index, e.target.value)}
                  className={styles.headingInput}
                  placeholder="Heading title..."
                />
              )}

              {/* Paragraph Block */}
              {block.type === 'paragraph' && (
                <FormattingTextarea
                  value={block.content || ''}
                  onChange={(e) => updateBlockContent(index, e.target.value)}
                  placeholder="Type your notes or description here..."
                  rows={4}
                  minHeight="90px"
                />
              )}

              {/* Checklist Block */}
              {block.type === 'checklist' && (
                <div className={styles.checklist}>
                  {(block.items || []).map((item, itemIdx) => (
                    <div key={itemIdx} className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          updateChecklistItem(index, itemIdx, e.target.checked, item.text)
                        }
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          updateChecklistItem(index, itemIdx, item.done, e.target.value)
                        }
                        className={`${styles.checklistInput} ${item.done ? styles.checkedText : ''}`}
                        placeholder="Task item..."
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addChecklistItem(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '2px 0',
                    }}
                  >
                    + Add checklist item
                  </button>
                </div>
              )}

              {/* COUNTDOWN WIDGET */}
              {block.type === 'countdown' && (
                (() => {
                  const tl = getCountdown(block.targetDate, now);
                  const isConfigOpen = Boolean(widgetSettingsOpen[block.id]);
                  return (
                    <div className={styles.widgetCard}>
                      <div className={styles.widgetCardHeader}>
                        <div className={styles.widgetCardTitle}>
                          <Timer size={15} />
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => updateBlockProp(index, 'title', e.target.value)}
                            placeholder="Milestone Title..."
                            className={styles.widgetCardTitleInput}
                          />
                        </div>
                        <div className={styles.dbWidgetTools}>
                          <button
                            type="button"
                            className={`${styles.toolChip} ${isConfigOpen ? styles.toolChipActive : ''}`}
                            onClick={() => toggleWidgetSettings(block.id)}
                            title="Edit Target Date"
                          >
                            <Settings size={11} />
                            <span>Set Target</span>
                            {isConfigOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {isConfigOpen && (
                        <div className={styles.widgetConfigPanel}>
                          <div className={styles.configRow}>
                            <label style={{ fontWeight: 600 }}>Target Date & Time:</label>
                            <input
                              type="datetime-local"
                              value={block.targetDate || ''}
                              onChange={(e) => updateBlockProp(index, 'targetDate', e.target.value)}
                              className={styles.configInput}
                            />
                          </div>
                        </div>
                      )}

                      <div className={styles.countdownGrid}>
                        <div className={styles.countdownBox}>
                          <div className={styles.countdownVal}>{tl.days}</div>
                          <div className={styles.countdownUnit}>Days</div>
                        </div>
                        <div className={styles.countdownBox}>
                          <div className={styles.countdownVal}>{String(tl.hours).padStart(2, '0')}</div>
                          <div className={styles.countdownUnit}>Hours</div>
                        </div>
                        <div className={styles.countdownBox}>
                          <div className={styles.countdownVal}>{String(tl.minutes).padStart(2, '0')}</div>
                          <div className={styles.countdownUnit}>Minutes</div>
                        </div>
                        <div className={styles.countdownBox}>
                          <div className={styles.countdownVal}>{String(tl.seconds).padStart(2, '0')}</div>
                          <div className={styles.countdownUnit}>Seconds</div>
                        </div>
                      </div>

                      <div className={styles.countdownTargetPill}>
                        <Calendar size={12} />
                        <span>Target: {block.targetDate ? new Date(block.targetDate).toLocaleString() : 'No date set'}</span>
                        {tl.isPast && <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>(Reached / Passed)</span>}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* VOTE / POLL WIDGET */}
              {block.type === 'vote' && (
                (() => {
                  const isConfigOpen = Boolean(widgetSettingsOpen[block.id]);
                  const totalVotes = (block.options || []).reduce((acc, o) => acc + (Number(o.votes) || 0), 0) || 1;
                  return (
                    <div className={styles.widgetCard}>
                      <div className={styles.widgetCardHeader}>
                        <div className={styles.widgetCardTitle}>
                          <Vote size={15} />
                          <input
                            type="text"
                            value={block.question || ''}
                            onChange={(e) => updateBlockProp(index, 'question', e.target.value)}
                            placeholder="Poll Question..."
                            className={styles.widgetCardTitleInput}
                            style={{ width: '380px' }}
                          />
                        </div>
                        <div className={styles.dbWidgetTools}>
                          {/* ponytail: Anonymous vs Visible Participant mode toggle */}
                          <div className={styles.viewToggleGroup} title="Vote Privacy Mode">
                            <button
                              type="button"
                              className={`${styles.viewToggleBtn} ${block.isAnonymous !== false ? styles.viewToggleBtnActive : ''}`}
                              onClick={() => updateBlockProp(index, 'isAnonymous', true)}
                            >
                              <Shield size={11} />
                              <span>Anonim</span>
                            </button>
                            <button
                              type="button"
                              className={`${styles.viewToggleBtn} ${block.isAnonymous === false ? styles.viewToggleBtnActive : ''}`}
                              onClick={() => updateBlockProp(index, 'isAnonymous', false)}
                            >
                              <Users size={11} />
                              <span>Visible</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            className={`${styles.toolChip} ${isConfigOpen ? styles.toolChipActive : ''}`}
                            onClick={() => toggleWidgetSettings(block.id)}
                            title="Edit Options"
                          >
                            <Settings size={11} />
                            <span>Edit Poll</span>
                            {isConfigOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {isConfigOpen && (
                        <div className={styles.widgetConfigPanel}>
                          <span style={{ fontWeight: 700 }}>Poll Options & Initial Votes:</span>
                          {(block.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className={styles.configRow}>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => {
                                  const copyOpts = [...block.options];
                                  copyOpts[optIdx] = { ...copyOpts[optIdx], text: e.target.value };
                                  updateBlockProp(index, 'options', copyOpts);
                                }}
                                placeholder="Option text..."
                                className={styles.configInput}
                                style={{ flex: 1 }}
                              />
                              <input
                                type="number"
                                value={opt.votes || 0}
                                onChange={(e) => {
                                  const copyOpts = [...block.options];
                                  copyOpts[optIdx] = { ...copyOpts[optIdx], votes: Number(e.target.value) };
                                  updateBlockProp(index, 'options', copyOpts);
                                }}
                                style={{ width: '65px' }}
                                className={styles.configInput}
                              />
                              <button
                                type="button"
                                className={styles.ruleDeleteBtn}
                                onClick={() => {
                                  const copyOpts = block.options.filter((_, i) => i !== optIdx);
                                  updateBlockProp(index, 'options', copyOpts);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addRuleBtn}
                            onClick={() => {
                              const copyOpts = [...(block.options || []), { text: 'New Option', votes: 0, voters: [] }];
                              updateBlockProp(index, 'options', copyOpts);
                            }}
                          >
                            <Plus size={11} /> Add Option
                          </button>
                        </div>
                      )}

                      <div className={styles.voteList}>
                        {(block.options || []).map((opt, optIdx) => {
                          const pct = Math.round(((Number(opt.votes) || 0) / totalVotes) * 100);
                          const isVoted = block.userVoted === optIdx;
                          const voters = Array.isArray(opt.voters) ? opt.voters : [];
                          return (
                            <div key={optIdx} className={styles.voteOptionWrapper}>
                              <button
                                type="button"
                                className={`${styles.voteOptionBtn} ${isVoted ? styles.voteOptionSelected : ''}`}
                                onClick={() => handleCastVote(index, optIdx)}
                                title={isVoted ? 'You voted for this' : 'Click to cast vote'}
                              >
                                <div className={styles.voteProgressTrack} style={{ width: `${pct}%` }} />
                                <div className={styles.voteOptionHeader}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {isVoted && <CheckCircle2 size={13} color="var(--color-primary)" />}
                                    {opt.text}
                                  </span>
                                  <span className={styles.voteStats}>{opt.votes || 0} votes ({pct}%)</span>
                                </div>
                              </button>
                              {block.isAnonymous === false && voters.length > 0 && (
                                <div className={styles.voterChipList}>
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Partisipan:</span>
                                  {voters.map((v, vIdx) => (
                                    <span key={vIdx} className={styles.voterNameChip}>
                                      {typeof v === 'string' ? v : (v?.name || v?.id || 'User')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* CHART: LINE */}
              {block.type === 'chart_line' && (
                (() => {
                  const isConfigOpen = Boolean(widgetSettingsOpen[block.id]);
                  const data = block.data || [];
                  const pad = 36;
                  const width = 500;
                  const height = 180;
                  const vals = data.map((d) => Number(d.value) || 0);
                  const minVal = Math.min(...vals, 0);
                  const maxVal = Math.max(...vals, 100);
                  const range = maxVal - minVal || 1;

                  const points = data.map((d, i) => {
                    const x = pad + (i / Math.max(data.length - 1, 1)) * (width - 2 * pad);
                    const y = height - pad - (((Number(d.value) || 0) - minVal) / range) * (height - 2 * pad);
                    return { x, y, ...d };
                  });

                  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
                  const areaPath = points.length > 0
                    ? `M ${points[0].x},${height - pad} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x},${height - pad} Z`
                    : '';

                  return (
                    <div className={styles.widgetCard}>
                      <div className={styles.widgetCardHeader}>
                        <div className={styles.widgetCardTitle}>
                          <LineChart size={15} />
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => updateBlockProp(index, 'title', e.target.value)}
                            placeholder="Chart Title..."
                            className={styles.widgetCardTitleInput}
                            style={{ width: '320px' }}
                          />
                        </div>
                        <div className={styles.dbWidgetTools}>
                          <button
                            type="button"
                            className={`${styles.toolChip} ${isConfigOpen ? styles.toolChipActive : ''}`}
                            onClick={() => toggleWidgetSettings(block.id)}
                            title="Edit Data Points"
                          >
                            <Settings size={11} />
                            <span>Edit Data</span>
                            {isConfigOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {isConfigOpen && (
                        <div className={styles.widgetConfigPanel}>
                          <span style={{ fontWeight: 700 }}>Data Points (Label & Value):</span>
                          {data.map((item, dIdx) => (
                            <div key={dIdx} className={styles.configRow}>
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], label: e.target.value };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Label..."
                                className={styles.configInput}
                                style={{ width: '120px' }}
                              />
                              <input
                                type="number"
                                step="any"
                                value={item.value}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], value: parseFloat(e.target.value) || 0 };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Value..."
                                className={styles.configInput}
                                style={{ width: '90px' }}
                              />
                              <button
                                type="button"
                                className={styles.ruleDeleteBtn}
                                onClick={() => {
                                  const copy = data.filter((_, i) => i !== dIdx);
                                  updateBlockProp(index, 'data', copy);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addRuleBtn}
                            onClick={() => {
                              const copy = [...data, { label: `Point ${data.length + 1}`, value: 95 }];
                              updateBlockProp(index, 'data', copy);
                            }}
                          >
                            <Plus size={11} /> Add Data Point
                          </button>
                        </div>
                      )}

                      <div className={styles.chartSvgWrap}>
                        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                          <defs>
                            <linearGradient id={`lineGrad-${block.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="var(--color-border)" strokeDasharray="3 3" opacity="0.6" />
                          <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="var(--color-border)" strokeDasharray="3 3" opacity="0.6" />
                          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--color-border)" />

                          {areaPath && <path d={areaPath} fill={`url(#lineGrad-${block.id})`} />}
                          {polylineStr && (
                            <polyline
                              fill="none"
                              stroke="var(--color-accent)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={polylineStr}
                            />
                          )}

                          {points.map((p, pIdx) => (
                            <g key={pIdx}>
                              <circle cx={p.x} cy={p.y} r="4" fill="var(--color-bg-primary)" stroke="var(--color-accent)" strokeWidth="2.5" />
                              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-accent)">
                                {p.value}
                              </text>
                              <text x={p.x} y={height - pad + 16} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                                {p.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* CHART: BAR */}
              {block.type === 'chart_bar' && (
                (() => {
                  const isConfigOpen = Boolean(widgetSettingsOpen[block.id]);
                  const data = block.data || [];
                  const pad = 36;
                  const width = 500;
                  const height = 180;
                  const vals = data.map((d) => Number(d.value) || 0);
                  const maxVal = Math.max(...vals, 10);
                  const availWidth = width - 2 * pad;
                  const barWidth = Math.min(availWidth / Math.max(data.length, 1) - 12, 42);

                  return (
                    <div className={styles.widgetCard}>
                      <div className={styles.widgetCardHeader}>
                        <div className={styles.widgetCardTitle}>
                          <BarChart3 size={15} />
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => updateBlockProp(index, 'title', e.target.value)}
                            placeholder="Bar Chart Title..."
                            className={styles.widgetCardTitleInput}
                            style={{ width: '320px' }}
                          />
                        </div>
                        <div className={styles.dbWidgetTools}>
                          <button
                            type="button"
                            className={`${styles.toolChip} ${isConfigOpen ? styles.toolChipActive : ''}`}
                            onClick={() => toggleWidgetSettings(block.id)}
                            title="Edit Data Points"
                          >
                            <Settings size={11} />
                            <span>Edit Data</span>
                            {isConfigOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {isConfigOpen && (
                        <div className={styles.widgetConfigPanel}>
                          <span style={{ fontWeight: 700 }}>Data Categories (Label & Value):</span>
                          {data.map((item, dIdx) => (
                            <div key={dIdx} className={styles.configRow}>
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], label: e.target.value };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Label..."
                                className={styles.configInput}
                                style={{ width: '120px' }}
                              />
                              <input
                                type="number"
                                value={item.value}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], value: parseFloat(e.target.value) || 0 };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Value..."
                                className={styles.configInput}
                                style={{ width: '90px' }}
                              />
                              <button
                                type="button"
                                className={styles.ruleDeleteBtn}
                                onClick={() => {
                                  const copy = data.filter((_, i) => i !== dIdx);
                                  updateBlockProp(index, 'data', copy);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addRuleBtn}
                            onClick={() => {
                              const copy = [...data, { label: `Category ${data.length + 1}`, value: 10 }];
                              updateBlockProp(index, 'data', copy);
                            }}
                          >
                            <Plus size={11} /> Add Bar Item
                          </button>
                        </div>
                      )}

                      <div className={styles.chartSvgWrap}>
                        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--color-border)" />
                          {data.map((d, i) => {
                            const h = ((Number(d.value) || 0) / maxVal) * (height - 2 * pad);
                            const x = pad + (i + 0.5) * (availWidth / data.length) - barWidth / 2;
                            const y = height - pad - h;
                            return (
                              <g key={i}>
                                <rect x={x} y={y} width={barWidth} height={h} rx="4" fill="var(--color-accent)" opacity="0.88" />
                                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-accent)">
                                  {d.value}
                                </text>
                                <text x={x + barWidth / 2} y={height - pad + 16} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                                  {d.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* CHART: PIE & DONUT */}
              {(block.type === 'chart_pie' || block.type === 'chart_donut') && (
                (() => {
                  const isDonut = block.type === 'chart_donut';
                  const isConfigOpen = Boolean(widgetSettingsOpen[block.id]);
                  const data = block.data || [];
                  const total = data.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;
                  const conicGradient = getConicGradient(data);

                  return (
                    <div className={styles.widgetCard}>
                      <div className={styles.widgetCardHeader}>
                        <div className={styles.widgetCardTitle}>
                          {isDonut ? <CircleDot size={15} /> : <PieChart size={15} />}
                          <input
                            type="text"
                            value={block.title || ''}
                            onChange={(e) => updateBlockProp(index, 'title', e.target.value)}
                            placeholder={isDonut ? 'Donut Chart Title...' : 'Pie Chart Title...'}
                            className={styles.widgetCardTitleInput}
                            style={{ width: '320px' }}
                          />
                        </div>
                        <div className={styles.dbWidgetTools}>
                          <button
                            type="button"
                            className={`${styles.toolChip} ${isConfigOpen ? styles.toolChipActive : ''}`}
                            onClick={() => toggleWidgetSettings(block.id)}
                            title="Edit Slices"
                          >
                            <Settings size={11} />
                            <span>Edit Slices</span>
                            {isConfigOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {isConfigOpen && (
                        <div className={styles.widgetConfigPanel}>
                          <span style={{ fontWeight: 700 }}>Pie/Donut Slices:</span>
                          {data.map((item, dIdx) => (
                            <div key={dIdx} className={styles.configRow}>
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], label: e.target.value };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Slice label..."
                                className={styles.configInput}
                                style={{ width: '130px' }}
                              />
                              <input
                                type="number"
                                value={item.value}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], value: parseFloat(e.target.value) || 0 };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                placeholder="Value..."
                                className={styles.configInput}
                                style={{ width: '80px' }}
                              />
                              <input
                                type="color"
                                value={item.color || COLOR_PALETTE[dIdx % COLOR_PALETTE.length]}
                                onChange={(e) => {
                                  const copy = [...data];
                                  copy[dIdx] = { ...copy[dIdx], color: e.target.value };
                                  updateBlockProp(index, 'data', copy);
                                }}
                                style={{ width: '30px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              />
                              <button
                                type="button"
                                className={styles.ruleDeleteBtn}
                                onClick={() => {
                                  const copy = data.filter((_, i) => i !== dIdx);
                                  updateBlockProp(index, 'data', copy);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addRuleBtn}
                            onClick={() => {
                              const copy = [
                                ...data,
                                { label: `Slice ${data.length + 1}`, value: 20, color: COLOR_PALETTE[data.length % COLOR_PALETTE.length] },
                              ];
                              updateBlockProp(index, 'data', copy);
                            }}
                          >
                            <Plus size={11} /> Add Slice
                          </button>
                        </div>
                      )}

                      <div className={styles.circleChartWrap}>
                        {isDonut ? (
                          <div
                            className={styles.donutCircle}
                            style={{ background: conicGradient }}
                          >
                            <div className={styles.donutHole}>
                              <div className={styles.donutTotalVal}>{total}</div>
                              <div className={styles.donutTotalLabel}>TOTAL</div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={styles.pieCircle}
                            style={{ background: conicGradient }}
                          />
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {data.map((d, i) => {
                            const color = d.color || COLOR_PALETTE[i % COLOR_PALETTE.length];
                            const pct = Math.round(((Number(d.value) || 0) / total) * 100);
                            return (
                              <div key={i} className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: color }} />
                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{d.label}:</span>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{d.value} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* LIVE DATABASE WIDGET BLOCK */}
              {block.type === 'db_widget' && (
                (() => {
                  const rawRows = liveDbData?.[block.widget] || [];
                  const filteredRows = applyFilterRules(rawRows, block.filterRules);
                  const limit = block.limit || 5;
                  const visibleRows = filteredRows.slice(0, limit);
                  const formulaResult = evalExcelFormula(block.excelFormula || '=COUNT(rows)', filteredRows);

                  const availableCols = WIDGET_COLUMNS[block.widget] || [];
                  const formulaSuggestions = WIDGET_FORMULA_SUGGESTIONS[block.widget] || ['=COUNT(rows)'];
                  const presets = WIDGET_PRESETS[block.widget] || [];

                  const isFilterOpen = Boolean(filterPanelOpen[block.id]);
                  const isFormulaOpen = Boolean(formulaPanelOpen[block.id]);
                  const ruleCount = (block.filterRules || []).length;

                  return (
                    <div className={styles.dbWidget}>
                      <div className={styles.dbWidgetHeader}>
                        <div className={styles.dbWidgetTitle}>
                          {block.widget === 'dhl' && <Truck size={15} />}
                          {block.widget === 'software_mr' && <GitCompare size={15} />}
                          {block.widget === 'gba_tasks' && <Kanban size={15} />}
                          {block.widget === 'tasks' && <Database size={15} />}
                          {block.widget === 'models' && <Cpu size={15} />}
                          {block.widget === 'projects' && <Kanban size={15} />}
                          {block.widget === 'mcp_gba' && <Server size={15} />}
                          <span>Live Database: {block.title || block.widget}</span>
                        </div>

                        {block.widget !== 'mcp_gba' && (
                          <div className={styles.dbWidgetTools}>
                            {/* Ponytail: Table vs Chart view switcher */}
                            <div className={styles.viewToggleGroup} title="Switch view between Table and Chart">
                              <button
                                type="button"
                                className={`${styles.viewToggleBtn} ${(!block.displayMode || block.displayMode === 'table') ? styles.viewToggleBtnActive : ''}`}
                                onClick={() => updateBlockProp(index, 'displayMode', 'table')}
                              >
                                <Table size={11} />
                                <span>Table</span>
                              </button>
                              <button
                                type="button"
                                className={`${styles.viewToggleBtn} ${block.displayMode === 'chart' ? styles.viewToggleBtnActive : ''}`}
                                onClick={() => updateBlockProp(index, 'displayMode', 'chart')}
                              >
                                <BarChart3 size={11} />
                                <span>Chart</span>
                              </button>
                            </div>

                            {/* Chart Style Selector when in Chart mode */}
                            {block.displayMode === 'chart' && (
                              <div className={styles.toolSelectWrapper} title="Select Chart Type">
                                <BarChart3 size={11} />
                                <select
                                  value={block.chartType || 'bar'}
                                  onChange={(e) => updateBlockProp(index, 'chartType', e.target.value)}
                                  className={styles.toolSelect}
                                >
                                  <option value="bar">Bar Chart</option>
                                  <option value="donut">Donut Chart</option>
                                  <option value="pie">Pie Chart</option>
                                </select>
                                <ChevronDown size={11} />
                              </div>
                            )}

                            <button
                              type="button"
                              className={`${styles.toolChip} ${isFilterOpen || ruleCount > 0 ? styles.toolChipActive : ''}`}
                              onClick={() => toggleFilterPanel(block.id)}
                              title="Filter Rules Conditions"
                            >
                              <Filter size={11} />
                              <span>Filter Rules {ruleCount > 0 ? `(${ruleCount})` : ''}</span>
                              {isFilterOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>

                            <button
                              type="button"
                              className={`${styles.toolChip} ${isFormulaOpen ? styles.toolChipActive : ''}`}
                              onClick={() => toggleFormulaPanel(block.id)}
                              title="Excel Formula Calculation"
                            >
                              <Calculator size={11} />
                              <span>fx Formula</span>
                              {isFormulaOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>

                            {block.displayMode !== 'chart' && (
                              <div className={styles.toolSelectWrapper} title="Max rows to display">
                                <SlidersHorizontal size={11} />
                                <select
                                  value={limit}
                                  onChange={(e) => updateBlockProp(index, 'limit', Number(e.target.value))}
                                  className={styles.toolSelect}
                                >
                                  <option value={3}>Max: 3 Rows</option>
                                  <option value={5}>Max: 5 Rows</option>
                                  <option value={10}>Max: 10 Rows</option>
                                  <option value={20}>Max: 20 Rows</option>
                                  <option value={100}>Max: All Rows</option>
                                </select>
                                <ChevronDown size={11} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Filter Rule Builder Panel */}
                      {isFilterOpen && (
                        <div className={styles.filterPanel}>
                          <div className={styles.filterPanelHeader}>
                            <span>Filter Rules (AND Logic):</span>
                            {presets.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Quick Presets:</span>
                                {presets.map((preset, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    className={styles.suggestionChip}
                                    onClick={() => addFilterRule(index, { field: preset.field, operator: preset.operator, value: preset.value })}
                                  >
                                    + {preset.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {(block.filterRules || []).length === 0 ? (
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              No filter rules active (displaying all rows). Click below to add a condition.
                            </p>
                          ) : (
                            (block.filterRules || []).map((rule, rIdx) => (
                              <div key={rIdx} className={styles.ruleRow}>
                                <select
                                  value={rule.field}
                                  onChange={(e) => updateFilterRule(index, rIdx, e.target.value, rule.operator, rule.value)}
                                  className={styles.ruleSelect}
                                >
                                  {availableCols.map((col) => (
                                    <option key={col.key} value={col.key}>{col.label}</option>
                                  ))}
                                </select>

                                <select
                                  value={rule.operator}
                                  onChange={(e) => updateFilterRule(index, rIdx, rule.field, e.target.value, rule.value)}
                                  className={styles.ruleSelect}
                                >
                                  {OPERATOR_OPTIONS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>

                                {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                                  <input
                                    type="text"
                                    value={rule.value || ''}
                                    onChange={(e) => updateFilterRule(index, rIdx, rule.field, rule.operator, e.target.value)}
                                    placeholder="Filter value..."
                                    className={styles.ruleInput}
                                  />
                                )}

                                <button
                                  type="button"
                                  onClick={() => removeFilterRule(index, rIdx)}
                                  className={styles.ruleDeleteBtn}
                                  title="Delete rule"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))
                          )}

                          <button
                            type="button"
                            onClick={() => addFilterRule(index)}
                            className={styles.addRuleBtn}
                          >
                            <Plus size={11} /> Add Condition
                          </button>
                        </div>
                      )}

                      {/* Excel Formula Bar Panel */}
                      {isFormulaOpen && (
                        <div className={styles.formulaBar}>
                          <div className={styles.formulaInputRow}>
                            <span className={styles.formulaPrefix}>fx</span>
                            <input
                              type="text"
                              value={block.excelFormula || ''}
                              onChange={(e) => updateBlockProp(index, 'excelFormula', e.target.value)}
                              placeholder='e.g. =COUNT(rows) or =COUNTIF(status, "done")'
                              className={styles.formulaInput}
                            />
                          </div>

                          <div className={styles.formulaSuggestions}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginRight: '4px' }}>
                              Presets:
                            </span>
                            {formulaSuggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                className={styles.suggestionChip}
                                onClick={() => updateBlockProp(index, 'excelFormula', sug)}
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ponytail: Render Chart View when displayMode is 'chart', otherwise render Table */}
                      {block.displayMode === 'chart' ? (
                        (() => {
                          const chartData = getDbChartData(block.widget, filteredRows, block.chartType || 'bar');
                          if (chartData.length === 0) {
                            return (
                              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                No data records available to generate chart. Adjust your filter rules.
                              </div>
                            );
                          }

                          if (block.chartType === 'donut' || block.chartType === 'pie') {
                            const isDonut = (block.chartType || 'donut') === 'donut';
                            const total = chartData.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;
                            const conicGrad = getConicGradient(chartData);

                            return (
                              <div className={styles.circleChartWrap}>
                                {isDonut ? (
                                  <div className={styles.donutCircle} style={{ background: conicGrad }}>
                                    <div className={styles.donutHole}>
                                      <div className={styles.donutTotalVal}>{total}</div>
                                      <div className={styles.donutTotalLabel}>TOTAL</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.pieCircle} style={{ background: conicGrad }} />
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {chartData.map((d, i) => {
                                    const pct = Math.round(((Number(d.value) || 0) / total) * 100);
                                    return (
                                      <div key={i} className={styles.legendItem}>
                                        <span className={styles.legendDot} style={{ backgroundColor: d.color }} />
                                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{d.label}:</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{d.value} ({pct}%)</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          // Default: Responsive SVG Bar Chart
                          const pad = 36;
                          const width = 500;
                          const height = 180;
                          const vals = chartData.map((d) => Number(d.value) || 0);
                          const maxVal = Math.max(...vals, 10);
                          const availWidth = width - 2 * pad;
                          const barWidth = Math.min(availWidth / Math.max(chartData.length, 1) - 12, 42);

                          return (
                            <div className={styles.chartSvgWrap}>
                              <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                                <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--color-border)" />
                                {chartData.map((d, i) => {
                                  const h = ((Number(d.value) || 0) / maxVal) * (height - 2 * pad);
                                  const x = pad + (i + 0.5) * (availWidth / chartData.length) - barWidth / 2;
                                  const y = height - pad - h;
                                  return (
                                    <g key={i}>
                                      <rect x={x} y={y} width={barWidth} height={h} rx="4" fill={d.color || 'var(--color-accent)'} opacity="0.88" />
                                      <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-accent)">
                                        {d.value}
                                      </text>
                                      <text x={x + barWidth / 2} y={height - pad + 16} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                                        {d.label}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          {/* Widget: Tasks Table */}
                      {block.widget === 'tasks' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>Task Title</th>
                              <th>Status</th>
                              <th>Assignee</th>
                              <th>Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No tasks matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((t) => (
                                <tr key={t.id}>
                                  <td style={{ fontWeight: 500 }}>{t.title}</td>
                                  <td style={{ color: t.status === 'done' ? 'var(--color-success)' : 'var(--color-accent)', textTransform: 'uppercase' }}>
                                    {t.status}
                                  </td>
                                  <td style={{ color: 'var(--color-text-secondary)' }}>{t.assignee_name || '-'}</td>
                                  <td style={{ color: 'var(--color-text-muted)' }}>{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {/* Widget: New Models Table */}
                      {block.widget === 'models' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>Model Name</th>
                              <th>Codename</th>
                              <th>Development Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No model records matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((m) => (
                                <tr key={m.id}>
                                  <td style={{ fontWeight: 600 }}>{m.model_name}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{m.codename || '-'}</td>
                                  <td style={{ color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {m.stage}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {/* Widget: Projects Table */}
                      {block.widget === 'projects' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>Project Title</th>
                              <th>Status</th>
                              <th>Progress</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No projects matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((p) => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                                  <td style={{ textTransform: 'uppercase' }}>{p.status}</td>
                                  <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>{p.progress}%</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {/* Widget: DHL Tracker Table */}
                      {block.widget === 'dhl' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>AWB / Tracking Number</th>
                              <th>Status</th>
                              <th>Origin → Destination</th>
                              <th>PIC</th>
                              <th>Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No DHL shipments matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((d) => (
                                <tr key={d.id}>
                                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                                    {d.tracking_number}
                                  </td>
                                  <td>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      backgroundColor: d.status_code === 'delivered' ? 'var(--color-success-subtle)' : 'var(--color-accent-subtle)',
                                      color: d.status_code === 'delivered' ? 'var(--color-success)' : 'var(--color-accent)',
                                    }}>
                                      {d.status_label || d.status_code || '-'}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--color-text-secondary)' }}>
                                    {d.origin_country || '-'} → {d.dest_country || '-'}
                                  </td>
                                  <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                    {d.pic || '-'}
                                  </td>
                                  <td style={{ color: 'var(--color-text-muted)' }}>
                                    {d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {/* Widget: SW Release Table */}
                      {block.widget === 'software_mr' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>Model</th>
                              <th>PIC</th>
                              <th>AP Version</th>
                              <th>CP</th>
                              <th>CSC</th>
                              <th>CSC Up</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No SW releases matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((s) => (
                                <tr key={s.id}>
                                  <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{s.model}</td>
                                  <td style={{ fontWeight: 500 }}>{s.pic || '-'}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>{s.ap || '-'}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>{s.cp || '-'}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>{s.csc || '-'}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)', fontWeight: 600 }}>
                                    {s.csc_version_up || '-'}
                                  </td>
                                  <td style={{ color: 'var(--color-text-muted)' }}>
                                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}

                      {/* Widget: GBA Task Manager Table */}
                      {block.widget === 'gba_tasks' && (
                        <table className={styles.dbTable}>
                          <thead>
                            <tr>
                              <th>Model / Project</th>
                              <th>Stage</th>
                              <th>Status</th>
                              <th>PIC Email</th>
                              <th>Urgent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.length === 0 ? (
                              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No GBA tasks matching filter rules</td></tr>
                            ) : (
                              visibleRows.map((g, gIdx) => (
                                <tr key={g.id || gIdx}>
                                  <td style={{ fontWeight: 600 }}>
                                    {g.model_name || g.project_name || '-'}
                                  </td>
                                  <td style={{ color: 'var(--color-text-secondary)' }}>{g.stage || '-'}</td>
                                  <td>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      backgroundColor: 'var(--color-accent-subtle)',
                                      color: 'var(--color-accent)',
                                      textTransform: 'uppercase',
                                    }}>
                                      {g.status || '-'}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--color-text-muted)', fontSize: '10.5px' }}>
                                    {g.pic_email || '-'}
                                  </td>
                                  <td>
                                    {g.is_urgent === 1 || g.is_urgent === '1' || g.is_urgent === true ? (
                                      <span style={{ color: 'var(--color-error)', fontWeight: 700, fontSize: '10.5px' }}>🔥 URGENT</span>
                                    ) : (
                                      <span style={{ color: 'var(--color-text-muted)', fontSize: '10.5px' }}>Normal</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Widget: MCP GBA Status card */}
                  {block.widget === 'mcp_gba' && (
                    <div style={{ padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>MCP: Google Build Approval Status</span>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                        Connected to http://107.102.39.55:3800/mcp • All GBA tasks synced with release milestone.
                      </p>
                    </div>
                  )}

                  {/* Summary & Formula Footer Row */}
                  {block.widget !== 'mcp_gba' && (
                    <div className={styles.tableFooterRow}>
                      <span>
                        {block.displayMode === 'chart'
                          ? `Viewing Chart View (${filteredRows.length} rows aggregated)`
                          : `Showing ${visibleRows.length} of ${filteredRows.length} rows (${rawRows.length} total)`}
                      </span>
                      {formulaResult && (
                        <span className={styles.formulaBadge} title={`Excel calculation for: ${block.excelFormula}`}>
                          <Calculator size={11} />
                          fx {formulaResult.label} = <strong>{formulaResult.result}</strong>
                        </span>
                      )}
                    </div>
                  )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        ))}

        {/* Floating Action Card Toolbar for Insert Block (Proper Floating Dock) */}
        <div className={styles.floatingInsertDock}>
          <div className={styles.dockLabel}>
            <Sparkles size={13} />
            Insert Block:
          </div>
          <div className={styles.dockDivider} />

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('heading')}
          >
            <Heading size={13} />
            Heading
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('paragraph')}
          >
            <AlignLeft size={13} />
            Text
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() =>
              addBlock('checklist', {
                items: [{ text: 'New action item', done: false }],
              })
            }
          >
            <CheckSquare size={13} />
            Checklist
          </button>

          {/* Interactive Widgets */}
          <div className={styles.dockDivider} />

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('countdown')}
          >
            <Timer size={13} />
            Countdown
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('vote')}
          >
            <Vote size={13} />
            Vote Poll
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('chart_line')}
          >
            <LineChart size={13} />
            Line Chart
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('chart_bar')}
          >
            <BarChart3 size={13} />
            Bar Chart
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('chart_pie')}
          >
            <PieChart size={13} />
            Pie Chart
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('chart_donut')}
          >
            <CircleDot size={13} />
            Donut Chart
          </button>

          {/* Live DB Widgets */}
          <div className={styles.dockDivider} />

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'tasks', title: 'Live Assigned Tasks', filterRules: [], excelFormula: '=COUNT(rows)', limit: 5 })}
          >
            <Database size={13} />
            DB Tasks
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'models', title: 'New Model Milestones', filterRules: [], excelFormula: '=COUNT(rows)', limit: 5 })}
          >
            <Cpu size={13} />
            DB Models
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'projects', title: 'Active Projects', filterRules: [], excelFormula: '=COUNT(rows)', limit: 5 })}
          >
            <Kanban size={13} />
            DB Projects
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() =>
              addBlock('db_widget', {
                widget: 'dhl',
                title: 'DHL Shipments Tracker',
                filterRules: [],
                excelFormula: '=COUNT(rows)',
                limit: 5,
              })
            }
          >
            <Truck size={13} />
            DB DHL
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() =>
              addBlock('db_widget', {
                widget: 'software_mr',
                title: 'Software MR Releases',
                filterRules: [],
                excelFormula: '=COUNT(rows)',
                limit: 5,
              })
            }
          >
            <GitCompare size={13} />
            DB SW Release
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() =>
              addBlock('db_widget', {
                widget: 'gba_tasks',
                title: 'GBA Task Manager',
                filterRules: [],
                excelFormula: '=COUNT(rows)',
                limit: 5,
              })
            }
          >
            <Kanban size={13} />
            DB GBA Tasks
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'mcp_gba', title: 'MCP Google Build Approval' })}
          >
            <Server size={13} />
            MCP GBA
          </button>
        </div>
      </div>

      {/* HTML Email Preview Modal (Full View Lebar) */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="HTML Email Preview (Full View)"
        maxWidth="94vw"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Simulasi tampilan email client SEIN (Desktop & Mobile view)
            </span>
            <Button variant="primary" onClick={() => setIsPreviewOpen(false)}>
              Close Preview
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Simulated Email Envelope Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
          }}>
            <div><strong style={{ color: 'var(--color-text-secondary)' }}>From:</strong> SEIN PE Portal Robot &lt;pe-reporter@samsung.com&gt;</div>
            <div><strong style={{ color: 'var(--color-text-secondary)' }}>Date:</strong> {reportDate}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>To:</strong> {toRecipients || '-'}</div>
            {ccRecipients && <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>CC:</strong> {ccRecipients}</div>}
            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>Subject:</strong> {title}</div>
          </div>

          {/* Wide Iframe Container */}
          <div style={{
            height: '72vh',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: '#e2e8f0',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
          }}>
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              style={{ width: '100%', height: '100%', border: 'none', background: '#f1f5f9' }}
            />
          </div>
        </div>
      </Modal>

      {/* AI Report Generator & Custom Prompt Modal */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title={t('reports.ai_modal_title', 'AI Report Generator & Custom Prompt')}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => handleSynthesizeFromDB('')}
              loading={synthesizing}
              icon={Sparkles}
              title={t('reports.quick_rag_hint', 'Generate standard daily report draft without typing a prompt')}
            >
              {t('reports.quick_rag_btn', '⚡ Quick RAG Draft (Standard)')}
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="outline" onClick={() => setIsAiModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="primary"
                icon={Sparkles}
                loading={synthesizing}
                onClick={() => handleSynthesizeFromDB(customPrompt)}
              >
                {t('reports.generate_ai_btn', 'Generate Report with AI')}
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {t('reports.ai_modal_desc', 'Ketik instruksi kustom untuk laporan Anda. AI LLM akan menyintesis data database portal (Tasks, Projects, New Models, DHL, dll.) serta MCP Connectors yang terdaftar ke dalam draf blok laporan siap pakai.')}
            </p>
          </div>

          {/* Active MCP Connectors indicator */}
          {activeMcpList && activeMcpList.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '12px',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                🔌 Active MCP Connectors:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {activeMcpList.map((mcp, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border)',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                    title={mcp.tools?.length ? `Available Tools: ${mcp.tools.map(t => t.name).join(', ')}` : 'Connected'}
                  >
                    {mcp.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {t('reports.custom_prompt_label', 'Custom Prompt / Instructions:')}
            </label>
            <textarea
              rows={4}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t('reports.custom_prompt_placeholder', 'Example: Generate a daily report on recent DHL status, display in table and piechart...')}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSynthesizeFromDB(customPrompt);
                }
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t('reports.ctrl_enter_hint', 'Press Ctrl + Enter to generate immediately')}
            </span>
          </div>

          {/* Quick Prompts Suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {t('reports.quick_suggestions', '💡 Quick Prompt Suggestions:')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { label: '📦 Status DHL (Table & Pie Chart)', prompt: 'Buatkan daily report terkait status DHL terbaru tampilkan dalam table dan piechart' },
                { label: '🔌 Integrasi MCP & Eksternal', prompt: 'Sertakan status sinkronisasi sistem eksternal dan task dari MCP connector yang aktif ke dalam laporan' },
                { label: '📋 Rekap Tugas & Progres Harian', prompt: 'Rekap tugas operasional saya hari ini dalam bentuk checklist beserta statusnya dan tambahkan rencana besok' },
                { label: '🚀 Status Proyek & Milestone Model', prompt: 'Tampilkan ringkasan progres proyek yang sedang in-progress dalam tabel serta milestone model baru' },
                { label: '⚠️ Kendala Lini & Action Plan', prompt: 'Susun laporan fokus pada kendala lini produksi hari ini dan action plan perbaikan' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomPrompt(item.prompt)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    borderRadius: '20px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.background = 'var(--color-bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.background = 'var(--color-bg-secondary)';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
