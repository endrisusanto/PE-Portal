import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Layers,
  Sparkles,
  Building2,
  Briefcase,
  ShieldCheck,
  Mail,
  UserCheck,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  Move,
} from 'lucide-react';
import styles from './TeamNeuralConstellation.module.css';

// Standard Parent Group Display Info & Colors
const DIVISION_CONFIG = {
  pe_management: {
    title: 'PE Management',
    color: '#eab308', // Gold
    icon: ShieldCheck,
    angle: -90, // Top
    dist: 190,
  },
  pe_mecha: {
    title: 'PE Mecha',
    color: '#3b82f6', // Electric Blue
    icon: Layers,
    angle: -20, // Top-Right
    dist: 310,
  },
  pe_solution: {
    title: 'PE Solution',
    color: '#10b981', // Emerald
    icon: Sparkles,
    angle: 50, // Bottom-Right
    dist: 285,
  },
  cross_dept: {
    title: 'Cross-Dept Partners',
    color: '#f97316', // Orange
    icon: Building2,
    angle: 130, // Bottom-Left
    dist: 285,
  },
  pe_production: {
    title: 'PE Part',
    color: '#a855f7', // Violet
    icon: Briefcase,
    angle: 200, // Top-Left
    dist: 310,
  },
};

// Helper to shorten jobdesk names for compact neural node labels
const formatShortJobdesk = (name = '') => {
  if (!name) return 'General';
  return name
    .replace('Bill of Material', 'BOM')
    .replace('Working Instruction', 'WI')
    .replace('Development', 'Dev')
    .replace('Management', 'Mgmt')
    .replace('Production', 'Prod')
    .replace('Procurement & Sourcing', 'Sourcing')
    .replace('Reviewer', 'Rev')
    .trim();
};

export const TeamNeuralConstellation = ({ users = [], groups = [] }) => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | divisionKey
  const [hoveredMember, setHoveredMember] = useState(null);
  const [hoveredJobdesk, setHoveredJobdesk] = useState(null);

  // Obsidian-style Interactive Viewport State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, mouseX: 0, mouseY: 0 });
  const [draggedNode, setDraggedNode] = useState(null);
  const [customPositions, setCustomPositions] = useState({});
  const [isAutoOrbit, setIsAutoOrbit] = useState(false);
  const [orbitAngle, setOrbitAngle] = useState(0);

  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const svgRef = useRef(null);
  const hasMovedNode = useRef(false);

  // Group parts lookup dictionary
  const groupPartMap = useMemo(() => {
    const map = {};
    groups.forEach((g) => {
      map[g.id] = g;
    });
    return map;
  }, [groups]);

  // Ambient auto-orbit physics simulation
  useEffect(() => {
    if (!isAutoOrbit) return;
    let animId;
    const step = () => {
      setOrbitAngle((prev) => (prev + 0.0022) % (Math.PI * 2));
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoOrbit]);

  // Non-passive wheel listener for smooth zooming without page scrolling
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.91;
      setZoom((prev) => {
        const next = Math.max(0.4, Math.min(2.8, prev * zoomFactor));
        return Number(next.toFixed(2));
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Map users to divisions
  const { divisions, totalMembers, multiJobdeskCount } = useMemo(() => {
    let multiCount = 0;
    const divBuckets = {
      pe_management: [],
      pe_production: [],
      pe_mecha: [],
      pe_solution: [],
      cross_dept: [],
    };

    users.forEach((u) => {
      const isMulti = u.group_part_ids && u.group_part_ids.length > 1;
      if (isMulti) multiCount += 1;

      // Determine parent division
      let targetDiv = 'cross_dept';
      if (u.department && u.department.toUpperCase() === 'PE') {
        const mainPartId = u.group_part_id || (u.group_part_ids && u.group_part_ids[0]);
        const partObj = groupPartMap[mainPartId];
        if (partObj?.parent_group && divBuckets[partObj.parent_group]) {
          targetDiv = partObj.parent_group;
        } else {
          targetDiv = 'pe_production'; // default PE
        }
      } else {
        targetDiv = 'cross_dept';
      }

      divBuckets[targetDiv].push({
        ...u,
        isMulti,
        mainPart: groupPartMap[u.group_part_id || (u.group_part_ids && u.group_part_ids[0])],
      });
    });

    return {
      divisions: divBuckets,
      totalMembers: users.length,
      multiJobdeskCount: multiCount,
    };
  }, [users, groupPartMap]);

  // Center coordinate of ViewBox (1060 x 660)
  const center = { x: 530, y: 330 };

  // Calculate coordinates for cluster hubs, jobdesk sub-hubs, and their members
  const clusterData = useMemo(() => {
    return Object.entries(DIVISION_CONFIG).map(([key, cfg]) => {
      const rad = (cfg.angle * Math.PI) / 180 + orbitAngle;
      const customHub = customPositions[`hub-${key}`];
      const hubX = customHub ? customHub.x : center.x + cfg.dist * Math.cos(rad);
      const hubY = customHub ? customHub.y : center.y + cfg.dist * Math.sin(rad);
      const members = divisions[key] || [];

      // Find active jobdesks (group parts) for this division that have assigned members
      const activeParts = groups
        .filter((g) => {
          if (key === 'cross_dept') {
            return !g.parent_group || !g.parent_group.startsWith('pe_');
          }
          return g.parent_group === key;
        })
        .filter((g) =>
          members.some(
            (m) => (m.group_part_ids && m.group_part_ids.includes(g.id)) || m.group_part_id === g.id
          )
        );

      // Generate Jobdesk Sub-Nodes with generous spacing
      const totalParts = activeParts.length;
      const jobdeskNodes = activeParts.map((jPart, jIdx) => {
        const angleSpread = totalParts > 1 ? Math.min(2.1, (totalParts - 1) * 0.65) : 0;
        const jAngle = totalParts > 1 ? rad + (jIdx - (totalParts - 1) / 2) * (angleSpread / (totalParts - 1)) : rad;
        const distJobdesk = 90;
        const customJob = customPositions[`jobdesk-${key}-${jPart.id}`];
        const jx = customJob ? customJob.x : hubX + distJobdesk * Math.cos(jAngle);
        const jy = customJob ? customJob.y : hubY + distJobdesk * Math.sin(jAngle);

        // Members assigned to this jobdesk
        const jMembers = members.filter(
          (m) => (m.group_part_ids && m.group_part_ids.includes(jPart.id)) || m.group_part_id === jPart.id
        );

        // Position members radiating out from this jobdesk node without overlapping
        const mTotal = jMembers.length;
        const mSpread = mTotal > 1 ? Math.min(1.5, (mTotal - 1) * 0.42) : 0;
        const memberNodes = jMembers.map((m, mIdx) => {
          const mAngle = mTotal > 1 ? jAngle + (mIdx - (mTotal - 1) / 2) * (mSpread / (mTotal - 1)) : jAngle;
          const distMember = 42;
          const customMem = customPositions[`member-${m.id}`];
          const mx = customMem ? customMem.x : jx + distMember * Math.cos(mAngle);
          const my = customMem ? customMem.y : jy + distMember * Math.sin(mAngle);
          const avatarInitial = (m.full_name || m.username || 'U').charAt(0).toUpperCase();
          const firstName = (m.full_name || 'Engineer').split(' ')[0];
          const shortJob = formatShortJobdesk(jPart.name);

          return {
            member: m,
            x: mx,
            y: my,
            initial: avatarInitial,
            firstName,
            shortJob,
            r: 12,
            jobdeskId: jPart.id,
            nodeId: `member-${m.id}`,
          };
        });

        return {
          part: jPart,
          x: jx,
          y: jy,
          shortTitle: formatShortJobdesk(jPart.name),
          assignedMembers: jMembers,
          memberNodes,
          nodeId: `jobdesk-${key}-${jPart.id}`,
        };
      });

      // Members without explicit part assignment (placed opposite from jobdesks)
      const assignedIds = new Set(jobdeskNodes.flatMap((jn) => jn.assignedMembers.map((m) => m.id)));
      const unassigned = members.filter((m) => !assignedIds.has(m.id));
      const unassignedNodes = unassigned.map((m, uIdx) => {
        const uAngle = rad + Math.PI + (uIdx - (unassigned.length - 1) / 2) * 0.45;
        const customMem = customPositions[`member-${m.id}`];
        const ux = customMem ? customMem.x : hubX + 52 * Math.cos(uAngle);
        const uy = customMem ? customMem.y : hubY + 52 * Math.sin(uAngle);
        const avatarInitial = (m.full_name || m.username || 'U').charAt(0).toUpperCase();
        return {
          member: m,
          x: ux,
          y: uy,
          initial: avatarInitial,
          firstName: (m.full_name || 'Engineer').split(' ')[0],
          shortJob: 'Lead',
          r: 12,
          jobdeskId: null,
          nodeId: `member-${m.id}`,
        };
      });

      // Stardust particles
      const stardust = Array.from({ length: 6 }).map((_, sIdx) => {
        const sAngle = (sIdx / 6) * Math.PI * 2 + key.length + orbitAngle * 0.7;
        const sDist = 105 + (sIdx % 3) * 18;
        return {
          id: `star-${key}-${sIdx}`,
          x: hubX + sDist * Math.cos(sAngle),
          y: hubY + sDist * Math.sin(sAngle),
          r: 1.5 + (sIdx % 2) * 1.2,
          opacity: 0.35 + (sIdx % 4) * 0.15,
        };
      });

      return {
        key,
        ...cfg,
        hubX,
        hubY,
        hubNodeId: `hub-${key}`,
        jobdeskNodes,
        unassignedNodes,
        stardust,
      };
    });
  }, [divisions, groups, center, customPositions, orbitAngle]);

  // Coordinate scale helper for pan and node dragging
  const getSvgScale = useCallback(() => {
    if (!svgRef.current) return 1;
    const rect = svgRef.current.getBoundingClientRect();
    return rect.width > 0 ? 1060 / rect.width : 1;
  }, []);

  // Background Pan Handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('[data-node="true"]') || e.target.closest('button')) {
      return;
    }
    setIsPanning(true);
    setPanStart({
      x: pan.x,
      y: pan.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    });
  }, [pan]);

  // Node Drag Start Handler
  const handleNodeDragStart = useCallback((e, nodeId, currentPos) => {
    e.stopPropagation();
    hasMovedNode.current = false;
    setDraggedNode({
      id: nodeId,
      mouseX: e.clientX,
      mouseY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y,
    });
  }, []);

  // Mouse Move for Pan & Drag
  const handleMouseMove = useCallback((e) => {
    const scale = getSvgScale();

    if (draggedNode) {
      const dist = Math.hypot(e.clientX - draggedNode.mouseX, e.clientY - draggedNode.mouseY);
      if (dist > 3) {
        hasMovedNode.current = true;
      }
      const dx = ((e.clientX - draggedNode.mouseX) * scale) / zoom;
      const dy = ((e.clientY - draggedNode.mouseY) * scale) / zoom;

      setCustomPositions((prev) => ({
        ...prev,
        [draggedNode.id]: {
          x: draggedNode.origX + dx,
          y: draggedNode.origY + dy,
        },
      }));
    } else if (isPanning) {
      const dx = (e.clientX - panStart.mouseX) * scale;
      const dy = (e.clientY - panStart.mouseY) * scale;
      setPan({
        x: panStart.x + dx,
        y: panStart.y + dy,
      });
    }
  }, [draggedNode, isPanning, panStart, zoom, getSvgScale]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNode(null);
  }, []);

  // Random highlight ticker teammate
  const tickerTeammate = useMemo(() => {
    if (users.length === 0) return null;
    const leads = users.filter((u) => u.role === 'admin' || (u.group_part_ids && u.group_part_ids.length > 1));
    return leads.length > 0 ? leads[0] : users[0];
  }, [users]);

  return (
    <div className={styles.constellationCard} ref={containerRef}>
      {/* Top Header Bar */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              {t('team.live_org_graph', 'LIVE ORG GRAPH')}
            </span>
            <h2 className={styles.cardTitle}>
              {t('team.constellation_title', 'PE People Constellation')}
            </h2>
          </div>
          <p className={styles.cardSubtitle}>
            {totalMembers} {t('team.constellation_sub', 'engineers & teammates • hover a node to inspect profile, filter by division')}
          </p>
        </div>
      </div>

      {/* Division Filter Pills Row */}
      <div className={styles.filterPillsRow}>
        <button
          type="button"
          className={`${styles.filterPill} ${activeFilter === 'all' ? styles.filterPillActive : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          <span>{t('team.filter_all', 'All')}</span>
          <span className={styles.filterPillBadge}>{totalMembers}</span>
        </button>

        {Object.entries(DIVISION_CONFIG).map(([key, cfg]) => {
          const count = divisions[key]?.length || 0;
          const isSelected = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.filterPill} ${isSelected ? styles.filterPillActive : ''}`}
              onClick={() => setActiveFilter((prev) => (prev === key ? 'all' : key))}
            >
              <span className={styles.filterPillDot} style={{ backgroundColor: cfg.color }} />
              <span>{cfg.title}</span>
              <span className={styles.filterPillBadge}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Cosmic Neural Viewport */}
      <div className={styles.viewportContainer} ref={viewportRef}>
        <svg
          ref={svgRef}
          className={styles.graphSvg}
          viewBox="0 0 1060 660"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning || draggedNode ? 'grabbing' : 'grab' }}
        >
          <defs>
            {/* Filters */}
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="nodeGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <radialGradient id="centerCoreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
              <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.15" />
            </radialGradient>
          </defs>

          {/* Obsidian Pan & Zoom Transform Matrix */}
          <g transform={`translate(${center.x + pan.x}, ${center.y + pan.y}) scale(${zoom}) translate(${-center.x}, ${-center.y})`}>
            {/* 3 Concentric Dashed Orbital Rings */}
            <circle
              cx={center.x}
              cy={center.y}
              r={140}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.12"
              strokeDasharray="4 6"
            />
            <circle
              cx={center.x}
              cy={center.y}
              r={260}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.1"
              strokeDasharray="6 8"
            />
            <circle
              cx={center.x}
              cy={center.y}
              r={390}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.06"
              strokeDasharray="8 10"
            />

            {/* Radial Neural Axon Synaptic Lines */}
            {clusterData.map((cluster) => {
              const isClusterActive = hoveredMember
                ? (divisions[cluster.key] || []).some((m) => m.id === hoveredMember.id)
                : hoveredJobdesk
                ? cluster.jobdeskNodes.some((jn) => jn.part.id === hoveredJobdesk.id)
                : null;
              const isDimmed = activeFilter !== 'all' && activeFilter !== cluster.key;

              return (
                <g key={`axons-${cluster.key}`} opacity={isDimmed ? 0.15 : 1}>
                  {/* 1. Main Hub Connector Line from Center */}
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={cluster.hubX}
                    y2={cluster.hubY}
                    stroke={isClusterActive ? 'var(--color-accent)' : cluster.color}
                    strokeWidth={isClusterActive ? '2.2' : '1.5'}
                    strokeOpacity={isClusterActive !== null ? (isClusterActive ? 0.9 : 0.08) : 0.45}
                    strokeDasharray={isClusterActive ? 'none' : '3 3'}
                  />

                  {/* 2. Synaptic Axons from Hub to each Jobdesk Sub-Node */}
                  {cluster.jobdeskNodes.map((jNode, jIdx) => {
                    const isJobdeskActive = hoveredMember
                      ? jNode.memberNodes.some((mn) => mn.member.id === hoveredMember.id)
                      : hoveredJobdesk
                      ? jNode.part.id === hoveredJobdesk.id
                      : null;

                    return (
                      <g key={`j-axons-${cluster.key}-${jIdx}`}>
                        <line
                          x1={cluster.hubX}
                          y1={cluster.hubY}
                          x2={jNode.x}
                          y2={jNode.y}
                          stroke={isJobdeskActive ? 'var(--color-accent)' : cluster.color}
                          strokeWidth={isJobdeskActive ? '2' : '1.1'}
                          strokeOpacity={isJobdeskActive !== null ? (isJobdeskActive ? 0.95 : 0.08) : 0.38}
                        />

                        {/* 3. Branch Axons from Jobdesk Node to its Member Engineers */}
                        {jNode.memberNodes.map((mNode, mIdx) => {
                          const isMemberActive = hoveredMember
                            ? mNode.member.id === hoveredMember.id
                            : hoveredJobdesk
                            ? jNode.part.id === hoveredJobdesk.id
                            : null;

                          return (
                            <line
                              key={`m-branch-${cluster.key}-${jIdx}-${mIdx}`}
                              x1={jNode.x}
                              y1={jNode.y}
                              x2={mNode.x}
                              y2={mNode.y}
                              stroke={isMemberActive ? 'var(--color-accent)' : cluster.color}
                              strokeWidth={isMemberActive ? '2' : '0.75'}
                              strokeOpacity={isMemberActive !== null ? (isMemberActive ? 1 : 0.08) : 0.28}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Unassigned Member Connectors directly to Hub */}
                  {cluster.unassignedNodes.map((uNode, uIdx) => {
                    const isUnassignedActive = hoveredMember ? uNode.member.id === hoveredMember.id : null;
                    return (
                      <line
                        key={`u-branch-${cluster.key}-${uIdx}`}
                        x1={cluster.hubX}
                        y1={cluster.hubY}
                        x2={uNode.x}
                        y2={uNode.y}
                        stroke={isUnassignedActive ? 'var(--color-accent)' : cluster.color}
                        strokeWidth={isUnassignedActive ? '2' : '0.8'}
                        strokeOpacity={isUnassignedActive !== null ? (isUnassignedActive ? 1 : 0.08) : 0.3}
                      />
                    );
                  })}

                  {/* Stardust particles */}
                  {cluster.stardust.map((star) => (
                    <circle
                      key={star.id}
                      className={styles.starParticle}
                      cx={star.x}
                      cy={star.y}
                      r={star.r}
                      fill={cluster.color}
                      opacity={star.opacity}
                    />
                  ))}
                </g>
              );
            })}

            {/* Division Cluster Hub Badges */}
            {clusterData.map((cluster) => {
              const isDimmed = activeFilter !== 'all' && activeFilter !== cluster.key;
              const count = divisions[cluster.key]?.length || 0;
              return (
                <g
                  key={`badge-${cluster.key}`}
                  data-node="true"
                  opacity={isDimmed ? 0.2 : 1}
                  style={{ cursor: 'move', transition: isPanning || draggedNode ? 'none' : 'opacity 0.25s ease' }}
                  onMouseDown={(e) => handleNodeDragStart(e, cluster.hubNodeId, { x: cluster.hubX, y: cluster.hubY })}
                  onClick={() => {
                    if (!hasMovedNode.current) {
                      setActiveFilter((prev) => (prev === cluster.key ? 'all' : cluster.key));
                    }
                  }}
                >
                  {/* Pill Shape - Centered on Hub Anchor */}
                  <rect
                    x={cluster.hubX - 58}
                    y={cluster.hubY - 12}
                    width={116}
                    height={24}
                    rx={12}
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke={cluster.color}
                    strokeWidth="1.4"
                    filter="url(#nodeGlow)"
                  />
                  <circle
                    cx={cluster.hubX - 44}
                    cy={cluster.hubY}
                    r={3.5}
                    fill={cluster.color}
                  />
                  <text
                    x={cluster.hubX - 34}
                    y={cluster.hubY + 3.5}
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="700"
                    letterSpacing="0.02em"
                  >
                    {cluster.title.substring(0, 14)} {count}
                  </text>
                </g>
              );
            })}

            {/* Center PE Core Hub Node */}
            <g transform={`translate(${center.x}, ${center.y})`}>
              {/* Outer pulsating halo */}
              <circle
                className={styles.coreHalo}
                r={40}
                fill="url(#centerCoreGrad)"
              />
              {/* Inner Core Circle */}
              <circle
                r={25}
                fill="#1e293b"
                stroke="#facc15"
                strokeWidth="2.5"
                filter="url(#coreGlow)"
              />
              {/* Core Icon / Text */}
              <text
                textAnchor="middle"
                y={4.5}
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                letterSpacing="0.06em"
              >
                PE CORE
              </text>
            </g>

            {/* Jobdesk Sub-Nodes & Member Nodes */}
            {clusterData.map((cluster) => {
              const isDimmed = activeFilter !== 'all' && activeFilter !== cluster.key;
              const allMembers = [
                ...cluster.jobdeskNodes.flatMap((jn) => jn.memberNodes),
                ...cluster.unassignedNodes,
              ];

              return (
                <g key={`subnodes-${cluster.key}`} opacity={isDimmed ? 0.18 : 1}>
                  {/* Jobdesk Sub-Nodes */}
                  {cluster.jobdeskNodes.map((jn) => (
                    <g
                      key={`j-node-${jn.part.id}`}
                      data-node="true"
                      className={styles.jobdeskNode}
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => handleNodeDragStart(e, jn.nodeId, { x: jn.x, y: jn.y })}
                      onClick={(e) => {
                        if (hasMovedNode.current) return;
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setHoveredJobdesk((prev) =>
                          prev?.id === jn.part.id
                            ? null
                            : {
                                ...jn.part,
                                divisionTitle: cluster.title,
                                assignedMembers: jn.assignedMembers,
                                screenX: Math.min(rect.width - 260, Math.max(16, e.clientX - rect.left)),
                                screenY: Math.max(20, e.clientY - rect.top),
                              }
                        );
                      }}
                      onMouseEnter={(e) => {
                        if (draggedNode) return;
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setHoveredJobdesk({
                          ...jn.part,
                          divisionTitle: cluster.title,
                          assignedMembers: jn.assignedMembers,
                          screenX: Math.min(rect.width - 260, Math.max(16, e.clientX - rect.left)),
                          screenY: Math.max(20, e.clientY - rect.top),
                        });
                      }}
                      onMouseLeave={() => setHoveredJobdesk(null)}
                    >
                      {/* Jobdesk Solid Capsule Pill */}
                      <rect
                        x={jn.x - 32}
                        y={jn.y - 9}
                        width={64}
                        height={18}
                        rx={9}
                        className={styles.jobdeskPillBg}
                        stroke={cluster.color}
                        strokeWidth="1.2"
                      />
                      <circle cx={jn.x - 22} cy={jn.y} r={2.5} fill={cluster.color} />
                      <text
                        x={jn.x - 16}
                        y={jn.y + 3}
                        fill="#e2e8f0"
                        fontSize="7.5"
                        fontWeight="700"
                      >
                        {jn.shortTitle.substring(0, 8)}
                      </text>
                      <rect
                        x={jn.x + 16}
                        y={jn.y - 5.5}
                        width={11}
                        height={11}
                        rx={5.5}
                        fill={cluster.color}
                        opacity="0.35"
                      />
                      <text
                        x={jn.x + 21.5}
                        y={jn.y + 3}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="7"
                        fontWeight="800"
                      >
                        {jn.assignedMembers.length}
                      </text>
                    </g>
                  ))}

                  {/* Member Interactive Nodes */}
                  {allMembers.map((mNode) => {
                    const m = mNode.member;
                    const isHovered = hoveredMember?.id === m.id;
                    return (
                      <g
                        key={`m-node-${m.id}`}
                        data-node="true"
                        className={`${styles.memberNode} ${isDimmed ? styles.memberNodeDimmed : ''}`}
                        transform={`translate(${mNode.x}, ${mNode.y})`}
                        style={{ cursor: 'move' }}
                        onMouseDown={(e) => handleNodeDragStart(e, mNode.nodeId, { x: mNode.x, y: mNode.y })}
                        onMouseEnter={(e) => {
                          if (draggedNode) return;
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setHoveredMember({
                            ...m,
                            screenX: Math.min(rect.width - 260, Math.max(16, e.clientX - rect.left)),
                            screenY: Math.max(20, e.clientY - rect.top),
                          });
                        }}
                        onMouseLeave={() => setHoveredMember(null)}
                        onClick={(e) => {
                          if (hasMovedNode.current) return;
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          setHoveredMember((prev) =>
                            prev?.id === m.id
                              ? null
                              : {
                                  ...m,
                                  screenX: Math.min(rect.width - 260, Math.max(16, e.clientX - rect.left)),
                                  screenY: Math.max(20, e.clientY - rect.top),
                                }
                          );
                        }}
                      >
                        {/* Aura halo ring if multi-jobdesk or admin */}
                        {m.isMulti && (
                          <circle
                            r={mNode.r + 4.5}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1.2"
                            strokeDasharray="2 3"
                          />
                        )}

                        {/* Main Node Circle */}
                        <circle
                          r={mNode.r}
                          fill="#0f172a"
                          stroke={isHovered ? 'var(--color-accent)' : cluster.color}
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          filter={isHovered ? 'url(#nodeGlow)' : 'none'}
                        />

                        {/* Avatar initial text */}
                        <text
                          textAnchor="middle"
                          y={3.8}
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="700"
                          pointerEvents="none"
                        >
                          {mNode.initial}
                        </text>

                        {/* Visible Name & Jobdesk Labels beneath node */}
                        <text
                          x={0}
                          y={mNode.r + 9}
                          className={styles.memberLabelText}
                        >
                          {mNode.firstName}
                        </text>
                        <text
                          x={0}
                          y={mNode.r + 17}
                          className={styles.memberJobdeskText}
                        >
                          {mNode.shortJob}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Obsidian-Style Interactive HUD Controls */}
        <div className={styles.graphControlsHud}>
          <button
            type="button"
            className={`${styles.hudBtn} ${isAutoOrbit ? styles.hudBtnActive : ''}`}
            onClick={() => setIsAutoOrbit((v) => !v)}
            title={isAutoOrbit ? 'Pause Orbit' : 'Play Orbit'}
          >
            {isAutoOrbit ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <div className={styles.hudDivider} />
          <button
            type="button"
            className={styles.hudBtn}
            onClick={() => setZoom((z) => Math.min(2.8, Number((z + 0.15).toFixed(2))))}
            title="Zoom In (+)"
          >
            <ZoomIn size={14} />
          </button>
          <span
            className={styles.hudZoomText}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className={styles.hudBtn}
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            title="Zoom Out (-)"
          >
            <ZoomOut size={14} />
          </button>
          <div className={styles.hudDivider} />
          <button
            type="button"
            className={styles.hudBtn}
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1);
              setCustomPositions({});
            }}
            title="Recenter & Reset Layout"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Hover / Click Jobdesk Popover */}
        {hoveredJobdesk && !hoveredMember && (
          <div
            className={styles.inspectorPopover}
            style={{
              left: `${hoveredJobdesk.screenX}px`,
              top: `${hoveredJobdesk.screenY - 14}px`,
            }}
          >
            <div className={styles.popoverHeader}>
              <div
                className={styles.popoverAvatarFallback}
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.25)', border: '1.5px solid #3b82f6' }}
              >
                <Briefcase size={16} color="#3b82f6" />
              </div>
              <div>
                <h4 className={styles.popoverName}>{hoveredJobdesk.name}</h4>
                <p className={styles.popoverEmail}>{hoveredJobdesk.divisionTitle}</p>
              </div>
            </div>

            <div className={styles.popoverDetails}>
              {hoveredJobdesk.description && (
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 6px', lineHeight: 1.3 }}>
                  {hoveredJobdesk.description}
                </p>
              )}
              <div className={styles.popoverRow}>
                <span className={styles.popoverLabel}>{t('team.assigned_members', 'Assigned Members')}:</span>
                <span className={styles.popoverValue} style={{ color: '#3b82f6' }}>
                  {hoveredJobdesk.assignedMembers.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {hoveredJobdesk.assignedMembers.map((am) => (
                  <span
                    key={am.id}
                    style={{
                      fontSize: '9.5px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#e2e8f0',
                    }}
                  >
                    {am.full_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hover / Click Member Inspector Popover */}
        {hoveredMember && (
          <div
            className={styles.inspectorPopover}
            style={{
              left: `${hoveredMember.screenX}px`,
              top: `${hoveredMember.screenY - 14}px`,
            }}
          >
            <div className={styles.popoverHeader}>
              {hoveredMember.avatar_path ? (
                <img
                  src={hoveredMember.avatar_path}
                  alt={hoveredMember.full_name}
                  className={styles.popoverAvatar}
                />
              ) : (
                <div className={styles.popoverAvatarFallback}>
                  {(hoveredMember.full_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h4 className={styles.popoverName}>{hoveredMember.full_name}</h4>
                <p className={styles.popoverEmail}>{hoveredMember.email}</p>
              </div>
            </div>

            <div className={styles.popoverDetails}>
              <div className={styles.popoverRow}>
                <span className={styles.popoverLabel}>{t('common.department', 'Department')}:</span>
                <span className={styles.popoverValue}>{hoveredMember.department || 'PE'}</span>
              </div>

              <div className={styles.popoverRow}>
                <span className={styles.popoverLabel}>{t('common.role', 'Role')}:</span>
                <span className={styles.popoverValue} style={{ textTransform: 'capitalize' }}>
                  {hoveredMember.role || 'Engineer'}
                </span>
              </div>

              <div className={styles.popoverRow}>
                <span className={styles.popoverLabel}>{t('team.group_part', 'Jobdesk / Part')}:</span>
                <span className={styles.popoverValue} style={{ color: 'var(--color-accent)' }}>
                  {hoveredMember.mainPart?.name || 'Unassigned'}
                </span>
              </div>

              {hoveredMember.isMulti && (
                <div className={styles.popoverRow}>
                  <span className={styles.popoverLabel}>Multi-Jobdesk:</span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#3b82f6',
                      fontWeight: 700,
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      padding: '1px 6px',
                      borderRadius: '6px',
                    }}
                  >
                    {hoveredMember.group_part_names?.join(', ') || `${hoveredMember.group_part_ids.length} parts`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Bar */}
      <div className={styles.cardFooter}>
        <div className={styles.footerLeft}>
          <span className={styles.liveTickerPill}>LIVE</span>
          {tickerTeammate && (
            <span className={styles.footerTickerText}>
              <Users size={13} color="var(--color-accent)" />
              <strong>{tickerTeammate.full_name}</strong>
              <span style={{ color: '#94a3b8' }}>
                • {tickerTeammate.department || 'PE'} (
                {tickerTeammate.mainPart?.name || tickerTeammate.role})
              </span>
            </span>
          )}
        </div>

        <div className={styles.footerRight}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('team.stat_total_teammates', 'TOTAL TEAMMATES')}</span>
            <span className={styles.statValue}>{totalMembers}</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('team.stat_divisions', 'DIVISIONS')}</span>
            <span className={styles.statValue}>5</span>
          </div>

          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('team.stat_multi_jobdesk', 'MULTI-JOBDESK')}</span>
            <span className={styles.statValue} style={{ color: '#3b82f6' }}>
              {multiJobdeskCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

