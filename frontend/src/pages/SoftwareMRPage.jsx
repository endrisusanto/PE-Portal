import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitCompare,
  Layers,
  Cpu,
  Calendar,
  Users,
  Search,
  Copy,
  Check,
  Eye,
  RefreshCw,
  FileCode,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Activity,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import api from '../api/client';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import styles from './SoftwareMRPage.module.css';

export const SoftwareMRPage = () => {
  const { t, i18n } = useTranslation();

  // State
  const [stats, setStats] = useState({
    total_releases: 0,
    unique_models: 0,
    today_releases: 0,
    active_pics: 0
  });

  const [filters, setFilters] = useState({
    models: [],
    pics: [],
    years: []
  });

  // Daily Release Trend (30 Days)
  const [trend, setTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const [releases, setReleases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState(null);

  // Copy Feedback Toast
  const [copyFeedback, setCopyFeedback] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Table Sort State
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedReleases = useMemo(() => {
    if (!sortKey || !sortDirection || !releases.length) return releases;
    return [...releases].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [releases, sortKey, sortDirection]);

  const handleSyncIntranet = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/software-mr/sync');
      setCopyFeedback(res.data?.message || 'Sync data dari Intranet XAMPP berhasil!');
      setTimeout(() => setCopyFeedback(''), 4500);
    } catch (err) {
      console.warn('Sync intranet offline or failed:', err);
      const errMsg = err.response?.data?.message || err.message;
      setCopyFeedback(`Intranet belum terjangkau: memuat data lokal cache (${errMsg.substring(0, 45)})`);
      setTimeout(() => setCopyFeedback(''), 5000);
    } finally {
      setSyncing(false);
      fetchStats();
      fetchFilters();
      fetchTrend();
      fetchReleases();
    }
  };

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/software-mr/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch Software MR stats:', err);
    }
  }, []);

  // Fetch 30-Day Daily Release Trend
  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const params = {};
      if (selectedModel) params.model = selectedModel;
      const { data } = await api.get('/software-mr/trend', { params });
      setTrend(data || []);
    } catch (err) {
      console.error('Failed to fetch Software MR trend:', err);
    } finally {
      setTrendLoading(false);
    }
  }, [selectedModel]);

  // Fetch Filter Dropdowns
  const fetchFilters = useCallback(async () => {
    try {
      const { data } = await api.get('/software-mr/filters');
      setFilters(data);
    } catch (err) {
      console.error('Failed to fetch Software MR filters:', err);
    }
  }, []);

  // Fetch Releases List
  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit
      };
      if (search) params.search = search;
      if (selectedPic) params.pic = selectedPic;
      if (selectedModel) params.model = selectedModel;
      if (selectedStatus) params.status = selectedStatus;

      const { data } = await api.get('/software-mr', { params });
      setReleases(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch Software MR releases:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedPic, selectedModel, selectedStatus]);

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, [fetchStats, fetchFilters]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  // Copy to clipboard helper
  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} berhasil disalin!`);
    setTimeout(() => {
      setCopyFeedback('');
    }, 2000);
  };

  // Open Detail Modal
  const handleOpenDetail = (rel) => {
    setSelectedRelease(rel);
    setDetailModalOpen(true);
  };

  // Calculations for 30-Day Trend Chart
  const totalTrendReleases = trend.reduce((sum, item) => sum + (item.count || 0), 0);
  const maxTrendCount = Math.max(...trend.map(t => t.count || 0), 5);
  const peakDay = trend.reduce((prev, curr) => ((curr.count || 0) > (prev?.count || 0) ? curr : prev), null);
  const avgTrend = trend.length > 0 ? (totalTrendReleases / trend.length).toFixed(1) : '0';

  const svgWidth = 1000;
  const svgHeight = 130;
  const padTop = 8;
  const padBottom = 8;
  const plotHeight = svgHeight - padTop - padBottom;

  const points = trend.map((t, idx) => {
    const x = (idx / Math.max(trend.length - 1, 1)) * svgWidth;
    const y = padTop + plotHeight - ((t.count || 0) / maxTrendCount) * plotHeight;
    return { x, y, ...t, index: idx };
  });

  const pathD = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[idx - 1];
    const cpX = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cpX} ${prev.y.toFixed(1)}, ${cpX} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotHeight).toFixed(1)} Z`
    : '';

  // 6 evenly-spaced dates for X-axis labels (HTML based, zero distortion)
  const xAxisIndices = [0, 6, 12, 18, 24, Math.max(trend.length - 1, 0)];
  const xAxisLabels = xAxisIndices
    .map(i => trend[i])
    .filter(Boolean);

  return (
    <div className={styles.container}>
      {/* Toast Feedback */}
      {copyFeedback && (
        <div className={styles.copySuccessBadge}>
          <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
          {copyFeedback}
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <GitCompare size={26} color="var(--color-accent)" />
            {t('software_mr.title', 'Software MR (Maintenance Release)')}
          </h1>
          <p className={styles.subtitle}>
            {t('software_mr.subtitle', 'Cheatsheet Pemetaan Binary Firmware, CSC Version Up & Catatan Rilis Perangkat SEIN')} • Intranet: <code style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-secondary)' }}>107.102.39.55</code>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="http://107.102.39.55/companion-release-cheatsheet"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
              e.currentTarget.style.borderColor = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
            title={t('software_mr.open_app_tooltip', 'Open Software MR App in new tab (107.102.39.55)')}
          >
            <ExternalLink size={13} />
            <span>{t('software_mr.open_app', 'Open Software MR App')}</span>
          </a>
          <span className={styles.viewOnlyBadge}>
            <Eye size={13} />
            {t('software_mr.view_only_mode', 'View-Only Mode')}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncIntranet}
            disabled={syncing}
            title="Sinkronisasi data rilis langsung dari XAMPP Intranet (107.102.39.55)"
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            <span>{syncing ? t('software_mr.syncing', 'Menyinkronkan...') : t('software_mr.sync_db', 'Sync Intranet')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('software_mr.col_total_releases', 'Total Rilis Firmware')}</span>
            <span className={styles.kpiValue}>
              {stats.total_releases.toLocaleString()} {t('software_mr.unit_releases', 'Rilis')}
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('software_mr.col_unique_models', 'Model Terdaftar')}</span>
            <span className={styles.kpiValue} style={{ color: '#818cf8' }}>
              {stats.unique_models.toLocaleString()} {t('software_mr.unit_models', 'Model')}
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
            <Cpu size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('software_mr.col_today_releases', 'Rilis Hari Ini')}</span>
            <span className={styles.kpiValue} style={{ color: '#34d399' }}>
              {stats.today_releases.toLocaleString()} {t('software_mr.unit_releases', 'Rilis')}
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Calendar size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>{t('software_mr.col_active_pics', 'PIC Engineer Aktif')}</span>
            <span className={styles.kpiValue} style={{ color: '#f59e0b' }}>
              {stats.active_pics.toLocaleString()} {t('software_mr.unit_pics', 'PIC')}
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* 30-Day Daily Release Trend Chart (Zero Distort / HTML Labels) */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleArea}>
            <div className={styles.chartTitle}>
              <TrendingUp size={20} color="var(--color-accent)" />
              <span>{t('software_mr.daily_trend_title', '일별 릴리즈 추이 (최근 30일)')}</span>
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendIndicator} />
              <span>{t('software_mr.daily_trend_legend', '일별 릴리즈 건수')}</span>
            </div>
            {selectedModel && (
              <span className={styles.picBadge}>
                {t('software_mr.col_model', 'Model')}: {selectedModel}
              </span>
            )}
          </div>
          <div className={styles.chartStatsSummary}>
            <div className={styles.chartStatPill}>
              <span>{t('software_mr.total_30_days', 'Total 30 Hari')}:</span>
              <span className={styles.chartStatValue}>{totalTrendReleases} {t('software_mr.unit_releases', 'Rilis')}</span>
            </div>
            <div className={styles.chartStatPill}>
              <span>{t('software_mr.average', 'Rata-rata')}:</span>
              <span className={styles.chartStatValue}>{avgTrend}/{t('software_mr.per_day', 'hari')}</span>
            </div>
            {peakDay && peakDay.count > 0 && (
              <div className={styles.chartStatPill}>
                <span>{t('software_mr.peak', 'Puncak')}:</span>
                <span className={styles.chartStatValue}>
                  {peakDay.count} {t('software_mr.unit_releases', 'Rilis')} ({peakDay.label})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.chartLayout}>
          {/* Y-Axis HTML Labels (Never Squished) */}
          <div className={styles.chartYAxis}>
            <span>{maxTrendCount}</span>
            <span>{Math.round(maxTrendCount * 0.5)}</span>
            <span>0</span>
          </div>

          <div className={styles.chartMain}>
            <div className={styles.chartContainer}>
              {hoveredPoint && (
                <div
                  className={styles.chartTooltip}
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100}%`
                  }}
                >
                  <div className={styles.chartTooltipDate}>{hoveredPoint.date} ({hoveredPoint.label})</div>
                  <div className={styles.chartTooltipCount}>{hoveredPoint.count} {t('software_mr.unit_firmware_releases', '건 펌웨어 릴리즈')}</div>
                </div>
              )}

              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
                className={styles.chartSvg}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="mrTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.38" />
                    <stop offset="85%" stopColor="var(--color-accent)" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.5, 1].map((ratio) => {
                  const yVal = padTop + plotHeight * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={0}
                      y1={yVal}
                      x2={svgWidth}
                      y2={yVal}
                      stroke="var(--color-border)"
                      strokeDasharray={ratio === 0 ? "none" : "3 3"}
                      strokeOpacity={0.6}
                    />
                  );
                })}

                {/* Area Fill */}
                {areaD && (
                  <path
                    d={areaD}
                    fill="url(#mrTrendGradient)"
                  />
                )}

                {/* Line Stroke */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Active Hover Guide Line */}
                {hoveredPoint && (
                  <line
                    x1={hoveredPoint.x}
                    y1={padTop}
                    x2={hoveredPoint.x}
                    y2={padTop + plotHeight}
                    stroke="var(--color-accent)"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* Transparent hover columns for easy mouse hit targeting */}
                {points.map((pt) => {
                  const colWidth = svgWidth / (points.length || 1);
                  return (
                    <rect
                      key={`hit-${pt.index}`}
                      x={pt.x - colWidth / 2}
                      y={padTop}
                      width={colWidth}
                      height={plotHeight}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint(pt)}
                    />
                  );
                })}
              </svg>

              {/* Perfectly Circular Data Point Dots (HTML Rendered - Zero Distortion / Zero Gepeng) */}
              {points.map((pt) => {
                if (pt.count === 0 && hoveredPoint?.index !== pt.index) return null;
                const isHovered = hoveredPoint?.index === pt.index;
                return (
                  <div
                    key={`dot-${pt.index}`}
                    className={`${styles.chartDot} ${isHovered ? styles.chartDotHovered : ''}`}
                    style={{
                      left: `${(pt.x / svgWidth) * 100}%`,
                      top: `${(pt.y / svgHeight) * 100}%`
                    }}
                  />
                );
              })}
            </div>

            {/* X-Axis HTML Labels (Never Squished) */}
            <div className={styles.chartXAxis}>
              {xAxisLabels.map((lbl, idx) => (
                <span key={idx}>{lbl.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className={styles.tableContainer}>
        {/* Toolbar & Filters */}
        <div className={styles.tableToolbar}>
          <div className={styles.tableFilters}>
            <input
              type="text"
              className={styles.filterInput}
              placeholder={t('software_mr.search_placeholder', 'Cari model, AP, CP, CSC, PIC...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <select
              className={styles.filterSelect}
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('software_mr.all_models', 'Semua Model')}</option>
              {filters.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedPic}
              onChange={(e) => {
                setSelectedPic(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('software_mr.all_pics', 'Semua PIC')}</option>
              {filters.pics.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {total} {t('software_mr.releases_found', 'Rilis Ditemukan')}
          </span>
        </div>

        {/* Master Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.mainTable}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                {[
                  { key: 'model', label: t('software_mr.col_model', 'Model') },
                  { key: 'pic', label: t('software_mr.col_pic', 'PIC') },
                  { key: 'ap', label: t('software_mr.col_ap', 'AP Version') },
                  { key: 'cp', label: t('software_mr.col_cp', 'CP Version') },
                  { key: 'csc', label: t('software_mr.col_csc', 'CSC Version') },
                  { key: 'csc_up', label: t('software_mr.col_csc_version_up', 'CSC Version Up') },
                  { key: 'release_date', label: t('software_mr.col_release_date', 'Tanggal Rilis') },
                  { key: 'status', label: t('software_mr.col_status', 'Status') },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title={`Klik untuk mengurutkan ${col.label}`}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>{col.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? (
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
                <th style={{ textAlign: 'center' }}>{t('software_mr.col_cheatsheet', 'Cheatsheet')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    {t('common.loading', 'Memuat data rilis firmware...')}
                  </td>
                </tr>
              ) : sortedReleases.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    {t('software_mr.empty_records', 'Tidak ada catatan rilis yang cocok dengan filter pencarian.')}
                  </td>
                </tr>
              ) : (
                sortedReleases.map((rel, idx) => (
                  <tr
                    key={rel.id}
                    className={styles.clickableRow}
                    onClick={() => handleOpenDetail(rel)}
                  >
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {(page - 1) * limit + idx + 1}
                    </td>

                    <td>
                      <span className={styles.modelBadge}>
                        <FileCode size={13} />
                        {rel.model}
                      </span>
                    </td>

                    <td>
                      <span className={styles.picBadge}>
                        {rel.pic}
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.ap}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.ap, `AP ${rel.ap}`);
                          }}
                          title={`${t('common.copy', 'Salin')} AP`}
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.cp}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.cp, `CP ${rel.cp}`);
                          }}
                          title={`${t('common.copy', 'Salin')} CP`}
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.csc}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.csc, `CSC ${rel.csc}`);
                          }}
                          title={`${t('common.copy', 'Salin')} CSC`}
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill} style={{ color: '#34d399' }}>
                        {rel.csc_version_up || '-'}
                      </span>
                    </td>

                    <td style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(rel.created_at).toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : (i18n.language === 'en' ? 'en-US' : 'id-ID'), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    <td>
                      <span className={styles.statusPillDone}>
                        <ShieldCheck size={11} />
                        {rel.status || 'DONE'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={styles.btnDetail}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(rel);
                        }}
                      >
                        <Eye size={12} />
                        {t('common.view', 'Detail')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            {t('common.showing', 'Menampilkan')} {releases.length} {t('common.of', 'dari')} {total} {t('software_mr.unit_releases', 'rilis maintenance')}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              {t('common.previous', 'Sebelumnya')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
            >
              {t('common.next', 'Selanjutnya')}
            </Button>
          </div>
        </div>
      </div>

      {/* CHEATSHEET DETAIL MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`${t('software_mr.details_modal_title', 'Release Cheatsheet')}: ${selectedRelease?.model || ''}`}
        maxWidth="min(880px, 92vw)"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              PIC: <strong>{selectedRelease?.pic}</strong> • {t('software_mr.col_release_date', 'Rilis')}: {selectedRelease ? new Date(selectedRelease.created_at).toLocaleDateString() : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                {t('common.close', 'Tutup')}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleCopy(selectedRelease?.release_note_format, 'Format Release Note')}
              >
                <Copy size={14} />
                {t('software_mr.copy_release_note', 'Salin Release Note')}
              </Button>
            </div>
          </div>
        }
      >
        {selectedRelease && (
          <div>
            {/* Version Information Grid */}
            <div className={styles.modalGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.target_model', 'Model Target')}</span>
                <span className={styles.infoValue}>
                  {selectedRelease.model}
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.model, 'Model')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.col_pic', 'PIC Release')}</span>
                <span className={styles.infoValue}>{selectedRelease.pic}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.col_ap', 'AP Version')}</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.ap}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.ap, 'AP')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.col_cp', 'CP Version')}</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.cp}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.cp, 'CP')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.col_csc', 'CSC Version (Base)')}</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.csc}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.csc, 'CSC')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>{t('software_mr.col_csc_version_up', 'CSC Version Up')}</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#34d399' }}>{selectedRelease.csc_version_up}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.csc_version_up, 'CSC Version Up')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>
            </div>

            {/* Release Note Block */}
            <div>
              <span className={styles.infoLabel} style={{ display: 'block', marginBottom: 6 }}>
                {t('software_mr.release_note_preview', 'Format Release Note (Cheatsheet Preview):')}
              </span>
              <div className={styles.releaseNoteBox}>
                {selectedRelease.release_note_format || t('software_mr.no_release_note', 'Tidak ada teks release note.')}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
