import React, { useState, useRef, useEffect } from 'react';
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
  FileText
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import styles from './UtilityPage.module.css';

export const UtilityPage = () => {
  const { t } = useTranslation();
  const { tab } = useParams();

  // Active Tab from route parameter: 'images', 'documents', 'remove-bg'
  const activeTab = tab || 'images';

  const toolMeta = {
    images: {
      title: t('nav.tools_images', 'Image Converter & Compress'),
      subtitle: 'Bulk konversi format gambar (WEBP, JPEG, PNG, AVIF) & kompresi ukuran instan secara lokal di browser.',
      icon: ImageIcon,
    },
    documents: {
      title: t('nav.tools_docs', 'Document PDF Compress'),
      subtitle: 'Kompresi file dokumen PDF secara aman dan lokal tanpa upload ke server eksternal.',
      icon: FileArchive,
    },
    'remove-bg': {
      title: t('nav.tools_bg', 'Local Remove Background'),
      subtitle: 'Penghapusan background gambar menjadi format PNG transparan secara lokal & instan.',
      icon: Scissors,
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
    </div>
  );
};

// ============================================================================
// 1. IMAGE CONVERTER & COMPRESS TAB (100% Browser Local)
// ============================================================================
const ImageConverterTab = () => {
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
    const a = document.createElement('a');
    a.href = item.convertedUrl;
    a.download = item.convertedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = () => {
    files.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 200);
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
            <span className={styles.controlLabel}>Format Target</span>
            <select
              className={styles.selectInput}
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value)}
            >
              <option value="image/webp">WEBP (Modern & Ringan)</option>
              <option value="image/jpeg">JPEG / JPG (Universal)</option>
              <option value="image/png">PNG (Lossless / Transparent)</option>
            </select>
          </div>

          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>Kualitas: {quality}%</span>
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
            <span className={styles.controlLabel}>Maksimum Resolusi</span>
            <select
              className={styles.selectInput}
              value={maxDimension}
              onChange={(e) => setMaxDimension(e.target.value)}
            >
              <option value="original">Resolusi Asli (Original)</option>
              <option value="1920">Full HD (Max 1920px)</option>
              <option value="1280">HD (Max 1280px)</option>
              <option value="800">Compact (Max 800px)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {files.length > 0 && (
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={handleReapply} loading={processing}>
                Konversi Ulang
              </Button>
              <Button variant="secondary" icon={Trash2} onClick={handleClear}>
                Hapus Semua
              </Button>
              <Button variant="primary" icon={Download} onClick={handleDownloadAll}>
                Unduh Semua ({files.length})
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
            Tarik & Lepas gambar di sini, atau <span style={{ color: 'var(--color-accent)' }}>klik untuk memilih</span>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Mendukung file JPG, PNG, WEBP, AVIF, BMP, GIF dalam jumlah banyak (bulk)
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
              Daftar Hasil Konversi ({files.length} file)
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
                      {item.convertedSize ? formatBytes(item.convertedSize) : 'Menghitung...'}
                    </span>
                  </div>

                  {item.savings !== undefined && item.savings > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <span className={styles.savingsBadge}>
                        Hemat {item.savings}%
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
                  Unduh File
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
      alert('Silakan pilih dokumen berformat PDF.');
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
    const a = document.createElement('a');
    a.href = url;
    a.download = item.compressedUrl ? `compressed_${item.name}` : item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Control Bar */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <div className={styles.controlItem}>
            <span className={styles.controlLabel}>Tingkat Kompresi Dokumen</span>
            <select
              className={styles.selectInput}
              value={compressionPreset}
              onChange={(e) => setCompressionPreset(e.target.value)}
            >
              <option value="screen">Tinggi / Email (72 DPI - Ukuran Terkecil)</option>
              <option value="ebook">Standar Seimbang (150 DPI - Teks & Grafik Tajam)</option>
              <option value="printer">Ringan / Cetak (300 DPI - Diagram Presisi Tinggi)</option>
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
                Mulai Kompresi ({docs.length} Dokumen)
              </Button>
              <Button variant="secondary" icon={Trash2} onClick={() => setDocs([])}>
                Bersihkan
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
            Tarik & Lepas dokumen PDF di sini, atau <span style={{ color: 'var(--color-accent)' }}>klik untuk memilih</span>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Memproses kompresi stream dokumen PDF secara lokal menggunakan Ghostscript engine.
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
                    Ukuran Asli: {formatBytes(doc.originalSize)}
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
                      Hemat {doc.savings}%
                    </span>
                  </div>
                )}

                {doc.status === 'error' && (
                  <span style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} />
                    {doc.errorMessage || 'Gagal memproses'}
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
                  title="Shortcut Preview PDF"
                >
                  Preview PDF
                </Button>

                {doc.status === 'done' ? (
                  <Button variant="primary" size="sm" icon={Download} onClick={() => handleDownloadPdf(doc)}>
                    Unduh PDF
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={doc.status === 'processing'}
                    disabled={compressing || doc.status === 'processing'}
                    onClick={() => handleCompressSingle(doc)}
                  >
                    Kompres
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDoc(doc.id)}
                  title="Hapus dari daftar"
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
        title={`Preview PDF: ${previewPdf?.name || ''} ${previewPdf?.isCompressed ? '(Terkonpresi)' : '(Asli)'}`}
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
                Buka di Tab Baru
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewPdf.url;
                  a.download = previewPdf.isCompressed ? `compressed_${previewPdf.name}` : previewPdf.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Unduh PDF
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
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file, {
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
              setAiStatusText(`Mengunduh model U2-Net: ${pct}%`);
            } else if (key.includes('wasm')) {
              setAiStatusText(`Memuat WebAssembly runtime: ${pct}%`);
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
    const link = document.createElement('a');
    link.download = `transparent_${imageFile?.name || 'cutout'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
              Pilih foto atau drag & drop gambar yang ingin dihapus background-nya
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Berjalan 100% lokal di browser dan mesin lokal tanpa upload ke API luar
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
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Gambar Asli (Klik untuk Pipet Warna)</span>
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                Ganti Gambar
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
