import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wrench,
  Image as ImageIcon,
  FileArchive,
  Scissors,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  Pipette,
  Eraser,
  Paintbrush,
  Sparkles,
  FileText,
  FileStack,
  ArrowUp,
  ArrowDown,
  Layers,
  Split,
  GitCompare,
  Terminal,
  Copy,
  Check,
  Video as VideoIcon,
  Zap,
  Film,
  Gauge,
  Presentation,
  FileSpreadsheet,
  Search,
  Bot,
  Send,
  MessageSquare,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import styles from './UtilityPage.module.css';

// Safe universal blob download helper ensuring Chrome does not revert to UUID
export const safeDownloadBlob = (blobOrUrl, filename) => {
  if (!blobOrUrl || !filename) return;

  let url;
  let isCreated = false;

  if (blobOrUrl instanceof Blob) {
    url = URL.createObjectURL(blobOrUrl);
    isCreated = true;
  } else {
    url = blobOrUrl;
  }

  const safeFilename = filename.trim();
  const a = document.createElement('a');
  a.style.position = 'fixed';
  a.style.top = '-9999px';
  a.style.left = '-9999px';
  a.setAttribute('href', url);
  a.setAttribute('download', safeFilename);
  a.setAttribute('target', '_self');
  document.body.appendChild(a);

  // Trigger download click
  a.click();

  // Keep in DOM for 3.5s to ensure Chrome download manager reads download attribute
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      if (isCreated) {
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
  }, 3500);
};

export const UtilityPage = () => {
  const { t } = useTranslation();
  const { tab } = useParams();

  // Active Tab from route parameter: 'images', 'documents', 'remove-bg', 'pdf-merge-split'
  const activeTab = tab || 'images';

  const toolMeta = {
    images: {
      title: t('nav.tools_images', 'Image Converter & Compress'),
      subtitle: t('tools.sub_images', 'Bulk konversi format gambar (WEBP, JPEG, PNG, AVIF) & kompresi ukuran instan secara lokal di browser.'),
      icon: ImageIcon,
    },
    documents: {
      title: t('nav.tools_docs', 'Document PDF Compress'),
      subtitle: t('tools.sub_documents', 'Kompresi file dokumen PDF secara aman dan lokal tanpa upload ke server eksternal.'),
      icon: FileArchive,
    },
    'remove-bg': {
      title: t('nav.tools_bg', 'Local Remove Background'),
      subtitle: t('tools.sub_bg', 'Penghapusan background gambar menjadi format PNG transparan secara lokal & instan.'),
      icon: Scissors,
    },
    'pdf-merge-split': {
      title: t('nav.tools_pdf_merge_split', 'PDF Merge & Split'),
      subtitle: t('tools.sub_pdf_merge_split', 'Gabungkan beberapa dokumen PDF menjadi satu atau pisahkan halaman tertentu secara instan & 100% lokal di browser.'),
      icon: FileStack,
    },
    'cl-compare': {
      title: t('nav.tools_cl_compare', 'CL Compare'),
      subtitle: t('tools.sub_cl_compare', 'Normalisasi, sortir urutan Change List (CL), serta komparasi 3-way (Left Only, Common, Right Only) secara instan.'),
      icon: GitCompare,
    },
    'build-command': {
      title: t('nav.tools_build_command', 'Build Command'),
      subtitle: t('tools.sub_build_command', 'Konversi otomatis perintah BASE SYSTEM_BUILD_CMD ke versi INDONESIA USER & ENG build command dengan sentuhan cerdas.'),
      icon: Terminal,
    },
    'video-compress': {
      title: t('nav.tools_video_compress', 'Video Compressor (VAAPI)'),
      subtitle: t('tools.sub_video_compress', 'Kompresi file video cepat dengan akselerasi perangkat keras H.264 VAAPI (Linux GPU) atau CPU high-efficiency.'),
      icon: VideoIcon,
    },
    'pptx-summary': {
      title: t('nav.tools_pptx_summary', 'PowerPoint Auto Summary'),
      subtitle: t('tools.sub_pptx_summary', 'Rangkum multiple laporan PowerPoint (.pptx) secara otomatis menjadi tabel rekapitulasi data dan unduh ke format Excel terformat.'),
      icon: Presentation,
    },
    'powerpoint-summary': {
      title: t('nav.tools_pptx_summary', 'PowerPoint Auto Summary'),
      subtitle: t('tools.sub_pptx_summary', 'Rangkum multiple laporan PowerPoint (.pptx) secara otomatis menjadi tabel rekapitulasi data dan unduh ke format Excel terformat.'),
      icon: Presentation,
    },
  };

  const currentTool = toolMeta[activeTab] || toolMeta.images;
  const ToolIcon = currentTool.icon;

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>
            <ToolIcon size={22} color="var(--color-accent)" />
            {currentTool.title}
          </h1>
          <p className={styles.headerSubtitle}>
            {currentTool.subtitle}
          </p>
        </div>

        {/* Engine Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid #10b981',
          fontSize: '11.5px',
          fontWeight: 600,
        }}>
          <CheckCircle2 size={13} />
          100% Local & Offline Safe
        </div>
      </div>

      {/* Direct Tool Rendering (Accessed from Sidebar) */}
      {activeTab === 'images' && <ImageConverterTab />}
      {activeTab === 'documents' && <DocumentCompressTab />}
      {activeTab === 'remove-bg' && <RemoveBackgroundTab />}
      {activeTab === 'pdf-merge-split' && <PdfMergeSplitTab />}
      {activeTab === 'cl-compare' && <CLCompareTab />}
      {activeTab === 'build-command' && <BuildCommandTab />}
      {activeTab === 'video-compress' && <VideoCompressTab />}
      {(activeTab === 'pptx-summary' || activeTab === 'powerpoint-summary') && <PPTXAutoSummaryTab />}
    </div>
  );
};

// ============================================================================
// 1. IMAGE CONVERTER & COMPRESS TAB (100% Browser Local)
// ============================================================================
const ImageConverterTab = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('image/webp');
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState('original');
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const formatExt = targetFormat === 'image/webp' ? '.webp' : targetFormat === 'image/jpeg' ? '.jpg' : '.png';

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const processImageFile = (fileItem, format, qual, maxDim) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (maxDim !== 'original') {
          const limit = parseInt(maxDim, 10);
          if (width > limit || height > limit) {
            if (width > height) {
              height = Math.round((height * limit) / width);
              width = limit;
            } else {
              width = Math.round((width * limit) / height);
              height = limit;
            }
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw white background if converting transparent to JPEG
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(fileItem);
              return;
            }
            const convertedUrl = URL.createObjectURL(blob);
            const savings = fileItem.originalSize > 0
              ? Math.round(((fileItem.originalSize - blob.size) / fileItem.originalSize) * 100)
              : 0;

            const baseName = fileItem.name.substring(0, fileItem.name.lastIndexOf('.')) || fileItem.name;
            const newName = `${baseName}${formatExt}`;

            resolve({
              ...fileItem,
              convertedBlob: blob,
              convertedUrl,
              convertedSize: blob.size,
              convertedName: newName,
              width,
              height,
              savings,
              status: 'done',
            });
          },
          format,
          qual / 100
        );
      };

      img.src = fileItem.previewUrl;
    });
  };

  const handleFilesAdded = async (newRawFiles) => {
    const validFiles = Array.from(newRawFiles).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const initialItems = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...initialItems]);

    // Automatically convert
    setProcessing(true);
    const convertedItems = await Promise.all(
      initialItems.map((item) => processImageFile(item, targetFormat, quality, maxDimension))
    );

    setFiles((prev) =>
      prev.map((item) => {
        const found = convertedItems.find((c) => c.id === item.id);
        return found || item;
      })
    );
    setProcessing(false);
  };

  const handleReapply = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    const updated = await Promise.all(
      files.map((item) => processImageFile(item, targetFormat, quality, maxDimension))
    );
    setFiles(updated);
    setProcessing(false);
  };

  const handleDownloadSingle = (item) => {
    if (!item.convertedUrl) return;
    safeDownloadBlob(item.convertedBlob || item.convertedUrl, item.convertedName);
  };

  const handleDownloadAll = () => {
    files.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 650);
    });
  };

  const handleClear = () => {
    files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    });
    setFiles([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>{t('tools.target_format_label', 'Format Target')}</span>
            <select
              className={styles.selectInput}
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value)}
            >
              <option value="image/webp">{t('tools.format_webp', 'WEBP (Modern & Ringan)')}</option>
              <option value="image/jpeg">{t('tools.format_jpeg', 'JPEG / JPG (Universal)')}</option>
              <option value="image/png">{t('tools.format_png', 'PNG (Lossless / Transparent)')}</option>
            </select>
          </div>

          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>{t('tools.quality_label', 'Kualitas')}: {quality}%</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                className={styles.rangeInput}
                onChange={(e) => setQuality(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>{t('tools.max_resolution_label', 'Maksimum Resolusi')}</span>
            <select
              className={styles.selectInput}
              value={maxDimension}
              onChange={(e) => setMaxDimension(e.target.value)}
            >
              <option value="original">{t('tools.res_original_label', 'Resolusi Asli (Original)')}</option>
              <option value="1920">{t('tools.res_1920_label', 'Full HD (Max 1920px)')}</option>
              <option value="1280">{t('tools.res_1280_label', 'HD (Max 1280px)')}</option>
              <option value="800">{t('tools.res_800_label', 'Compact (Max 800px)')}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {files.length > 0 && (
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={handleReapply} loading={processing}>
                {t('tools.reconvert_btn', 'Konversi Ulang')}
              </Button>
              <Button variant="secondary" icon={Trash2} onClick={handleClear}>
                {t('tools.clear_all_btn', 'Hapus Semua')}
              </Button>
              <Button variant="primary" icon={Download} onClick={handleDownloadAll}>
                {t('tools.download_all_btn', { count: files.length, defaultValue: `Unduh Semua (${files.length})` })}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFilesAdded(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={38} className={styles.dropzoneIcon} />
        <div>
          <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>
            {t('tools.image_dropzone_title', 'Tarik & Lepas gambar di sini, atau ')}<span style={{ color: 'var(--color-accent)' }}>{t('tools.click_to_select', 'klik untuk memilih')}</span>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('tools.image_dropzone_desc', 'Mendukung file JPG, PNG, WEBP, AVIF, BMP, GIF dalam jumlah banyak (bulk)')}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFilesAdded(e.target.files)}
        />
      </div>

      {/* Results Grid */}
      {files.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {t('tools.conversion_results_title', { count: files.length, defaultValue: `Daftar Hasil Konversi (${files.length} file)` })}
            </span>
          </div>

          <div className={styles.resultsGrid}>
            {files.map((item) => (
              <div key={item.id} className={styles.resultCard}>
                <div className={styles.thumbWrapper}>
                  <img src={item.convertedUrl || item.previewUrl} alt={item.name} className={styles.thumbImg} />
                </div>

                <div className={styles.cardDetails}>
                  <span className={styles.cardFilename} title={item.convertedName || item.name}>
                    {item.convertedName || item.name}
                  </span>

                  <div className={styles.cardStats}>
                    <span>{formatBytes(item.originalSize)}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>➔</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {item.convertedSize ? formatBytes(item.convertedSize) : t('tools.calculating', 'Menghitung...')}
                    </span>
                  </div>

                  {item.savings !== undefined && item.savings > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <span className={styles.savingsBadge}>
                        {t('tools.saved_percent', { percent: item.savings, defaultValue: `Hemat ${item.savings}%` })}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  variant="primary"
                  icon={Download}
                  size="sm"
                  onClick={() => handleDownloadSingle(item)}
                  style={{ width: '100%', marginTop: '6px' }}
                >
                  {t('tools.download_file', 'Unduh File')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. DOCUMENT / PDF COMPRESS TAB (Local Ghostscript / Native Engine)
// ============================================================================
const DocumentCompressTab = () => {
  const { t } = useTranslation();
  const [docs, setDocs] = useState([]);
  const [compressionPreset, setCompressionPreset] = useState('ebook'); // screen, ebook, printer
  const [compressing, setCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const fileInputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleAddDocs = async (fileList) => {
    const validPdfs = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (validPdfs.length === 0) {
      alert(t('tools.select_pdf_alert', 'Silakan pilih dokumen berformat PDF.'));
      return;
    }

    const items = validPdfs.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      originalSize: file.size,
      originalUrl: URL.createObjectURL(file),
      status: 'idle',
      compressedBlob: null,
      compressedUrl: null,
      compressedSize: null,
      savings: null,
      errorMessage: null,
    }));

    setDocs((prev) => [...prev, ...items]);
  };

  const compressSingleDoc = async (item) => {
    const formData = new FormData();
    formData.append('document', item.file);
    formData.append('quality', compressionPreset);

    try {
      const res = await api.post('/utility/compress-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      });

      const blob = res.data;
      const compressedUrl = URL.createObjectURL(blob);
      const compressedSize = blob.size;
      const savings = Math.max(0, Math.round(((item.originalSize - compressedSize) / item.originalSize) * 100));

      return {
        ...item,
        status: 'done',
        compressedBlob: blob,
        compressedUrl,
        compressedSize,
        savings,
        errorMessage: null,
      };
    } catch (err) {
      console.warn('Backend ghostscript compression error:', err);
      let errorMsg = 'Ghostscript gagal memproses file atau file terproteksi password.';
      if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.message) errorMsg = json.message;
          } catch (_) {}
        } else if (err.response.data.message) {
          errorMsg = err.response.data.message;
        }
      }
      // ponytail: clean error message without NASCA pop-up text
      return {
        ...item,
        status: 'error',
        errorMessage: errorMsg,
      };
    }
  };

  const handleCompressSingle = async (docItem) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === docItem.id ? { ...d, status: 'processing', errorMessage: null } : d))
    );
    const updated = await compressSingleDoc(docItem);
    setDocs((prev) =>
      prev.map((d) => (d.id === docItem.id ? updated : d))
    );
  };

  const handleStartCompressAll = async () => {
    setCompressing(true);
    const updated = [];
    for (const item of docs) {
      if (item.status === 'done') {
        updated.push(item);
      } else {
        setDocs((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, status: 'processing', errorMessage: null } : d))
        );
        const res = await compressSingleDoc(item);
        updated.push(res);
      }
    }
    setDocs(updated);
    setCompressing(false);
  };

  const handleRemoveDoc = (id) => {
    setDocs((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.originalUrl) URL.revokeObjectURL(target.originalUrl);
      if (target?.compressedUrl) URL.revokeObjectURL(target.compressedUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  const handleDownloadPdf = (item) => {
    const url = item.compressedUrl || item.originalUrl;
    if (!url) return;
    const filename = item.compressedUrl ? `compressed_${item.name}` : item.name;
    safeDownloadBlob(url, filename);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ponytail: removed NASCA tip banner */}
      {/* Control Bar */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>{t('tools.compression_level_label', 'Tingkat Kompresi Dokumen')}</span>
            <select
              className={styles.selectInput}
              value={compressionPreset}
              onChange={(e) => setCompressionPreset(e.target.value)}
            >
              <option value="screen">{t('tools.preset_screen', 'Tinggi / Email (72 DPI - Ukuran Terkecil)')}</option>
              <option value="ebook">{t('tools.preset_ebook', 'Standar Seimbang (150 DPI - Teks & Grafik Tajam)')}</option>
              <option value="printer">{t('tools.preset_printer', 'Ringan / Cetak (300 DPI - Diagram Presisi Tinggi)')}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {docs.length > 0 && (
            <>
              <Button
                variant="primary"
                icon={Sparkles}
                onClick={handleStartCompressAll}
                loading={compressing}
              >
                {t('tools.start_compress_all', { count: docs.length, defaultValue: `Mulai Kompresi (${docs.length} Dokumen)` })}
              </Button>
              <Button variant="secondary" icon={Trash2} onClick={() => setDocs([])}>
                {t('common.clear', 'Bersihkan')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PDF Dropzone */}
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleAddDocs(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileArchive size={38} className={styles.dropzoneIcon} />
        <div>
          <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>
            {t('tools.pdf_compress_dropzone_title', 'Tarik & Lepas dokumen PDF di sini, atau ')}<span style={{ color: 'var(--color-accent)' }}>{t('tools.click_to_select', 'klik untuk memilih')}</span>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('tools.pdf_compress_dropzone_desc', 'Memproses kompresi stream dokumen PDF secara lokal menggunakan Ghostscript engine.')}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleAddDocs(e.target.files)}
        />
      </div>

      {/* Document Items List */}
      {docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {docs.map((doc) => (
            <div
              key={doc.id}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                <FileText size={24} color="var(--color-accent)" />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '13.5px' }}>{doc.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {t('tools.original_size', 'Ukuran Asli')}: {formatBytes(doc.originalSize)}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {doc.status === 'done' && (
                  <div style={{ textAlign: 'right', marginRight: '6px' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                      {formatBytes(doc.compressedSize)}
                    </p>
                    <span className={styles.savingsBadge}>
                      {t('tools.saved_percent', { percent: doc.savings, defaultValue: `Hemat ${doc.savings}%` })}
                    </span>
                  </div>
                )}

                {doc.status === 'error' && (
                  <span style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} />
                    {doc.errorMessage || t('tools.failed_process', 'Gagal memproses')}
                  </span>
                )}

                {/* Shortcut Preview PDF Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  onClick={() =>
                    setPreviewPdf({
                      url: doc.compressedUrl || doc.originalUrl,
                      name: doc.name,
                      isCompressed: Boolean(doc.compressedUrl),
                    })
                  }
                  title={t('tools.preview_pdf', 'Shortcut Preview PDF')}
                >
                  {t('tools.preview_pdf', 'Preview PDF')}
                </Button>

                {doc.status === 'done' ? (
                  <Button variant="primary" size="sm" icon={Download} onClick={() => handleDownloadPdf(doc)}>
                    {t('tools.download_pdf', 'Unduh PDF')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={doc.status === 'processing'}
                    disabled={compressing || doc.status === 'processing'}
                    onClick={() => handleCompressSingle(doc)}
                  >
                    {t('tools.compress', 'Kompres')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDoc(doc.id)}
                  title={t('common.delete', 'Hapus dari daftar')}
                >
                  <Trash2 size={14} color="var(--color-error)" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shortcut PDF Preview Modal */}
      <Modal
        isOpen={Boolean(previewPdf)}
        onClose={() => setPreviewPdf(null)}
        title={`${t('tools.preview_pdf', 'Preview PDF')}: ${previewPdf?.name || ''} ${previewPdf?.isCompressed ? t('tools.compressed_tag', '(Terkonpresi)') : t('tools.original_tag', '(Asli)')}`}
        maxWidth="950px"
      >
        {previewPdf && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <iframe
              src={previewPdf.url}
              title={previewPdf.name}
              style={{
                width: '100%',
                height: '600px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#ffffff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={() => window.open(previewPdf.url, '_blank')}
              >
                {t('tools.open_new_tab', 'Buka di Tab Baru')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => {
                  const filename = previewPdf.isCompressed ? `compressed_${previewPdf.name}` : previewPdf.name;
                  safeDownloadBlob(previewPdf.url, filename);
                }}
              >
                {t('tools.download_pdf', 'Unduh PDF')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============================================================================
// 3. LOCAL BACKGROUND REMOVER TAB (No API / Python Engine)
// ============================================================================
const RemoveBackgroundTab = () => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [algorithm, setAlgorithm] = useState('u2net'); // 'u2net' (AI Salient Object) or 'color' (Manual Canvas)
  const [u2ModelQuality, setU2ModelQuality] = useState('medium'); // 'medium' (fp16) or 'small' (quint8 fast)
  const [processing, setProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatusText, setAiStatusText] = useState('');

  // Color keying controls (fallback / manual mode)
  const [tolerance, setTolerance] = useState(35);
  const [feather, setFeather] = useState(2);
  const [bgColorHex, setBgColorHex] = useState('auto');

  // Interactive brush tools
  const [activeTool, setActiveTool] = useState('eyedropper'); // 'eyedropper', 'eraser', 'restore'
  const [brushSize, setBrushSize] = useState(25);

  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const isDrawing = useRef(false);
  const fileInputRef = useRef(null);

  // When color keying parameters change in 'color' mode, re-render canvas
  useEffect(() => {
    if (!imageSrc || algorithm !== 'color') return;
    renderBackgroundRemoval();
  }, [imageSrc, tolerance, feather, bgColorHex, algorithm]);

  // ponytail: accurate AI salient object background removal via U2-Net / IS-Net in-browser
  const processWithU2Net = async (fileToProcess) => {
    const file = fileToProcess || imageFile;
    if (!file) return;

    setProcessing(true);
    setAiProgress(10);
    setAiStatusText('Menginisialisasi U2-Net neural network...');

    try {
      // ponytail: serve U2-Net models directly from local server publicPath to eliminate user internet download
      const serverModelPath = `${window.location.origin}/models/u2net/`;
      const blob = await removeBackground(file, {
        publicPath: serverModelPath,
        model: u2ModelQuality, // 'medium' (fp16) or 'small' (quint8)
        output: {
          format: 'image/png',
          quality: 1.0,
        },
        progress: (key, current, total) => {
          if (total > 0) {
            const pct = Math.min(95, Math.round((current / total) * 100));
            setAiProgress(pct);
            if (key.includes('model') || key.includes('onnx')) {
              setAiStatusText(`Memuat model U2-Net dari server: ${pct}%`);
            } else if (key.includes('wasm')) {
              setAiStatusText(`Memuat WebAssembly runtime dari server: ${pct}%`);
            } else {
              setAiStatusText(`Segmentasi objek U2-Net: ${pct}%`);
            }
          }
        },
      });

      setAiProgress(100);
      setAiStatusText('Segmentasi U2-Net selesai!');

      // Draw cutout to canvas
      const cutoutUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(cutoutUrl);
      };
      img.src = cutoutUrl;
    } catch (err) {
      console.error('U2-Net execution error, fallback to canvas color keying:', err);
      setAiStatusText('Inferensi U2-Net gagal, dialihkan ke engine Canvas');
      renderBackgroundRemoval();
    } finally {
      setTimeout(() => {
        setProcessing(false);
      }, 400);
    }
  };

  const handleSelectImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageSrc(url);

    // Populate originalCanvas for pipetting / reference
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origCanvas = originalCanvasRef.current;
      if (origCanvas) {
        origCanvas.width = img.width;
        origCanvas.height = img.height;
        const origCtx = origCanvas.getContext('2d');
        origCtx.drawImage(img, 0, 0);
      }
    };
    img.src = url;

    if (algorithm === 'u2net') {
      processWithU2Net(file);
    }
  };

  const renderBackgroundRemoval = () => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const origCanvas = originalCanvasRef.current;
      if (!canvas || !origCanvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      origCanvas.width = img.width;
      origCanvas.height = img.height;

      const origCtx = origCanvas.getContext('2d');
      origCtx.drawImage(img, 0, 0);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample Background Color
      let targetR = 255, targetG = 255, targetB = 255;
      if (bgColorHex === 'auto') {
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ];
        let sr = 0, sg = 0, sb = 0;
        corners.forEach(([cx, cy]) => {
          const idx = (cy * canvas.width + cx) * 4;
          sr += data[idx];
          sg += data[idx + 1];
          sb += data[idx + 2];
        });
        targetR = Math.round(sr / corners.length);
        targetG = Math.round(sg / corners.length);
        targetB = Math.round(sb / corners.length);
      } else {
        const hex = bgColorHex.replace('#', '');
        targetR = parseInt(hex.substring(0, 2), 16) || 255;
        targetG = parseInt(hex.substring(2, 4), 16) || 255;
        targetB = parseInt(hex.substring(4, 6), 16) || 255;
      }

      const tolDistance = (tolerance / 100) * 441.67;
      const featherDistance = (feather / 10) * 80;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dist = Math.sqrt(
          (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
        );

        if (dist <= tolDistance) {
          data[i + 3] = 0; // Transparent
        } else if (dist < tolDistance + featherDistance && featherDistance > 0) {
          const factor = (dist - tolDistance) / featherDistance;
          data[i + 3] = Math.round(factor * 255);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = imageSrc;
  };

  // Canvas Eyedropper & Manual Brush tools
  const handleCanvasMouseDown = (e) => {
    isDrawing.current = true;
    handleCanvasAction(e);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing.current) return;
    if (activeTool === 'eraser' || activeTool === 'restore') {
      handleCanvasAction(e);
    }
  };

  const handleCanvasMouseUp = () => {
    isDrawing.current = false;
  };

  const handleCanvasAction = (e) => {
    const canvas = canvasRef.current;
    const origCanvas = originalCanvasRef.current;
    if (!canvas || !origCanvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    const origCtx = origCanvas.getContext('2d');

    if (activeTool === 'eyedropper') {
      const pixel = origCtx.getImageData(x, y, 1, 1).data;
      const hex =
        '#' +
        ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
          .toString(16)
          .slice(1);
      setBgColorHex(hex);
      isDrawing.current = false;
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (activeTool === 'restore') {
      // Restore from original canvas
      const pat = ctx.createPattern(origCanvas, 'no-repeat');
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = pat;
      ctx.fillRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
      ctx.restore();
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const baseName = (imageFile?.name || 'cutout').replace(/\.[^/.]+$/, '');
    const filename = `transparent_${baseName}.png`;
    canvas.toBlob((blob) => {
      if (blob) {
        safeDownloadBlob(blob, filename);
      } else {
        safeDownloadBlob(canvas.toDataURL('image/png'), filename);
      }
    }, 'image/png');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Control Toolbar */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          {/* Algorithm Engine Selector */}
          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>Algoritma Engine</span>
            <div className={styles.algoToggle}>
              <button
                type="button"
                className={`${styles.algoBtn} ${algorithm === 'u2net' ? styles.algoBtnActive : ''}`}
                onClick={() => {
                  setAlgorithm('u2net');
                  if (imageFile) processWithU2Net(imageFile);
                }}
              >
                <Sparkles size={13} /> U2-Net AI (Akurat)
              </button>
              <button
                type="button"
                className={`${styles.algoBtn} ${algorithm === 'color' ? styles.algoBtnActive : ''}`}
                onClick={() => {
                  setAlgorithm('color');
                  renderBackgroundRemoval();
                }}
              >
                <Sliders size={13} /> Color Key (Manual)
              </button>
            </div>
          </div>

          {/* Conditional Controls depending on algorithm */}
          {algorithm === 'u2net' ? (
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>Model U2-Net</span>
              <select
                className={styles.selectInput}
                value={u2ModelQuality}
                onChange={(e) => {
                  const val = e.target.value;
                  setU2ModelQuality(val);
                }}
                disabled={processing}
              >
                <option value="medium">IS-Net / U2-Net FP16 (Akurat & Halus)</option>
                <option value="small">IS-Net / U2-Net Quint8 (Ringan & Cepat)</option>
              </select>
            </div>
          ) : (
            <>
              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>Warna Background</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="color"
                    value={bgColorHex === 'auto' ? '#ffffff' : bgColorHex}
                    onChange={(e) => setBgColorHex(e.target.value)}
                    style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    disabled={bgColorHex === 'auto'}
                  />
                  <button
                    type="button"
                    className={styles.copyBtn}
                    style={{
                      backgroundColor: bgColorHex === 'auto' ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                      color: bgColorHex === 'auto' ? '#fff' : 'var(--color-text-primary)'
                    }}
                    onClick={() => setBgColorHex(bgColorHex === 'auto' ? '#ffffff' : 'auto')}
                  >
                    {bgColorHex === 'auto' ? 'Auto Detect' : 'Manual'}
                  </button>
                </div>
              </div>

              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>Sensitivitas: {tolerance}%</span>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={tolerance}
                  className={styles.rangeInput}
                  onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                />
              </div>

              <div className={styles.controlItem}>
                <span className={styles.controlLabel}>Feather: {feather}px</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={feather}
                  className={styles.rangeInput}
                  onChange={(e) => setFeather(parseInt(e.target.value, 10))}
                />
              </div>
            </>
          )}

          {/* Tools Picker (Active in both modes) */}
          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>Touch-up Manual</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                title="Pilih warna background langsung dari gambar"
                className={styles.copyBtn}
                style={{
                  backgroundColor: activeTool === 'eyedropper' ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                  color: activeTool === 'eyedropper' ? '#fff' : 'inherit',
                  padding: '6px 10px',
                }}
                onClick={() => setActiveTool('eyedropper')}
              >
                <Pipette size={14} /> Pipet
              </button>

              <button
                type="button"
                title="Kuas Penghapus manual"
                className={styles.copyBtn}
                style={{
                  backgroundColor: activeTool === 'eraser' ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                  color: activeTool === 'eraser' ? '#fff' : 'inherit',
                  padding: '6px 10px',
                }}
                onClick={() => setActiveTool('eraser')}
              >
                <Eraser size={14} /> Hapus
              </button>

              <button
                type="button"
                title="Kuas Pemulih area foreground"
                className={styles.copyBtn}
                style={{
                  backgroundColor: activeTool === 'restore' ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                  color: activeTool === 'restore' ? '#fff' : 'inherit',
                  padding: '6px 10px',
                }}
                onClick={() => setActiveTool('restore')}
              >
                <Paintbrush size={14} /> Pulihkan
              </button>
            </div>
          </div>

          {(activeTool === 'eraser' || activeTool === 'restore') && (
            <div className={styles.controlItem}>
              <span className={styles.controlLabel}>Kuas: {brushSize}px</span>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                className={styles.rangeInput}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {imageSrc && (
            <>
              {algorithm === 'u2net' && (
                <Button
                  variant="primary"
                  icon={Sparkles}
                  loading={processing}
                  onClick={() => processWithU2Net(imageFile)}
                  title="Jalankan ulang segmentasi U2-Net"
                >
                  Proses AI U2-Net
                </Button>
              )}
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => {
                  if (algorithm === 'u2net') {
                    processWithU2Net(imageFile);
                  } else {
                    renderBackgroundRemoval();
                  }
                }}
              >
                Reset
              </Button>
              <Button variant="primary" icon={Download} onClick={handleDownloadPng}>
                Unduh PNG
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Processing Status Banner */}
      {processing && (
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-primary)' }}>
              <Sparkles size={16} color="var(--color-accent)" className={styles.spin} />
              {aiStatusText || 'Sedang memproses algoritma U2-Net...'}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{aiProgress}%</span>
          </div>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarFill} style={{ width: `${aiProgress}%` }} />
          </div>
        </div>
      )}


      {/* Upload Zone if no image */}
      {!imageSrc && (
        <div
          className={styles.dropzone}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleSelectImage(e.dataTransfer.files[0]);
          }}
        >
          <Scissors size={40} className={styles.dropzoneIcon} />
          <div>
            <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>
              {t('tools.remove_bg_dropzone_title', 'Pilih foto atau drag & drop gambar yang ingin dihapus background-nya')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {t('tools.remove_bg_dropzone_desc', 'Berjalan 100% lokal di browser dan mesin lokal tanpa upload ke API luar')}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleSelectImage(e.target.files[0]);
            }}
          />
        </div>
      )}

      {/* Side-by-Side Canvas Workspace */}
      {imageSrc && (
        <div className={styles.bgRemoverLayout}>
          {/* Original Preview (For Pipette & Reference) */}
          <div className={styles.canvasBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('tools.original_image_ref', 'Gambar Asli (Klik untuk Pipet Warna)')}</span>
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                {t('tools.change_image', 'Ganti Gambar')}
              </Button>
            </div>
            <div className={styles.canvasWrapper} style={{ backgroundColor: 'var(--color-bg-primary)' }}>
              <canvas
                ref={originalCanvasRef}
                className={styles.canvasElem}
                style={{ cursor: activeTool === 'eyedropper' ? 'crosshair' : 'default' }}
                onClick={handleCanvasAction}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleSelectImage(e.target.files[0]);
              }}
            />
          </div>

          {/* Transparent Canvas Cutout */}
          <div className={styles.canvasBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Hasil Transparan (PNG Cutout)</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {activeTool === 'eraser' ? 'Mode Kuas Penghapus' : activeTool === 'restore' ? 'Mode Kuas Pemulih' : 'Mode Preview'}
              </span>
            </div>
            <div className={`${styles.canvasWrapper} ${styles.checkerboard}`}>
              <canvas
                ref={canvasRef}
                className={styles.canvasElem}
                style={{
                  cursor: activeTool === 'eraser' || activeTool === 'restore' ? 'crosshair' : 'default',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. PDF MERGE & SPLIT TAB (100% Client-Side with pdf-lib /ponytail)
// ============================================================================
const PdfMergeSplitTab = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('merge'); // 'merge' | 'split'

  // Merge State
  const [mergeFiles, setMergeFiles] = useState([]);
  const [mergeOutputName, setMergeOutputName] = useState('merged_document.pdf');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(null);
  const [mergeDragActive, setMergeDragActive] = useState(false);
  const mergeFileInputRef = useRef(null);

  // Split State
  const [splitFile, setSplitFile] = useState(null);
  const [splitMethod, setSplitMethod] = useState('range'); // 'range' | 'every_n'
  const [pageRange, setPageRange] = useState('');
  const [everyN, setEveryN] = useState(1);
  const [splitOutputName, setSplitOutputName] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitSuccess, setSplitSuccess] = useState(null);
  const [splitDragActive, setSplitDragActive] = useState(false);
  const splitFileInputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const parsePageRange = (rangeStr, maxPages) => {
    if (!rangeStr || !rangeStr.trim()) return [];
    const pages = new Set();
    const parts = rangeStr.split(',');
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          const start = Math.max(1, Math.min(startStr, endStr));
          const end = Math.min(maxPages, Math.max(startStr, endStr));
          for (let i = start; i <= end; i++) pages.add(i);
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) pages.add(p);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  // --------------------------------------------------------------------------
  // MERGE ACTIONS
  // --------------------------------------------------------------------------
  const handleMergeAddFiles = async (newFileList) => {
    const pdfFiles = Array.from(newFileList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    setMergeSuccess(null);
    const loadedItems = [];

    // ponytail: load valid PDFs without NASCA popup/alert dialog
    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const header = new TextDecoder('ascii').decode(arrayBuffer.slice(0, 5));
        if (header !== '%PDF-') continue;

        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        loadedItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          pageCount,
          arrayBuffer,
        });
      } catch (err) {
        console.error('Failed to parse PDF:', file.name, err);
      }
    }

    if (loadedItems.length > 0) {
      setMergeFiles((prev) => [...prev, ...loadedItems]);
    }
  };

  const handleMoveFile = (index, direction) => {
    setMergeFiles((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleRemoveMergeFile = (id) => {
    setMergeFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      alert('Silakan pilih minimal 2 dokumen PDF untuk digabungkan.');
      return;
    }
    setIsMerging(true);
    setMergeSuccess(null);

    try {
      const mergedPdf = await PDFDocument.create();
      let totalPagesCount = 0;

      for (const item of mergeFiles) {
        const srcPdf = await PDFDocument.load(item.arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        totalPagesCount += copiedPages.length;
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const filename = mergeOutputName.endsWith('.pdf') ? mergeOutputName : `${mergeOutputName}.pdf`;

      // Safe download with guaranteed filename and extension
      safeDownloadBlob(blob, filename);

      setMergeSuccess({
        filename,
        size: blob.size,
        totalPages: totalPagesCount,
        fileCount: mergeFiles.length,
        blob,
      });
    } catch (err) {
      console.error('Merge PDF error:', err);
      alert('Gagal menggabungkan PDF: ' + err.message);
    } finally {
      setIsMerging(false);
    }
  };

  // --------------------------------------------------------------------------
  // SPLIT ACTIONS
  // --------------------------------------------------------------------------
  const handleSplitAddFile = async (selectedFile) => {
    if (!selectedFile || (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf'))) {
      alert('Silakan pilih dokumen berformat PDF.');
      return;
    }
    setSplitSuccess(null);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const header = new TextDecoder('ascii').decode(arrayBuffer.slice(0, 5));
      if (header !== '%PDF-') {
        throw new Error('Dokumen bukan file PDF standar yang valid.');
      }

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      setSplitFile({
        file: selectedFile,
        name: selectedFile.name,
        size: selectedFile.size,
        pageCount,
        arrayBuffer,
      });
      setPageRange(`1-${Math.min(5, pageCount)}`);
      setSplitOutputName(`split_${selectedFile.name}`);
    } catch (err) {
      console.error('Failed to load PDF for split:', err);
      alert('Gagal membaca dokumen PDF: ' + err.message);
    }
  };

  const handleExecuteSplit = async () => {
    if (!splitFile) return;
    setIsSplitting(true);
    setSplitSuccess(null);

    try {
      const srcPdf = await PDFDocument.load(splitFile.arrayBuffer);
      const totalPages = splitFile.pageCount;

      if (splitMethod === 'range') {
        const pagesToExtract = parsePageRange(pageRange, totalPages);
        if (pagesToExtract.length === 0) {
          alert('Pilihan range halaman tidak valid.');
          setIsSplitting(false);
          return;
        }

        const subPdf = await PDFDocument.create();
        const pageIndices = pagesToExtract.map((p) => p - 1);
        const copiedPages = await subPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach((page) => subPdf.addPage(page));

        const subPdfBytes = await subPdf.save();
        const blob = new Blob([subPdfBytes], { type: 'application/pdf' });
        const filename = splitOutputName.endsWith('.pdf') ? splitOutputName : `${splitOutputName}.pdf`;

        // Safe download
        safeDownloadBlob(blob, filename);

        setSplitSuccess({
          filename,
          size: blob.size,
          extractedPages: pagesToExtract.length,
          pagesList: pagesToExtract.join(', '),
          blob,
        });
      } else {
        const n = Math.max(1, parseInt(everyN, 10) || 1);
        const partsCount = Math.ceil(totalPages / n);
        const generatedParts = [];

        for (let i = 0; i < partsCount; i++) {
          const start = i * n;
          const end = Math.min(start + n, totalPages);
          const pageIndices = [];
          for (let p = start; p < end; p++) pageIndices.push(p);

          const partPdf = await PDFDocument.create();
          const copied = await partPdf.copyPages(srcPdf, pageIndices);
          copied.forEach((cp) => partPdf.addPage(cp));

          const bytes = await partPdf.save();
          const blob = new Blob([bytes], { type: 'application/pdf' });

          const baseCleanName = splitFile.name.replace(/\.pdf$/i, '');
          const partName = `${baseCleanName}_part_${i + 1}_hal_${start + 1}-${end}.pdf`;

          generatedParts.push({
            partIndex: i + 1,
            filename: partName,
            pagesText: `Halaman ${start + 1} - ${end}`,
            pageCount: pageIndices.length,
            size: blob.size,
            blob,
          });
        }

        setSplitSuccess({
          filename: `${partsCount} file PDF`,
          partsCount,
          parts: generatedParts,
          isBatch: true,
        });

        // Safe spaced sequential downloads so Chrome download manager gives each file proper filename
        for (let i = 0; i < generatedParts.length; i++) {
          safeDownloadBlob(generatedParts[i].blob, generatedParts[i].filename);
          if (i < generatedParts.length - 1) {
            await new Promise((r) => setTimeout(r, 650));
          }
        }
      }
    } catch (err) {
      console.error('Split PDF error:', err);
      alert('Gagal memisahkan PDF: ' + err.message);
    } finally {
      setIsSplitting(false);
    }
  };

  const totalMergePages = mergeFiles.reduce((acc, curr) => acc + curr.pageCount, 0);
  const totalMergeSize = mergeFiles.reduce((acc, curr) => acc + curr.size, 0);

  const selectedPagesList = splitFile ? parsePageRange(pageRange, splitFile.pageCount) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* ponytail: removed NASCA tip banner */}
      {/* Top Mode Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'merge' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setMode('merge');
              setMergeSuccess(null);
            }}
          >
            <Layers size={16} />
            Gabung Dokumen (Merge)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'split' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setMode('split');
              setSplitSuccess(null);
            }}
          >
            <Split size={16} />
            Pisah Halaman (Split)
          </button>
        </div>

        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {mode === 'merge'
            ? 'Urutkan dokumen dengan tombol panah untuk menentukan urutan penggabungan.'
            : 'Ekstrak range halaman tertentu atau pisah setiap halaman menjadi file independen.'}
        </span>
      </div>

      {/* ===================================================================== */}
      {/* 1. MERGE PDF MODE                                                     */}
      {/* ===================================================================== */}
      {mode === 'merge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dropzone */}
          <div
            className={`${styles.dropzone} ${mergeDragActive ? styles.dropzoneActive : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setMergeDragActive(true);
            }}
            onDragLeave={() => setMergeDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setMergeDragActive(false);
              handleMergeAddFiles(e.dataTransfer.files);
            }}
            onClick={() => mergeFileInputRef.current?.click()}
          >
            <Layers size={40} className={styles.dropzoneIcon} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {t('tools.pdf_merge_dropzone_title', 'Klik untuk pilih dokumen PDF atau Drag & Drop beberapa file ke sini')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {t('tools.pdf_merge_dropzone_desc', 'Mendukung bulk upload file PDF tanpa batasan ukuran server.')}
              </div>
            </div>
            <Button variant="secondary" icon={Upload} size="sm">
              {t('tools.select_pdf_files', 'Pilih Dokumen PDF')}
            </Button>
            <input
              ref={mergeFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) handleMergeAddFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Success Banner */}
          {mergeSuccess && (
            <div className={styles.successBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} />
                <span>
                  Berhasil menggabungkan <strong>{mergeSuccess.fileCount} dokumen</strong> ({mergeSuccess.totalPages} halaman total, {formatBytes(mergeSuccess.size)}) menjadi <strong>{mergeSuccess.filename}</strong>!
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => {
                  safeDownloadBlob(mergeSuccess.blob, mergeSuccess.filename);
                }}
              >
                Unduh Lagi
              </Button>
            </div>
          )}

          {/* Uploaded Files Queue */}
          {mergeFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Controls bar */}
              <div className={styles.controlPanel}>
                <div className={styles.controlGroup}>
                  <div className={styles.controlItem}>
                    <span className={styles.controlLabel}>{t('tools.merged_filename_label', 'Nama File Hasil Penggabungan')}</span>
                    <input
                      type="text"
                      className={styles.selectInput}
                      value={mergeOutputName}
                      onChange={(e) => setMergeOutputName(e.target.value)}
                      placeholder={t('tools.merged_filename_placeholder', 'merged_document.pdf')}
                      style={{ minWidth: '220px' }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', alignSelf: 'flex-end', paddingBottom: '8px' }}>
                    Total: <strong>{mergeFiles.length} File</strong> • <strong>{totalMergePages} Halaman</strong> • <strong>{formatBytes(totalMergeSize)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    icon={Sparkles}
                    onClick={handleExecuteMerge}
                    loading={isMerging}
                    disabled={mergeFiles.length < 2}
                  >
                    Gabungkan PDF ({mergeFiles.length} File)
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Trash2}
                    onClick={() => {
                      setMergeFiles([]);
                      setMergeSuccess(null);
                    }}
                  >
                    Bersihkan
                  </Button>
                </div>
              </div>

              {/* Cards List */}
              <div className={styles.pdfList}>
                {mergeFiles.map((item, idx) => (
                  <div key={item.id} className={styles.pdfCard}>
                    <div className={styles.pdfCardInfo}>
                      <div className={styles.pdfOrderBadge}>#{idx + 1}</div>
                      <FileText size={20} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                      <div className={styles.pdfDetails}>
                        <span className={styles.pdfName} title={item.name}>
                          {item.name}
                        </span>
                        <div className={styles.pdfMeta}>
                          <span className={styles.pdfBadge}>{item.pageCount} Halaman</span>
                          <span>•</span>
                          <span>{formatBytes(item.size)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.pdfCardActions}>
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        disabled={idx === 0}
                        onClick={() => handleMoveFile(idx, -1)}
                        title="Pindah ke Atas"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        disabled={idx === mergeFiles.length - 1}
                        onClick={() => handleMoveFile(idx, 1)}
                        title="Pindah ke Bawah"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        onClick={() => handleRemoveMergeFile(item.id)}
                        title="Hapus Dokumen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SPLIT PDF MODE                                                     */}
      {/* ===================================================================== */}
      {mode === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dropzone or Loaded File Details */}
          {!splitFile ? (
            <div
              className={`${styles.dropzone} ${splitDragActive ? styles.dropzoneActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setSplitDragActive(true);
              }}
              onDragLeave={() => setSplitDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSplitDragActive(false);
                if (e.dataTransfer.files?.[0]) handleSplitAddFile(e.dataTransfer.files[0]);
              }}
              onClick={() => splitFileInputRef.current?.click()}
            >
              <Split size={40} className={styles.dropzoneIcon} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {t('tools.pdf_split_dropzone_title', 'Pilih atau Drag & Drop 1 file dokumen PDF yang ingin dipisahkan')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {t('tools.pdf_split_dropzone_desc', 'Dokumen diproses secara lokal langsung di memori browser.')}
                </div>
              </div>
              <Button variant="secondary" icon={Upload} size="sm">
                {t('tools.select_pdf_file', 'Pilih File PDF')}
              </Button>
              <input
                ref={splitFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleSplitAddFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Selected PDF Overview Card */}
              <div className={styles.pdfCard}>
                <div className={styles.pdfCardInfo}>
                  <FileText size={24} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                  <div className={styles.pdfDetails}>
                    <span className={styles.pdfName} style={{ fontSize: '14px' }}>
                      {splitFile.name}
                    </span>
                    <div className={styles.pdfMeta}>
                      <span className={styles.pdfBadge}>{splitFile.pageCount} Halaman Total</span>
                      <span>•</span>
                      <span>Ukuran: {formatBytes(splitFile.size)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    setSplitFile(null);
                    setSplitSuccess(null);
                  }}
                >
                  Ganti File
                </Button>
              </div>

              {/* Success Banner */}
              {splitSuccess && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className={styles.successBanner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={18} />
                      <span>
                        {splitSuccess.isBatch ? (
                          <>Berhasil membagi dokumen menjadi <strong>{splitSuccess.partsCount} file terpisah</strong>!</>
                        ) : (
                          <>Berhasil mengekstrak <strong>{splitSuccess.extractedPages} halaman</strong> ([{splitSuccess.pagesList}]) menjadi <strong>{splitSuccess.filename}</strong> ({formatBytes(splitSuccess.size)})!</>
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {splitSuccess.blob && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Download}
                          onClick={() => {
                            safeDownloadBlob(splitSuccess.blob, splitSuccess.filename);
                          }}
                        >
                          Unduh Lagi
                        </Button>
                      )}
                      {splitSuccess.isBatch && splitSuccess.parts && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Download}
                          onClick={async () => {
                            for (let i = 0; i < splitSuccess.parts.length; i++) {
                              safeDownloadBlob(splitSuccess.parts[i].blob, splitSuccess.parts[i].filename);
                              if (i < splitSuccess.parts.length - 1) {
                                await new Promise((r) => setTimeout(r, 650));
                              }
                            }
                          }}
                        >
                          Unduh Semua ({splitSuccess.parts.length} File)
                        </Button>
                      )}
                    </div>
                  </div>

                  {splitSuccess.isBatch && splitSuccess.parts && (
                    <div className={styles.batchPartsList}>
                      <div className={styles.batchPartsHeader}>
                        <span>Daftar File Hasil Pemisahan ({splitSuccess.parts.length} Bagian):</span>
                      </div>
                      <div className={styles.batchPartsGrid}>
                        {splitSuccess.parts.map((part) => (
                          <div key={part.partIndex} className={styles.batchPartItem}>
                            <div className={styles.batchPartInfo}>
                              <FileText size={16} color="var(--color-accent)" />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className={styles.batchPartName} title={part.filename}>{part.filename}</span>
                                <span className={styles.batchPartMeta}>{part.pagesText} • {formatBytes(part.size)}</span>
                              </div>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Download}
                              onClick={() => safeDownloadBlob(part.blob, part.filename)}
                            >
                              Unduh
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Split Options Form */}
              <div className={styles.splitCard}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Pilih Metode Pemisahan (Split Options)
                </div>

                <div className={styles.splitOptionGroup}>
                  {/* Option 1: Custom Page Range */}
                  <label
                    className={`${styles.splitOption} ${splitMethod === 'range' ? styles.splitOptionSelected : ''}`}
                    onClick={() => setSplitMethod('range')}
                  >
                    <input
                      type="radio"
                      name="splitMethod"
                      checked={splitMethod === 'range'}
                      onChange={() => setSplitMethod('range')}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        Ekstrak Range Halaman Tertentu
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Contoh: <code>1-3, 5, 8-10</code> (Hanya mengambil halaman yang disebutkan ke dalam 1 file baru).
                      </span>

                      {splitMethod === 'range' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          <input
                            type="text"
                            className={styles.selectInput}
                            value={pageRange}
                            onChange={(e) => setPageRange(e.target.value)}
                            placeholder={t('tools.page_range_placeholder', 'Contoh: 1-5, 8, 12')}
                            style={{ maxWidth: '320px' }}
                          />
                          <span style={{ fontSize: '11.5px', color: selectedPagesList.length > 0 ? '#10b981' : '#ef4444' }}>
                            {selectedPagesList.length > 0
                              ? `✓ Halaman yang akan diekstrak (${selectedPagesList.length} hal): [${selectedPagesList.join(', ')}]`
                              : 'Ketik halaman atau range angka di antara 1 dan ' + splitFile.pageCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Option 2: Split every N pages */}
                  <label
                    className={`${styles.splitOption} ${splitMethod === 'every_n' ? styles.splitOptionSelected : ''}`}
                    onClick={() => setSplitMethod('every_n')}
                  >
                    <input
                      type="radio"
                      name="splitMethod"
                      checked={splitMethod === 'every_n'}
                      onChange={() => setSplitMethod('every_n')}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        Bagi Rata Setiap N Halaman
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Pecah dokumen menjadi beberapa bagian dengan jumlah halaman yang sama (cth: 1 halaman per file).
                      </span>

                      {splitMethod === 'every_n' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                          <input
                            type="number"
                            min="1"
                            max={splitFile.pageCount}
                            className={styles.selectInput}
                            value={everyN}
                            onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            style={{ width: '80px' }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            Halaman per bagian ➔ Menghasilkan{' '}
                            <strong>{Math.ceil(splitFile.pageCount / (parseInt(everyN, 10) || 1))} file PDF</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Filename & Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                  {splitMethod === 'range' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.controlLabel}>Nama Output:</span>
                      <input
                        type="text"
                        className={styles.selectInput}
                        value={splitOutputName}
                        onChange={(e) => setSplitOutputName(e.target.value)}
                        placeholder="split_document.pdf"
                        style={{ minWidth: '220px' }}
                      />
                    </div>
                  )}

                  <div style={{ marginLeft: 'auto' }}>
                    <Button
                      variant="primary"
                      icon={Download}
                      onClick={handleExecuteSplit}
                      loading={isSplitting}
                      disabled={splitMethod === 'range' && selectedPagesList.length === 0}
                    >
                      {splitMethod === 'range'
                        ? `Ekstrak & Unduh (${selectedPagesList.length} Halaman)`
                        : `Pecah & Unduh Semua Bagian`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. CL COMPARE TOOL TAB
// ============================================================================
const preprocessCL = (input) => {
  if (!input) return [];
  const parts = input.split(/\D+/);
  const set = new Set();
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const val = parseInt(p, 10);
    if (!isNaN(val) && !set.has(val)) {
      set.add(val);
      result.push(val);
    }
  }
  result.sort((a, b) => a - b);
  return result;
};

const CLCompareTab = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('sort'); // 'sort' | 'compare'

  // Sort state
  const [sortInput, setSortInput] = useState('');
  const [sortDelimiter, setSortDelimiter] = useState('comma'); // 'comma' | 'newline'
  const [sortCopied, setSortCopied] = useState(false);

  const sortedCLs = React.useMemo(() => preprocessCL(sortInput), [sortInput]);
  const sortedOutput = React.useMemo(() => {
    return sortDelimiter === 'comma' ? sortedCLs.join(', ') : sortedCLs.join('\n');
  }, [sortedCLs, sortDelimiter]);

  const handleCopySort = () => {
    if (!sortedOutput) return;
    navigator.clipboard.writeText(sortedOutput);
    setSortCopied(true);
    setTimeout(() => setSortCopied(false), 1500);
  };

  // Compare state
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [compareDelimiter, setCompareDelimiter] = useState('comma'); // 'comma' | 'newline'
  const [copiedColumn, setCopiedColumn] = useState(null); // 'left' | 'common' | 'right'

  const { leftOnly, common, rightOnly } = React.useMemo(() => {
    const leftList = preprocessCL(leftInput);
    const rightList = preprocessCL(rightInput);

    const leftSet = new Set(leftList);
    const rightSet = new Set(rightList);

    const commonItems = leftList.filter((x) => rightSet.has(x));
    const leftOnlyItems = leftList.filter((x) => !rightSet.has(x));
    const rightOnlyItems = rightList.filter((x) => !leftSet.has(x));

    return {
      leftOnly: leftOnlyItems,
      common: commonItems,
      rightOnly: rightOnlyItems,
    };
  }, [leftInput, rightInput]);

  const formatList = (arr) => (compareDelimiter === 'comma' ? arr.join(', ') : arr.join('\n'));

  const handleCopyColumn = (colName, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedColumn(colName);
    setTimeout(() => setCopiedColumn(null), 1500);
  };

  return (
    <div className={styles.toolCard}>
      {/* Subtab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className={styles.tabButtonGroup}>
          <button
            type="button"
            className={`${styles.tabButtonItem} ${mode === 'sort' ? styles.tabButtonItemActive : ''}`}
            onClick={() => setMode('sort')}
          >
            Sort & Normalize
          </button>
          <button
            type="button"
            className={`${styles.tabButtonItem} ${mode === 'compare' ? styles.tabButtonItemActive : ''}`}
            onClick={() => setMode('compare')}
          >
            3-Way Compare
          </button>
        </div>
      </div>

      {mode === 'sort' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Input Change Lists (CLs)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortInput('32451000 31998945, 32451000, 31887200\n32011223')}
                >
                  Contoh Data
                </Button>
                {sortInput && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setSortInput('')}>
                    Bersihkan
                  </Button>
                )}
              </div>
            </div>
            <textarea
              className={styles.toolTextarea}
              rows={5}
              placeholder={t('tools.cl_sort_placeholder', 'Tempelkan daftar CL di sini (bisa dipisah spasi, koma, baris baru, atau teks acak)...')}
              value={sortInput}
              onChange={(e) => setSortInput(e.target.value)}
            />
          </div>

          <div className={styles.outputColumn}>
            <div className={styles.columnHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Hasil Normalisasi & Urutan Ascending</span>
                <span
                  className={styles.counterBadge}
                  style={{ backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                >
                  {sortedCLs.length} CLs
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  className={styles.selectInput}
                  value={sortDelimiter}
                  onChange={(e) => setSortDelimiter(e.target.value)}
                  style={{ padding: '3px 8px', fontSize: '12px' }}
                >
                  <option value="comma">Pemisah Koma (,)</option>
                  <option value="newline">Baris Baru (\n)</option>
                </select>
                <Button
                  variant={sortCopied ? 'success' : 'primary'}
                  size="sm"
                  icon={sortCopied ? Check : Copy}
                  disabled={sortedCLs.length === 0}
                  onClick={handleCopySort}
                >
                  {sortCopied ? 'Tersalin!' : 'Salin Hasil'}
                </Button>
              </div>
            </div>
            <textarea
              className={styles.toolTextarea}
              rows={5}
              readOnly
              placeholder={t('tools.cl_sorted_output_placeholder', 'Hasil CL yang sudah disortir dan dinormalisasi akan muncul di sini...')}
              value={sortedOutput}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Inputs Grid */}
          <div className={styles.compareGrid2}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Input CL Left
                </label>
                <span className={styles.counterBadge} style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  {preprocessCL(leftInput).length} CLs
                </span>
              </div>
              <textarea
                className={styles.toolTextarea}
                rows={5}
                placeholder={t('tools.cl_left_placeholder', 'Tempelkan CL sisi Kiri...')}
                value={leftInput}
                onChange={(e) => setLeftInput(e.target.value)}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Input CL Right
                </label>
                <span className={styles.counterBadge} style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                  {preprocessCL(rightInput).length} CLs
                </span>
              </div>
              <textarea
                className={styles.toolTextarea}
                rows={5}
                placeholder={t('tools.cl_right_placeholder', 'Tempelkan CL sisi Kanan...')}
                value={rightInput}
                onChange={(e) => setRightInput(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLeftInput('31998945, 32001000, 32011223, 32451000');
                  setRightInput('32001000, 32451000, 32550100, 32660200');
                }}
              >
                Muat Contoh Komparasi
              </Button>
              {(leftInput || rightInput) && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    setLeftInput('');
                    setRightInput('');
                  }}
                >
                  Bersihkan Keduanya
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Format:</span>
              <select
                className={styles.selectInput}
                value={compareDelimiter}
                onChange={(e) => setCompareDelimiter(e.target.value)}
                style={{ padding: '3px 8px', fontSize: '12px' }}
              >
                <option value="comma">Koma (,)</option>
                <option value="newline">Baris Baru (\n)</option>
              </select>
            </div>
          </div>

          {/* 3 Output Columns */}
          <div className={styles.compareGrid3}>
            {/* Left Only */}
            <div className={styles.outputColumn}>
              <div className={styles.columnHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Left Only</span>
                  <span className={styles.counterBadge} style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    {leftOnly.length}
                  </span>
                </div>
                <Button
                  variant={copiedColumn === 'left' ? 'success' : 'ghost'}
                  size="sm"
                  icon={copiedColumn === 'left' ? Check : Copy}
                  disabled={leftOnly.length === 0}
                  onClick={() => handleCopyColumn('left', formatList(leftOnly))}
                >
                  {copiedColumn === 'left' ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
              <textarea
                className={styles.toolTextarea}
                rows={7}
                readOnly
                placeholder="CL yang hanya ada di Left..."
                value={formatList(leftOnly)}
              />
            </div>

            {/* Common */}
            <div className={styles.outputColumn}>
              <div className={styles.columnHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Common (Keduanya)</span>
                  <span className={styles.counterBadge} style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    {common.length}
                  </span>
                </div>
                <Button
                  variant={copiedColumn === 'common' ? 'success' : 'ghost'}
                  size="sm"
                  icon={copiedColumn === 'common' ? Check : Copy}
                  disabled={common.length === 0}
                  onClick={() => handleCopyColumn('common', formatList(common))}
                >
                  {copiedColumn === 'common' ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
              <textarea
                className={styles.toolTextarea}
                rows={7}
                readOnly
                placeholder="CL yang ada di Left & Right..."
                value={formatList(common)}
              />
            </div>

            {/* Right Only */}
            <div className={styles.outputColumn}>
              <div className={styles.columnHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Right Only</span>
                  <span className={styles.counterBadge} style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                    {rightOnly.length}
                  </span>
                </div>
                <Button
                  variant={copiedColumn === 'right' ? 'success' : 'ghost'}
                  size="sm"
                  icon={copiedColumn === 'right' ? Check : Copy}
                  disabled={rightOnly.length === 0}
                  onClick={() => handleCopyColumn('right', formatList(rightOnly))}
                >
                  {copiedColumn === 'right' ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
              <textarea
                className={styles.toolTextarea}
                rows={7}
                readOnly
                placeholder="CL yang hanya ada di Right..."
                value={formatList(rightOnly)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 6. BUILD COMMAND CONVERTER TAB
// ============================================================================
const DEFAULT_BUILD_CMD =
  './build -oa -tuser -ma -i A336EDXUEGYH7 -j EGYH7 -B -Wt --sssi-build system -d low -s -r31998945 a33x_sea_open OLM OJM OLM_SUP OJM_SUP';

const BuildCommandTab = () => {
  const { t } = useTranslation();
  const [baseCmd, setBaseCmd] = useState(DEFAULT_BUILD_CMD);
  const [copiedType, setCopiedType] = useState(null); // 'user' | 'eng'

  const conversion = React.useMemo(() => {
    if (!baseCmd.trim()) {
      return {
        userText: '',
        userHtml: '',
        userChanges: [],
        engText: '',
        engHtml: '',
        engChanges: [],
      };
    }

    const customerBlockRegex = /(\w+_(?:sea|swa|eur|cis|mea|gbl)_\w+)\s+([A-Z_ ]+?)(\s*)$/;

    // 1. Process USER Command
    let userChanges = [];
    let userHtml = baseCmd;
    let userText = baseCmd;

    if (baseCmd.includes(' -ma ')) {
      userChanges.push({ from: '-ma', to: '-mc', color: styles.highlightMc });
      userHtml = userHtml.replace(' -ma ', ` <span class="${styles.highlightMc}">-mc</span> `);
      userText = userText.replace(' -ma ', ' -mc ');
    }

    const userMatch = baseCmd.match(customerBlockRegex);
    if (userMatch) {
      const allCustomerCodes = userMatch[2];
      if (/OXT/.test(allCustomerCodes)) {
        userChanges.push({ from: 'Customer Code', to: 'OLP', color: styles.highlightRegion });
        userHtml = userHtml.replace(customerBlockRegex, `$1 <span class="${styles.highlightRegion}">OLP</span>$3`);
        userText = userText.replace(customerBlockRegex, `$1 OLP$3`);
      } else if (/OLM|OJM|OXM|OXE|ODM|OLE/.test(allCustomerCodes)) {
        userChanges.push({ from: 'Customer Code', to: 'OLE', color: styles.highlightRegion });
        userHtml = userHtml.replace(customerBlockRegex, `$1 <span class="${styles.highlightRegion}">OLE</span>$3`);
        userText = userText.replace(customerBlockRegex, `$1 OLE$3`);
      }
    }

    // 2. Process ENG Command
    let engChanges = [];
    let engHtml = baseCmd;
    let engText = baseCmd;

    if (baseCmd.includes(' -ma ')) {
      engChanges.push({ from: '-ma', to: '-mc', color: styles.highlightMc });
      engHtml = engHtml.replace(' -ma ', ` <span class="${styles.highlightMc}">-mc</span> `);
      engText = engText.replace(' -ma ', ' -mc ');
    }

    const engMatch = baseCmd.match(customerBlockRegex);
    if (engMatch) {
      const allCustomerCodes = engMatch[2];
      if (/OXT/.test(allCustomerCodes)) {
        engChanges.push({ from: 'Customer Code', to: 'OLP', color: styles.highlightRegion });
        engHtml = engHtml.replace(customerBlockRegex, `$1 <span class="${styles.highlightRegion}">OLP</span>$3`);
        engText = engText.replace(customerBlockRegex, `$1 OLP$3`);
      } else if (/OLM|OJM|OXM|OXE|ODM|OLE/.test(allCustomerCodes)) {
        engChanges.push({ from: 'Customer Code', to: 'OLE', color: styles.highlightRegion });
        engHtml = engHtml.replace(customerBlockRegex, `$1 <span class="${styles.highlightRegion}">OLE</span>$3`);
        engText = engText.replace(customerBlockRegex, `$1 OLE$3`);
      }
    }

    if (baseCmd.includes(' -tuser ')) {
      engChanges.push({ from: '-tuser', to: '-teng', color: styles.highlightTeng });
      engHtml = engHtml.replace(' -tuser ', ` <span class="${styles.highlightTeng}">-teng</span> `);
      engText = engText.replace(' -tuser ', ' -teng ');
    }

    if (baseCmd.match(/\s-d\s+(low)\s/)) {
      engChanges.push({ from: '-d low', to: '-d mid', color: styles.highlightMid });
    }
    engHtml = engHtml.replace(/\s-d\s+(low|mid)\s/, ` <span class="${styles.highlightMid}">-d mid</span> `);
    engText = engText.replace(/\s-d\s+(low|mid)\s/, ' -d mid ');

    if (baseCmd.includes(' -s ')) {
      engChanges.push({ from: '-s', to: '(Hapus)', color: styles.highlightMid });
      engHtml = engHtml.replace(' -s ', ' ');
      engText = engText.replace(' -s ', ' ');
    }

    return {
      userText,
      userHtml,
      userChanges,
      engText,
      engHtml,
      engChanges,
    };
  }, [baseCmd]);

  const handleCopy = (type, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  };

  return (
    <div className={styles.toolCard}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            BASE SYSTEM_BUILD_CMD
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => setBaseCmd(DEFAULT_BUILD_CMD)}>
              Reset Contoh
            </Button>
            {baseCmd && (
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setBaseCmd('')}>
                Bersihkan
              </Button>
            )}
          </div>
        </div>
        <textarea
          className={styles.toolTextarea}
          rows={3}
          value={baseCmd}
          onChange={(e) => setBaseCmd(e.target.value)}
          placeholder={t('tools.build_cmd_placeholder', 'Masukkan perintah build dasar di sini...')}
        />
      </div>

      <div className={styles.compareGrid2}>
        {/* User Build Output */}
        <div className={styles.outputColumn}>
          <div className={styles.columnHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>INDONESIA SYSTEM_BUILD_CMD USER</span>
            </div>
            <Button
              variant={copiedType === 'user' ? 'success' : 'primary'}
              size="sm"
              icon={copiedType === 'user' ? Check : Copy}
              disabled={!conversion.userText}
              onClick={() => handleCopy('user', conversion.userText)}
            >
              {copiedType === 'user' ? 'Tersalin!' : 'Salin Perintah'}
            </Button>
          </div>

          <div
            className={styles.commandBox}
            dangerouslySetInnerHTML={{ __html: conversion.userHtml || '<em>Belum ada perintah yang dihasilkan...</em>' }}
            onClick={() => handleCopy('user', conversion.userText)}
            title="Klik untuk menyalin"
            style={{ cursor: 'pointer' }}
          />

          <div style={{ marginTop: '4px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Perubahan:</span>
            {conversion.userChanges.length > 0 ? (
              <div className={styles.summaryList}>
                {conversion.userChanges.map((ch, idx) => (
                  <span key={idx} className={styles.summaryTag}>
                    <code>{ch.from}</code> &rarr; <span className={ch.color}>{ch.to}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <em>Tidak ada perubahan dari BASE</em>
              </div>
            )}
          </div>
        </div>

        {/* Eng Build Output */}
        <div className={styles.outputColumn}>
          <div className={styles.columnHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>INDONESIA SYSTEM_BUILD_CMD ENG</span>
            </div>
            <Button
              variant={copiedType === 'eng' ? 'success' : 'primary'}
              size="sm"
              icon={copiedType === 'eng' ? Check : Copy}
              disabled={!conversion.engText}
              onClick={() => handleCopy('eng', conversion.engText)}
            >
              {copiedType === 'eng' ? 'Tersalin!' : 'Salin Perintah'}
            </Button>
          </div>

          <div
            className={styles.commandBox}
            dangerouslySetInnerHTML={{ __html: conversion.engHtml || '<em>Belum ada perintah yang dihasilkan...</em>' }}
            onClick={() => handleCopy('eng', conversion.engText)}
            title="Klik untuk menyalin"
            style={{ cursor: 'pointer' }}
          />

          <div style={{ marginTop: '4px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Perubahan:</span>
            {conversion.engChanges.length > 0 ? (
              <div className={styles.summaryList}>
                {conversion.engChanges.map((ch, idx) => (
                  <span key={idx} className={styles.summaryTag}>
                    <code>{ch.from}</code> &rarr; <span className={ch.color}>{ch.to}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <em>Tidak ada perubahan dari BASE</em>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. VIDEO COMPRESSOR TAB (Hardware VAAPI / Fast CPU Accelerated)
// ============================================================================
const VideoCompressTab = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState('');
  const [videoMeta, setVideoMeta] = useState(null); // { name, size, duration, width, height }
  const [quality, setQuality] = useState('medium'); // 'high' | 'medium' | 'low'
  const [resolution, setResolution] = useState('original'); // 'original' | '1080p' | '720p' | '480p'
  const [encoder, setEncoder] = useState('auto'); // 'auto' | 'vaapi' | 'cpu'
  const [muteAudio, setMuteAudio] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { blob, url, originalSize, compressedSize, encoderUsed, filename }

  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (result?.url) URL.revokeObjectURL(result.url);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSelectFile = (selected) => {
    if (!selected) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    if (result?.url) URL.revokeObjectURL(result.url);

    setResult(null);
    setError('');
    setFile(selected);

    const objectUrl = URL.createObjectURL(selected);
    setVideoSrc(objectUrl);

    // Extract metadata using a temporary video element
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      setVideoMeta({
        name: selected.name,
        size: selected.size,
        duration: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      });
    };
    v.src = objectUrl;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCompress = async () => {
    if (!file) return;

    setCompressing(true);
    setError('');
    setResult(null);
    setElapsedSeconds(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('quality', quality);
      formData.append('resolution', resolution);
      formData.append('encoder', encoder);
      formData.append('mute_audio', muteAudio ? 'true' : 'false');

      const response = await api.post('/utility/compress-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 600000,
      });

      const blob = response.data;
      const encoderUsed = response.headers['x-encoder-used'] || (encoder === 'cpu' ? 'libx264' : 'h264_vaapi');
      const originalSize = parseInt(response.headers['x-original-size'], 10) || file.size;
      const compressedSize = parseInt(response.headers['x-compressed-size'], 10) || blob.size;

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const downloadName = `${cleanName}_compressed.mp4`;

      const resultUrl = URL.createObjectURL(blob);
      setResult({
        blob,
        url: resultUrl,
        filename: downloadName,
        originalSize,
        compressedSize,
        encoderUsed,
      });
    } catch (err) {
      console.error('Compression failed:', err);
      let errMsg = t('common.error', 'Gagal melakukan kompresi video.');
      if (err.response?.status === 413) {
        errMsg = t('video_compress.drop_desc', 'Ukuran berkas video melebihi batas upload server (Maksimal 1 GB).');
      } else if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errMsg = json.message || errMsg;
        } catch {
          // keep default
        }
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      setError(errMsg);
    } finally {
      setCompressing(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDownloadResult = () => {
    if (!result?.blob) return;
    safeDownloadBlob(result.blob, result.filename);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Upload & Source Section */}
      <div className={styles.toolCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              {t('video_compress.select_title', 'Pilih Berkas Video')}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
              {t('video_compress.select_desc', 'Mendukung format MP4, MOV, MKV, WebM, AVI dengan akselerasi perangkat keras H.264 VAAPI.')}
            </p>
          </div>
          {file && (
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={() => {
                setFile(null);
                setVideoMeta(null);
                setResult(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              {t('video_compress.change_video', 'Ganti Video')}
            </Button>
          )}
        </div>

        {!file ? (
          <div
            className={styles.dropzone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,.mp4,.mov,.mkv,.webm,.avi"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectFile(e.target.files[0]);
                }
              }}
            />
            <div className={styles.dropzoneIcon}>
              <VideoIcon size={36} color="var(--color-accent)" />
            </div>
            <div className={styles.dropzoneTitle}>
              {t('video_compress.drop_title', 'Tarik & Letakkan Video di Sini atau Klik untuk Telusuri')}
            </div>
            <div className={styles.dropzoneSubtitle}>
              {t('video_compress.drop_desc', 'Maksimal ukuran video fleksibel (hingga 1 GB). Pemrosesan dilakukan dengan encoding H.264 VAAPI.')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Video metadata bar */}
            {videoMeta && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                flexWrap: 'wrap',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <VideoIcon size={20} color="var(--color-accent)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{videoMeta.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {formatFileSize(videoMeta.size)} • {videoMeta.width}x{videoMeta.height} px • {t('video_compress.duration', 'Durasi')}: {formatDuration(videoMeta.duration)}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--color-accent)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}>
                  {t('video_compress.ready_badge', 'Siap Dicompress')}
                </div>
              </div>
            )}

            {/* Video Compression Settings Grid */}
            <div className={styles.videoSettingsGrid}>
              {/* Setting 1: Quality Preset */}
              <div className={styles.videoSettingBlock}>
                <div className={styles.videoSettingTitle}>
                  <Sliders size={15} color="var(--color-accent)" />
                  <span>{t('video_compress.quality_title', 'Kualitas & Efisiensi')}</span>
                </div>
                <div className={styles.optionCardList}>
                  {[
                    { id: 'medium', name: t('video_compress.quality_medium', 'Medium (Rekomendasi)'), desc: t('video_compress.quality_medium_desc', 'Keseimbangan terbaik, hemat ~60-70% ukuran.'), badge: t('video_compress.optimal_badge', 'Optimal') },
                    { id: 'high', name: t('video_compress.quality_high', 'High (Kualitas Tinggi)'), desc: t('video_compress.quality_high_desc', 'Visual tajam & jernih, hemat ~35-45% ukuran.'), badge: t('video_compress.sharp_badge', 'Jernih') },
                    { id: 'low', name: t('video_compress.quality_low', 'Low (Ukuran Ringkas)'), desc: t('video_compress.quality_low_desc', 'Ukuran paling kecil, hemat hingga ~80% ukuran.'), badge: t('video_compress.small_badge', 'Kecil') },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      className={`${styles.optionCard} ${quality === opt.id ? styles.optionCardSelected : ''}`}
                      onClick={() => setQuality(opt.id)}
                    >
                      <div className={styles.optionCardText}>
                        <span className={styles.optionCardName}>{opt.name}</span>
                        <span className={styles.optionCardDesc}>{opt.desc}</span>
                      </div>
                      <span
                        className={styles.optionCardBadge}
                        style={{
                          background: quality === opt.id ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                          color: '#ffffff',
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Setting 2: Resolution Scale */}
              <div className={styles.videoSettingBlock}>
                <div className={styles.videoSettingTitle}>
                  <Gauge size={15} color="var(--color-accent)" />
                  <span>{t('video_compress.resolution_title', 'Resolusi Target')}</span>
                </div>
                <div className={styles.optionCardList}>
                  {[
                    { id: 'original', name: t('video_compress.res_original', 'Resolusi Asli'), desc: t('video_compress.res_original_desc', 'Pertahankan dimensi video asli.'), badge: 'Original' },
                    { id: '1080p', name: t('video_compress.res_1080p', '1080p Full HD'), desc: t('video_compress.res_1080p_desc', 'Downscale ke maksimal tinggi 1080px.'), badge: '1080p' },
                    { id: '720p', name: t('video_compress.res_720p', '720p HD (Cocok Berbagi)'), desc: t('video_compress.res_720p_desc', 'Sangat ideal untuk dikirim lewat chat atau email.'), badge: '720p' },
                    { id: '480p', name: t('video_compress.res_480p', '480p SD (Kecil)'), desc: t('video_compress.res_480p_desc', 'Resolusi hemat data untuk pratinjau cepat.'), badge: '480p' },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      className={`${styles.optionCard} ${resolution === opt.id ? styles.optionCardSelected : ''}`}
                      onClick={() => setResolution(opt.id)}
                    >
                      <div className={styles.optionCardText}>
                        <span className={styles.optionCardName}>{opt.name}</span>
                        <span className={styles.optionCardDesc}>{opt.desc}</span>
                      </div>
                      <span
                        className={styles.optionCardBadge}
                        style={{
                          background: resolution === opt.id ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                          color: '#ffffff',
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Setting 3: Hardware Encoder Mode */}
              <div className={styles.videoSettingBlock}>
                <div className={styles.videoSettingTitle}>
                  <Zap size={15} color="#eab308" />
                  <span>{t('video_compress.encoder_title', 'Akselerasi Perangkat Keras')}</span>
                </div>
                <div className={styles.optionCardList}>
                  {[
                    { id: 'auto', name: t('video_compress.enc_auto', 'Auto (H.264 VAAPI / GPU)'), desc: t('video_compress.enc_auto_desc', 'Otomatis gunakan akselerasi VAAPI, fallback CPU bila perlu.'), badge: 'Auto' },
                    { id: 'vaapi', name: t('video_compress.enc_vaapi', 'H.264 VAAPI (Linux GPU)'), desc: t('video_compress.enc_vaapi_desc', 'Prioritas akselerasi perangkat keras Intel/AMD/NVIDIA VAAPI.'), badge: 'VAAPI' },
                    { id: 'cpu', name: t('video_compress.enc_cpu', 'CPU Software (H.264 Veryfast)'), desc: t('video_compress.enc_cpu_desc', 'Kompresi software CPU murni (kompatibilitas tinggi).'), badge: 'CPU' },
                  ].map((opt) => (
                    <div
                      key={opt.id}
                      className={`${styles.optionCard} ${encoder === opt.id ? styles.optionCardSelected : ''}`}
                      onClick={() => setEncoder(opt.id)}
                    >
                      <div className={styles.optionCardText}>
                        <span className={styles.optionCardName}>{opt.name}</span>
                        <span className={styles.optionCardDesc}>{opt.desc}</span>
                      </div>
                      <span
                        className={styles.optionCardBadge}
                        style={{
                          background: encoder === opt.id ? '#eab308' : 'var(--color-bg-tertiary)',
                          color: encoder === opt.id ? '#000000' : '#ffffff',
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Audio Mute Checkbox */}
                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={muteAudio}
                      onChange={(e) => setMuteAudio(e.target.checked)}
                    />
                    <span>{t('video_compress.mute_label', 'Hilangkan Audio (Mute) untuk ukuran lebih kecil')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: '13px',
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              {compressing && (
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={14} className="spin" />
                  <span>
                    {t('video_compress.processing', 'Memproses dengan {{encoder}} ({{time}}s)...', {
                      encoder: encoder === 'cpu' ? 'CPU Software' : 'Akselerasi H.264 VAAPI',
                      time: elapsedSeconds,
                    })}
                  </span>
                </div>
              )}
              <Button
                variant="primary"
                icon={Zap}
                onClick={handleCompress}
                disabled={compressing}
              >
                {compressing
                  ? t('video_compress.btn_compressing', 'Sedang Mengompres Video...')
                  : t('video_compress.btn_compress', 'Mulai Kompresi Video')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Result Section */}
      {result && (
        <div className={styles.toolCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {t('video_compress.success_title', 'Video Berhasil Dikompresi')}
              </h3>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              background: result.encoderUsed.includes('vaapi') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
              color: result.encoderUsed.includes('vaapi') ? '#10b981' : '#3b82f6',
            }}>
              {t('video_compress.engine', 'Engine')}: {result.encoderUsed.toUpperCase()}
            </span>
          </div>

          {/* Stats Comparison */}
          <div className={styles.statsComparisonBox}>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>{t('video_compress.original_size', 'Ukuran Awal')}</span>
              <span className={styles.statItemValue}>{formatFileSize(result.originalSize)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>{t('video_compress.new_size', 'Ukuran Baru')}</span>
              <span className={styles.statItemValue} style={{ color: '#10b981' }}>
                {formatFileSize(result.compressedSize)}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>{t('video_compress.space_saved', 'Penghematan')}</span>
              <span className={styles.statItemValue} style={{ color: '#10b981' }}>
                {result.originalSize > 0
                  ? `-${Math.max(0, Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100))}%`
                  : '0%'}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>{t('video_compress.encoder_title', 'Akselerasi')}</span>
              <span className={styles.statItemValue} style={{ fontSize: '15px' }}>
                {result.encoderUsed.includes('vaapi') ? 'H.264 VAAPI (GPU)' : 'CPU Veryfast'}
              </span>
            </div>
          </div>

          {/* Embedded Video Player */}
          <div className={styles.videoPlayerContainer}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {t('video_compress.preview_title', 'Pratinjau Video Terkompresi')}:
            </span>
            <video
              src={result.url}
              controls
              className={styles.videoElement}
            />
          </div>

          {/* Download Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button
              variant="primary"
              icon={Download}
              onClick={handleDownloadResult}
            >
              {t('video_compress.download_btn', 'Unduh Video Terkompresi')} ({formatFileSize(result.compressedSize)})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 8. POWERPOINT AUTO SUMMARY TAB (Python Backend Bridge)
// ============================================================================
// ponytail: Clean, lightweight, modular PPTX auto-summary with dual-engine parser
const PPTXAutoSummaryTab = () => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState('table'); // 'table' | 'ai-chat'
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [results, setResults] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [excelFileName, setExcelFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // AI Chatbox states
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo! Saya asisten AI teknis SEIN Production Engineering.\n\nUnggah berkas **.pptx** di tab **File & Tabel Rekap** untuk mengekstrak data laporan defect, lalu tanyakan analisis perbandingan model, kesimpulan (conclusion), maupun rekomendasi countermeasure di sini.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const chatMessagesEndRef = useRef(null);

  useEffect(() => {
    if (subTab === 'ai-chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, subTab]);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const addPptxFiles = (incomingFiles) => {
    const valid = Array.from(incomingFiles).filter((f) =>
      f.name.toLowerCase().endsWith('.pptx') && !f.name.startsWith('~$')
    );
    if (valid.length === 0) {
      setErrorMsg('Hanya berkas presentasi PowerPoint (.pptx) yang didukung.');
      return;
    }
    setErrorMsg(null);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const newItems = valid
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          name: f.name,
          size: f.size,
          status: 'ready',
        }));
      return [...prev, ...newItems];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addPptxFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addPptxFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
    setResults([]);
    setDownloadUrl('');
    setExcelFileName('');
    setErrorMsg(null);
  };

  const handleExecuteSummary = async () => {
    if (files.length === 0) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'processing' })));

    try {
      const formData = new FormData();
      files.forEach((item) => {
        formData.append('files', item.file);
      });

      const response = await api.post('/utility/pptx-summary', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = response.data;
      if (data.items && Array.isArray(data.items)) {
        setResults(data.items);
        setDownloadUrl(data.download_url || '');
        setExcelFileName(data.excel_file || 'Summary_Report.xlsx');
        setFiles((prev) => prev.map((f) => ({ ...f, status: 'done' })));

        // Update welcome message in AI chatbox with extracted context notification
        setChatMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            role: 'assistant',
            content: `✅ **Ekstraksi Berhasil!** Sebanyak **${data.items.length} berkas PowerPoint** telah siap dianalisis.\n\nKlik saran prompt di bawah atau tanyakan apapun mengenai ringkasan problem, perbandingan defect, dan countermeasure-nya.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setErrorMsg(data.error || 'Gagal membaca format data hasil ekstraksi.');
        setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' })));
      }
    } catch (err) {
      console.error('PPTX summary error:', err);
      const msg = err.response?.data?.message || err.response?.data?.details || err.message || 'Eksekusi gagal';
      setErrorMsg(`Eksekusi Python Backend Gagal: ${msg}`);
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' })));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!downloadUrl) return;
    try {
      const resp = await api.get(downloadUrl, { responseType: 'blob' });
      safeDownloadBlob(resp.data, excelFileName || 'Summary_Report.xlsx');
    } catch (err) {
      console.error('Download excel error:', err);
      setErrorMsg('Gagal mengunduh file Excel.');
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = [
      'File Name',
      'Model',
      'Problem',
      'CN',
      'Defect Date',
      'Defect Location',
      'Defect Qty',
      'Symptom/Analysis/Conclusion',
      'Action & Countermeasure',
    ];

    const escapeCsv = (val) => {
      const s = String(val || '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [headers.join(',')];
    filteredResults.forEach((row) => {
      csvRows.push(headers.map((h) => escapeCsv(row[h])).join(','));
    });

    const csvBlob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    safeDownloadBlob(csvBlob, (excelFileName || 'Summary_Report').replace(/\.xlsx$/i, '') + '.csv');
  };

  const handleCopyTable = () => {
    if (results.length === 0) return;
    const headers = [
      'File Name',
      'Model',
      'Problem',
      'CN',
      'Defect Date',
      'Defect Location',
      'Defect Qty',
      'Symptom/Analysis/Conclusion',
      'Action & Countermeasure',
    ];

    const lines = [headers.join('\t')];
    filteredResults.forEach((row) => {
      lines.push(headers.map((h) => String(row[h] || '').replace(/\r?\n/g, ' ')).join('\t'));
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return results;
    const q = searchQuery.toLowerCase();
    return results.filter((item) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [results, searchQuery]);

  const uniqueModels = useMemo(() => {
    const s = new Set();
    results.forEach((r) => {
      if (r.Model && r.Model.trim()) s.add(r.Model.trim());
    });
    return Array.from(s);
  }, [results]);

  // AI Chat Handler
  const handleSendChatMessage = async (textToSend) => {
    const messageText = (textToSend || chatInput).trim();
    if (!messageText || isAiThinking) return;

    const userMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsAiThinking(true);

    try {
      // Build context summary from extracted results if available
      let systemPrompt = `Anda adalah asisten AI senior spesialis Production Engineering (PE) di PT Samsung Electronics Indonesia (SEIN). 
Tugas Anda adalah menganalisis, merangkum, dan memberikan rekomendasi teknis berdasarkan data laporan PowerPoint yang diunggah.
Jawab dengan format terstruktur, jelas, profesional, menggunakan istilah teknis manufaktur elektronik (Model, Problem, CN, Defect Date, Symptom/Analysis/Conclusion, Action & Countermeasure).`;

      if (results.length > 0) {
        const formattedContext = results
          .map(
            (r, i) =>
              `[Laporan #${i + 1}]\n- File: ${r['File Name']}\n- Model: ${r['Model'] || '-'}\n- Problem: ${r['Problem'] || '-'}\n- CN: ${r['CN'] || '-'}\n- Defect Date: ${r['Defect Date'] || '-'}\n- Location: ${r['Defect Location'] || '-'}\n- Qty: ${r['Defect Qty'] || '-'}\n- Symptom/Analysis/Conclusion: ${r['Symptom/Analysis/Conclusion'] || '-'}\n- Action & Countermeasure: ${r['Action & Countermeasure'] || '-'}`
          )
          .join('\n\n---\n\n');

        systemPrompt += `\n\nBERIKUT ADALAH DATA HASIL EKSTRAKSI DARI ${results.length} BERKAS POWERPOINT:\n${formattedContext}\n\nGunakan data di atas sebagai referensi utama dalam menjawab pertanyaan user.`;
      }

      // Prepare payload for backend /ai/chat
      const historyPayload = [
        { role: 'system', content: systemPrompt },
        ...chatMessages
          .filter((m) => m.id !== 'welcome')
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: messageText },
      ];

      const res = await api.post('/ai/chat', { messages: historyPayload });
      const reply = res.data?.reply || 'Tidak ada balasan dari AI.';

      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.warn('AI Chat Error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Gagal memanggil endpoint AI.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `⚠️ **Gagal memanggil AI:** ${errMsg}\n\nPastikan koneksi AI / LM Studio aktif di pengaturan server PE-Portal.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  const promptSuggestions = [
    { label: '📊 Ringkasan Seluruh Defect', prompt: 'Buatkan ringkasan komprehensif mengenai seluruh defect dan problem yang ditemukan pada berkas PowerPoint yang diunggah.' },
    { label: '🔍 Analisis Model & Frekuensi', prompt: 'Model mana saja yang mengalami defect? Analisis frekuensi kejadian dan tingkat keparahannya berdasarkan data laporan.' },
    { label: '🛠️ Daftar Action & Countermeasure', prompt: 'Rangkum seluruh Action & Countermeasure yang telah direncanakan untuk masing-masing problem dalam bentuk daftar poin tindakan prioritas.' },
    { label: '📋 Format Executive Summary', prompt: 'Buatkan draft Executive Summary 1 halaman formal untuk dilaporkan kepada manajemen/pimpinan mengenai status investigasi defect ini.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tab Switcher Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSubTab('table')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: subTab === 'table' ? '#1F4E78' : 'var(--color-bg-secondary)',
              color: subTab === 'table' ? '#ffffff' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>File &amp; Tabel Rekapitulasi</span>
            {files.length > 0 && (
              <span style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: subTab === 'table' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-primary)',
                color: subTab === 'table' ? '#ffffff' : 'var(--color-text-primary)',
              }}>
                {results.length > 0 ? `${results.length} diekstrak` : `${files.length} siap`}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('ai-chat')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: subTab === 'ai-chat' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              color: subTab === 'ai-chat' ? '#ffffff' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Bot size={16} />
            <span>AI Summary Chatbox Interaktif</span>
            {results.length > 0 && (
              <span style={{
                fontSize: '10.5px',
                padding: '2px 7px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
              }}>
                Ready
              </span>
            )}
          </button>
        </div>

        {results.length > 0 && subTab === 'table' && (
          <Button
            variant="secondary"
            size="sm"
            icon={Bot}
            onClick={() => setSubTab('ai-chat')}
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
          >
            Tanya AI tentang data ini ➔
          </Button>
        )}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: FILE & TABEL REKAPITULASI                                  */}
      {/* ================================================================= */}
      {subTab === 'table' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dropzone Area */}
          <div
            className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <Presentation size={48} className={styles.dropzoneIcon} />
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>
                Tarik &amp; Lepaskan berkas PowerPoint (.pptx) ke sini
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                atau klik untuk memilih multiple berkas PowerPoint dari perangkat Anda
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 600 }}>
                PowerPoint (.pptx)
              </span>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 600 }}>
                Multi-file Batch
              </span>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontWeight: 600 }}>
                Auto Extraction
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Queued Files List */}
          {files.length > 0 && (
            <div style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileStack size={18} color="var(--color-accent)" />
                  <strong style={{ fontSize: '14px' }}>
                    Antrean Berkas ({files.length} file dipilih)
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Trash2}
                    onClick={handleClearAll}
                    disabled={isExecuting}
                  >
                    Kosongkan
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={isExecuting ? RefreshCw : Sparkles}
                    onClick={handleExecuteSummary}
                    disabled={isExecuting}
                    style={{
                      backgroundColor: '#1F4E78',
                      borderColor: '#1F4E78',
                      color: '#ffffff',
                    }}
                  >
                    {isExecuting ? 'Mengekstrak via Python...' : '⚡ Eksekusi Auto Summary (Python)'}
                  </Button>
                </div>
              </div>

              {/* Files Chips / Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '8px',
                maxHeight: '190px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}>
                {files.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <Presentation size={15} color="#e05780" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.name}>
                          {item.name}
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)' }}>
                          {formatFileSize(item.size)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.status === 'processing' && (
                        <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
                      )}
                      {item.status === 'done' && <CheckCircle2 size={14} color="#10b981" />}
                      {item.status === 'error' && <AlertCircle size={14} color="#ef4444" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(item.id);
                        }}
                        disabled={isExecuting}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                        title="Hapus berkas ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <div style={{
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {/* KPI Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}>
                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Berkas PPTX
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--color-text-primary)' }}>
                    {results.length}
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Model Teridentifikasi
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#38bdf8' }}>
                    {uniqueModels.length > 0 ? uniqueModels.length : '-'}
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Status Pemrosesan
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> 100% Selesai
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(31, 78, 120, 0.1)',
                  border: '1px solid #1F4E78',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '6px',
                }}>
                  <span style={{ fontSize: '11px', color: '#1F4E78', fontWeight: 700 }}>
                    Hasil Excel Terformat SEIN
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#1F4E78',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <Download size={14} />
                    <span>Unduh Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Table Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '6px',
              }}>
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  width: '100%',
                  maxWidth: '320px',
                }}>
                  <Search size={15} color="var(--color-text-muted)" />
                  <input
                    type="text"
                    placeholder="Cari Model, Problem, CN, Lokasi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Export & Copy Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Bot}
                    onClick={() => setSubTab('ai-chat')}
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                  >
                    Tanya AI
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied ? Check : Copy}
                    onClick={handleCopyTable}
                    title="Salin seluruh baris tabel ke clipboard"
                  >
                    {copied ? 'Tersalin!' : 'Copy Tabel'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FileSpreadsheet}
                    onClick={handleExportCSV}
                    title="Download dalam format CSV"
                  >
                    Unduh CSV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownloadExcel}
                    style={{
                      backgroundColor: '#1F4E78',
                      borderColor: '#1F4E78',
                      color: '#ffffff',
                    }}
                    title="Download dalam format Excel (.xlsx)"
                  >
                    Download Excel (.xlsx)
                  </Button>
                </div>
              </div>

              {/* Data Table */}
              <div style={{
                overflowX: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                backgroundColor: 'var(--color-bg-primary)',
                maxHeight: '520px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#1F4E78',
                      color: '#ffffff',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                    }}>
                      <th style={{ padding: '10px 12px', width: '38px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px 12px', minWidth: '150px' }}>File Name</th>
                      <th style={{ padding: '10px 12px', minWidth: '110px' }}>Model</th>
                      <th style={{ padding: '10px 12px', minWidth: '140px' }}>Problem</th>
                      <th style={{ padding: '10px 12px', minWidth: '110px' }}>CN</th>
                      <th style={{ padding: '10px 12px', minWidth: '100px' }}>Defect Date</th>
                      <th style={{ padding: '10px 12px', minWidth: '120px' }}>Location</th>
                      <th style={{ padding: '10px 12px', minWidth: '80px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '10px 12px', minWidth: '220px' }}>Symptom / Conclusion</th>
                      <th style={{ padding: '10px 12px', minWidth: '220px' }}>Action &amp; Countermeasure</th>
                      <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Tidak ada data yang cocok dengan pencarian "{searchQuery}"
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            backgroundColor: idx % 2 === 0 ? 'var(--color-bg-primary)' : 'rgba(255, 255, 255, 0.02)',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'var(--color-bg-primary)' : 'rgba(255, 255, 255, 0.02)')}
                        >
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Presentation size={13} color="#e05780" style={{ flexShrink: 0 }} />
                              <span style={{ wordBreak: 'break-word' }}>{row['File Name']}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {row['Model'] ? (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                fontWeight: 700,
                                fontSize: '11px',
                              }}>
                                {row['Model']}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                            {row['Problem'] || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            {row['CN'] || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                            {row['Defect Date'] || '-'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {row['Defect Location'] || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                            {row['Defect Qty'] || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                            <div style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                              color: 'var(--color-text-secondary)',
                              whiteSpace: 'pre-wrap',
                            }}>
                              {row['Symptom/Analysis/Conclusion'] || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                            <div style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                              color: 'var(--color-text-secondary)',
                              whiteSpace: 'pre-wrap',
                            }}>
                              {row['Action & Countermeasure'] || '-'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedDetail(row)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-accent)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              title="Lihat detail lengkap baris ini"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: AI SUMMARY CHATBOX INTERAKTIF                               */}
      {/* ================================================================= */}
      {subTab === 'ai-chat' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
          minHeight: '560px',
        }}>
          {/* Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: 'var(--color-bg-primary)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}>
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                  PE-Portal AI Assistant — Analisis Laporan PPTX
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {results.length > 0
                    ? `Context Aktif: ${results.length} berkas PPTX (${uniqueModels.join(', ') || 'Model terdeteksi'})`
                    : 'Belum ada data file yang diekstrak. Anda dapat bertanya umum atau unggah PPTX di tab sebelah.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={Trash2}
                onClick={() =>
                  setChatMessages([
                    {
                      id: 'welcome',
                      role: 'assistant',
                      content: 'Riwayat obrolan telah dibersihkan. Silakan tanyakan hal baru seputar laporan PPTX.',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
              >
                Reset Chat
              </Button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderBottom: '1px solid var(--color-border)',
            overflowX: 'auto',
          }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              Saran Cepat:
            </span>
            {promptSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendChatMessage(item.prompt)}
                disabled={isAiThinking}
                style={{
                  padding: '5px 10px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: isAiThinking ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isAiThinking) e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Chat Messages Flow */}
          <div style={{
            flex: 1,
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            maxHeight: '440px',
          }}>
            {chatMessages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAssistant ? 'flex-start' : 'flex-end',
                    gap: '4px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    padding: '0 4px',
                  }}>
                    {isAssistant && <Bot size={12} color="#38bdf8" />}
                    <span>{isAssistant ? 'PE AI Assistant' : 'Anda'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: isAssistant ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                    backgroundColor: isAssistant ? 'var(--color-bg-primary)' : 'var(--color-accent)',
                    color: isAssistant ? 'var(--color-text-primary)' : '#ffffff',
                    border: isAssistant ? '1px solid var(--color-border)' : 'none',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    position: 'relative',
                  }}>
                    {msg.content}

                    {isAssistant && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '8px',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedMsgId === msg.id ? '#10b981' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 4px',
                          }}
                          title="Salin pesan balasan ini"
                        >
                          {copiedMsgId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedMsgId === msg.id ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isAiThinking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', color: 'var(--color-text-secondary)', fontSize: '12.5px' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
                <span>AI sedang menganalisis data laporan PPTX...</span>
              </div>
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Input & Action Bar */}
          <div style={{
            padding: '14px 18px',
            backgroundColor: 'var(--color-bg-primary)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end',
          }}>
            <textarea
              rows={2}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              placeholder={
                results.length > 0
                  ? 'Tanyakan apa saja mengenai laporan PowerPoint di atas (Tekan Enter untuk mengirim)...'
                  : 'Ketik pertanyaan untuk AI (Tekan Enter untuk mengirim)...'
              }
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            <Button
              variant="primary"
              icon={isAiThinking ? RefreshCw : Send}
              onClick={() => handleSendChatMessage()}
              disabled={!chatInput.trim() || isAiThinking}
              style={{
                height: '42px',
                padding: '0 18px',
                backgroundColor: 'var(--color-accent)',
                borderColor: 'var(--color-accent)',
              }}
            >
              {isAiThinking ? 'Proses...' : 'Kirim'}
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <Modal
          isOpen={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          title={`Detail Report: ${selectedDetail['File Name']}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Model</span>
                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{selectedDetail['Model'] || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Problem</span>
                <div style={{ fontWeight: 600 }}>{selectedDetail['Problem'] || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>CN</span>
                <div style={{ fontFamily: 'monospace' }}>{selectedDetail['CN'] || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Defect Date</span>
                <div>{selectedDetail['Defect Date'] || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Location</span>
                <div>{selectedDetail['Defect Location'] || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Qty</span>
                <div style={{ fontWeight: 600 }}>{selectedDetail['Defect Qty'] || '-'}</div>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                Symptom / Analysis / Conclusion:
              </strong>
              <div style={{
                marginTop: '6px',
                padding: '12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                color: 'var(--color-text-secondary)',
                maxHeight: '180px',
                overflowY: 'auto',
              }}>
                {selectedDetail['Symptom/Analysis/Conclusion'] || '(Tidak ditemukan)'}
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                Action &amp; Countermeasure:
              </strong>
              <div style={{
                marginTop: '6px',
                padding: '12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                color: 'var(--color-text-secondary)',
                maxHeight: '180px',
                overflowY: 'auto',
              }}>
                {selectedDetail['Action & Countermeasure'] || '(Tidak ditemukan)'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setSelectedDetail(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


