import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Kanban as KanbanIcon,
  Flame,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  FolderKanban,
  User,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Plus,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import styles from './ProjectsPage.module.css';

// Status Configuration matching BP MXPE / project_manager GBA workflow
const STATUS_CONFIG = {
  'Task Baru': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)' },
  'Downloaded': { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)' },
  'Test Ongoing': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
  'Pending Feedback': { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.25)' },
  'Feedback Sent': { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)' },
  'Submitted': { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.25)' },
  'Approved': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)' },
  'Batal': { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)' },
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

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('gba_kanban'); // 'gba_kanban' | 'portal_projects'

  // GBA Tasks Kanban State
  const [gbaLoading, setGbaLoading] = useState(true);
  const [gbaData, setGbaData] = useState({ columns: {}, total: 0 });
  const [gbaError, setGbaError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Portal Projects State
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectType, setProjectType] = useState('development');
  const [projectPriority, setProjectPriority] = useState('medium');
  const [projectDesc, setProjectDesc] = useState('');

  // Fetch GBA Tasks Kanban data
  const fetchGbaTasks = async () => {
    setGbaLoading(true);
    setGbaError(null);
    try {
      const res = await api.get('/gba-tasks');
      if (res.data) {
        setGbaData(res.data);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to load GBA tasks:', err);
      setGbaError('Unable to connect to GBA Task Manager (http://localhost:8089).');
    } finally {
      setGbaLoading(false);
    }
  };

  // Fetch internal Portal Projects
  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    fetchGbaTasks();
  }, []);

  useEffect(() => {
    if (activeTab === 'portal_projects') {
      fetchProjects();
    }
  }, [activeTab]);

  // Extract all unique PIC emails for the filter dropdown
  const picOptions = useMemo(() => {
    if (!gbaData.columns) return [];
    const pics = new Set();
    Object.values(gbaData.columns).forEach((columnTasks) => {
      if (Array.isArray(columnTasks)) {
        columnTasks.forEach((t) => {
          if (t.pic_email) pics.add(t.pic_email);
        });
      }
    });
    return Array.from(pics).sort();
  }, [gbaData]);

  // Aggregate KPI metrics
  const kpiStats = useMemo(() => {
    let total = 0;
    let urgent = 0;
    let ongoing = 0;
    let approved = 0;

    if (gbaData.columns) {
      Object.entries(gbaData.columns).forEach(([status, tasks]) => {
        if (!Array.isArray(tasks)) return;
        total += tasks.length;
        tasks.forEach((t) => {
          if (t.is_urgent === 1 || t.is_urgent === '1' || t.is_urgent === true) {
            urgent += 1;
          }
        });
        if (['Test Ongoing', 'Pending Feedback', 'Feedback Sent'].includes(status)) {
          ongoing += tasks.length;
        }
        if (status === 'Approved') {
          approved += tasks.length;
        }
      });
    }

    return { total, urgent, ongoing, approved };
  }, [gbaData]);

  // Filter tasks in each column
  const filteredColumns = useMemo(() => {
    const result = {};
    KANBAN_STATUSES.forEach((st) => {
      const list = gbaData.columns?.[st] || [];
      result[st] = list.filter((task) => {
        // Urgent filter
        if (urgentOnly && !(task.is_urgent === 1 || task.is_urgent === '1' || task.is_urgent === true)) {
          return false;
        }
        // PIC filter
        if (selectedPic && task.pic_email !== selectedPic) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchModel = (task.model_name || '').toLowerCase().includes(q);
          const matchAp = (task.ap || '').toLowerCase().includes(q);
          const matchCsc = (task.csc || '').toLowerCase().includes(q);
          const matchSubId = (task.submission_id || '').toLowerCase().includes(q);
          const matchPic = (task.pic_email || '').toLowerCase().includes(q);
          if (!matchModel && !matchAp && !matchCsc && !matchSubId && !matchPic) {
            return false;
          }
        }
        return true;
      });
    });
    return result;
  }, [gbaData, searchQuery, selectedPic, urgentOnly]);

  const handleOpenDetail = (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/projects', {
        title: projectTitle,
        project_type: projectType,
        priority: projectPriority,
        description: projectDesc || undefined,
        progress: 0,
      });
      setProjects((prev) => [res.data, ...prev]);
      setIsProjectModalOpen(false);
      setProjectTitle('');
      setProjectDesc('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const projectTableColumns = [
    {
      title: 'Project Title',
      key: 'title',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
            {row.project_type}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      title: 'Priority',
      key: 'priority',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
          <div style={{
            flex: 1,
            height: '6px',
            backgroundColor: 'var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${val}%`,
              height: '100%',
              backgroundColor: 'var(--color-accent)',
              borderRadius: 'inherit',
            }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{val}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <KanbanIcon size={24} color="var(--color-accent)" />
            GBA Task Manager & Projects
          </h1>
          <p className={styles.subtitle}>
            <span>Samsung Electronics Indonesia (SEIN) Production Engineer Workflow</span>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              Live Connected (Port 8089)
            </span>
            {lastRefreshed && (
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                • Synced: {lastRefreshed}
              </span>
            )}
          </p>
        </div>

        <div className={styles.tabControls}>
          <div className={styles.tabSwitcher}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'gba_kanban' ? styles.active : ''}`}
              onClick={() => setActiveTab('gba_kanban')}
            >
              📋 GBA Kanban Board (View Only)
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'portal_projects' ? styles.active : ''}`}
              onClick={() => setActiveTab('portal_projects')}
            >
              📁 Portal Projects Repository
            </button>
          </div>

          {activeTab === 'gba_kanban' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchGbaTasks}
              disabled={gbaLoading}
              title="Refresh Kanban from GBA Task Manager"
            >
              <RefreshCw size={14} className={gbaLoading ? 'spin' : ''} />
              Sync
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsProjectModalOpen(true)}>
              <Plus size={14} />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: GBA TASKS KANBAN BOARD (VIEW ONLY)
          ===================================================================== */}
      {activeTab === 'gba_kanban' && (
        <>
          {/* KPI Summary Row */}
          <div className={styles.kpiRow}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <Layers size={20} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Total Tasks</span>
                <span className={styles.kpiValue}>{kpiStats.total}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <Flame size={20} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Urgent Tasks</span>
                <span className={styles.kpiValue} style={{ color: '#ef4444' }}>{kpiStats.urgent}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Clock size={20} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Ongoing Tests</span>
                <span className={styles.kpiValue}>{kpiStats.ongoing}</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <CheckCircle2 size={20} />
              </div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Approved</span>
                <span className={styles.kpiValue} style={{ color: '#10b981' }}>{kpiStats.approved}</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              {/* Search */}
              <div className={styles.searchBox}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search model, AP, CSC, Submission ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* PIC Filter */}
              <select
                value={selectedPic}
                onChange={(e) => setSelectedPic(e.target.value)}
                className={styles.selectInput}
              >
                <option value="">All Engineers (PIC)</option>
                {picOptions.map((pic) => (
                  <option key={pic} value={pic}>
                    {pic}
                  </option>
                ))}
              </select>

              {/* Urgent Toggle */}
              <button
                type="button"
                className={`${styles.urgentToggle} ${urgentOnly ? styles.active : ''}`}
                onClick={() => setUrgentOnly((prev) => !prev)}
                title="Filter only urgent tasks"
              >
                <Flame size={14} />
                Urgent Only {kpiStats.urgent > 0 && `(${kpiStats.urgent})`}
              </button>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.viewOnlyBadge}>🔒 View-Only Mode</span>
            </div>
          </div>

          {/* Error Notice if any */}
          {gbaError && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px'
            }}>
              <AlertCircle size={16} />
              <span>{gbaError} — Check that project_manager is running on port 8089.</span>
            </div>
          )}

          {/* Kanban Board (8 columns) */}
          {gbaLoading ? (
            <LoadingState message="Loading GBA Kanban tasks from server..." />
          ) : (
            <div className={styles.kanbanBoard}>
              {KANBAN_STATUSES.map((status) => {
                const conf = STATUS_CONFIG[status] || { color: '#64748b' };
                const tasksInCol = filteredColumns[status] || [];

                return (
                  <div key={status} className={styles.kanbanCol}>
                    {/* Column Header */}
                    <div className={styles.colHeader}>
                      <div className={styles.colTitleArea}>
                        <span
                          className={styles.colStatusDot}
                          style={{ backgroundColor: conf.color }}
                        />
                        <span className={styles.colTitle}>{status}</span>
                      </div>
                      <span className={styles.colBadge}>{tasksInCol.length}</span>
                    </div>

                    {/* Cards Container */}
                    <div className={styles.cardsContainer}>
                      {tasksInCol.length === 0 ? (
                        <div className={styles.emptyColumn}>No tasks</div>
                      ) : (
                        tasksInCol.map((task) => {
                          const isUrgent =
                            task.is_urgent === 1 || task.is_urgent === '1' || task.is_urgent === true;
                          const picInitials = task.pic_email
                            ? task.pic_email.split('@')[0].split('.').map(p => p[0]?.toUpperCase()).join('').slice(0, 2)
                            : '??';

                          return (
                            <div
                              key={task.id}
                              className={styles.kanbanCard}
                              onClick={() => handleOpenDetail(task)}
                              title="Click to view details (View Only)"
                            >
                              {/* Header: Model & Urgent */}
                              <div className={styles.cardHeader}>
                                <div className={styles.modelName}>{task.model_name}</div>
                                {isUrgent && (
                                  <span className={styles.urgentPill}>
                                    <Flame size={10} />
                                    URGENT
                                  </span>
                                )}
                              </div>

                              {/* Build Details */}
                              <div className={styles.cardBuildInfo}>
                                {task.ap && (
                                  <div className={styles.buildLine}>
                                    <span className={styles.buildLabel}>AP:</span>
                                    <span>{task.ap}</span>
                                  </div>
                                )}
                                {task.csc && (
                                  <div className={styles.buildLine}>
                                    <span className={styles.buildLabel}>CSC:</span>
                                    <span>{task.csc}</span>
                                  </div>
                                )}
                              </div>

                              {/* Badges: Test Plan */}
                              <div className={styles.cardBadgesRow}>
                                {task.test_plan_type && (
                                  <span className={styles.planPill}>
                                    {task.test_plan_type}
                                  </span>
                                )}
                                {task.submission_id && (
                                  <span className={styles.planPill} style={{ color: 'var(--color-accent)' }}>
                                    ID: {task.submission_id}
                                  </span>
                                )}
                              </div>

                              {/* Footer: PIC & Deadline */}
                              <div className={styles.cardFooter}>
                                <div className={styles.picBadge} title={task.pic_email}>
                                  <span className={styles.picAvatar}>{picInitials}</span>
                                  <span>{task.pic_email ? task.pic_email.split('@')[0] : 'Unassigned'}</span>
                                </div>

                                {task.deadline && (
                                  <div className={styles.dateBadge} title={`Deadline: ${task.deadline}`}>
                                    <Calendar size={12} />
                                    <span>{task.deadline.slice(5)}</span>
                                  </div>
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
        </>
      )}

      {/* =====================================================================
          TAB 2: PORTAL PROJECTS REPOSITORY
          ===================================================================== */}
      {activeTab === 'portal_projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projectsLoading ? (
            <LoadingState message="Loading projects..." />
          ) : projects.length === 0 ? (
            <EmptyState
              title="No Engineering Projects"
              description="Get started by creating your first engineering improvement project."
              actionLabel="New Project"
              onAction={() => setIsProjectModalOpen(true)}
            />
          ) : (
            <Table columns={projectTableColumns} data={projects} />
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW-ONLY DETAIL MODAL FOR GBA TASK
          ===================================================================== */}
      {isDetailModalOpen && selectedTask && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`GBA Task Details: ${selectedTask.model_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: STATUS_CONFIG[selectedTask.progress_status]?.color || '#64748b',
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  {selectedTask.progress_status}
                </span>
              </div>

              {selectedTask.is_urgent === 1 || selectedTask.is_urgent === '1' ? (
                <span className={styles.urgentPill} style={{ fontSize: '11px', padding: '3px 8px' }}>
                  <Flame size={12} />
                  URGENT PRIORITY
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
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

            {/* Quick build links */}
            {(selectedTask.qb_user || selectedTask.qb_userdebug || selectedTask.qb_eng) && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-sm)',
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
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12.5px',
                    lineHeight: 1.5,
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedTask.notes }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close (View Only)
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Create Project */}
      {isProjectModalOpen && (
        <Modal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          title="Create Engineering Project"
        >
          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Project Title</label>
              <input
                type="text"
                required
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. SMT Line Automation Revamp"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="development">Development</option>
                  <option value="improvement">Improvement</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Priority</label>
                <select
                  value={projectPriority}
                  onChange={(e) => setProjectPriority(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
              <textarea
                rows="3"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Scope and target metrics..."
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsProjectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Project
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ProjectsPage;
