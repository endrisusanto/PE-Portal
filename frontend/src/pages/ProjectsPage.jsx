import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  FolderKanban,
  Edit2,
  LayoutGrid,
  Kanban as KanbanIcon,
  List,
  CheckCircle2,
  ChevronRight,
  User,
  Mail,
  Send,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Flame,
  Check,
  Tag,
  Wrench,
  Cpu,
  Layers,
  Sparkles,
  Eye,
  Clock,
  FileText,
  Paperclip,
  Loader2,
  Upload,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import { FormattingTextarea } from '../components/common/FormattingTextarea';
import { CommentTimelineSection, logTimelineEvent } from '../components/common/CommentTimelineSection';
import { AttachmentViewer } from '../components/common/AttachmentViewer';
import styles from './ProjectsPage.module.css';

// 5 Milestone Problem Solving & Process Stages for PE
export const MILESTONE_STAGES = [
  { id: 'identified', step: 1, label: 'Issue Identified', percent: 20, color: '#ef4444', desc: 'Identifikasi awal issue mechanical atau proses produksi' },
  { id: 'root_cause', step: 2, label: 'Root Cause Analysis', percent: 40, color: '#f59e0b', desc: 'Analisa investigasi 5-Why, Fishbone & log' },
  { id: 'countermeasure', step: 3, label: 'Trial Countermeasure', percent: 60, color: '#3b82f6', desc: 'Uji coba perbaikan parameter / jig tooling' },
  { id: 'verification', step: 4, label: 'Verification & Yield', percent: 80, color: '#8b5cf6', desc: 'Validasi kestabilan proses & monitoring yield' },
  { id: 'standardized', step: 5, label: 'Closed & Standardized', percent: 100, color: '#10b981', desc: 'Standarisasi SOP, transfer line & issue closed' },
];

export const getMilestone = (progress = 0) => {
  if (progress >= 100) return MILESTONE_STAGES[4];
  if (progress >= 75) return MILESTONE_STAGES[3];
  if (progress >= 50) return MILESTONE_STAGES[2];
  if (progress >= 25) return MILESTONE_STAGES[1];
  return MILESTONE_STAGES[0];
};

export const ISSUE_TYPES = [
  { value: 'mechanical', label: 'Mechanical Issue Analysis' },
  { value: 'process', label: 'Production Process Optimization' },
  { value: 'yield', label: 'Line Yield & Defect Loss' },
  { value: 'tooling', label: 'Tooling, Fixture & JIGs' },
  { value: 'development', label: 'New Model Trial Development' },
];

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'kanban' | 'table'
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // View Detail Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const openViewModal = (p) => {
    setViewingProject(p);
    setIsViewModalOpen(true);
  };

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('mechanical');
  const [priority, setPriority] = useState('medium');
  const [ownerId, setOwnerId] = useState('');
  const [createProgress, setCreateProgress] = useState(20);
  const [sendEmail, setSendEmail] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [createAttachments, setCreateAttachments] = useState([]);
  const [uploadingCreateAttachment, setUploadingCreateAttachment] = useState(false);
  const createFileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProjectType, setEditProjectType] = useState('mechanical');
  const [editStatus, setEditStatus] = useState('planning');
  const [editPriority, setEditPriority] = useState('medium');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editProgress, setEditProgress] = useState(20);
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAttachments, setEditAttachments] = useState([]);
  const [uploadingEditAttachment, setUploadingEditAttachment] = useState(false);
  const editFileInputRef = useRef(null);

  // Detail Modal Quick Attachment State
  const [uploadingDetailAttachment, setUploadingDetailAttachment] = useState(false);
  const detailFileInputRef = useRef(null);

  // Upload Helpers for Milestone Task Attachments
  const handleCreateAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingCreateAttachment(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/comments/upload-attachment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setCreateAttachments((prev) => [...prev, res.data]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunggah lampiran');
    } finally {
      setUploadingCreateAttachment(false);
      if (createFileInputRef.current) createFileInputRef.current.value = '';
    }
  };

  const handleEditAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingEditAttachment(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/comments/upload-attachment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setEditAttachments((prev) => [...prev, res.data]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunggah lampiran');
    } finally {
      setUploadingEditAttachment(false);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    }
  };

  const handleDetailAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !viewingProject) return;
    setUploadingDetailAttachment(true);
    try {
      const newItems = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/comments/upload-attachment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newItems.push(res.data);
      }
      let currentAttachments = [];
      if (Array.isArray(viewingProject.attachments)) {
        currentAttachments = viewingProject.attachments;
      } else if (typeof viewingProject.attachments === 'string') {
        try {
          currentAttachments = JSON.parse(viewingProject.attachments);
        } catch {
          currentAttachments = [];
        }
      }
      const updatedAttachments = [...currentAttachments, ...newItems];

      const res = await api.put(`/projects/${viewingProject.id}`, {
        title: viewingProject.title,
        project_type: viewingProject.project_type,
        status: viewingProject.status,
        priority: viewingProject.priority,
        owner_id: viewingProject.owner_id || undefined,
        progress: viewingProject.progress,
        start_date: viewingProject.start_date || undefined,
        target_date: viewingProject.target_date || undefined,
        description: viewingProject.description || undefined,
        attachments: updatedAttachments,
      });

      const updatedItem = { ...viewingProject, ...res.data, attachments: updatedAttachments };
      setViewingProject(updatedItem);
      setProjects((prev) => prev.map((item) => (item.id === viewingProject.id ? updatedItem : item)));
      showToast(`${newItems.length} lampiran berhasil ditambahkan ke task!`);

      const fileNames = newItems.map((n) => n.name).join(', ');
      await logTimelineEvent('project', viewingProject.id, `Lampiran baru diunggah ke task body: ${fileNames}`);
      setTimelineRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunggah lampiran');
    } finally {
      setUploadingDetailAttachment(false);
      if (detailFileInputRef.current) detailFileInputRef.current.value = '';
    }
  };

  // Fetch Projects & Active Users
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
      console.error('Failed to load projects/users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Create Project / Milestone Task
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        project_type: projectType,
        priority,
        owner_id: ownerId || undefined,
        progress: createProgress,
        status: createProgress >= 100 ? 'completed' : createProgress > 20 ? 'in_progress' : 'planning',
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
        description: description || undefined,
        attachments: createAttachments,
        send_email: sendEmail,
      };

      const res = await api.post('/projects', payload);
      setProjects((prev) => [res.data, ...prev]);
      setIsModalOpen(false);

      // Reset form
      setTitle('');
      setProjectType('mechanical');
      setPriority('medium');
      setOwnerId('');
      setCreateProgress(20);
      setSendEmail(true);
      setDescription('');
      setTargetDate('');
      setCreateAttachments([]);

      const picUser = users.find((u) => u.id === ownerId);
      const picName = picUser?.full_name || 'Unassigned';
      if (sendEmail && picUser && picUser.email) {
        showToast(`Task berhasil dibuat & notifikasi email dikirim ke ${picUser.email}!`);
      } else {
        showToast('Milestone Task berhasil ditambahkan!');
      }

      // Record timeline change log
      await logTimelineEvent(
        'project',
        res.data.id,
        `Milestone Task Analyst dibuat dengan prioritas ${priority.toUpperCase()}, milestone ${getMilestone(createProgress).label} (${createProgress}%), dan PIC ${picName}`
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (p) => {
    setEditingProject(p);
    setEditTitle(p.title || '');
    setEditProjectType(p.project_type || 'mechanical');
    setEditStatus(p.status || 'planning');
    setEditPriority(p.priority || 'medium');
    setEditOwnerId(p.owner_id || '');
    setEditProgress(p.progress || 0);
    setEditStartDate(p.start_date ? p.start_date.substring(0, 10) : '');
    setEditTargetDate(p.target_date ? p.target_date.substring(0, 10) : '');
    setEditDescription(p.description || '');

    let initialAttachments = [];
    if (Array.isArray(p.attachments)) {
      initialAttachments = p.attachments;
    } else if (typeof p.attachments === 'string') {
      try {
        initialAttachments = JSON.parse(p.attachments);
      } catch {
        initialAttachments = [];
      }
    }
    setEditAttachments(initialAttachments);

    setIsEditModalOpen(true);
  };

  // Update Project / Milestone Task
  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!editingProject) return;

    try {
      const payload = {
        title: editTitle,
        project_type: editProjectType,
        status: editProgress >= 100 ? 'completed' : editStatus,
        priority: editPriority,
        owner_id: editOwnerId || undefined,
        progress: Number(editProgress) || 0,
        start_date: editStartDate || undefined,
        target_date: editTargetDate || undefined,
        description: editDescription || undefined,
        attachments: editAttachments,
      };

      const res = await api.put(`/projects/${editingProject.id}`, payload);
      const updated = { ...editingProject, ...res.data };
      setProjects((prev) =>
        prev.map((p) => (p.id === editingProject.id ? updated : p))
      );

      // Compute and record timeline change log
      const changes = [];
      if (editTitle !== editingProject.title) changes.push(`Judul diubah ke "${editTitle}"`);
      if (Number(editProgress) !== Number(editingProject.progress)) {
        changes.push(`Milestone diubah ke ${getMilestone(editProgress).label} (${editProgress}%)`);
      }
      if (payload.status !== editingProject.status) changes.push(`Status diubah ke ${payload.status}`);
      if (editPriority !== editingProject.priority) changes.push(`Prioritas diubah ke ${editPriority.toUpperCase()}`);
      if (editProjectType !== editingProject.project_type) changes.push(`Kategori issue diubah ke ${editProjectType}`);
      if (editOwnerId !== (editingProject.owner_id || '')) {
        const newOwner = users.find((u) => u.id === editOwnerId)?.full_name || 'Unassigned';
        changes.push(`PIC dialihkan ke ${newOwner}`);
      }
      if (editDescription !== (editingProject.description || '')) {
        changes.push('Catatan analisis/investigasi diperbarui');
      }
      if (editAttachments.length !== (editingProject.attachments?.length || 0)) {
        changes.push(`Lampiran berkas diperbarui (${editAttachments.length} file)`);
      }
      const logMsg = changes.length > 0 ? changes.join('; ') : 'Task Analyst diperbarui';
      await logTimelineEvent('project', editingProject.id, logMsg);

      if (viewingProject?.id === editingProject.id) {
        setViewingProject(updated);
        setTimelineRefreshKey((k) => k + 1);
      }

      setIsEditModalOpen(false);
      setEditingProject(null);
      showToast('Perubahan milestone task berhasil disimpan!');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Quick Advance Stage directly from Card
  const handleAdvanceStage = async (p, direction = 1) => {
    const curMilestone = getMilestone(p.progress || 0);
    let nextStep = curMilestone.step + direction;
    if (nextStep < 1) nextStep = 1;
    if (nextStep > 5) nextStep = 5;

    const targetStage = MILESTONE_STAGES[nextStep - 1];
    const newProgress = targetStage.percent;
    const newStatus = newProgress >= 100 ? 'completed' : 'in_progress';

    try {
      const res = await api.put(`/projects/${p.id}`, {
        title: p.title,
        project_type: p.project_type,
        status: newStatus,
        priority: p.priority,
        owner_id: p.owner_id,
        progress: newProgress,
        start_date: p.start_date || undefined,
        target_date: p.target_date || undefined,
        description: p.description || undefined,
      });

      const updatedItem = { ...p, ...res.data };
      setProjects((prev) =>
        prev.map((item) => (item.id === p.id ? updatedItem : item))
      );
      showToast(`Milestone ${p.title} diperbarui ke: ${targetStage.label}`);

      await logTimelineEvent(
        'project',
        p.id,
        `Milestone dipindahkan ke Step ${targetStage.step}: ${targetStage.label} (${targetStage.percent}%)`
      );
      if (viewingProject?.id === p.id) {
        setViewingProject(updatedItem);
        setTimelineRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to advance stage:', err);
    }
  };

  // ponytail: handle instant email notification dispatch for milestone updates
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const handleSendEmail = async (proj) => {
    if (!proj) return;
    const confirmSend = window.confirm(`Kirim notifikasi email ringkasan milestone untuk task "${proj.title}"?`);
    if (!confirmSend) return;

    setSendingEmailId(proj.id);
    try {
      const res = await api.post(`/projects/${proj.id}/send-email`);
      showToast(res.data?.message || 'Email notifikasi milestone berhasil dikirim!');
      await logTimelineEvent('project', proj.id, 'Notifikasi email milestone dikirim ke PIC/Tim');
      if (viewingProject?.id === proj.id) {
        setTimelineRefreshKey((k) => k + 1);
      }
    } catch (err) {
      alert('Gagal mengirim email: ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingEmailId(null);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedType && p.project_type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mTitle = (p.title || '').toLowerCase().includes(q);
        const mDesc = (p.description || '').toLowerCase().includes(q);
        const mOwner = (p.owner_name || '').toLowerCase().includes(q);
        const mType = (p.project_type || '').toLowerCase().includes(q);
        if (!mTitle && !mDesc && !mOwner && !mType) return false;
      }
      return true;
    });
  }, [projects, search, selectedType]);

  // Kanban Column Buckets (1 to 5)
  const kanbanColumns = useMemo(() => {
    const cols = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };
    filteredProjects.forEach((p) => {
      const ms = getMilestone(p.progress || 0);
      cols[ms.step].push(p);
    });
    return cols;
  }, [filteredProjects]);

  // Table Columns
  const columns = [
    {
      title: t('projects.col_task', 'Issue / Task Analisis'),
      key: 'title',
      render: (val, row) => {
        const ms = getMilestone(row.progress || 0);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{val}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--color-accent)', fontWeight: 600 }}>{row.project_type}</span>
              <span>•</span>
              <span style={{ color: ms.color, fontWeight: 600 }}>{ms.label} ({row.progress || 0}%)</span>
            </div>
          </div>
        );
      },
    },
    {
      title: t('projects.col_pic', 'PIC Assigned'),
      key: 'owner_name',
      render: (val) => (
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <User size={13} style={{ opacity: 0.7 }} />
          <span>{val || 'Unassigned'}</span>
        </span>
      ),
    },
    {
      title: t('common.priority', 'Priority'),
      key: 'priority',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      title: t('projects.col_milestone', 'Milestone'),
      key: 'progress',
      render: (val) => {
        const ms = getMilestone(val || 0);
        return (
          <div style={{ minWidth: '150px' }}>
            <div className={styles.tableBreadcrumb}>
              <span className={styles.tableBreadcrumbBadge}>Step {ms.step}</span>
              <span className={styles.breadcrumbSep}>›</span>
              <span className={styles.tableBreadcrumbLabel} style={{ color: ms.color }}>{ms.label}</span>
            </div>
            <div className={styles.microProgressLine}>
              <div
                className={styles.microProgressFill}
                style={{ width: `${val || 0}%`, backgroundColor: ms.color }}
              />
            </div>
          </div>
        );
      },
    },
    {
      title: t('projects.col_target_date', 'Target Date'),
      key: 'target_date',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {val ? new Date(val).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      title: t('common.actions', 'Action'),
      key: 'action',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button variant="outline" size="xs" icon={Eye} onClick={() => openViewModal(row)}>
            {t('common.view', 'Lihat')}
          </Button>
          <Button variant="outline" size="xs" icon={Edit2} onClick={() => openEditModal(row)}>
            {t('common.edit', 'Edit')}
          </Button>
          <Button
            variant="outline"
            size="xs"
            icon={Mail}
            loading={sendingEmailId === row.id}
            onClick={() => handleSendEmail(row)}
            title={t('projects.send_email_tooltip', 'Kirim Notifikasi Milestone via Email')}
          >
            {t('reports.send_email', 'Email')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
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

      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '18px 22px',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderKanban size={22} color="var(--color-accent)" />
            {t('projects.title', 'Milestone Task Analyst')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {t('projects.subtitle', 'Pelacakan Analisis Issue Mechanical, Optimasi Proses Produksi & Milestone Breadcrumb Navigation Tim SEIN PE')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* View Toggle */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '9999px',
            border: '1px solid var(--color-border)',
            padding: '3px',
            gap: '3px',
          }}>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              title="Matrix Card View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: viewMode === 'matrix' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'matrix' ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={14} />
              <span>{t('projects.view_matrix', 'Matrix Cards')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Kanban Board View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: viewMode === 'kanban' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'kanban' ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <KanbanIcon size={14} />
              <span>{t('projects.view_kanban', 'Kanban')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={14} />
              <span>{t('projects.view_table', 'Table')}</span>
            </button>
          </div>

          <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
            {t('projects.new_task', 'Create New Task')}
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issue title, PIC, or description..."
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            fontSize: '12.5px',
          }}
        >
          <option value="">{t('projects.all_categories', 'Semua Kategori Issue')}</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message={t('projects.loading_milestones', 'Memuat Milestone Task Analyst...')} />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Belum ada Task / Analisa Issue"
          description="Catat temuan analisa issue mechanical atau proses produksi dan assign PIC terkait."
          actionLabel="Buat Task Pertama"
          onAction={() => setIsModalOpen(true)}
        />
      ) : viewMode === 'matrix' ? (
        /* MATRIX CARD VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '16px',
        }}>
          {filteredProjects.map((p) => {
            const ms = getMilestone(p.progress || 0);
            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'border-color 0.15s ease, transform 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'none';
                }}
                onClick={() => openViewModal(p)}
              >
                {/* Header row: Category & Priority */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                    background: 'rgba(37, 99, 235, 0.08)',
                    padding: '3.5px 10px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                  }}>
                    {p.project_type || 'Issue'}
                  </span>
                  <StatusBadge status={p.priority || 'medium'} />
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  lineHeight: 1.35,
                }}>
                  {p.title}
                </h3>

                {/* Description snippet */}
                {p.description && (
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                    maxHeight: '48px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {p.description}
                  </p>
                )}

                {/* Breadcrumb Navigation Indicator */}
                <div style={{ margin: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: ms.color }}>Step {ms.step} › {ms.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{p.progress || 0}%</span>
                  </div>
                  <div className={styles.microProgressLine}>
                    <div
                      className={styles.microProgressFill}
                      style={{ width: `${p.progress || 0}%`, backgroundColor: ms.color }}
                    />
                  </div>
                </div>

                {/* Footer: PIC & Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--color-border-subtle)',
                  fontSize: '11.5px',
                  marginTop: 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-text-secondary)' }}>
                    <User size={12} style={{ opacity: 0.7 }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {p.owner_name ? p.owner_name.split(' ')[0] : 'Unassigned'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    {ms.step > 1 && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStage(p, -1)}
                        title="Kembali ke stage sebelumnya"
                        style={{
                          background: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '9999px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <ArrowLeft size={11} />
                      </button>
                    )}
                    {ms.step < 5 && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStage(p, 1)}
                        title="Majukan ke milestone berikutnya"
                        style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          border: '1px solid var(--color-accent)',
                          borderRadius: '9999px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          color: 'var(--color-accent)',
                          fontWeight: 700,
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>Next Step</span>
                        <ArrowRight size={11} />
                      </button>
                    )}
                    <Button
                      variant="outline"
                      size="xs"
                      icon={Eye}
                      onClick={(e) => {
                        e.stopPropagation();
                        openViewModal(p);
                      }}
                    >
                      Lihat
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      icon={Edit2}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(p);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      icon={Mail}
                      loading={sendingEmailId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendEmail(p);
                      }}
                      title="Kirim Notifikasi Milestone via Email"
                    >
                      Email
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW (5 MILESTONE COLUMNS) */
        <div style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '16px',
          alignItems: 'flex-start',
        }}>
          {MILESTONE_STAGES.map((st) => {
            const colTasks = kanbanColumns[st.step] || [];
            return (
              <div
                key={st.id}
                style={{
                  flex: '0 0 310px',
                  width: '310px',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 220px)',
                  minHeight: '480px',
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-primary)',
                  borderTopLeftRadius: 'inherit',
                  borderTopRightRadius: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: st.color }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {st.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Task Cards */}
                <div style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto',
                  flex: 1,
                }}>
                  {colTasks.length === 0 ? (
                    <div style={{
                      padding: '30px 10px',
                      textAlign: 'center',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontStyle: 'italic',
                    }}>
                      Tidak ada issue di tahap ini
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => openViewModal(task)}
                        style={{
                          background: 'var(--color-bg-primary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: 'var(--color-accent)',
                          }}>
                            {task.project_type}
                          </span>
                          <StatusBadge status={task.priority} />
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {task.title}
                        </div>

                        {task.description && (
                          <p style={{
                            fontSize: '11.5px',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                            maxHeight: '36px',
                            overflow: 'hidden',
                          }}>
                            {task.description}
                          </p>
                        )}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--color-border-subtle)',
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                        }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} style={{ opacity: 0.7 }} />
                            <span>{task.owner_name ? task.owner_name.split(' ')[0] : 'Unassigned'}</span>
                          </span>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openViewModal(task)}
                              title="Lihat Detail & Timeline"
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                padding: '4px 7px',
                                cursor: 'pointer',
                                color: 'var(--color-text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Eye size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              title="Edit Task"
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                padding: '4px 7px',
                                cursor: 'pointer',
                                color: 'var(--color-text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Edit2 size={11} />
                            </button>
                            {st.step > 1 && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStage(task, -1)}
                                title="Previous Step"
                                style={{
                                  background: 'var(--color-bg-secondary)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '6px',
                                  padding: '4px 7px',
                                  cursor: 'pointer',
                                }}
                              >
                                <ArrowLeft size={10} />
                              </button>
                            )}
                            {st.step < 5 && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStage(task, 1)}
                                title="Advance to next step"
                                style={{
                                  background: 'var(--color-accent)',
                                  border: 'none',
                                  color: '#fff',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                }}
                              >
                                <ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Table columns={columns} data={filteredProjects} />
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Milestone Task / Issue Analisis"
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Judul Issue / Task Analisis</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="misal: Root Cause Analisis Bracket Distortion pada SMT Line 2"
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Kategori Issue</label>
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
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Prioritas</label>
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

            {/* Assign PIC & SMTP Notification */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User size={13} color="var(--color-accent)" />
                  Assign PIC (Engineer)
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="">Pilih PIC Engineer...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email || u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Selesai</label>
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

            {/* Breadcrumb Navigation (Initial Milestone Step) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Milestone Navigation</label>
                <span style={{ fontSize: '12px', fontWeight: 700, color: getMilestone(createProgress).color }}>
                  Step {getMilestone(createProgress).step}: {getMilestone(createProgress).label} ({createProgress}%)
                </span>
              </div>

              {/* ponytail: interactive breadcrumb navigation */}
              <nav className={styles.breadcrumbNav} aria-label="Milestone Navigation">
                {MILESTONE_STAGES.map((st) => {
                  const isCurrent = getMilestone(createProgress).step === st.step;
                  const isCompleted = createProgress >= st.percent;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCreateProgress(st.percent)}
                      className={`${styles.breadcrumbNode} ${isCurrent ? styles.breadcrumbNodeCurrent : ''} ${isCompleted ? styles.breadcrumbNodeCompleted : ''}`}
                      title={st.desc}
                    >
                      <span className={styles.breadcrumbNum}>{st.step}</span>
                      <span className={styles.breadcrumbLabel}>{st.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Description / FormattingTextarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Deskripsi / Catatan Investigasi Awal</label>
              <FormattingTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan temuan gejala issue, parameter mesin, lokasi line produksi..."
                minHeight="110px"
              />
            </div>

            {/* Lampiran / Dokumen Investigasi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Paperclip size={13} color="var(--color-accent)" />
                  Lampiran Berkas / Dokumen Investigasi
                </label>
                <input
                  type="file"
                  ref={createFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleCreateAttachmentUpload}
                  multiple
                />
                <button
                  type="button"
                  className={styles.attachBtnQuick}
                  onClick={() => createFileInputRef.current?.click()}
                  disabled={uploadingCreateAttachment}
                >
                  {uploadingCreateAttachment ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload size={12} />
                  )}
                  <span>{uploadingCreateAttachment ? 'Mengunggah...' : 'Pilih File'}</span>
                </button>
              </div>
              {createAttachments.length > 0 && (
                <AttachmentViewer
                  attachments={createAttachments}
                  readonly={false}
                  onRemove={(idx) => setCreateAttachments((prev) => prev.filter((_, i) => i !== idx))}
                />
              )}
            </div>

            {/* SMTP Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
            }}>
              <input
                type="checkbox"
                id="sendEmailCheckbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="sendEmailCheckbox" style={{ fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                <strong>Kirim notifikasi email via SMTP ke PIC</strong> yang ditugaskan saat task dibuat
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                {t('common.cancel', 'Batal')}
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? t('common.saving', 'Menyimpan...') : t('projects.create_assign_task', 'Create & Assign Task')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL WITH BREADCRUMB STEPPER */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingProject(null);
          }}
          title={`Edit Milestone: ${editingProject?.title || ''}`}
        >
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Judul Task / Issue</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Kategori Issue</label>
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
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Prioritas</label>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Assigned PIC</label>
                <select
                  value={editOwnerId}
                  onChange={(e) => setEditOwnerId(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="">Pilih PIC Engineer...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email || u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Date</label>
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

            {/* Interactive Breadcrumb Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Milestone Navigation</label>
                <span style={{ fontSize: '12px', fontWeight: 700, color: getMilestone(editProgress).color }}>
                  Step {getMilestone(editProgress).step}: {getMilestone(editProgress).label} ({editProgress}%)
                </span>
              </div>

              {/* ponytail: interactive breadcrumb navigation */}
              <nav className={styles.breadcrumbNav} aria-label="Milestone Navigation">
                {MILESTONE_STAGES.map((st) => {
                  const isCurrent = getMilestone(editProgress).step === st.step;
                  const isCompleted = editProgress >= st.percent;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditProgress(st.percent)}
                      className={`${styles.breadcrumbNode} ${isCurrent ? styles.breadcrumbNodeCurrent : ''} ${isCompleted ? styles.breadcrumbNodeCompleted : ''}`}
                      title={st.desc}
                    >
                      <span className={styles.breadcrumbNum}>{st.step}</span>
                      <span className={styles.breadcrumbLabel}>{st.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Catatan Analisis / Investigasi</label>
              <FormattingTextarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Catat parameter, data investigasi, dan countermeasure..."
                minHeight="120px"
              />
            </div>

            {/* Lampiran / Dokumen Investigasi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Paperclip size={13} color="var(--color-accent)" />
                  Lampiran Berkas / Dokumen Investigasi ({editAttachments.length})
                </label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleEditAttachmentUpload}
                  multiple
                />
                <button
                  type="button"
                  className={styles.attachBtnQuick}
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={uploadingEditAttachment}
                >
                  {uploadingEditAttachment ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload size={12} />
                  )}
                  <span>{uploadingEditAttachment ? 'Mengunggah...' : 'Tambah File'}</span>
                </button>
              </div>
              {editAttachments.length > 0 && (
                <AttachmentViewer
                  attachments={editAttachments}
                  readonly={false}
                  onRemove={(idx) => setEditAttachments((prev) => prev.filter((_, i) => i !== idx))}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProject(null);
                }}
                type="button"
              >
                {t('common.cancel', 'Batal')}
              </Button>
              <Button variant="primary" type="submit">
                {t('common.save', 'Simpan Perubahan')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* VIEW DETAIL & TIMELINE MODAL */}
      {isViewModalOpen && viewingProject && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingProject(null);
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <FolderKanban size={17} color="var(--color-accent)" />
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Detail Milestone Task Analyst</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginRight: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Mail}
                  loading={sendingEmailId === viewingProject.id}
                  onClick={() => handleSendEmail(viewingProject)}
                  title="Kirim Ringkasan Milestone Task via Email"
                >
                  Kirim Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Edit2}
                  onClick={() => {
                    setIsViewModalOpen(false);
                    openEditModal(viewingProject);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          }
          size="lg"
        >
          <div className={styles.viewModalRoot}>
            {/* Hero Card with Title, Badges & Metadata */}
            <div className={styles.viewHeroCard}>
              <div className={styles.viewHeroTop}>
                <div className={styles.viewBadgesGroup}>
                  <span className={styles.categoryTag}>
                    <Tag size={11} /> {viewingProject.project_type || 'General'}
                  </span>
                  <StatusBadge status={viewingProject.priority} />
                  <StatusBadge status={viewingProject.status} />
                </div>
                <div className={styles.viewMilestoneBadge}>
                  {getMilestone(viewingProject.progress).label} ({viewingProject.progress || 0}%)
                </div>
              </div>

              <h2 className={styles.viewHeroTitle}>
                {viewingProject.title}
              </h2>

              <div className={styles.viewMetaGrid}>
                <div className={styles.viewMetaItem}>
                  <div className={styles.viewMetaIconBox}>
                    <User size={15} />
                  </div>
                  <div className={styles.viewMetaText}>
                    <span className={styles.viewMetaLabel}>Person In Charge (PIC)</span>
                    <span className={styles.viewMetaValue}>{viewingProject.owner_name || 'Unassigned'}</span>
                  </div>
                </div>

                <div className={styles.viewMetaItem}>
                  <div className={styles.viewMetaIconBox}>
                    <Calendar size={15} />
                  </div>
                  <div className={styles.viewMetaText}>
                    <span className={styles.viewMetaLabel}>Target Selesai</span>
                    <span className={styles.viewMetaValue}>
                      {viewingProject.target_date
                        ? new Date(viewingProject.target_date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Tidak ada target'}
                    </span>
                  </div>
                </div>

                <div className={styles.viewMetaItem}>
                  <div className={styles.viewMetaIconBox}>
                    <Clock size={15} />
                  </div>
                  <div className={styles.viewMetaText}>
                    <span className={styles.viewMetaLabel}>Tanggal Dibuat</span>
                    <span className={styles.viewMetaValue}>
                      {viewingProject.created_at
                        ? new Date(viewingProject.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Breadcrumb Navigation Card */}
            <div className={styles.viewStepperCard}>
              <div className={styles.viewStepperHeader}>
                <span className={styles.viewStepperTitle}>
                  Milestone Breadcrumb Navigation (5-Tahap)
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Tahap {getMilestone(viewingProject.progress).step} dari 5
                </span>
              </div>
              {/* ponytail: breadcrumb navigation view */}
              <nav className={styles.breadcrumbNav} aria-label="Milestone Breadcrumb Trail">
                {MILESTONE_STAGES.map((st) => {
                  const isCurrent = getMilestone(viewingProject.progress).step === st.step;
                  const isCompleted = (viewingProject.progress || 0) >= st.percent;
                  return (
                    <div
                      key={st.id}
                      className={`${styles.breadcrumbNode} ${styles.breadcrumbNodeStatic} ${isCurrent ? styles.breadcrumbNodeCurrent : ''} ${isCompleted ? styles.breadcrumbNodeCompleted : ''}`}
                      title={st.desc}
                    >
                      <span className={styles.breadcrumbNum}>
                        {isCompleted && !isCurrent ? <Check size={10} strokeWidth={3} /> : st.step}
                      </span>
                      <span className={styles.breadcrumbLabel}>{st.label}</span>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Catatan Analisis / Investigasi Card */}
            <div className={styles.viewNotesCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={styles.viewNotesHeader}>
                  <FileText size={14} color="var(--color-accent)" />
                  <span>Catatan Analisis / Investigasi Teknis</span>
                </div>
                <div>
                  <input
                    type="file"
                    ref={detailFileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleDetailAttachmentUpload}
                    multiple
                  />
                  <button
                    type="button"
                    className={styles.attachBtnQuick}
                    onClick={() => detailFileInputRef.current?.click()}
                    disabled={uploadingDetailAttachment}
                    title="Tambah lampiran bukti foto atau file dokumen ke task ini"
                  >
                    {uploadingDetailAttachment ? (
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Paperclip size={12} />
                    )}
                    <span>{uploadingDetailAttachment ? 'Mengunggah...' : 'Tambah Lampiran'}</span>
                  </button>
                </div>
              </div>
              <div className={styles.viewNotesBody}>
                {viewingProject.description ? (
                  viewingProject.description
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Belum ada catatan investigasi atau countermeasure yang dicatat untuk task ini.
                  </span>
                )}

                {/* Task Body Attachments */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Lampiran Bukti & Dokumen Investigasi ({(Array.isArray(viewingProject.attachments) ? viewingProject.attachments.length : 0)})
                    </span>
                  </div>
                  {viewingProject.attachments && (Array.isArray(viewingProject.attachments) ? viewingProject.attachments.length > 0 : viewingProject.attachments !== '[]') ? (
                    <AttachmentViewer attachments={viewingProject.attachments} readonly={true} />
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Belum ada file lampiran pada task ini. Klik tombol "Tambah Lampiran" di atas untuk melampirkan screenshot, dokumen, atau log.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Comment & Timeline Section */}
            <CommentTimelineSection
              entityType="project"
              entityId={viewingProject.id}
              entityTitle={viewingProject.title}
              refreshKey={timelineRefreshKey}
            />

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Button
                variant="outline"
                size="sm"
                icon={Edit2}
                onClick={() => {
                  const p = viewingProject;
                  setIsViewModalOpen(false);
                  openEditModal(p);
                }}
              >
                Edit Task
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingProject(null);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
