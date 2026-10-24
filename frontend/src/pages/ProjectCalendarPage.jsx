import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  User,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  X,
  Flame,
  ArrowRight,
  FolderKanban,
  Eye,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { Button } from '../components/common/Button';
import styles from './ProjectCalendarPage.module.css';

// Safely parse JSON metadata
const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

// Date utilities
const formatDateStr = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // Set Monday as start of week (0: Sun -> diff = -6, 1: Mon -> diff = 0, ...)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const ProjectCalendarPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & View states
  const [viewMode, setViewMode] = useState('month'); // 'week' | 'month' | 'year'
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'my_tasks'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Year view selected month (0 - 11)
  const [selectedYearMonth, setSelectedYearMonth] = useState(new Date().getMonth());

  // Modal Detail state
  const [selectedTask, setSelectedTask] = useState(null);

  // Fetch projects & users
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [projRes, userRes] = await Promise.all([
          api.get('/projects'),
          api.get('/users').catch(() => ({ data: [] })),
        ]);
        setProjects(projRes.data || []);
        setUsers(userRes.data || []);
      } catch (err) {
        console.error('Failed to fetch calendar projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter accessible projects based on role & permissions
  const accessibleProjects = useMemo(() => {
    const isAdmin = user?.role === 'admin';
    const userRole = user?.role || 'member';
    const userParentGroup = user?.parent_group || '';
    const userGroupIds = Array.isArray(user?.group_part_ids) && user.group_part_ids.length > 0
      ? user.group_part_ids
      : (user?.group_part_id ? [user.group_part_id] : []);

    return projects.filter((p) => {
      if (isAdmin) return true;
      const meta = parseMetadata(p.metadata);
      const isCreator = Boolean(meta.created_by_id && user?.id && meta.created_by_id === user.id);
      const isAssigned = Boolean(
        (p.owner_id && user?.id && p.owner_id === user.id) ||
        (meta.assigned_pic_ids && Array.isArray(meta.assigned_pic_ids) && user?.id && meta.assigned_pic_ids.includes(user.id)) ||
        (p.owner_name && user?.full_name && p.owner_name.toLowerCase() === user.full_name.toLowerCase())
      );
      if (isCreator || isAssigned) return true;

      const vis = meta.visibility || 'public';
      if (vis === 'private_pic') return false;
      if (vis === 'manager') return userRole === 'admin' || userRole === 'manager';

      // Check group part match
      if (p.group_part_id && userGroupIds.length > 0) {
        if (!userGroupIds.includes(p.group_part_id) && p.group_part_name !== userParentGroup) {
          return false;
        }
      }
      return true;
    });
  }, [projects, user]);

  // Compute Task Counts for Switch Badges
  const { totalCount, myTasksCount } = useMemo(() => {
    let myCount = 0;
    accessibleProjects.forEach((p) => {
      const meta = parseMetadata(p.metadata);
      const isCreator = Boolean(meta.created_by_id && user?.id && meta.created_by_id === user.id);
      const isAssigned = Boolean(
        (p.owner_id && user?.id && p.owner_id === user.id) ||
        (meta.assigned_pic_ids && Array.isArray(meta.assigned_pic_ids) && user?.id && meta.assigned_pic_ids.includes(user.id)) ||
        (p.owner_name && user?.full_name && p.owner_name.toLowerCase() === user.full_name.toLowerCase())
      );
      if (isAssigned || isCreator) myCount++;
    });
    return { totalCount: accessibleProjects.length, myTasksCount: myCount };
  }, [accessibleProjects, user]);

  // Filtered Task List
  const filteredTasks = useMemo(() => {
    return accessibleProjects.filter((p) => {
      // 1. Scope filter: 'all' vs 'my_tasks'
      if (scopeFilter === 'my_tasks') {
        const meta = parseMetadata(p.metadata);
        const isCreator = Boolean(meta.created_by_id && user?.id && meta.created_by_id === user.id);
        const isAssigned = Boolean(
          (p.owner_id && user?.id && p.owner_id === user.id) ||
          (meta.assigned_pic_ids && Array.isArray(meta.assigned_pic_ids) && user?.id && meta.assigned_pic_ids.includes(user.id)) ||
          (p.owner_name && user?.full_name && p.owner_name.toLowerCase() === user.full_name.toLowerCase())
        );
        if (!isAssigned && !isCreator) return false;
      }

      // 2. Priority filter
      if (priorityFilter !== 'all' && (p.priority || 'medium') !== priorityFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all' && (p.status || 'planning') !== statusFilter) {
        return false;
      }

      // 4. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const meta = parseMetadata(p.metadata);
        const mTitle = (p.title || '').toLowerCase().includes(q);
        const mDesc = (p.description || '').toLowerCase().includes(q);
        const mOwner = (p.owner_name || '').toLowerCase().includes(q);
        const mPics = (meta.assigned_pics || []).some((pic) =>
          (pic.name || pic.full_name || '').toLowerCase().includes(q)
        );
        if (!mTitle && !mDesc && !mOwner && !mPics) return false;
      }

      return true;
    });
  }, [accessibleProjects, scopeFilter, priorityFilter, statusFilter, search, user]);

  // Map tasks to dates (keyed by 'YYYY-MM-DD')
  const tasksByDate = useMemo(() => {
    const map = {};
    filteredTasks.forEach((tItem) => {
      // Determine task reference date (prioritize target_date, fallback to start_date or created_at)
      let dateKey = tItem.target_date;
      if (!dateKey) {
        dateKey = tItem.start_date || formatDateStr(tItem.created_at);
      }
      if (!dateKey) return;

      // Extract only YYYY-MM-DD
      const cleanKey = dateKey.substring(0, 10);
      if (!map[cleanKey]) map[cleanKey] = [];
      map[cleanKey].push(tItem);
    });
    return map;
  }, [filteredTasks]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedYearMonth(new Date().getMonth());
  };

  // Locale-aware period title
  const currentPeriodTitle = useMemo(() => {
    const locale = i18n.language === 'id' ? 'id-ID' : i18n.language === 'ko' ? 'ko-KR' : 'en-US';
    if (viewMode === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const sDay = start.getDate();
      const sMonth = start.toLocaleDateString(locale, { month: 'short' });
      const eDay = end.getDate();
      const eMonth = end.toLocaleDateString(locale, { month: 'short' });
      const year = end.getFullYear();
      return `${sDay} ${sMonth} - ${eDay} ${eMonth} ${year}`;
    }
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    return `${currentDate.getFullYear()}`;
  }, [currentDate, viewMode, i18n.language]);

  // Priority color class helper
  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return styles.priorityUrgent;
      case 'high':
        return styles.priorityHigh;
      case 'medium':
        return styles.priorityMedium;
      case 'low':
        return styles.priorityLow;
      default:
        return styles.priorityMedium;
    }
  };

  // ==========================================================================
  // RENDER MONTH VIEW
  // ==========================================================================
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust for Monday start (0: Mon, 6: Sun)
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = formatDateStr(new Date());

    // Generate 42 calendar grid cells (6 rows x 7 cols)
    const cells = [];

    // 1. Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = formatDateStr(prevDate);
      cells.push({
        date: prevDate,
        dateStr,
        dayNum,
        isOutside: true,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // 2. Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = formatDateStr(curDate);
      cells.push({
        date: curDate,
        dateStr,
        dayNum: d,
        isOutside: false,
        isToday: dateStr === todayStr,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // 3. Next month days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = formatDateStr(nextDate);
      cells.push({
        date: nextDate,
        dateStr,
        dayNum: d,
        isOutside: true,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    const weekdays = i18n.language === 'id'
      ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
      : i18n.language === 'ko'
      ? ['월', '화', '수', '목', '금', '토', '일']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className={styles.monthGrid}>
        <div className={styles.weekdayHeaderRow}>
          {weekdays.map((w, idx) => (
            <div key={idx} className={styles.weekdayHeaderCell}>
              {w}
            </div>
          ))}
        </div>
        <div className={styles.monthDaysGrid}>
          {cells.map((cell, idx) => {
            const hasTasks = cell.tasks.length > 0;
            return (
              <div
                key={idx}
                className={`${styles.monthDayCell} ${cell.isOutside ? styles.outsideMonth : ''} ${
                  cell.isToday ? styles.todayCell : ''
                }`}
              >
                <div className={styles.dayCellHeader}>
                  <span className={styles.dateNumber}>{cell.dayNum}</span>
                  {hasTasks && (
                    <span className={styles.dayTaskCountBadge}>
                      {cell.tasks.length}
                    </span>
                  )}
                </div>
                <div className={styles.taskListInCell}>
                  {cell.tasks.slice(0, 3).map((tItem) => (
                    <div
                      key={tItem.id}
                      className={`${styles.taskPill} ${getPriorityClass(tItem.priority)}`}
                      onClick={() => setSelectedTask(tItem)}
                      title={`${tItem.title} (${tItem.priority || 'medium'})`}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tItem.title}
                      </span>
                    </div>
                  ))}
                  {cell.tasks.length > 3 && (
                    <button
                      className={styles.moreTasksBtn}
                      onClick={() => setSelectedTask(cell.tasks[3])}
                    >
                      +{cell.tasks.length - 3} {t('project_calendar.tasks_count', 'Tasks')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER WEEK VIEW
  // ==========================================================================
  const renderWeekView = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const todayStr = formatDateStr(new Date());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = formatDateStr(d);
      days.push({
        date: d,
        dateStr,
        isToday: dateStr === todayStr,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    const locale = i18n.language === 'id' ? 'id-ID' : i18n.language === 'ko' ? 'ko-KR' : 'en-US';

    return (
      <div className={styles.weekGrid}>
        {days.map((dayObj, idx) => {
          const dayName = dayObj.date.toLocaleDateString(locale, { weekday: 'short' });
          const dayNum = dayObj.date.getDate();

          return (
            <div
              key={idx}
              className={`${styles.weekDayCol} ${dayObj.isToday ? styles.weekDayColToday : ''}`}
            >
              <div className={styles.weekColHeader}>
                <span className={styles.weekColDayName}>{dayName}</span>
                <span className={styles.weekColDateNum}>{dayNum}</span>
              </div>
              <div className={styles.weekCardList}>
                {dayObj.tasks.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
                    -
                  </div>
                ) : (
                  dayObj.tasks.map((tItem) => {
                    const meta = parseMetadata(tItem.metadata);
                    const primaryPic = (meta.assigned_pics && meta.assigned_pics[0]?.name) || tItem.owner_name || 'Unassigned';

                    return (
                      <div
                        key={tItem.id}
                        className={styles.weekTaskCard}
                        onClick={() => setSelectedTask(tItem)}
                      >
                        <div className={styles.cardHeaderRow}>
                          <span className={`${styles.taskPill} ${getPriorityClass(tItem.priority)}`} style={{ padding: '2px 6px', fontSize: '10.5px' }}>
                            {tItem.priority || 'medium'}
                          </span>
                          <span className={styles.taskTypeTag}>
                            {tItem.project_type?.replace('_', ' ') || 'task'}
                          </span>
                        </div>
                        <h4 className={styles.taskCardTitle}>{tItem.title}</h4>
                        <div className={styles.progressBarContainer}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${tItem.progress || 20}%`,
                              background: tItem.progress >= 100 ? '#10b981' : tItem.progress >= 50 ? '#3b82f6' : '#f59e0b',
                            }}
                          />
                        </div>
                        <div className={styles.cardFooterRow}>
                          <span>PIC: {primaryPic}</span>
                          <span>{tItem.progress || 0}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ==========================================================================
  // RENDER YEAR VIEW
  // ==========================================================================
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const todayStr = formatDateStr(new Date());

    const months = Array.from({ length: 12 }, (_, i) => i);
    const locale = i18n.language === 'id' ? 'id-ID' : i18n.language === 'ko' ? 'ko-KR' : 'en-US';

    // Tasks inside the currently selected month in year view
    const selectedMonthTasks = filteredTasks.filter((tItem) => {
      let dStr = tItem.target_date || tItem.start_date || formatDateStr(tItem.created_at);
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === year && d.getMonth() === selectedYearMonth;
    });

    return (
      <div className={styles.yearContainer}>
        <div className={styles.yearMonthsGrid}>
          {months.map((mIdx) => {
            const mDate = new Date(year, mIdx, 1);
            const mTitle = mDate.toLocaleDateString(locale, { month: 'long' });

            const firstDay = new Date(year, mIdx, 1).getDay();
            const startOffset = firstDay === 0 ? 6 : firstDay - 1;
            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

            // Count tasks in this month
            const mTasksCount = filteredTasks.filter((tItem) => {
              let dStr = tItem.target_date || tItem.start_date || formatDateStr(tItem.created_at);
              if (!dStr) return false;
              const d = new Date(dStr);
              return d.getFullYear() === year && d.getMonth() === mIdx;
            }).length;

            return (
              <div
                key={mIdx}
                className={`${styles.miniMonthCard} ${
                  selectedYearMonth === mIdx ? styles.miniMonthSelected : ''
                }`}
                onClick={() => setSelectedYearMonth(mIdx)}
              >
                <div className={styles.miniMonthHeader}>
                  <span className={styles.miniMonthTitle}>{mTitle}</span>
                  {mTasksCount > 0 && (
                    <span className={styles.miniMonthTaskCount}>{mTasksCount}</span>
                  )}
                </div>
                <div className={styles.miniMonthDaysGrid}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((wd, i) => (
                    <div key={i} className={styles.miniDayHeader}>
                      {wd}
                    </div>
                  ))}
                  {Array.from({ length: startOffset }, (_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasTasks = Boolean(tasksByDate[dStr] && tasksByDate[dStr].length > 0);
                    const isToday = dStr === todayStr;

                    return (
                      <div
                        key={day}
                        className={`${styles.miniDayCell} ${
                          isToday ? styles.miniDayCellToday : hasTasks ? styles.miniDayHasTasks : ''
                        }`}
                        title={hasTasks ? `${tasksByDate[dStr].length} tasks on ${dStr}` : undefined}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Panel: Selected Month Task Breakdown */}
        <div className={styles.yearDetailPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.yearDetailTitle}>
              <FolderKanban size={18} style={{ color: 'var(--color-accent)' }} />
              {new Date(year, selectedYearMonth, 1).toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <span className={styles.countBadge}>{selectedMonthTasks.length} Task</span>
          </div>

          {selectedMonthTasks.length === 0 ? (
            <div className={styles.emptyStateContainer}>
              <Clock size={32} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '13px' }}>
                {t('project_calendar.no_tasks', 'Tidak ada task terjadwal untuk bulan ini')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedMonthTasks.map((tItem) => {
                const meta = parseMetadata(tItem.metadata);
                const picName = (meta.assigned_pics && meta.assigned_pics[0]?.name) || tItem.owner_name || 'Team';

                return (
                  <div
                    key={tItem.id}
                    className={styles.weekTaskCard}
                    onClick={() => setSelectedTask(tItem)}
                  >
                    <div className={styles.cardHeaderRow}>
                      <span className={`${styles.taskPill} ${getPriorityClass(tItem.priority)}`} style={{ padding: '2px 6px', fontSize: '10.5px' }}>
                        {tItem.priority || 'medium'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {tItem.target_date || 'No Date'}
                      </span>
                    </div>
                    <h4 className={styles.taskCardTitle}>{tItem.title}</h4>
                    <div className={styles.cardFooterRow}>
                      <span>PIC: {picName}</span>
                      <span>{tItem.progress || 0}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <CalendarIcon size={24} style={{ color: 'var(--color-accent)' }} />
            {t('project_calendar.title', 'Project Calendar')}
          </h1>
          <p className={styles.subtitle}>
            {t(
              'project_calendar.subtitle',
              'Interactive timeline and milestone schedule for engineering tasks'
            )}
          </p>
        </div>

        <div className={styles.actionsArea}>
          {/* Emil Kowalski Segmented Switch: All Tasks vs My Tasks */}
          <div className={styles.segmentedSwitch}>
            <button
              type="button"
              className={`${styles.segmentBtn} ${scopeFilter === 'all' ? styles.segmentBtnActive : ''}`}
              onClick={() => setScopeFilter('all')}
            >
              <Users size={14} />
              <span>{t('project_calendar.all_tasks', 'Semua Task')}</span>
              <span className={styles.countBadge}>{totalCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${scopeFilter === 'my_tasks' ? styles.segmentBtnActive : ''}`}
              onClick={() => setScopeFilter('my_tasks')}
            >
              <User size={14} />
              <span>{t('project_calendar.my_tasks', 'Task Saya')}</span>
              <span className={styles.countBadge}>{myTasksCount}</span>
            </button>
          </div>

          {/* View Mode Switcher: Week / Month / Year */}
          <div className={styles.segmentedSwitch}>
            <button
              type="button"
              className={`${styles.segmentBtn} ${viewMode === 'week' ? styles.segmentBtnActive : ''}`}
              onClick={() => setViewMode('week')}
            >
              {t('project_calendar.view_week', 'Mingguan')}
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${viewMode === 'month' ? styles.segmentBtnActive : ''}`}
              onClick={() => setViewMode('month')}
            >
              {t('project_calendar.view_month', 'Bulanan')}
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${viewMode === 'year' ? styles.segmentBtnActive : ''}`}
              onClick={() => setViewMode('year')}
            >
              {t('project_calendar.view_year', 'Tahunan')}
            </button>
          </div>

          <Button
            variant="primary"
            onClick={() => navigate('/projects')}
            style={{ fontSize: '12.5px', padding: '6px 14px' }}
          >
            <FolderKanban size={14} />
            {t('project_calendar.open_in_projects', 'ToDo List')}
          </Button>
        </div>
      </div>

      {/* Navigation & Filter Bar */}
      <div className={styles.navBar}>
        <div className={styles.periodNavGroup}>
          <button className={styles.navArrowBtn} onClick={handlePrev} title={t('project_calendar.prev', 'Sebelumnya')}>
            <ChevronLeft size={16} />
          </button>
          <button className={styles.todayBtn} onClick={handleToday}>
            {t('project_calendar.today', 'Hari Ini')}
          </button>
          <button className={styles.navArrowBtn} onClick={handleNext} title={t('project_calendar.next', 'Berikutnya')}>
            <ChevronRight size={16} />
          </button>
          <span className={styles.currentPeriodTitle}>{currentPeriodTitle}</span>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.searchInputWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('project_calendar.search_placeholder', 'Cari task, PIC...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="all">{t('project_calendar.priority_all', 'Semua Prioritas')}</option>
            <option value="urgent">{t('project_calendar.urgent', 'Mendesak (Urgent)')}</option>
            <option value="high">{t('project_calendar.high', 'Tinggi (High)')}</option>
            <option value="medium">{t('project_calendar.medium', 'Sedang (Medium)')}</option>
            <option value="low">{t('project_calendar.low', 'Rendah (Low)')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="all">{t('project_calendar.status_all', 'Semua Status')}</option>
            <option value="planning">{t('project_calendar.planning', 'Planning')}</option>
            <option value="in_progress">{t('project_calendar.in_progress', 'In Progress')}</option>
            <option value="review">{t('project_calendar.review', 'Review')}</option>
            <option value="completed">{t('project_calendar.completed', 'Completed')}</option>
          </select>
        </div>
      </div>

      {/* Main Calendar View Body */}
      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Memuat kalender proyek..." />
        </div>
      ) : (
        <>
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'year' && renderYearView()}
        </>
      )}

      {/* Task Quick-View Modal */}
      {selectedTask && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <span className={`${styles.taskPill} ${getPriorityClass(selectedTask.priority)}`}>
                    {selectedTask.priority || 'medium'}
                  </span>
                  <span className={styles.taskTypeTag}>
                    {selectedTask.project_type?.replace('_', ' ') || 'task'}
                  </span>
                </div>
                <h2>{selectedTask.title}</h2>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setSelectedTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {selectedTask.description && (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {selectedTask.description}
                </p>
              )}

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.due_date', 'Target Due Date')}</span>
                  <span className={styles.metaValue}>{selectedTask.target_date || '-'}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.start_date', 'Start Date')}</span>
                  <span className={styles.metaValue}>{selectedTask.start_date || '-'}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.milestone', 'Milestone')}</span>
                  <span className={styles.metaValue}>{selectedTask.progress || 0}%</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Status</span>
                  <span className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                    {selectedTask.status || 'planning'}
                  </span>
                </div>
              </div>

              {/* Assigned PICs */}
              <div>
                <span className={styles.metaLabel}>{t('project_calendar.assigned_pics', 'Assigned PICs')}</span>
                <div className={styles.picBadgeList}>
                  {(() => {
                    const meta = parseMetadata(selectedTask.metadata);
                    const pics = meta.assigned_pics && meta.assigned_pics.length > 0
                      ? meta.assigned_pics
                      : selectedTask.owner_name
                      ? [{ name: selectedTask.owner_name }]
                      : [];

                    if (!pics.length) {
                      return <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>-</span>;
                    }

                    return pics.map((pic, idx) => (
                      <span key={idx} className={styles.picBadge}>
                        <User size={12} style={{ color: 'var(--color-accent)' }} />
                        {pic.name || pic.full_name}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setSelectedTask(null)}>
                {t('common.close', 'Tutup')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedTask(null);
                  navigate('/projects');
                }}
              >
                <ExternalLink size={14} />
                {t('project_calendar.open_in_projects', 'Buka di ToDo List')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCalendarPage;
