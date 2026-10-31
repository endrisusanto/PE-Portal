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
    dist: 180,
  },
  pe_mecha: {
    title: 'PE Mecha',
    color: '#3b82f6', // Electric Blue
    icon: Layers,
    angle: -18, // Top-Right
    dist: 310,
  },
  pe_solution: {
    title: 'PE Solution',
    color: '#10b981', // Emerald
    icon: Sparkles,
    angle: 52, // Bottom-Right
    dist: 290,
  },
  cross_dept: {
    title: 'Cross-Dept Partners',
    color: '#f97316', // Orange
    icon: Building2,
    angle: 128, // Bottom-Left
    dist: 290,
  },
  pe_production: {
    title: 'PE Part',
    color: '#a855f7', // Violet
    icon: Briefcase,
    angle: 198, // Top-Left
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

  // Ambient auto-orbit physics simulation (pauses smoothly on hover for inspection)
  useEffect(() => {
    if (!isAutoOrbit) return;
    let animId;
    const step = () => {
      if (!hoveredMember && !hoveredJobdesk) {
        setOrbitAngle((prev) => (prev + 0.0022) % (Math.PI * 2));
      }
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoOrbit, hoveredMember, hoveredJobdesk]);

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

  // Center coordinate of ViewBox (1120 x 700)
  const center = { x: 560, y: 350 };

  // Calculate coordinates for cluster hubs, jobdesk sub-hubs, and their unique member nodes
  const clusterData = useMemo(() => {
    return Object.entries(DIVISION_CONFIG).map(([key, cfg]) => {
      const rad = (cfg.angle * Math.PI) / 180 + orbitAngle;
      const customHub = customPositions[`hub-${key}`];
      const hubX = customHub ? customHub.x : center.x + cfg.dist * Math.cos(rad);
      const hubY = customHub ? customHub.y : center.y + cfg.dist * Math.sin(rad);
      const members = divisions[key] || [];

      // 1. Identify active jobdesks for this division that have assigned members
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

      const numParts = activeParts.length;

      // 2. Position active jobdesk anchors along outward sector arc
      const jobdeskNodes = activeParts.map((jPart, jIdx) => {
        const customJob = customPositions[`jobdesk-${key}-${jPart.id}`];
        let jx, jy;
        if (customJob) {
          jx = customJob.x;
          jy = customJob.y;
        } else {
          const distJobdesk = numParts > 2 ? 92 : 82;
          const arcSpread = numParts > 1 ? Math.min(2.0, (numParts - 1) * 0.58) : 0;
          const jAngle = numParts > 1
            ? rad + (jIdx - (numParts - 1) / 2) * (arcSpread / (numParts - 1))
            : rad;
          jx = hubX + distJobdesk * Math.cos(jAngle);
          jy = hubY + distJobdesk * Math.sin(jAngle);
        }

        // Assigned members for this jobdesk
        const jMembers = members.filter(
          (m) => (m.group_part_ids && m.group_part_ids.includes(jPart.id)) || m.group_part_id === jPart.id
        );

        return {
          part: jPart,
          x: jx,
          y: jy,
          shortTitle: formatShortJobdesk(jPart.name),
          assignedMembers: jMembers,
          nodeId: `jobdesk-${key}-${jPart.id}`,
        };
      });

      // Relaxation for jobdesk badges so badges never overlap each other
      const MIN_JOB_DIST = 76;
      for (let iter = 0; iter < 10; iter++) {
        for (let i = 0; i < jobdeskNodes.length; i++) {
          for (let j = i + 1; j < jobdeskNodes.length; j++) {
            const a = jobdeskNodes[i];
            const b = jobdeskNodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < MIN_JOB_DIST) {
              const push = (MIN_JOB_DIST - d) / 2;
              const nx = (dx / d) * push;
              const ny = (dy / d) * push;
              if (!customPositions[a.nodeId]) { a.x -= nx; a.y -= ny; }
              if (!customPositions[b.nodeId]) { b.x += nx; b.y += ny; }
            }
          }
        }
      }

      // 3. Map EVERY member in this division EXACTLY ONCE!
      // Multi-jobdesk members are anchored to their primary jobdesk and connected to other jobdesks via synaptic axons
      const memberNodes = members.map((m, mIdx) => {
        const customMem = customPositions[`member-${m.id}`];
        if (customMem) {
          return {
            member: m,
            x: customMem.x,
            y: customMem.y,
            initial: (m.full_name || m.username || 'U').charAt(0).toUpperCase(),
            firstName: (m.full_name || 'Engineer').split(' ')[0],
            shortJob: m.mainPart ? formatShortJobdesk(m.mainPart.name) : 'Member',
            r: 12,
            primaryJobdeskId: m.group_part_id || (m.group_part_ids && m.group_part_ids[0]),
            nodeId: `member-${m.id}`,
          };
        }

        // Find matched primary jobdesk anchor
        const primaryPartId = m.group_part_id ||
          (m.group_part_ids && m.group_part_ids.find(id => jobdeskNodes.some(jn => jn.part.id === id))) ||
          (m.group_part_ids && m.group_part_ids[0]);

        const parentJNode = jobdeskNodes.find((jn) => jn.part.id === primaryPartId);

        let initialX, initialY;
        if (parentJNode) {
          // Angle from hub to this jobdesk
          const baseAngle = Math.atan2(parentJNode.y - hubY, parentJNode.x - hubX);
          // Siblings under the same primary jobdesk
          const siblings = members.filter(sib => {
            const sibPart = sib.group_part_id ||
              (sib.group_part_ids && sib.group_part_ids.find(id => jobdeskNodes.some(jn => jn.part.id === id))) ||
              (sib.group_part_ids && sib.group_part_ids[0]);
            return sibPart === primaryPartId;
          });
          const sibIdx = siblings.findIndex(sib => sib.id === m.id);
          const sibTotal = siblings.length;

          if (sibTotal === 1) {
            initialX = parentJNode.x + 54 * Math.cos(baseAngle);
            initialY = parentJNode.y + 54 * Math.sin(baseAngle);
          } else {
            const fanSpread = Math.min(1.7, (sibTotal - 1) * 0.44);
            const mAngle = baseAngle + (sibIdx - (sibTotal - 1) / 2) * (fanSpread / (sibTotal - 1));
            const dist = sibTotal > 3 ? (sibIdx % 2 === 0 ? 54 : 74) : 58;
            initialX = parentJNode.x + dist * Math.cos(mAngle);
            initialY = parentJNode.y + dist * Math.sin(mAngle);
          }
        } else {
          // Unassigned: fan out inward/around hub
          const uAngle = rad + Math.PI * 0.75 + (mIdx / Math.max(1, members.length)) * Math.PI * 0.6;
          initialX = hubX + 54 * Math.cos(uAngle);
          initialY = hubY + 54 * Math.sin(uAngle);
        }

        const avatarInitial = (m.full_name || m.username || 'U').charAt(0).toUpperCase();
        const firstName = (m.full_name || 'Engineer').split(' ')[0];
        const shortJob = m.mainPart ? formatShortJobdesk(m.mainPart.name) : 'Member';

        return {
          member: m,
          x: initialX,
          y: initialY,
          initial: avatarInitial,
          firstName,
          shortJob,
          r: 12,
          primaryJobdeskId: primaryPartId,
          nodeId: `member-${m.id}`,
        };
      });

      // 4. Force Relaxation on member nodes: ZERO overlaps mathematically guaranteed!
      const MIN_MEMBER_DIST = 46; // node diameter is 24, leaves 22px clear margin
      for (let iter = 0; iter < 15; iter++) {
        // Member-to-Member repulsion
        for (let i = 0; i < memberNodes.length; i++) {
          for (let j = i + 1; j < memberNodes.length; j++) {
            const a = memberNodes[i];
            const b = memberNodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < MIN_MEMBER_DIST) {
              const push = (MIN_MEMBER_DIST - d) / 2;
              const nx = (dx / d) * push;
              const ny = (dy / d) * push;
              if (!customPositions[a.nodeId]) { a.x -= nx; a.y -= ny; }
              if (!customPositions[b.nodeId]) { b.x += nx; b.y += ny; }
            }
          }

          // Member-to-Jobdesk repulsion
          for (const jn of jobdeskNodes) {
            const a = memberNodes[i];
            const dx = a.x - jn.x;
            const dy = a.y - jn.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 44) {
              const push = 44 - d;
              if (!customPositions[a.nodeId]) {
                a.x += (dx / d) * push;
                a.y += (dy / d) * push;
              }
            }
          }

          // Member-to-Hub repulsion
          const a = memberNodes[i];
          const dhx = a.x - hubX;
          const dhy = a.y - hubY;
          const dh = Math.hypot(dhx, dhy) || 1;
          if (dh < 50) {
            const push = 50 - dh;
            if (!customPositions[a.nodeId]) {
              a.x += (dhx / dh) * push;
              a.y += (dhy / dh) * push;
            }
          }
        }
      }

      // Stardust particles
      const stardust = Array.from({ length: 6 }).map((_, sIdx) => {
        const sAngle = (sIdx / 6) * Math.PI * 2 + key.length + orbitAngle * 0.7;
        const sDist = 110 + (sIdx % 3) * 18;
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
        memberNodes,
        stardust,
      };
    });
  }, [divisions, groups, center, customPositions, orbitAngle]);

  // Coordinate scale helper for pan and node dragging
  const getSvgScale = useCallback(() => {
    if (!svgRef.current) return 1;
    const rect = svgRef.current.getBoundingClientRect();
    return rect.width > 0 ? 1120 / rect.width : 1;
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
          viewBox="0 0 1120 700"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning || draggedNode ? 'grabbing' : 'grab' }}
        >
          <defs>
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
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
              r={150}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.12"
              strokeDasharray="4 6"
            />
            <circle
              cx={center.x}
              cy={center.y}
              r={280}
              fill="none"
              stroke="var(--color-accent)"
              strokeOpacity="0.1"
              strokeDasharray="6 8"
            />
            <circle
              cx={center.x}
              cy={center.y}
              r={410}
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
                    strokeWidth={isClusterActive ? '2.4' : '1.5'}
                    strokeOpacity={isClusterActive !== null ? (isClusterActive ? 0.9 : 0.08) : 0.45}
                    strokeDasharray={isClusterActive ? 'none' : '3 3'}
                  />

                  {/* 2. Synaptic Axons from Hub to each Jobdesk Sub-Node */}
                  {cluster.jobdeskNodes.map((jNode, jIdx) => {
                    const isJobdeskActive = hoveredMember
                      ? (hoveredMember.primaryJobdeskId === jNode.part.id ||
                         (hoveredMember.group_part_ids && hoveredMember.group_part_ids.includes(jNode.part.id)))
                      : hoveredJobdesk
                      ? jNode.part.id === hoveredJobdesk.id
                      : null;

                    return (
                      <line
                        key={`j-axons-${cluster.key}-${jIdx}`}
                        x1={cluster.hubX}
                        y1={cluster.hubY}
                        x2={jNode.x}
                        y2={jNode.y}
                        stroke={isJobdeskActive ? 'var(--color-accent)' : cluster.color}
                        strokeWidth={isJobdeskActive ? '2' : '1.1'}
                        strokeOpacity={isJobdeskActive !== null ? (isJobdeskActive ? 0.95 : 0.08) : 0.38}
                      />
                    );
                  })}

                  {/* 3. Branch Axons from primary Jobdesk (or Hub) to Member Engineers */}
                  {cluster.memberNodes.map((mNode) => {
                    const isMemberActive = hoveredMember
                      ? mNode.member.id === hoveredMember.id
                      : hoveredJobdesk
                      ? (mNode.primaryJobdeskId === hoveredJobdesk.id ||
                         (mNode.member.group_part_ids && mNode.member.group_part_ids.includes(hoveredJobdesk.id)))
                      : null;

                    const parentJobdesk = cluster.jobdeskNodes.find(
                      (jn) => jn.part.id === mNode.primaryJobdeskId
                    );
                    const originX = parentJobdesk ? parentJobdesk.x : cluster.hubX;
                    const originY = parentJobdesk ? parentJobdesk.y : cluster.hubY;

                    return (
                      <g key={`m-branch-${mNode.member.id}`}>
                        {/* Primary Connection Line */}
                        <line
                          x1={originX}
                          y1={originY}
                          x2={mNode.x}
                          y2={mNode.y}
                          stroke={isMemberActive ? 'var(--color-accent)' : cluster.color}
                          strokeWidth={isMemberActive ? '2' : '0.8'}
                          strokeOpacity={isMemberActive !== null ? (isMemberActive ? 1 : 0.08) : 0.28}
                        />

                        {/* Multi-jobdesk secondary synaptic bridges */}
                        {mNode.member.group_part_ids &&
                          mNode.member.group_part_ids
                            .filter((pid) => pid !== mNode.primaryJobdeskId)
                            .map((otherPid) => {
                              const otherJn = cluster.jobdeskNodes.find((jn) => jn.part.id === otherPid);
                              if (!otherJn) return null;
                              return (
                                <line
                                  key={`multi-bridge-${mNode.member.id}-${otherPid}`}
                                  x1={mNode.x}
                                  y1={mNode.y}
                                  x2={otherJn.x}
                                  y2={otherJn.y}
                                  stroke={isMemberActive ? 'var(--color-accent)' : '#3b82f6'}
                                  strokeWidth={isMemberActive ? '1.5' : '0.6'}
                                  strokeDasharray="2 3"
                                  strokeOpacity={isMemberActive !== null ? (isMemberActive ? 0.9 : 0.05) : 0.2}
                                />
                              );
                            })}
                      </g>
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
                  {/* Subtle Glow Backdrop Pill - No raster filter to avoid ghost artifacts */}
                  <rect
                    x={cluster.hubX - 60}
                    y={cluster.hubY - 14}
                    width={120}
                    height={28}
                    rx={14}
                    fill={cluster.color}
                    opacity="0.12"
                    pointerEvents="none"
                  />
                  {/* Main Division Capsule */}
                  <rect
                    x={cluster.hubX - 58}
                    y={cluster.hubY - 12}
                    width={116}
                    height={24}
                    rx={12}
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke={cluster.color}
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />
                  {/* Hit Area */}
                  <rect
                    x={cluster.hubX - 62}
                    y={cluster.hubY - 16}
                    width={124}
                    height={32}
                    fill="transparent"
                    pointerEvents="all"
                  />
                  <circle
                    cx={cluster.hubX - 44}
                    cy={cluster.hubY}
                    r={3.5}
                    fill={cluster.color}
                    pointerEvents="none"
                  />
                  <text
                    x={cluster.hubX - 34}
                    y={cluster.hubY + 3.5}
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="700"
                    letterSpacing="0.02em"
                    pointerEvents="none"
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
                pointerEvents="none"
              />
              {/* Inner Core Circle */}
              <circle
                r={25}
                fill="#1e293b"
                stroke="#facc15"
                strokeWidth="2.5"
                filter="url(#coreGlow)"
                pointerEvents="none"
              />
              {/* Core Icon / Text */}
              <text
                textAnchor="middle"
                y={4.5}
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                letterSpacing="0.06em"
                pointerEvents="none"
              >
                PE CORE
              </text>
            </g>

            {/* Jobdesk Sub-Nodes & Member Nodes */}
            {clusterData.map((cluster) => {
              const isDimmed = activeFilter !== 'all' && activeFilter !== cluster.key;

              return (
                <g key={`subnodes-${cluster.key}`} opacity={isDimmed ? 0.18 : 1}>
                  {/* Jobdesk Sub-Nodes */}
                  {cluster.jobdeskNodes.map((jn) => {
                    const isJobdeskHovered = hoveredJobdesk?.id === jn.part.id;

                    return (
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
                        {/* Generous Hit Area: Prevents rapid jitter / flicker */}
                        <rect
                          x={jn.x - 38}
                          y={jn.y - 12}
                          width={76}
                          height={24}
                          fill="transparent"
                          pointerEvents="all"
                        />

                        {/* Hover Halo Ring: Instant GPU render, no SVG filter lag */}
                        {isJobdeskHovered && (
                          <rect
                            x={jn.x - 36}
                            y={jn.y - 11}
                            width={72}
                            height={22}
                            rx={11}
                            fill={cluster.color}
                            opacity="0.25"
                            pointerEvents="none"
                          />
                        )}

                        {/* Jobdesk Solid Capsule Pill */}
                        <rect
                          x={jn.x - 34}
                          y={jn.y - 10}
                          width={68}
                          height={20}
                          rx={10}
                          className={styles.jobdeskPillBg}
                          stroke={isJobdeskHovered ? 'var(--color-accent)' : cluster.color}
                          strokeWidth={isJobdeskHovered ? '1.8' : '1.2'}
                          pointerEvents="none"
                        />
                        <circle cx={jn.x - 24} cy={jn.y} r={2.5} fill={cluster.color} pointerEvents="none" />
                        <text
                          x={jn.x - 17}
                          y={jn.y + 3.2}
                          fill="#e2e8f0"
                          fontSize="7.5"
                          fontWeight="700"
                          pointerEvents="none"
                        >
                          {jn.shortTitle.substring(0, 8)}
                        </text>
                        <rect
                          x={jn.x + 18}
                          y={jn.y - 6}
                          width={12}
                          height={12}
                          rx={6}
                          fill={cluster.color}
                          opacity="0.35"
                          pointerEvents="none"
                        />
                        <text
                          x={jn.x + 24}
                          y={jn.y + 3}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7"
                          fontWeight="800"
                          pointerEvents="none"
                        >
                          {jn.assignedMembers.length}
                        </text>
                      </g>
                    );
                  })}

                  {/* Member Interactive Nodes - Guaranteed 1 unique node per teammate */}
                  {cluster.memberNodes.map((mNode) => {
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
                            primaryJobdeskId: mNode.primaryJobdeskId,
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
                                  primaryJobdeskId: mNode.primaryJobdeskId,
                                  screenX: Math.min(rect.width - 260, Math.max(16, e.clientX - rect.left)),
                                  screenY: Math.max(20, e.clientY - rect.top),
                                }
                          );
                        }}
                      >
                        {/* Generous Hit-Area: Prevents rapid mouseout bouncing between circle & labels */}
                        <circle r={22} fill="transparent" pointerEvents="all" />

                        {/* Hover Ring Aura: Glitch-free native SVG glow (no feGaussianBlur GPU delay) */}
                        {isHovered && (
                          <circle
                            r={mNode.r + 6}
                            fill={cluster.color}
                            opacity="0.35"
                            pointerEvents="none"
                          />
                        )}

                        {/* Multi-jobdesk orbital halo ring */}
                        {m.isMulti && (
                          <circle
                            r={mNode.r + 4.5}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1.2"
                            strokeDasharray="2 3"
                            pointerEvents="none"
                          />
                        )}

                        {/* Main Node Avatar Circle */}
                        <circle
                          r={mNode.r}
                          fill="#0f172a"
                          stroke={isHovered ? 'var(--color-accent)' : cluster.color}
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          pointerEvents="none"
                        />

                        {/* Avatar Initial Text */}
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
                          pointerEvents="none"
                        >
                          {mNode.firstName}
                        </text>
                        <text
                          x={0}
                          y={mNode.r + 17}
                          className={styles.memberJobdeskText}
                          pointerEvents="none"
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
              top: `${hoveredJobdesk.screenY}px`,
              transform: hoveredJobdesk.screenY < 180 ? 'translate(-50%, 16px)' : 'translate(-50%, -120%)',
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
              top: `${hoveredMember.screenY}px`,
              transform: hoveredMember.screenY < 180 ? 'translate(-50%, 16px)' : 'translate(-50%, -120%)',
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
