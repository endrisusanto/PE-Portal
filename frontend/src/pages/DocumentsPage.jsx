import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Eye, Trash2, File, FileText, Image, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';

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
    </div>
  );
};
