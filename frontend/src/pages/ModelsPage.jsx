import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ChevronRight,
  Cpu,
  Edit2,
  Eye,
  History,
  MessageSquare,
  Calendar,
  User,
  UserCheck,
  Trash2,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Tag,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  Table as TableIcon,
  Upload,
  Loader2,
  Save,
  Check,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { FormattingTextarea } from '../components/common/FormattingTextarea';
import { CommentTimelineSection, logTimelineEvent } from '../components/common/CommentTimelineSection';
import { AttachmentViewer } from '../components/common/AttachmentViewer';
import { RichNotesViewer } from '../components/common/RichNotesViewer';

export const PIPELINE_STAGES = [
  { key: 'concept', label: 'Concept', fullLabel: 'Concept & Feasibility', desc: 'Perencanaan awal spesifikasi, market demand, dan kelayakan teknis' },
  { key: 'design', label: 'Design', fullLabel: 'Industrial & Mechanical Design', desc: 'Desain mekanikal, blueprint tooling, dan verifikasi CAD/skematik' },
  { key: 'prototype', label: 'Proto', fullLabel: 'Prototype Sample Build', desc: 'Pembuatan sampel fisik pertama dan uji fungsional awal' },
  { key: 'evt', label: 'EVT', fullLabel: 'Engineering Verification Test', desc: 'Verifikasi engineering parameter, JIG tooling, dan kesiapan lini mesin' },
  { key: 'dvt', label: 'DVT', fullLabel: 'Design Verification Test', desc: 'Uji integrasi desain, reliabilitas termal/drop, dan standar kualitas' },
  { key: 'pvt', label: 'PVT', fullLabel: 'Production Verification Test', desc: 'Uji coba pilot run di pabrik, validasi yield, dan standarisasi SOP' },
  { key: 'mp', label: 'MP', fullLabel: 'Mass Production Ramp-Up', desc: 'Produksi massal penuh aktif di seluruh line manufaktur' },
  { key: 'released', label: 'Release', fullLabel: 'Market Release & Support', desc: 'Produk resmi dirilis komersial dan dalam masa pemeliharaan' },
];

export const getStageInfo = (stageKey) => {
  return PIPELINE_STAGES.find((s) => s.key === stageKey) || {
    key: stageKey,
    label: stageKey ? stageKey.toUpperCase() : 'Stage',
    fullLabel: stageKey,
    desc: '',
  };
};

export const formatStageDuration = (startedAt, completedAt) => {
  if (!startedAt) return '-';
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = Math.max(0, end - start);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diffDays > 0) {
    return `${diffDays} hari ${diffHours > 0 ? `${diffHours} jam` : ''}`;
  }
  return `${Math.max(1, diffHours)} jam`;
};

export const ModelsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [activeModel, setActiveModel] = useState(null);

  // Detail & Development History Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingModel, setViewingModel] = useState(null);
  const [stageHistory, setStageHistory] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [detailTab, setDetailTab] = useState('history'); // 'history' | 'comments'
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // Add form
  const [modelName, setModelName] = useState('');
  const [codename, setCodename] = useState('');
  const [stage, setStage] = useState('concept');
  const [targetRelease, setTargetRelease] = useState('');
  const [description, setDescription] = useState('');

  // Advance & Update Stage form state
  const [advanceMode, setAdvanceMode] = useState('update_only'); // 'update_only' (tetap di tahap ini) | 'advance' (naik tahap)
  const [nextStage, setNextStage] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [stageAttachments, setStageAttachments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showNotesPreview, setShowNotesPreview] = useState(false);
  const [targetStageId, setTargetStageId] = useState(null);

  // Edit form
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [editModelName, setEditModelName] = useState('');
  const [editCodename, setEditCodename] = useState('');
  const [editTargetRelease, setEditTargetRelease] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/models', {
        params: {
          stage: selectedStageFilter || undefined,
        },
      });
      setModels(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [selectedStageFilter]);

  // Open Detail & History Modal
  const openDetailModal = async (m, initialTab = 'history') => {
    setViewingModel(m);
    setDetailTab(initialTab);
    setIsDetailModalOpen(true);
    setLoadingStages(true);
    try {
      const res = await api.get(`/models/${m.id}/stages`);
      setStageHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load stage history:', err);
      setStageHistory([]);
    } finally {
      setLoadingStages(false);
    }
  };

  const canDeleteModel = (m) => {
    if (!m || !user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    if (m.owner_id === user.id) return true;
    return false;
  };

  const handleDeleteModel = async (m, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!m || !m.id) return;
    if (!window.confirm(`Hapus data model development "${m.model_name}"? Semua data riwayat tahap akan dihapus.`)) {
      return;
    }
    try {
      await api.delete(`/models/${m.id}`);
      setModels((prev) => prev.filter((item) => item.id !== m.id));
      if (viewingModel && viewingModel.id === m.id) {
        setIsDetailModalOpen(false);
        setViewingModel(null);
      }
      if (editingModel && editingModel.id === m.id) {
        setIsEditModalOpen(false);
        setEditingModel(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal menghapus model');
    }
  };

  const handleCreateModel = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/models', {
        model_name: modelName,
        codename: codename || undefined,
        stage,
        target_release: targetRelease || undefined,
        description: description || undefined,
      });
      setModels((prev) => [res.data, ...prev]);
      setIsAddModalOpen(false);
      setModelName('');
      setCodename('');
      setTargetRelease('');
      setDescription('');

      // Auto-record timeline change log
      await logTimelineEvent(
        'model',
        res.data.id,
        `Model produk baru "${res.data.model_name}" didaftarkan pada tahap ${stage.toUpperCase()}`
      );
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Open Stage Update / Advance Modal
  const openStageModal = (m, mode = 'update_only', initialNotes = '', initialAttachments = [], stageId = null, e = null) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setActiveModel(m);
    setAdvanceMode(mode);
    setTargetStageId(stageId);

    // Calculate next stage in pipeline
    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === m.stage);
    const next = PIPELINE_STAGES[currentIndex + 1]?.key || m.stage;
    setNextStage(next);

    setStageNotes(initialNotes || '');
    let parsedAttachments = initialAttachments;
    if (typeof parsedAttachments === 'string') {
      try {
        parsedAttachments = JSON.parse(parsedAttachments);
      } catch {
        parsedAttachments = [];
      }
    }
    setStageAttachments(Array.isArray(parsedAttachments) ? parsedAttachments : []);
    setShowNotesPreview(false);
    setIsAdvanceModalOpen(true);
  };

  // Handle stage update (either update current notes/docs or advance to next stage)
  const handleStageSubmit = async (e) => {
    e.preventDefault();
    if (!activeModel) return;

    try {
      const isAdvance = advanceMode === 'advance';

      if (targetStageId) {
        // Direct update on specific stage by stageId
        await api.put(`/models/${activeModel.id}/stages/${targetStageId}`, {
          notes: stageNotes,
          attachments: stageAttachments,
        });
      } else {
        // Advance or update active stage
        await api.post(`/models/${activeModel.id}/stages`, {
          stage: isAdvance ? nextStage : activeModel.stage,
          notes: stageNotes,
          attachments: stageAttachments,
          advance: isAdvance,
        });
      }

      const stageInfo = getStageInfo(isAdvance ? nextStage : activeModel.stage);
      const logMessage = isAdvance
        ? `Tahap development resmi dimajukan ke ${stageInfo.label.toUpperCase()} (${stageInfo.fullLabel}). Catatan kriteria kelolosan dan lampiran dokumen diperbarui.`
        : `Catatan hasil validasi & lampiran dokumen tahap ${stageInfo.label.toUpperCase()} diperbarui (tahap tetap berjalan).`;

      await logTimelineEvent('model', activeModel.id, logMessage);

      setIsAdvanceModalOpen(false);
      setStageNotes('');
      setStageAttachments([]);
      setTargetStageId(null);

      // Refresh list & detail if currently open
      fetchModels();
      if (viewingModel && viewingModel.id === activeModel.id) {
        if (isAdvance) {
          setViewingModel((prev) => ({ ...prev, stage: nextStage }));
        }
        const stagesRes = await api.get(`/models/${activeModel.id}/stages`);
        setStageHistory(stagesRes.data || []);
        setTimelineRefreshKey((k) => k + 1);
      }
      setActiveModel(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Insert Table Template into notes
  const handleInsertTableTemplate = () => {
    const tableTemplate = `\n| Item / Parameter Uji | Standar Spesifikasi | Hasil Aktual | Status |\n|---|---|---|---|\n| JIG Clamping Force | 150 - 200 N | 185 N | PASS |\n| Yield Line Assembly | >= 98.5% | 99.2% | PASS |\n| Thermal Delta T | < 12 °C | 8.4 °C | PASS |\n`;
    setStageNotes((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + tableTemplate);
  };

  // Upload and insert photo into notes
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/comments/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const photoMarkdown = `\n![${res.data.name}](${res.data.url})\n`;
      setStageNotes((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + photoMarkdown);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal mengupload foto');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Upload document attachment
  const handleDocUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingDoc(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/comments/upload-attachment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setStageAttachments((prev) => [
          ...prev,
          {
            name: res.data.name,
            url: res.data.url,
            size: res.data.size,
            type: res.data.type,
          },
        ]);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Gagal mengupload dokumen');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const openEditModal = (m, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditingModel(m);
    setEditModelName(m.model_name || '');
    setEditCodename(m.codename || '');
    setEditTargetRelease(m.target_release ? m.target_release.substring(0, 10) : '');
    setEditDescription(m.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateModel = async (e) => {
    if (e) e.preventDefault();
    if (!editingModel) return;

    try {
      const res = await api.put(`/models/${editingModel.id}`, {
        model_name: editModelName,
        codename: editCodename || undefined,
        target_release: editTargetRelease || undefined,
        description: editDescription || undefined,
      });

      const updated = { ...editingModel, ...res.data };
      setModels((prev) =>
        prev.map((m) => (m.id === editingModel.id ? updated : m))
      );

      if (viewingModel && viewingModel.id === editingModel.id) {
        setViewingModel(updated);
      }

      await logTimelineEvent(
        'model',
        editingModel.id,
        `Informasi model diperbarui (Nama: ${editModelName}, Codename: ${editCodename || '-'})`
      );

      setIsEditModalOpen(false);
      setEditingModel(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Filtered models by search query
  const filteredModels = models.filter((m) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      m.model_name?.toLowerCase().includes(query) ||
      m.codename?.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.stage?.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hidden file inputs for photo and document uploads */}
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocUpload}
        multiple
        style={{ display: 'none' }}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('models.title', 'New Model Development')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('models.subtitle', 'Track product development stages: data validasi tabel, foto uji, lampiran dokumen per tahap & timeline')}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
          {t('models.add_model', 'Daftarkan Model Baru')}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari model, codename (cth: Paradigm, S26)..."
            icon={Search}
          />
        </div>

        <select
          value={selectedStageFilter}
          onChange={(e) => setSelectedStageFilter(e.target.value)}
          style={{
            height: '36px',
            padding: '0 12px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="">Semua Tahap Development</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({s.fullLabel})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState message="Memuat pipeline new model development..." />
      ) : filteredModels.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title={search ? 'Model tidak ditemukan' : 'Belum ada model terdaftar'}
          description={search ? 'Coba ubah kata kunci pencarian atau filter tahap.' : 'Daftarkan model produk baru (cth: S26 Series codename Paradigm) untuk mulai melacak tahap development.'}
          actionLabel="Daftarkan Model Baru"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredModels.map((m) => {
            const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === m.stage);

            return (
              <div
                key={m.id}
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Model Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2
                        onClick={() => openDetailModal(m, 'history')}
                        style={{
                          fontSize: 'var(--font-size-md)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                        title="Klik untuk melihat Detail History & Komentar"
                      >
                        {m.model_name}
                      </h2>
                      {m.codename && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-accent-subtle)',
                          color: 'var(--color-accent)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          Codename: {m.codename}
                        </span>
                      )}
                      <StatusBadge status={m.stage} />
                      {m.target_release && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Target: {new Date(m.target_release).toLocaleDateString('id-ID')}
                        </span>
                      )}
                      {m.owner_name && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> PIC: {m.owner_name}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        marginTop: '6px',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}>
                        {m.description}
                      </p>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={History}
                      onClick={() => openDetailModal(m, 'history')}
                      title="Lihat Detail History Development & Tahapan"
                    >
                      History & Detail
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={MessageSquare}
                      onClick={() => openDetailModal(m, 'comments')}
                      title="Buka Komentar & Diskusi Tim"
                    >
                      Komentar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Edit2}
                      onClick={(e) => openEditModal(m, e)}
                    >
                      Edit
                    </Button>
                    {/* Update / Advance Stage Button */}
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ChevronRight}
                      onClick={(e) => openStageModal(m, 'update_only', '', [], null, e)}
                      title="Update Catatan/Dokumen atau Majukan Tahap"
                    >
                      Update / Advance Stage
                    </Button>
                    {canDeleteModel(m) && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Trash2}
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        onClick={(e) => handleDeleteModel(m, e)}
                        title="Hapus Model Development"
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>

                {/* Pipeline visual bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  overflowX: 'auto',
                }}>
                  {PIPELINE_STAGES.map((s, idx) => {
                    const isPassed = idx < currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <React.Fragment key={s.key}>
                        <div
                          onClick={() => openDetailModal(m, 'history')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: isCurrent
                              ? 'var(--color-accent)'
                              : isPassed
                              ? 'var(--color-success)'
                              : 'var(--color-text-muted)',
                            fontWeight: isCurrent ? 700 : 500,
                            fontSize: 'var(--font-size-xs)',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                          title={`${s.label}: ${s.fullLabel} (${s.desc})`}
                        >
                          <span style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCurrent
                              ? 'var(--color-accent)'
                              : isPassed
                              ? 'var(--color-success)'
                              : 'var(--color-border)',
                            color: '#ffffff',
                            fontSize: '10px',
                            fontWeight: 700,
                            boxShadow: isCurrent ? '0 0 8px rgba(59, 130, 246, 0.4)' : undefined,
                          }}>
                            {isPassed ? '✓' : idx + 1}
                          </span>
                          <span>{s.label}</span>
                        </div>
                        {idx < PIPELINE_STAGES.length - 1 && (
                          <div style={{
                            flex: 1,
                            minWidth: '20px',
                            height: '2px',
                            backgroundColor: idx < currentStageIndex
                              ? 'var(--color-success)'
                              : 'var(--color-border)',
                            margin: '0 8px',
                          }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL HISTORY & COMMENT MODAL */}
      {isDetailModalOpen && viewingModel && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setViewingModel(null);
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="var(--color-accent)" />
                <span style={{ fontSize: '16px', fontWeight: 700 }}>
                  Detail & History: {viewingModel.model_name}
                </span>
                {viewingModel.codename && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-accent-subtle)',
                    color: 'var(--color-accent)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {viewingModel.codename}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ChevronRight}
                  onClick={(e) => {
                    openStageModal(viewingModel, 'update_only', '', [], null, e);
                  }}
                >
                  Update / Advance Stage
                </Button>
                {canDeleteModel(viewingModel) && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={(e) => handleDeleteModel(viewingModel, e)}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          }
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setViewingModel(null);
                }}
              >
                Tutup
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Model Info Header Card */}
            <div style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Tahap Saat Ini:</span>
                    <StatusBadge status={viewingModel.stage} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      ({getStageInfo(viewingModel.stage).fullLabel})
                    </span>
                  </div>
                  {viewingModel.description ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {viewingModel.description}
                    </p>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      Belum ada deskripsi spesifikasi untuk model ini.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                  {viewingModel.target_release && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} /> Target Release: {new Date(viewingModel.target_release).toLocaleDateString('id-ID')}
                    </span>
                  )}
                  {viewingModel.owner_name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} /> PIC Engineer: {viewingModel.owner_name}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} /> Terdaftar: {new Date(viewingModel.created_at).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Mini Pipeline Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                overflowX: 'auto',
              }}>
                {PIPELINE_STAGES.map((s, idx) => {
                  const currentIdx = PIPELINE_STAGES.findIndex((st) => st.key === viewingModel.stage);
                  const isPassed = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <React.Fragment key={s.key}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: isCurrent
                          ? 'var(--color-accent)'
                          : isPassed
                          ? 'var(--color-success)'
                          : 'var(--color-text-muted)',
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isCurrent
                            ? 'var(--color-accent)'
                            : isPassed
                            ? 'var(--color-success)'
                            : 'var(--color-border)',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: 700,
                        }}>
                          {isPassed ? '✓' : idx + 1}
                        </span>
                        <span>{s.label}</span>
                      </div>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <div style={{
                          flex: 1,
                          minWidth: '14px',
                          height: '2px',
                          backgroundColor: idx < currentIdx ? 'var(--color-success)' : 'var(--color-border)',
                          margin: '0 6px',
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Tab Navigation Buttons */}
            <div style={{
              display: 'flex',
              gap: '4px',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '2px',
            }}>
              <button
                type="button"
                onClick={() => setDetailTab('history')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: detailTab === 'history' ? '2px solid var(--color-accent)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: detailTab === 'history' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <History size={15} />
                <span>Riwayat Tahap Development ({stageHistory.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('comments')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: detailTab === 'comments' ? '2px solid var(--color-accent)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: detailTab === 'comments' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageSquare size={15} />
                <span>Komentar & Diskusi Tim</span>
              </button>
            </div>

            {/* TAB CONTENT 1: Riwayat Tahap Development */}
            {detailTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Log Perkembangan Tahap Engineering, Hasil Uji & Dokumen
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    icon={Edit2}
                    onClick={() => openStageModal(viewingModel, 'update_only', '', [], null)}
                  >
                    + Update Catatan/Dokumen Tahap Ini
                  </Button>
                </div>

                {loadingStages ? (
                  <LoadingState message="Memuat riwayat tahapan development..." />
                ) : stageHistory.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                  }}>
                    <History size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                      Belum Ada Riwayat Tahap Tambahan
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Gunakan tombol "Update / Advance Stage" untuk menginput catatan hasil uji tabel, foto, dan lampiran dokumen.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {stageHistory.map((sh, idx) => {
                      const stageMeta = getStageInfo(sh.stage);
                      const isDone = sh.status === 'completed';

                      return (
                        <div
                          key={sh.id || idx}
                          style={{
                            backgroundColor: 'var(--color-bg-primary)',
                            border: `1px solid ${isDone ? 'var(--color-border)' : 'var(--color-accent)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            position: 'relative',
                            boxShadow: !isDone ? '0 0 10px rgba(59, 130, 246, 0.15)' : undefined,
                          }}
                        >
                          {/* Header row of stage entry */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isDone ? 'var(--color-success)' : 'var(--color-accent)',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}>
                                {isDone ? '✓' : idx + 1}
                              </span>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                    {stageMeta.label} - {stageMeta.fullLabel}
                                  </span>
                                  {isDone ? (
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: 'var(--color-success)',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                    }}>
                                      ✓ Selesai (Completed)
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: 'var(--color-accent)',
                                      backgroundColor: 'var(--color-accent-subtle)',
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--color-accent)',
                                    }}>
                                      ⚡ Tahap Aktif (In Progress)
                                    </span>
                                  )}
                                </div>
                                {stageMeta.desc && (
                                  <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                                    {stageMeta.desc}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                padding: '4px 9px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                fontSize: '11.5px',
                                color: 'var(--color-text-secondary)',
                              }}>
                                ⏱️ Durasi: {formatStageDuration(sh.started_at, sh.completed_at)}
                              </span>
                              <Button
                                variant="outline"
                                size="xs"
                                icon={Edit2}
                                onClick={() => openStageModal(viewingModel, 'update_only', sh.notes, sh.attachments, sh.id)}
                                title="Edit Catatan & Dokumen Tahap Ini"
                              >
                                Edit Catatan
                              </Button>
                            </div>
                          </div>

                          {/* Notes body with rich Table and Photo renderer */}
                          <div style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderLeft: `3px solid ${isDone ? 'var(--color-success)' : 'var(--color-accent)'}`,
                            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                            padding: '12px 16px',
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Catatan Hasil Validasi & Parameter:
                            </span>
                            {sh.notes ? (
                              <RichNotesViewer content={sh.notes} />
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                Belum ada catatan hasil validasi pada tahap ini.
                              </span>
                            )}
                          </div>

                          {/* Stage Attached Documents */}
                          {sh.attachments && (Array.isArray(sh.attachments) ? sh.attachments.length > 0 : sh.attachments !== '[]') && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              padding: '10px 14px',
                              backgroundColor: 'var(--color-bg-primary)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)',
                            }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Paperclip size={12} color="var(--color-accent)" /> Dokumen & Laporan Terlampir:
                              </span>
                              <AttachmentViewer attachments={sh.attachments} readonly={true} />
                            </div>
                          )}

                          {/* Footer Info: Dates and Approver */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            borderTop: '1px solid var(--color-border-subtle)',
                            paddingTop: '8px',
                            marginTop: '2px',
                          }}>
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                              <span>Mulai: {sh.started_at ? new Date(sh.started_at).toLocaleDateString('id-ID') : '-'}</span>
                              {sh.completed_at && (
                                <span>Selesai: {new Date(sh.completed_at).toLocaleDateString('id-ID')}</span>
                              )}
                            </div>
                            {sh.approver_name && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                <UserCheck size={13} color="var(--color-accent)" /> Di-approve oleh: {sh.approver_name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: Diskusi & Komentar Tim PE */}
            {detailTab === 'comments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CommentTimelineSection
                  entityType="model"
                  entityId={viewingModel.id}
                  entityTitle={viewingModel.model_name}
                  refreshKey={timelineRefreshKey}
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* STAGE UPDATE & ADVANCE MODAL (Catatan, Tabel, Foto & Lampiran Dokumen) */}
      {isAdvanceModalOpen && activeModel && (
        <Modal
          isOpen={isAdvanceModalOpen}
          zIndex={1050}
          onClose={() => {
            setIsAdvanceModalOpen(false);
            setActiveModel(null);
            setTargetStageId(null);
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={17} color="var(--color-accent)" />
              <span style={{ fontSize: '15px', fontWeight: 700 }}>
                {targetStageId ? 'Edit Catatan & Dokumen Tahap' : `Update Data Tahap: ${activeModel.model_name}`}
              </span>
            </div>
          }
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAdvanceModalOpen(false);
                  setActiveModel(null);
                  setTargetStageId(null);
                }}
              >
                {t('common.cancel', 'Batal')}
              </Button>
              <Button
                variant="primary"
                icon={advanceMode === 'advance' ? ChevronRight : Save}
                onClick={handleStageSubmit}
              >
                {advanceMode === 'advance' ? 'Konfirmasi Pemindahan Tahap' : 'Simpan Catatan & Dokumen Tahap'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleStageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Advance Mode Selector: Tidak langsung naik stage vs Naik Stage */}
            {!targetStageId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Aksi Tahap Development
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Option 1: Update current stage without advancing */}
                  <div
                    onClick={() => setAdvanceMode('update_only')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${advanceMode === 'update_only' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      backgroundColor: advanceMode === 'update_only' ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="advance_mode"
                        value="update_only"
                        checked={advanceMode === 'update_only'}
                        onChange={() => setAdvanceMode('update_only')}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: advanceMode === 'update_only' ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                        ⚡ Update Catatan & Dokumen (Tetap di Tahap Ini)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '22px', lineHeight: 1.4 }}>
                      Simpan tabel hasil uji, foto sampel, & dokumen. Tahap aktif tetap berjalan ({getStageInfo(activeModel.stage).label}).
                    </span>
                  </div>

                  {/* Option 2: Advance to next stage */}
                  <div
                    onClick={() => setAdvanceMode('advance')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${advanceMode === 'advance' ? 'var(--color-success)' : 'var(--color-border)'}`,
                      backgroundColor: advanceMode === 'advance' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="advance_mode"
                        value="advance"
                        checked={advanceMode === 'advance'}
                        onChange={() => setAdvanceMode('advance')}
                        style={{ accentColor: 'var(--color-success)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: advanceMode === 'advance' ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                        🚀 Selesaikan & Majukan Tahap (Advance Stage)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingLeft: '22px', lineHeight: 1.4 }}>
                      Tandai tahap saat ini selesai dan lanjutkan development ke tahap berikutnya di pipeline.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Next stage dropdown (only visible when advancing) */}
            {advanceMode === 'advance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Pilih Tahap Berikutnya (Next Stage)
                </label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-primary)',
                    fontSize: '13px',
                  }}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.fullLabel}) - {s.desc}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Catatan Field with Quick Actions: Table Insert & Photo Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Catatan Hasil Validasi & Kriteria Lolos Tahap
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleInsertTableTemplate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    title="Sisipkan Template Tabel Markdown"
                  >
                    <TableIcon size={13} color="var(--color-accent)" />
                    <span>+ Sisipkan Tabel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    title="Upload dan Sisipkan Foto / Gambar ke Catatan"
                  >
                    {uploadingPhoto ? <Loader2 size={13} className="spin" /> : <ImageIcon size={13} color="var(--color-accent)" />}
                    <span>{uploadingPhoto ? 'Mengupload...' : '+ Sisipkan Foto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNotesPreview(!showNotesPreview)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${showNotesPreview ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      backgroundColor: showNotesPreview ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                      color: showNotesPreview ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={13} />
                    <span>{showNotesPreview ? 'Edit Teks' : 'Preview Render'}</span>
                  </button>
                </div>
              </div>

              {showNotesPreview ? (
                <div style={{
                  padding: '14px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  minHeight: '180px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>
                    Live Preview Render (Tabel & Foto):
                  </span>
                  {stageNotes ? (
                    <RichNotesViewer content={stageNotes} />
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Ketik catatan di atas atau klik "+ Sisipkan Tabel" / "+ Sisipkan Foto" untuk melihat preview.
                    </span>
                  )}
                </div>
              ) : (
                <FormattingTextarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  placeholder="Catat kriteria kelolosan (approval criteria), hasil uji build/yield, parameter mesin, atau sisipkan tabel parameter & foto..."
                  rows={8}
                  minHeight="160px"
                />
              )}
            </div>

            {/* Lampiran Dokumen Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Lampiran Dokumen & Laporan Uji (PDF, Excel, Word, ZIP)
                </label>
                <Button
                  variant="outline"
                  size="xs"
                  icon={Paperclip}
                  loading={uploadingDoc}
                  onClick={() => docInputRef.current?.click()}
                >
                  + Upload Dokumen
                </Button>
              </div>

              {stageAttachments.length > 0 ? (
                <AttachmentViewer
                  attachments={stageAttachments}
                  readonly={false}
                  onRemove={(idx) => setStageAttachments((prev) => prev.filter((_, i) => i !== idx))}
                />
              ) : (
                <div
                  onClick={() => docInputRef.current?.click()}
                  style={{
                    padding: '16px',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Paperclip size={14} color="var(--color-accent)" />
                  <span>Klik di sini untuk melampirkan file dokumen (SOP validasi, checklist excel, laporan PDF)</span>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Add Model Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Daftarkan Model Baru"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button variant="primary" onClick={handleCreateModel}>
              {t('common.save', 'Simpan Model')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Model Name"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            required
            placeholder="e.g. S26 Series"
          />

          <Input
            label="Codename"
            value={codename}
            onChange={(e) => setCodename(e.target.value)}
            placeholder="e.g. Paradigm"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Tahap Awal (Initial Stage)
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} ({s.fullLabel})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Target Release Date"
            type="date"
            value={targetRelease}
            onChange={(e) => setTargetRelease(e.target.value)}
          />

          <FormattingTextarea
            label="Deskripsi / Spesifikasi Awal"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Spesifikasi hardware, konfigurasi lini perakitan, catatan khusus..."
            minHeight="100px"
          />
        </form>
      </Modal>

      {/* Edit Model Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingModel(null);
        }}
        title={`Edit Model: ${editingModel?.model_name || ''}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {canDeleteModel(editingModel) && (
                <Button
                  variant="outline"
                  icon={Trash2}
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  onClick={(e) => handleDeleteModel(editingModel, e)}
                >
                  Hapus
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingModel(null);
                }}
              >
                {t('common.cancel', 'Batal')}
              </Button>
              <Button variant="primary" onClick={handleUpdateModel}>
                {t('common.save', 'Simpan Perubahan')}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleUpdateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Model Name"
            value={editModelName}
            onChange={(e) => setEditModelName(e.target.value)}
            required
            placeholder="e.g. S26 Series"
          />

          <Input
            label="Codename"
            value={editCodename}
            onChange={(e) => setEditCodename(e.target.value)}
            placeholder="e.g. Paradigm"
          />

          <Input
            label="Target Release Date"
            type="date"
            value={editTargetRelease}
            onChange={(e) => setEditTargetRelease(e.target.value)}
          />

          <FormattingTextarea
            label="Deskripsi / Catatan Model"
            rows={4}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Spesifikasi hardware, konfigurasi lini perakitan, catatan khusus..."
            minHeight="120px"
          />
        </form>
      </Modal>
    </div>
  );
};
