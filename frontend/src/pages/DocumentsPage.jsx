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
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';
import styles from './DocumentsPage.module.css';

export const DocumentsPage = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(true);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('manual');
  const [uploading, setUploading] = useState(false);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);

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

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments((prev) => [res.data, ...prev]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setTitle('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
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
      title: 'File & Title',
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
      title: 'Format',
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
      title: 'Category',
      key: 'category',
      render: (val) => <span>{val || 'General'}</span>,
    },
    {
      title: 'Uploader',
      key: 'uploader_name',
      render: (val) => <span>{val || 'Engineer'}</span>,
    },
    {
      title: 'Uploaded At',
      key: 'created_at',
      render: (val) => <span>{new Date(val).toLocaleDateString()}</span>,
    },
    {
      title: 'Actions',
      key: 'id',
      render: (val, row) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewDoc(row)}
            title="Preview file"
          >
            <Eye size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenShare(row)}
            title="Bagikan Tautan (Share link)"
          >
            <Share2 size={14} color="var(--color-accent)" />
          </Button>
          <a
            href={getDocUrl(val, 'download')}
            target="_blank"
            rel="noreferrer"
            download
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0 6px', color: 'var(--color-accent)' }}
            title="Download file"
          >
            <Download size={14} />
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(val)}
            title="Delete file"
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
            Centralized engineering archive with in-browser view-only support
          </p>
        </div>
        <Button variant="primary" icon={Upload} onClick={() => setIsUploadOpen(true)}>
          Upload File
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
          onAction={() => setIsUploadOpen(true)}
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
        </form>
      </Modal>

      {/* In-Browser View-Only Preview Modal */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={`Preview: ${previewDoc?.title || ''}`}
        maxWidth="950px"
      >
        {previewDoc && (
          <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            ) : (
              <div
                style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
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
        )}
      </Modal>

      {/* Share Document Modal */}
      <Modal
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        title="Bagikan Dokumen (Share File)"
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
                    <span>Link Sharing Aktif</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {existingShare.access_rule === 'public' && 'Open Public'}
                    {existingShare.access_rule === 'login_required' && 'Login Required'}
                    {existingShare.access_rule === 'password' && 'Password Protected'}
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
                    <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
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
                  <span>Dilihat: <strong>{existingShare.view_count || 0}x</strong></span>
                  <span>Diunduh: <strong>{existingShare.download_count || 0}x</strong></span>
                  {existingShare.expires_at ? (
                    <span>Kedaluwarsa: {new Date(existingShare.expires_at).toLocaleDateString()}</span>
                  ) : (
                    <span>Masa Aktif: Selamanya</span>
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
                Pilih Aturan Akses Sharing (Custom Rule)
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
                      <span>Open Public</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        Tanpa Login
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      Siapa pun yang memiliki tautan dapat membuka dan mengunduh berkas secara langsung tanpa perlu login.
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
                      <span>Login Required</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        Khusus Internal
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      Hanya pengguna yang telah terdaftar dan login ke PE-Portal yang diizinkan untuk melihat & mengunduh dokumen.
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
                      <span>Locked with Password</span>
                      <span className={styles.ruleTag} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        Kata Sandi
                      </span>
                    </div>
                    <p className={styles.ruleCardDesc}>
                      Pengunjung wajib memasukkan kata sandi yang telah ditentukan sebelum dapat mengakses dokumen.
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
                  Kata Sandi Akses File
                </label>
                <Input
                  type="text"
                  placeholder="Contoh: PE-2026 atau sein123"
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
                <span>Izinkan Pengunjung Mengunduh File Asli</span>
              </label>

              <div className={styles.selectGroup}>
                <label>Masa Berlaku Tautan:</label>
                <select
                  className={styles.customSelect}
                  value={shareForm.expires_in_days}
                  onChange={(e) => setShareForm({ ...shareForm, expires_in_days: Number(e.target.value) })}
                >
                  <option value={0}>Selamanya (Tanpa Batas)</option>
                  <option value={1}>1 Hari</option>
                  <option value={7}>7 Hari (1 Minggu)</option>
                  <option value={30}>30 Hari (1 Bulan)</option>
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
                    Nonaktifkan Link
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setShareDoc(null)}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveShare}
                  disabled={savingShare}
                >
                  {savingShare ? 'Menyimpan...' : existingShare ? 'Perbarui Link Sharing' : 'Buat Link Sharing'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
