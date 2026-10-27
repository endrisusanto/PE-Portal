import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Clock, Sparkles, Volume2, VolumeX, Maximize2, X, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import {
  TEAMS,
  INITIAL_ENGINEERS,
  SCHEDULE_PHASES,
  MANAGER_DESKS,
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

  // ponytail: Persist custom manager desk assignments in localStorage
  const [deskAssignments, setDeskAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem('pe_virtual_office_desk_assignments');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Active desk modal being assigned (e.g. clicked on canvas)
  const [assigningDesk, setAssigningDesk] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');

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

          // ponytail: If deskAssignments is empty in localStorage, intelligently auto-seed based on parent_group & role
          setDeskAssignments((current) => {
            if (Object.keys(current).length > 0) return current;
            const seeded = {};
            registeredUsers.forEach((eng) => {
              const u = eng.apiUser || {};
              const pGroup = (u.parent_group || '').toLowerCase();
              const fName = (eng.name || '').toLowerCase();
              if (eng.isLeader || u.role === 'manager') {
                if (pGroup.includes('production') || pGroup.includes('part')) {
                  if (!seeded.PE_PRODUCTION_MANAGER) seeded.PE_PRODUCTION_MANAGER = eng.name;
                } else if (pGroup.includes('mecha')) {
                  if (!seeded.PE_MECHA_MANAGER) seeded.PE_MECHA_MANAGER = eng.name;
                } else if (pGroup.includes('solution')) {
                  if (!seeded.PE_SOLUTION_MANAGER) seeded.PE_SOLUTION_MANAGER = eng.name;
                } else if (pGroup.includes('management')) {
                  if (fName.includes('park') || fName.includes('jin-woo') || eng.employee_id === 'PE_EXP01') {
                    if (!seeded.PE_DISPATCHER) seeded.PE_DISPATCHER = eng.name;
                  } else {
                    if (!seeded.PE_GROUP_LEADER) seeded.PE_GROUP_LEADER = eng.name;
                  }
                }
              }
            });
            try {
              localStorage.setItem('pe_virtual_office_desk_assignments', JSON.stringify(seeded));
            } catch {}
            return seeded;
          });
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

  // Compute updated positions and activities for engineers (updates smoothly on phase change and minute-by-minute hydration/toilet breaks)
  const engineersWithPositions = useMemo(() => {
    return engineersList.map((eng, idx) => {
      const target = getEngineerTargetPosition(eng, activePhase, idx, currentTimeMins, deskAssignments);
      return {
        ...eng,
        currentZone: target.zone,
        targetCoords: target.coords,
        currentActivity: target.activity,
      };
    });
  }, [engineersList, activePhase, Math.floor(currentTimeMins), deskAssignments]);

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

        {/* Action Controls: Desk Manager Assignment & Audio Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setAssigningDesk(MANAGER_DESKS[0]);
              setSelectedAssignee(deskAssignments[MANAGER_DESKS[0].id] || '');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Klik untuk memilih dan mengatur penempatan posisi meja manager"
          >
            <span>🪑</span>
            <span>Atur Meja Manager</span>
          </button>

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
          deskAssignments={deskAssignments}
          onSelectDesk={(desk) => {
            setAssigningDesk(desk);
            setSelectedAssignee(deskAssignments[desk.id] || '');
          }}
        />
      </div>

      {/* Modal Assign Manager Meja */}
      {assigningDesk && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={() => setAssigningDesk(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              width: '100%',
              maxWidth: '460px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{assigningDesk.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                    Assign Manager Meja
                  </h3>
                  <span style={{ fontSize: '12px', color: assigningDesk.color, fontWeight: 600 }}>
                    {assigningDesk.title}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningDesk(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick desk tabs */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {MANAGER_DESKS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setAssigningDesk(d);
                    setSelectedAssignee(deskAssignments[d.id] || '');
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: `1px solid ${assigningDesk.id === d.id ? d.color : 'var(--color-border)'}`,
                    backgroundColor: assigningDesk.id === d.id ? `${d.color}25` : 'var(--color-bg-secondary)',
                    color: assigningDesk.id === d.id ? d.color : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {d.icon} {d.shortLabel}
                </button>
              ))}
            </div>

            {/* Current Occupant Info */}
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>Manager Saat Ini:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {deskAssignments[assigningDesk.id] || '(Belum Terisi / Kosong)'}
              </span>
            </div>

            {/* Dropdown Select Manager */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Pilih Personil untuk Menduduki Kursi Ini:
              </label>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <option value="">-- Kosongkan Meja Ini --</option>
                <optgroup label="Daftar Manager (Direkomendasikan)">
                  {engineersList
                    .filter((eng) => eng.isLeader || eng.role?.toLowerCase().includes('manager'))
                    .map((eng) => (
                      <option key={eng.dbId || eng.name} value={eng.name}>
                        👔 {eng.name} ({eng.team} - {eng.role})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Seluruh Anggota Personil">
                  {engineersList
                    .filter((eng) => !eng.isLeader && !eng.role?.toLowerCase().includes('manager'))
                    .map((eng) => (
                      <option key={eng.dbId || eng.name} value={eng.name}>
                        👤 {eng.name} ({eng.team} - {eng.role})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...deskAssignments };
                  delete updated[assigningDesk.id];
                  setDeskAssignments(updated);
                  try {
                    localStorage.setItem('pe_virtual_office_desk_assignments', JSON.stringify(updated));
                  } catch {}
                  setAssigningDesk(null);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Kosongkan
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...deskAssignments, [assigningDesk.id]: selectedAssignee };
                  if (!selectedAssignee) {
                    delete updated[assigningDesk.id];
                  }
                  setDeskAssignments(updated);
                  try {
                    localStorage.setItem('pe_virtual_office_desk_assignments', JSON.stringify(updated));
                  } catch {}
                  setAssigningDesk(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Check size={14} />
                <span>Simpan &amp; Tempatkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default VirtualOfficePage;
