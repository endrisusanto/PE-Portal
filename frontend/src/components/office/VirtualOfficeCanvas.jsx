// VirtualOfficeCanvas.jsx
// Interactive 3D Canvas Engine with Full 360° Orbit, Tilt, Smooth Zoom,
// Corridor Waypoint Pathfinding (Real Walking), and Human-like Behavioral Dynamics.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, Minimize2, Compass, Move, ArrowUp, ArrowDown } from 'lucide-react';
import { TEAMS, ZONES } from './virtualOfficeData';

export const VirtualOfficeCanvas = ({
  engineers = [],
  activePhase,
  selectedEngineer,
  onSelectEngineer,
  filterTeam = 'ALL',
  isDarkMode = false,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredEngineer, setHoveredEngineer] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 3D Camera State: Orbit Yaw, Pitch Tilt, Zoom, Pan
  const cameraRef = useRef({
    yaw: 0,            // Rotation around center (radians)
    pitch: 0.65,       // Tilt angle (~37 degrees elevation)
    zoom: 1.0,         // Zoom factor (0.5 to 2.8)
    pan: { x: 0, y: 0 },
    isDragging: false,
    dragMode: 'rotate', // 'rotate' or 'pan'
    lastMouse: { x: 0, y: 0 },
  });

  const [cameraDisplay, setCameraDisplay] = useState({ yawDeg: 0, pitchDeg: 37, zoomPct: 100 });

  // Persistent avatar states with waypoint queues for real corridor walking
  const avatarStatesRef = useRef({});

  // Corridor Y line
  const CORRIDOR_Y = 43;

  // Path generator: Creates hallway waypoints so characters don't cut through walls
  const generateHallwayPath = (startX, startY, targetX, targetY) => {
    const dist = Math.hypot(targetX - startX, targetY - startY);
    // If target is very close (e.g. within same area), walk directly
    if (dist < 4) {
      return [{ x: targetX, y: targetY }];
    }

    const path = [];

    // Step 1: Step out of room into the corridor
    if (startY > 48) {
      path.push({ x: startX, y: 48 });
      path.push({ x: startX, y: CORRIDOR_Y });
    } else if (startY < 38) {
      path.push({ x: startX, y: 38 });
      path.push({ x: startX, y: CORRIDOR_Y });
    }

    // Step 2: Walk along corridor horizontally
    path.push({ x: targetX, y: CORRIDOR_Y });

    // Step 3: Turn into destination room
    if (targetY > 48) {
      path.push({ x: targetX, y: 48 });
    } else if (targetY < 38) {
      path.push({ x: targetX, y: 38 });
    }

    // Step 4: Final spot
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
          speed: 0.18 + (eng.id % 5) * 0.03, // Slight human speed variance
          walkFrame: Math.random() * 10,
          isMoving: false,
          facing: 1, // 1 for right, -1 for left
        };
        avatarStatesRef.current[eng.id] = state;
      } else {
        // If target changed, plan realistic corridor path
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
    const baseScale = Math.min(width, height) * 0.0078 * cam.zoom;
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

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      const isNight = activePhase?.type === 'off';
      const bgColor = isDarkMode
        ? (isNight ? '#070b14' : '#0f172a')
        : (isNight ? '#1e293b' : '#f8fafc');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Office Floor & Grid
      drawOfficeFloor(ctx, width, height, project3D, isDarkMode, isNight);

      // 2. Draw Rooms (Meeting 1-3, Storage, Labs, Toilets, Gaming Room, Teams)
      drawFloorPlanRooms(ctx, width, height, project3D, isDarkMode, isNight, tick);

      // 3. Draw Workstation Desks + Leader Desks
      drawWorkstationDesks(ctx, width, height, project3D, isDarkMode, isNight);

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
            state.waypoints.shift(); // Reached waypoint, advance to next
          }
        } else {
          // Slight lerp to settle cleanly
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

      // 5. Draw 30 Avatars (Sorted by 3D Camera Depth for accurate occlusion)
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

        drawAvatar(ctx, pos, eng, state, isHovered, isSelected, matchesFilter, tick, isNight, cameraRef.current.zoom);
      });

      // 6. Night Dim Overlay
      if (isNight) {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.35)';
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [engineers, activePhase, selectedEngineer, hoveredEngineer, filterTeam, isDarkMode, project3D]);

  // Resize handler: scales canvas buffer matching container with devicePixelRatio
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }, []);

  // Handle Resize for sharp DPI with ResizeObserver + Fullscreen listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    handleResize();

    // ResizeObserver watches container element size changes dynamically (including fullscreen, grid, sidebar)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    const onFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // Give browser time to update layout, then adapt canvas dimensions
      requestAnimationFrame(() => {
        handleResize();
        setTimeout(handleResize, 100);
      });
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
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
      if (dist < 20 * cam.zoom) {
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

  const handleClick = (e) => {
    if (hoveredEngineer) {
      onSelectEngineer?.(hoveredEngineer);
    } else if (!cameraRef.current.isDragging) {
      onSelectEngineer?.(null);
    }
  };

  // Camera Helper Controls
  const rotateLeft = () => {
    cameraRef.current.yaw -= Math.PI / 8;
    setCameraDisplay((prev) => ({ ...prev, yawDeg: Math.round(((cameraRef.current.yaw * 180) / Math.PI) % 360) }));
  };
  const rotateRight = () => {
    cameraRef.current.yaw += Math.PI / 8;
    setCameraDisplay((prev) => ({ ...prev, yawDeg: Math.round(((cameraRef.current.yaw * 180) / Math.PI) % 360) }));
  };
  const tiltUp = () => {
    cameraRef.current.pitch = Math.max(0.25, cameraRef.current.pitch - 0.1);
    setCameraDisplay((prev) => ({ ...prev, pitchDeg: Math.round((cameraRef.current.pitch * 180) / Math.PI) }));
  };
  const tiltDown = () => {
    cameraRef.current.pitch = Math.min(1.35, cameraRef.current.pitch + 0.1);
    setCameraDisplay((prev) => ({ ...prev, pitchDeg: Math.round((cameraRef.current.pitch * 180) / Math.PI) }));
  };
  const zoomIn = () => {
    cameraRef.current.zoom = Math.min(2.8, cameraRef.current.zoom + 0.2);
    setCameraDisplay((prev) => ({ ...prev, zoomPct: Math.round(cameraRef.current.zoom * 100) }));
  };
  const zoomOut = () => {
    cameraRef.current.zoom = Math.max(0.5, cameraRef.current.zoom - 0.2);
    setCameraDisplay((prev) => ({ ...prev, zoomPct: Math.round(cameraRef.current.zoom * 100) }));
  };
  const resetCamera = () => {
    cameraRef.current.yaw = 0;
    cameraRef.current.pitch = 0.65;
    cameraRef.current.zoom = 1.0;
    cameraRef.current.pan = { x: 0, y: 0 };
    setCameraDisplay({ yawDeg: 0, pitchDeg: 37, zoomPct: 100 });
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch((err) => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.error('Exit fullscreen error:', err);
      });
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '620px',
        maxWidth: isFullscreen ? '100vw' : '100%',
        maxHeight: isFullscreen ? '100vh' : 'none',
        borderRadius: isFullscreen ? '0' : '12px',
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid var(--color-border)',
        boxShadow: isFullscreen ? 'none' : '0 8px 24px rgba(0,0,0,0.12)',
        backgroundColor: isDarkMode
          ? (activePhase?.type === 'off' ? '#070b14' : '#0f172a')
          : (activePhase?.type === 'off' ? '#1e293b' : '#f8fafc'),
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
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '8px',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#f8fafc',
          fontSize: '11px',
          zIndex: 5,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <Compass size={13} color="#38bdf8" /> 3D Orbit: {cameraDisplay.yawDeg}°
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <span>Tilt: {cameraDisplay.pitchDeg}°</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <span>Zoom: {cameraDisplay.zoomPct}%</span>
      </div>

      {/* 3D Action Controls (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '8px',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.15)',
          zIndex: 5,
        }}
      >
        <button onClick={rotateLeft} title="Putar Kiri 3D" style={toolbarBtnStyle}><RotateCcw size={14} /></button>
        <button onClick={rotateRight} title="Putar Kanan 3D" style={toolbarBtnStyle}><RotateCw size={14} /></button>
        <button onClick={tiltUp} title="Tilt Atas" style={toolbarBtnStyle}><ArrowUp size={14} /></button>
        <button onClick={tiltDown} title="Tilt Bawah" style={toolbarBtnStyle}><ArrowDown size={14} /></button>
        <button onClick={zoomIn} title="Zoom In" style={toolbarBtnStyle}><ZoomIn size={14} /></button>
        <button onClick={zoomOut} title="Zoom Out" style={toolbarBtnStyle}><ZoomOut size={14} /></button>
        <button onClick={resetCamera} title="Sudut Awal (Reset)" style={{ ...toolbarBtnStyle, fontSize: '11px', padding: '4px 8px' }}>Sudut Awal</button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Keluar Layar Penuh (Esc)' : 'Layar Penuh (Full Screen)'}
          style={toolbarBtnStyle}
        >
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
          fontSize: '10px',
          pointerEvents: 'none',
          backgroundColor: 'rgba(0,0,0,0.3)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}
      >
        🖱️ Drag = Putar 360° & Tilt • Scroll = Zoom • Shift+Drag = Geser • Klik = Info
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredEngineer && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: '12px',
            right: '12px',
            padding: '10px 14px',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#f8fafc',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            zIndex: 10,
            backdropFilter: 'blur(6px)',
            maxWidth: '280px',
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
              {hoveredEngineer.name} {hoveredEngineer.isLeader && '👔 (MANAGER)'}
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
};

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
// 3D DRAWING FUNCTIONS
// ==========================================

function drawOfficeFloor(ctx, width, height, project, isDark, isNight) {
  // Main Office Base Polygon (x: 2..98, y: 8..94)
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

  ctx.fillStyle = isDark
    ? (isNight ? '#0b1120' : '#1e293b')
    : (isNight ? '#334155' : '#f8fafc');
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
  ctx.stroke();

  // Central Corridor (x: 11..98, y: 38..48)
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
  ctx.fillStyle = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)';
  ctx.fill();
}

function drawFloorPlanRooms(ctx, width, height, project, isDark, isNight, tick) {
  // Top Row Rooms
  drawRoomBox(ctx, width, height, project, { x1: 3, y1: 10, x2: 15, y2: 38 }, 'MEETING 1', '#8b5cf6', isDark, () => {
    drawMiniTable(ctx, width, height, project, 9, 24, 12, 7, '#a78bfa');
  });

  drawRoomBox(ctx, width, height, project, { x1: 15, y1: 10, x2: 27, y2: 38 }, 'MEETING 2', '#8b5cf6', isDark, () => {
    drawMiniTable(ctx, width, height, project, 21, 24, 12, 7, '#a78bfa');
  });

  drawRoomBox(ctx, width, height, project, { x1: 27, y1: 10, x2: 39, y2: 38 }, 'MEETING 3', '#8b5cf6', isDark, () => {
    drawMiniTable(ctx, width, height, project, 33, 24, 12, 7, '#a78bfa');
  });

  drawRoomBox(ctx, width, height, project, { x1: 39, y1: 10, x2: 50, y2: 38 }, 'UNITBOX STORAGE', '#f59e0b', isDark, () => {
    const pos = project(44.5, 24, 0, width, height);
    ctx.fillStyle = '#d97706';
    ctx.fillText('📦 UNITBOX', pos.x, pos.y);
  });

  drawRoomBox(ctx, width, height, project, { x1: 50, y1: 10, x2: 60, y2: 38 }, 'SAMPLE STORAGE', '#f59e0b', isDark, () => {
    const pos = project(55, 24, 0, width, height);
    ctx.fillStyle = '#d97706';
    ctx.fillText('📱 SAMPLES', pos.x, pos.y);
  });

  // Stairs / Area Tangga between Sample Storage and Lab Analisa (matching architectural blueprint)
  drawStairs(ctx, width, height, project, 60, 66, 10, 38, isDark);

  // Lab Analisa (x1: 66, y1: 10, x2: 78, y2: 38)
  drawRoomBox(ctx, width, height, project, { x1: 66, y1: 10, x2: 78, y2: 38 }, 'LAB ANALISA', '#10b981', isDark, () => {
    const scopePos = project(72, 20, 0, width, height);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(scopePos.x - 12, scopePos.y - 10, 24, 14);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(scopePos.x - 8, scopePos.y - 3);
    ctx.lineTo(scopePos.x - 3, scopePos.y - 8);
    ctx.lineTo(scopePos.x + 2, scopePos.y - 1);
    ctx.lineTo(scopePos.x + 7, scopePos.y - 6);
    ctx.stroke();

    const lbl = project(72, 33, 0, width, height);
    ctx.fillStyle = '#059669';
    ctx.font = '8px sans-serif';
    ctx.fillText('🔬 SCOPE', lbl.x, lbl.y);
  });

  // Dedicated PANTRY (Coffee, Espresso, Sink, Water Dispenser) (x1: 78, y1: 10, x2: 88, y2: 38)
  drawRoomBox(ctx, width, height, project, { x1: 78, y1: 10, x2: 88, y2: 38 }, 'PANTRY', '#f59e0b', isDark, () => {
    // 1. Countertop Bar
    const barPos = project(83, 20, 0, width, height);
    ctx.fillStyle = isDark ? '#451a03' : '#fed7aa';
    ctx.fillRect(barPos.x - 14, barPos.y - 8, 28, 12);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(barPos.x - 14, barPos.y - 8, 28, 12);

    // 2. Coffee Espresso Machine with Steam
    const coffeePos = project(81, 18, 0, width, height);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(coffeePos.x - 5, coffeePos.y - 12, 10, 10);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(coffeePos.x - 3, coffeePos.y - 10, 6, 3);
    ctx.font = '9px sans-serif';
    ctx.fillText('☕', coffeePos.x, coffeePos.y + 1);

    // Animated steam rising
    const steamY = Math.sin(tick * 0.15) * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(coffeePos.x - 1, coffeePos.y - 14 + steamY, 1.4, 0, Math.PI * 2);
    ctx.arc(coffeePos.x + 2, coffeePos.y - 17 - steamY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Water Dispenser (Galon Biru & Tap)
    const dispenserPos = project(86, 18, 0, width, height);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(dispenserPos.x - 4, dispenserPos.y - 8, 8, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(dispenserPos.x, dispenserPos.y - 10, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Sublabel
    const subLbl = project(83, 33, 0, width, height);
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('☕ REFRESHMENT', subLbl.x, subLbl.y);
  });

  // Toilet Pria (x1: 88, y1: 10, x2: 97, y2: 38)
  drawRoomBox(ctx, width, height, project, { x1: 88, y1: 10, x2: 97, y2: 38 }, 'TOILET PRIA', '#64748b', isDark, () => {
    const pos = project(92.5, 24, 0, width, height);
    ctx.fillText('🚹 WC', pos.x, pos.y);
  });

  // Entrance
  drawRoomBox(ctx, width, height, project, { x1: 2, y1: 38, x2: 11, y2: 48 }, 'PINTU MASUK', '#10b981', isDark, () => {
    const pos = project(6.5, 43, 0, width, height);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('🚪 ENTRANCE', pos.x, pos.y);
  });

  // Bottom Row Rooms: 3 Divisions + Dedicated MANAGER Zone + EXECUTIVE MANAGEMENT
  drawTeamZoneBox(ctx, width, height, project, 3, 21, 48, 76, 92, 'PE PRODUCTION', '#3b82f6', isDark);
  drawTeamZoneBox(ctx, width, height, project, 21, 39, 48, 76, 92, 'PE MECHA', '#10b981', isDark);
  drawTeamZoneBox(ctx, width, height, project, 39, 57, 48, 76, 92, 'PE SOLUTION', '#8b5cf6', isDark);

  // Dedicated EXECUTIVE MANAGEMENT Office (Korean Dispatcher & PE Group Leader)
  drawExecutiveOfficeBox(ctx, width, height, project, 57, 70, 48, 92, isDark);

  drawRoomBox(ctx, width, height, project, { x1: 70, y1: 48, x2: 81, y2: 92 }, 'GAMING ROOM', '#ec4899', isDark, () => {
    const arcPos = project(73, 56, 0, width, height);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(arcPos.x - 8, arcPos.y - 14, 16, 20);
    ctx.fillStyle = '#ec4899';
    ctx.fillText('🕹️', arcPos.x - 6, arcPos.y - 2);

    const loungePos = project(76, 78, 0, width, height);
    ctx.fillStyle = isDark ? '#334155' : '#e2e8f0';
    ctx.fillRect(loungePos.x - 12, loungePos.y - 10, 24, 14);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1;
    ctx.strokeRect(loungePos.x - 12, loungePos.y - 10, 24, 14);
    ctx.fillStyle = '#ec4899';
    ctx.font = '8px sans-serif';
    ctx.fillText('🛋️ LOUNGE', loungePos.x, loungePos.y + 1);
  });

  drawRoomBox(ctx, width, height, project, { x1: 81, y1: 48, x2: 89, y2: 92 }, 'LAB SOFTWARE', '#3b82f6', isDark, () => {
    const rackPos = project(85, 66, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rackPos.x - 10, rackPos.y - 18, 20, 24);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(rackPos.x - 10, rackPos.y - 18, 20, 24);

    const led1 = Math.sin(tick * 0.1) > 0 ? '#10b981' : '#047857';
    const led2 = Math.cos(tick * 0.15) > 0 ? '#38bdf8' : '#1d4ed8';
    ctx.fillStyle = led1;
    ctx.fillRect(rackPos.x - 6, rackPos.y - 12, 4, 3);
    ctx.fillStyle = led2;
    ctx.fillRect(rackPos.x + 2, rackPos.y - 12, 4, 3);
  });

  drawRoomBox(ctx, width, height, project, { x1: 89, y1: 48, x2: 97, y2: 92 }, 'TOILET WANITA', '#64748b', isDark, () => {
    const pos = project(93, 70, 0, width, height);
    ctx.fillText('🚺 WC', pos.x, pos.y);
  });
}

function drawRoomBox(ctx, width, height, project, bounds, title, accentColor, isDark, customDraw) {
  const p1 = project(bounds.x1, bounds.y1, 0, width, height);
  const p2 = project(bounds.x2, bounds.y1, 0, width, height);
  const p3 = project(bounds.x2, bounds.y2, 0, width, height);
  const p4 = project(bounds.x1, bounds.y2, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();

  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.85)';
  ctx.fill();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  const labelPos = project((bounds.x1 + bounds.x2) / 2, bounds.y1 + 3, 0, width, height);
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, labelPos.x, labelPos.y);

  if (customDraw) customDraw();
}

function drawStairs(ctx, width, height, project, x1, x2, y1, y2, isDark) {
  const p1 = project(x1, y1, 0, width, height);
  const p2 = project(x2, y1, 0, width, height);
  const p3 = project(x2, y2, 0, width, height);
  const p4 = project(x1, y2, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();

  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.6)';
  ctx.fill();

  ctx.strokeStyle = isDark ? '#64748b' : '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw 6 horizontal stair lines (treads) matching blueprint diagram
  const steps = 6;
  ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 1; i < steps; i++) {
    const yStep = y1 + (y2 - y1) * (i / steps);
    const sp1 = project(x1, yStep, 0, width, height);
    const sp2 = project(x2, yStep, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(sp1.x, sp1.y);
    ctx.lineTo(sp2.x, sp2.y);
    ctx.stroke();
  }

  const lbl = project((x1 + x2) / 2, y1 + 3, 0, width, height);
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TANGGA', lbl.x, lbl.y);
}

function drawTeamZoneBox(ctx, width, height, project, x1, x2, y1, splitY, y2, teamTitle, accentColor, isDark) {
  // Members area
  const p1 = project(x1, y1, 0, width, height);
  const p2 = project(x2, y1, 0, width, height);
  const p3 = project(x2, splitY, 0, width, height);
  const p4 = project(x1, splitY, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(248, 250, 252, 0.9)';
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const titlePos = project((x1 + x2) / 2, y1 + 3, 0, width, height);
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(teamTitle, titlePos.x, titlePos.y);

  // Dedicated Manager Area (Matching Blueprint: "MANAGER")
  const l1 = project(x1, splitY, 0, width, height);
  const l2 = project(x2, splitY, 0, width, height);
  const l3 = project(x2, y2, 0, width, height);
  const l4 = project(x1, y2, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(l1.x, l1.y);
  ctx.lineTo(l2.x, l2.y);
  ctx.lineTo(l3.x, l3.y);
  ctx.lineTo(l4.x, l4.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(226, 232, 240, 0.9)';
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const managerLabelPos = project((x1 + x2) / 2, splitY + 3, 0, width, height);
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MANAGER', managerLabelPos.x, managerLabelPos.y);
}

function drawExecutiveOfficeBox(ctx, width, height, project, x1, x2, y1, y2, isDark) {
  const p1 = project(x1, y1, 0, width, height);
  const p2 = project(x2, y1, 0, width, height);
  const p3 = project(x2, y2, 0, width, height);
  const p4 = project(x1, y2, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(30, 27, 75, 0.85)' : 'rgba(254, 243, 199, 0.75)';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Glass partition divider between Dispatcher and Group Leader
  const midY = (y1 + y2) / 2;
  const m1 = project(x1 + 1, midY, 0, width, height);
  const m2 = project(x2 - 1, midY, 0, width, height);
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.lineTo(m2.x, m2.y);
  ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.45)' : 'rgba(217, 119, 6, 0.45)';
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Title at top
  const titlePos = project((x1 + x2) / 2, y1 + 3, 0, width, height);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXECUTIVE MANAGEMENT', titlePos.x, titlePos.y);
}

function drawMiniTable(ctx, width, height, project, cx, cy, rx, ry, color) {
  const center = project(cx, cy, 0, width, height);
  ctx.fillStyle = `${color}25`;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawWorkstationDesks(ctx, width, height, project, isDark, isNight) {
  // PE Production (9 Members: 3x3 + 1 Manager)
  drawTeamDesks(ctx, width, height, project, 7.5, 53, 5, 8, 3, 3, 12.5, 83.5, '#3b82f6', isDark, isNight);

  // PE Mecha (9 Members: 3x3 + 1 Manager)
  drawTeamDesks(ctx, width, height, project, 25.5, 53, 5, 8, 3, 3, 30.5, 83.5, '#10b981', isDark, isNight);

  // PE Solution (9 Members: 3x3 + 1 Manager)
  drawTeamDesks(ctx, width, height, project, 43.5, 53, 5, 8, 3, 3, 48.5, 83.5, '#8b5cf6', isDark, isNight);

  // PE Executive Management (2 Boss Desks: Korean Dispatcher & PE Group Leader)
  drawExecutiveBossDesks(ctx, width, height, project, isDark, isNight);
}

function drawTeamDesks(ctx, width, height, project, startX, startY, colStep, rowStep, cols, rows, leaderX, leaderY, color, isDark, isNight) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = project(startX + c * colStep, startY + r * rowStep, 0, width, height);
      drawSingleDesk(ctx, pos.x, pos.y, color, isDark, isNight, false);
    }
  }

  const leaderPos = project(leaderX, leaderY, 0, width, height);
  drawSingleDesk(ctx, leaderPos.x, leaderPos.y, color, isDark, isNight, true);
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

  // Executive Mahogany Wood Table Top
  ctx.fillStyle = isDark
    ? (isNight ? '#1e1b4b' : '#311042')
    : (isNight ? '#451a03' : '#78350f');
  ctx.fillRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  // Gold / Crimson Executive Trim
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

  // Executive Leather Swivel Chair Behind Desk
  ctx.fillStyle = isDark ? '#020617' : '#1e293b';
  ctx.beginPath();
  ctx.arc(x, y + 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Desk Plate Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(labelText, x, y + 2.5);
}

function drawSingleDesk(ctx, x, y, tagColor, isDark, isNight, isManager) {
  const deskWidth = isManager ? 22 : 16;
  const deskHeight = isManager ? 9 : 7;

  ctx.fillStyle = isDark
    ? (isNight ? '#1e293b' : '#334155')
    : (isNight ? '#64748b' : '#e2e8f0');
  ctx.fillRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);
  ctx.strokeStyle = tagColor;
  ctx.lineWidth = isManager ? 1.5 : 0.8;
  ctx.strokeRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);

  ctx.fillStyle = isNight ? '#0f172a' : '#1e293b';
  ctx.fillRect(x - 5, y - deskHeight / 2 - 5, 10, 4);
  ctx.fillStyle = isNight ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.8)';
  ctx.fillRect(x - 4, y - deskHeight / 2 - 4, 8, 2);

  if (isManager) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👔', x, y + 2);
  }
}

function drawAvatar(ctx, pos, eng, state, isHovered, isSelected, matchesFilter, tick, isNight, zoom) {
  ctx.save();
  ctx.translate(pos.x, pos.y);

  const opacity = matchesFilter ? 1 : 0.25;
  ctx.globalAlpha = opacity;

  // Realistic walk bobbing and leg step cycle
  const bobY = state.isMoving ? Math.sin(state.walkFrame * 2) * 2.8 : Math.sin(tick * 0.05 + eng.id) * 0.8;
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

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Animated Walking Legs (when moving)
  if (state.isMoving) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-2, -5 + bobY);
    ctx.lineTo(-2 - legSwing, 0);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(2, -5 + bobY);
    ctx.lineTo(2 + legSwing, 0);
    ctx.stroke();
  }

  // Avatar Body
  const bodyY = -12 + bobY;
  ctx.fillStyle = eng.avatarColor || '#3b82f6';
  ctx.beginPath();
  ctx.arc(0, bodyY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Torso / Shirt
  ctx.fillStyle = eng.team === TEAMS.PRODUCTION ? '#3b82f6' : (eng.team === TEAMS.MECHA ? '#10b981' : '#8b5cf6');
  ctx.fillRect(-4, bodyY + 6, 8, 7);

  // Tiny Name Pill above head
  ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  const shortName = eng.name.split(' ')[0] + (eng.isLeader ? ' (M)' : '');
  const textWidth = ctx.measureText(shortName).width;

  ctx.beginPath();
  ctx.roundRect(-textWidth / 2 - 4, bodyY - 14, textWidth + 8, 10, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isNight ? '#f8fafc' : '#0f172a';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shortName, 0, bodyY - 6);

  ctx.restore();
}
