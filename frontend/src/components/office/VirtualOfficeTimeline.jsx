// VirtualOfficeTimeline.jsx
// Interactive Time Scrubber, Live Clock toggle, and Schedule Phase Bookmark Bar

import React from 'react';
import { Play, Pause, Clock, RotateCcw, Zap, Compass } from 'lucide-react';
import { SCHEDULE_PHASES, minutesToTime, timeToMinutes } from './virtualOfficeData';

export const VirtualOfficeTimeline = ({
  currentTimeMins,
  onSeekTime,
  isLiveMode,
  onToggleLiveMode,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangePlaybackSpeed,
  activePhase,
}) => {
  // Key bookmark shortcuts as explicitly required
  const BOOKMARKS = [
    { label: '07:00 Mulai Kerja', time: '07:00', type: 'work' },
    { label: '09:30 Coffee Break 1', time: '09:30', type: 'break' },
    { label: '09:40 Lanjut Kerja', time: '09:40', type: 'work' },
    { label: '11:40 Istirahat Siang', time: '11:40', type: 'lunch' },
    { label: '12:30 Selesai Istirahat', time: '12:30', type: 'work' },
    { label: '14:30 Coffee Break 2', time: '14:30', type: 'break' },
    { label: '14:40 Sesi Sore', time: '14:40', type: 'work' },
    { label: '16:10 Jam Pulang', time: '16:10', type: 'off' },
  ];

  const handleSliderChange = (e) => {
    onSeekTime(Number(e.target.value));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Top Controls Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Left: Clock Display & Live Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            <Clock size={18} color="var(--color-accent)" />
            <span>{minutesToTime(currentTimeMins)} WIB</span>
          </div>

          <button
            onClick={onToggleLiveMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isLiveMode ? '1px solid #10b981' : '1px solid var(--color-border)',
              backgroundColor: isLiveMode ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-bg-primary)',
              color: isLiveMode ? '#10b981' : 'var(--color-text-secondary)',
              transition: 'all 0.2s',
            }}
            title="Sinkronisasi otomatis dengan waktu saat ini"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isLiveMode ? '#10b981' : '#94a3b8',
                display: 'inline-block',
              }}
            />
            {isLiveMode ? 'Live Clock Aktif' : 'Mode Simulasi'}
          </button>
        </div>

        {/* Center: Current Phase Badge */}
        {activePhase && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: `${activePhase.color}20`,
              border: `1px solid ${activePhase.color}`,
              fontSize: '13px',
              fontWeight: 600,
              color: activePhase.color,
            }}
          >
            <span>●</span>
            <span>{activePhase.name}</span>
            <span style={{ fontSize: '11px', opacity: 0.85 }}>
              ({activePhase.start} - {activePhase.end})
            </span>
          </div>
        )}

        {/* Right: Simulation Controls (Play/Pause/Speed) */}
        {!isLiveMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onTogglePlay}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play Simulasi'}
            </button>

            <select
              value={playbackSpeed}
              onChange={(e) => onChangePlaybackSpeed(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value={1}>1x Kecepatan</option>
              <option value={5}>5x Kecepatan</option>
              <option value={15}>15x Kecepatan</option>
              <option value={30}>30x Kecepatan</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Scrubber Slider */}
      <div style={{ position: 'relative', width: '100%', marginTop: '6px' }}>
        <input
          type="range"
          min={0}
          max={1439}
          value={currentTimeMins}
          onChange={handleSliderChange}
          disabled={isLiveMode}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            appearance: 'none',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            cursor: isLiveMode ? 'not-allowed' : 'pointer',
            opacity: isLiveMode ? 0.7 : 1,
          }}
        />

        {/* Phase Color Bands underneath */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            overflow: 'hidden',
            marginTop: '4px',
          }}
        >
          {SCHEDULE_PHASES.map((p) => {
            const startM = timeToMinutes(p.start);
            const endM = p.end === '23:59' ? 1440 : timeToMinutes(p.end);
            const durationPct = ((endM - startM) / 1440) * 100;
            return (
              <div
                key={p.id}
                title={`${p.name}: ${p.start} - ${p.end}`}
                style={{
                  width: `${durationPct}%`,
                  height: '100%',
                  backgroundColor: p.color,
                  opacity: activePhase?.id === p.id ? 1 : 0.45,
                  transition: 'opacity 0.2s',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bookmark Shortcuts Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: '6px',
        }}
      >
        {BOOKMARKS.map((bm) => {
          const bmMinutes = timeToMinutes(bm.time);
          const isCurrent = Math.abs(currentTimeMins - bmMinutes) < 15;
          return (
            <button
              key={bm.time}
              onClick={() => onSeekTime(bmMinutes)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: 'pointer',
                border: isCurrent ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                backgroundColor: isCurrent ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              ⏱️ {bm.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
