import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, Minimize2, Compass, Sun, Moon, Sparkles } from 'lucide-react';
import { TEAMS, ZONES } from './virtualOfficeData';

export const VirtualOfficeCanvas = forwardRef(({
  engineers = [],
  activePhase,
  selectedEngineer,
  onSelectEngineer,
  filterTeam = 'ALL',
  isDarkMode = false,
  viewMode = 'light',
  canvasHeight = '100%',
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredEngineer, setHoveredEngineer] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 3D Camera State: Defaults to classic isometric perspective matching reference image
  const cameraRef = useRef({
    yaw: -0.52,          // Isometric angle (~ -30° matching screenshot)
    pitch: 0.65,         // Tilt angle (~ 37° elevation)
    zoom: 1.05,          // Zoom factor
    pan: { x: 0, y: 0 },
    isDragging: false,
    dragMode: 'rotate',  // 'rotate' or 'pan'
    lastMouse: { x: 0, y: 0 },
  });

  const [cameraDisplay, setCameraDisplay] = useState({ yawDeg: -30, pitchDeg: 37, zoomPct: 105 });

  // Persistent avatar states with waypoint queues for real corridor walking
  const avatarStatesRef = useRef({});

  // Corridor Y line
  const CORRIDOR_Y = 43;

  // Path generator: Creates hallway waypoints so characters don't cut through walls
  const generateHallwayPath = (startX, startY, targetX, targetY) => {
    const dist = Math.hypot(targetX - startX, targetY - startY);
    if (dist < 4) {
      return [{ x: targetX, y: targetY }];
    }

    const path = [];
    if (startY > 48) {
      path.push({ x: startX, y: 48 });
      path.push({ x: startX, y: CORRIDOR_Y });
    } else if (startY < 38) {
      path.push({ x: startX, y: 38 });
      path.push({ x: startX, y: CORRIDOR_Y });
    }

    path.push({ x: targetX, y: CORRIDOR_Y });

    if (targetY > 48) {
      path.push({ x: targetX, y: 48 });
    } else if (targetY < 38) {
      path.push({ x: targetX, y: 38 });
    }

    path.push({ x: targetX, y: targetY });
    return path;
  };

  // Sync avatar target coordinates and generate walking waypoints
  useEffect(() => {
    engineers.forEach((eng) => {
      const tgt = eng.targetCoords || { x: 50, y: 50 };
      let state = avatarStatesRef.current[eng.id];

      if (!state) {
        state = {
          currentX: tgt.x,
          currentY: tgt.y,
          targetX: tgt.x,
          targetY: tgt.y,
          waypoints: [],
          speed: 0.18 + (eng.id % 5) * 0.03,
          walkFrame: Math.random() * 10,
          isMoving: false,
          facing: 1,
        };
        avatarStatesRef.current[eng.id] = state;
      } else {
        if (Math.hypot(state.targetX - tgt.x, state.targetY - tgt.y) > 0.8) {
          state.targetX = tgt.x;
          state.targetY = tgt.y;
          state.waypoints = generateHallwayPath(state.currentX, state.currentY, tgt.x, tgt.y);
        }
      }
    });
  }, [engineers]);

  // 3D Projection math: Takes (wx, wy, wz) world coords and projects to screen 2D
  const project3D = useCallback((wx, wy, wz = 0, width, height) => {
    const cam = cameraRef.current;
    const cx = width * 0.5 + cam.pan.x;
    const cy = height * 0.5 + cam.pan.y;

    // Relative to floor center (50, 50)
    const rx = wx - 50;
    const ry = wy - 50;

    // 1. Orbit Yaw rotation
    const cosYaw = Math.cos(cam.yaw);
    const sinYaw = Math.sin(cam.yaw);
    const rotX = rx * cosYaw - ry * sinYaw;
    const rotY = rx * sinYaw + ry * cosYaw;

    // 2. Pitch Tilt elevation
    const cosPitch = Math.cos(cam.pitch);
    const sinPitch = Math.sin(cam.pitch);

    // 3. Screen projection with zoom
    const baseScale = Math.min(width, height) * 0.0076 * cam.zoom;
    const screenX = cx + rotX * baseScale * 1.6;
    const screenY = cy + (rotY * sinPitch - wz * cosPitch) * baseScale * 1.6;

    // Depth for z-sorting: elements closer to camera render in front
    const depth = rotY * cosPitch + wz * sinPitch;

    return { x: screenX, y: screenY, depth };
  }, []);

  // Main 60 FPS Render Loop
  useEffect(() => {
    let animationFrameId;
    let tick = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tick += 1;

      // Clear Canvas with sleek gradient background matching diorama
      ctx.clearRect(0, 0, width, height);

      const effectiveNight = viewMode === 'light' ? false : (viewMode === 'dark' ? true : activePhase?.type === 'off');
      const effectiveDark = viewMode === 'light' ? false : (viewMode === 'dark' ? true : isDarkMode);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      if (effectiveDark) {
        bgGrad.addColorStop(0, '#0a0f1d');
        bgGrad.addColorStop(1, '#1e293b');
      } else {
        bgGrad.addColorStop(0, '#f8fafc');
        bgGrad.addColorStop(1, '#eef2f6');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 1. Draw 3D Isometric Raised Platform & Parquet Wood Floor
      drawIsometricFloor(ctx, width, height, project3D, effectiveDark, effectiveNight);

      // 2. Draw 3D Elevated Back & Left Walls, Windows with Sunlight, Wall Shelves & Clock
      draw3DWallsAndDecor(ctx, width, height, project3D, effectiveDark, effectiveNight, tick);

      // 3. Draw Room Furniture: Meeting Glass Partition & Table, Lounge & Pojok Kopi, Workstations, Labs
      drawDioramaFurniture(ctx, width, height, project3D, effectiveDark, effectiveNight, tick);

      // 4. Update Avatar Walking Logic (Step along Waypoint Queue)
      engineers.forEach((eng) => {
        const state = avatarStatesRef.current[eng.id];
        if (!state) return;

        if (state.waypoints && state.waypoints.length > 0) {
          const nextWp = state.waypoints[0];
          const dx = nextWp.x - state.currentX;
          const dy = nextWp.y - state.currentY;
          const dist = Math.hypot(dx, dy);

          if (dist > state.speed) {
            state.currentX += (dx / dist) * state.speed;
            state.currentY += (dy / dist) * state.speed;
            state.isMoving = true;
            state.walkFrame += 0.35;
            state.facing = dx >= 0 ? 1 : -1;
          } else {
            state.currentX = nextWp.x;
            state.currentY = nextWp.y;
            state.waypoints.shift();
          }
        } else {
          const dx = state.targetX - state.currentX;
          const dy = state.targetY - state.currentY;
          if (Math.hypot(dx, dy) > 0.05) {
            state.currentX += dx * 0.1;
            state.currentY += dy * 0.1;
            state.isMoving = true;
          } else {
            state.isMoving = false;
          }
        }
      });

      // 5. Draw 32 Avatars + Floating 3D Status Pills (Z-sorted for correct depth occlusion)
      const sortedAvatars = engineers
        .map((eng) => {
          const state = avatarStatesRef.current[eng.id];
          const pos = state ? project3D(state.currentX, state.currentY, 0, width, height) : { x: 0, y: 0, depth: 0 };
          return { eng, state, pos };
        })
        .sort((a, b) => a.pos.depth - b.pos.depth);

      sortedAvatars.forEach(({ eng, state, pos }) => {
        if (!state) return;
        const isHovered = hoveredEngineer?.id === eng.id;
        const isSelected = selectedEngineer?.id === eng.id;
        const matchesFilter = filterTeam === 'ALL' || eng.team === filterTeam;

        drawAvatar(ctx, pos, eng, state, isHovered, isSelected, matchesFilter, tick, effectiveNight, cameraRef.current.zoom);
      });

      // 6. Night Dim Overlay
      if (effectiveNight) {
        ctx.fillStyle = 'rgba(7, 11, 22, 0.45)';
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [engineers, activePhase, selectedEngineer, hoveredEngineer, filterTeam, isDarkMode, viewMode, project3D]);

  // Resize handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      requestAnimationFrame(() => {
        handleResize();
        setTimeout(handleResize, 100);
      });
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [handleResize]);

  // Mouse Interaction: Orbit, Tilt, Pan, Zoom, and Avatar Hit Testing
  const handleMouseDown = (e) => {
    const cam = cameraRef.current;
    cam.isDragging = true;
    cam.lastMouse = { x: e.clientX, y: e.clientY };
    cam.dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
  };

  const handleMouseMove = (e) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (cam.isDragging) {
      const dx = e.clientX - cam.lastMouse.x;
      const dy = e.clientY - cam.lastMouse.y;
      cam.lastMouse = { x: e.clientX, y: e.clientY };

      if (cam.dragMode === 'rotate') {
        cam.yaw += dx * 0.008;
        cam.pitch = Math.max(0.25, Math.min(1.35, cam.pitch + dy * 0.006));
      } else {
        cam.pan.x += dx;
        cam.pan.y += dy;
      }

      setCameraDisplay({
        yawDeg: Math.round(((cam.yaw * 180) / Math.PI) % 360),
        pitchDeg: Math.round((cam.pitch * 180) / Math.PI),
        zoomPct: Math.round(cam.zoom * 100),
      });
      return;
    }

    // Avatar hover test
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    let found = null;
    for (const eng of engineers) {
      const state = avatarStatesRef.current[eng.id];
      if (!state) continue;
      const screenPos = project3D(state.currentX, state.currentY, 0, width, height);
      const dist = Math.hypot(mouseX - screenPos.x, mouseY - (screenPos.y - 12));
      if (dist < 26 * cam.zoom) {
        found = eng;
        break;
      }
    }
    setHoveredEngineer(found);
  };

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const cam = cameraRef.current;
    cam.zoom = Math.max(0.5, Math.min(2.8, cam.zoom - e.deltaY * 0.0015));
    setCameraDisplay((prev) => ({ ...prev, zoomPct: Math.round(cam.zoom * 100) }));
  };

  const handleClick = () => {
    if (hoveredEngineer) {
      onSelectEngineer?.(hoveredEngineer);
    } else if (!cameraRef.current.isDragging) {
      onSelectEngineer?.(null);
    }
  };

  const resetCamera = () => {
    cameraRef.current.yaw = -0.52;
    cameraRef.current.pitch = 0.65;
    cameraRef.current.zoom = 1.05;
    cameraRef.current.pan = { x: 0, y: 0 };
    setCameraDisplay({ yawDeg: -30, pitchDeg: 37, zoomPct: 105 });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen?.().catch(console.error);
    }
  };

  useImperativeHandle(ref, () => ({
    resetCamera,
    toggleFullscreen,
    cameraRef,
  }));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : (canvasHeight || '620px'),
        maxWidth: isFullscreen ? '100vw' : '100%',
        maxHeight: isFullscreen ? '100vh' : 'none',
        borderRadius: isFullscreen ? '0' : '14px',
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid var(--color-border)',
        boxShadow: isFullscreen ? 'none' : '0 12px 32px rgba(0,0,0,0.12)',
        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
        cursor: hoveredEngineer ? 'pointer' : (cameraRef.current.isDragging ? 'grabbing' : 'grab'),
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => {
        cameraRef.current.isDragging = false;
        setHoveredEngineer(null);
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Floating 3D Camera Toolbar (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          padding: '4px 8px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#f8fafc',
          fontSize: '11px',
          zIndex: 5,
        }}
      >
        <span style={{ color: '#94a3b8', fontSize: '10px', paddingRight: '4px' }}>
          📐 {cameraDisplay.yawDeg}° / {cameraDisplay.pitchDeg}° • {cameraDisplay.zoomPct}%
        </span>
        <button onClick={resetCamera} title="Sudut Awal (Isometric View)" style={toolbarBtnStyle}>
          <Compass size={14} />
        </button>
        <button onClick={toggleFullscreen} title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'} style={toolbarBtnStyle}>
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Helper guide text at bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          color: 'var(--color-text-muted)',
          fontSize: '11px',
          pointerEvents: 'none',
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px',
          borderRadius: '6px',
        }}
      >
        🖱️ geser: putar 360° • scroll = zoom • klik karakter = info • f = layar penuh
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredEngineer && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: '12px',
            left: '12px',
            padding: '10px 14px',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#f8fafc',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 10,
            backdropFilter: 'blur(6px)',
            maxWidth: '300px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: hoveredEngineer.avatarColor || '#3b82f6',
              }}
            />
            <strong style={{ fontSize: '13px' }}>
              {hoveredEngineer.name} {hoveredEngineer.isLeader && '👔 (LEADER)'}
            </strong>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>
            {hoveredEngineer.role} • <span style={{ color: '#38bdf8' }}>{hoveredEngineer.team}</span>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '11px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
            📍 {hoveredEngineer.currentZone}: <em>{hoveredEngineer.currentActivity}</em>
          </div>
        </div>
      )}
    </div>
  );
});

const toolbarBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#f8fafc',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ==========================================
// 3D ISOMETRIC DIORAMA RENDERING ENGINE
// ==========================================

function drawIsometricFloor(ctx, width, height, project, isDark, isNight) {
  // 1. Raised Diorama Platform Thickness (z: 0 down to z: -3)
  const f1 = project(2, 94, 0, width, height);
  const f2 = project(98, 94, 0, width, height);
  const f1_sub = project(2, 94, -3, width, height);
  const f2_sub = project(98, 94, -3, width, height);

  ctx.beginPath();
  ctx.moveTo(f1.x, f1.y);
  ctx.lineTo(f2.x, f2.y);
  ctx.lineTo(f2_sub.x, f2_sub.y);
  ctx.lineTo(f1_sub.x, f1_sub.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#0f172a' : '#cbd5e1';
  ctx.fill();
  ctx.strokeStyle = isDark ? '#334155' : '#94a3b8';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. Main Floor Surface (z=0, x: 2..98, y: 8..94)
  const p1 = project(2, 8, 0, width, height);
  const p2 = project(98, 8, 0, width, height);
  const p3 = project(98, 94, 0, width, height);
  const p4 = project(2, 94, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();

  // Warm Oak Wood Parquet Flooring
  ctx.fillStyle = isDark
    ? (isNight ? '#0f172a' : '#1e293b')
    : (isNight ? '#cbd5e1' : '#f5e6d3');
  ctx.fill();

  // Draw subtle wood planks lines
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(217, 180, 143, 0.4)';
  for (let x = 8; x <= 92; x += 6) {
    const l1 = project(x, 8, 0, width, height);
    const l2 = project(x, 94, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(l1.x, l1.y);
    ctx.lineTo(l2.x, l2.y);
    ctx.stroke();
  }

  // Central Corridor Soft Highlight (x: 11..98, y: 38..48)
  const c1 = project(11, 38, 0, width, height);
  const c2 = project(98, 38, 0, width, height);
  const c3 = project(98, 48, 0, width, height);
  const c4 = project(11, 48, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.lineTo(c3.x, c3.y);
  ctx.lineTo(c4.x, c4.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
}

function draw3DWallsAndDecor(ctx, width, height, project, isDark, isNight, tick) {
  const wallHeight = 24;

  // 1. LEFT WALL (along x=2, y from 8 to 94, z: 0 to 24)
  const lw_b1 = project(2, 8, 0, width, height);
  const lw_b2 = project(2, 94, 0, width, height);
  const lw_t2 = project(2, 94, wallHeight, width, height);
  const lw_t1 = project(2, 8, wallHeight, width, height);

  ctx.beginPath();
  ctx.moveTo(lw_b1.x, lw_b1.y);
  ctx.lineTo(lw_b2.x, lw_b2.y);
  ctx.lineTo(lw_t2.x, lw_t2.y);
  ctx.lineTo(lw_t1.x, lw_t1.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#1e293b' : '#ede2d3';
  ctx.fill();
  ctx.strokeStyle = isDark ? '#334155' : '#d6c7b2';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left Wall Skirting Board
  const lw_sk1 = project(2, 8, 2, width, height);
  const lw_sk2 = project(2, 94, 2, width, height);
  ctx.beginPath();
  ctx.moveTo(lw_b1.x, lw_b1.y);
  ctx.lineTo(lw_b2.x, lw_b2.y);
  ctx.lineTo(lw_sk2.x, lw_sk2.y);
  ctx.lineTo(lw_sk1.x, lw_sk1.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#0f172a' : '#d4bda4';
  ctx.fill();

  // Left Wall Windows (2 Large Windows with sunlight gradient)
  [ { y1: 18, y2: 36 }, { y1: 52, y2: 74 } ].forEach((win) => {
    const wb1 = project(2, win.y1, 6, width, height);
    const wb2 = project(2, win.y2, 6, width, height);
    const wt2 = project(2, win.y2, 21, width, height);
    const wt1 = project(2, win.y1, 21, width, height);

    ctx.beginPath();
    ctx.moveTo(wb1.x, wb1.y);
    ctx.lineTo(wb2.x, wb2.y);
    ctx.lineTo(wt2.x, wt2.y);
    ctx.lineTo(wt1.x, wt1.y);
    ctx.closePath();

    // Daylight sky gradient
    const skyGrad = ctx.createLinearGradient(wt1.x, wt1.y, wb1.x, wb1.y);
    skyGrad.addColorStop(0, '#7dd3fc');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // White Window frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Window muntin cross
    const wMidY = (win.y1 + win.y2) / 2;
    const wm1 = project(2, wMidY, 6, width, height);
    const wm2 = project(2, wMidY, 21, width, height);
    ctx.beginPath();
    ctx.moveTo(wm1.x, wm1.y);
    ctx.lineTo(wm2.x, wm2.y);
    ctx.stroke();

    // Soft sunlight ray on floor
    const ray1 = project(6, win.y1 - 2, 0, width, height);
    const ray2 = project(18, win.y2 + 6, 0, width, height);
    const ray3 = project(10, win.y2 + 10, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(wb1.x, wb1.y);
    ctx.lineTo(ray1.x, ray1.y);
    ctx.lineTo(ray2.x, ray2.y);
    ctx.lineTo(ray3.x, ray3.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
    ctx.fill();
  });

  // Left Wall Bookshelf (Wall Shelves with books)
  const sb_p1 = project(2, 39, 9, width, height);
  const sb_p2 = project(2, 49, 9, width, height);
  const sb_t2 = project(2, 49, 19, width, height);
  const sb_t1 = project(2, 39, 19, width, height);
  ctx.beginPath();
  ctx.moveTo(sb_p1.x, sb_p1.y);
  ctx.lineTo(sb_p2.x, sb_p2.y);
  ctx.lineTo(sb_t2.x, sb_t2.y);
  ctx.lineTo(sb_t1.x, sb_t1.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#334155' : '#b45309';
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.stroke();

  // Books inside shelf
  const bkColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
  for (let i = 0; i < 4; i++) {
    const bp = project(2.2, 40 + i * 2, 10, width, height);
    ctx.fillStyle = bkColors[i % bkColors.length];
    ctx.fillRect(bp.x - 2, bp.y - 6, 4, 7);
  }

  // 2. BACK WALL (along y=8, x from 2 to 98, z: 0 to 24)
  const bw_b1 = project(2, 8, 0, width, height);
  const bw_b2 = project(98, 8, 0, width, height);
  const bw_t2 = project(98, 8, wallHeight, width, height);
  const bw_t1 = project(2, 8, wallHeight, width, height);

  ctx.beginPath();
  ctx.moveTo(bw_b1.x, bw_b1.y);
  ctx.lineTo(bw_b2.x, bw_b2.y);
  ctx.lineTo(bw_t2.x, bw_t2.y);
  ctx.lineTo(bw_t1.x, bw_t1.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#172033' : '#e6dac8';
  ctx.fill();
  ctx.strokeStyle = isDark ? '#334155' : '#d6c7b2';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wall-Mounted Round Analog Clock (ticking real-time)
  const clockPos = project(48, 8, 17, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(clockPos.x, clockPos.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Clock Hands
  const now = new Date();
  const secAngle = ((now.getSeconds() + tick * 0.05) % 60) * (Math.PI / 30);
  const minAngle = now.getMinutes() * (Math.PI / 30);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(clockPos.x, clockPos.y);
  ctx.lineTo(clockPos.x + Math.sin(secAngle) * 5, clockPos.y - Math.cos(secAngle) * 5);
  ctx.stroke();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(clockPos.x, clockPos.y);
  ctx.lineTo(clockPos.x + Math.sin(minAngle) * 4, clockPos.y - Math.cos(minAngle) * 4);
  ctx.stroke();

  // Wall-Mounted Meeting Display Screen (Big Presentation Monitor in Meeting Room)
  const tv_b1 = project(76, 8, 8, width, height);
  const tv_b2 = project(90, 8, 8, width, height);
  const tv_t2 = project(90, 8, 19, width, height);
  const tv_t1 = project(76, 8, 19, width, height);

  ctx.beginPath();
  ctx.moveTo(tv_b1.x, tv_b1.y);
  ctx.lineTo(tv_b2.x, tv_b2.y);
  ctx.lineTo(tv_t2.x, tv_t2.y);
  ctx.lineTo(tv_t1.x, tv_t1.y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Screen Content (Live Dashboard & Clock 20:03)
  const tvCenter = project(83, 8, 13.5, width, height);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('20:03', tvCenter.x, tvCenter.y - 1);
  ctx.fillStyle = '#34d399';
  ctx.font = '6px sans-serif';
  ctx.fillText('● LIVE BRIEFING', tvCenter.x, tvCenter.y + 5);
}

function drawDioramaFurniture(ctx, width, height, project, isDark, isNight, tick) {
  // 1. GLASS PARTITION WALL (Ruang Meeting Industrial Steel Frame)
  // Divides Meeting room from Central area (x from 68 to 97 along y=38, z: 0 to 18)
  const gp_b1 = project(68, 38, 0, width, height);
  const gp_b2 = project(97, 38, 0, width, height);
  const gp_t2 = project(97, 38, 18, width, height);
  const gp_t1 = project(68, 38, 18, width, height);

  ctx.beginPath();
  ctx.moveTo(gp_b1.x, gp_b1.y);
  ctx.lineTo(gp_b2.x, gp_b2.y);
  ctx.lineTo(gp_t2.x, gp_t2.y);
  ctx.lineTo(gp_t1.x, gp_t1.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Glass grid vertical mullions
  for (let gx = 75; gx <= 90; gx += 7.5) {
    const gb = project(gx, 38, 0, width, height);
    const gt = project(gx, 38, 18, width, height);
    ctx.beginPath();
    ctx.moveTo(gb.x, gb.y);
    ctx.lineTo(gt.x, gt.y);
    ctx.stroke();
  }

  // Ruang Meeting Signage Tag above glass door
  const signPos = project(72, 38, 19.5, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(signPos.x - 22, signPos.y - 6, 44, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏢 Ruang Meeting', signPos.x, signPos.y + 2.5);

  // 2. RUANG MEETING CONFERENCE TABLE & CHAIRS (Inside Glass Room, x: 83, y: 24)
  drawConferenceSuite(ctx, width, height, project, 83, 24, isDark);

  // 3. Potted Fiddle Leaf Fig Plant in Meeting Room corner
  drawPottedPlant(ctx, width, height, project, 94, 14, 12);

  // 4. SOFA LOUNGE & COLORFUL ARMCHAIRS (x: 28..44, y: 34..44)
  drawLoungeSuite(ctx, width, height, project, isDark);

  // 5. POJOK KOPI / ESPRESSO BAR COUNTER (x: 58, y: 22)
  drawPojokKopiBar(ctx, width, height, project, 58, 22, isDark);

  // 6. JIG DEVELOPMENT WORKBENCH (x: 39, y: 18)
  drawJigWorkbench(ctx, width, height, project, 39, 18, isDark);

  // 7. LAB SOFTWARE SERVER RACK (x: 85, y: 66)
  drawServerRack(ctx, width, height, project, 85, 66, tick, isDark);

  // 8. ENGINEERING WORKSTATION DESKS
  // PE Production (x: 7.5..17.5, y: 53..69) + Manager (x: 12.5, y: 83.5)
  drawTeamWorkstations(ctx, width, height, project, 7.5, 53, 5, 8, 3, 3, 12.5, 83.5, '#3b82f6', isDark, isNight);

  // PE Mecha (x: 25.5..35.5, y: 53..69) + Manager (x: 30.5, y: 83.5)
  drawTeamWorkstations(ctx, width, height, project, 25.5, 53, 5, 8, 3, 3, 30.5, 83.5, '#10b981', isDark, isNight);

  // PE Solution (x: 43.5..53.5, y: 53..69) + Manager (x: 48.5, y: 83.5)
  drawTeamWorkstations(ctx, width, height, project, 43.5, 53, 5, 8, 3, 3, 48.5, 83.5, '#8b5cf6', isDark, isNight);

  // PE Executive Management (Korean Dispatcher x: 63.5, y: 60 & Group Leader x: 63.5, y: 80)
  drawExecutiveBossDesks(ctx, width, height, project, isDark, isNight);

  // 9. Standing Coat & Umbrella Rack
  drawCoatHanger(ctx, width, height, project, 50, 48);

  // 10. Cute Sleeping Office Cat on rug
  drawOfficeCat(ctx, width, height, project, 42, 38, tick);
}

function drawConferenceSuite(ctx, width, height, project, cx, cy, isDark) {
  // Conference Room Rug
  const r1 = project(cx - 10, cy - 7, 0, width, height);
  const r2 = project(cx + 10, cy - 7, 0, width, height);
  const r3 = project(cx + 10, cy + 7, 0, width, height);
  const r4 = project(cx - 10, cy + 7, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(r1.x, r1.y);
  ctx.lineTo(r2.x, r2.y);
  ctx.lineTo(r3.x, r3.y);
  ctx.lineTo(r4.x, r4.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(219, 234, 254, 0.6)';
  ctx.fill();

  // Conference Table Top (Long Capsule with Mahogany Finish)
  const pos = project(cx, cy, 3, width, height);
  const tWidth = 38;
  const tHeight = 16;
  ctx.fillStyle = isDark ? '#311042' : '#854d0e';
  ctx.beginPath();
  ctx.roundRect(pos.x - tWidth / 2, pos.y - tHeight / 2, tWidth, tHeight, 8);
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Center cable trough
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pos.x - 8, pos.y - 1.5, 16, 3);

  // 6 Executive Conference Chairs (3 Top, 3 Bottom)
  [-11, 0, 11].forEach((offsetX) => {
    // Top Chair
    const chTop = project(cx + offsetX * 0.7, cy - 5.5, 0, width, height);
    drawMeshChair(ctx, chTop.x, chTop.y, 1);

    // Bottom Chair
    const chBot = project(cx + offsetX * 0.7, cy + 5.5, 0, width, height);
    drawMeshChair(ctx, chBot.x, chBot.y, -1);
  });
}

function drawMeshChair(ctx, x, y, dir = 1) {
  // Chrome swivel base
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(x, y + dir * 1, 3, 0, Math.PI * 2);
  ctx.fill();

  // Black mesh seat cushion
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 4, y - 3, 8, 6);

  // Ergonomic curved backrest
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - dir * 3);
  ctx.lineTo(x + 4, y - dir * 3);
  ctx.stroke();
}

function drawLoungeSuite(ctx, width, height, project, isDark) {
  // Circular Lounge Area Rug
  const rugPos = project(34, 40, 0, width, height);
  ctx.fillStyle = isDark ? 'rgba(51, 65, 85, 0.4)' : '#fef3c7';
  ctx.beginPath();
  ctx.ellipse(rugPos.x, rugPos.y, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Modern 2-Seater Sofa Couch (Soft Beige/Cream)
  const sofaPos = project(30, 36, 1.5, width, height);
  ctx.fillStyle = isDark ? '#334155' : '#e2e8f0';
  ctx.fillRect(sofaPos.x - 16, sofaPos.y - 6, 32, 12);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(sofaPos.x - 16, sofaPos.y - 6, 32, 12);

  // Sofa backrest
  ctx.fillStyle = isDark ? '#1e293b' : '#cbd5e1';
  ctx.fillRect(sofaPos.x - 16, sofaPos.y - 11, 32, 5);

  // Low Coffee Table with Laptop & Mug
  const ctPos = project(34, 40, 2, width, height);
  ctx.fillStyle = isDark ? '#451a03' : '#b45309';
  ctx.beginPath();
  ctx.roundRect(ctPos.x - 10, ctPos.y - 5, 20, 10, 3);
  ctx.fill();
  // Laptop on coffee table
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(ctPos.x - 3, ctPos.y - 3, 6, 4);

  // 3 Colorful Mid-Century Armchairs (Mustard, Sage, Coral)
  const chairs = [
    { x: 38, y: 35, color: '#eab308' }, // Mustard Yellow
    { x: 41, y: 41, color: '#84cc16' }, // Sage Green
    { x: 32, y: 44, color: '#f97316' }, // Coral Orange
  ];
  chairs.forEach((ch) => {
    const cp = project(ch.x, ch.y, 1, width, height);
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  // Tall Standing Floor Lamp
  const lampPos = project(24, 34, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(lampPos.x, lampPos.y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  const lampHead = project(24, 34, 18, width, height);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(lampPos.x, lampPos.y);
  ctx.lineTo(lampHead.x, lampHead.y);
  ctx.stroke();

  // Conical Glowing Shade
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(lampHead.x - 5, lampHead.y + 4);
  ctx.lineTo(lampHead.x + 5, lampHead.y + 4);
  ctx.lineTo(lampHead.x + 2, lampHead.y - 4);
  ctx.lineTo(lampHead.x - 2, lampHead.y - 4);
  ctx.closePath();
  ctx.fill();
}

function drawPojokKopiBar(ctx, width, height, project, cx, cy, isDark) {
  // High Wooden Bar Counter
  const barPos = project(cx, cy, 2, width, height);
  ctx.fillStyle = isDark ? '#451a03' : '#78350f';
  ctx.fillRect(barPos.x - 16, barPos.y - 7, 32, 14);
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(barPos.x - 16, barPos.y - 7, 32, 14);

  // Chrome Espresso Machine on counter
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(barPos.x - 12, barPos.y - 5, 8, 8);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(barPos.x - 8, barPos.y - 2, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Water Dispenser with Blue Gallon
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(barPos.x + 6, barPos.y - 6, 6, 10);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(barPos.x + 9, barPos.y - 8, 3, 0, Math.PI * 2);
  ctx.fill();

  // 2 Wooden Bar Stools in front
  [-6, 6].forEach((stX) => {
    const sp = project(cx + stX * 0.8, cy + 8, 0, width, height);
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.stroke();
  });

  // Signage Pill "☕ Pojok Kopi"
  const tagPos = project(cx, cy, 14, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(tagPos.x - 18, tagPos.y - 5, 36, 10, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 6.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('☕ Pojok Kopi', tagPos.x, tagPos.y + 2.5);
}

function drawJigWorkbench(ctx, width, height, project, cx, cy, isDark) {
  const benchPos = project(cx, cy, 2, width, height);
  ctx.fillStyle = isDark ? '#064e3b' : '#a7f3d0';
  ctx.fillRect(benchPos.x - 14, benchPos.y - 7, 28, 14);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(benchPos.x - 14, benchPos.y - 7, 28, 14);

  // Fixture Baseplate & Clamps
  ctx.fillStyle = '#047857';
  ctx.fillRect(benchPos.x - 7, benchPos.y - 3, 14, 6);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(benchPos.x - 4, benchPos.y, 1.8, 0, Math.PI * 2);
  ctx.arc(benchPos.x + 4, benchPos.y, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Sublabel
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚙️ JIG DEV', benchPos.x, benchPos.y + 11);
}

function drawServerRack(ctx, width, height, project, cx, cy, tick, isDark) {
  const rackPos = project(cx, cy, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(rackPos.x - 8, rackPos.y - 16, 16, 22);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(rackPos.x - 8, rackPos.y - 16, 16, 22);

  const led1 = Math.sin(tick * 0.1) > 0 ? '#10b981' : '#047857';
  const led2 = Math.cos(tick * 0.15) > 0 ? '#38bdf8' : '#1d4ed8';
  ctx.fillStyle = led1;
  ctx.fillRect(rackPos.x - 5, rackPos.y - 11, 3, 2.5);
  ctx.fillStyle = led2;
  ctx.fillRect(rackPos.x + 2, rackPos.y - 11, 3, 2.5);
}

function drawTeamWorkstations(ctx, width, height, project, startX, startY, colStep, rowStep, cols, rows, leaderX, leaderY, color, isDark, isNight) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = project(startX + c * colStep, startY + r * rowStep, 0, width, height);
      drawSingleModernDesk(ctx, pos.x, pos.y, color, isDark, isNight, false);
    }
  }
  const leaderPos = project(leaderX, leaderY, 0, width, height);
  drawSingleModernDesk(ctx, leaderPos.x, leaderPos.y, color, isDark, isNight, true);
}

function drawSingleModernDesk(ctx, x, y, tagColor, isDark, isNight, isManager) {
  const deskWidth = isManager ? 24 : 17;
  const deskHeight = isManager ? 10 : 8;

  // Wooden Desk Top with chamfered edge
  ctx.fillStyle = isDark
    ? (isNight ? '#1e293b' : '#334155')
    : (isNight ? '#78350f' : '#f5e0c3');
  ctx.fillRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  ctx.strokeStyle = tagColor;
  ctx.lineWidth = isManager ? 1.5 : 0.8;
  ctx.strokeRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  // Dual Curved Monitors with blue/cyan glowing screens
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 6, y - deskHeight / 2 - 4, 6, 3.5);
  ctx.fillRect(x + 1, y - deskHeight / 2 - 4, 6, 3.5);

  ctx.fillStyle = isNight ? 'rgba(56, 189, 248, 0.4)' : '#38bdf8';
  ctx.fillRect(x - 5.5, y - deskHeight / 2 - 3.5, 5, 2);
  ctx.fillRect(x + 1.5, y - deskHeight / 2 - 3.5, 5, 2);

  // Ergonomic Task Chair behind desk
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(x, y + deskHeight / 2 + 2, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (isManager) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👔', x, y + 2);
  }
}

function drawExecutiveBossDesks(ctx, width, height, project, isDark, isNight) {
  // 1. Dispatcher / Expatriat Korea Desk (x: 63.5, y: 60)
  const dPos = project(63.5, 60, 0, width, height);
  drawBossDeskItem(ctx, dPos.x, dPos.y, '#e11d48', isDark, isNight, '🇰🇷 DISPATCHER', true);

  // 2. Group Leader / Group Manager Desk (x: 63.5, y: 80)
  const glPos = project(63.5, 80, 0, width, height);
  drawBossDeskItem(ctx, glPos.x, glPos.y, '#f59e0b', isDark, isNight, '👔 GROUP LEADER', false);
}

function drawBossDeskItem(ctx, x, y, accentColor, isDark, isNight, labelText, isKorean) {
  const deskWidth = 26;
  const deskHeight = 11;

  ctx.fillStyle = isDark
    ? (isNight ? '#1e1b4b' : '#311042')
    : (isNight ? '#451a03' : '#78350f');
  ctx.fillRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  // Dual Screens + Laptop
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 10, y - deskHeight / 2 - 4, 8, 4);
  ctx.fillRect(x + 2, y - deskHeight / 2 - 4, 8, 4);
  ctx.fillStyle = isKorean ? '#38bdf8' : '#34d399';
  ctx.fillRect(x - 9, y - deskHeight / 2 - 3, 6, 2);
  ctx.fillRect(x + 3, y - deskHeight / 2 - 3, 6, 2);

  // Executive Leather Swivel Chair
  ctx.fillStyle = isDark ? '#020617' : '#1e293b';
  ctx.beginPath();
  ctx.arc(x, y + 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Desk Plate Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(labelText, x, y + 2.5);
}

function drawPottedPlant(ctx, width, height, project, x, y, size = 10) {
  const p = project(x, y, 0, width, height);
  // White ceramic pot
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(p.x - 4, p.y - 4, 8, 7);
  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(p.x - 4, p.y - 4, 8, 7);

  // Lush green leaves (Monstera / Fig)
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 8, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(p.x - 2, p.y - 9, size * 0.45, 0, Math.PI * 2);
  ctx.arc(p.x + 3, p.y - 7, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoatHanger(ctx, width, height, project, x, y) {
  const base = project(x, y, 0, width, height);
  const top = project(x, y, 16, width, height);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();

  // Pegs
  ctx.beginPath();
  ctx.moveTo(top.x - 3, top.y + 2);
  ctx.lineTo(top.x + 3, top.y - 2);
  ctx.moveTo(top.x + 3, top.y + 2);
  ctx.lineTo(top.x - 3, top.y - 2);
  ctx.stroke();
}

function drawOfficeCat(ctx, width, height, project, x, y, tick) {
  const p = project(x, y, 0, width, height);
  // Mini rug
  ctx.fillStyle = 'rgba(254, 215, 170, 0.6)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orange sleeping cat with breathing animation
  const breath = Math.sin(tick * 0.08) * 0.5;
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 1, 3.5, 2.5 + breath, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.moveTo(p.x - 2, p.y - 3);
  ctx.lineTo(p.x - 1, p.y - 5);
  ctx.lineTo(p.x, p.y - 3);
  ctx.fill();
}

// 3D AVATAR & FLOATING STATUS PILL TAG (Matching exact reference image)
function drawAvatar(ctx, pos, eng, state, isHovered, isSelected, matchesFilter, tick, isNight, zoom) {
  ctx.save();
  ctx.translate(pos.x, pos.y);

  const opacity = matchesFilter ? 1 : 0.25;
  ctx.globalAlpha = opacity;

  const bobY = state.isMoving ? Math.sin(state.walkFrame * 2) * 2.8 : Math.sin(tick * 0.05 + eng.id) * 0.6;
  const legSwing = state.isMoving ? Math.sin(state.walkFrame * 2) * 3 : 0;

  // Selection Glow / Target Ring
  if (isSelected) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fill();
  } else if (isHovered) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Animated Legs (Walking)
  if (state.isMoving) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -5 + bobY);
    ctx.lineTo(-2 - legSwing, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -5 + bobY);
    ctx.lineTo(2 + legSwing, 0);
    ctx.stroke();
  }

  // Character Body & Head
  const bodyY = -12 + bobY;
  ctx.fillStyle = eng.avatarColor || '#3b82f6';
  ctx.beginPath();
  ctx.arc(0, bodyY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Torso / Shirt
  let shirtColor = '#3b82f6';
  if (eng.team === TEAMS.MECHA) shirtColor = '#10b981';
  else if (eng.team === TEAMS.SOLUTION) shirtColor = '#8b5cf6';
  else if (eng.team === TEAMS.MANAGEMENT) shirtColor = '#e11d48';

  ctx.fillStyle = shirtColor;
  ctx.fillRect(-3.5, bodyY + 5.5, 7, 6.5);

  // ========================================================
  // FLOATING 3D STATUS PILL BUBBLE (Exact match to reference image)
  // Format: "● Name (Role) Activity"
  // E.g.: "● Arka (HQ) jalanin perintah", "● Fajar (RB) baca kode"
  // ========================================================
  const firstName = eng.name.split(' ')[0];
  let roleCode = 'PR';
  if (eng.team === TEAMS.MECHA) roleCode = 'MC';
  else if (eng.team === TEAMS.SOLUTION) roleCode = 'SL';
  else if (eng.team === TEAMS.MANAGEMENT) roleCode = eng.id === 31 ? 'EXP' : 'GL';

  let shortAction = 'fokus kerja';
  if (eng.currentActivity) {
    if (eng.currentActivity.includes('Pantry') || eng.currentActivity.includes('kopi')) shortAction = 'seduh kopi';
    else if (eng.currentActivity.includes('Toilet')) shortAction = 'ke toilet';
    else if (eng.currentActivity.includes('Lab Software') || eng.currentActivity.includes('Flashing')) shortAction = 'ngoding / flash';
    else if (eng.currentActivity.includes('JIG') || eng.currentActivity.includes('Fixture')) shortAction = 'rakit JIG';
    else if (eng.currentActivity.includes('Analisa') || eng.currentActivity.includes('Failure')) shortAction = 'cek analisa';
    else if (eng.currentActivity.includes('Clock out')) shortAction = 'pulang';
    else if (eng.isLeader) shortAction = 'jalanin briefing';
    else shortAction = 'baca kode / tugas';
  }

  const pillText = `${firstName} (${roleCode}) ${shortAction}`;
  ctx.font = 'bold 7.5px sans-serif';
  const textWidth = ctx.measureText(pillText).width;
  const pillWidth = textWidth + 18;
  const pillHeight = 13;
  const pillY = bodyY - 17;

  // Pill Background
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.roundRect(-pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 999);
  ctx.fill();

  // Subtle border & shadow
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Downward Caret Triangle pointing to head
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.moveTo(-2.5, pillY + pillHeight / 2);
  ctx.lineTo(2.5, pillY + pillHeight / 2);
  ctx.lineTo(0, pillY + pillHeight / 2 + 2.5);
  ctx.closePath();
  ctx.fill();

  // Dot indicator
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-pillWidth / 2 + 6, pillY, 2, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(pillText, -pillWidth / 2 + 11, pillY + 2.5);

  ctx.restore();
}

export default VirtualOfficeCanvas;
