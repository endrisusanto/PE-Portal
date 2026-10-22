import React, { useState } from 'react';
import {
  File,
  FileText,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Image as ImageIcon,
  FileCode,
  X,
  Presentation,
  Archive,
} from 'lucide-react';
import styles from './AttachmentViewer.module.css';

export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentViewer = ({
  attachments = [],
  onRemove = null,
  readonly = true,
  className = '',
}) => {
  const [activePreview, setActivePreview] = useState(null);

  let parsed = attachments;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const getFileIcon = (item) => {
    const ext = (item.name || '').split('.').pop().toLowerCase();
    const type = item.type || '';

    if (type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
      return { icon: <ImageIcon size={15} />, class: styles.iconImage };
    }
    if (type === 'pdf' || ext === 'pdf') {
      return { icon: <FileText size={15} />, class: styles.iconPdf };
    }
    if (type === 'excel' || ['xlsx', 'xls', 'csv'].includes(ext)) {
      return { icon: <FileSpreadsheet size={15} />, class: styles.iconExcel };
    }
    if (type === 'word' || ['doc', 'docx'].includes(ext)) {
      return { icon: <FileText size={15} />, class: styles.iconWord };
    }
    if (type === 'presentation' || ['ppt', 'pptx'].includes(ext)) {
      return { icon: <Presentation size={15} />, class: styles.iconWord };
    }
    if (type === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return { icon: <Archive size={15} />, class: styles.iconCode };
    }
    if (type === 'code' || ['json', 'sql', 'log', 'txt', 'py', 'go', 'js', 'ts'].includes(ext)) {
      return { icon: <FileCode size={15} />, class: styles.iconCode };
    }
    return { icon: <File size={15} />, class: styles.iconFile };
  };

  const images = [];
  const otherFiles = [];

  parsed.forEach((item, index) => {
    const ext = (item.name || '').split('.').pop().toLowerCase();
    const isImg = item.type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    if (isImg) {
      images.push({ ...item, originalIndex: index });
    } else {
      otherFiles.push({ ...item, originalIndex: index });
    }
  });

  return (
    <div className={`${styles.attachmentsContainer} ${className}`}>
      {/* Images Grid */}
      {images.length > 0 && (
        <div className={styles.attachmentsGrid}>
          {images.map((img) => (
            <div
              key={img.originalIndex}
              className={styles.imageCard}
              onClick={() => setActivePreview(img)}
              title={`Klik untuk memperbesar: ${img.name}`}
            >
              <img
                src={img.url}
                alt={img.name}
                className={styles.thumbnailImg}
                loading="lazy"
              />
              <div className={styles.imageOverlay}>
                <span className={styles.imageCaption}>{img.name}</span>
              </div>
              {!readonly && onRemove && (
                <button
                  type="button"
                  className={styles.removeFloatingBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(img.originalIndex);
                  }}
                  title="Hapus lampiran"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Files List */}
      {otherFiles.length > 0 && (
        <div className={styles.attachmentsGrid}>
          {otherFiles.map((file) => {
            const { icon, class: iconCls } = getFileIcon(file);
            return (
              <div key={file.originalIndex} className={styles.attachmentCard}>
                <div className={`${styles.iconWrapper} ${iconCls}`}>
                  {icon}
                </div>
                <div className={styles.metaCol}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.fileName}
                    title={file.name}
                  >
                    {file.name}
                  </a>
                  {file.size && (
                    <span className={styles.fileSize}>
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </div>
                <a
                  href={file.url}
                  download={file.name}
                  className={`${styles.actionBtn} ${styles.downloadBtn}`}
                  title="Unduh file"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={13} />
                </a>
                {!readonly && onRemove && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onRemove(file.originalIndex)}
                    title="Hapus lampiran"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview */}
      {activePreview && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setActivePreview(null)}
        >
          <div className={styles.lightboxHeader}>
            <a
              href={activePreview.url}
              download={activePreview.name}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionBtn}
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '6px' }}
              title="Unduh Gambar Asli"
            >
              <Download size={16} />
            </a>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setActivePreview(null)}
              style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '6px' }}
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={activePreview.url}
            alt={activePreview.name}
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
          <span className={styles.lightboxTitle}>{activePreview.name}</span>
        </div>
      )}
    </div>
  );
};
