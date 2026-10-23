import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Kanban as KanbanIcon,
  Flame,
  RefreshCw,
  Search,
  AlertCircle,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import styles from './GbaTasksPage.module.css';

const STATUS_CONFIG = {
  'Task Baru': { color: '#3b82f6' },
  'Downloaded': { color: '#06b6d4' },
  'Test Ongoing': { color: '#f59e0b' },
  'Pending Feedback': { color: '#f97316' },
  'Feedback Sent': { color: '#f43f5e' },
  'Submitted': { color: '#a855f7' },
  'Approved': { color: '#10b981' },
  'Batal': { color: '#94a3b8' },
};

const KANBAN_STATUSES = [
  'Task Baru',
  'Downloaded',
  'Test Ongoing',
  'Pending Feedback',
  'Feedback Sent',
  'Submitted',
  'Approved',
  'Batal',
];

export const GbaTasksPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ columns: {}, total: 0 });
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/gba-tasks');
      if (res.data) {
        setData(res.data);
        setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to load GBA tasks:', err);
      setError('Unable to load GBA tasks from intranet http://107.102.39.55/tkdn/ (or local fallback).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Unique PICs list
  const picOptions = useMemo(() => {
    if (!data.columns) return [];
    const pics = new Set();
    Object.values(data.columns).forEach((tasks) => {
      if (Array.isArray(tasks)) {
        tasks.forEach((t) => {
          if (t.pic_email) pics.add(t.pic_email);
        });
      }
    });
    return Array.from(pics).sort();
  }, [data]);

  // Quick stats
  const kpiStats = useMemo(() => {
    let total = 0;
    let urgent = 0;
    let ongoing = 0;
    let approved = 0;

    if (data.columns) {
      Object.entries(data.columns).forEach(([st, tasks]) => {
        if (!Array.isArray(tasks)) return;
        total += tasks.length;
        tasks.forEach((t) => {
          if (t.is_urgent === 1 || t.is_urgent === '1' || t.is_urgent === true) urgent += 1;
        });
        if (['Test Ongoing', 'Pending Feedback', 'Feedback Sent'].includes(st)) ongoing += tasks.length;
        if (st === 'Approved') approved += tasks.length;
      });
    }

    return { total, urgent, ongoing, approved };
  }, [data]);

  // Filter columns
  const filteredColumns = useMemo(() => {
    const result = {};
    KANBAN_STATUSES.forEach((st) => {
      const list = data.columns?.[st] || [];
      result[st] = list.filter((task) => {
        if (urgentOnly && !(task.is_urgent === 1 || task.is_urgent === '1' || task.is_urgent === true)) {
          return false;
        }
        if (selectedPic && task.pic_email !== selectedPic) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchModel = (task.model_name || '').toLowerCase().includes(q);
          const matchProject = (task.project_name || '').toLowerCase().includes(q);
          const matchAp = (task.ap || '').toLowerCase().includes(q);
          const matchCp = (task.cp || '').toLowerCase().includes(q);
          const matchCsc = (task.csc || '').toLowerCase().includes(q);
          const matchSubId = (task.submission_id || '').toLowerCase().includes(q);
          const matchPic = (task.pic_email || '').toLowerCase().includes(q);
          if (!matchModel && !matchProject && !matchAp && !matchCp && !matchCsc && !matchSubId && !matchPic) return false;
        }
        return true;
      });
    });
    return result;
  }, [data, search, selectedPic, urgentOnly]);

  const handleOpenDetail = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  return (
    <div className={styles.container}>
      {/* Top Header Bar */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <KanbanIcon size={20} color="var(--color-accent)" />
            {t('gba_tasks.title', 'GBA Task Manager')}
            {/* Compact live dot per user request */}
            <span
              className={styles.liveDot}
              title={`Live Data Source: http://107.102.39.55/tkdn/ (Fallback: port 8089) • Updated ${lastRefreshed || 'Just now'}`}
            />
          </h1>

          <div className={styles.statsBar}>
            <span className={styles.statItem}>
              {t('common.total', 'Total')}: <span className={styles.statValue}>{kpiStats.total}</span>
            </span>
            <span>•</span>
            <span className={styles.statItem} style={{ color: '#ef4444' }}>
              {t('gba_tasks.priority_urgent', 'Urgent')}: <span className={styles.statValue} style={{ color: '#ef4444' }}>{kpiStats.urgent}</span>
            </span>
            <span>•</span>
            <span className={styles.statItem} style={{ color: '#f59e0b' }}>
              {t('gba_tasks.col_in_progress', 'Ongoing')}: <span className={styles.statValue} style={{ color: '#f59e0b' }}>{kpiStats.ongoing}</span>
            </span>
            <span>•</span>
            <span className={styles.statItem} style={{ color: '#10b981' }}>
              {t('gba_tasks.col_done', 'Approved')}: <span className={styles.statValue} style={{ color: '#10b981' }}>{kpiStats.approved}</span>
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <input
            type="text"
            placeholder={t('gba_tasks.search_placeholder', 'Search model, AP, PIC...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={selectedPic}
            onChange={(e) => setSelectedPic(e.target.value)}
            className={styles.selectInput}
          >
            <option value="">{t('gba_tasks.filter_assignee', 'All PICs')}</option>
            {picOptions.map((p) => (
              <option key={p} value={p}>
                {p.split('@')[0]}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`${styles.urgentBtn} ${urgentOnly ? styles.active : ''}`}
            onClick={() => setUrgentOnly((prev) => !prev)}
            title="Filter urgent tasks"
          >
            <Flame size={12} />
            {t('gba_tasks.priority_urgent', 'Urgent')} {kpiStats.urgent > 0 && `(${kpiStats.urgent})`}
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTasks}
            disabled={loading}
            title={t('gba_tasks.sync_tasks_btn', 'Sync live from GBA Task Manager')}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </Button>

          <a
            href="http://107.102.39.55/tkdn/"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
              e.currentTarget.style.borderColor = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
            title="Buka GBA Task Manager di Intranet PC (107.102.39.55/tkdn)"
          >
            <ExternalLink size={12} />
            <span>Intranet 107.102.39.55</span>
          </a>

          <span className={styles.viewOnlyPill}>View-Only</span>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-xs)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Classic Kanban Board: Horizontal scroll with fixed comfortable columns */}
      {loading ? (
        <LoadingState message={t('common.loading', 'Loading GBA Kanban tasks...')} />
      ) : (
        <div className={styles.kanbanBoard}>
          {KANBAN_STATUSES.map((status) => {
            const conf = STATUS_CONFIG[status] || { color: '#64748b' };
            const tasks = filteredColumns[status] || [];

            return (
              <div key={status} className={styles.column}>
                {/* Column Header */}
                <div className={styles.colHeader}>
                  <div className={styles.colTitleArea}>
                    <span className={styles.colDot} style={{ backgroundColor: conf.color }} />
                    <span className={styles.colTitle}>{status}</span>
                  </div>
                  <span className={styles.colBadge}>{tasks.length}</span>
                </div>

                {/* Cards List: Smooth vertical scroll per column */}
                <div className={styles.cardsList}>
                  {tasks.length === 0 ? (
                    <div className={styles.emptyCol}>{t('common.no_data', 'No active tasks')}</div>
                  ) : (
                    tasks.map((task) => {
                      const isUrgent =
                        task.is_urgent === 1 || task.is_urgent === '1' || task.is_urgent === true;
                      const picUsername = task.pic_email ? task.pic_email.split('@')[0] : 'Unassigned';

                      return (
                        <div
                          key={task.id}
                          className={styles.card}
                          onClick={() => handleOpenDetail(task)}
                          title="Click to view details (View Only)"
                        >
                          <div className={styles.cardHeader}>
                            <div className={styles.modelTitleGroup}>
                              {task.project_name && (
                                <div className={styles.marketingName} title={`Marketing Name: ${task.project_name}`}>
                                  {task.project_name}
                                </div>
                              )}
                              <div className={styles.modelName} title={`Model: ${task.model_name}`}>
                                {task.model_name}
                              </div>
                            </div>
                            {isUrgent && (
                              <span className={styles.urgentPill}>
                                <Flame size={10} />
                                URGENT
                              </span>
                            )}
                          </div>

                          {(task.ap || task.cp || task.csc) && (
                            <div className={styles.cardBuild}>
                              {task.ap && (
                                <span className={styles.buildChip} title={`AP: ${task.ap}`}>
                                  <strong>AP:</strong> {task.ap}
                                </span>
                              )}
                              {task.cp && (
                                <span className={styles.buildChip} title={`CP: ${task.cp}`}>
                                  <strong>CP:</strong> {task.cp}
                                </span>
                              )}
                              {task.csc && (
                                <span className={styles.buildChip} title={`CSC: ${task.csc}`}>
                                  <strong>CSC:</strong> {task.csc}
                                </span>
                              )}
                            </div>
                          )}

                          <div className={styles.badgesRow}>
                            {task.test_plan_type && (
                              <span className={styles.planPill}>{task.test_plan_type}</span>
                            )}
                            {task.submission_id && (
                              <span className={styles.submissionPill}>
                                #{task.submission_id}
                              </span>
                            )}
                          </div>

                          <div className={styles.cardFooter}>
                            <span className={styles.picName} title={task.pic_email}>
                              👤 {picUsername}
                            </span>
                            {task.deadline && (
                              <span className={styles.deadline} title={`Deadline: ${task.deadline}`}>
                                📅 {task.deadline.slice(5)}
                              </span>
                            )}
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
      )}

      {/* Task Details Modal (View Only) */}
      {isModalOpen && selectedTask && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`GBA Task: ${selectedTask.model_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Status Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: STATUS_CONFIG[selectedTask.progress_status]?.color || '#64748b',
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: '13.5px' }}>
                  {selectedTask.progress_status}
                </span>
              </div>

              {selectedTask.is_urgent === 1 || selectedTask.is_urgent === '1' ? (
                <span className={styles.urgentPill} style={{ fontSize: '11px', padding: '2px 8px' }}>
                  <Flame size={12} />
                  URGENT PRIORITY
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Normal Priority
                </span>
              )}
            </div>

            {/* Grid details */}
            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Model Name</span>
                <span className={styles.modalValue}>{selectedTask.model_name}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Project Name</span>
                <span className={styles.modalValue}>{selectedTask.project_name || 'Standard Model'}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>AP (PDA) Build</span>
                <span className={`${styles.modalValue} ${styles.modalValueCode}`}>
                  {selectedTask.ap || '-'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>CSC Build</span>
                <span className={`${styles.modalValue} ${styles.modalValueCode}`}>
                  {selectedTask.csc || '-'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>CP (Modem) Build</span>
                <span className={`${styles.modalValue} ${styles.modalValueCode}`}>
                  {selectedTask.cp || '-'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Test Plan Type</span>
                <span className={styles.modalValue}>{selectedTask.test_plan_type || '-'}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Engineer PIC</span>
                <span className={styles.modalValue} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                  {selectedTask.pic_email || 'Unassigned'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Reviewer Email</span>
                <span className={styles.modalValue}>{selectedTask.reviewer_email || '-'}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Submission ID</span>
                <span className={styles.modalValue}>
                  {selectedTask.submission_id || selectedTask.base_submission_id || 'Not Submitted'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Task ID</span>
                <span className={styles.modalValue}>#{selectedTask.id}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Request Date</span>
                <span className={styles.modalValue}>{selectedTask.request_date || '-'}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Deadline</span>
                <span className={styles.modalValue} style={{ color: '#ef4444', fontWeight: 600 }}>
                  {selectedTask.deadline || '-'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Submission Date</span>
                <span className={styles.modalValue}>{selectedTask.submission_date || '-'}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Approved Date</span>
                <span className={styles.modalValue} style={{ color: '#10b981', fontWeight: 600 }}>
                  {selectedTask.approved_date || '-'}
                </span>
              </div>
            </div>

            {/* QuickBuild Package Targets */}
            {(selectedTask.qb_user || selectedTask.qb_userdebug || selectedTask.qb_eng) && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--color-border)',
              }}>
                <span className={styles.modalLabel}>QuickBuild Package Targets</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedTask.qb_user && (
                    <span className={styles.planPill}>User: {selectedTask.qb_user}</span>
                  )}
                  {selectedTask.qb_userdebug && (
                    <span className={styles.planPill}>UserDebug: {selectedTask.qb_userdebug}</span>
                  )}
                  {selectedTask.qb_eng && (
                    <span className={styles.planPill}>Eng: {selectedTask.qb_eng}</span>
                  )}
                </div>
              </div>
            )}

            {/* Notes if available */}
            {selectedTask.notes && (
              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Notes / Instructions</span>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    lineHeight: 1.4,
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedTask.notes }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Close (View Only)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GbaTasksPage;
