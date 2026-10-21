import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './ThemeAnimatedBackground.module.css';

// ponytail: Helper to convert hex to RGBA with zero external dependencies
const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(13, 115, 119, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(13, 115, 119, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const ThemeAnimatedBackground = () => {
  const { palette, theme, customAccent, animatedBg } = useTheme();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!animatedBg) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let width = 0;
    let height = 0;
    let particles = [];
    const isDark = theme === 'dark';

    // Handle high-DPI crisp rendering
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    // Initialize particles tailored to the active theme palette
    const initParticles = () => {
      particles = [];
      const count = palette === 'cobalt' ? 55 : palette === 'corporate' ? 28 : 36;

      for (let i = 0; i < count; i++) {
        if (palette === 'cute') {
          // Sakura petals (100% natural falling sakura petals, ponytail: removed bubbles)
          particles.push({
            type: 'petal',
            x: Math.random() * width,
            y: Math.random() * height,
            size: 8 + Math.random() * 10,
            speedY: 0.7 + Math.random() * 1.1,
            speedX: 0.4 + Math.random() * 0.8,
            angle: Math.random() * Math.PI * 2,
            angularSpeed: (Math.random() - 0.5) * 0.03,
            swayPhase: Math.random() * Math.PI * 2,
            swayAmp: 0.8 + Math.random() * 1.5,
            opacity: isDark ? 0.35 + Math.random() * 0.35 : 0.25 + Math.random() * 0.25,
            color: isDark
              ? (i % 2 === 0 ? '#ff7597' : '#ffa4ba')
              : (i % 2 === 0 ? '#e05780' : '#f472b6'),
          });
        } else if (palette === 'cyberpunk') {
          // Matrix neon emerald streams & digital pulses
          particles.push({
            type: 'matrixStream',
            x: Math.random() * width,
            y: Math.random() * height,
            length: 4 + Math.floor(Math.random() * 6),
            size: 2 + Math.random() * 2.2,
            speedY: 1.2 + Math.random() * 2.2,
            opacity: isDark ? 0.4 + Math.random() * 0.45 : 0.25 + Math.random() * 0.3,
            headColor: isDark ? '#34d399' : '#10b981',
            tailColor: isDark ? 'rgba(16, 185, 129, __A__)' : 'rgba(5, 150, 105, __A__)',
          });
        } else if (palette === 'cobalt') {
          // Cosmic galactic starfield with twinkling & cross flares
          particles.push({
            type: 'star',
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 0.8 + Math.random() * 1.8,
            baseAlpha: isDark ? 0.25 + Math.random() * 0.55 : 0.2 + Math.random() * 0.3,
            twinkleSpeed: 0.02 + Math.random() * 0.04,
            phase: Math.random() * Math.PI * 2,
            hasFlare: Math.random() > 0.82,
            color: isDark
              ? (i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#93c5fd' : '#60a5fa')
              : (i % 2 === 0 ? '#2563eb' : '#3b82f6'),
            driftX: (Math.random() - 0.5) * 0.1,
            driftY: (Math.random() - 0.5) * 0.1,
          });
        } else if (palette === 'amber') {
          // Rising warm forge embers
          particles.push({
            type: 'ember',
            x: Math.random() * width,
            y: Math.random() * height,
            size: 1.5 + Math.random() * 2.8,
            speedY: -(0.6 + Math.random() * 1.4),
            swayAmp: 0.5 + Math.random() * 1.2,
            swayPhase: Math.random() * Math.PI * 2,
            opacity: isDark ? 0.35 + Math.random() * 0.5 : 0.2 + Math.random() * 0.35,
            color: isDark
              ? (i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#f59e0b' : '#ef4444')
              : (i % 2 === 0 ? '#d97706' : '#b45309'),
          });
        } else if (palette === 'purple') {
          // Cyber lavender rotating crystal diamond dust
          particles.push({
            type: 'crystal',
            x: Math.random() * width,
            y: Math.random() * height,
            size: 3 + Math.random() * 5,
            speedY: -(0.3 + Math.random() * 0.6),
            speedX: (Math.random() - 0.5) * 0.4,
            angle: Math.random() * Math.PI * 2,
            angularSpeed: (Math.random() - 0.5) * 0.02,
            opacity: isDark ? 0.35 + Math.random() * 0.45 : 0.2 + Math.random() * 0.3,
            color: isDark
              ? (i % 2 === 0 ? '#c4b5fd' : '#a78bfa')
              : (i % 2 === 0 ? '#7c3aed' : '#8b5cf6'),
          });
        } else if (palette === 'corporate') {
          // Technical engineering constellation nodes & lines
          particles.push({
            type: 'node',
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: 1.8 + Math.random() * 2,
            opacity: isDark ? 0.35 + Math.random() * 0.35 : 0.2 + Math.random() * 0.2,
            color: isDark ? '#4db8b5' : '#0d7377',
          });
        } else {
          // Custom Personal Scheme (Dynamic radiant aura motes)
          particles.push({
            type: 'customMote',
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 2 + Math.random() * 4,
            speedY: -(0.4 + Math.random() * 0.8),
            speedX: (Math.random() - 0.5) * 0.5,
            swayPhase: Math.random() * Math.PI * 2,
            opacity: isDark ? 0.35 + Math.random() * 0.45 : 0.2 + Math.random() * 0.3,
            color: customAccent || '#ec4899',
          });
        }
      }
    };

    // Draw a single sakura petal with natural curved bezier silhouette
    const drawSakuraPetal = (x, y, size, angle, opacity, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.6, -size * 0.75, size * 0.7, size * 0.35, 0, size);
      ctx.bezierCurveTo(-size * 0.7, size * 0.35, -size * 0.6, -size * 0.75, 0, -size);
      ctx.fill();
      ctx.restore();
    };

    // Draw a 4-point crystal diamond star
    const drawCrystal = (x, y, size, angle, opacity, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.35, -size * 0.35);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.35, size * 0.35);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.35, size * 0.35);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.35, -size * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    let tick = 0;

    // Main 60fps render loop
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // 1. Corporate Constellation: Draw interconnecting lines first
      if (palette === 'corporate') {
        const maxDist = 125;
        const strokeColor = isDark ? '77, 184, 181' : '13, 115, 119';
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * (isDark ? 0.16 : 0.09);
              ctx.strokeStyle = `rgba(${strokeColor}, ${alpha})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // 2. Render each particle
      particles.forEach((p) => {
        if (p.type === 'petal') {
          p.x += p.speedX + Math.sin(tick * 0.02 + p.swayPhase) * p.swayAmp;
          p.y += p.speedY;
          p.angle += p.angularSpeed;

          // Wrap around edges seamlessly
          if (p.y > height + 20) {
            p.y = -20;
            p.x = Math.random() * width;
          }
          if (p.x > width + 20) p.x = -20;

          drawSakuraPetal(p.x, p.y, p.size, p.angle, p.opacity, p.color);
        } else if (p.type === 'matrixStream') {
          p.y += p.speedY;
          if (p.y - p.length * p.size * 3 > height) {
            p.y = -10;
            p.x = Math.random() * width;
          }

          // Draw head
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.headColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Draw trailing segments
          for (let s = 1; s <= p.length; s++) {
            const segY = p.y - s * (p.size * 3);
            const segAlpha = (1 - s / p.length) * p.opacity * 0.65;
            ctx.fillStyle = p.tailColor.replace('__A__', segAlpha.toFixed(2));
            ctx.beginPath();
            ctx.arc(p.x, segY, p.size * (1 - s * 0.06), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (p.type === 'star') {
          p.x += p.driftX;
          p.y += p.driftY;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          const currentAlpha = p.baseAlpha * (0.65 + 0.35 * Math.sin(tick * p.twinkleSpeed + p.phase));
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, currentAlpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          if (p.hasFlare && p.radius > 1.3) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 0.6;
            const flareLen = p.radius * 3.8;
            ctx.beginPath();
            ctx.moveTo(p.x - flareLen, p.y);
            ctx.lineTo(p.x + flareLen, p.y);
            ctx.moveTo(p.x, p.y - flareLen);
            ctx.lineTo(p.x, p.y + flareLen);
            ctx.stroke();
          }
          ctx.restore();
        } else if (p.type === 'ember') {
          p.y += p.speedY;
          p.x += Math.sin(tick * 0.025 + p.swayPhase) * p.swayAmp;
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          const flicker = 0.75 + 0.25 * Math.sin(tick * 0.1 + p.swayPhase);
          ctx.save();
          ctx.globalAlpha = p.opacity * flicker;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'crystal') {
          p.y += p.speedY;
          p.x += p.speedX;
          p.angle += p.angularSpeed;
          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;

          drawCrystal(p.x, p.y, p.size, p.angle, p.opacity, p.color);
        } else if (p.type === 'node') {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'customMote') {
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(tick * 0.02 + p.swayPhase) * 0.3;
          if (p.y < -15) {
            p.y = height + 15;
            p.x = Math.random() * width;
          }
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      animId = requestAnimationFrame(render);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Pause animation when tab is inactive to preserve CPU / battery
    const handleVisibility = () => {
      if (document.hidden) {
        if (animId) cancelAnimationFrame(animId);
      } else {
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [palette, theme, customAccent, animatedBg]);

  if (!animatedBg) {
    return null;
  }

  return (
    <div
      className={styles.backgroundContainer}
      aria-hidden="true"
      data-palette={palette}
    >
      <div className={styles.auroraLayer} />
      <canvas ref={canvasRef} className={styles.particleCanvas} />
    </div>
  );
};

export default ThemeAnimatedBackground;
