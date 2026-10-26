// VirtualOfficePage.jsx
// Main Page: 2.5D Animated AI Engineering Office for 30 Persons
// Represents SEIN PE work hours: 07:00 Start, 09:30 Break (10m), 11:40 Lunch, 12:30 Resume, 14:30 Break (10m), 16:10 Pulang

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Clock, Sparkles, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import {
  TEAMS,
  INITIAL_ENGINEERS,
  SCHEDULE_PHASES,
  getActivePhase,
  getEngineerTargetPosition,
  minutesToTime,
  timeToMinutes,
} from '../components/office/virtualOfficeData';
import { VirtualOfficeCanvas } from '../components/office/VirtualOfficeCanvas';
import { VirtualOfficeTimeline } from '../components/office/VirtualOfficeTimeline';

// Helper: Get current local time in minutes from 00:00 (WIB)
const getLocalTimeInMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
};

export const VirtualOfficePage = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Time & Simulation State
  const [currentTimeMins, setCurrentTimeMins] = useState(getLocalTimeInMinutes());
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Filter & Selection State
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [filterTeam, setFilterTeam] = useState('ALL');
  // ponytail: Load registered users only from DB; start empty with no mock padding
  const [engineersList, setEngineersList] = useState([]);

  // Audio Context ref for ambient chimes on phase change
  const audioCtxRef = useRef(null);
  const lastPhaseIdRef = useRef(null);

  // Fetch actual team members directly from PostgreSQL database users table
  useEffect(() => {
    const fetchRealUsers = async () => {
      try {
        const res = await api.get('/users');
        if (Array.isArray(res.data) && res.data.length > 0) {
          // ponytail: Filter out system admin and map strictly registered users
          const teamCounters = { [TEAMS.PRODUCTION]: 0, [TEAMS.MECHA]: 0, [TEAMS.SOLUTION]: 0, [TEAMS.MANAGEMENT]: 0 };
          const registeredUsers = res.data
            .filter((u) => u.username !== 'admin' && u.employee_id !== 'ADMIN001' && u.is_active !== false)
            .sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || ''))
            .map((u, idx) => {
              const gName = (u.group_name || u.group_part_name || u.parent_group || '').toLowerCase();
              let team = TEAMS.PRODUCTION;
              if (gName.includes('mecha') || gName.includes('jig') || gName.includes('mro')) {
                team = TEAMS.MECHA;
              } else if (gName.includes('solution') || gName.includes('software') || gName.includes('release') || gName.includes('gba') || gName.includes('program')) {
                team = TEAMS.SOLUTION;
              } else if (gName.includes('management') || gName.includes('executive') || u.employee_id?.startsWith('PE_')) {
                team = TEAMS.MANAGEMENT;
              }

              const isLeader = u.role === 'manager' || u.role === 'leader' || u.employee_id?.startsWith('PE_');
              const slot = !isLeader && teamCounters[team] !== undefined ? teamCounters[team]++ : 0;
              let roleTitle = u.role;
              if (u.employee_id === 'PE_EXP01') roleTitle = 'Korean Expatriate Dispatcher';
              else if (u.employee_id === 'PE_GL01') roleTitle = 'PE Group Leader / Group Manager';
              else if (isLeader) roleTitle = `${team} Manager`;
              else if (u.group_name || u.group_part_name) roleTitle = u.group_name || u.group_part_name;

              let numId = idx + 1;
              const numMatch = u.employee_id?.match(/\d+/);
              if (numMatch) numId = parseInt(numMatch[0], 10);
              if (u.employee_id === 'PE_EXP01') numId = 31;
              if (u.employee_id === 'PE_GL01') numId = 32;

              return {
                id: numId,
                dbId: u.id,
                employee_id: u.employee_id,
                name: u.full_name || u.username,
                role: roleTitle,
                team,
                isLeader,
                slotIndex: slot,
                currentTask: `Bekerja aktif di ${roleTitle}`,
                avatarColor: ['#2563eb', '#059669', '#7c3aed', '#d97706', '#e11d48', '#0284c7'][idx % 6],
                apiUser: u,
              };
            });

          setEngineersList(registeredUsers);
        }
      } catch (err) {
        // Leave engineersList empty if API fails; no fake mock users
      }
    };
    fetchRealUsers();
  }, []);

  // Live Clock Interval (runs every second when live mode is active)
  useEffect(() => {
    if (!isLiveMode) return;
    const interval = setInterval(() => {
      setCurrentTimeMins(getLocalTimeInMinutes());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLiveMode]);

  // Simulation Playback Interval
  useEffect(() => {
    if (isLiveMode || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTimeMins((prev) => (prev + (playbackSpeed * 0.25)) % 1440);
    }, 250);
    return () => clearInterval(interval);
  }, [isLiveMode, isPlaying, playbackSpeed]);

  // Active Phase calculation
  const activePhase = useMemo(() => {
    return getActivePhase(currentTimeMins);
  }, [currentTimeMins]);

  // Sound chime when entering a new phase (e.g., 09:30 Coffee break or 16:10 Pulang)
  useEffect(() => {
    if (lastPhaseIdRef.current && lastPhaseIdRef.current !== activePhase.id) {
      if (soundEnabled) {
        playChime(activePhase.type);
      }
    }
    lastPhaseIdRef.current = activePhase.id;
  }, [activePhase, soundEnabled]);

  const playChime = (type) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = type === 'break' ? 523.25 : (type === 'work' ? 659.25 : 440);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio not supported or blocked by browser policy
    }
  };

  // Compute updated positions and activities for 30 engineers (updates smoothly on phase change and minute-by-minute hydration/toilet breaks)
  const engineersWithPositions = useMemo(() => {
    return engineersList.map((eng, idx) => {
      const target = getEngineerTargetPosition(eng, activePhase, idx, currentTimeMins);
      return {
        ...eng,
        currentZone: target.zone,
        targetCoords: target.coords,
        currentActivity: target.activity,
      };
    });
  }, [engineersList, activePhase, Math.floor(currentTimeMins)]);

  // Handle Seek / Scrub Time
  const handleSeekTime = (mins) => {
    setIsLiveMode(false);
    setCurrentTimeMins(mins);
  };

  const handleToggleLiveMode = () => {
    if (!isLiveMode) {
      setIsLiveMode(true);
      setIsPlaying(false);
      setCurrentTimeMins(getLocalTimeInMinutes());
    } else {
      setIsLiveMode(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={24} color="var(--color-accent)" />
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>
              {t('virtual_office.title', 'Virtual Office PE')}
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {t('virtual_office.personnel_active', { count: engineersList.length, defaultValue: `${engineersList.length} Personil Terdaftar Aktif` })}
            </span>
          </div>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              marginTop: '4px',
              margin: 0,
            }}
          >
            {t('virtual_office.subtitle', 'Representasi visual jam kerja tim SEIN PE (07:00 Mulai Kerja, 09:30 Break 10m, 11:40 Istirahat, 14:30 Break 10m, 16:10 Pulang)')}
          </p>
        </div>

        {/* Audio Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'var(--color-bg-secondary)',
              color: soundEnabled ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
            title={t('virtual_office.bell_title', 'Bunyi lonceng transisi pergantian jam kerja')}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? t('virtual_office.sound_on', 'Suara Lonceng: On') : t('virtual_office.sound_mute', 'Suara Lonceng: Mute')}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Timeline Scrubber & 3D Canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <VirtualOfficeTimeline
          currentTimeMins={currentTimeMins}
          onSeekTime={handleSeekTime}
          isLiveMode={isLiveMode}
          onToggleLiveMode={handleToggleLiveMode}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          playbackSpeed={playbackSpeed}
          onChangePlaybackSpeed={setPlaybackSpeed}
          activePhase={activePhase}
        />

        <VirtualOfficeCanvas
          engineers={engineersWithPositions}
          activePhase={activePhase}
          selectedEngineer={selectedEngineer}
          onSelectEngineer={setSelectedEngineer}
          filterTeam={filterTeam}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
};
export default VirtualOfficePage;
