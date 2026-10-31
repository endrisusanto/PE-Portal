import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  ChevronDown,
  ChevronUp,
  User,
  Users,
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
  Lock,
  Shield,
  Globe,
  UserCheck,
  X,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
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
import { portalConfirm, portalAlert } from '../contexts/ConfirmContext';
import { TaskAnalystTechnicalReportCard } from '../components/common/TaskAnalystTechnicalReportCard';
import { PipelineTunnelCard } from '../components/common/PipelineTunnelCard';
import i18n from '../utils/i18n';
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
  let m = MILESTONE_STAGES[0];
  if (progress >= 100) m = MILESTONE_STAGES[4];
  else if (progress >= 75) m = MILESTONE_STAGES[3];
  else if (progress >= 50) m = MILESTONE_STAGES[2];
  else if (progress >= 25) m = MILESTONE_STAGES[1];
  return {
    ...m,
    label: i18n?.t ? i18n.t(`projects.milestones.${m.id}`, m.label) : m.label,
    desc: i18n?.t ? i18n.t(`projects.milestones.${m.id}_desc`, m.desc) : m.desc,
  };
};

// ponytail: Expanded Task & Issue Types including feature requests to admin & general tasks
export const ISSUE_TYPES = [
  { value: 'mechanical', label: 'Mechanical Issue Analysis' },
  { value: 'process', label: 'Production Process Optimization' },
  { value: 'yield', label: 'Line Yield & Defect Loss' },
  { value: 'tooling', label: 'Tooling, Fixture & JIGs' },
  { value: 'development', label: 'New Model Trial Development' },
  { value: 'feature_request', label: 'Feature Request & Proposal' },
  { value: 'improvement', label: 'Process Improvement & Kaizen' },
  { value: 'bug_fix', label: 'Bug & System Fix' },
  { value: 'general', label: 'General Task / ToDo' },
];

// ponytail: Safely parse JSONB metadata from project record
export const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const { user, requireAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // Default: 'kanban' | 'matrix' | 'table'
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'my_tasks'
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // ponytail: Auto-open edit modal if routed from calendar
  useEffect(() => {
    if (location.state?.editProjectId && projects.length > 0) {
      const target = projects.find((p) => p.id === location.state.editProjectId);
      if (target) {
        openEditModal(target);
      }
    }
  }, [projects, location.state]);

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
  const [selectedPics, setSelectedPics] = useState([]); // Multiple PIC assignment
  const [customEmailInput, setCustomEmailInput] = useState(''); // Comma-separated or single custom target PIC email
  const [visibility, setVisibility] = useState('public'); // 'public' | 'private_pic' | 'manager'
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
  const [editSelectedPics, setEditSelectedPics] = useState([]);
  const [editCustomEmailInput, setEditCustomEmailInput] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [editProgress, setEditProgress] = useState(20);
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAttachments, setEditAttachments] = useState([]);
  const [uploadingEditAttachment, setUploadingEditAttachment] = useState(false);
  const editFileInputRef = useRef(null);

  // Technical Report State for Edit Modal
  const [editTechReportDrafter, setEditTechReportDrafter] = useState('');
  const [editTechReportPartLeader, setEditTechReportPartLeader] = useState('');
  const [editTechReportGroupLeader, setEditTechReportGroupLeader] = useState('hendra.n@samsung.com');
  const [editTechReportModel, setEditTechReportModel] = useState('');
  const [editTechReportDefectDate, setEditTechReportDefectDate] = useState('');
  const [editTechReportProblem, setEditTechReportProblem] = useState('');
  const [editTechReportDefectLocation, setEditTechReportDefectLocation] = useState('');
  const [editTechReportCN, setEditTechReportCN] = useState('');
  const [editTechReportDefectQty, setEditTechReportDefectQty] = useState('');
  const [editTechReportSymptoms, setEditTechReportSymptoms] = useState('');
  const [editTechReportCountermeasure, setEditTechReportCountermeasure] = useState('');
  const [isTechReportExpanded, setIsTechReportExpanded] = useState(true);

  // ponytail: Auto-fetch Part Leader manager purely from active users with role manager (excluding admin)
  const getSuggestedPartLeader = useCallback((targetUser) => {
    if (!targetUser) return '';
    const parent = targetUser.parent_group
      || groups.find((g) => g.id === targetUser.group_part_id)?.parent_group
      || groups.find((g) => g.name === targetUser.group_part_name)?.parent_group;
    if (parent) {
      const mgr = users.find((u) =>
        u.role === 'manager' &&
        (u.parent_group === parent || groups.find((g) => g.id === u.group_part_id)?.parent_group === parent)
      );
      if (mgr) return mgr.full_name;
    }
    return '';
  }, [groups, users]);

  // ponytail: Dropdown options for Part Leader sourced purely from role manager only (admin excluded)
  const partLeaderOptions = useMemo(() => {
    const list = [];
    users
      .filter((u) => u.role === 'manager')
      .forEach((u) => {
        if (!list.some((item) => item.value === u.full_name)) {
          const groupObj = groups.find((g) => g.id === u.group_part_id);
          const parentGroup = u.parent_group || groupObj?.parent_group;
          const groupName = u.group_part_name || groupObj?.name;
          const groupLabel = parentGroup
            ? ` (${parentGroup.replace('pe_', 'PE ').toUpperCase()}${groupName ? ` - ${groupName}` : ''})`
            : (groupName ? ` (${groupName})` : ' (Manager)');
          list.push({
            value: u.full_name,
            label: `${u.full_name}${groupLabel}`,
          });
        }
      });
    return list;
  }, [users, groups]);

  // ponytail: Dropdown options for Group Leader defaulting to hendra.n@samsung.com with active management users
  const groupLeaderOptions = useMemo(() => {
    const list = [
      { value: 'hendra.n@samsung.com', label: 'hendra.n@samsung.com (PE Group Leader)' },
    ];
    users
      .filter((u) => u.parent_group === 'pe_management' || u.role === 'admin' || u.role === 'manager')
      .forEach((u) => {
        if (!list.some((item) => item.value === u.full_name || item.value === u.email)) {
          list.push({
            value: u.full_name,
            label: `${u.full_name} (${u.email || u.role})`,
          });
        }
      });
    return list;
  }, [users]);

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
      const [projRes, userRes, groupRes] = await Promise.all([
        api.get('/projects'),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/groups').catch(() => ({ data: [] })),
      ]);
      setProjects(projRes.data || []);
      setUsers(userRes.data || []);
      setGroups(groupRes.data || []);
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

  // ponytail: parse comma-separated emails or single input, auto-match registered user or add as external chip
  const handleAddCustomPicEmails = (inputText, isEdit = false) => {
    if (!inputText || !inputText.trim()) return;
    const rawList = inputText.split(/[,;\n]+/).map((s) => s.trim().replace(/^mailto:/i, '')).filter(Boolean);
    if (rawList.length === 0) return;

    if (isEdit) {
      setEditSelectedPics((prev) => {
        const next = [...prev];
        rawList.forEach((item) => {
          const lower = item.toLowerCase();
          if (next.some((p) => (p.email && p.email.toLowerCase() === lower) || p.id === lower || p.id === `ext_${lower}`)) {
            return;
          }
          const registered = users.find((u) => (u.email && u.email.toLowerCase() === lower) || u.username?.toLowerCase() === lower);
          if (registered) {
            if (!next.some((p) => p.id === registered.id)) {
              next.push(registered);
              if (!editOwnerId) setEditOwnerId(registered.id);
            }
          } else {
            next.push({
              id: `ext_${lower}`,
              name: item,
              full_name: item,
              email: item,
              role: 'external',
              is_external: true,
            });
          }
        });
        return next;
      });
      setEditCustomEmailInput('');
    } else {
      setSelectedPics((prev) => {
        const next = [...prev];
        rawList.forEach((item) => {
          const lower = item.toLowerCase();
          if (next.some((p) => (p.email && p.email.toLowerCase() === lower) || p.id === lower || p.id === `ext_${lower}`)) {
            return;
          }
          const registered = users.find((u) => (u.email && u.email.toLowerCase() === lower) || u.username?.toLowerCase() === lower);
          if (registered) {
            if (!next.some((p) => p.id === registered.id)) {
              next.push(registered);
              if (!ownerId) setOwnerId(registered.id);
            }
          } else {
            next.push({
              id: `ext_${lower}`,
              name: item,
              full_name: item,
              email: item,
              role: 'external',
              is_external: true,
            });
          }
        });
        return next;
      });
      setCustomEmailInput('');
    }
  };

  // Create Project / ToDo Task
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      // Determine primary PIC and full PIC list
      const registeredPrimary = selectedPics.find((p) => !p.is_external && !String(p.id).startsWith('ext_'));
      const primaryPic = registeredPrimary || (ownerId ? users.find((u) => u.id === ownerId) : null);
      const picList = selectedPics.length > 0 ? selectedPics : (primaryPic ? [primaryPic] : []);

      const metadataPayload = {
        visibility,
        created_by_id: user?.id || undefined,
        created_by_name: user?.full_name || user?.username || 'Team Member',
        assigned_pics: picList.map((u) => ({
          id: u.id,
          name: u.full_name || u.name || u.email,
          email: u.email || '',
          role: u.role || (u.is_external ? 'external' : 'engineer'),
          is_external: !!u.is_external || String(u.id).startsWith('ext_'),
        })),
        assigned_pic_ids: picList.filter((u) => !u.is_external && u.id && !String(u.id).startsWith('ext_')).map((u) => u.id),
      };

      const payload = {
        title: title.trim(),
        project_type: projectType,
        priority,
        owner_id: primaryPic?.id || user?.id || undefined,
        progress: createProgress,
        status: createProgress >= 100 ? 'completed' : createProgress > 20 ? 'in_progress' : 'planning',
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
        description: description || undefined,
        attachments: createAttachments,
        metadata: metadataPayload,
        send_email: sendEmail,
      };

      const res = await api.post('/projects', payload);
      const newProject = { ...res.data, metadata: metadataPayload };
      setProjects((prev) => [newProject, ...prev]);
      setIsModalOpen(false);

      // Reset form
      setTitle('');
      setProjectType('mechanical');
      setPriority('medium');
      setOwnerId('');
      setSelectedPics([]);
      setCustomEmailInput('');
      setVisibility('public');
      setCreateProgress(20);
      setSendEmail(true);
      setDescription('');
      setTargetDate('');
      setCreateAttachments([]);

      const picNames = picList.map((p) => p.full_name || p.name || p.email).join(', ') || 'Unassigned';
      if (sendEmail && picList.some((p) => p.email)) {
        showToast(`Task berhasil dibuat & notifikasi email dikirim ke ${picList.length} PIC!`);
      } else {
        showToast('ToDo Task berhasil ditambahkan!');
      }

      // Record timeline change log
      await logTimelineEvent(
        'project',
        res.data.id,
        `ToDo Task dibuat dengan prioritas ${priority.toUpperCase()}, kategori ${projectType}, visibilitas ${visibility}, dan PIC: ${picNames}`
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Authorization check for project deletion (author or admin/manager)
  const canDeleteProject = (p) => {
    if (!p || !user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    if (p.owner_id === user.id) return true;
    const meta = parseMetadata(p.metadata);
    if (meta.created_by_id === user.id) return true;
    return false;
  };

  const handleDeleteProject = async (p, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!requireAuth('Hapus Task')) return;
    if (!p || !p.id) return;
    const ok = await portalConfirm({
      title: 'Hapus Project / Task',
      message: `Hapus project / task "${p.title}"? Tindakan ini tidak dapat dibatalkan dan seluruh riwayat task akan dihapus.`,
      confirmText: 'Hapus Task',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${p.id}`);
      setProjects((prev) => prev.filter((item) => item.id !== p.id));
      if (editingProject && editingProject.id === p.id) {
        setIsEditModalOpen(false);
        setEditingProject(null);
      }
      if (viewingProject && viewingProject.id === p.id) {
        setIsViewModalOpen(false);
        setViewingProject(null);
      }
    } catch (err) {
      portalAlert(err.response?.data?.message || err.message || 'Gagal menghapus project');
    }
  };

  // Open Edit Modal
  const openEditModal = (p) => {
    if (!requireAuth('Edit Task')) return;
    setEditingProject(p);
    setEditTitle(p.title || '');
    setEditProjectType(p.project_type || 'mechanical');
    setEditStatus(p.status || (p.progress >= 25 ? 'in_progress' : 'planning'));
    setEditPriority(p.priority || 'medium');
    setEditOwnerId(p.owner_id || '');
    setEditProgress(p.progress || 0);
    setEditStartDate(p.start_date ? p.start_date.substring(0, 10) : '');
    setEditTargetDate(p.target_date ? p.target_date.substring(0, 10) : '');
    setEditDescription(p.description || '');

    const meta = parseMetadata(p.metadata);
    setEditVisibility(meta.visibility || 'public');

    let initialPics = [];
    if (meta.assigned_pics && Array.isArray(meta.assigned_pics) && meta.assigned_pics.length > 0) {
      initialPics = meta.assigned_pics.map((pic) => {
        const isExt = pic.is_external || String(pic.id).startsWith('ext_') || !pic.id;
        if (isExt) {
          return {
            id: pic.id || `ext_${(pic.email || pic.name).toLowerCase()}`,
            full_name: pic.full_name || pic.name || pic.email,
            name: pic.name || pic.full_name || pic.email,
            email: pic.email || '',
            role: pic.role || 'external',
            is_external: true,
          };
        }
        const fullUser = users.find((u) => u.id === pic.id);
        return fullUser || { id: pic.id, full_name: pic.name || pic.full_name, email: pic.email, role: pic.role };
      });
    } else if (p.owner_id) {
      const u = users.find((usr) => usr.id === p.owner_id);
      if (u) initialPics = [u];
      else if (p.owner_name) initialPics = [{ id: p.owner_id, full_name: p.owner_name, email: '' }];
    }
    setEditSelectedPics(initialPics);
    setEditCustomEmailInput('');

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

    const techReport = meta.technical_report || {};
    setEditTechReportDrafter(techReport.drafter || p.owner_name || user?.full_name || '');

    // ponytail: Auto-fetch Part Leader & Group Leader from team structure if not already explicitly saved
    const drafterUser = users.find((u) => u.id === p.owner_id)
      || users.find((u) => u.full_name === (techReport.drafter || p.owner_name))
      || (initialPics.length > 0 ? initialPics[0] : null)
      || users.find((u) => u.full_name === user?.full_name)
      || user;
    const autoPartLeader = getSuggestedPartLeader(drafterUser);

    setEditTechReportPartLeader(techReport.part_leader || autoPartLeader);
    setEditTechReportGroupLeader(techReport.group_leader || 'hendra.n@samsung.com');
    setEditTechReportModel(techReport.model || p.model_id || '');
    setEditTechReportDefectDate(techReport.defect_date || (p.start_date ? p.start_date.substring(0, 10) : ''));
    setEditTechReportProblem(techReport.problem || p.title || '');
    setEditTechReportDefectLocation(techReport.defect_location || '');
    setEditTechReportCN(techReport.cn || '');
    setEditTechReportDefectQty(techReport.defect_qty || '');
    setEditTechReportSymptoms(techReport.symptoms_analysis || techReport.symptoms || '');
    setEditTechReportCountermeasure(techReport.conclusion_countermeasure || techReport.countermeasure || '');
    setIsTechReportExpanded(true);

    setIsEditModalOpen(true);
  };

  // Update Project / ToDo Task
  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!editingProject) return;

    try {
      const registeredPrimary = editSelectedPics.find((p) => !p.is_external && !String(p.id).startsWith('ext_'));
      const primaryPic = registeredPrimary || (editOwnerId ? users.find((u) => u.id === editOwnerId) : null);
      const picList = editSelectedPics.length > 0 ? editSelectedPics : (primaryPic ? [primaryPic] : []);
      const existingMeta = parseMetadata(editingProject.metadata);

      const metadataPayload = {
        ...existingMeta,
        visibility: editVisibility,
        assigned_pics: picList.map((u) => ({
          id: u.id,
          name: u.full_name || u.name || u.email,
          email: u.email || '',
          role: u.role || (u.is_external ? 'external' : 'engineer'),
          is_external: !!u.is_external || String(u.id).startsWith('ext_'),
        })),
        assigned_pic_ids: picList.filter((u) => !u.is_external && u.id && !String(u.id).startsWith('ext_')).map((u) => u.id),
        technical_report: {
          drafter: editTechReportDrafter || undefined,
          part_leader: editTechReportPartLeader || undefined,
          group_leader: editTechReportGroupLeader || undefined,
          model: editTechReportModel || undefined,
          defect_date: editTechReportDefectDate || undefined,
          problem: editTechReportProblem || undefined,
          defect_location: editTechReportDefectLocation || undefined,
          cn: editTechReportCN || undefined,
          defect_qty: editTechReportDefectQty || undefined,
          symptoms_analysis: editTechReportSymptoms || undefined,
          conclusion_countermeasure: editTechReportCountermeasure || undefined,
        },
      };

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
        project_type: editProjectType,
        status: derivedStatus,
        priority: editPriority,
        owner_id: primaryPic?.id || user?.id || undefined,
        progress: Number(editProgress) || 0,
        start_date: editStartDate || undefined,
        target_date: editTargetDate || undefined,
        description: editDescription || undefined,
        attachments: editAttachments,
        metadata: metadataPayload,
      };

      const res = await api.put(`/projects/${editingProject.id}`, payload);
      const updated = { ...editingProject, ...res.data, metadata: metadataPayload };
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
      if (editProjectType !== editingProject.project_type) changes.push(`Kategori diubah ke ${editProjectType}`);
      if (editVisibility !== (existingMeta.visibility || 'public')) changes.push(`Visibilitas diubah ke ${editVisibility}`);
      const newPicNames = picList.map((p) => p.full_name || p.name || p.email).join(', ');
      changes.push(`PIC diatur: ${newPicNames || 'Unassigned'}`);
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
      if (location.state?.returnTo) {
        navigate(location.state.returnTo);
      }
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
    const newStatus =
      newProgress >= 100
        ? 'completed'
        : newProgress >= 75
        ? 'review'
        : newProgress >= 25
        ? 'in_progress'
        : 'planning';

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

  // ponytail: handle instant email notification dispatch and preview for milestone updates
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null); // { project, html, subject }
  const [loadingPreviewId, setLoadingPreviewId] = useState(null);

  const handlePreviewEmail = async (proj) => {
    if (!proj) return;
    setLoadingPreviewId(proj.id);
    try {
      const res = await api.get(`/projects/${proj.id}/preview-email?format=json`);
      setPreviewEmail({
        project: proj,
        html: res.data.html,
        subject: res.data.subject,
      });
    } catch (err) {
      alert('Gagal memuat pratinjau email: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleSendEmail = async (proj) => {
    if (!proj) return;
    const confirmSend = await portalConfirm({
      title: 'Kirim Email Notifikasi Milestone',
      message: `Kirim notifikasi email ringkasan milestone untuk task "${proj.title}" ke seluruh PIC dan tim terkait?`,
      confirmText: 'Kirim Email',
      variant: 'info',
    });
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
      portalAlert('Gagal mengirim email: ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingEmailId(null);
    }
  };

  // ponytail: Helper to render multi-PIC badges or single PIC
  const renderPicBadges = (p) => {
    const meta = parseMetadata(p.metadata);
    const picList = (meta.assigned_pics && Array.isArray(meta.assigned_pics) && meta.assigned_pics.length > 0)
      ? meta.assigned_pics
      : (p.owner_name ? [{ name: p.owner_name }] : []);

    if (picList.length === 0) {
      return (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <User size={12} style={{ opacity: 0.6 }} />
          <span>Unassigned</span>
        </span>
      );
    }

    const first = picList[0];
    const rawName = first.name || first.full_name || first.email || 'PIC';
    const firstName = rawName.includes('@') ? rawName.split('@')[0] : rawName.split(' ')[0];
    const more = picList.length - 1;
    const allNames = picList.map((x) => x.name || x.full_name || x.email).join(', ');

    return (
      <span
        title={allNames}
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <User size={13} style={{ opacity: 0.7 }} />
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{firstName}</span>
        {more > 0 && (
          <span style={{
            fontSize: '10.5px',
            padding: '1px 6px',
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--color-accent)',
            borderRadius: '9999px',
            fontWeight: 700,
          }}>
            +{more}
          </span>
        )}
      </span>
    );
  };

  // ponytail: Filtered Projects with Role-based Visibility & Scope Switcher
  const { visibleProjects, totalVisibleCount, myTasksCount } = useMemo(() => {
    // 1. Role-based Visibility Filter
    const accessible = projects.filter((p) => {
      if (user?.role === 'admin') return true; // Admin can view all

      const meta = parseMetadata(p.metadata);
      const vis = meta.visibility || 'public';
      const isCreator = Boolean(meta.created_by_id && user?.id && meta.created_by_id === user.id);
      const isAssigned = Boolean(
        (p.owner_id && user?.id && p.owner_id === user.id) ||
        (meta.assigned_pic_ids && Array.isArray(meta.assigned_pic_ids) && user?.id && meta.assigned_pic_ids.includes(user.id)) ||
        (p.owner_name && user?.full_name && p.owner_name.toLowerCase() === user.full_name.toLowerCase())
      );

      if (vis === 'public') return true;
      if (vis === 'private_pic') return isAssigned || isCreator;
      if (vis === 'manager') return user?.role === 'manager' || isAssigned || isCreator;
      return true;
    });

    // 2. Count "My Tasks"
    let myCount = 0;
    accessible.forEach((p) => {
      const meta = parseMetadata(p.metadata);
      const isCreator = Boolean(meta.created_by_id && user?.id && meta.created_by_id === user.id);
      const isAssigned = Boolean(
        (p.owner_id && user?.id && p.owner_id === user.id) ||
        (meta.assigned_pic_ids && Array.isArray(meta.assigned_pic_ids) && user?.id && meta.assigned_pic_ids.includes(user.id)) ||
        (p.owner_name && user?.full_name && p.owner_name.toLowerCase() === user.full_name.toLowerCase())
      );
      if (isAssigned || isCreator) {
        myCount++;
      }
    });

    return {
      visibleProjects: accessible,
      totalVisibleCount: accessible.length,
      myTasksCount: myCount,
    };
  }, [projects, user]);

  const filteredProjects = useMemo(() => {
    return visibleProjects.filter((p) => {
      // Scope filter: 'all' vs 'my_tasks'
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

      if (selectedType && p.project_type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const meta = parseMetadata(p.metadata);
        const mTitle = (p.title || '').toLowerCase().includes(q);
        const mDesc = (p.description || '').toLowerCase().includes(q);
        const mOwner = (p.owner_name || '').toLowerCase().includes(q);
        const mType = (p.project_type || '').toLowerCase().includes(q);
        const mPics = (meta.assigned_pics || []).some((pic) =>
          (pic.name || pic.full_name || '').toLowerCase().includes(q)
        );
        if (!mTitle && !mDesc && !mOwner && !mType && !mPics) return false;
      }
      return true;
    });
  }, [visibleProjects, scopeFilter, search, selectedType, user]);

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
      title: t('projects.col_task', 'Issue / Task / Permintaan'),
      key: 'title',
      render: (val, row) => {
        const ms = getMilestone(row.progress || 0);
        const meta = parseMetadata(row.metadata);
        const vis = meta.visibility || 'public';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{val}</span>
              {vis === 'private_pic' && (
                <span className={`${styles.visibilityPill} ${styles.visibilityPrivate}`} title="Hanya terlihat oleh PIC & Pembuat">
                  <Lock size={10} /> Privat
                </span>
              )}
              {vis === 'manager' && (
                <span className={`${styles.visibilityPill} ${styles.visibilityManager}`} title="Terlihat oleh Manager, PIC & Pembuat">
                  <Shield size={10} /> Manager
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <span style={{
                textTransform: 'capitalize',
                color: row.project_type === 'feature_request' ? '#a855f7' : 'var(--color-accent)',
                fontWeight: 600,
              }}>
                {row.project_type?.replace('_', ' ')}
              </span>
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
      render: (_, row) => renderPicBadges(row),
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
            icon={Eye}
            loading={loadingPreviewId === row.id}
            onClick={() => handlePreviewEmail(row)}
            title="Preview Email Laporan"
          >
            Preview
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
          {canDeleteProject(row) && (
            <Button
              variant="outline"
              size="xs"
              icon={Trash2}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={(e) => handleDeleteProject(row, e)}
              title={t('common.delete', 'Hapus Project')}
            >
              {t('common.delete', 'Hapus')}
            </Button>
          )}
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
            {t('projects.title', 'ToDo List & Task Analyst')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {t('projects.subtitle', 'Pelacakan Analisis Issue Mechanical, Permintaan Fitur ke Admin, Optimasi Proses & Milestone Stepper')}
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

          <Button variant="primary" icon={Plus} onClick={() => requireAuth('Tambah ToDo / Task') && setIsModalOpen(true)}>
            {t('projects.new_task', 'Tambah ToDo / Task')}
          </Button>
        </div>
      </div>

      {/* Pipeline Tunnel 3D Wireframe Funnel Card */}
      <PipelineTunnelCard
        tasks={visibleProjects}
        stages={MILESTONE_STAGES}
        selectedStage={selectedStageFilter}
        onStageSelect={(step) => {
          setSelectedStageFilter((prev) => (prev === step ? null : step));
        }}
      />

      {/* Search, Filter & Scope Switcher Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ minWidth: '220px', maxWidth: '340px', flex: 1 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task, PIC, deskripsi..."
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
            <option value="">{t('projects.all_categories', 'Semua Kategori / Tipe')}</option>
            {ISSUE_TYPES.map((typeItem) => (
              <option key={typeItem.value} value={typeItem.value}>
                {t(`projects.issue_types.${typeItem.value}`, typeItem.label)}
              </option>
            ))}
          </select>

          {selectedStageFilter && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 11px',
              borderRadius: '9999px',
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
              border: '1px solid var(--color-accent)',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--color-accent)',
            }}>
              <span>
                {t('projects.tunnel_filter_active_stage', 'Stage')}: {MILESTONE_STAGES.find((s) => s.step === selectedStageFilter)?.label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedStageFilter(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-accent)',
                  display: 'inline-flex',
                  padding: 0,
                }}
                title={t('projects.tunnel_clear_stage', 'Reset filter tahap')}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* ponytail: Switch Button filter Semua Task vs Terkait Saya */}
        <div className={styles.scopeSwitcher}>
          <button
            type="button"
            className={`${styles.scopeBtn} ${scopeFilter === 'all' ? styles.scopeBtnActive : ''}`}
            onClick={() => setScopeFilter('all')}
            title="Tampilkan seluruh task yang dapat Anda akses"
          >
            <span>{t('projects.filter_all', 'Semua Task')}</span>
            <span className={styles.scopeBadge}>{totalVisibleCount}</span>
          </button>
          <button
            type="button"
            className={`${styles.scopeBtn} ${scopeFilter === 'my_tasks' ? styles.scopeBtnActive : ''}`}
            onClick={() => setScopeFilter('my_tasks')}
            title="Hanya task yang menugaskan Anda sebagai PIC atau Anda buat"
          >
            <UserCheck size={13} />
            <span>{t('projects.filter_my_tasks', 'Terkait Saya')}</span>
            <span className={styles.scopeBadge}>{myTasksCount}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message={t('projects.loading_milestones', 'Memuat ToDo List & Task Analyst...')} />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={scopeFilter === 'my_tasks' ? "Belum ada Task Terkait Nama Anda" : "Belum ada ToDo / Task"}
          description={scopeFilter === 'my_tasks'
            ? "Tidak ada task yang menugaskan Anda sebagai PIC atau yang Anda buat. Beralih ke 'Semua Task' atau buat task baru."
            : "Catat temuan analisa issue mechanical, proses produksi, atau buat permintaan fitur ke Admin."
          }
          actionLabel="Buat ToDo Pertama"
          onAction={() => requireAuth('Tambah ToDo / Task') && setIsModalOpen(true)}
        />
      ) : viewMode === 'matrix' ? (
        /* MATRIX CARD VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '16px',
        }}>
          {filteredProjects
            .filter((p) => !selectedStageFilter || getMilestone(p.progress || 0).step === selectedStageFilter)
            .map((p) => {
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
                {/* Header row: Category, Visibility & Priority */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: p.project_type === 'feature_request' ? '#a855f7' : 'var(--color-accent)',
                      background: p.project_type === 'feature_request' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                      padding: '3.5px 10px',
                      borderRadius: '9999px',
                      border: p.project_type === 'feature_request' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(37, 99, 235, 0.2)',
                    }}>
                      {t(`projects.issue_types.${p.project_type}`, p.project_type?.replace('_', ' ') || 'Issue')}
                    </span>
                    {parseMetadata(p.metadata).visibility === 'private_pic' && (
                      <span className={`${styles.visibilityPill} ${styles.visibilityPrivate}`} title="Hanya terlihat oleh PIC & Pembuat">
                        <Lock size={10} /> Privat
                      </span>
                    )}
                    {parseMetadata(p.metadata).visibility === 'manager' && (
                      <span className={`${styles.visibilityPill} ${styles.visibilityManager}`} title="Terlihat oleh Manager, PIC & Pembuat">
                        <Shield size={10} /> Manager
                      </span>
                    )}
                  </div>
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
                  {renderPicBadges(p)}

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
                      icon={Eye}
                      loading={loadingPreviewId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewEmail(p);
                      }}
                      title="Preview Email Laporan"
                    >
                      Preview
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
                    {canDeleteProject(p) && (
                      <Button
                        variant="outline"
                        size="xs"
                        icon={Trash2}
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(p, e);
                        }}
                        title={t('common.delete', 'Hapus Project')}
                      >
                        Hapus
                      </Button>
                    )}
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
            const isColumnSelected = selectedStageFilter === st.step;
            return (
              <div
                key={st.id}
                style={{
                  flex: '0 0 310px',
                  width: '310px',
                  background: 'var(--color-bg-secondary)',
                  border: isColumnSelected
                    ? '2px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  boxShadow: isColumnSelected
                    ? '0 0 20px color-mix(in srgb, var(--color-accent) 25%, transparent)'
                    : 'none',
                  transform: isColumnSelected ? 'translateY(-2px)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 220px)',
                  minHeight: '480px',
                  transition: 'all 0.25s ease',
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
                      {t(`projects.milestones.${st.id}`, st.label)}
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
                      {t('projects.no_issues_stage', 'Tidak ada issue di tahap ini')}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: task.project_type === 'feature_request' ? '#a855f7' : 'var(--color-accent)',
                              background: task.project_type === 'feature_request' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                              padding: '2px 7px',
                              borderRadius: '9999px',
                            }}>
                              {t(`projects.issue_types.${task.project_type}`, task.project_type?.replace('_', ' '))}
                            </span>
                            {parseMetadata(task.metadata).visibility === 'private_pic' && (
                              <span className={`${styles.visibilityPill} ${styles.visibilityPrivate}`} title="Hanya terlihat oleh PIC & Pembuat">
                                <Lock size={9} /> Privat
                              </span>
                            )}
                            {parseMetadata(task.metadata).visibility === 'manager' && (
                              <span className={`${styles.visibilityPill} ${styles.visibilityManager}`} title="Terlihat oleh Manager, PIC & Pembuat">
                                <Shield size={9} /> Manager
                              </span>
                            )}
                          </div>
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
                          {renderPicBadges(task)}
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
                            {canDeleteProject(task) && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteProject(task, e)}
                                title="Hapus Task"
                                style={{
                                  background: 'transparent',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '6px',
                                  padding: '4px 7px',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
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
        <Table
          columns={columns}
          data={filteredProjects.filter(
            (p) => !selectedStageFilter || getMilestone(p.progress || 0).step === selectedStageFilter
          )}
        />
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Tambah ToDo / Task Analisis & Permintaan"
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Judul ToDo / Task / Permintaan</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="misal: Usulan penambahan fitur scan barcode / Root Cause Bracket Distortion"
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Kategori / Tipe Task</label>
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
                  {ISSUE_TYPES.map((typeItem) => (
                    <option key={typeItem.value} value={typeItem.value}>
                      {t(`projects.issue_types.${typeItem.value}`, typeItem.label)}
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

            {/* Target PIC Assign (Multiple Person) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users size={13} color="var(--color-accent)" />
                  Target Assign PIC ({selectedPics.length} orang terpilih)
                </label>
                {user && !selectedPics.some((p) => p.id === user.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPics((prev) => [...prev, user]);
                      if (!ownerId) setOwnerId(user.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Tugaskan ke Saya
                  </button>
                )}
              </div>

              {/* Dual PIC Selection: Registered User Dropdown & Custom Email Field with Comma Support */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (!targetId) return;
                    const targetUser = users.find((u) => u.id === targetId);
                    if (targetUser && !selectedPics.some((p) => p.id === targetUser.id || (p.email && targetUser.email && p.email.toLowerCase() === targetUser.email.toLowerCase()))) {
                      setSelectedPics((prev) => [...prev, targetUser]);
                      if (!ownerId) setOwnerId(targetUser.id);
                    }
                  }}
                  style={{
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '11.5px',
                  }}
                >
                  <option value="">+ Pilih User Terdaftar...</option>
                  {users
                    .filter((u) => !selectedPics.some((p) => p.id === u.id || (p.email && u.email && p.email.toLowerCase() === u.email.toLowerCase())))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email || u.username})
                      </option>
                    ))}
                </select>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={13} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={customEmailInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',')) {
                        handleAddCustomPicEmails(val, false);
                      } else {
                        setCustomEmailInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddCustomPicEmails(customEmailInput, false);
                      }
                    }}
                    onBlur={() => {
                      if (customEmailInput.trim()) {
                        handleAddCustomPicEmails(customEmailInput, false);
                      }
                    }}
                    placeholder="Atau email (koma jika banyak)..."
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: customEmailInput.trim() ? '0 30px 0 28px' : '0 10px 0 28px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {customEmailInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddCustomPicEmails(customEmailInput, false)}
                      title="Tambahkan email ini"
                      style={{
                        position: 'absolute',
                        right: '6px',
                        background: 'var(--color-accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-xs, 4px)',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {selectedPics.length > 0 && (
                <div className={styles.picChipsContainer}>
                  {selectedPics.map((pic, idx) => {
                    const isExt = pic.is_external || String(pic.id).startsWith('ext_');
                    return (
                      <span
                        key={pic.id || pic.email}
                        className={`${styles.picChip} ${idx === 0 ? styles.picChipPrimary : ''} ${isExt ? styles.picChipExternal : ''}`}
                      >
                        {isExt ? (
                          <Mail size={12} color="var(--color-warning, #f59e0b)" />
                        ) : (
                          <User size={12} style={{ opacity: 0.7 }} />
                        )}
                        <span>{pic.full_name || pic.name || pic.email}</span>
                        {idx === 0 && <span className={styles.picChipTag}>(Lead PIC)</span>}
                        {isExt && <span className={styles.picChipExtTag}>(Unregistered)</span>}
                        <button
                          type="button"
                          className={styles.picChipRemove}
                          onClick={() => {
                            const updated = selectedPics.filter((p) => (p.id || p.email) !== (pic.id || pic.email));
                            setSelectedPics(updated);
                            const firstRegistered = updated.find((p) => !p.is_external && !String(p.id).startsWith('ext_'));
                            setOwnerId(firstRegistered ? firstRegistered.id : '');
                          }}
                          title="Hapus PIC"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Visibility & Target Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={13} color="var(--color-accent)" />
                  Visibilitas &amp; Hak Akses
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="public">🌐 Publik (Seluruh Tim PE)</option>
                  <option value="private_pic">🔒 Privat PIC (Hanya PIC &amp; Pembuat)</option>
                  <option value="manager">🛡️ Manajer &amp; PIC (Manajer, PIC &amp; Pembuat)</option>
                </select>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                  {visibility === 'public'
                    ? 'Dapat dipantau bersama oleh seluruh tim.'
                    : visibility === 'private_pic'
                    ? 'Privat: hanya PIC dan Anda (serta Admin).'
                    : 'Terlihat oleh Manajer, PIC, dan Anda.'}
                </span>
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
                      title={t(`projects.milestones.${st.id}_desc`, st.desc)}
                    >
                      <span className={styles.breadcrumbNum}>{st.step}</span>
                      <span className={styles.breadcrumbLabel}>{t(`projects.milestones.${st.id}`, st.label)}</span>
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
          title={`Edit ToDo / Task: ${editingProject?.title || ''}`}
        >
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Judul ToDo / Task / Permintaan</label>
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Kategori / Tipe Task</label>
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
                  {ISSUE_TYPES.map((typeItem) => (
                    <option key={typeItem.value} value={typeItem.value}>
                      {t(`projects.issue_types.${typeItem.value}`, typeItem.label)}
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

            {/* Target PIC Assign (Multiple Person) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users size={13} color="var(--color-accent)" />
                  Target Assign PIC ({editSelectedPics.length} orang terpilih)
                </label>
                {user && !editSelectedPics.some((p) => p.id === user.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSelectedPics((prev) => [...prev, user]);
                      if (!editOwnerId) setEditOwnerId(user.id);
                      // ponytail: Auto-update Part Leader if currently using auto-manager
                      if (!editTechReportPartLeader || partLeaderOptions.some((o) => o.value === editTechReportPartLeader)) {
                        const suggested = getSuggestedPartLeader(user);
                        if (suggested) setEditTechReportPartLeader(suggested);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Tugaskan ke Saya
                  </button>
                )}
              </div>

              {/* Dual PIC Selection: Registered User Dropdown & Custom Email Field with Comma Support */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (!targetId) return;
                    const targetUser = users.find((u) => u.id === targetId);
                    if (targetUser && !editSelectedPics.some((p) => p.id === targetUser.id || (p.email && targetUser.email && p.email.toLowerCase() === targetUser.email.toLowerCase()))) {
                      setEditSelectedPics((prev) => [...prev, targetUser]);
                      if (!editOwnerId) setEditOwnerId(targetUser.id);
                      // ponytail: Auto-update Part Leader if currently using auto-manager
                      if (!editTechReportPartLeader || partLeaderOptions.some((o) => o.value === editTechReportPartLeader)) {
                        const suggested = getSuggestedPartLeader(targetUser);
                        if (suggested) setEditTechReportPartLeader(suggested);
                      }
                    }
                  }}
                  style={{
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '11.5px',
                  }}
                >
                  <option value="">+ Pilih User Terdaftar...</option>
                  {users
                    .filter((u) => !editSelectedPics.some((p) => p.id === u.id || (p.email && u.email && p.email.toLowerCase() === u.email.toLowerCase())))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email || u.username})
                      </option>
                    ))}
                </select>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={13} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={editCustomEmailInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',')) {
                        handleAddCustomPicEmails(val, true);
                      } else {
                        setEditCustomEmailInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddCustomPicEmails(editCustomEmailInput, true);
                      }
                    }}
                    onBlur={() => {
                      if (editCustomEmailInput.trim()) {
                        handleAddCustomPicEmails(editCustomEmailInput, true);
                      }
                    }}
                    placeholder="Atau email (koma jika banyak)..."
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: editCustomEmailInput.trim() ? '0 30px 0 28px' : '0 10px 0 28px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {editCustomEmailInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddCustomPicEmails(editCustomEmailInput, true)}
                      title="Tambahkan email ini"
                      style={{
                        position: 'absolute',
                        right: '6px',
                        background: 'var(--color-accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-xs, 4px)',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {editSelectedPics.length > 0 && (
                <div className={styles.picChipsContainer}>
                  {editSelectedPics.map((pic, idx) => {
                    const isExt = pic.is_external || String(pic.id).startsWith('ext_');
                    return (
                      <span
                        key={pic.id || pic.email}
                        className={`${styles.picChip} ${idx === 0 ? styles.picChipPrimary : ''} ${isExt ? styles.picChipExternal : ''}`}
                      >
                        {isExt ? (
                          <Mail size={12} color="var(--color-warning, #f59e0b)" />
                        ) : (
                          <User size={12} style={{ opacity: 0.7 }} />
                        )}
                        <span>{pic.full_name || pic.name || pic.email}</span>
                        {idx === 0 && <span className={styles.picChipTag}>(Lead PIC)</span>}
                        {isExt && <span className={styles.picChipExtTag}>(Unregistered)</span>}
                        <button
                          type="button"
                          className={styles.picChipRemove}
                          onClick={() => {
                            const updated = editSelectedPics.filter((p) => (p.id || p.email) !== (pic.id || pic.email));
                            setEditSelectedPics(updated);
                            const firstRegistered = updated.find((p) => !p.is_external && !String(p.id).startsWith('ext_'));
                            setEditOwnerId(firstRegistered ? firstRegistered.id : '');
                          }}
                          title="Hapus PIC"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Visibility & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={13} color="var(--color-accent)" />
                  Visibilitas &amp; Hak Akses
                </label>
                <select
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="public">🌐 Publik (Seluruh Tim PE)</option>
                  <option value="private_pic">🔒 Privat PIC (Hanya PIC &amp; Pembuat)</option>
                  <option value="manager">🛡️ Manajer &amp; PIC (Manajer, PIC &amp; Pembuat)</option>
                </select>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                  {editVisibility === 'public'
                    ? 'Dapat dipantau bersama oleh seluruh tim.'
                    : editVisibility === 'private_pic'
                    ? 'Privat: hanya PIC dan Pembuat (serta Admin).'
                    : 'Terlihat oleh Manajer, PIC, dan Pembuat.'}
                </span>
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
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                  Status pengerjaan task aktif saat ini.
                </span>
              </div>
            </div>

            {/* Start Date & Target Date (Task Date Range) */}
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Due Date</label>
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
                      onClick={() => {
                        setEditProgress(st.percent);
                        if (st.percent >= 100) setEditStatus('completed');
                        else if (st.percent >= 75) setEditStatus('review');
                        else if (st.percent >= 25) setEditStatus('in_progress');
                        else setEditStatus('planning');
                      }}
                      className={`${styles.breadcrumbNode} ${isCurrent ? styles.breadcrumbNodeCurrent : ''} ${isCompleted ? styles.breadcrumbNodeCompleted : ''}`}
                      title={t(`projects.milestones.${st.id}_desc`, st.desc)}
                    >
                      <span className={styles.breadcrumbNum}>{st.step}</span>
                      <span className={styles.breadcrumbLabel}>{t(`projects.milestones.${st.id}`, st.label)}</span>
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

            {/* OQC Technical Report Format Section */}
            <div style={{
              marginTop: '4px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--color-bg-secondary, rgba(0,0,0,0.02))',
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setIsTechReportExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--color-bg-surface, var(--color-bg-primary))',
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderBottom: isTechReportExpanded ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={15} color="var(--color-accent)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Format OQC Technical Report (SEIN MX Product Engineering)
                  </span>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                  }}>
                    Standard ISO/OQC
                  </span>
                </div>
                <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  {isTechReportExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isTechReportExpanded && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Approval / Sign-Off Header */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                      1. Approval &amp; Sign-Off Header
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Drafter</label>
                        <input
                          type="text"
                          value={editTechReportDrafter}
                          onChange={(e) => setEditTechReportDrafter(e.target.value)}
                          placeholder="Nama Drafter (Engineer)"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Part Leader</label>
                        <select
                          value={editTechReportPartLeader}
                          onChange={(e) => setEditTechReportPartLeader(e.target.value)}
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">-- Pilih Part Leader --</option>
                          {partLeaderOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                          {editTechReportPartLeader && !partLeaderOptions.some((o) => o.value === editTechReportPartLeader) && (
                            <option value={editTechReportPartLeader}>{editTechReportPartLeader}</option>
                          )}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Group Leader</label>
                        <select
                          value={editTechReportGroupLeader}
                          onChange={(e) => setEditTechReportGroupLeader(e.target.value)}
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">-- Pilih Group Leader --</option>
                          {groupLeaderOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                          {editTechReportGroupLeader && !groupLeaderOptions.some((o) => o.value === editTechReportGroupLeader) && (
                            <option value={editTechReportGroupLeader}>{editTechReportGroupLeader}</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Problem Information Grid */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                      2. Problem Information
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Model</label>
                        <input
                          type="text"
                          value={editTechReportModel}
                          onChange={(e) => setEditTechReportModel(e.target.value)}
                          placeholder="misal: SM-A276B"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Defect Date</label>
                        <input
                          type="date"
                          value={editTechReportDefectDate}
                          onChange={(e) => setEditTechReportDefectDate(e.target.value)}
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Defect Qty</label>
                        <input
                          type="text"
                          value={editTechReportDefectQty}
                          onChange={(e) => setEditTechReportDefectQty(e.target.value)}
                          placeholder="misal: 14 ea"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Problem / Gejala Utama</label>
                        <input
                          type="text"
                          value={editTechReportProblem}
                          onChange={(e) => setEditTechReportProblem(e.target.value)}
                          placeholder="misal: LTE B1,B2 TX POWER Fail"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Defect Location</label>
                        <input
                          type="text"
                          value={editTechReportDefectLocation}
                          onChange={(e) => setEditTechReportDefectLocation(e.target.value)}
                          placeholder="misal: Main Line Block6-3"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>CN</label>
                        <input
                          type="text"
                          value={editTechReportCN}
                          onChange={(e) => setEditTechReportCN(e.target.value)}
                          placeholder="misal: CN-2026-001"
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Detail Report (2 Kolom Textarea: Format Tabel & Gambar) */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                      3. Detail Report (2 Kolom Textarea: Format Tabel &amp; Gambar)
                    </label>

                    {/* Textarea 1: Symptoms & Technical Analysis */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          Kolom 1: Symptoms &amp; Analysis
                        </label>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Gunakan toolbar untuk sisipkan Tabel &amp; Unggah Foto PBA
                        </span>
                      </div>
                      <FormattingTextarea
                        value={editTechReportSymptoms}
                        onChange={(e) => setEditTechReportSymptoms(e.target.value)}
                        placeholder="Tuliskan analisis gejala kegagalan, swap test, atau sisipkan tabel pengukuran dan unggah foto lampiran..."
                        minHeight="140px"
                      />
                    </div>

                    {/* Textarea 2: Conclusion & Action Countermeasures */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          Kolom 2: Conclusion &amp; Action Countermeasure
                        </label>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Gunakan toolbar untuk format poin, tabel PIC/Part number, dan bukti
                        </span>
                      </div>
                      <FormattingTextarea
                        value={editTechReportCountermeasure}
                        onChange={(e) => setEditTechReportCountermeasure(e.target.value)}
                        placeholder="Tuliskan kesimpulan investigasi, feedback ke maker/vendor, dan action plan pencegahan..."
                        minHeight="140px"
                      />
                    </div>
                  </div>
                </div>
              )}
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

            <div style={{ display: 'flex', justifyContent: canDeleteProject(editingProject) ? 'space-between' : 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              {canDeleteProject(editingProject) && (
                <Button
                  variant="outline"
                  icon={Trash2}
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={(e) => handleDeleteProject(editingProject, e)}
                  type="button"
                >
                  {t('common.delete', 'Hapus Project')}
                </Button>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProject(null);
                    if (location.state?.returnTo) {
                      navigate(location.state.returnTo);
                    }
                  }}
                  type="button"
                >
                  {t('common.cancel', 'Batal')}
                </Button>
                <Button variant="primary" type="submit">
                  {t('common.save', 'Simpan Perubahan')}
                </Button>
              </div>
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
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Detail ToDo / Task Analyst</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginRight: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Eye}
                  loading={loadingPreviewId === viewingProject.id}
                  onClick={() => handlePreviewEmail(viewingProject)}
                  title="Lihat Pratinjau Tampilan Email Laporan (HTML Preview)"
                >
                  Preview Email
                </Button>
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
                {canDeleteProject(viewingProject) && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={(e) => handleDeleteProject(viewingProject, e)}
                    title={t('common.delete', 'Hapus Project')}
                  >
                    Hapus
                  </Button>
                )}
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
                  <span className={styles.categoryTag} style={{
                    color: viewingProject.project_type === 'feature_request' ? '#a855f7' : undefined,
                  }}>
                    <Tag size={11} /> {viewingProject.project_type?.replace('_', ' ') || 'General'}
                  </span>
                  <StatusBadge status={viewingProject.priority} />
                  <StatusBadge status={viewingProject.status} />
                  {parseMetadata(viewingProject.metadata).visibility === 'private_pic' && (
                    <span className={`${styles.visibilityPill} ${styles.visibilityPrivate}`} title="Hanya terlihat oleh PIC & Pembuat">
                      <Lock size={10} /> Privat PIC
                    </span>
                  )}
                  {parseMetadata(viewingProject.metadata).visibility === 'manager' && (
                    <span className={`${styles.visibilityPill} ${styles.visibilityManager}`} title="Terlihat oleh Manager, PIC & Pembuat">
                      <Shield size={10} /> Manager &amp; PIC
                    </span>
                  )}
                  {(!parseMetadata(viewingProject.metadata).visibility || parseMetadata(viewingProject.metadata).visibility === 'public') && (
                    <span className={styles.visibilityPill} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <Globe size={10} /> Publik
                    </span>
                  )}
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
                    <Users size={15} />
                  </div>
                  <div className={styles.viewMetaText}>
                    <span className={styles.viewMetaLabel}>Assigned PIC ({(() => {
                      const m = parseMetadata(viewingProject.metadata);
                      return (m.assigned_pics && m.assigned_pics.length) || (viewingProject.owner_name ? 1 : 0);
                    })()} orang)</span>
                    <span className={styles.viewMetaValue}>
                      {(() => {
                        const m = parseMetadata(viewingProject.metadata);
                        if (m.assigned_pics && m.assigned_pics.length > 0) {
                          return m.assigned_pics.map((x) => x.name || x.full_name).join(', ');
                        }
                        return viewingProject.owner_name || 'Unassigned';
                      })()}
                    </span>
                  </div>
                </div>

                <div className={styles.viewMetaItem}>
                  <div className={styles.viewMetaIconBox}>
                    <User size={15} />
                  </div>
                  <div className={styles.viewMetaText}>
                    <span className={styles.viewMetaLabel}>Pembuat Task</span>
                    <span className={styles.viewMetaValue}>
                      {parseMetadata(viewingProject.metadata).created_by_name || 'Team Member'}
                    </span>
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
                      title={t(`projects.milestones.${st.id}_desc`, st.desc)}
                    >
                      <span className={styles.breadcrumbNum}>
                        {isCompleted && !isCurrent ? <Check size={10} strokeWidth={3} /> : st.step}
                      </span>
                      <span className={styles.breadcrumbLabel}>{t(`projects.milestones.${st.id}`, st.label)}</span>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* SEIN MX Technical Report Card (OQC Format) */}
            <TaskAnalystTechnicalReportCard
              project={viewingProject}
              onEdit={() => {
                setIsViewModalOpen(false);
                openEditModal(viewingProject);
              }}
            />

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
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Eye}
                  loading={loadingPreviewId === viewingProject.id}
                  onClick={() => handlePreviewEmail(viewingProject)}
                  title="Lihat Pratinjau Tampilan Email Laporan"
                >
                  Preview Email
                </Button>
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
                {canDeleteProject(viewingProject) && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={(e) => handleDeleteProject(viewingProject, e)}
                    title={t('common.delete', 'Hapus Project')}
                  >
                    Hapus
                  </Button>
                )}
              </div>
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

      {/* ponytail: PREVIEW EMAIL MODAL */}
      {previewEmail && (
        <Modal
          isOpen={Boolean(previewEmail)}
          onClose={() => setPreviewEmail(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Eye size={17} color="var(--color-accent)" />
                <span style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Preview Email: {previewEmail.project?.title}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginRight: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(previewEmail.html);
                      w.document.close();
                    }
                  }}
                  title="Buka di Tab Baru"
                >
                  Tab Baru
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Mail}
                  loading={sendingEmailId === previewEmail?.project?.id}
                  onClick={async () => {
                    const target = previewEmail.project;
                    setPreviewEmail(null);
                    await handleSendEmail(target);
                  }}
                  title="Kirim Email Sekarang"
                >
                  Kirim Sekarang
                </Button>
              </div>
            </div>
          }
          maxWidth="1100px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--color-border)' }}>
              <strong style={{ color: 'var(--color-text-secondary)' }}>Subject:</strong>{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{previewEmail.subject}</span>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9' }}>
              <iframe
                srcDoc={previewEmail.html}
                title="Preview Email Body"
                style={{ width: '100%', height: '680px', border: 'none', display: 'block', backgroundColor: '#f1f5f9' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
