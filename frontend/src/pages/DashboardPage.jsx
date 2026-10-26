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
  Activity,
  Clock,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  Target,
  ExternalLink,
  Layers,
  Flame,
  CheckSquare,
  CalendarPlus,
  Truck,
  MapPin,
  Package,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { CustomHolidayModal } from '../components/common/CustomHolidayModal';
import { getIndonesianHoliday, isWeekend } from '../utils/indonesianHolidays';
import styles from './DashboardPage.module.css';

// 5 Milestone Problem Solving Stages
const MILESTONE_STAGES = [
  { step: 1, label: 'Issue Identified', percent: 20, color: '#ef4444' },
  { step: 2, label: 'Root Cause Analysis', percent: 40, color: '#f59e0b' },
  { step: 3, label: 'Trial Countermeasure', percent: 60, color: '#3b82f6' },
  { step: 4, label: 'Verification & Yield', percent: 80, color: '#8b5cf6' },
  { step: 5, label: 'Closed & Standardized', percent: 100, color: '#10b981' },
];

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Safe date string formatter 'YYYY-MM-DD'
const formatDateStr = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [dhlShipments, setDhlShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberFilter, setMemberFilter] = useState('all'); // 'all' | 'online' | 'away' | 'offline'
  const [currentTime, setCurrentTime] = useState(new Date());

  // Interactive Monthly Calendar State
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => new Date());
  const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState(() => formatDateStr(new Date()));
  const [isCustomHolidayModalOpen, setIsCustomHolidayModalOpen] = useState(false);
  const [customHolidaysVersion, setCustomHolidaysVersion] = useState(0);

  // Sync custom holidays reactively across calendar views
  useEffect(() => {
    const handleSync = () => setCustomHolidaysVersion((v) => v + 1);
    window.addEventListener('customHolidaysChanged', handleSync);
    return () => window.removeEventListener('customHolidaysChanged', handleSync);
  }, []);

  // Real-time clock for production shift tracking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current production shift
  const currentShift = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 7 && hour < 15.5) return { name: t('dashboard.shift_1', 'Shift 1 (Pagi)'), time: '07:00 - 15:30' };
    if (hour >= 15.5 && hour < 23.5) return { name: t('dashboard.shift_2', 'Shift 2 (Sore)'), time: '15:30 - 23:30' };
    return { name: t('dashboard.shift_3', 'Shift 3 (Malam)'), time: '23:30 - 07:00' };
  }, [currentTime, t]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, projectsRes, groupsRes, dhlRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: {} })),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/groups').catch(() => ({ data: [] })),
        api.get('/dhl/shipments').catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data || {});
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setDhlShipments(Array.isArray(dhlRes.data) ? dhlRes.data : []);
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
        if (idx % 7 === 1 || idx % 7 === 2) {
          status = 'online';
          statusLabel = 'Online';
        } else if (idx % 7 === 3 || idx % 7 === 4) {
          status = 'away';
          statusLabel = 'Away (Sesi Aktif)';
        }
      }

      let groupName = u.role === 'admin' ? 'System Administrator' : 'Production Engineer';
      if (Array.isArray(u.group_part_names) && u.group_part_names.length > 0) {
        groupName = u.group_part_names.join(', ');
      } else if (u.group_part_id) {
        const grp = groups.find((g) => g.id === u.group_part_id);
        if (grp) groupName = grp.name;
      }

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

  // DHL Shipments Summary Metrics
  const dhlStats = useMemo(() => {
    const total = dhlShipments.length;
    const inTransit = dhlShipments.filter((s) => s.status_code === 'transit').length;
    const delivered = dhlShipments.filter((s) => s.status_code === 'delivered').length;
    const waitingPickup = dhlShipments.filter((s) => !s.is_collected).length;
    return { total, inTransit, delivered, waitingPickup };
  }, [dhlShipments]);

  // Calculated Rich Task Statistics
  const richStats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === 'completed' || Number(p.progress) >= 100).length;
    const inProgress = projects.filter(
      (p) => (p.status === 'in_progress' || (Number(p.progress) > 0 && Number(p.progress) < 100)) && p.status !== 'completed'
    ).length;
    const planning = projects.filter(
      (p) => (p.status === 'planning' || Number(p.progress) === 0) && p.status !== 'completed'
    ).length;
    const urgent = projects.filter((p) => p.priority === 'urgent').length;
    const high = projects.filter((p) => p.priority === 'high').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgProgress = total > 0 ? Math.round(projects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0) / total) : 0;

    return {
      total,
      completed,
      inProgress,
      planning,
      urgent,
      high,
      completionRate,
      avgProgress,
    };
  }, [projects]);

  // Map Tasks by date for Monthly Calendar Widget
  const tasksByDate = useMemo(() => {
    const map = {};
    projects.forEach((proj) => {
      let start = proj.start_date ? proj.start_date.substring(0, 10) : '';
      let end = proj.target_date ? proj.target_date.substring(0, 10) : '';
      if (!start && !end) {
        if (proj.created_at) {
          start = proj.created_at.substring(0, 10);
          end = start;
        } else {
          return;
        }
      } else if (!start) {
        start = end;
      } else if (!end) {
        end = start;
      }
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }

      const dStart = new Date(start + 'T00:00:00');
      const dEnd = new Date(end + 'T00:00:00');
      const cur = new Date(dStart);
      let count = 0;
      while (cur <= dEnd && count < 62) {
        const dKey = formatDateStr(cur);
        if (!map[dKey]) map[dKey] = [];
        map[dKey].push(proj);
        cur.setDate(cur.getDate() + 1);
        count++;
      }
    });
    return map;
  }, [projects]);

  // Calendar Month Grid Generation
  const calendarYear = calendarMonthDate.getFullYear();
  const calendarMonth = calendarMonthDate.getMonth(); // 0-11
  const todayStr = useMemo(() => formatDateStr(currentTime), [currentTime]);

  const calendarGridCells = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday

    const cells = [];
    // Previous month filler days
    const prevMonthDaysCount = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDaysCount - i;
      const prevDate = new Date(calendarYear, calendarMonth - 1, dayNum);
      const dateStr = formatDateStr(prevDate);
      cells.push({
        date: prevDate,
        dayNum,
        dateStr,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(calendarYear, calendarMonth, d);
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        date: currDate,
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete weeks
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let n = 1; n <= remaining; n++) {
        const nextDate = new Date(calendarYear, calendarMonth + 1, n);
        const dateStr = formatDateStr(nextDate);
        cells.push({
          date: nextDate,
          dayNum: n,
          dateStr,
          isCurrentMonth: false,
        });
      }
    }

    return cells;
  }, [calendarYear, calendarMonth, customHolidaysVersion]);

  // Month Statistics for Calendar
  const monthCalendarSummary = useMemo(() => {
    let holidaysCount = 0;
    let workingDaysCount = 0;
    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(calendarYear, calendarMonth, d);
      const h = getIndonesianHoliday(dStr);
      const weekend = isWeekend(dObj);
      if (h || weekend) {
        if (h) holidaysCount++;
      } else {
        workingDaysCount++;
      }
    }

    const tasksThisMonth = projects.filter((p) => {
      const start = p.start_date ? p.start_date.substring(0, 7) : '';
      const end = p.target_date ? p.target_date.substring(0, 7) : '';
      return start === monthPrefix || end === monthPrefix;
    }).length;

    return {
      holidaysCount,
      workingDaysCount,
      tasksThisMonth,
    };
  }, [calendarYear, calendarMonth, projects, customHolidaysVersion]);

  // Selected date tasks
  const selectedDateTasks = useMemo(() => {
    return tasksByDate[selectedCalendarDateStr] || [];
  }, [tasksByDate, selectedCalendarDateStr]);

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    const now = new Date();
    setCalendarMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedCalendarDateStr(formatDateStr(now));
  };

  if (loading) {
    return <LoadingState message={t('dashboard.loading', 'Memuat metrik dan Bento Hub SEIN PE-Portal...')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  // 8 Bento Quick Navigation Operations (Clean Engineering Core - No Document Tools Shortcuts)
  const bentoOperations = [
    {
      title: t('dashboard.bento_task_board', 'Task Board (ToDo)'),
      subtitle: t('dashboard.bento_task_board_desc', 'Problem Solving 5-Tahap & Milestone'),
      icon: FolderKanban,
      link: '/projects',
      badge: `${projects.length} Tasks`,
      accentColor: '#3b82f6',
    },
    {
      title: t('dashboard.bento_calendar', 'Project Calendar'),
      subtitle: t('dashboard.bento_calendar_desc', 'Kalender Kerja & Timeline Milestone'),
      icon: CalendarDays,
      link: '/project-calendar',
      badge: 'Monthly / Yearly',
      accentColor: '#6366f1',
    },
    {
      title: t('dashboard.bento_innovations', 'Inovasi & Improvement (BP)'),
      subtitle: t('dashboard.bento_innovations_desc', 'Knowledge Sharing & Best Practice'),
      icon: Lightbulb,
      link: '/innovations',
      badge: `${stats?.innovations_count ?? 0} Ide`,
      accentColor: '#f59e0b',
    },
    {
      title: t('dashboard.bento_models', 'New Models Specs'),
      subtitle: t('dashboard.bento_models_desc', 'Line Readiness & MP Model Param'),
      icon: Cpu,
      link: '/models',
      badge: `${stats?.models_count ?? 0} Model`,
      accentColor: '#06b6d4',
    },
    {
      title: t('dashboard.bento_samples', 'Sample Management'),
      subtitle: t('dashboard.bento_samples_desc', 'In/Out Tracking Unit Prototype'),
      icon: PackageCheck,
      link: '/samples',
      badge: 'Aktif',
      accentColor: '#10b981',
    },
    {
      title: t('dashboard.bento_gmes', 'Line Monitor GMES'),
      subtitle: t('dashboard.bento_gmes_desc', 'Pemantauan Status Line & Equipment'),
      icon: Activity,
      link: '/gmes',
      badge: 'Real-time',
      accentColor: '#ec4899',
    },
    {
      title: t('dashboard.bento_articles', 'Artikel & Catatan Teknis'),
      subtitle: t('dashboard.bento_articles_desc', 'Troubleshooting & Panduan Standar'),
      icon: Newspaper,
      link: '/articles',
      badge: 'Solusi',
      accentColor: '#8b5cf6',
    },
    {
      title: t('dashboard.bento_training', 'Training Online'),
      subtitle: t('dashboard.bento_training_desc', 'Modul Pelatihan & Skill Engineer'),
      icon: GraduationCap,
      link: '/training',
      badge: `${stats?.trainings_count ?? 0} Modul`,
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
      {/* 2. RICH ENGINEERING METRICS & KPI BENTO GRID                             */}
      {/* ========================================================================= */}
      <div className={styles.statsSection}>
        <div className={styles.statsHeader}>
          <div className={styles.sectionTitleGroup}>
            <Target size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className={styles.sectionTitle}>Ringkasan Metrik & Kinerja Operasional</h2>
          </div>
          <span className={styles.sectionSub}>Statistik terintegrasi divisi Production Engineering</span>
        </div>

        <div className={styles.richStatsGrid}>
          {/* 1. Total Task Analyst & Completion */}
          <div className={styles.richStatCard} onClick={() => navigate('/projects')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconBlue}`}>
                <FolderKanban size={17} />
              </div>
              <span className={styles.statBadgeBlue}>{richStats.completionRate}% {t('dashboard.completed', 'Selesai')}</span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>{richStats.total}</span>
              <span className={styles.richStatLabel}>{t('dashboard.task_board', 'Task Board')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div
                className={styles.richStatProgressFill}
                style={{ width: `${richStats.completionRate}%`, backgroundColor: '#3b82f6' }}
              />
            </div>
            <div className={styles.richStatSub}>
              <span>{richStats.completed} {t('dashboard.completed', 'Selesai')}</span>
              <span>•</span>
              <span>{richStats.inProgress} {t('dashboard.running', 'Berjalan')}</span>
            </div>
          </div>

          {/* 2. Inovasi & Kaizen (BP) */}
          <div className={styles.richStatCard} onClick={() => navigate('/innovations')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconAmber}`}>
                <Lightbulb size={17} />
              </div>
              <span className={styles.statBadgeAmber}>Best Practice</span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>{stats?.innovations_count ?? 0}</span>
              <span className={styles.richStatLabel}>{t('dashboard.innovations_improvement', 'Inovasi & Improvement')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div className={styles.richStatProgressFill} style={{ width: '85%', backgroundColor: '#f59e0b' }} />
            </div>
            <div className={styles.richStatSub}>
              <span>{t('dashboard.innovation_pipeline', 'Pipeline Inovasi Aktif SEIN')}</span>
            </div>
          </div>

          {/* 4. New Models MP Specs */}
          <div className={styles.richStatCard} onClick={() => navigate('/models')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconCyan}`}>
                <Cpu size={17} />
              </div>
              <span className={styles.statBadgeCyan}>Line Parameter</span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>{stats?.models_count ?? 0}</span>
              <span className={styles.richStatLabel}>{t('dashboard.new_models_mp', 'New Models MP')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div className={styles.richStatProgressFill} style={{ width: '70%', backgroundColor: '#06b6d4' }} />
            </div>
            <div className={styles.richStatSub}>
              <span>{t('dashboard.line_readiness', 'Kesiapan Line & SOP Setting')}</span>
            </div>
          </div>

          {/* 5. Unit Sampel Prototype */}
          <div className={styles.richStatCard} onClick={() => navigate('/samples')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconGreen}`}>
                <PackageCheck size={17} />
              </div>
              <span className={styles.statBadgeGreen}>In/Out Track</span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>{stats?.samples_count ?? 14}</span>
              <span className={styles.richStatLabel}>{t('dashboard.sample_units', 'Sampel Unit')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div className={styles.richStatProgressFill} style={{ width: '90%', backgroundColor: '#10b981' }} />
            </div>
            <div className={styles.richStatSub}>
              <span>{t('dashboard.sample_units_sub', 'Unit Uji Prototype & Sample')}</span>
            </div>
          </div>

          {/* 6. Training & Upskilling */}
          <div className={styles.richStatCard} onClick={() => navigate('/training')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconTeal}`}>
                <GraduationCap size={17} />
              </div>
              <span className={styles.statBadgeTeal}>Kompetensi</span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>{stats?.trainings_count ?? 0}</span>
              <span className={styles.richStatLabel}>{t('dashboard.online_training', 'Online Training')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div className={styles.richStatProgressFill} style={{ width: '65%', backgroundColor: '#14b8a6' }} />
            </div>
            <div className={styles.richStatSub}>
              <span>{t('dashboard.training_sub', 'Modul Interaktif & Video')}</span>
            </div>
          </div>

          {/* 6. Active Team Presence */}
          <div className={styles.richStatCard} onClick={() => navigate('/team')}>
            <div className={styles.richStatTop}>
              <div className={`${styles.richStatIcon} ${styles.iconIndigo}`}>
                <Users size={17} />
              </div>
              <span className={styles.statBadgeIndigo}>
                {presenceCounts.online + presenceCounts.away} {t('dashboard.active', 'Aktif')}
              </span>
            </div>
            <div className={styles.richStatMain}>
              <span className={styles.richStatValue}>
                {presenceCounts.online + presenceCounts.away}/{presenceCounts.total}
              </span>
              <span className={styles.richStatLabel}>{t('dashboard.engineer_on_duty', 'Engineer On-Duty')}</span>
            </div>
            <div className={styles.richStatProgressTrack}>
              <div
                className={styles.richStatProgressFill}
                style={{
                  width: `${Math.min(100, ((presenceCounts.online + presenceCounts.away) / (presenceCounts.total || 1)) * 100)}%`,
                  backgroundColor: '#6366f1',
                }}
              />
            </div>
            <div className={styles.richStatSub}>
              <span>{presenceCounts.online} Online</span>
              <span>•</span>
              <span>{presenceCounts.away} Away</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN BENTO GRID: OPERATIONS, WORK CALENDAR, PRESENCE, LOGS & NOTIFS    */}
      {/* ========================================================================= */}
      <div className={styles.bentoGrid}>
        {/* LEFT COLUMN: Operations Hub + Monthly Work Calendar + Milestone Breakdown */}
        <div className={styles.leftCol}>
          {/* Operations Hub (8 Clean Engineering Tiles) */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Layers size={16} style={{ color: 'var(--color-accent)' }} />
                <h2 className={styles.sectionTitle}>{t('dashboard.operations_hub', 'Operations & Engineering Hub')}</h2>
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

          {/* MONTHLY ENGINEERING WORK CALENDAR BENTO CARD */}
          <div className={styles.bentoSection}>
            <div className={styles.calendarCardHeader}>
              <div className={styles.calendarTitleArea}>
                <div className={styles.sectionTitleGroup}>
                  <CalendarDays size={18} style={{ color: 'var(--color-accent)' }} />
                  <h2 className={styles.sectionTitle}>
                    {t('dashboard.monthly_calendar_title', {
                      month: ((t('dashboard.month_names', { returnObjects: true }) || MONTH_NAMES_ID)[calendarMonth]),
                      year: calendarYear,
                      defaultValue: `Kalender Kerja Bulanan: ${MONTH_NAMES_ID[calendarMonth]} ${calendarYear}`
                    })}
                  </h2>
                </div>
                <span className={styles.sectionSub}>
                  {t('dashboard.monthly_calendar_sub', 'Timeline jadwal kerja, milestone task, dan hari libur nasional Indonesia')}
                </span>
              </div>

              <div className={styles.calendarControls}>
                <div className={styles.monthNavGroup}>
                  <button
                    type="button"
                    className={styles.calNavBtn}
                    onClick={handlePrevMonth}
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className={styles.calTodayBtn}
                    onClick={handleTodayMonth}
                    title="Kembali ke Hari Ini"
                  >
                    {t('dashboard.btn_today', 'Hari Ini')}
                  </button>
                  <button
                    type="button"
                    className={styles.calNavBtn}
                    onClick={handleNextMonth}
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    className={styles.addCustomHolidayBtn}
                    onClick={() => setIsCustomHolidayModalOpen(true)}
                    title="Tambah atau kelola tanggal libur"
                  >
                    <CalendarPlus size={13} />
                    <span>{t('dashboard.btn_holiday', '+ Libur')}</span>
                  </button>
                )}

                <button
                  type="button"
                  className={styles.openFullCalBtn}
                  onClick={() => navigate('/project-calendar')}
                >
                  <span>{t('dashboard.btn_open_calendar', 'Buka Kalender Kerja')}</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>

            {/* Calendar Month Matrix Grid */}
            <div className={styles.miniCalendarContainer}>
              {/* Day Name Headers (Min - Sab) */}
              <div className={styles.miniWeekHeaders}>
                {(t('dashboard.day_names', { returnObjects: true }) || DAY_NAMES_ID).map((dName, idx) => (
                  <div
                    key={dName}
                    className={`${styles.miniWeekHeaderCell} ${idx === 0 || idx === 6 ? styles.headerWeekend : ''}`}
                  >
                    {dName}
                  </div>
                ))}
              </div>

              {/* Day Cells Matrix */}
              <div className={styles.miniDayGrid}>
                {calendarGridCells.map((cell, idx) => {
                  const holiday = getIndonesianHoliday(cell.dateStr);
                  const isWeekendDay = isWeekend(cell.date);
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedCalendarDateStr;
                  const dayTasks = tasksByDate[cell.dateStr] || [];

                  return (
                    <div
                      key={idx}
                      className={`
                        ${styles.miniDayCell}
                        ${!cell.isCurrentMonth ? styles.cellOtherMonth : ''}
                        ${holiday ? styles.cellHoliday : ''}
                        ${isWeekendDay && !holiday ? styles.cellWeekend : ''}
                        ${isToday ? styles.cellToday : ''}
                        ${isSelected ? styles.cellSelected : ''}
                      `}
                      onClick={() => setSelectedCalendarDateStr(cell.dateStr)}
                      title={holiday ? `${cell.dateStr}: ${holiday.name}` : cell.dateStr}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.cellDayNumberBox}>
                        <span className={styles.cellDayNum}>{cell.dayNum}</span>
                        {holiday && <span className={styles.miniHolidayDot} />}
                      </div>

                      {/* Task Count / Milestone Dots */}
                      {dayTasks.length > 0 && (
                        <div className={styles.cellTaskPill}>
                          <span className={styles.cellTaskCount}>{dayTasks.length} Task</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calendar Bottom Summary & Selected Day Tasks Preview */}
            <div className={styles.calBottomSummaryBar}>
              <div className={styles.calMetricsChips}>
                <span className={styles.calChip}>
                  <strong>{monthCalendarSummary.workingDaysCount}</strong> Hari Kerja
                </span>
                <span className={`${styles.calChip} ${styles.chipHoliday}`}>
                  <strong>{monthCalendarSummary.holidaysCount}</strong> Libur / Cuti
                </span>
                <span className={styles.calChip}>
                  <strong>{monthCalendarSummary.tasksThisMonth}</strong> Task Terjadwal
                </span>
              </div>

              <div className={styles.selectedDayInfo}>
                <span className={styles.selectedDayLabel}>
                  Detail {selectedCalendarDateStr}:
                </span>
                {selectedDateTasks.length > 0 ? (
                  <span className={styles.selectedDayCount}>
                    {selectedDateTasks.length} task aktif ({selectedDateTasks.slice(0, 2).map((t) => t.title || t.name).join(', ')}
                    {selectedDateTasks.length > 2 ? '...' : ''})
                  </span>
                ) : (
                  <span className={styles.selectedDayEmpty}>Tidak ada task pada tanggal ini</span>
                )}
              </div>
            </div>
          </div>

          {/* 5-Stage Problem Solving Distribution Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Flame size={16} style={{ color: 'var(--color-accent)' }} />
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

        {/* RIGHT COLUMN: Team Presence + SEPARATED Notifications Card + SEPARATED Activity Logs Card */}
        <div className={styles.rightCol}>
          {/* 1. Team Presence & Active Sessions Card */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeaderCol}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className={styles.sectionTitleGroup}>
                  <Users size={16} style={{ color: 'var(--color-accent)' }} />
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
                filteredMembers.slice(0, 8).map((m) => (
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
                      <div className={styles.memberGroupPart} title={m.groupName}>
                        {m.groupName}
                      </div>
                    </div>

                    {/* Badge Informasi Status */}
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

          {/* 2. DEDICATED BENTO CARD: STATUS DHL SHIPMENT TRACKER */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Truck size={17} style={{ color: '#d97706' }} />
                <h2 className={styles.sectionTitle}>{t('dashboard.dhl_tracker_title', 'Status DHL Shipment Tracker')}</h2>
              </div>
              <button
                type="button"
                className={styles.dhlTrackerLinkBtn}
                onClick={() => navigate('/samples/dhl-tracker')}
                title={t('dashboard.dhl_open_tracker', 'Buka Tracker')}
              >
                <span>{t('dashboard.dhl_open_tracker', 'Buka Tracker')}</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* DHL Metric Badges Bar */}
            <div className={styles.dhlMetricsBar}>
              <div className={styles.dhlMetricItem}>
                <span className={styles.dhlMetricNum}>{dhlStats.total}</span>
                <span className={styles.dhlMetricLabel}>{t('dashboard.dhl_total', 'Total Shipment')}</span>
              </div>
              <div className={styles.dhlMetricDivider} />
              <div className={styles.dhlMetricItem}>
                <span className={`${styles.dhlMetricNum} ${styles.dhlNumTransit}`}>{dhlStats.inTransit}</span>
                <span className={styles.dhlMetricLabel}>{t('dashboard.dhl_transit', 'In Transit')}</span>
              </div>
              <div className={styles.dhlMetricDivider} />
              <div className={styles.dhlMetricItem}>
                <span className={`${styles.dhlMetricNum} ${styles.dhlNumDelivered}`}>{dhlStats.delivered}</span>
                <span className={styles.dhlMetricLabel}>{t('dashboard.dhl_delivered', 'Delivered')}</span>
              </div>
              <div className={styles.dhlMetricDivider} />
              <div className={styles.dhlMetricItem}>
                <span className={`${styles.dhlMetricNum} ${styles.dhlNumPickup}`}>{dhlStats.waitingPickup}</span>
                <span className={styles.dhlMetricLabel}>{t('dashboard.dhl_waiting_pickup', 'Belum Diambil')}</span>
              </div>
            </div>

            {/* Shipment Items List */}
            <div className={styles.dhlShipmentList}>
              {dhlShipments.length === 0 ? (
                <div className={styles.emptyDhl}>
                  <Package size={22} style={{ opacity: 0.5, marginBottom: 4 }} />
                  <span>{t('dashboard.dhl_empty', 'Tidak ada data tracking shipment aktif')}</span>
                </div>
              ) : (
                dhlShipments.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className={styles.dhlCard}
                    onClick={() => navigate('/samples/dhl-tracker')}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.dhlCardHeader}>
                      <div className={styles.dhlAwbGroup}>
                        <span className={styles.dhlAwb}>AWB #{item.id}</span>
                        {item.service_name && (
                          <span className={styles.dhlServiceBadge}>{item.service_name}</span>
                        )}
                      </div>
                      <span
                        className={`${styles.dhlStatusBadge} ${
                          item.status_code === 'delivered'
                            ? styles.badgeDelivered
                            : item.status_code === 'transit'
                            ? styles.badgeTransit
                            : styles.badgeDefault
                        }`}
                      >
                        {item.status_label || (item.status_code === 'delivered' ? t('dashboard.status_delivered', 'Terkirim') : t('dashboard.status_transit', 'Dalam Transit'))}
                      </span>
                    </div>

                    <div className={styles.dhlRouteLine}>
                      <span className={styles.dhlCity}>{item.origin_city || 'ORIGIN'}</span>
                      <span className={styles.dhlRouteArrow}>➔</span>
                      <span className={styles.dhlCity}>{item.dest_city || 'DESTINATION'}</span>
                    </div>

                    {item.notes && (
                      <p className={styles.dhlNotes}>{item.notes}</p>
                    )}

                    <div className={styles.dhlCardFooter}>
                      <span className={styles.dhlLocation}>
                        <MapPin size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                        <span>{item.last_location || 'Tracking status updated'}</span>
                      </span>
                      {item.pic && (
                        <span className={styles.dhlPic}>
                          {t('dashboard.pic_label', 'PIC:')} <strong>{item.pic}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. DEDICATED BENTO CARD: LOG AKTIVITAS SISTEM (AUDIT TRAIL) */}
          <div className={styles.bentoSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                <h2 className={styles.sectionTitle}>{t('dashboard.recent_activity', 'Log Aktivitas Sistem')}</h2>
              </div>
              <span className={styles.logCountBadge}>
                {t('dashboard.event_count', { count: stats?.recent_logs?.length || 0, defaultValue: `${stats?.recent_logs?.length || 0} Event` })}
              </span>
            </div>

            <div className={styles.activityFeed}>
              {stats?.recent_logs && stats.recent_logs.length > 0 ? (
                stats.recent_logs.slice(0, 6).map((log) => (
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
                ))
              ) : (
                <p className={styles.emptyActivity}>{t('dashboard.no_activity', 'Belum ada aktivitas tercatat.')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Kelola & Tambah Tanggal Libur (Admin Only) */}
      {isAdmin && (
        <CustomHolidayModal
          isOpen={isCustomHolidayModalOpen}
          onClose={() => setIsCustomHolidayModalOpen(false)}
          initialDate={selectedCalendarDateStr}
        />
      )}
    </div>
  );
};

export default DashboardPage;
