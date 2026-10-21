import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  Lightbulb,
  Cpu,
  FolderArchive,
  Users,
  PackageCheck,
  Newspaper,
  Wrench,
  Scissors,
  Activity,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Sparkles,
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
      title: 'Artikel & IMEI Wiki',
      subtitle: 'Troubleshooting & Panduan Standar',
      icon: Newspaper,
      link: '/imei',
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
            <Avatar name={user?.full_name || 'Engineer'} size="lg" />
            <span className={styles.avatarOnlineDot} title="Akun Anda Sedang Aktif" />
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroTags}>
              <span className={styles.groupBadge}>
                <Layers size={11} /> {user?.group_part_name || 'Production Engineering'}
              </span>
              <span className={styles.roleBadge}>
                <ShieldCheck size={11} /> {user?.role || 'Member'}
              </span>
            </div>
            <h1 className={styles.heroGreeting}>
              {t('dashboard.welcome', 'Selamat Datang')}, {user?.full_name || 'Engineer'}
            </h1>
            <p className={styles.heroSubtitle}>
              Platform Kolaborasi & Pemantauan Operasional Divisi SEIN PE Group
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
          <span className={styles.shiftHours}>Jadwal Produksi: {currentShift.time}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CORE KPI STATS ROW                                                     */}
      {/* ========================================================================= */}
      <div className={styles.statsRow}>
        <div className={styles.kpiCard} onClick={() => navigate('/projects')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Task Analyst</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconBlue}`}>
              <FolderKanban size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.projects_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>{projects.filter((p) => p.status === 'completed').length} Selesai • {projects.filter((p) => p.status !== 'completed').length} Dalam Proses</span>
            <ArrowRight size={13} />
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/innovations')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Inovasi & Kaizen</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconAmber}`}>
              <Lightbulb size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.innovations_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>Best Practice Terverifikasi</span>
            <ArrowRight size={13} />
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/models')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>New Models</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconCyan}`}>
              <Cpu size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.models_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>Parameter Line & Setting</span>
            <ArrowRight size={13} />
          </div>
        </div>

        <div className={styles.kpiCard} onClick={() => navigate('/documents')}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Dokumen Teknik</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconViolet}`}>
              <FolderArchive size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.documents_count ?? 0}</div>
          <div className={styles.kpiFooter}>
            <span>Drawing & Standar SOP</span>
            <ArrowRight size={13} />
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
                <Sparkles size={16} color="var(--color-accent)" />
                <h2 className={styles.sectionTitle}>Hub Operasional & Fitur Kerja</h2>
              </div>
              <span className={styles.sectionSub}>Akses cepat modul dan tooling teknis PE</span>
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
                    <ChevronRight size={14} className={styles.opArrow} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5-Stage Problem Solving Distribution Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <CheckCircle2 size={16} color="var(--color-accent)" />
                <h2 className={styles.sectionTitle}>Milestone Problem Solving (5-Tahap)</h2>
              </div>
              <span className={styles.sectionSub}>Distribusi penyelesaian issue teknis produksi</span>
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

        {/* RIGHT COLUMN: Team Presence Card & Recent Logs */}
        <div className={styles.rightCol}>
          {/* Team Presence & Active Sessions Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeaderCol}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className={styles.sectionTitleGroup}>
                  <Users size={16} color="var(--color-accent)" />
                  <h2 className={styles.sectionTitle}>Status Sesi Anggota Tim</h2>
                </div>
                <button
                  type="button"
                  className={styles.viewTeamBtn}
                  onClick={() => navigate('/team')}
                  title="Lihat Struktur Tim Lengkap"
                >
                  Lihat Semua
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
                  Semua ({presenceCounts.total})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'online' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('online')}
                >
                  Online ({presenceCounts.online})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'away' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('away')}
                >
                  Away ({presenceCounts.away})
                </button>
                <button
                  type="button"
                  className={`${styles.presenceTabBtn} ${memberFilter === 'offline' ? styles.presenceTabActive : ''}`}
                  onClick={() => setMemberFilter('offline')}
                >
                  Offline ({presenceCounts.offline})
                </button>
              </div>
            </div>

            {/* Member List with Presence Status Badges */}
            <div className={styles.memberList}>
              {filteredMembers.length === 0 ? (
                <div className={styles.emptyMembers}>Tidak ada anggota di kategori ini</div>
              ) : (
                filteredMembers.map((m) => (
                  <div key={m.id} className={styles.memberRow}>
                    <div className={styles.memberAvatarWrap}>
                      <Avatar name={m.full_name || m.username} size="sm" />
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
                          <span className={styles.youBadge}>Anda</span>
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

          {/* Recent Activity Logs */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Activity size={16} color="var(--color-accent)" />
                <h2 className={styles.sectionTitle}>{t('dashboard.recent_activity', 'Aktivitas Terkini')}</h2>
              </div>
            </div>

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
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
