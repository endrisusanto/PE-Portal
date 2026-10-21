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
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import styles from './InnovationsPage.module.css';

// ponytail: Helper to get class badge styling
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

export const InnovationsPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'records'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Create Innovation Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formCategory, setFormCategory] = useState('best_practice');
  const [formClassType, setFormClassType] = useState('Class 4');
  const [impactScore, setImpactScore] = useState(4);

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
      setItems(res.data);
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

  // Handle Create Innovation
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/innovations', {
        title,
        description: description || undefined,
        category: formCategory,
        class_type: formClassType,
        impact_score: Number(impactScore),
      });
      setItems((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      // Refresh stats
      fetchStats(selectedYear);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
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

  // Table Columns
  const columns = [
    {
      title: 'Class Type',
      key: 'class_type',
      render: (val) => (
        <span className={`${styles.classBadge} ${getClassBadgeClass(val)}`}>
          {val || 'Class 4'}
        </span>
      ),
    },
    {
      title: 'Title & Summary',
      key: 'title',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{val}</div>
          {row.description && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {row.description.slice(0, 95)}...
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
      title: 'Register Date',
      key: 'created_at',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {new Date(val).toLocaleDateString()}
        </span>
      ),
    },
  ];

  // SVG Chart Computations for Monthly Performance
  const chartHeight = 180;
  const chartWidth = 640;
  const maxVal = stats
    ? Math.max(
        ...stats.monthly.map((m) =>
          Math.max(m.actual_register, m.target_register, m.target_challenge, 10)
        ),
        15
      )
    : 15;

  const getBarY = (val) => chartHeight - (val / maxVal) * chartHeight;
  const getBarH = (val) => (val / maxVal) * chartHeight;

  // Donut SVG parameters
  const donutRadius = 52;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedOffset = 0;

  return (
    <div className={styles.pageContainer}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <Award size={22} color="var(--color-accent)" />
            {t('nav.innovations')}
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
              className={`${styles.tabBtn} ${activeTab === 'dashboard' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={14} />
              Statistics Dashboard
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'records' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('records')}
            >
              <Layers size={14} />
              Repository Data
            </button>
          </div>

          {/* Year Filter */}
          <div className={styles.yearFilter}>
            <Calendar size={14} />
            <span>Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={styles.yearSelect}
            >
              {(stats?.available_years || [2026, 2025]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'dashboard' ? (
            <Button
              variant="outline"
              size="sm"
              icon={Target}
              onClick={() => setIsTargetModalOpen(true)}
            >
              Set Targets
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsModalOpen(true)}
            >
              Submit Idea / BP
            </Button>
          )}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: STATISTICS DASHBOARD (BP MXPE REFERENCE)
          ===================================================================== */}
      {activeTab === 'dashboard' && (
        <>
          {statsLoading || !stats ? (
            <LoadingState message="Calculating BP performance statistics..." />
          ) : (
            <>
              {/* Top 5 KPI Stat Cards */}
              <div className={styles.statsGrid}>
                {/* 1. Actual vs Target */}
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Actual vs Target</span>
                    <Target size={15} color="var(--color-accent)" />
                  </div>
                  <div className={styles.statValue}>
                    {stats.total_actual}
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      / {stats.total_target}
                    </span>
                  </div>
                  <div className={styles.statSubtext}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor:
                          stats.achievement_rate >= 80
                            ? 'var(--color-success-subtle)'
                            : 'var(--color-accent-subtle)',
                        color:
                          stats.achievement_rate >= 80
                            ? 'var(--color-success)'
                            : 'var(--color-accent)',
                      }}
                    >
                      {stats.achievement_rate.toFixed(1)}% Achieved
                    </span>
                    <span>• Target: {stats.total_target}</span>
                  </div>
                </div>

                {/* 2. Class 3 Breakthroughs */}
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Class 3 (Top Tier)</span>
                    <Award size={15} color="#ff7597" />
                  </div>
                  <div className={styles.statValue}>
                    <span style={{ color: '#ff7597' }}>{stats.class3_count}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      proposals
                    </span>
                  </div>
                  <div className={styles.statSubtext}>
                    <span>Breakthrough engineering improvements</span>
                  </div>
                </div>

                {/* 3. Adopted Rate */}
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Adopted Rate</span>
                    <TrendingUp size={15} color="#34d399" />
                  </div>
                  <div className={styles.statValue}>
                    <span style={{ color: '#34d399' }}>{stats.adopted_rate.toFixed(1)}%</span>
                  </div>
                  <div className={styles.statSubtext}>
                    <span>Class 3 + 4 + 5 ({stats.class3_count + stats.class4_count + stats.class5_count} adopted)</span>
                  </div>
                </div>

                {/* 4. Under Review */}
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Under Review</span>
                    <Clock size={15} color="#fbbf24" />
                  </div>
                  <div className={styles.statValue}>
                    <span style={{ color: '#fbbf24' }}>{stats.under_review_count}</span>
                  </div>
                  <div className={styles.statSubtext}>
                    <span>Awaiting managerial review</span>
                  </div>
                </div>

                {/* 5. Non Adopt */}
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Non Adopt</span>
                    <Ban size={15} color="#9ca3af" />
                  </div>
                  <div className={styles.statValue}>
                    <span style={{ color: '#9ca3af' }}>{stats.non_adopt_count}</span>
                  </div>
                  <div className={styles.statSubtext}>
                    <span>Not feasible / non-standard</span>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className={styles.chartsGrid}>
                {/* 1. Monthly Performance Chart */}
                <div className={styles.glassCard}>
                  <div className={styles.chartCardHeader}>
                    <div className={styles.chartTitle}>
                      <TrendingUp size={16} color="var(--color-accent)" />
                      Monthly Performance ({selectedYear})
                    </div>
                    <div className={styles.chartLegend}>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-accent)' }} />
                        <span>Actual Register</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} />
                        <span>Target</span>
                      </div>
                      <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ backgroundColor: '#a78bfa' }} />
                        <span>Challenge</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.chartContainer}>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 35}`} className={styles.svgChart}>
                      {/* Horizontal Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = chartHeight * pct;
                        const labelVal = Math.round(maxVal * (1 - pct));
                        return (
                          <g key={idx}>
                            <line
                              x1={30}
                              y1={y}
                              x2={chartWidth - 10}
                              y2={y}
                              stroke="var(--color-border-subtle)"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={24}
                              y={y + 4}
                              fill="var(--color-text-muted)"
                              fontSize={10}
                              textAnchor="end"
                            >
                              {labelVal}
                            </text>
                          </g>
                        );
                      })}

                      {/* Monthly Bars & Markers */}
                      {stats.monthly.map((m, idx) => {
                        const colWidth = (chartWidth - 45) / 12;
                        const x = 35 + idx * colWidth;
                        const barW = Math.max(14, colWidth * 0.45);
                        const barX = x + (colWidth - barW) / 2;
                        const barH = getBarH(m.actual_register);
                        const barY = getBarY(m.actual_register);

                        const targetY = getBarY(m.target_register);
                        const challengeY = getBarY(m.target_challenge);
                        const isHovered = hoveredMonth === m.month;

                        return (
                          <g
                            key={m.month}
                            onMouseEnter={() => setHoveredMonth(m.month)}
                            onMouseLeave={() => setHoveredMonth(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Hover Column Glow */}
                            {isHovered && (
                              <rect
                                x={x}
                                y={0}
                                width={colWidth}
                                height={chartHeight}
                                fill="var(--color-accent-subtle)"
                                opacity={0.4}
                                rx={4}
                              />
                            )}

                            {/* Actual Register Bar */}
                            <rect
                              x={barX}
                              y={barY}
                              width={barW}
                              height={barH}
                              fill="var(--color-accent)"
                              rx={3}
                              opacity={isHovered ? 1 : 0.9}
                            />

                            {/* Value above bar if > 0 */}
                            {m.actual_register > 0 && (
                              <text
                                x={barX + barW / 2}
                                y={barY - 4}
                                fill="var(--color-text-primary)"
                                fontSize={10}
                                fontWeight={700}
                                textAnchor="middle"
                              >
                                {m.actual_register}
                              </text>
                            )}

                            {/* Target Register Marker (Horizontal Dash) */}
                            {m.target_register > 0 && (
                              <line
                                x1={barX - 4}
                                y1={targetY}
                                x2={barX + barW + 4}
                                y2={targetY}
                                stroke="#f59e0b"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                              />
                            )}

                            {/* Target Challenge Marker (Dot) */}
                            {m.target_challenge > 0 && (
                              <circle
                                cx={barX + barW / 2}
                                cy={challengeY}
                                r={3}
                                fill="#a78bfa"
                              />
                            )}

                            {/* Month Label */}
                            <text
                              x={barX + barW / 2}
                              y={chartHeight + 18}
                              fill={isHovered ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
                              fontSize={11}
                              fontWeight={isHovered ? 700 : 500}
                              textAnchor="middle"
                            >
                              {m.month_name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* 2. Class Type Distribution Donut */}
                <div className={styles.glassCard}>
                  <div className={styles.chartCardHeader}>
                    <div className={styles.chartTitle}>
                      <Layers size={16} color="var(--color-accent)" />
                      Class Type Distribution
                    </div>
                  </div>

                  <div className={styles.donutContainer}>
                    <div className={styles.donutSvgWrapper}>
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        {/* Background Ring Track */}
                        <circle
                          cx="70"
                          cy="70"
                          r={donutRadius}
                          fill="transparent"
                          stroke="var(--color-border-subtle)"
                          strokeWidth="16"
                        />

                        {/* Donut Slices */}
                        {stats.class_distribution.map((dist, idx) => {
                          const strokeDash = (dist.percentage / 100) * donutCircumference;
                          const offset = accumulatedOffset;
                          accumulatedOffset += strokeDash;

                          return (
                            <circle
                              key={idx}
                              cx="70"
                              cy="70"
                              r={donutRadius}
                              fill="transparent"
                              stroke={dist.color}
                              strokeWidth="16"
                              strokeDasharray={`${strokeDash} ${donutCircumference}`}
                              strokeDashoffset={-offset}
                              transform="rotate(-90 70 70)"
                              style={{ transition: 'stroke-dasharray 0.5s ease' }}
                            />
                          );
                        })}
                      </svg>

                      {/* Donut Center Count */}
                      <div className={styles.donutCenterText}>
                        <div className={styles.donutCenterNumber}>{stats.total_actual}</div>
                        <div className={styles.donutCenterLabel}>Total BP</div>
                      </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className={styles.classBarsList}>
                      {stats.class_distribution.map((dist) => (
                        <div key={dist.name} className={styles.classBarRow}>
                          <div className={styles.classBarHeader}>
                            <span className={styles.className}>
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: dist.color,
                                }}
                              />
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
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${dist.percentage}%`,
                                backgroundColor: dist.color,
                              }}
                            />
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
                  <div className={styles.chartTitle}>
                    <Table size={16} color="var(--color-accent)" />
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
                      {/* Actual Register Row */}
                      <tr className={styles.actualHighlightRow}>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: 'var(--color-accent)' }}>● Actual Register</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>
                            {m.actual_register}
                            {(m.actual_register > 0 || m.target_register > 0) && (
                              <span
                                className={styles.targetMetBadge}
                                title={m.target_met ? 'Target Met' : 'Target Pending'}
                              >
                                {m.target_met ? (
                                  <CheckCircle2 size={12} color="#10b981" />
                                ) : (
                                  <XCircle size={12} color="#f87171" />
                                )}
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
                          <td key={m.month}>{m.class3}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class3_count}</td>
                      </tr>

                      {/* Class 4 */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#60a5fa' }}>Class 4 (High Impact)</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.class4}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class4_count}</td>
                      </tr>

                      {/* Class 5 */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#34d399' }}>Class 5 (Line Standard)</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.class5}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.class5_count}</td>
                      </tr>

                      {/* Under Review */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#fbbf24' }}>Under Review</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.under_review}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.under_review_count}</td>
                      </tr>

                      {/* Non Adopt */}
                      <tr>
                        <td className={styles.matrixLabelCell}>
                          <span style={{ color: '#9ca3af' }}>Non Adopt</span>
                        </td>
                        {stats.monthly.map((m) => (
                          <td key={m.month}>{m.non_adopt}</td>
                        ))}
                        <td className={styles.matrixTotalCell}>{stats.non_adopt_count}</td>
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
          TAB 2: INNOVATION RECORDS & DATA REPOSITORY
          ===================================================================== */}
      {activeTab === 'records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Filter Class:
              </span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="">All Classes</option>
                <option value="Class 3">Class 3 (Breakthrough)</option>
                <option value="Class 4">Class 4 (High Impact)</option>
                <option value="Class 5">Class 5 (Standard)</option>
                <option value="Under Review">Under Review</option>
                <option value="Non Adopt">Non Adopt</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search innovations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    height: '32px',
                    paddingLeft: '30px',
                    paddingRight: '12px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    width: '220px',
                  }}
                />
              </div>
            </div>
          </div>

          {recordsLoading ? (
            <LoadingState message="Loading innovation records..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No records found"
              description="Be the first to submit a new innovation idea or best practice procedure."
              actionLabel="Submit Idea"
              onAction={() => setIsModalOpen(true)}
            />
          ) : (
            <Table columns={columns} data={filteredItems} />
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: SUBMIT INNOVATION / BEST PRACTICE
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Innovation Idea / Best Practice"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Automated SMT Stencil Cleaning Optimization"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Class Type (BP MXPE)
              </label>
              <select
                value={formClassType}
                onChange={(e) => setFormClassType(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
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
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Impact Score (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={impactScore}
                onChange={(e) => setImpactScore(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Description & Findings
            </label>
            <textarea
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the technical implementation, cost reduction, or quality improvement..."
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL: SET MONTHLY TARGETS (BP MXPE TARGET MANAGEMENT)
          ===================================================================== */}
      <Modal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title={`Set Monthly BP Targets (${selectedYear})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTargetModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={savingTarget}
              onClick={handleSaveTarget}
            >
              Save Targets
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTarget} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Configure the baseline Target Register and Target Challenge goals for the selected month in year {selectedYear}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Month
            </label>
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(Number(e.target.value))}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              {[
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
              ].map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1} - {name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Target Register
              </label>
              <input
                type="number"
                min="0"
                value={targetRegister}
                onChange={(e) => setTargetRegister(e.target.value)}
                required
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Target Challenge
              </label>
              <input
                type="number"
                min="0"
                value={targetChallenge}
                onChange={(e) => setTargetChallenge(e.target.value)}
                required
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InnovationsPage;
