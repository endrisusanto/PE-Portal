// VirtualOfficePage.jsx
// Complete 3D Animated AI Office Dashboard
// Matches exact reference image aesthetic: Top KPI stats bar, mode controls,
// Left "Aktivitas langsung" feed, Center 3D Isometric Diorama,
// Right "Backlog & Tasks" checklist, and Bottom personnel status cards.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Users,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sun,
  Moon,
  Cpu,
  CheckSquare,
  Square,
  Activity,
  Layers,
  Terminal,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import {
  TEAMS,
  INITIAL_ENGINEERS,
  SCHEDULE_PHASES,
  getActivePhase,
  getEngineerTargetPosition,
  minutesToTime,
} from '../components/office/virtualOfficeData';
import { VirtualOfficeCanvas } from '../components/office/VirtualOfficeCanvas';

// Helper: Get local time in minutes from 00:00 (WIB)
const getLocalTimeInMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
};

// Formatter for clock time: "20.03.52"
const formatClockTime = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
};

export const VirtualOfficePage = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isThemeDark = theme === 'dark';

  // Mode: 'light' (Daytime work mode matching screenshot), 'dark', or 'auto'
  const [viewMode, setViewMode] = useState('light');
  const [currentTimeMins, setCurrentTimeMins] = useState(getLocalTimeInMinutes());
  const [clockDisplay, setClockDisplay] = useState(formatClockTime());
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Filters & Selected Personnel
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [activityFilter, setActivityFilter] = useState('Semua');
  const [engineersList, setEngineersList] = useState(INITIAL_ENGINEERS);

  // Right sidebar tab
  const [rightTab, setRightTab] = useState('backlog'); // 'backlog' | 'cron'

  // Backlog Tasks State (Interactive check/uncheck)
  const [tasks, setTasks] = useState({
    deadline: [
      { id: 1, text: 'Klien 2 — landing page promo akhir bulan', date: '2026-09-25', done: false },
      { id: 2, text: 'Klien 1 — fitur export laporan ke Excel', date: '2026-09-27', done: false },
      { id: 3, text: 'Klien 4 — laporan performa iklan bulanan', date: '2026-09-28', done: false },
      { id: 4, text: 'Klien 5 — 4 artikel SEO minggu ini', date: '2026-09-30', done: false },
    ],
    waiting: [
      { id: 5, text: 'Setujui budget iklan bulan depan', done: false },
      { id: 6, text: 'Pilih desain banner promo (A/B)', done: false },
      { id: 7, text: 'Konfirmasi jadwal rilis fitur baru', done: false },
    ],
    idea: [
      { id: 8, text: 'Template laporan otomatis per klien', done: false },
      { id: 9, text: 'Rapikan dokumentasi server', done: false },
    ],
  });

  const canvasRef = useRef(null);

  // Live ticking clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClockDisplay(formatClockTime(now));
      setCurrentTimeMins(getLocalTimeInMinutes());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch actual team members directly from PostgreSQL database users table
  useEffect(() => {
    const fetchRealUsers = async () => {
      try {
        const res = await api.get('/users');
        if (Array.isArray(res.data) && res.data.length > 0) {
          const peUsers = res.data
            .filter((u) => u.employee_id?.startsWith('PE') || (u.username !== 'admin' && u.employee_id !== 'ADMIN001'))
            .sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || ''));

          if (peUsers.length > 0) {
            setEngineersList((prev) =>
              prev.map((eng) => {
                let dbUser = null;
                if (eng.id === 31) {
                  dbUser = res.data.find((u) => u.employee_id === 'PE_EXP01' || u.username?.includes('jinwoo'));
                } else if (eng.id === 32) {
                  dbUser = res.data.find((u) => u.employee_id === 'PE_GL01' || u.username?.includes('hendrik'));
                } else {
                  const targetEmp = `PE${String(eng.id).padStart(3, '0')}`;
                  dbUser = res.data.find((u) => u.employee_id === targetEmp);
                }

                if (dbUser) {
                  let team = eng.team;
                  if (dbUser.parent_group === 'pe_management' || dbUser.employee_id?.startsWith('PE_')) team = TEAMS.MANAGEMENT;
                  else if (dbUser.parent_group === 'pe_production') team = TEAMS.PRODUCTION;
                  else if (dbUser.parent_group === 'pe_mecha') team = TEAMS.MECHA;
                  else if (dbUser.parent_group === 'pe_solution') team = TEAMS.SOLUTION;

                  const isManager = dbUser.role === 'manager' || dbUser.role === 'leader' || eng.isLeader;
                  let roleTitle = eng.role;
                  if (dbUser.employee_id === 'PE_EXP01') roleTitle = 'Korean Expatriate Dispatcher';
                  else if (dbUser.employee_id === 'PE_GL01') roleTitle = 'PE Group Leader / Group Manager';
                  else if (isManager) roleTitle = `${team} Manager`;
                  else roleTitle = dbUser.group_part_name || eng.role;

                  return {
                    ...eng,
                    name: dbUser.full_name || eng.name,
                    role: roleTitle,
                    team,
                    isLeader: isManager,
                    apiUser: dbUser,
                  };
                }
                return eng;
              })
            );
          }
        }
      } catch (err) {
        // Fallback to INITIAL_ENGINEERS on network error
      }
    };
    fetchRealUsers();
  }, []);

  // When viewMode is 'light', simulate daytime work hours (e.g. 10:15 AM)
  // so all personnel are happily active at their desks!
  const effectiveSimulatedMins = useMemo(() => {
    if (viewMode === 'light') {
      // 10:15 AM (Work Session 1: 09:40 - 11:40)
      return 615;
    }
    if (viewMode === 'dark') {
      // 21:00 (Night time)
      return 1260;
    }
    return currentTimeMins;
  }, [viewMode, currentTimeMins]);

  // Active Phase calculation
  const activePhase = useMemo(() => {
    return getActivePhase(effectiveSimulatedMins);
  }, [effectiveSimulatedMins]);

  // Compute updated positions and activities
  const engineersWithPositions = useMemo(() => {
    return engineersList.map((eng, idx) => {
      const target = getEngineerTargetPosition(eng, activePhase, idx, effectiveSimulatedMins);

      // Map specific pills matching reference image
      let customPill = null;
      if (eng.id === 31 || eng.employee_id === 'PE_EXP01') {
        customPill = 'Arka (HQ) jalanin perintah';
      } else if (eng.id === 32 || eng.employee_id === 'PE_GL01') {
        customPill = 'Salsa (PM) ngoding';
      } else if (eng.id === 1) {
        customPill = 'Fajar (RB) baca kode';
      } else if (eng.id === 2) {
        customPill = 'Dinda (DX) browsing';
      } else if (eng.id === 3) {
        customPill = 'Rani (GM) cek Meta Ads';
      } else if (eng.id === 4) {
        customPill = 'Gilang (DK) nulis dokumen';
      }

      return {
        ...eng,
        currentZone: target.zone,
        targetCoords: target.coords,
        currentActivity: target.activity,
        customPill,
      };
    });
  }, [engineersList, activePhase, Math.floor(effectiveSimulatedMins)]);

  // Activity Feed Data matching reference image
  const liveActivities = [
    { id: 1, avatar: 'B', color: '#3b82f6', text: 'Edit · Tambah filter tanggal di dashboard', time: '1m', prefix: '►', author: 'Salsa' },
    { id: 2, avatar: 'R', color: '#ec4899', text: 'meta-ads · Tarik performa iklan mingguan', time: '1m', prefix: '►', author: 'Rani' },
    { id: 3, avatar: 'A', color: '#f97316', text: 'Laporan harian semua tim sudah masuk, lagi aku rangkum buat dikirim ke WA owner.', time: '2m', prefix: '►', author: 'Arka' },
    { id: 4, avatar: 'D', color: '#a855f7', text: 'WebFetch · Cek halaman katalog produk', time: '2m', prefix: '►', author: 'Dinda' },
    { id: 5, avatar: 'F', color: '#10b981', text: 'Read · Cek komponen form landing page', time: '3m', prefix: '►', author: 'Fajar' },
    { id: 6, avatar: 'G', color: '#14b8a6', text: 'Docs · Tulis draf artikel SEO', time: '3m', prefix: '►', author: 'Gilang' },
    { id: 7, avatar: 'S', color: '#3b82f6', text: 'Fitur export laporan sudah jalan di staging, tinggal clock owner.', time: '4m', prefix: '►', author: 'Salsa' },
    { id: 8, avatar: 'A', color: '#f97316', text: 'ke Salsa: Tolong kirim 3 baris laporan harian ya', time: '5m', prefix: '💬', author: 'Arka' },
    { id: 9, avatar: 'R', color: '#ec4899', text: 'Iklan A paling murah per lead, usul budget iklan C dipindah ke A.', time: '7m', prefix: '💡', author: 'Rani' },
    { id: 10, avatar: 'F', color: '#10b981', text: 'Landing page promo sudah live, tracking form sudah aku uji dan masuk.', time: '8m', prefix: '🚀', author: 'Fajar' },
    { id: 11, avatar: 'A', color: '#f97316', text: 'Read · Baca daftar tugas minggu ini', time: '9m', prefix: '►', author: 'Arka' },
    { id: 12, avatar: 'D', color: '#a855f7', text: 'Katalog produk baru sudah tampil, gambar sudah dikompres.', time: '10m', prefix: '►', author: 'Dinda' },
    { id: 13, avatar: 'G', color: '#14b8a6', text: '2 artikel sudah terbit, 1 artikel lagi', time: '11m', prefix: '►', author: 'Gilang' },
  ];

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'Semua') return liveActivities;
    return liveActivities.filter((a) => a.author.toLowerCase().includes(activityFilter.toLowerCase()));
  }, [activityFilter]);

  // 6 Featured Personnel Cards matching bottom row of screenshot
  const featuredPersonnel = [
    {
      avatar: 'A',
      avatarColor: '#f97316',
      name: 'Arka (HQ)',
      role: 'Manager tim',
      status: 'KERJA',
      task: 'Read · Rangkum laporan harian tim',
      stats: '18 aksi · 11.3rb tok · 113rb ctx · 1m',
    },
    {
      avatar: 'S',
      avatarColor: '#3b82f6',
      name: 'Salsa (PM)',
      role: 'Developer · Klien 1',
      status: 'KERJA',
      task: 'Edit · Tambah filter tanggal di dashboard',
      stats: '333 aksi · 503rb tok · 921rb ctx · 1m',
    },
    {
      avatar: 'F',
      avatarColor: '#10b981',
      name: 'Fajar (RB)',
      role: 'Developer + Ads · Klien 2',
      status: 'KERJA',
      task: 'Read · Cek komponen form landing page',
      stats: '128 aksi · 146rb tok · 643rb ctx · 1m',
    },
    {
      avatar: 'D',
      avatarColor: '#a855f7',
      name: 'Dinda (DX)',
      role: 'Developer · Klien 3',
      status: 'KERJA',
      task: 'WebFetch · Cek halaman katalog produk',
      stats: '125 aksi · 163rb tok · 804rb ctx · 1m',
    },
    {
      avatar: 'R',
      avatarColor: '#ec4899',
      name: 'Rani (GM)',
      role: 'Analis Iklan · Klien 4',
      status: 'KERJA',
      task: 'meta-ads · Tarik performa iklan minggu ini',
      stats: '2 aksi · 1.2rb tok · 771rb ctx · 1m',
    },
    {
      avatar: 'G',
      avatarColor: '#14b8a6',
      name: 'Gilang (DK)',
      role: 'Content writer · Klien 5',
      status: 'KERJA',
      task: 'Docs · Tulis draf artikel SEO',
      stats: '3 aksi · 1.1rb tok · 416rb ctx · 1m',
    },
  ];

  const toggleTask = (category, id) => {
    setTasks((prev) => ({
      ...prev,
      [category]: prev[category].map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  };

  // Theme styling tokens
  const isDark = viewMode === 'dark' || (viewMode === 'auto' && isThemeDark);
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderCol = isDark ? '#334155' : '#e2e8f0';
  const textMain = isDark ? '#f8fafc' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const pageBg = isDark ? '#0b1120' : '#f1f5f9';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '100%',
        backgroundColor: pageBg,
        padding: '12px 16px 20px',
        borderRadius: '12px',
        color: textMain,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ========================================================= */}
      {/* 1. TOP HEADER & KPI STATS BAR (Matching exact screenshot) */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: cardBg,
          padding: '10px 16px',
          borderRadius: '12px',
          border: `1px solid ${borderCol}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Left: Brand Pill & Subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.2px' }}>
              Kantor Virtual HQ
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  display: 'inline-block',
                }}
              />
              LIVE
            </span>
          </div>
          <span style={{ fontSize: '11px', color: textMuted, marginTop: '2px' }}>
            AIKANAI · Mode {viewMode === 'light' ? 'terang' : (viewMode === 'dark' ? 'gelap' : 'otomatis')} WIB
          </span>
        </div>

        {/* Center/Right: KPI Metric Boxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* WIB Clock */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>WIB</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>{clockDisplay}</span>
          </div>

          {/* Token Keluar */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>TOKEN KELUAR</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>778rb</span>
          </div>

          {/* Token Diproses */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>TOKEN DIPROSES</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>378jt</span>
          </div>

          {/* Jam Berikutnya */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>JAM BERIKUTNYA</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>21.00</span>
          </div>

          {/* Aksi */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>AKSI</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>602</span>
          </div>

          {/* Sesi Aktif */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>SESI AKTIF</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>6/6</span>
          </div>

          {/* RAM Box */}
          <div style={kpiBoxStyle(cardBg, borderCol)}>
            <span style={kpiLabelStyle(textMuted)}>RAM BOX</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>1.2G free</span>
          </div>
        </div>

        {/* Right Controls: Mode Toggle, Reset Camera, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            onClick={() => setViewMode('auto')}
            style={pillBtnStyle(viewMode === 'auto', cardBg, borderCol, textMain)}
            title="Ikuti jam kerja real-time"
          >
            ⚙️ Otomatis
          </button>
          <button
            onClick={() => setViewMode('light')}
            style={pillBtnStyle(viewMode === 'light', cardBg, borderCol, textMain)}
            title="Mode Terang (Daytime Work Mode)"
          >
            ☀️ Terang
          </button>
          <button
            onClick={() => setViewMode('dark')}
            style={pillBtnStyle(viewMode === 'dark', cardBg, borderCol, textMain)}
            title="Mode Gelap (Night Mode)"
          >
            🌙 Gelap
          </button>
          <button
            onClick={() => canvasRef.current?.resetCamera?.()}
            style={pillBtnStyle(false, cardBg, borderCol, textMain)}
            title="Kembalikan ke sudut awal isometric"
          >
            ↺ Sudut awal
          </button>
          <button
            onClick={() => canvasRef.current?.toggleFullscreen?.()}
            style={pillBtnStyle(false, cardBg, borderCol, textMain)}
            title="Mode layar penuh"
          >
            ⛶ Layar penuh
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. THREE-COLUMN BODY: Feed | 3D Diorama | Backlog Tasks   */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '270px minmax(0, 1fr) 260px',
          gap: '12px',
          alignItems: 'stretch',
          minHeight: '620px',
        }}
      >
        {/* ========================================= */}
        {/* LEFT COLUMN: Aktivitas Langsung           */}
        {/* ========================================= */}
        <div
          style={{
            backgroundColor: cardBg,
            borderRadius: '12px',
            border: `1px solid ${borderCol}`,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            maxHeight: '640px',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Aktivitas langsung</span>
          </div>

          {/* Quick Filter Buttons */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['Semua', 'Arka (HQ)', 'Salsa (PM)', 'Fajar (RB)', 'Dinda (DX)', 'Rani (GM)', 'Gilang (DK)'].map((f) => {
              const isActive = (f === 'Semua' && activityFilter === 'Semua') || activityFilter === f.split(' ')[0];
              return (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f === 'Semua' ? 'Semua' : f.split(' ')[0])}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isActive ? '1px solid #3b82f6' : `1px solid ${borderCol}`,
                    backgroundColor: isActive ? '#3b82f6' : (isDark ? '#0f172a' : '#f8fafc'),
                    color: isActive ? '#ffffff' : textMuted,
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Live Feed List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filteredActivities.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 4px',
                  fontSize: '11.5px',
                  lineHeight: '1.4',
                  borderBottom: `1px solid ${borderCol}33`,
                }}
              >
                {/* Initial Avatar Circle */}
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: act.color,
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {act.avatar}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: textMain, wordBreak: 'break-word' }}>
                    <strong style={{ color: '#64748b', marginRight: '4px' }}>{act.prefix}</strong>
                    {act.text}
                  </span>
                </div>

                {/* Time */}
                <span style={{ fontSize: '10px', color: textMuted, flexShrink: 0, marginTop: '2px' }}>
                  {act.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================= */}
        {/* CENTER COLUMN: 3D Isometric Diorama       */}
        {/* ========================================= */}
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${borderCol}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: cardBg,
          }}
        >
          <VirtualOfficeCanvas
            ref={canvasRef}
            engineers={engineersWithPositions}
            activePhase={activePhase}
            selectedEngineer={selectedEngineer}
            onSelectEngineer={setSelectedEngineer}
            isDarkMode={isDark}
            viewMode={viewMode}
            canvasHeight="640px"
          />
        </div>

        {/* ========================================= */}
        {/* RIGHT COLUMN: Backlog & Tasks Checklist   */}
        {/* ========================================= */}
        <div
          style={{
            backgroundColor: cardBg,
            borderRadius: '12px',
            border: `1px solid ${borderCol}`,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            maxHeight: '640px',
            overflowY: 'auto',
          }}
        >
          {/* Header Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${borderCol}`, paddingBottom: '8px' }}>
            <button
              onClick={() => setRightTab('backlog')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '13px',
                fontWeight: rightTab === 'backlog' ? 700 : 500,
                color: rightTab === 'backlog' ? textMain : textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Backlog <span style={{ fontSize: '11px', backgroundColor: isDark ? '#334155' : '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>9</span>
            </button>
            <button
              onClick={() => setRightTab('cron')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '13px',
                fontWeight: rightTab === 'cron' ? 700 : 500,
                color: rightTab === 'cron' ? textMain : textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Cron <span style={{ fontSize: '11px', backgroundColor: isDark ? '#334155' : '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>5</span>
            </button>
          </div>

          {rightTab === 'backlog' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Category 1: Deadline dekat */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Deadline dekat</span>
                  <span>4</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tasks.deadline.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => toggleTask('deadline', t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        lineHeight: '1.3',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => {}}
                        style={{ marginTop: '2px', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? textMuted : textMain }}>
                          {t.text}
                        </span>
                        <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '1px' }}>{t.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category 2: Nunggu owner */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nunggu owner</span>
                  <span>3</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tasks.waiting.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => toggleTask('waiting', t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        lineHeight: '1.3',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => {}}
                        style={{ marginTop: '2px', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                      <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? textMuted : textMain }}>
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category 3: Ide / nanti */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ide / nanti</span>
                  <span>2</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tasks.idea.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => toggleTask('idea', t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        lineHeight: '1.3',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => {}}
                        style={{ marginTop: '2px', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                      <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? textMuted : textMain }}>
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${borderCol}` }}>
                <strong>⏱️ Ingestion FPY Daily</strong>
                <div style={{ color: textMuted, fontSize: '10px' }}>Every day at 07:00 WIB · 200 items</div>
              </div>
              <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${borderCol}` }}>
                <strong>⏱️ Auto Backup PostgreSQL</strong>
                <div style={{ color: textMuted, fontSize: '10px' }}>Every night at 23:59 WIB · OK</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BOTTOM ROW: Active Personnel Cards (6 across)          */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '10px',
        }}
      >
        {featuredPersonnel.map((p, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: cardBg,
              borderRadius: '12px',
              border: `1px solid ${borderCol}`,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Header: Avatar, Name & KERJA pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: p.avatarColor,
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {p.avatar}
                </div>
                <strong style={{ fontSize: '12px', color: textMain, whiteSpace: 'nowrap' }}>
                  {p.name}
                </strong>
              </div>

              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: '999px',
                  padding: '1px 5px',
                  backgroundColor: '#f0fdf4',
                }}
              >
                {p.status}
              </span>
            </div>

            {/* Subtitle / Role */}
            <div style={{ fontSize: '10px', color: textMuted }}>
              {p.role}
            </div>

            {/* Current Action / Task */}
            <div
              style={{
                fontSize: '10.5px',
                color: textMain,
                lineHeight: '1.3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '28px',
              }}
            >
              <span style={{ color: '#3b82f6', marginRight: '4px' }}>►</span>
              {p.task}
            </div>

            {/* Micro Stats Footer */}
            <div style={{ fontSize: '9px', color: textMuted, marginTop: '2px', borderTop: `1px solid ${borderCol}44`, paddingTop: '4px' }}>
              {p.stats}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Sub-component Styles
const kpiBoxStyle = (cardBg, borderCol) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: '8px',
  backgroundColor: cardBg,
  border: `1px solid ${borderCol}`,
  minWidth: '70px',
});

const kpiLabelStyle = (textMuted) => ({
  fontSize: '9px',
  fontWeight: 600,
  color: textMuted,
  letterSpacing: '0.4px',
  marginBottom: '1px',
});

const pillBtnStyle = (isActive, cardBg, borderCol, textMain) => ({
  padding: '5px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  border: isActive ? '1px solid #3b82f6' : `1px solid ${borderCol}`,
  backgroundColor: isActive ? '#3b82f6' : cardBg,
  color: isActive ? '#ffffff' : textMain,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  transition: 'all 0.15s ease',
});

export default VirtualOfficePage;
