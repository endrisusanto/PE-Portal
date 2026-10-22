import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  Lightbulb,
  Cpu,
  FolderArchive,
  PackageCheck,
  Newspaper,
  Wrench,
  Scissors,
  Activity,
  Clock,
  GraduationCap,
  Video,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import styles from './DashboardPage.module.css';

// 5 Milestone Problem Solving Stages
const MILESTONE_STAGES = [
  { step: 1, label: 'Issue Identified', percent: 20, color: '#ef4444' },
  { step: 2, label: 'Root Cause Analysis', percent: 40, color: '#f59e0b' },
  { step: 3, label: 'Trial Countermeasure', percent: 60, color: '#3b82f6' },
  { step: 4, label: 'Verification & Yield', percent: 80, color: '#8b5cf6' },
  { step: 5, label: 'Closed & Standardized', percent: 100, color: '#10b981' },
];

export const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberFilter, setMemberFilter] = useState('all'); // 'all' | 'online' | 'away' | 'offline'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updatesOpen, setUpdatesOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(true);

  // Real-time clock for production shift tracking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current production shift
  const currentShift = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 7 && hour < 15.5) return { name: 'Shift 1 (Pagi)', time: '07:00 - 15:30' };
    if (hour >= 15.5 && hour < 23.5) return { name: 'Shift 2 (Sore)', time: '15:30 - 23:30' };
    return { name: 'Shift 3 (Malam)', time: '23:30 - 07:00' };
  }, [currentTime]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, projectsRes, groupsRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: {} })),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/groups').catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data || {});
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute User Presence: Online, Session Active (Away), or Offline
  const membersWithPresence = useMemo(() => {
    const now = Date.now();
    return users.map((u, idx) => {
      const isCurrentUser = user && String(user.id) === String(u.id);

      // Determine status:
      // 1. Current user is always online
      // 2. Others: calculate based on last_login_at or deterministic shift allocation
      let status = 'offline';
      let statusLabel = 'Offline';

      if (isCurrentUser) {
        status = 'online';
        statusLabel = 'Online';
      } else if (u.last_login_at) {
        const lastLogin = new Date(u.last_login_at).getTime();
        const diffMinutes = (now - lastLogin) / (1000 * 60);
        if (diffMinutes <= 30) {
          status = 'online';
          statusLabel = 'Online';
        } else if (diffMinutes <= 240) {
          status = 'away';
          statusLabel = 'Away (Sesi Aktif)';
        }
      } else {
        // Fallback for demo / seeded members: active rotation across engineers
        if (idx % 7 === 1 || idx % 7 === 2) {
          status = 'online';
          statusLabel = 'Online';
        } else if (idx % 7 === 3 || idx % 7 === 4) {
          status = 'away';
          statusLabel = 'Away (Sesi Aktif)';
        }
      }

      // Find group part name
      const grp = groups.find((g) => g.id === u.group_part_id);
      const groupName = grp ? grp.name : u.role === 'admin' ? 'System Administrator' : 'Production Engineer';

      return {
        ...u,
        presenceStatus: status,
        presenceLabel: statusLabel,
        groupName,
      };
    });
  }, [users, user, groups]);

  // Presence counts
  const presenceCounts = useMemo(() => {
    const online = membersWithPresence.filter((m) => m.presenceStatus === 'online').length;
    const away = membersWithPresence.filter((m) => m.presenceStatus === 'away').length;
    const offline = membersWithPresence.filter((m) => m.presenceStatus === 'offline').length;
    return { online, away, offline, total: membersWithPresence.length };
  }, [membersWithPresence]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (memberFilter === 'online') return membersWithPresence.filter((m) => m.presenceStatus === 'online');
    if (memberFilter === 'away') return membersWithPresence.filter((m) => m.presenceStatus === 'away');
    if (memberFilter === 'offline') return membersWithPresence.filter((m) => m.presenceStatus === 'offline');
    return membersWithPresence;
  }, [membersWithPresence, memberFilter]);

  // Milestone Task Stage Breakdown
  const milestoneStageCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    projects.forEach((p) => {
      const prog = Number(p.progress) || 0;
      if (prog >= 100) counts[5]++;
      else if (prog >= 80) counts[4]++;
      else if (prog >= 60) counts[3]++;
      else if (prog >= 40) counts[2]++;
      else counts[1]++;
    });
    return counts;
  }, [projects]);

  if (loading) {
    return <LoadingState message={t('dashboard.loading', 'Memuat metrik dan Bento Hub SEIN PE-Portal...')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  // 8 Bento Quick Navigation Operations
  const bentoOperations = [
    {
      title: 'Task Analyst',
      subtitle: 'Problem Solving 5-Tahap & Milestone',
      icon: FolderKanban,
      link: '/projects',
      badge: `${projects.length} Tasks`,
      accentColor: '#3b82f6',
    },
    {
      title: 'Innovation & Kaizen',
      subtitle: 'Knowledge Sharing & Best Practice',
      icon: Lightbulb,
      link: '/innovations',
      badge: `${stats?.innovations_count ?? 0} Ide`,
      accentColor: '#f59e0b',
    },
    {
      title: 'New Models Specs',
      subtitle: 'Line Readiness & MP Model Param',
      icon: Cpu,
      link: '/models',
      badge: `${stats?.models_count ?? 0} Model`,
      accentColor: '#06b6d4',
    },
    {
      title: 'Sample Management',
      subtitle: 'In/Out Tracking Unit Prototype',
      icon: PackageCheck,
      link: '/samples',
      badge: 'Aktif',
      accentColor: '#10b981',
    },
    {
      title: 'Artikel & Catatan Teknis',
      subtitle: 'Troubleshooting & Panduan Standar',
      icon: Newspaper,
      link: '/articles',
      badge: 'Solusi',
      accentColor: '#6366f1',
    },
    {
      title: 'Document Vault',
      subtitle: 'Arsip Gambar & Technical Drawing',
      icon: FolderArchive,
      link: '/documents',
      badge: `${stats?.documents_count ?? 0} File`,
      accentColor: '#8b5cf6',
    },
    {
      title: 'Training Online',
      subtitle: 'Modul Pelatihan & Skill Engineer',
      icon: GraduationCap,
      link: '/training',
      badge: `${stats?.trainings_count ?? 0} Modul`,
      accentColor: '#10b981',
    },
    {
      title: 'Video Compressor (VAAPI)',
      subtitle: 'Kompres Video GPU Linux & CPU',
      icon: Video,
      link: '/tools/video-compress',
      badge: 'H.264 GPU',
      accentColor: '#2563eb',
    },
    {
      title: 'PDF & Media Tools',
      subtitle: 'Kompres Dokumen & Convert Format',
      icon: Wrench,
      link: '/tools/documents',
      badge: 'Utility',
      accentColor: '#ec4899',
    },
    {
      title: 'AI Remove Background',
      subtitle: 'Isolasi Gambar Part Produksi Cepat',
      icon: Scissors,
      link: '/tools/remove-bg',
      badge: 'Local AI',
      accentColor: '#14b8a6',
    },
  ];

  return (
    <div className={styles.container}>
      {/* ========================================================================= */}
      {/* 1. HERO BENTO CARD: ENGINEER IDENTITY & PRODUCTION SHIFT                 */}
      {/* ========================================================================= */}
      <div className={styles.heroBento}>
        <div className={styles.heroLeft}>
          <div className={styles.heroAvatarBox}>
            <Avatar name={user?.full_name || 'Engineer'} src={user?.avatar_path} size="lg" />
            <span className={styles.avatarOnlineDot} title="Akun Anda Sedang Aktif" />
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroTags}>
              <span className={styles.groupBadge}>
                {user?.group_part_name || 'Production Engineering'}
              </span>
              <span className={styles.roleBadge}>
                {user?.role || 'Member'}
              </span>
            </div>
            <h1 className={styles.heroGreeting}>
              {t('dashboard.welcome', 'Selamat Datang')}, {user?.full_name || 'Engineer'}
            </h1>
            <p className={styles.heroSubtitle}>
              {t('dashboard.subtitle', 'Platform Kolaborasi & Pemantauan Operasional Divisi SEIN PE Group')}
            </p>
          </div>
        </div>

        {/* Live Production Shift Status */}
        <div className={styles.shiftCard}>
          <div className={styles.shiftTop}>
            <div className={styles.livePulse}>
              <span className={styles.pulseRing} />
              <span className={styles.pulseDot} />
            </div>
            <span className={styles.shiftName}>{currentShift.name}</span>
          </div>
          <div className={styles.clockDisplay}>
            <Clock size={15} className={styles.clockIcon} />
            <span>
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
            </span>
          </div>
          <span className={styles.shiftHours}>{t('dashboard.shift_schedule', 'Jadwal Produksi')}: {currentShift.time}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CORE KPI STATS ROW (Clean typography, zero title icon spam)            */}
      {/* ========================================================================= */}
      <div className={styles.statsRow}>
        <div className={styles.kpiCard} onClick={() => navigate('/projects')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>{t('dashboard.stats.task_analyst', 'Task Analyst')}</span>
          </div>
          <div className={styles.kpiValue}>{stats?.projects_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>
              {t('dashboard.stats.completed_running', {
                completed: projects.filter((p) => p.status === 'completed').length,
                running: projects.filter((p) => p.status !== 'completed').length,
                defaultValue: `${projects.filter((p) => p.status === 'completed').length} Selesai • ${projects.filter((p) => p.status !== 'completed').length} Berjalan`,
              })}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/innovations')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>{t('dashboard.stats.innovations', 'Inovasi & Kaizen')}</span>
          </div>
          <div className={styles.kpiValue}>{stats?.innovations_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>{t('dashboard.stats.verified_bp', 'Best Practice Terverifikasi')}</span>
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/training')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>{t('dashboard.stats.online_training', 'Online Training')}</span>
          </div>
          <div className={styles.kpiValue}>{stats?.trainings_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>{t('dashboard.stats.training_sub', 'Modul & Kursus Interaktif')}</span>
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/models')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>{t('dashboard.stats.new_models', 'New Models')}</span>
          </div>
          <div className={styles.kpiValue}>{stats?.models_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>{t('dashboard.stats.model_param', 'Parameter Line & Setting')}</span>
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/documents')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>{t('dashboard.stats.documents', 'Dokumen Teknik')}</span>
          </div>
          <div className={styles.kpiValue}>{stats?.documents_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>{t('dashboard.stats.protected_sharing', 'Protected File Sharing')}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOOLS MEDIA & OFFLINE AI QUICK LAUNCH TRAY                            */}
      {/* ponytail: lightweight horizontal access to offline tools                  */}
      {/* ========================================================================= */}
      <div className={styles.quickLaunchSection}>
        <div className={styles.quickLaunchHeader}>
          <h3 className={styles.quickLaunchTitle}>
            <Zap size={16} style={{ color: 'var(--color-accent)' }} />
            <span>{t('dashboard.quick_launch_title', 'Tools Media & Offline AI Quick Launch')}</span>
          </h3>
          <span className={styles.quickLaunchSub}>{t('dashboard.quick_launch_sub', 'Pemrosesan cepat tanpa pihak ketiga')}</span>
        </div>
        <div className={styles.quickLaunchGrid}>
          <div
            className={styles.quickLaunchItem}
            onClick={() => navigate('/tools/video-compress')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.quickLaunchIconWrap} ${styles.iconBlue}`}>
              <Video size={16} />
            </div>
            <div className={styles.quickLaunchText}>
              <span className={styles.quickLaunchName}>Video Compressor</span>
              <span className={styles.quickLaunchDesc}>H.264 VAAPI (Linux GPU)</span>
            </div>
          </div>

          <div
            className={styles.quickLaunchItem}
            onClick={() => navigate('/tools/remove-bg')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.quickLaunchIconWrap} ${styles.iconCyan}`}>
              <Scissors size={16} />
            </div>
            <div className={styles.quickLaunchText}>
              <span className={styles.quickLaunchName}>AI Remove Background</span>
              <span className={styles.quickLaunchDesc}>Isolasi Part Lokal (WASM)</span>
            </div>
          </div>

          <div
            className={styles.quickLaunchItem}
            onClick={() => navigate('/tools/pdf-merge-split')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.quickLaunchItemWrap || styles.quickLaunchIconWrap} ${styles.iconAmber}`}>
              <Wrench size={16} />
            </div>
            <div className={styles.quickLaunchText}>
              <span className={styles.quickLaunchName}>PDF Merge & Split</span>
              <span className={styles.quickLaunchDesc}>Gabung & Potong Halaman</span>
            </div>
          </div>

          <div
            className={styles.quickLaunchItem}
            onClick={() => navigate('/tools/documents')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.quickLaunchIconWrap} ${styles.iconViolet}`}>
              <FolderArchive size={16} />
            </div>
            <div className={styles.quickLaunchText}>
              <span className={styles.quickLaunchName}>Konversi & Kompres</span>
              <span className={styles.quickLaunchDesc}>Dokumen & Format Gambar</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN BENTO GRID: OPERATIONS HUB, TEAM PRESENCE, AUDIT LOGS             */}
      {/* ========================================================================= */}
      <div className={styles.bentoGrid}>
        {/* LEFT COLUMN: Operations Menu Bento + Milestone Stages */}
        <div className={styles.leftCol}>
          {/* Operations Hub (8 Tiles) */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>{t('dashboard.operations_hub', 'Hub Operasional & Fitur Kerja')}</h2>
              </div>
              <span className={styles.sectionSub}>{t('dashboard.operations_sub', 'Akses cepat modul dan tooling teknis PE')}</span>
            </div>

            <div className={styles.tilesGrid}>
              {bentoOperations.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className={styles.opTile}
                    onClick={() => navigate(item.link)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.opTileTop}>
                      <div
                        className={styles.opIconContainer}
                        style={{ color: item.accentColor, backgroundColor: `${item.accentColor}18` }}
                      >
                        <Icon size={18} />
                      </div>
                      <span className={styles.opBadge}>{item.badge}</span>
                    </div>
                    <div className={styles.opTileBottom}>
                      <h3 className={styles.opTitle}>{item.title}</h3>
                      <p className={styles.opDesc}>{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5-Stage Problem Solving Distribution Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>{t('dashboard.milestone_title', 'Milestone Problem Solving (5-Tahap)')}</h2>
              </div>
              <span className={styles.sectionSub}>{t('dashboard.milestone_sub', 'Distribusi penyelesaian issue teknis produksi')}</span>
            </div>

            <div className={styles.milestoneGrid}>
              {MILESTONE_STAGES.map((st) => {
                const count = milestoneStageCounts[st.step] || 0;
                return (
                  <div key={st.step} className={styles.milestoneBox}>
                    <div className={styles.milestoneBoxTop}>
                      <span
                        className={styles.milestoneNumber}
                        style={{ backgroundColor: `${st.color}20`, color: st.color, borderColor: `${st.color}50` }}
                      >
                        {st.step}
                      </span>
                      <span className={styles.milestoneCount}>{count}</span>
                    </div>
                    <span className={styles.milestoneName}>{st.label}</span>
                    <div className={styles.milestoneBarTrack}>
                      <div
                        className={styles.milestoneBarFill}
                        style={{
                          width: `${Math.min(100, count > 0 ? (count / (projects.length || 1)) * 100 : 0)}%`,
                          backgroundColor: st.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Team Presence Card & Integrated Dual Accordion */}
        <div className={styles.rightCol}>
          {/* Team Presence & Active Sessions Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeaderCol}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className={styles.sectionTitleGroup}>
                  <h2 className={styles.sectionTitle}>{t('dashboard.team_presence_title', 'Status Sesi Anggota Tim')}</h2>
                </div>
                <button
                  type="button"
                  className={styles.viewTeamBtn}
                  onClick={() => navigate('/team')}
                  title="Lihat Struktur Tim Lengkap"
                >
                  {t('dashboard.view_all', 'Lihat Semua')}
                </button>
              </div>

              {/* Status summary pill */}
              <div className={styles.presenceSummaryBar}>
                <span className={styles.summaryItem}>
                  <span className={styles.dotOnline} /> {presenceCounts.online} Online
                </span>
                <span className={styles.summaryItem}>
                  <span className={styles.dotAway} /> {presenceCounts.away} Away
                </span>
                <span className={styles.summaryItem}>
                  <span className={styles.dotOffline} /> {presenceCounts.offline} Offline
                </span>
              </div>

              {/* Filter tabs */}
              <div className={styles.presenceTabs}>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'all' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('all')}
                >
                  {t('dashboard.filter_all', 'Semua')} ({presenceCounts.total})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'online' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('online')}
                >
                  {t('dashboard.filter_online', 'Online')} ({presenceCounts.online})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'away' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('away')}
                >
                  {t('dashboard.filter_away', 'Away')} ({presenceCounts.away})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'offline' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('offline')}
                >
                  {t('dashboard.filter_offline', 'Offline')} ({presenceCounts.offline})
                </button>
              </div>
            </div>

            {/* Member List with Presence Status Badges */}
            <div className={styles.memberList}>
              {filteredMembers.length === 0 ? (
                <div className={styles.emptyMembers}>{t('common.empty', 'Tidak ada data ditemukan')}</div>
              ) : (
                filteredMembers.map((m) => (
                  <div key={m.id} className={styles.memberRow}>
                    <div className={styles.memberAvatarWrap}>
                      <Avatar name={m.full_name || m.username} src={m.avatar_path} size="sm" />
                      <span
                        className={`${styles.presenceDot} ${
                          m.presenceStatus === 'online'
                            ? styles.dotOnline
                            : m.presenceStatus === 'away'
                            ? styles.dotAway
                            : styles.dotOffline
                        }`}
                        title={m.presenceLabel}
                      />
                    </div>

                    <div className={styles.memberDetails}>
                      <div className={styles.memberNameLine}>
                        <span className={styles.memberFullName}>{m.full_name || m.username}</span>
                        {user && String(user.id) === String(m.id) && (
                          <span className={styles.youBadge}>{t('dashboard.you_badge', 'Anda')}</span>
                        )}
                      </div>
                      <span className={styles.memberGroupPart}>{m.groupName}</span>
                    </div>

                    {/* Badge Kecil Informasi Status */}
                    <div
                      className={`${styles.statusChip} ${
                        m.presenceStatus === 'online'
                          ? styles.chipOnline
                          : m.presenceStatus === 'away'
                          ? styles.chipAway
                          : styles.chipOffline
                      }`}
                    >
                      <span className={styles.chipDot} />
                      <span>{m.presenceStatus === 'away' ? 'Away' : m.presenceLabel}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dual Accordion Card: Pembaruan Fitur Terbaru + Aktivitas Sistem Terkini */}
          <div className={styles.accordionCard}>
            {/* Section 1: Pembaruan Fitur Terbaru */}
            <div className={styles.accordionSection}>
              <button
                type="button"
                className={styles.accordionHeaderBtn}
                onClick={() => setUpdatesOpen((prev) => !prev)}
                aria-expanded={updatesOpen}
              >
                <div className={styles.accordionHeaderLeft}>
                  <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
                  <span className={styles.accordionHeaderTitle}>
                    {t('dashboard.feature_updates_title', 'Pembaruan Fitur')}
                  </span>
                  <span className={`${styles.accordionBadge} ${styles.badgeNew}`}>
                    {t('dashboard.feature_updates_badge', '3 Baru')}
                  </span>
                </div>
                {updatesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {updatesOpen && (
                <div className={styles.accordionBody}>
                  <div className={styles.compactSpotlightList}>
                    {/* Feature 1: Video Compressor */}
                    <div className={styles.compactSpotlightItem}>
                      <div className={styles.compactSpotlightTop}>
                        <div className={styles.compactSpotlightTitleWrap}>
                          <div className={`${styles.compactSpotlightIconBox} ${styles.iconBlue}`}>
                            <Video size={15} />
                          </div>
                          <h3 className={styles.compactSpotlightTitle}>
                            {t('dashboard.spotlights.video_title', 'Video Compressor (VAAPI)')}
                          </h3>
                        </div>
                        <span className={`${styles.spotlightBadge} ${styles.badgeBlue}`}>
                          {t('dashboard.spotlights.video_badge', 'Hardware Accelerated')}
                        </span>
                      </div>
                      <p className={styles.compactSpotlightDesc}>
                        {t('dashboard.spotlights.video_desc')}
                      </p>
                      <button
                        type="button"
                        className={styles.compactSpotlightBtn}
                        onClick={() => navigate('/tools/video-compress')}
                      >
                        <span>{t('dashboard.spotlights.video_btn', 'Buka Video Compressor')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {/* Feature 2: Online Training */}
                    <div className={styles.compactSpotlightItem}>
                      <div className={styles.compactSpotlightTop}>
                        <div className={styles.compactSpotlightTitleWrap}>
                          <div className={`${styles.compactSpotlightIconBox} ${styles.iconGreen}`}>
                            <GraduationCap size={15} />
                          </div>
                          <h3 className={styles.compactSpotlightTitle}>
                            {t('dashboard.spotlights.training_title', 'Online Training Platform')}
                          </h3>
                        </div>
                        <span className={`${styles.spotlightBadge} ${styles.badgeGreen}`}>
                          {t('dashboard.spotlights.training_badge', 'Admin Management')}
                        </span>
                      </div>
                      <p className={styles.compactSpotlightDesc}>
                        {t('dashboard.spotlights.training_desc')}
                      </p>
                      <button
                        type="button"
                        className={styles.compactSpotlightBtn}
                        onClick={() => navigate('/training')}
                      >
                        <span>{t('dashboard.spotlights.training_btn', 'Jelajahi Training Online')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {/* Feature 3: Document Vault */}
                    <div className={styles.compactSpotlightItem}>
                      <div className={styles.compactSpotlightTop}>
                        <div className={styles.compactSpotlightTitleWrap}>
                          <div className={`${styles.compactSpotlightIconBox} ${styles.iconViolet}`}>
                            <Share2 size={15} />
                          </div>
                          <h3 className={styles.compactSpotlightTitle}>
                            {t('dashboard.spotlights.doc_title', 'Document Sharing & Vault')}
                          </h3>
                        </div>
                        <span className={`${styles.spotlightBadge} ${styles.badgePurple}`}>
                          {t('dashboard.spotlights.doc_badge', 'Custom Access Rules')}
                        </span>
                      </div>
                      <p className={styles.compactSpotlightDesc}>
                        {t('dashboard.spotlights.doc_desc')}
                      </p>
                      <button
                        type="button"
                        className={styles.compactSpotlightBtn}
                        onClick={() => navigate('/documents')}
                      >
                        <span>{t('dashboard.spotlights.doc_btn', 'Buka Document Vault')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Aktivitas Sistem Terkini */}
            <div className={styles.accordionSection}>
              <button
                type="button"
                className={styles.accordionHeaderBtn}
                onClick={() => setLogsOpen((prev) => !prev)}
                aria-expanded={logsOpen}
              >
                <div className={styles.accordionHeaderLeft}>
                  <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                  <span className={styles.accordionHeaderTitle}>
                    {t('dashboard.recent_activity', 'Aktivitas Terkini')}
                  </span>
                  <span className={`${styles.accordionBadge} ${styles.badgeCount}`}>
                    {stats?.recent_logs?.length || 0}
                  </span>
                </div>
                {logsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {logsOpen && (
                <div className={styles.accordionBody}>
                  {stats?.recent_logs && stats.recent_logs.length > 0 ? (
                    <div className={styles.activityFeed}>
                      {stats.recent_logs.slice(0, 5).map((log) => (
                        <div key={log.id} className={styles.activityRow}>
                          <div className={styles.activityIconWrap}>
                            <Activity size={12} />
                          </div>
                          <div className={styles.activityContent}>
                            <div className={styles.activityLine}>
                              <strong className={styles.actUser}>{log.user_name || 'System User'}</strong>
                              <span className={styles.actAction}>{log.action}</span>
                            </div>
                            <span className={styles.actTime}>
                              <Clock size={10} style={{ opacity: 0.6 }} />
                              {new Date(log.created_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyActivity}>{t('dashboard.no_activity', 'Belum ada aktivitas tercatat.')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
