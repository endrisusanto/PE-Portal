import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderKanban, Edit2, LayoutGrid, List } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import { FormattingTextarea } from '../components/common/FormattingTextarea';

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Create Project Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('development');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');

  // Edit Project Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProjectType, setEditProjectType] = useState('development');
  const [editStatus, setEditStatus] = useState('planning');
  const [editPriority, setEditPriority] = useState('medium');
  const [editProgress, setEditProgress] = useState(0);
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/projects', {
        title,
        project_type: projectType,
        priority,
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
        description: description || undefined,
        progress: 0,
      });
      setProjects((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setStartDate('');
      setTargetDate('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const openEditModal = (p) => {
    setEditingProject(p);
    setEditTitle(p.title || '');
    setEditProjectType(p.project_type || 'development');
    setEditStatus(p.status || 'planning');
    setEditPriority(p.priority || 'medium');
    setEditProgress(p.progress || 0);
    setEditStartDate(p.start_date ? p.start_date.substring(0, 10) : '');
    setEditTargetDate(p.target_date ? p.target_date.substring(0, 10) : '');
    setEditDescription(p.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!editingProject) return;

    try {
      const res = await api.put(`/projects/${editingProject.id}`, {
        title: editTitle,
        project_type: editProjectType,
        status: editStatus,
        priority: editPriority,
        progress: Number(editProgress) || 0,
        start_date: editStartDate || undefined,
        target_date: editTargetDate || undefined,
        description: editDescription || undefined,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === editingProject.id ? { ...p, ...res.data } : p))
      );
      setIsEditModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const columns = [
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
    {
      title: 'Target Date',
      key: 'target_date',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {val ? new Date(val).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, row) => (
        <Button
          variant="outline"
          size="xs"
          icon={Edit2}
          onClick={() => openEditModal(row)}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderKanban size={22} color="var(--color-accent)" />
            {t('nav.projects')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            SEIN Engineering Project Milestones, JIG Developments, & Equipment Revamps
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Toggle */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            padding: '2px',
          }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <List size={14} />
              <span>Table</span>
            </button>
          </div>

          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={14} />
            New Project
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading projects..." />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No Engineering Projects"
          description="Get started by creating your first engineering improvement project."
          actionLabel="New Project"
          onAction={() => setIsModalOpen(true)}
        />
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                    letterSpacing: '0.04em',
                  }}>
                    {p.project_type}
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                    {p.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(p)}
                  title="Edit Project"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-accent)';
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StatusBadge status={p.status} />
                <StatusBadge status={p.priority} />
              </div>

              {p.description && (
                <p style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {p.description}
                </p>
              )}

              {/* Progress */}
              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{p.progress || 0}%</span>
                </div>
                <div style={{
                  height: '6px',
                  backgroundColor: 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${p.progress || 0}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-accent)',
                    borderRadius: 'inherit',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span>Start: {p.start_date ? new Date(p.start_date).toLocaleDateString() : '-'}</span>
                <span>Target: {p.target_date ? new Date(p.target_date).toLocaleDateString() : '-'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table columns={columns} data={projects} />
      )}

      {/* Modal: Create Project */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Engineering Project"
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Project Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Completion</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
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
            </div>

            <FormattingTextarea
              label="Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, objectives, and deliverables..."
              minHeight="100px"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create Project
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Project */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingProject(null);
          }}
          title={`Edit Project: ${editingProject?.title || ''}`}
        >
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Project Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Type</label>
                <select
                  value={editProjectType}
                  onChange={(e) => setEditProjectType(e.target.value)}
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Progress</label>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)' }}>
                  {editProgress}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-accent)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Completion</label>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
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
            </div>

            <FormattingTextarea
              label="Description"
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Scope, objectives, and deliverables..."
              minHeight="120px"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProject(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ProjectsPage;

