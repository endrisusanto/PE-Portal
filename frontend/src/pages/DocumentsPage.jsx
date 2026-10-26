import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  Download,
  Eye,
  Trash2,
  File,
  FileText,
  Image,
  ExternalLink,
  Share2,
  Globe,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  CheckCircle2,
  Lock,
  AlertCircle,
  Database,
  CloudUpload,
  RefreshCw,
  Info,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import { useAuth } from '../contexts/AuthContext';
import styles from './DocumentsPage.module.css';

export const DocumentsPage = () => {
  const { t } = useTranslation();
  const { requireAuth } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(true);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('manual');
  const [uploading, setUploading] = useState(false);

  // DataHub upload options (default: empty project_id, folder_id f-rd63m6, pii checked)
  const [uploadToDatahub, setUploadToDatahub] = useState(false);
  const [datahubProjectId, setDatahubProjectId] = useState('');
  const [datahubFolderId, setDatahubFolderId] = useState('f-rd63m6');
  const [datahubDescription, setDatahubDescription] = useState('');
  const [datahubTags, setDatahubTags] = useState('');
  const [datahubOcr, setDatahubOcr] = useState(false);
  const [datahubPii, setDatahubPii] = useState(true);
  const [datahubParsing, setDatahubParsing] = useState(true);
  const [datahubOverwrite, setDatahubOverwrite] = useState(true);
  const [syncingDatahubId, setSyncingDatahubId] = useState(null);
  const [datahubDetailModal, setDatahubDetailModal] = useState(null);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewMode, setPreviewMode] = useState('local'); // 'local' | 'datahub'
  const [datahubViewLoading, setDatahubViewLoading] = useState(false);
  const [datahubViewData, setDatahubViewData] = useState(null);
  const [datahubViewError, setDatahubViewError] = useState(null);

  const fetchDataHubView = async (docId) => {
    setDatahubViewLoading(true);
    setDatahubViewError(null);
    try {
      const res = await api.get(`/documents/${docId}/datahub-view`);
      setDatahubViewData(res.data);
    } catch (err) {
      setDatahubViewError(err?.response?.data?.message || err?.message || 'Gagal memuat konten dari DataHub API');
    } finally {
      setDatahubViewLoading(false);
    }
  };

  const handleOpenPreview = (doc) => {
    setPreviewDoc(doc);
    setDatahubViewData(null);
    setDatahubViewError(null);
    if (doc?.datahub_error?.includes('DRM_ENCRYPTED_FILE') && doc?.datahub_object_id) {
      setPreviewMode('datahub');
      fetchDataHubView(doc.id);
    } else {
      setPreviewMode('local');
    }
  };

  // Share modal state
  const [shareDoc, setShareDoc] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [existingShare, setExistingShare] = useState(null);
  const [shareForm, setShareForm] = useState({
    access_rule: 'public', // 'public' | 'login_required' | 'password'
    password: '',
    allow_download: true,
    expires_in_days: 0,
  });
  const [savingShare, setSavingShare] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  const getDocUrl = (id, action = 'preview') => {
    const token = localStorage.getItem('pe_portal_token');
    const base = `/api/v1/documents/${id}/${action}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents', {
        params: { file_type: fileType || undefined },
      });
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [fileType]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title || selectedFile.name);
    formData.append('category', category);

    if (uploadToDatahub) {
      formData.append('upload_to_datahub', 'true');
      if (datahubProjectId) formData.append('datahub_project_id', datahubProjectId);
      if (datahubFolderId) formData.append('datahub_folder_id', datahubFolderId);
      if (datahubDescription) formData.append('datahub_description', datahubDescription);
      if (datahubTags) formData.append('datahub_tags', datahubTags);
      formData.append('datahub_ocr', datahubOcr ? 'true' : 'false');
      formData.append('datahub_pii', datahubPii ? 'true' : 'false');
      formData.append('datahub_parsing', datahubParsing ? 'true' : 'false');
      formData.append('datahub_overwrite', datahubOverwrite ? 'true' : 'false');
    }

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments((prev) => [res.data, ...prev]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setTitle('');
      setDatahubProjectId('');
      setDatahubFolderId('f-rd63m6');
      setDatahubDescription('');
      setDatahubTags('');
      setDatahubPii(true);
      setDatahubParsing(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSyncDatahub = async (doc) => {
    setSyncingDatahubId(doc.id);
    try {
      const res = await api.post(`/documents/${doc.id}/datahub-sync`);
      const updated = res.data?.document || res.data;
      if (updated && updated.id) {
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      }
      if (res.data?.success) {
        alert('Berhasil disinkronkan ke Samsung DataHub!');
      } else {
        alert(res.data?.message || 'Gagal sinkronisasi ke DataHub (server intranet tidak dapat dijangkau dari lingkungan saat ini).');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'DataHub sync failed');
    } finally {
      setSyncingDatahubId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this archived document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleOpenShare = async (doc) => {
    setShareDoc(doc);
    setShareLoading(true);
    setShareError('');
    setCopied(false);
    try {
      const res = await api.get(`/documents/${doc.id}/share`);
      if (res.data?.share) {
        const s = res.data.share;
        setExistingShare(s);
        setShareForm({
          access_rule: s.access_rule || 'public',
          password: s.plain_password || '',
          allow_download: s.allow_download !== false,
          expires_in_days: 0,
        });
      } else {
        setExistingShare(null);
        setShareForm({
          access_rule: 'public',
          password: '',
          allow_download: true,
          expires_in_days: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load share settings:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleSaveShare = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!shareDoc) return;
    if (shareForm.access_rule === 'password' && !shareForm.password.trim() && !existingShare?.plain_password) {
      setShareError('Harap tentukan kata sandi untuk rule Locked with Password.');
      return;
    }

    setSavingShare(true);
    setShareError('');
    try {
      const payload = {
        access_rule: shareForm.access_rule,
        password: shareForm.password,
        allow_download: shareForm.allow_download,
        expires_in_days: parseInt(shareForm.expires_in_days, 10) || 0,
      };
      const res = await api.post(`/documents/${shareDoc.id}/share`, payload);
      setExistingShare(res.data);
    } catch (err) {
      setShareError(err.response?.data?.message || 'Gagal menyimpan pengaturan link sharing.');
    } finally {
      setSavingShare(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!shareDoc || !window.confirm('Nonaktifkan tautan sharing untuk dokumen ini? Link tidak akan bisa diakses lagi.')) return;
    try {
      await api.delete(`/documents/${shareDoc.id}/share`);
      setExistingShare(null);
      setShareForm({
        access_rule: 'public',
        password: '',
        allow_download: true,
        expires_in_days: 0,
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menonaktifkan sharing.');
    }
  };

  const handleCopyShareLink = () => {
    if (!existingShare?.share_token) return;
    const url = `${window.location.origin}/share/${existingShare.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const columns = [
    {
      title: t('documents.col_file_title', 'File & Title'),
      key: 'title',
      render: (val, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--color-accent)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{val}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {row.file_name} ({formatFileSize(row.file_size)})
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('documents.col_format', 'Format'),
      key: 'file_type',
      render: (val) => (
        <span style={{
          textTransform: 'uppercase',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
        }}>
          {val}
        </span>
      ),
    },
    {
      title: t('documents.col_category', 'Category'),
      key: 'category',
      render: (val) => <span>{val || 'General'}</span>,
    },
    {
      title: t('documents.col_uploader', 'Uploader'),
      key: 'uploader_name',
      render: (val) => <span>{val || 'Engineer'}</span>,
    },
    {
      title: t('documents.col_uploaded_at', 'Uploaded At'),
      key: 'created_at',
      render: (val) => <span>{new Date(val).toLocaleDateString()}</span>,
    },
    {
      title: 'DataHub',
      key: 'datahub_status',
      render: (val, row) => {
        const status = val || 'skipped';
        const isSyncing = syncingDatahubId === row.id;

        if (status === 'synced') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  cursor: 'pointer',
                }}
                onClick={() => setDatahubDetailModal(row)}
                title={row.datahub_synced_at ? `Synced: ${new Date(row.datahub_synced_at).toLocaleString()}` : 'Synced'}
              >
                <CheckCircle2 size={12} /> Synced
              </span>
            </div>
          );
        }

        if (status === 'failed') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  cursor: 'pointer',
                }}
                onClick={() => setDatahubDetailModal(row)}
                title={row.datahub_error || 'Gagal tersambung (Server intranet tidak terjangkau)'}
              >
                <AlertCircle size={12} /> Intranet Offline
              </span>
              <button
                type="button"
                onClick={() => handleSyncDatahub(row)}
                disabled={isSyncing}
                title="Sync / Retry ke DataHub"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  color: 'var(--color-accent)',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={13} className={isSyncing ? styles.spinAnimation : ''} />
              </button>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              Local Only
            </span>
            <button
              type="button"
              onClick={() => handleSyncDatahub(row)}
              disabled={isSyncing}
              title="Upload / Sync ke DataHub"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-secondary)',
                padding: '3px 5px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {isSyncing ? <RefreshCw size={13} className={styles.spinAnimation} /> : <CloudUpload size={13} />}
            </button>
          </div>
        );
      },
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'id',
      render: (val, row) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenPreview(row)}
            title={t('documents.preview_file', 'Preview file')}
          >
            <Eye size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenShare(row)}
            title={t('documents.share_link', 'Bagikan Tautan (Share link)')}
          >
            <Share2 size={14} color="var(--color-accent)" />
          </Button>
          <a
            href={getDocUrl(val, 'download')}
            target="_blank"
            rel="noreferrer"
            download
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0 6px', color: 'var(--color-accent)' }}
            title={t('documents.download_file', 'Download file')}
          >
            <Download size={14} />
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(val)}
            title={t('documents.delete_file', 'Delete file')}
          >
            <Trash2 size={14} color="var(--color-error)" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('nav.documents')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('documents.subtitle', 'Centralized engineering archive with in-browser view-only support')}
          </p>
        </div>
        <Button variant="primary" icon={Upload} onClick={() => requireAuth('Upload Dokumen') && setIsUploadOpen(true)}>
          {t('documents.upload_btn', 'Upload File')}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {[
          { key: '', label: 'All Files' },
          { key: 'pdf', label: 'PDF' },
          { key: 'docx', label: 'DOCX' },
          { key: 'xlsx', label: 'XLSX' },
          { key: 'pptx', label: 'PPTX' },
          { key: 'csv', label: 'CSV' },
          { key: 'txt', label: 'TXT / Code' },
          { key: 'img', label: 'Images' },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={fileType === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFileType(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Loading documents archive..." />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents uploaded"
          description="Upload technical SOPs, BOM spreadsheets, JIG schematics, or inspection reports."
          actionLabel="Upload First File"
          onAction={() => requireAuth('Upload Dokumen') && setIsUploadOpen(true)}
        />
      ) : (
        <Table columns={columns} data={documents} />
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Archive Document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsUploadOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={uploading} onClick={handleUpload}>
              Upload File
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Choose File
            </label>
            <input
              type="file"
              required
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setSelectedFile(f);
                  if (!title) setTitle(f.name);
                }
              }}
              style={{
                padding: '8px',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-primary)',
              }}
            />
          </div>

          <Input
            label="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Custom title or leave default filename"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Document Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="manual">Working Instruction / SOP</option>
              <option value="bom">Bill of Materials (BOM)</option>
              <option value="drawing">JIG / Mecha Drawing</option>
              <option value="report">Quality & Failure Analysis</option>
              <option value="other">General Archive</option>
            </select>
          </div>

          {/* Samsung DataHub Integration Section */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: uploadToDatahub
                ? '1px solid rgba(59, 130, 246, 0.45)'
                : '1px solid var(--color-border)',
              backgroundColor: uploadToDatahub
                ? 'rgba(59, 130, 246, 0.04)'
                : 'var(--color-bg-primary)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: uploadToDatahub ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: uploadToDatahub ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  <Database size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Upload ke Samsung DataHub
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Enterprise BigData NDH Ingest (API v3)
                  </div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={uploadToDatahub}
                  onChange={(e) => setUploadToDatahub(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: uploadToDatahub ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {uploadToDatahub ? 'Aktif' : 'Lewati (Local Only)'}
                </span>
              </label>
            </div>

            {uploadToDatahub && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Input
                    label="Project ID (Opsional)"
                    value={datahubProjectId}
                    onChange={(e) => setDatahubProjectId(e.target.value)}
                    placeholder="Contoh: PE_PORTAL"
                  />
                  <Input
                    label="Folder ID"
                    value={datahubFolderId}
                    onChange={(e) => setDatahubFolderId(e.target.value)}
                    placeholder="f-rd63m6"
                  />
                </div>

                <Input
                  label="Description (Opsional, max 200)"
                  value={datahubDescription}
                  onChange={(e) => setDatahubDescription(e.target.value)}
                  placeholder="Keterangan singkat objek berkas di DataHub"
                  maxLength={200}
                />

                <Input
                  label="Tags (Opsional, pisahkan koma)"
                  value={datahubTags}
                  onChange={(e) => setDatahubTags(e.target.value)}
                  placeholder="Contoh: SOP, PE, 2026"
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={datahubOcr}
                      onChange={(e) => setDatahubOcr(e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span>OCR Enabled</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={datahubPii}
                      onChange={(e) => setDatahubPii(e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span>PII Tagging</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={datahubParsing}
                      onChange={(e) => setDatahubParsing(e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span>Parsing (Parser Aktif)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={datahubOverwrite}
                      onChange={(e) => setDatahubOverwrite(e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span>Overwrite jika ada</span>
                  </label>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    lineHeight: '1.4',
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-accent)' }} />
                  <div>
                    <div>Endpoint DataHub berada di intranet Samsung.</div>
                    <div style={{ marginTop: '2px', color: '#f59e0b', fontWeight: 500 }}>
                      * Catatan DRM: Berkas tidak boleh terenkripsi DRM korporat (Fasoo DRM). Jika berkas diproteksi DRM, silakan Decrypt terlebih dahulu sebelum diunggah.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* DataHub Detail & Retry Modal */}
      <Modal
        isOpen={Boolean(datahubDetailModal)}
        onClose={() => setDatahubDetailModal(null)}
        title="Status Samsung DataHub Ingest"
        maxWidth="540px"
      >
        {datahubDetailModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: datahubDetailModal.datahub_status === 'synced' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: datahubDetailModal.datahub_status === 'synced' ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {datahubDetailModal.datahub_status === 'synced' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{datahubDetailModal.title}</h4>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {datahubDetailModal.file_name}
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12.5px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  {datahubDetailModal.datahub_status || 'skipped'}
                </span>
              </div>
              {datahubDetailModal.datahub_object_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>DataHub Object ID:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{datahubDetailModal.datahub_object_id}</span>
                </div>
              )}
              {datahubDetailModal.datahub_synced_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Waktu Sinkronisasi:</span>
                  <span>{new Date(datahubDetailModal.datahub_synced_at).toLocaleString()}</span>
                </div>
              )}
              {datahubDetailModal.datahub_error && (
                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ color: '#ef4444', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Log Detail / Network Response:</span>
                  <div style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--color-bg-primary)',
                    padding: '8px',
                    borderRadius: '4px',
                    color: 'var(--color-text-primary)',
                    wordBreak: 'break-all',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}>
                    {datahubDetailModal.datahub_error}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setDatahubDetailModal(null)}>
                Tutup
              </Button>
              <Button
                variant="primary"
                icon={RefreshCw}
                loading={syncingDatahubId === datahubDetailModal.id}
                onClick={async () => {
                  const doc = datahubDetailModal;
                  await handleSyncDatahub(doc);
                  setDatahubDetailModal(null);
                }}
              >
                Sinkronkan ke DataHub Sekarang
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* In-Browser View-Only Preview Modal */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={`Preview: ${previewDoc?.title || ''}`}
        maxWidth="950px"
      >
        {previewDoc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header Tab Switcher (Local Viewer vs DataHub Reader) */}
            {previewDoc.datahub_object_id && (
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('local')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    backgroundColor: previewMode === 'local' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                    color: previewMode === 'local' ? '#ffffff' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📄 File Lokal / PDF Standar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewMode('datahub');
                    if (!datahubViewData) fetchDataHubView(previewDoc.id);
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    backgroundColor: previewMode === 'datahub' ? '#2563eb' : 'var(--color-bg-tertiary)',
                    color: previewMode === 'datahub' ? '#ffffff' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ShieldCheck size={14} />
                  DataHub Reader (Bypass DRM NASCA)
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    Synced
                  </span>
                </button>
              </div>
            )}

            {/* DRM Encrypted Notice if in local mode */}
            {previewMode === 'local' && previewDoc.datahub_error && previewDoc.datahub_error.includes('DRM_ENCRYPTED_FILE') && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#d97706',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>Dokumen ini terdeteksi memiliki enkripsi Samsung DRM (Fasoo/NASCA). Pratinjau lokal mungkin tidak dapat dibuka.</span>
                </div>
                {previewDoc.datahub_object_id && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      setPreviewMode('datahub');
                      if (!datahubViewData) fetchDataHubView(previewDoc.id);
                    }}
                  >
                    Buka via DataHub Reader
                  </Button>
                )}
              </div>
            )}

            {previewMode === 'datahub' ? (
              /* ========================================================================= */
              /* DATAHUB READER (BYPASS DRM NASCA)                                         */
              /* ========================================================================= */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '450px' }}>
                {datahubViewLoading ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <LoadingState message="Menghubungi Samsung DataHub API untuk memuat metadata & isi berkas..." />
                  </div>
                ) : datahubViewError ? (
                  <div style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    textAlign: 'center',
                  }}>
                    <AlertCircle size={32} color="#ef4444" style={{ margin: '0 auto 10px' }} />
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#ef4444' }}>Gagal Memuat Data dari DataHub</h4>
                    <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                      {datahubViewError}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => fetchDataHubView(previewDoc.id)}>
                        Coba Lagi
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={ExternalLink}
                        onClick={() => window.open(datahubViewData?.portal_url || 'https://datahub.bigdata.samsung.com/', '_blank')}
                      >
                        Buka di Portal DataHub
                      </Button>
                    </div>
                  </div>
                ) : datahubViewData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Status & Object Header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '10px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      fontSize: '12px',
                    }}>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '2px' }}>Object ID DataHub</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>
                          {datahubViewData.object_id}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '2px' }}>Status Ingest / Parsing</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}>
                            {String(datahubViewData.object?.status || datahubViewData.object?.parse_status || 'CREATED')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '2px' }}>Nama File Remote</div>
                        <div style={{ fontWeight: 600 }}>
                          {String(datahubViewData.object?.name || datahubViewData.object?.title || previewDoc.file_name)}
                        </div>
                      </div>
                    </div>

                    {/* Extracted Text Content Box */}
                    <div style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-primary)',
                      padding: '16px',
                      maxHeight: '480px',
                      overflowY: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={14} color="#2563eb" />
                          Konten Teks & Ekstraksi DataHub AI
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Bypass enkripsi NASCA client-side
                        </span>
                      </div>

                      {datahubViewData.object?.content || datahubViewData.object?.parsed_content || datahubViewData.object?.text ? (
                        <div style={{
                          fontSize: '12.5px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                          color: 'var(--color-text-primary)',
                        }}>
                          {String(datahubViewData.object.content || datahubViewData.object.parsed_content || datahubViewData.object.text)}
                        </div>
                      ) : datahubViewData.object?.raw_text ? (
                        <div style={{
                          fontSize: '12px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          color: 'var(--color-text-primary)',
                        }}>
                          {datahubViewData.object.raw_text}
                        </div>
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          <Database size={36} style={{ margin: '0 auto 8px', color: 'var(--color-accent)' }} />
                          <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            Dokumen Tersimpan di Samsung DataHub
                          </p>
                          <p style={{ margin: '0 auto 14px', maxWidth: '480px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            Berkas telah terdaftar di DataHub dengan ID <code>{datahubViewData.object_id}</code>. Status parsing: {String(datahubViewData.object?.parse_status || 'PENDING')}. Anda dapat melihat pratinjau penuh langsung di platform DataHub resmi.
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={ExternalLink}
                            onClick={() => window.open(datahubViewData.portal_url || 'https://datahub.bigdata.samsung.com/', '_blank')}
                          >
                            Buka di Web DataHub Samsung
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Button variant="primary" size="sm" icon={ShieldCheck} onClick={() => fetchDataHubView(previewDoc.id)}>
                      Muat Isi Dokumen dari DataHub
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* LOCAL STANDARD VIEWER (PDF / IMG / OFFICE)                                */
              /* ========================================================================= */
              <>
                {previewDoc.file_type === 'img' ? (
                  <img
                    src={getDocUrl(previewDoc.id, 'preview')}
                    alt={previewDoc.title}
                    style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', margin: '0 auto', borderRadius: 'var(--radius-sm)' }}
                  />
                ) : previewDoc.file_type === 'pdf' ? (
                  <iframe
                    src={getDocUrl(previewDoc.id, 'preview')}
                    title={previewDoc.title}
                    style={{
                      width: '100%',
                      height: '600px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#ffffff',
                    }}
                  />
                ) : previewDoc.file_type === 'txt' ? (
                  <iframe
                    src={getDocUrl(previewDoc.id, 'preview')}
                    title={previewDoc.title}
                    style={{
                      width: '100%',
                      height: '500px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-primary)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: '28px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <FileText size={48} color="var(--color-accent)" />
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '16px' }}>{previewDoc.title}</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        Format <strong>{previewDoc.file_type?.toUpperCase()}</strong> ({formatFileSize(previewDoc.file_size)})
                      </p>
                    </div>
                    <p style={{ maxWidth: '440px', fontSize: '12.5px', color: 'var(--color-text-muted)', margin: 0 }}>
                      Format dokumen ini (office/spreadsheet) disarankan untuk dibuka melalui tab baru atau diunduh langsung untuk melihat konten penuh.
                    </p>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div>
                {previewDoc.datahub_object_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Database}
                    onClick={() => window.open(datahubViewData?.portal_url || 'https://datahub.bigdata.samsung.com/', '_blank')}
                    title="Buka langsung di Web Portal Samsung DataHub"
                  >
                    Buka di Samsung DataHub
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Share2}
                  onClick={() => handleOpenShare(previewDoc)}
                >
                  Bagikan Link
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => window.open(getDocUrl(previewDoc.id, 'preview'), '_blank')}
                >
                  Buka di Tab Baru
                </Button>
                <a
                  href={getDocUrl(previewDoc.id, 'download')}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Download size={14} /> Download Original File
                </a>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Share Document Modal */}
      <Modal
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        title={t('documents.share_modal_title', 'Bagikan Dokumen (Share File)')}
        maxWidth="640px"
      >
        {shareDoc && (
          <div>
            {/* Document Header Brief */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              marginBottom: '18px',
            }}>
              <FileText size={24} color="var(--color-accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shareDoc.title}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {shareDoc.file_name} • {formatFileSize(shareDoc.file_size)} • {shareDoc.file_type?.toUpperCase()}
                </div>
              </div>
            </div>

            {/* If link already generated, show the active link box */}
            {existingShare?.share_token && (
              <div className={styles.linkResultBox}>
                <div className={styles.linkHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} />
                    <span>{t('documents.active_link', 'Link Sharing Aktif')}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {existingShare.access_rule === 'public' && t('documents.rule_public_title', 'Open Public')}
                    {existingShare.access_rule === 'login_required' && t('documents.rule_login_title', 'Login Required')}
                    {existingShare.access_rule === 'password' && t('documents.rule_password_title', 'Locked with Password')}
                  </span>
                </div>
                <div className={styles.linkInputRow}>
                  <input
                    type="text"
                    readOnly
                    className={styles.linkInput}
                    value={`${window.location.origin}/share/${existingShare.share_token}`}
                  />
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={handleCopyShareLink}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? t('documents.link_copied', 'Tersalin!') : t('documents.copy_link_btn', 'Salin Link')}</span>
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => window.open(`/share/${existingShare.share_token}`, '_blank')}
                    title="Buka link di tab baru"
                  />
                </div>
                <div className={styles.linkStats}>
                  <span>{t('documents.views_count', 'Dilihat')}: <strong>{existingShare.view_count || 0}x</strong></span>
                  <span>{t('documents.downloads_count', 'Diunduh')}: <strong>{existingShare.download_count || 0}x</strong></span>
                  {existingShare.expires_at ? (
                    <span>{t('documents.expires', 'Kedaluwarsa')}: {new Date(existingShare.expires_at).toLocaleDateString()}</span>
                  ) : (
                    <span>{t('documents.active_duration', 'Masa Aktif')}: {t('documents.expiry_forever', 'Selamanya')}</span>
                  )}
                </div>
              </div>
            )}

            {shareError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: '12.5px',
                marginBottom: '16px',
              }}>
                <AlertCircle size={15} />
                <span>{shareError}</span>
              </div>
            )}

            {/* Custom Rule Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                {t('documents.rule_title', 'Pilih Aturan Akses Sharing (Custom Rule)')}
              </label>
              <div className={styles.ruleCardGroup}>
                {/* 1. Open Public */}
                <div
                  className={`${styles.ruleCard} ${shareForm.access_rule === 'public' ? styles.ruleCardActive : ''}`}
                  onClick={() => setShareForm({ ...shareForm, access_rule: 'public' })}
                >
                  <div className={styles.ruleIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                    <Globe size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.ruleCardTitle}>
                      <span>{t('documents.rule_public_title', 'Open Public')}</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        {t('documents.rule_public_tag', 'Tanpa Login')}
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      {t('documents.rule_public_desc', 'Siapa pun yang memiliki tautan dapat membuka dan mengunduh berkas secara langsung tanpa perlu login.')}
                    </p>
                  </div>
                </div>

                {/* 2. Login Required */}
                <div
                  className={`${styles.ruleCard} ${shareForm.access_rule === 'login_required' ? styles.ruleCardActive : ''}`}
                  onClick={() => setShareForm({ ...shareForm, access_rule: 'login_required' })}
                >
                  <div className={styles.ruleIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.ruleCardTitle}>
                      <span>{t('documents.rule_login_title', 'Login Required')}</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        {t('documents.rule_login_tag', 'Khusus Internal')}
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      {t('documents.rule_login_desc', 'Hanya pengguna yang telah terdaftar dan login ke PE-Portal yang diizinkan untuk melihat & mengunduh dokumen.')}
                    </p>
                  </div>
                </div>

                {/* 3. Locked with Password */}
                <div
                  className={`${styles.ruleCard} ${shareForm.access_rule === 'password' ? styles.ruleCardActive : ''}`}
                  onClick={() => setShareForm({ ...shareForm, access_rule: 'password' })}
                >
                  <div className={styles.ruleIcon} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                    <KeyRound size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.ruleCardTitle}>
                      <span>{t('documents.rule_password_title', 'Locked with Password')}</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        {t('documents.rule_password_tag', 'Kata Sandi')}
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      {t('documents.rule_password_desc', 'Pengunjung wajib memasukkan kata sandi yang telah ditentukan sebelum dapat mengakses dokumen.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Password input when locked with password */}
            {shareForm.access_rule === 'password' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.04)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                marginBottom: '16px',
              }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: '#f59e0b' }}>
                  {t('documents.input_password_label', 'Kata Sandi Akses File')}
                </label>
                <Input
                  type="text"
                  placeholder={t('documents.input_password_placeholder', 'Contoh: PE-2026 atau sein123')}
                  value={shareForm.password}
                  onChange={(e) => setShareForm({ ...shareForm, password: e.target.value })}
                />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {existingShare?.access_rule === 'password' && !shareForm.password ? 'Biarkan kosong untuk mempertahankan password lama.' : 'Pengunjung wajib memasukkan password ini untuk membuka tautan.'}
                </div>
              </div>
            )}

            {/* Additional options: download & expiry */}
            <div className={styles.optionSection}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={shareForm.allow_download}
                  onChange={(e) => setShareForm({ ...shareForm, allow_download: e.target.checked })}
                />
                <span>{t('documents.allow_download_label', 'Izinkan Pengunjung Mengunduh File Asli')}</span>
              </label>

              <div className={styles.selectGroup}>
                <label>{t('documents.expiry_label', 'Masa Berlaku Tautan:')}</label>
                <select
                  className={styles.customSelect}
                  value={shareForm.expires_in_days}
                  onChange={(e) => setShareForm({ ...shareForm, expires_in_days: Number(e.target.value) })}
                >
                  <option value={0}>{t('documents.expiry_forever', 'Selamanya (Tanpa Batas)')}</option>
                  <option value={1}>{t('documents.expiry_1day', '1 Hari')}</option>
                  <option value={7}>{t('documents.expiry_7days', '7 Hari (1 Minggu)')}</option>
                  <option value={30}>{t('documents.expiry_30days', '30 Hari (1 Bulan)')}</option>
                </select>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <div>
                {existingShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevokeShare}
                    style={{ color: 'var(--color-error)' }}
                  >
                    {t('documents.btn_revoke_share', 'Nonaktifkan Link')}
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setShareDoc(null)}>
                  {t('common.cancel', 'Batal')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveShare}
                  disabled={savingShare}
                >
                  {savingShare ? t('common.loading', 'Menyimpan...') : existingShare ? t('documents.btn_update_share', 'Perbarui Link Sharing') : t('documents.btn_create_share', 'Buat Link Sharing')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
