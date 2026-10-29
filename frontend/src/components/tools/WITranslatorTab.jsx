import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Play,
  CheckSquare,
  Square,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Languages,
  Zap,
  ChevronDown,
  ChevronUp,
  FileDown,
} from 'lucide-react';
import api from '../../api/client';
import { Button } from '../common/Button';
import styles from '../../pages/UtilityPage.module.css';

export const WITranslatorTab = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetLang, setTargetLang] = useState('id');
  const [mode, setMode] = useState('replace');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'processing', 'completed', 'pending', 'failed'
  const [isDropzoneExpanded, setIsDropzoneExpanded] = useState(true);
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/utility/wi-translator/jobs');
      const data = res.data || [];
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch WI jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Initial fetch and auto-polling when there are processing or pending jobs
  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (j) => j.status === 'processing' || j.status === 'pending'
    );

    if (hasActiveJobs) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchJobs();
        }, 2500);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobs]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const uploadFiles = async (filesList) => {
    const pdfFiles = filesList.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      setErrorMsg(t('tools.wi_error_pdf_only', 'Hanya berkas format .pdf yang didukung.'));
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      pdfFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('target_lang', targetLang);
      formData.append('mode', mode);

      await api.post('/utility/wi-translator/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchJobs();
      // ponytail: collapse dropzone and expand table queue automatically after picking files
      setIsDropzoneExpanded(false);
      setIsTableExpanded(true);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal mengunggah berkas PDF.');
    } finally {
      setUploading(false);
    }
  };

  // Toggle selection
  const toggleSelectJob = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredJobs = useMemo(() => {
    if (filterStatus === 'all') return jobs;
    return jobs.filter((j) => j.status === filterStatus);
  }, [jobs, filterStatus]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredJobs.length && filteredJobs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJobs.map((j) => j.id)));
    }
  };

  // Bulk actions
  const handleExecuteSelected = async () => {
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) return;

    setExecuting(true);
    setErrorMsg(null);
    try {
      await api.post('/utility/wi-translator/jobs/execute', { job_ids: targetIds });
      setSelectedIds(new Set());
      await fetchJobs();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal memulai pemrosesan antrean.');
    } finally {
      setExecuting(false);
    }
  };

  const handleExecuteSingle = async (jobId) => {
    setErrorMsg(null);
    try {
      await api.post('/utility/wi-translator/jobs/execute', { job_ids: [jobId] });
      await fetchJobs();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal memulai pemrosesan.');
    }
  };

  const handleDeleteSingle = async (jobId) => {
    try {
      await api.delete(`/utility/wi-translator/jobs/${jobId}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      await fetchJobs();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal menghapus berkas.');
    }
  };

  const handleDeleteSelected = async () => {
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) return;

    try {
      await api.post('/utility/wi-translator/jobs/delete-batch', { job_ids: targetIds });
      setSelectedIds(new Set());
      await fetchJobs();
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Gagal menghapus berkas terpilih.');
    }
  };

  // ponytail: robust authenticated blob download avoiding double baseURL & unescaping issues
  const handleDownloadJob = async (j) => {
    const filename = j.translated_file || 'Translated_WI.pdf';
    let rawPath = j.download_url || `/utility/translate-wi-pdf/download/${encodeURIComponent(filename)}`;
    // Strip leading /api/v1 because api client automatically prefixes baseURL
    const endpoint = rawPath.replace(/^\/api\/v1/, '');

    try {
      const resp = await api.get(endpoint, { responseType: 'blob' });
      if (resp.data?.type && resp.data.type.includes('json')) {
        const text = await resp.data.text();
        try {
          const errJson = JSON.parse(text);
          setErrorMsg(`Gagal unduh PDF: ${errJson.message || 'Berkas tidak ditemukan'}`);
        } catch {
          setErrorMsg('Gagal unduh PDF: berkas tidak ditemukan di server.');
        }
        return;
      }
      // Trigger download
      const blob = resp.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download WI translated PDF error:', err);
      const msg = err.response?.data?.message || err.message || 'Berkas tidak ditemukan di server';
      setErrorMsg(`Gagal mengunduh file hasil terjemahan: ${msg}`);
    }
  };

  // ponytail: download original source PDF artifact from server
  const handleDownloadSource = async (j) => {
    try {
      const resp = await api.get(`/utility/wi-translator/jobs/${j.id}/source`, { responseType: 'blob' });
      if (resp.data?.type && resp.data.type.includes('json')) {
        const text = await resp.data.text();
        try {
          const errJson = JSON.parse(text);
          setErrorMsg(`Gagal unduh sumber: ${errJson.message || 'Berkas tidak ditemukan'}`);
        } catch {
          setErrorMsg('Gagal unduh berkas sumber original dari server.');
        }
        return;
      }
      const blob = resp.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', j.file_name || 'Original_Source.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download source error:', err);
      const msg = err.response?.data?.message || err.message || 'Berkas sumber tidak ditemukan di server';
      setErrorMsg(`Gagal mengunduh berkas sumber original: ${msg}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' +
        d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  // Status counters
  const counts = useMemo(() => {
    return {
      all: jobs.length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    };
  }, [jobs]);

  const hasExecutableSelection = useMemo(() => {
    return Array.from(selectedIds).some((id) => {
      const j = jobs.find((item) => item.id === id);
      return j && (j.status === 'pending' || j.status === 'failed');
    });
  }, [selectedIds, jobs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Notice */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: 'rgba(236, 72, 153, 0.08)',
        border: '1px solid rgba(236, 72, 153, 0.25)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
      }}>
        <Languages size={24} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-accent)' }}>
            {t('tools.wi_banner_title', 'Preservasi Tata Letak Presisi 100% dengan AI LLM untuk Working Instruction')}
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {t('tools.wi_banner_desc', 'Proses translasi istilah teknis dan instruksi kerja dilakukan secara cerdas oleh model AI LLM (didukung LLM lokal/korporat). Sistem memadukan teknik in-place vector mask overlay dengan Python ReportLab & pypdf. Gambar langkah kerja, garis tabel, dan diagram posisi tetap berada pada koordinat pixel aslinya tanpa pergeseran layout. Dokumen terenkripsi keamanan korporat (NASCA) didukung secara otomatis.')}
          </p>
        </div>
      </div>

      {/* Upload & Settings Accordion Card */}
      <div style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Accordion Header */}
        <div
          onClick={() => setIsDropzoneExpanded((prev) => !prev)}
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: isDropzoneExpanded ? '1px solid var(--color-border)' : 'none',
            userSelect: 'none',
            transition: 'background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={18} color="var(--color-accent)" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
              {t('tools.wi_upload_accordion_title', 'Area Unggah Berkas PDF (Multiple Dropzone)')}
            </span>
            {!isDropzoneExpanded && (
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                — {t('tools.wi_click_to_expand', 'Klik untuk membuka & menambah berkas')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
            }}>
              {isDropzoneExpanded ? 'Tutup Area Unggah' : 'Buka Area Unggah'}
            </span>
            <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
              {isDropzoneExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>

        {/* Accordion Body */}
        {isDropzoneExpanded && (
          <div style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            {/* Settings Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}>
              {/* Target Language */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('tools.wi_target_lang', 'Bahasa Tujuan Terjemahan')}
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  disabled={uploading}
                  className={styles.selectInput}
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="id">{t('tools.wi_lang_id', 'Bahasa Indonesia (ID) - Standar Operator Pabrik')}</option>
                  <option value="ko">{t('tools.wi_lang_ko', '한국어 (Korean - KO)')}</option>
                  <option value="en">{t('tools.wi_lang_en', 'English (EN)')}</option>
                </select>
              </div>

              {/* Translation Mode */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('tools.wi_mode_label', 'Mode Tampilan')}
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={uploading}
                  className={styles.selectInput}
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="replace">{t('tools.wi_mode_replace', 'Ganti Teks (Clean In-Place Replace) - Rekomendasi')}</option>
                  <option value="bilingual">{t('tools.wi_mode_bilingual', 'Bilingual (Teks Asli + Subtitle Terjemahan)')}</option>
                </select>
              </div>
            </div>

            {/* Multi-Dropzone */}
            <div
              className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '24px 20px',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                backgroundColor: dragActive ? 'rgba(236, 72, 153, 0.05)' : 'var(--color-bg-primary)',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(236, 72, 153, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-accent)',
                }}>
                  {uploading ? (
                    <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
                  ) : (
                    <Upload size={24} />
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--color-text-primary)' }}>
                    {uploading
                      ? t('tools.wi_uploading_files', 'Mengunggah berkas ke antrean server...')
                      : t('tools.wi_drop_multiple_title', 'Tarik & Lepaskan Multiple Berkas PDF Working Instruction ke sini')}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {t('tools.wi_drop_multiple_desc', 'Mendukung upload banyak berkas PDF sekaligus (hingga 40+ halaman per berkas). Kompatibel dengan keamanan NASCA Samsung.')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Table JobList Card */}
      <div style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Card Header & Filters */}
        <div style={{
          padding: '14px 20px',
          borderBottom: isTableExpanded ? '1px solid var(--color-border)' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div
            onClick={() => setIsTableExpanded((prev) => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {t('tools.wi_queue_title', 'Daftar Antrean Terjemahan Dokumen')}
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-accent)',
              color: '#ffffff',
            }}>
              {jobs.length} Berkas
            </span>
            <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
              {isTableExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filter buttons */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
            }}>
              {[
                { key: 'all', label: `Semua (${counts.all})` },
                { key: 'processing', label: `Memproses (${counts.processing})` },
                { key: 'pending', label: `Pending (${counts.pending})` },
                { key: 'completed', label: `Selesai (${counts.completed})` },
                { key: 'failed', label: `Gagal (${counts.failed})` },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setFilterStatus(btn.key)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: filterStatus === btn.key ? 'var(--color-accent)' : 'transparent',
                    color: filterStatus === btn.key ? '#ffffff' : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={fetchJobs}
              title={t('common.refresh', 'Segarkan Antrean')}
            />
          </div>
        </div>

        {isTableExpanded && (
          <>
            {/* Bulk Actions Toolbar (Visible when items selected) */}
        {selectedIds.size > 0 && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            borderBottom: '1px solid rgba(236, 72, 153, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>
              {selectedIds.size} {t('tools.wi_selected_count', 'berkas dipilih')}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="primary"
                size="sm"
                icon={Zap}
                disabled={executing || !hasExecutableSelection}
                onClick={handleExecuteSelected}
                style={{ fontWeight: 600 }}
              >
                {executing
                  ? t('tools.wi_executing', 'Mengantrikan...')
                  : t('tools.wi_bulk_translate', '⚡ Terjemahkan Terpilih')}
              </Button>

              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleDeleteSelected}
                style={{ fontWeight: 600 }}
              >
                {t('tools.wi_bulk_delete', 'Hapus Terpilih')}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                {t('common.cancel', 'Batal Pilih')}
              </Button>
            </div>
          </div>
        )}

        {/* Table of Jobs */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderBottom: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-secondary)' }}
                  >
                    {selectedIds.size === filteredJobs.length && filteredJobs.length > 0 ? (
                      <CheckSquare size={16} color="var(--color-accent)" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '12px 14px' }}>{t('tools.wi_col_file', 'Berkas PDF')}</th>
                <th style={{ padding: '12px 14px' }}>{t('tools.wi_col_config', 'Pengaturan')}</th>
                <th style={{ padding: '12px 14px' }}>{t('tools.wi_col_status', 'Status & Progres Aktual')}</th>
                <th style={{ padding: '12px 14px' }}>{t('tools.wi_col_time', 'Waktu')}</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>{t('tools.wi_col_action', 'Aksi')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingJobs ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px' }} />
                    <div>{t('common.loading', 'Memuat daftar antrean pekerjaan...')}</div>
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <FileText size={40} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      {t('tools.wi_no_jobs_title', 'Belum ada berkas dalam antrean')}
                    </div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      {t('tools.wi_no_jobs_desc', 'Tarik atau pilih berkas PDF Working Instruction di atas untuk menambahkan ke antrean.')}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                  const isSelected = selectedIds.has(j.id);
                  const isProcessing = j.status === 'processing';
                  const isCompleted = j.status === 'completed';
                  const isFailed = j.status === 'failed';
                  const isPending = j.status === 'pending';

                  return (
                    <tr
                      key={j.id}
                      className={`${styles.wiRow} ${isProcessing ? styles.wiRowProcessing : ''}`}
                      style={{
                        backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.05)' : undefined,
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleSelectJob(j.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} color="var(--color-accent)" />
                          ) : (
                            <Square size={16} color="var(--color-text-secondary)" />
                          )}
                        </button>
                      </td>

                      {/* File Info */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={20} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '300px',
                            }} title={j.file_name}>
                              {j.file_name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                              <span>{formatFileSize(j.file_size)}</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => handleDownloadSource(j)}
                                title="Unduh Berkas PDF Asli (Original Artifact)"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--color-accent)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <FileDown size={12} />
                                {t('tools.wi_source_artifact', 'Artifact Asli')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Config */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{
                            display: 'inline-flex',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-primary)',
                            width: 'fit-content',
                          }}>
                            {j.target_lang?.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {j.mode === 'bilingual' ? 'Bilingual' : 'In-Place Replace'}
                          </span>
                        </div>
                      </td>

                      {/* Status & Progress */}
                      <td style={{ padding: '14px', minWidth: '240px' }}>
                        {isProcessing && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: 'var(--color-accent)',
                              }}>
                                <RefreshCw size={12} style={{ animation: 'spin 1.2s linear infinite' }} />
                                {j.total_pages > 0
                                  ? `Hal ${j.current_page}/${j.total_pages}`
                                  : 'Mempersiapkan batch...'}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
                                {j.progress_percent || 0}%
                              </span>
                            </div>
                            <div className={styles.wiProgressBarContainer}>
                              <div
                                className={`${styles.wiProgressBarFill} ${styles.wiProgressBarFillProcessing}`}
                                style={{ width: `${Math.max(j.progress_percent || 0, 4)}%` }}
                              />
                            </div>
                            {j.message && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                {j.message}
                              </div>
                            )}
                          </div>
                        )}

                        {isCompleted && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={styles.wiBadgePop} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              width: 'fit-content',
                            }}>
                              <CheckCircle2 size={13} />
                              Selesai ({j.total_pages} Hal)
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {j.translated_count} Blok • {j.duration_sec}s
                            </span>
                          </div>
                        )}

                        {isPending && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            color: '#d97706',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            width: 'fit-content',
                          }}>
                            <span className={styles.wiPulseDot} />
                            Menunggu Antrean Server
                          </span>
                        )}

                        {isFailed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={styles.wiBadgePop} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              width: 'fit-content',
                            }}>
                              <AlertCircle size={13} />
                              Gagal
                            </span>
                            {j.error_message && (
                              <span style={{ fontSize: '11px', color: '#ef4444', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.error_message}>
                                {j.error_message}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '14px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                        {formatTime(j.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {/* Download Button if Completed */}
                          {isCompleted && (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Download}
                              className={styles.wiInteractiveBtn}
                              onClick={() => handleDownloadJob(j)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Unduh
                            </Button>
                          )}

                          {/* Start / Retry Button if Pending or Failed */}
                          {(isPending || isFailed) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Play}
                              className={styles.wiInteractiveBtn}
                              onClick={() => handleExecuteSingle(j.id)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                              title="Mulai Terjemahkan Berkas Ini"
                            >
                              Mulai
                            </Button>
                          )}

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteSingle(j.id)}
                            style={{ color: '#ef4444', padding: '5px 8px' }}
                            title="Hapus Dari Antrean"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>

      {/* Background Persistence Notice */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}>
        💡 <strong>Eksekusi Aman Latar Belakang (Server-Side Background Processing)</strong>: Seluruh proses penerjemahan dijalankan secara mandiri oleh server PE Portal di latar belakang. Anda dapat menutup browser, mematikan laptop, atau berpindah menu kapan saja tanpa memutus proses yang sedang berjalan. Saat Anda membuka kembali halaman ini, status dan tautan unduh akan langsung tersaji dari database.
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
        }}>
          <AlertCircle size={18} flexShrink={0} />
          <div style={{ flex: 1 }}>{errorMsg}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMsg(null)}
            style={{ color: '#ef4444' }}
          >
            Tutup
          </Button>
        </div>
      )}
    </div>
  );
};
