import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  BarChart3,
  Layers,
  CheckCircle2,
  XCircle,
  Calendar,
  Target,
  Award,
  Clock,
  Ban,
  TrendingUp,
  Search,
  Filter,
  Image as ImageIcon,
  FileText,
  Table as TableIcon,
  Edit3,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Trash2,
  Eye,
  Download,
  Grid,
  List,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import styles from './InnovationsPage.module.css';

// Helper to get class badge styling
const getClassBadgeClass = (classType) => {
  switch (classType) {
    case 'Class 3':
      return styles.badgeClass3;
    case 'Class 4':
      return styles.badgeClass4;
    case 'Class 5':
      return styles.badgeClass5;
    case 'Under Review':
      return styles.badgeUnderReview;
    case 'Non Adopt':
      return styles.badgeNonAdopt;
    default:
      return styles.badgeClass4;
  }
};

// Safe normalization of attachments JSON
const normalizeAttachments = (raw) => {
  if (!raw) return { media: [], documents: [], tables: [] };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { media: [], documents: [], tables: [] };
    }
  }
  if (Array.isArray(parsed)) {
    return { media: [], documents: parsed, tables: [] };
  }
  return {
    media: Array.isArray(parsed.media) ? parsed.media : [],
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    tables: Array.isArray(parsed.tables) ? parsed.tables : [],
  };
};

export const InnovationsPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'records'
  const [selectedYear, setSelectedYear] = useState(2026);
  const [repoViewMode, setRepoViewMode] = useState('cards'); // 'cards' | 'table'

  // Statistics State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Innovation Records State
  const [items, setItems] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false); // Create/Edit Modal
  const [isArticleViewOpen, setIsArticleViewOpen] = useState(false); // Reader Modal
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [articleViewTab, setArticleViewTab] = useState('overview'); // 'overview' | 'media' | 'documents' | 'tables'

  // Form State (Article Editor)
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClassType, setFormClassType] = useState('Class 4');
  const [formImpactScore, setFormImpactScore] = useState(4);
  const [formMediaList, setFormMediaList] = useState([]);
  const [formDocsList, setFormDocsList] = useState([]);
  const [formTablesList, setFormTablesList] = useState([]);
  const [editorTab, setEditorTab] = useState('info'); // 'info' | 'media' | 'docs' | 'tables'

  // Inline Add Inputs for Editor
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaCaption, setNewMediaCaption] = useState('');

  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocType, setNewDocType] = useState('PDF');

  const [newTableTitle, setNewTableTitle] = useState('');
  const [newTableHeaders, setNewTableHeaders] = useState('Parameter, Before, After, Improvement');
  const [newTableRows, setNewTableRows] = useState('Tact Time, 45s, 28s, -37%\nDefect PPM, 120, 15, -87%');

  // Set Target Form State
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [targetRegister, setTargetRegister] = useState(10);
  const [targetChallenge, setTargetChallenge] = useState(15);
  const [savingTarget, setSavingTarget] = useState(false);

  // Fetch Statistics
  const fetchStats = async (year) => {
    setStatsLoading(true);
    try {
      const res = await api.get('/innovations/stats', {
        params: { year: year || selectedYear },
      });
      setStats(res.data);
      if (res.data.year && res.data.year !== selectedYear) {
        setSelectedYear(res.data.year);
      }
    } catch (err) {
      console.error('Failed to load innovation stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Records
  const fetchInnovations = async () => {
    setRecordsLoading(true);
    try {
      const res = await api.get('/innovations', {
        params: {
          class_type: classFilter || undefined,
        },
      });
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to fetch innovations:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(selectedYear);
    fetchInnovations();
  }, [selectedYear]);

  useEffect(() => {
    fetchInnovations();
  }, [classFilter]);

  // Open Article Reader
  const handleViewArticle = (item) => {
    setSelectedArticle(item);
    setArticleViewTab('overview');
    setIsArticleViewOpen(true);
  };

  // Open Article Editor (New or Edit)
  const handleOpenEditor = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormTitle(item.title || '');
      setFormDescription(item.description || '');
      setFormClassType(item.class_type || 'Class 4');
      setFormImpactScore(item.impact_score || 4);
      const att = normalizeAttachments(item.attachments);
      setFormMediaList(att.media);
      setFormDocsList(att.documents);
      setFormTablesList(att.tables);
    } else {
      setEditingId(null);
      setFormTitle('');
      setFormDescription('');
      setFormClassType('Class 4');
      setFormImpactScore(4);
      setFormMediaList([]);
      setFormDocsList([]);
      setFormTablesList([]);
    }
    setEditorTab('info');
    setIsArticleModalOpen(true);
    if (isArticleViewOpen) setIsArticleViewOpen(false);
  };

  // Save Article (Create or Update)
  const handleSaveArticle = async (e) => {
    e.preventDefault();
    const payload = {
      title: formTitle,
      description: formDescription,
      category: 'innovation',
      class_type: formClassType,
      impact_score: Number(formImpactScore),
      attachments: {
        media: formMediaList,
        documents: formDocsList,
        tables: formTablesList,
      },
    };

    try {
      if (editingId) {
        const res = await api.put(`/innovations/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item.id === editingId ? res.data : item)));
      } else {
        const res = await api.post('/innovations', payload);
        setItems((prev) => [res.data, ...prev]);
      }
      setIsArticleModalOpen(false);
      fetchStats(selectedYear);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Inline Add Media Handler
  const handleAddMedia = () => {
    if (!newMediaUrl.trim()) return;
    setFormMediaList((prev) => [
      ...prev,
      {
        name: newMediaName.trim() || 'Engineering Photo',
        url: newMediaUrl.trim(),
        caption: newMediaCaption.trim(),
      },
    ]);
    setNewMediaName('');
    setNewMediaUrl('');
    setNewMediaCaption('');
  };

  // Inline Add Doc Handler
  const handleAddDoc = () => {
    if (!newDocName.trim()) return;
    setFormDocsList((prev) => [
      ...prev,
      {
        name: newDocName.trim(),
        url: newDocUrl.trim() || '#',
        type: newDocType,
        size: '1.2 MB',
      },
    ]);
    setNewDocName('');
    setNewDocUrl('');
  };

  // Inline Add Table Handler
  const handleAddTable = () => {
    if (!newTableTitle.trim()) return;
    const headers = newTableHeaders.split(',').map((h) => h.trim()).filter(Boolean);
    const rows = newTableRows
      .split('\n')
      .map((row) => row.split(',').map((cell) => cell.trim()))
      .filter((r) => r.length > 0 && r[0]);

    setFormTablesList((prev) => [
      ...prev,
      {
        title: newTableTitle.trim(),
        headers,
        rows,
      },
    ]);
    setNewTableTitle('');
  };

  // Handle Save Target
  const handleSaveTarget = async (e) => {
    e.preventDefault();
    setSavingTarget(true);
    try {
      await api.post('/innovations/targets', {
        year: Number(selectedYear),
        month: Number(targetMonth),
        target_register: Number(targetRegister),
        target_challenge: Number(targetChallenge),
      });
      setIsTargetModalOpen(false);
      fetchStats(selectedYear);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingTarget(false);
    }
  };

  // Filtered records by search term
  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.author_name?.toLowerCase().includes(term) ||
      item.class_type?.toLowerCase().includes(term)
    );
  });

  // Table Columns for tabular view mode
  const columns = [
    {
      title: 'Class Type',
      key: 'class_type',
      render: (val) => (
        <span className={`${styles.badgeClassBase} ${getClassBadgeClass(val || 'Class 4')}`}>
          {val || 'Class 4'}
        </span>
      ),
    },
    {
      title: 'Innovation / BP Title',
      key: 'title',
      render: (val, row) => (
        <div style={{ cursor: 'pointer' }} onClick={() => handleViewArticle(row)}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{val}</div>
          {row.description && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {row.description.slice(0, 90)}...
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      title: 'Impact',
      key: 'impact_score',
      render: (val) => (
        <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
          ★ {val || 0}/5
        </span>
      ),
    },
    {
      title: 'Proposer',
      key: 'author_name',
      render: (val) => <span style={{ fontSize: '12px' }}>{val || 'Engineer'}</span>,
    },
    {
      title: 'Actions',
      key: 'id',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button size="xs" variant="secondary" onClick={() => handleViewArticle(row)}>
            <Eye size={12} />
          </Button>
          <Button size="xs" variant="secondary" onClick={() => handleOpenEditor(row)}>
            <Edit3 size={12} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <Award size={22} color="var(--color-accent)" />
            Innovation & Best Practice (BP)
          </h1>
          <p className={styles.subtitle}>
            SEIN Production Engineer Innovation Pipeline, Best Practice Standardization, & Performance Dashboard (BP MXPE)
          </p>
        </div>

        <div className={styles.topControls}>
          {/* View Tab Switcher */}
          <div className={styles.tabSwitcher}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'dashboard' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={14} />
              Statistics Dashboard
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'records' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('records')}
            >
              <BookOpen size={14} />
              Repository Articles
            </button>
          </div>

          {/* Year Selector */}
          <div className={styles.yearSelectWrapper}>
            <Calendar size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={styles.yearSelect}
            >
              {(stats?.available_years || [2026, 2025]).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsTargetModalOpen(true)}>
              <Target size={14} />
              Set Targets
            </Button>
            <Button variant="primary" size="sm" onClick={() => handleOpenEditor(null)}>
              <Plus size={14} />
              Submit Article
            </Button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: STATISTICS DASHBOARD
          ===================================================================== */}
      {activeTab === 'dashboard' && (
        <>
          {statsLoading || !stats ? (
            <LoadingState message="Calculating Innovation & Best Practice statistics..." />
          ) : (
            <>
              {/* Top 5 KPI Cards */}
              <div className={styles.kpiGrid}>
                {/* 1. Target vs Actual */}
                <div className={`${styles.glassCard} ${styles.kpiCard}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>ACTUAL VS TARGET</span>
                    <Target size={18} color="var(--color-accent)" />
                  </div>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiMainNumber}>{stats.total_actual}</span>
                    <span className={styles.kpiSubNumber}>/ {stats.total_target}</span>
                  </div>
                  <div className={styles.kpiFooter}>
                    <span className={styles.achievementBadge}>
                      {stats.achievement_rate.toFixed(1)}% Achieved
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Challenge: {stats.total_challenge}
                    </span>
                  </div>
                </div>

                {/* 2. Class 3 Proposals */}
                <div className={`${styles.glassCard} ${styles.kpiCard}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>CLASS 3 (TOP TIER)</span>
                    <Award size={18} color="#ff7597" />
                  </div>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiMainNumber} style={{ color: '#ff7597' }}>
                      {stats.class3_count}
                    </span>
                    <span className={styles.kpiSubNumber}>proposals</span>
                  </div>
                  <div className={styles.kpiFooter}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Breakthrough innovations
                    </span>
                  </div>
                </div>

                {/* 3. Adopted Rate */}
                <div className={`${styles.glassCard} ${styles.kpiCard}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>ADOPTED RATE</span>
                    <TrendingUp size={18} color="#10b981" />
                  </div>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiMainNumber} style={{ color: '#10b981' }}>
                      {stats.adopted_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.kpiFooter}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Class 3 + 4 + 5 ({stats.class3_count + stats.class4_count + stats.class5_count} adopted)
                    </span>
                  </div>
                </div>

                {/* 4. Under Review */}
                <div className={`${styles.glassCard} ${styles.kpiCard}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>UNDER REVIEW</span>
                    <Clock size={18} color="#fbbf24" />
                  </div>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiMainNumber} style={{ color: '#fbbf24' }}>
                      {stats.under_review_count}
                    </span>
                  </div>
                  <div className={styles.kpiFooter}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Awaiting review
                    </span>
                  </div>
                </div>

                {/* 5. Non Adopt */}
                <div className={`${styles.glassCard} ${styles.kpiCard}`}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>NON ADOPT</span>
                    <Ban size={18} color="#9ca3af" />
                  </div>
                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiMainNumber} style={{ color: '#9ca3af' }}>
                      {stats.non_adopt_count}
                    </span>
                  </div>
                  <div className={styles.kpiFooter}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Not adopted
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Monthly Chart & Donut Distribution */}
              <div className={styles.chartsGrid}>
                {/* Monthly Chart */}
                <div className={`${styles.glassCard} ${styles.chartCard}`}>
                  <div className={styles.chartCardHeader}>
                    <div className={styles.chartTitle}>
                      <TrendingUp size={16} color="var(--color-accent)" />
                      Monthly Performance ({selectedYear})
                    </div>
                    <div className={styles.chartLegend}>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: 'var(--color-accent)' }} />
                        <span>Actual Register</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#f59e0b' }} />
                        <span>Target</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#8b5cf6' }} />
                        <span>Challenge</span>
                      </div>
                    </div>
                  </div>

                  {/* Native SVG Chart */}
                  <div className={styles.chartSvgContainer}>
                    {(() => {
                      const maxVal = Math.max(
                        ...stats.monthly.map((m) => Math.max(m.actual_register, m.target_register, m.target_challenge)),
                        15
                      );
                      const width = 680;
                      const height = 220;
                      const padLeft = 40;
                      const padBottom = 30;
                      const padTop = 20;
                      const padRight = 20;
                      const plotW = width - padLeft - padRight;
                      const plotH = height - padTop - padBottom;
                      const colW = plotW / 12;

                      return (
                        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
                          {/* Y-axis gridlines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                            const y = padTop + plotH * (1 - pct);
                            const val = Math.round(maxVal * pct);
                            return (
                              <g key={i}>
                                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.6} />
                                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* Bars and Step Targets */}
                          {stats.monthly.map((m, idx) => {
                            const xCenter = padLeft + idx * colW + colW / 2;
                            const barW = Math.max(colW * 0.45, 14);
                            const barH = (m.actual_register / maxVal) * plotH;
                            const barY = padTop + plotH - barH;
                            const targetY = padTop + plotH - (m.target_register / maxVal) * plotH;
                            const challengeY = padTop + plotH - (m.target_challenge / maxVal) * plotH;

                            return (
                              <g
                                key={m.month}
                                onMouseEnter={() => setHoveredMonth(m)}
                                onMouseLeave={() => setHoveredMonth(null)}
                                style={{ cursor: 'pointer' }}
                              >
                                {/* Actual Bar */}
                                <rect
                                  x={xCenter - barW / 2}
                                  y={barY}
                                  width={barW}
                                  height={barH}
                                  rx={3}
                                  fill="var(--color-accent)"
                                  opacity={hoveredMonth?.month === m.month ? 1 : 0.85}
                                />
                                {m.actual_register > 0 && (
                                  <text x={xCenter} y={barY - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-text-primary)">
                                    {m.actual_register}
                                  </text>
                                )}

                                {/* Target step line */}
                                <line
                                  x1={xCenter - colW * 0.4}
                                  y1={targetY}
                                  x2={xCenter + colW * 0.4}
                                  y2={targetY}
                                  stroke="#f59e0b"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                />

                                {/* Challenge point */}
                                {m.target_challenge > 0 && (
                                  <circle cx={xCenter} cy={challengeY} r="3" fill="#8b5cf6" />
                                )}

                                {/* X-axis label */}
                                <text x={xCenter} y={height - 10} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                                  {m.month_name}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Class Distribution Donut */}
                <div className={`${styles.glassCard} ${styles.chartCard}`}>
                  <div className={styles.chartCardHeader}>
                    <div className={styles.chartTitle}>
                      <Layers size={16} color="var(--color-accent)" />
                      Class Type Distribution
                    </div>
                  </div>

                  <div className={styles.donutLayout}>
                    {/* SVG Donut */}
                    <div className={styles.donutSvgWrapper}>
                      {(() => {
                        let accum = 0;
                        const total = stats.total_actual || 1;
                        return (
                          <svg viewBox="0 0 160 160" className={styles.donutSvg}>
                            <circle cx="80" cy="80" r="54" fill="none" stroke="var(--color-bg-primary)" strokeWidth="18" />
                            {stats.class_distribution.map((dist) => {
                              const pct = dist.count / total;
                              const circ = 2 * Math.PI * 54;
                              const strokeDasharray = `${pct * circ} ${circ}`;
                              const strokeDashoffset = -accum * circ;
                              accum += pct;
                              return (
                                <circle
                                  key={dist.name}
                                  cx="80"
                                  cy="80"
                                  r="54"
                                  fill="none"
                                  stroke={dist.color}
                                  strokeWidth="18"
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  transform="rotate(-90 80 80)"
                                />
                              );
                            })}
                            <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--color-text-primary)">
                              {stats.total_actual}
                            </text>
                            <text x="80" y="94" textAnchor="middle" fontSize="10" textTransform="uppercase" fill="var(--color-text-muted)">
                              TOTAL BP
                            </text>
                          </svg>
                        );
                      })()}
                    </div>

                    {/* Progress bars list */}
                    <div className={styles.classBarsList}>
                      {stats.class_distribution.map((dist) => (
                        <div key={dist.name} className={styles.classBarRow}>
                          <div className={styles.classBarHeader}>
                            <span className={styles.className}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dist.color }} />
                              {dist.name}
                            </span>
                            <span className={styles.classCount}>
                              {dist.count}{' '}
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                ({dist.percentage.toFixed(0)}%)
                              </span>
                            </span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={styles.barFill} style={{ width: `${dist.percentage}%`, backgroundColor: dist.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Performance Matrix Table (Exact BP MXPE Reference) */}
              <div className={`${styles.glassCard} ${styles.matrixTableCard}`}>
                <div className={styles.chartCardHeader}>
                  {/* Fixed: Use BarChart3 icon instead of Table component to prevent "No records found" box */}
                  <div className={styles.chartTitle}>
                    <BarChart3 size={16} color="var(--color-accent)" />
                    Monthly Performance Summary Matrix ({selectedYear})
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    🟢 Target Met • 🔴 Target Pending
                  </span>
                </div>

                <div className={styles.tableScrollWrapper}>
                  <table className={styles.matrixTable}>
                    <thead>
                      <tr>
                        <th className={styles.matrixLabelCell}>Metric / Data</th>
                        {stats.monthly.map((m) => (
                          <th key={m.month}>{m.month_name}</th>
                        ))}
                        <th className={styles.matrixTotalCell}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Actual Register */}
                      <tr className={styles.actualHighlightRow}>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: 'var(--color-accent)' }}>● Actual Register</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>
                            {m.actual_register}
                            {(m.actual_register > 0 || m.target_register > 0) && (
                              <span className={styles.targetMetBadge} title={m.target_met ? 'Target Met' : 'Target Pending'}>
                                {m.target_met ? <CheckCircle2 size={12} color="#10b981" /> : <XCircle size={12} color="#f87171" />}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.total_actual}</td>
                      </tr>

                      {/* Target Register */}
                      <tr className={styles.targetRow}>
                        <td className={styles.matrixLabelCell}>Target Register</td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.target_register}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.total_target}</td>
                      </tr>

                      {/* Target Challenge */}
                      <tr className={styles.targetRow}>
                        <td className={styles.matrixLabelCell}>Target Challenge</td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.target_challenge}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.total_challenge}</td>
                      </tr>

                      {/* Class 3 */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#ff7597' }}>Class 3 (Top Tier)</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.class3 || 0}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class3_count}</td>
                      </tr>

                      {/* Class 4 */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#60a5fa' }}>Class 4 (High Impact)</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.class4 || 0}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class4_count}</td>
                      </tr>

                      {/* Class 5 */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#34d399' }}>Class 5 (Standard)</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.class5 || 0}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class5_count}</td>
                      </tr>

                      {/* Non Adopt */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#9ca3af' }}>Non Adopt</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.non_adopt || 0}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.non_adopt_count}</td>
                      </tr>

                      {/* Under Review */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#fbbf24' }}>Under Review</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.under_review || 0}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.under_review_count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* =====================================================================
          TAB 2: INNOVATION REPOSITORY ARTICLES (RICH KNOWLEDGE BASE)
          ===================================================================== */}
      {activeTab === 'records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className={styles.repoControlsBar}>
            <div className={styles.repoFilterGroup}>
              <span className={styles.repoFilterLabel}>
                Filter Class:
              </span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className={styles.repoSelect}
              >
                <option value="">All Classes</option>
                <option value="Class 3">Class 3 (Breakthrough)</option>
                <option value="Class 4">Class 4 (High Impact)</option>
                <option value="Class 5">Class 5 (Standard)</option>
                <option value="Under Review">Under Review</option>
                <option value="Non Adopt">Non Adopt</option>
              </select>

              {/* View Switcher: Cards vs Table */}
              <div className={styles.repoViewToggle}>
                <button
                  type="button"
                  onClick={() => setRepoViewMode('cards')}
                  className={`${styles.repoViewBtn} ${repoViewMode === 'cards' ? styles.repoViewBtnActive : ''}`}
                  title="Article Cards View"
                >
                  <Grid size={12} />
                  Articles
                </button>
                <button
                  type="button"
                  onClick={() => setRepoViewMode('table')}
                  className={`${styles.repoViewBtn} ${repoViewMode === 'table' ? styles.repoViewBtnActive : ''}`}
                  title="Summary Table View"
                >
                  <List size={12} />
                  Table
                </button>
              </div>
            </div>

            <div className={styles.repoRightGroup}>
              <div className={styles.repoSearchWrapper}>
                <Search size={13} className={styles.repoSearchIcon} />
                <input
                  type="text"
                  placeholder="Search articles, techniques..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.repoSearchInput}
                />
              </div>

              <Button variant="primary" size="sm" onClick={() => handleOpenEditor(null)}>
                <Plus size={13} />
                New Article
              </Button>
            </div>
          </div>

          {recordsLoading ? (
            <LoadingState message="Loading innovation articles..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No innovation articles found"
              description="Be the first to create a new innovation or best practice article."
              actionLabel="New Article"
              onAction={() => handleOpenEditor(null)}
            />
          ) : repoViewMode === 'cards' ? (
            /* Article Cards Grid */
            <div className={styles.articleGrid}>
              {filteredItems.map((item) => {
                const att = normalizeAttachments(item.attachments);
                return (
                  <div
                    key={item.id}
                    className={styles.articleCard}
                    onClick={() => handleViewArticle(item)}
                  >
                    <div className={styles.articleTopRow}>
                      <span className={`${styles.badgeClassBase} ${getClassBadgeClass(item.class_type || 'Class 4')}`}>
                        {item.class_type || 'Class 4'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-warning)' }}>
                          ★ {item.impact_score || 0}/5
                        </span>
                        <StatusBadge status={item.status || 'draft'} />
                      </div>
                    </div>

                    <h3 className={styles.articleTitle}>{item.title}</h3>

                    <p className={styles.articleExcerpt}>
                      {item.description || 'No detailed technical description provided yet.'}
                    </p>

                    {/* Media / Doc / Table Indicators */}
                    <div className={styles.articleTagsRow}>
                      {att.media.length > 0 && (
                        <span className={styles.tagPill}>
                          <ImageIcon size={11} color="var(--color-accent)" />
                          {att.media.length} Photos
                        </span>
                      )}
                      {att.documents.length > 0 && (
                        <span className={styles.tagPill}>
                          <FileText size={11} color="#10b981" />
                          {att.documents.length} Docs
                        </span>
                      )}
                      {att.tables.length > 0 && (
                        <span className={styles.tagPill}>
                          <TableIcon size={11} color="#f59e0b" />
                          {att.tables.length} Tables
                        </span>
                      )}
                    </div>

                    <div className={styles.articleFooter}>
                      <span>👤 {item.author_name || 'Engineer PIC'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className={styles.viewArticleBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditor(item);
                          }}
                          title="Edit this article"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <span className={styles.viewArticleBtn}>
                          Read <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table columns={columns} data={filteredItems} />
          )}
        </div>
      )}

      {/* =====================================================================
          ARTICLE VIEWER MODAL (READ-ONLY ARTICLE WITH MEDIA, DOCS, TABLES)
          ===================================================================== */}
      {isArticleViewOpen && selectedArticle && (
        <Modal
          isOpen={isArticleViewOpen}
          onClose={() => setIsArticleViewOpen(false)}
          title={`Article: ${selectedArticle.title}`}
        >
          {(() => {
            const att = normalizeAttachments(selectedArticle.attachments);
            return (
              <div className={styles.articleViewContainer}>
                {/* Header Banner */}
                <div className={styles.articleHeaderBanner}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`${styles.badgeClassBase} ${getClassBadgeClass(selectedArticle.class_type || 'Class 4')}`}>
                        {selectedArticle.class_type || 'Class 4'}
                      </span>
                      <StatusBadge status={selectedArticle.status || 'draft'} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)' }}>
                      Impact Rating: ★ {selectedArticle.impact_score || 0}/5
                    </span>
                  </div>

                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                    {selectedArticle.title}
                  </h2>

                  <div className={styles.articleHeaderMeta}>
                    <span>👤 Proposer: <strong>{selectedArticle.author_name || 'Engineer'}</strong></span>
                    <span>•</span>
                    <span>🏢 Division: {selectedArticle.group_part_name || 'SEIN PE Group'}</span>
                    <span>•</span>
                    <span>📅 Registered: {new Date(selectedArticle.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Sub-tabs within Article */}
                <div className={styles.articleNavTabs}>
                  <button
                    type="button"
                    className={`${styles.articleNavBtn} ${articleViewTab === 'overview' ? styles.activeTab : ''}`}
                    onClick={() => setArticleViewTab('overview')}
                  >
                    <BookOpen size={14} />
                    Overview & Solution
                  </button>
                  <button
                    type="button"
                    className={`${styles.articleNavBtn} ${articleViewTab === 'media' ? styles.activeTab : ''}`}
                    onClick={() => setArticleViewTab('media')}
                  >
                    <ImageIcon size={14} />
                    Media & Photos ({att.media.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.articleNavBtn} ${articleViewTab === 'documents' ? styles.activeTab : ''}`}
                    onClick={() => setArticleViewTab('documents')}
                  >
                    <FileText size={14} />
                    Documents ({att.documents.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.articleNavBtn} ${articleViewTab === 'tables' ? styles.activeTab : ''}`}
                    onClick={() => setArticleViewTab('tables')}
                  >
                    <TableIcon size={14} />
                    Data Tables ({att.tables.length})
                  </button>
                </div>

                {/* Tab: Overview */}
                {articleViewTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', lineHeight: 1.6 }}>
                    <div style={{ background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Technical Implementation & Scope
                      </h4>
                      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                        {selectedArticle.description || 'No detailed description provided.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab: Media */}
                {articleViewTab === 'media' && (
                  <div>
                    {att.media.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        No media or photos attached to this innovation article.
                      </div>
                    ) : (
                      <div className={styles.mediaGrid}>
                        {att.media.map((m, idx) => (
                          <div key={idx} className={styles.mediaCard}>
                            <img src={m.url} alt={m.name} className={styles.mediaImg} onError={(e) => { e.target.style.display = 'none'; }} />
                            <div className={styles.mediaMeta}>
                              <span className={styles.mediaName}>{m.name}</span>
                              {m.caption && <span className={styles.mediaCaption}>{m.caption}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Documents */}
                {articleViewTab === 'documents' && (
                  <div className={styles.docList}>
                    {att.documents.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        No technical documents or SOP files attached.
                      </div>
                    ) : (
                      att.documents.map((d, idx) => (
                        <div key={idx} className={styles.docItem}>
                          <div className={styles.docLeft}>
                            <FileText size={20} color="var(--color-accent)" />
                            <div>
                              <div className={styles.docTitle}>{d.name}</div>
                              <div className={styles.docSub}>{d.type || 'Document'} • {d.size || 'Attachment'}</div>
                            </div>
                          </div>
                          {d.url && d.url !== '#' && (
                            <a href={d.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                              <Download size={14} /> Open
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab: Data Tables */}
                {articleViewTab === 'tables' && (
                  <div>
                    {att.tables.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        No comparison or benchmark tables defined for this article.
                      </div>
                    ) : (
                      att.tables.map((tItem, tIdx) => (
                        <div key={tIdx} className={styles.customTableCard}>
                          <div className={styles.customTableHeader}>
                            📊 {tItem.title || 'Performance Metrics Table'}
                          </div>
                          <table className={styles.customTable}>
                            <thead>
                              <tr>
                                {(tItem.headers || []).map((h, hIdx) => (
                                  <th key={hIdx}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(tItem.rows || []).map((row, rIdx) => (
                                <tr key={rIdx}>
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                  <Button variant="secondary" size="sm" onClick={() => handleOpenEditor(selectedArticle)}>
                    <Edit3 size={13} />
                    Edit Article
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsArticleViewOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* =====================================================================
          ARTICLE EDITOR MODAL (ADD / EDIT ARTICLE + MEDIA, DOCS, TABLES)
          ===================================================================== */}
      {isArticleModalOpen && (
        <Modal
          isOpen={isArticleModalOpen}
          onClose={() => setIsArticleModalOpen(false)}
          title={editingId ? 'Edit Innovation Article' : 'New Innovation & Best Practice Article'}
        >
          <form onSubmit={handleSaveArticle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Editor Sub-Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
              {[
                { id: 'info', label: '1. Basic Info', icon: BookOpen },
                { id: 'media', label: `2. Media (${formMediaList.length})`, icon: ImageIcon },
                { id: 'docs', label: `3. Documents (${formDocsList.length})`, icon: FileText },
                { id: 'tables', label: `4. Data Tables (${formTablesList.length})`, icon: TableIcon },
              ].map((tb) => {
                const Icon = tb.icon;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setEditorTab(tb.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-xs)',
                      border: 'none',
                      background: editorTab === tb.id ? 'var(--color-accent)' : 'transparent',
                      color: editorTab === tb.id ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Icon size={13} />
                    {tb.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Basic Info */}
            {editorTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Article Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. SMT Stencil Pulse Ultrasonic Cleaning Revamp"
                    style={{
                      height: '36px',
                      padding: '0 12px',
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Class Type (BP MXPE)
                    </label>
                    <select
                      value={formClassType}
                      onChange={(e) => setFormClassType(e.target.value)}
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="Class 3">Class 3 (Breakthrough / Top Tier)</option>
                      <option value="Class 4">Class 4 (High Impact)</option>
                      <option value="Class 5">Class 5 (Standard Line Improvement)</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Non Adopt">Non Adopt</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Impact Score (1-5)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={formImpactScore}
                      onChange={(e) => setFormImpactScore(e.target.value)}
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Problem Statement, Implementation & Solution
                  </label>
                  <textarea
                    rows="6"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detail the technical implementation, cost reduction, line cycle improvements, or quality benefits..."
                    style={{
                      padding: '10px 12px',
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Media & Photos */}
            {editorTab === 'media' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Add Photo / Diagram</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Photo Name / Title"
                      value={newMediaName}
                      onChange={(e) => setNewMediaName(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    />
                    <input
                      type="url"
                      placeholder="Image URL (e.g. https://...)"
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Caption / Notes (optional)"
                    value={newMediaCaption}
                    onChange={(e) => setNewMediaCaption(e.target.value)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddMedia}>
                    <Plus size={12} /> Add to Media List
                  </Button>
                </div>

                {/* Current Media List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formMediaList.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={m.url} alt={m.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>{m.caption || m.url}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setFormMediaList((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Documents */}
            {editorTab === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Add Technical Document / SOP</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Document Name (e.g. SOP-SMT-2026.pdf)"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    />
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="PDF">PDF</option>
                      <option value="SOP">SOP</option>
                      <option value="DOCX">Word DOCX</option>
                      <option value="XLSX">Excel XLSX</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Document URL / File Storage Path"
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddDoc}>
                    <Plus size={12} /> Add to Documents List
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formDocsList.map((d, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--color-accent)" />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{d.name}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>{d.type}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setFormDocsList((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Data Tables */}
            {editorTab === 'tables' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Add Parameter / Metric Table</span>
                  <input
                    type="text"
                    placeholder="Table Title (e.g. Tact Time & PPM Comparison)"
                    value={newTableTitle}
                    onChange={(e) => setNewTableTitle(e.target.value)}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                  />
                  <div>
                    <label style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>
                      Column Headers (comma-separated):
                    </label>
                    <input
                      type="text"
                      value={newTableHeaders}
                      onChange={(e) => setNewTableHeaders(e.target.value)}
                      style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>
                      Rows (one per line, comma-separated values):
                    </label>
                    <textarea
                      rows="3"
                      value={newTableRows}
                      onChange={(e) => setNewTableRows(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: '11px' }}
                    />
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddTable}>
                    <Plus size={12} /> Add Table to Article
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formTablesList.map((tItem, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TableIcon size={16} color="#f59e0b" />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{tItem.title}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>{tItem.headers?.length || 0} cols • {tItem.rows?.length || 0} rows</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setFormTablesList((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsArticleModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingId ? 'Save Changes' : 'Publish Article'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Set Monthly Targets */}
      {isTargetModalOpen && (
        <Modal
          isOpen={isTargetModalOpen}
          onClose={() => setIsTargetModalOpen(false)}
          title={`Set Monthly Innovation Targets (${selectedYear})`}
        >
          <form onSubmit={handleSaveTarget} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Month</label>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December',
                ].map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name} ({selectedYear})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Register</label>
                <input
                  type="number"
                  min="0"
                  value={targetRegister}
                  onChange={(e) => setTargetRegister(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Challenge</label>
                <input
                  type="number"
                  min="0"
                  value={targetChallenge}
                  onChange={(e) => setTargetChallenge(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsTargetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingTarget}>
                {savingTarget ? 'Saving...' : 'Update Target'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default InnovationsPage;
