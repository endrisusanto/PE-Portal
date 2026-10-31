import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Sparkles, Filter } from 'lucide-react';
import styles from './PipelineTunnelCard.module.css';

// 5 Milestone stages fallback if not passed as prop
const DEFAULT_STAGES = [
  { id: 'identified', step: 1, label: 'Issue Identified', percent: 20, color: '#ef4444' },
  { id: 'root_cause', step: 2, label: 'Root Cause Analysis', percent: 40, color: '#f59e0b' },
  { id: 'countermeasure', step: 3, label: 'Trial Countermeasure', percent: 60, color: '#3b82f6' },
  { id: 'verification', step: 4, label: 'Verification & Yield', percent: 80, color: '#8b5cf6' },
  { id: 'standardized', step: 5, label: 'Closed & Standardized', percent: 100, color: '#10b981' },
];

// ponytail: smooth C1 cubic bezier spline generator for organic trumpet tunnel curvature
function buildSmoothPath(points) {
  if (!points || points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const pCurr = points[i];
    const pNext = points[i + 1];
    const pAfter = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom tangent factor
    const cp1x = pCurr.x + (pNext.x - pPrev.x) / 5.5;
    const cp1y = pCurr.y + (pNext.y - pPrev.y) / 5.5;
    const cp2x = pNext.x - (pAfter.x - pCurr.x) / 5.5;
    const cp2y = pNext.y - (pAfter.y - pCurr.y) / 5.5;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pNext.x.toFixed(1)} ${pNext.y.toFixed(1)}`;
  }
  return d;
}

// 3D Perspective Geometry definition (ViewBox 0 0 1000 140)
const TUNNEL_PROFILE = [
  { x: 55, ry: 58 },   // Flaring bell mouth entrance
  { x: 110, ry: 48 },  // Stage 1: Issue Identified
  { x: 300, ry: 33 },  // Stage 2: Root Cause Analysis
  { x: 500, ry: 21 },  // Stage 3: Trial Countermeasure
  { x: 700, ry: 13 },  // Stage 4: Verification & Yield
  { x: 900, ry: 8.5 }, // Stage 5: Closed & Standardized (Exit)
  { x: 935, ry: 8.0 }, // Slender exit tube
];

// Helper to determine milestone step from progress (0 - 100)
const getMilestoneStep = (progress = 0) => {
  if (progress >= 100) return 5;
  if (progress >= 75) return 4;
  if (progress >= 50) return 3;
  if (progress >= 25) return 2;
  return 1;
};

export const PipelineTunnelCard = ({
  tasks = [],
  stages = DEFAULT_STAGES,
  selectedStage = null,
  onStageSelect,
  className = '',
}) => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState('90d'); // '30d' | '90d' | 'all'
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('pe_portal_tunnel_collapsed') === 'true';
  });
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pe_portal_tunnel_collapsed', String(next));
      return next;
    });
  };

  // Filter tasks by selected timeRange
  const filteredTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    if (timeRange === 'all') return tasks;

    const now = new Date();
    const daysLimit = timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - daysLimit * 24 * 60 * 60 * 1000);

    return tasks.filter((t) => {
      const dateStr = t.created_at || t.updated_at || t.target_date;
      if (!dateStr) return true; // keep if no date
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) ? d >= cutoff : true;
    });
  }, [tasks, timeRange]);

  // Count tasks per stage (Step 1 to 5)
  const stageCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredTasks.forEach((t) => {
      const step = getMilestoneStep(t.progress || 0);
      counts[step] = (counts[step] || 0) + 1;
    });
    return counts;
  }, [filteredTasks]);

  // Conversion rates between consecutive stages
  const conversionRates = useMemo(() => {
    const rates = [];
    for (let i = 1; i <= 4; i++) {
      const curr = stageCounts[i] || 0;
      const next = stageCounts[i + 1] || 0;
      if (curr === 0) {
        rates.push(next > 0 ? '100%' : '0%');
      } else {
        const pct = Math.round((next / curr) * 100);
        rates.push(`${pct}%`);
      }
    }
    return rates;
  }, [stageCounts]);

  // 3D Perspective Geometry definition (ViewBox 0 0 1000 140)
  const tunnelRings = useMemo(() => {
    return [
      { step: 1, cx: 110, cy: 70, rx: 15, ry: 48 },
      { step: 2, cx: 300, cy: 70, rx: 11, ry: 33 },
      { step: 3, cx: 500, cy: 70, rx: 8, ry: 21 },
      { step: 4, cx: 700, cy: 70, rx: 5.5, ry: 13 },
      { step: 5, cx: 900, cy: 70, rx: 4, ry: 8.5 },
    ];
  }, []);

  // Volumetric translucent 3D tube path
  const tunnelVolumePath = useMemo(() => {
    const topPts = TUNNEL_PROFILE.map((p) => ({ x: p.x, y: 70 - p.ry }));
    const botPts = [...TUNNEL_PROFILE].reverse().map((p) => ({ x: p.x, y: 70 + p.ry }));
    const topD = buildSmoothPath(topPts);
    const botD = buildSmoothPath(botPts).replace(/^M/, 'L');
    return `${topD} ${botD} Z`;
  }, []);

  // Smooth curved longitudinal perspective wireframe rays
  const wireframeRays = useMemo(() => {
    const factors = [-1, -0.75, -0.48, -0.22, 0, 0.22, 0.48, 0.75, 1];
    return factors.map((factor, idx) => {
      const pts = TUNNEL_PROFILE.map((p) => ({
        x: p.x,
        y: 70 + p.ry * factor,
      }));
      return {
        id: `curved-ray-${idx}`,
        d: buildSmoothPath(pts),
        isOuter: Math.abs(factor) === 1,
        isCenter: factor === 0,
      };
    });
  }, []);

  // Representative floating task nodes inside tunnel sections
  const taskParticles = useMemo(() => {
    const particles = [];
    stages.forEach((st) => {
      const stepTasks = filteredTasks.filter((t) => getMilestoneStep(t.progress || 0) === st.step);
      const ring = tunnelRings.find((r) => r.step === st.step);
      if (!ring) return;

      // Sample up to 4 representative tasks per stage
      const sampled = stepTasks.slice(0, 4);
      sampled.forEach((task, idx) => {
        // Distribute nicely around ring.cx
        const offsetMultiplier = (idx % 2 === 0 ? 1 : -1) * (0.2 + idx * 0.18);
        const px = ring.cx + (idx === 0 ? 0 : (idx % 2 === 0 ? 25 : -25));
        const py = ring.cy + ring.ry * offsetMultiplier * 0.65;
        const avatar = (task.pic_name || task.pic_email || 'PE').charAt(0).toUpperCase();

        particles.push({
          id: `p-${task.id || idx}`,
          task,
          cx: px,
          cy: py,
          r: idx === 0 ? 9 : 4.5,
          isAvatar: idx === 0,
          avatarChar: avatar,
          step: st.step,
          delay: `${idx * 0.7}s`,
        });
      });
    });
    return particles;
  }, [stages, filteredTasks, tunnelRings]);

  const handleStageClick = (step) => {
    if (onStageSelect) {
      onStageSelect(step === selectedStage ? null : step);
    }
  };

  return (
    <div className={`${styles.tunnelCard} ${className}`} ref={containerRef}>
      {/* Top Header Bar */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h2 className={styles.cardTitle}>
              {t('projects.pipeline_tunnel_title', 'Pipeline tunnel')}
            </h2>
            <span className={styles.livePill}>
              <span className={styles.liveDot} />
              {t('projects.tunnel_live', 'LIVE')}
            </span>
          </div>
          <p className={styles.cardSubtitle}>
            {t(
              'projects.pipeline_tunnel_sub',
              'Candidates and engineering issues flowing through each stage'
            )}
            {timeRange !== 'all' && ` • last ${timeRange}`}
          </p>
        </div>

        <div className={styles.headerRight}>
          {/* Time Filter Pill Control */}
          <div className={styles.timeControlGroup}>
            <button
              type="button"
              className={`${styles.timeBtn} ${timeRange === '30d' ? styles.timeBtnActive : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30d
            </button>
            <button
              type="button"
              className={`${styles.timeBtn} ${timeRange === '90d' ? styles.timeBtnActive : ''}`}
              onClick={() => setTimeRange('90d')}
            >
              90d
            </button>
            <button
              type="button"
              className={`${styles.timeBtn} ${timeRange === 'all' ? styles.timeBtnActive : ''}`}
              onClick={() => setTimeRange('all')}
            >
              {t('projects.tunnel_filter_all', 'All')}
            </button>
          </div>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand Pipeline Tunnel' : 'Collapse Pipeline Tunnel'}
            aria-label="Toggle pipeline view"
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Collapsed State Summary Row */}
      {isCollapsed ? (
        <div className={styles.collapsedSummary}>
          <div className={styles.collapsedStages}>
            {stages.map((st) => (
              <div
                key={st.id}
                className={styles.collapsedStageItem}
                onClick={() => handleStageClick(st.step)}
                style={{ cursor: 'pointer' }}
              >
                <span
                  className={styles.collapsedStageDot}
                  style={{ backgroundColor: st.color || 'var(--color-accent)' }}
                />
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{st.label}:</span>
                <span style={{ fontWeight: 800, color: st.step === 5 ? '#facc15' : '#ffffff' }}>
                  {stageCounts[st.step] || 0}
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {filteredTasks.length} active issues in pipeline
          </span>
        </div>
      ) : (
        /* Full 3D Perspective Tunnel Body */
        <div className={styles.tunnelBody}>
          {/* Stage Headers & Real-time Counters Row */}
          <div className={styles.stageHeadersRow}>
            {stages.map((st) => {
              const isSelected = selectedStage === st.step;
              const count = stageCounts[st.step] || 0;
              return (
                <div
                  key={st.id}
                  className={`${styles.stageHeaderCol} ${isSelected ? styles.stageHeaderColActive : ''}`}
                  onClick={() => handleStageClick(st.step)}
                  title={`Click to filter or scroll to ${st.label}`}
                >
                  <span className={styles.stageLabel}>
                    {t(`projects.milestones.${st.id}`, st.label)}
                  </span>
                  <span className={`${styles.stageCount} ${st.step === 5 ? styles.stageCountExit : ''}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* SVG 3D Perspective Wireframe Funnel */}
          <div className={styles.tunnelViewport}>
            <svg
              className={styles.tunnelSvg}
              viewBox="0 0 1000 140"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Theme-Adaptive Neon Gradients */}
                <linearGradient id="neonRayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.25" />
                  <stop offset="90%" stopColor="var(--color-accent)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0.6" />
                </linearGradient>

                <linearGradient id="tunnelEnvelopeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.75" />
                  <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0.85" />
                </linearGradient>

                <radialGradient id="exitPortalGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fde047" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#facc15" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="tunnelVolumeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.14" />
                  <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0.16" />
                </linearGradient>

                <filter id="neonBlur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="exitRingGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4.5" result="glow" />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              {/* 3D Volumetric Mesh Tube Silhouette */}
              <path d={tunnelVolumePath} fill="url(#tunnelVolumeGrad)" />

              {/* Central Perspective Axis Line (Subtle) */}
              <line
                x1="60"
                y1="70"
                x2="930"
                y2="70"
                stroke="var(--color-accent)"
                strokeOpacity="0.15"
                strokeDasharray="4 6"
              />

              {/* Longitudinal Perspective Wireframe Rays */}
              {wireframeRays.map((ray) => (
                <path
                  key={ray.id}
                  d={ray.d}
                  fill="none"
                  stroke={ray.isOuter ? 'url(#tunnelEnvelopeGrad)' : 'url(#neonRayGrad)'}
                  strokeWidth={ray.isOuter ? 1.5 : ray.isCenter ? 0.7 : 0.9}
                  strokeOpacity={ray.isOuter ? 0.85 : ray.isCenter ? 0.35 : 0.5}
                />
              ))}

              {/* Concentric Vertical Stage Rings */}
              {tunnelRings.map((r) => {
                const isSelected = selectedStage === r.step;
                const isExit = r.step === 5;
                return (
                  <g key={`ring-group-${r.step}`} onClick={() => handleStageClick(r.step)}>
                    {/* Ring Back Shadow/Glow */}
                    <ellipse
                      cx={r.cx}
                      cy={r.cy}
                      rx={r.rx}
                      ry={r.ry}
                      fill={isExit ? 'url(#exitPortalGlow)' : 'none'}
                      stroke={
                        isExit
                          ? '#facc15'
                          : isSelected
                          ? 'var(--color-accent)'
                          : 'rgba(255, 255, 255, 0.35)'
                      }
                      strokeWidth={isSelected ? 2.5 : isExit ? 2.2 : 1.2}
                      strokeDasharray={isExit ? 'none' : isSelected ? 'none' : '3 3'}
                      filter={isExit ? 'url(#exitRingGlow)' : isSelected ? 'url(#neonBlur)' : 'none'}
                      className={`${styles.tunnelRing} ${isSelected ? styles.tunnelRingActive : ''}`}
                    />

                    {/* Stage Label Number on Top of Ring */}
                    <circle
                      cx={r.cx}
                      cy={r.cy - r.ry - 5}
                      r={2.5}
                      fill={isExit ? '#facc15' : 'var(--color-accent)'}
                    />
                  </g>
                );
              })}

              {/* Floating Task Nodes & Interactive PIC Avatars */}
              {taskParticles.map((p) => {
                const isHovered = hoveredNode?.id === p.id;
                return (
                  <g
                    key={p.id}
                    className={styles.floatingParticle}
                    style={{ animationDelay: p.delay }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      setHoveredNode({
                        id: p.id,
                        task: p.task,
                        x: (p.cx / 1000) * (rect?.width || 800),
                        y: (p.cy / 140) * 140 + 70,
                      });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => handleStageClick(p.step)}
                  >
                    {p.isAvatar ? (
                      /* Avatar Circle Node */
                      <g>
                        <circle
                          cx={p.cx}
                          cy={p.cy}
                          r={p.r}
                          fill="#1e293b"
                          stroke="var(--color-accent)"
                          strokeWidth="1.8"
                          filter="url(#neonBlur)"
                        />
                        <text
                          x={p.cx}
                          y={p.cy + 3.5}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="8.5"
                          fontWeight="700"
                          pointerEvents="none"
                        >
                          {p.avatarChar}
                        </text>
                      </g>
                    ) : (
                      /* Luminous Dot Particle */
                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r={p.r}
                        fill="#ffffff"
                        opacity={isHovered ? 1 : 0.8}
                        filter="drop-shadow(0 0 6px var(--color-accent))"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip for hovered particle */}
            {hoveredNode && (
              <div
                className={styles.nodeTooltip}
                style={{
                  left: `${hoveredNode.x}px`,
                  top: `${hoveredNode.y}px`,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  {hoveredNode.task.title || 'Engineering Task'}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                  PIC: {hoveredNode.task.pic_name || hoveredNode.task.pic_email || 'Unassigned'} •{' '}
                  {hoveredNode.task.progress || 0}%
                </div>
              </div>
            )}
          </div>

          {/* Conversion Flow Rate Badges Row */}
          <div className={styles.conversionRow}>
            {conversionRates.map((rate, idx) => (
              <div key={`conv-${idx}`} className={styles.conversionItem}>
                <span
                  className={styles.conversionPill}
                  title={`Stage ${idx + 1} to Stage ${idx + 2} conversion rate`}
                >
                  {rate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

