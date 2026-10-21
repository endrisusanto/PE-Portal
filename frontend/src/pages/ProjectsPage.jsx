import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderKanban, CheckSquare, Layers, Clock, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('development');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');

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
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={14} />
          New Project
        </Button>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
              <textarea
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope, objectives, and deliverables..."
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
    </div>
  );
};

export default ProjectsPage;
