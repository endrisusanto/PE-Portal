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
  PartyPopper,
  Save,
  CalendarPlus,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { Button } from '../components/common/Button';
import { CustomHolidayModal } from '../components/common/CustomHolidayModal';
import { getIndonesianHoliday, isWeekend, getHolidaysForMonth } from '../utils/indonesianHolidays';
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

// Calculate task start/end date range and duration
const getTaskDateRange = (tItem) => {
  let startStr = tItem.start_date ? tItem.start_date.substring(0, 10) : '';
  let endStr = tItem.target_date ? tItem.target_date.substring(0, 10) : '';

  if (!startStr && !endStr) {
    startStr = formatDateStr(tItem.created_at || new Date());
    endStr = startStr;
  } else if (!startStr) {
    startStr = endStr;
  } else if (!endStr) {
    endStr = startStr;
  }

  // Normalize if start date is after end date
  if (startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
  }

  const d1 = new Date(startStr + 'T00:00:00');
  const d2 = new Date(endStr + 'T00:00:00');
  const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

  return {
    startStr,
    endStr,
    diffDays,
    isMultiDay: diffDays > 1,
  };
};

export const ProjectCalendarPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

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
  const [showHolidays, setShowHolidays] = useState(true);

  // Year view selected month (0 - 11)
  const [selectedYearMonth, setSelectedYearMonth] = useState(new Date().getMonth());
  const [isCustomHolidayModalOpen, setIsCustomHolidayModalOpen] = useState(false);
  const [customHolidaysVersion, setCustomHolidaysVersion] = useState(0);

  // Sync custom holidays reactively
  useEffect(() => {
    const handleSync = () => setCustomHolidaysVersion((v) => v + 1);
    window.addEventListener('customHolidaysChanged', handleSync);
    return () => window.removeEventListener('customHolidaysChanged', handleSync);
  }, []);

  // Modal Detail state
  const [selectedTask, setSelectedTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editStatus, setEditStatus] = useState('planning');
  const [editProgress, setEditProgress] = useState(0);
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleOpenTaskModal = (task) => {
    setSelectedTask(task);
    setEditTitle(task.title || '');
    setEditDesc(task.description || '');
    setEditPriority(task.priority || 'medium');
    setEditStatus(task.status || (task.progress >= 25 ? 'in_progress' : 'planning'));
    setEditProgress(task.progress || 0);
    setEditStartDate(task.start_date ? task.start_date.substring(0, 10) : '');
    setEditTargetDate(task.target_date ? task.target_date.substring(0, 10) : '');
  };

  const handleSaveCalendarTask = async () => {
    if (!selectedTask || !editTitle.trim()) return;
    setIsSavingTask(true);
    try {
      const derivedStatus =
        editStatus && editStatus !== 'planning'
          ? editStatus
          : editProgress >= 100
          ? 'completed'
          : editProgress >= 75
          ? 'review'
          : editProgress >= 25
          ? 'in_progress'
          : 'planning';

      const payload = {
        title: editTitle,
        description: editDesc || undefined,
        priority: editPriority,
        status: derivedStatus,
        progress: Number(editProgress) || 0,
        start_date: editStartDate || undefined,
        target_date: editTargetDate || undefined,
      };

      const res = await api.put(`/projects/${selectedTask.id}`, payload);
      const updated = { ...selectedTask, ...res.data };
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedTask.id ? updated : p))
      );
      setSelectedTask(null);
      showToast('Perubahan task berhasil disimpan!');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsSavingTask(false);
    }
  };

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

  // ponytail: color line range bar by milestone progress & actual status instead of static priority
  const getBarColorClass = (task) => {
    if (task?.priority?.toLowerCase() === 'urgent') return styles.barUrgent;
    const p = Number(task?.progress) || 0;
    if (task?.status === 'completed' || p >= 100) return styles.barCompleted;
    if (p >= 80) return styles.barVerification;
    if (p >= 60) return styles.barDev;
    if (p >= 40) return styles.barAnalysis;
    return styles.barPlanning;
  };

  // ==========================================================================
  // RENDER MONTH VIEW (CONTINUOUS HORIZONTAL SPANNING BARS & INDONESIAN HOLIDAYS)
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
      });
    }

    const weekdays = i18n.language === 'id'
      ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
      : i18n.language === 'ko'
      ? ['월', '화', '수', '목', '금', '토', '일']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Group cells into 6 weekly rows (7 days each: Monday to Sunday)
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      weeks.push(cells.slice(w * 7, (w + 1) * 7));
    }

    return (
      <div className={styles.monthGrid}>
        <div className={styles.weekdayHeaderRow}>
          {weekdays.map((w, idx) => (
            <div
              key={idx}
              className={`${styles.weekdayHeaderCell} ${idx === 5 || idx === 6 ? styles.weekendHeader : ''}`}
            >
              {w}
            </div>
          ))}
        </div>

        {weeks.map((weekDays, wIdx) => {
          const weekStartStr = weekDays[0].dateStr;
          const weekEndStr = weekDays[6].dateStr;

          // Find tasks that overlap with this week
          const weekTasks = [];
          filteredTasks.forEach((task) => {
            const { startStr, endStr, diffDays, isMultiDay } = getTaskDateRange(task);
            if (startStr <= weekEndStr && endStr >= weekStartStr) {
              const wStartDate = new Date(weekStartStr + 'T00:00:00');
              const tStartDate = new Date(startStr + 'T00:00:00');
              const tEndDate = new Date(endStr + 'T00:00:00');

              const startDiff = Math.round((tStartDate - wStartDate) / (1000 * 60 * 60 * 24));
              const endDiff = Math.round((tEndDate - wStartDate) / (1000 * 60 * 60 * 24));

              const colStart = Math.max(0, startDiff) + 1; // 1 to 7
              const colEnd = Math.min(6, endDiff) + 1;     // 1 to 7
              const colSpan = Math.max(1, colEnd - colStart + 1);

              const continuesPrior = startStr < weekStartStr;
              const continuesAfter = endStr > weekEndStr;

              weekTasks.push({
                task,
                startStr,
                endStr,
                diffDays,
                isMultiDay,
                colStart,
                colSpan,
                continuesPrior,
                continuesAfter,
              });
            }
          });

          // Sort tasks: multi-day first or longer duration first, then start date
          weekTasks.sort((a, b) => {
            if (a.startStr !== b.startStr) return a.startStr.localeCompare(b.startStr);
            return b.diffDays - a.diffDays;
          });

          return (
            <div key={wIdx} className={styles.monthWeekRow}>
              {/* Background date cells underlay */}
              <div className={styles.dateCellsUnderlay}>
                {weekDays.map((cell, cIdx) => {
                  const holiday = getIndonesianHoliday(cell.dateStr);
                  const isWeekendDay = isWeekend(cell.date);
                  const isRedDate = isWeekendDay || Boolean(holiday);

                  return (
                    <div
                      key={cIdx}
                      className={`${styles.dateCellBg} ${cell.isOutside ? styles.outsideMonth : ''} ${
                        cell.isToday ? styles.todayCell : ''
                      }`}
                    >
                      <div className={styles.dayCellHeader}>
                        <span
                          className={`${styles.dateNumber} ${isRedDate && !cell.isToday ? styles.holidayDate : ''}`}
                        >
                          {cell.dayNum}
                        </span>
                        {holiday && showHolidays && (
                          <span className={styles.holidayBadge} title={holiday.name}>
                            {holiday.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Foreground Multi-Day Task Bars Overlay */}
              <div className={styles.taskBarsOverlay}>
                {weekTasks.slice(0, 4).map((item) => {
                  const {
                    task,
                    colStart,
                    colSpan,
                    continuesPrior,
                    continuesAfter,
                    diffDays,
                    isMultiDay,
                  } = item;
                  const meta = parseMetadata(task.metadata);
                  const primaryPic =
                    (meta.assigned_pics && meta.assigned_pics[0]?.name) || task.owner_name || '';
                  const avatarInitial = primaryPic ? primaryPic.charAt(0).toUpperCase() : 'T';

                  return (
                    <div
                      key={`${task.id}-w${wIdx}`}
                      className={`${styles.spanningTaskBar} ${getBarColorClass(task)} ${
                        continuesPrior ? styles.continuesPrior : ''
                      } ${continuesAfter ? styles.continuesAfter : ''}`}
                      style={{
                        gridColumn: `${colStart} / span ${colSpan}`,
                      }}
                      onClick={() => handleOpenTaskModal(task)}
                      title={`${task.title} (${task.priority || 'medium'}) - ${task.start_date || task.target_date || ''} s/d ${task.target_date || ''} (${diffDays} ${t('project_calendar.duration_days', 'hari')})`}
                    >
                      {continuesPrior && <span className={styles.continuationArrow}>◀</span>}
                      {primaryPic && (
                        <span className={styles.barPicAvatar} title={primaryPic}>
                          {avatarInitial}
                        </span>
                      )}
                      <span className={styles.barTitle}>{task.title}</span>
                      {task.progress !== undefined && (
                        <span className={styles.barMilestoneBadge}>
                          {task.progress}%
                        </span>
                      )}
                      {isMultiDay && colSpan >= 2 && (
                        <span style={{ fontSize: '10px', opacity: 0.9, flexShrink: 0, fontWeight: 700 }}>
                          {diffDays}d
                        </span>
                      )}
                      {continuesAfter && <span className={styles.continuationArrow}>▶</span>}
                    </div>
                  );
                })}
                {weekTasks.length > 4 && (
                  <div className={styles.moreTasksRow}>
                    <button
                      className={styles.moreTasksBtn}
                      onClick={() => handleOpenTaskModal(weekTasks[4].task)}
                    >
                      +{weekTasks.length - 4} {t('project_calendar.tasks_count', 'Tasks')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
          const holiday = getIndonesianHoliday(dayObj.dateStr);
          const isWeekendDay = isWeekend(dayObj.date);
          const isRedDate = isWeekendDay || Boolean(holiday);

          return (
            <div
              key={idx}
              className={`${styles.weekDayCol} ${dayObj.isToday ? styles.weekDayColToday : ''}`}
            >
              <div className={styles.weekColHeader}>
                <span className={styles.weekColDayName} style={{ color: isRedDate ? '#ef4444' : undefined }}>
                  {dayName}
                </span>
                <span className={`${styles.weekColDateNum} ${isRedDate && !dayObj.isToday ? styles.holidayDate : ''}`}>
                  {dayNum}
                </span>
                {holiday && showHolidays && (
                  <span className={styles.holidayBadge} style={{ marginTop: '2px' }} title={holiday.name}>
                    {holiday.name}
                  </span>
                )}
              </div>
              <div className={styles.weekCardList}>
                {(() => {
                  const dayTasks = filteredTasks.filter((tItem) => {
                    const { startStr, endStr } = getTaskDateRange(tItem);
                    return startStr <= dayObj.dateStr && endStr >= dayObj.dateStr;
                  });

                  if (dayTasks.length === 0) {
                    return (
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
                        -
                      </div>
                    );
                  }

                  return dayTasks.map((tItem) => {
                    const meta = parseMetadata(tItem.metadata);
                    const primaryPic = (meta.assigned_pics && meta.assigned_pics[0]?.name) || tItem.owner_name || 'Unassigned';
                    const { diffDays, isMultiDay } = getTaskDateRange(tItem);

                    return (
                      <div
                        key={tItem.id}
                        className={styles.weekTaskCard}
                        onClick={() => handleOpenTaskModal(tItem)}
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
                        {isMultiDay && (
                          <span className={styles.cardDateRangeBadge}>
                            <Clock size={11} />
                            {tItem.start_date || tItem.target_date} → {tItem.target_date} ({t('project_calendar.duration_days', { count: diffDays })})
                          </span>
                        )}
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
                  });
                })()}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ==========================================================================
  // RENDER YEAR VIEW (HIGHLIGHT EVENTS / TASKS & INDONESIAN HOLIDAYS)
  // ==========================================================================
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const todayStr = formatDateStr(new Date());

    const months = Array.from({ length: 12 }, (_, i) => i);
    const locale = i18n.language === 'id' ? 'id-ID' : i18n.language === 'ko' ? 'ko-KR' : 'en-US';

    // Tasks active during the selected month (date range aware)
    const selMonthStartStr = `${year}-${String(selectedYearMonth + 1).padStart(2, '0')}-01`;
    const selDaysInMonth = new Date(year, selectedYearMonth + 1, 0).getDate();
    const selMonthEndStr = `${year}-${String(selectedYearMonth + 1).padStart(2, '0')}-${String(selDaysInMonth).padStart(2, '0')}`;

    const selectedMonthTasks = filteredTasks.filter((tItem) => {
      const { startStr, endStr } = getTaskDateRange(tItem);
      return startStr <= selMonthEndStr && endStr >= selMonthStartStr;
    });

    // Holidays in the selected month
    const selectedMonthHolidays = getHolidaysForMonth(year, selectedYearMonth);

    return (
      <div className={styles.yearContainer}>
        <div className={styles.yearMonthsGrid}>
          {months.map((mIdx) => {
            const mDate = new Date(year, mIdx, 1);
            const mTitle = mDate.toLocaleDateString(locale, { month: 'long' });

            const firstDay = new Date(year, mIdx, 1).getDay();
            const startOffset = firstDay === 0 ? 6 : firstDay - 1;
            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

            const mStartStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-01`;
            const mEndStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            // Count tasks active in this month
            const mTasksCount = filteredTasks.filter((tItem) => {
              const { startStr, endStr } = getTaskDateRange(tItem);
              return startStr <= mEndStr && endStr >= mStartStr;
            }).length;

            const mHolidays = getHolidaysForMonth(year, mIdx);

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
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {mHolidays.length > 0 && showHolidays && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.12)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                        title={`${mHolidays.length} ${t('project_calendar.holiday_badge', 'Hari Libur')}`}
                      >
                        {mHolidays.length} Libur
                      </span>
                    )}
                    {mTasksCount > 0 && (
                      <span className={styles.miniMonthTaskCount}>{mTasksCount}</span>
                    )}
                  </div>
                </div>
                <div className={styles.miniMonthDaysGrid}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((wd, i) => (
                    <div
                      key={i}
                      className={`${styles.miniDayHeader} ${
                        i === 5 || i === 6 ? styles.miniDayWeekendHeader : ''
                      }`}
                    >
                      {wd}
                    </div>
                  ))}
                  {Array.from({ length: startOffset }, (_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const cellDate = new Date(year, mIdx, day);
                    const isWeekendDay = isWeekend(cellDate);
                    const holiday = getIndonesianHoliday(dStr);
                    const isHolidayDay = Boolean(holiday);

                    // Check if any active task covers this date (date range aware)
                    const hasTasks = filteredTasks.some((tItem) => {
                      const { startStr, endStr } = getTaskDateRange(tItem);
                      return startStr <= dStr && endStr >= dStr;
                    });

                    const isToday = dStr === todayStr;

                    return (
                      <div
                        key={day}
                        className={`${styles.miniDayCell} ${
                          isToday
                            ? styles.miniDayCellToday
                            : hasTasks
                            ? styles.miniDayHasTasks
                            : isHolidayDay
                            ? styles.miniDayHoliday
                            : isWeekendDay
                            ? styles.miniDayWeekend
                            : ''
                        }`}
                        title={
                          holiday
                            ? `${dStr}: ${holiday.name}`
                            : hasTasks
                            ? `${dStr}: Active Tasks`
                            : undefined
                        }
                      >
                        {day}
                        {isHolidayDay && showHolidays && !isToday && !hasTasks && (
                          <span className={styles.miniDayHolidayBadgeDot} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Panel: Selected Month Breakdown (Holidays + Tasks) */}
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

          {/* Indonesian Holidays in Selected Month */}
          {selectedMonthHolidays.length > 0 && showHolidays && (
            <div className={styles.miniMonthHolidaysSection}>
              <h4 className={styles.miniSectionTitle}>
                <PartyPopper size={14} />
                {t('project_calendar.holiday_badge', 'Hari Libur')} ({selectedMonthHolidays.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedMonthHolidays.map((h, hIdx) => (
                  <div key={hIdx} className={styles.holidayItemRow}>
                    <span className={styles.holidayItemDate}>{h.day}</span>
                    <span className={styles.holidayItemName}>
                      {h.name}
                      {h.isCutiBersama && (
                        <span style={{ fontSize: '10px', color: '#f87171', marginLeft: '6px', opacity: 0.85 }}>
                          (Cuti Bersama)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks & Events in Selected Month */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className={styles.metaLabel} style={{ fontWeight: 700 }}>
                {t('project_calendar.all_tasks', 'Task & Event')}
              </span>
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
                  const { diffDays, isMultiDay } = getTaskDateRange(tItem);

                  return (
                    <div
                      key={tItem.id}
                      className={styles.weekTaskCard}
                      onClick={() => handleOpenTaskModal(tItem)}
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
                      {isMultiDay && (
                        <span className={styles.cardDateRangeBadge}>
                          <Clock size={11} />
                          {tItem.start_date || tItem.target_date} → {tItem.target_date} ({t('project_calendar.duration_days', { count: diffDays })})
                        </span>
                      )}
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

          {/* Holiday Toggle Button */}
          <button
            type="button"
            className={`${styles.holidayToggleBtn} ${showHolidays ? styles.holidayToggleActive : ''}`}
            onClick={() => setShowHolidays(!showHolidays)}
            title={t('project_calendar.toggle_holidays', 'Tampilkan Hari Libur Nasional & Cuti Bersama')}
          >
            <PartyPopper size={14} style={{ color: showHolidays ? '#ef4444' : 'currentColor' }} />
            <span>{t('project_calendar.holiday_badge', 'Hari Libur')}</span>
          </button>

          {/* Add Holiday Button - Admin Only */}
          {isAdmin && (
            <button
              type="button"
              className={styles.holidayToggleBtn}
              onClick={() => setIsCustomHolidayModalOpen(true)}
              title="Tambah dan kelola hari libur"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
            >
              <CalendarPlus size={14} />
              <span>+ Libur</span>
            </button>
          )}

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

      {/* Task Quick-View & Edit Modal */}
      {selectedTask && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea} style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={`${styles.taskPill} ${getPriorityClass(editPriority)}`}>
                    {editPriority || 'medium'}
                  </span>
                  <span className={styles.taskTypeTag}>
                    {selectedTask.project_type?.replace('_', ' ') || 'task'}
                  </span>
                </div>
                <input
                  type="text"
                  className={styles.titleInputField}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Judul Task..."
                />
              </div>
              <button className={styles.closeModalBtn} onClick={() => setSelectedTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div>
                <label className={styles.metaLabel} style={{ display: 'block', marginBottom: '4px' }}>
                  Catatan / Deskripsi Task
                </label>
                <textarea
                  className={styles.descInputField}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  placeholder="Catatan analisis, investigasi, atau countermeasure..."
                />
              </div>

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.start_date', 'Start Date')}</span>
                  <input
                    type="date"
                    className={styles.dateInputField}
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.due_date', 'Target Due Date')}</span>
                  <input
                    type="date"
                    className={styles.dateInputField}
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                  />
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('project_calendar.milestone', 'Milestone')}</span>
                  <select
                    className={styles.statusSelectField}
                    value={editProgress}
                    onChange={(e) => {
                      const newP = Number(e.target.value);
                      setEditProgress(newP);
                      if (newP >= 100) setEditStatus('completed');
                      else if (newP >= 75) setEditStatus('review');
                      else if (newP >= 25) setEditStatus('in_progress');
                      else setEditStatus('planning');
                    }}
                  >
                    <option value={20}>20% - Step 1: Initial Planning</option>
                    <option value={40}>40% - Step 2: Root Cause Analysis</option>
                    <option value={60}>60% - Step 3: Countermeasure & Dev</option>
                    <option value={80}>80% - Step 4: Verification & Test</option>
                    <option value={100}>100% - Step 5: Completed</option>
                  </select>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Status</span>
                  <select
                    className={styles.statusSelectField}
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Prioritas</span>
                  <select
                    className={styles.statusSelectField}
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                {editStartDate && editTargetDate && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{t('project_calendar.duration', 'Durasi')}</span>
                    <span className={styles.metaValue} style={{ color: 'var(--color-accent)', fontWeight: 700, lineHeight: '32px' }}>
                      {Math.max(1, Math.round((new Date(editTargetDate + 'T00:00:00') - new Date(editStartDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1)} hari
                    </span>
                  </div>
                )}
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
                variant="secondary"
                onClick={() => {
                  const taskId = selectedTask.id;
                  setSelectedTask(null);
                  navigate('/projects', {
                    state: { returnTo: '/project-calendar', editProjectId: taskId },
                  });
                }}
              >
                <ExternalLink size={14} />
                {t('project_calendar.open_in_projects', 'Buka di ToDo List')}
              </Button>
              <Button
                variant="primary"
                disabled={isSavingTask || !editTitle.trim()}
                onClick={handleSaveCalendarTask}
              >
                <Save size={14} />
                {isSavingTask ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--color-text-primary)',
          fontSize: '13px',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease',
        }}>
          <CheckCircle2 size={16} color="var(--color-accent)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal Kelola & Tambah Tanggal Libur (Admin Only) */}
      {isAdmin && (
        <CustomHolidayModal
          isOpen={isCustomHolidayModalOpen}
          onClose={() => setIsCustomHolidayModalOpen(false)}
          initialDate={formatDateStr(currentDate)}
        />
      )}
    </div>
  );
};

export default ProjectCalendarPage;
