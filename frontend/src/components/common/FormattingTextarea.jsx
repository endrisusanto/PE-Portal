import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Table,
  Link2,
  Minus,
  Image as ImageIcon,
  Loader2,
  Eye,
  PenTool,
  Columns,
} from 'lucide-react';
import api from '../../api/client';
import { RichNotesViewer } from './RichNotesViewer';
import styles from './FormattingTextarea.module.css';

/**
 * Apply markdown formatting to a textarea element
 */
export const applyFormat = (textarea, formatType) => {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value || '';
  const selected = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (formatType) {
    case 'bold':
      replacement = `**${selected || 'teks tebal'}**`;
      cursorOffset = selected ? replacement.length : 2;
      break;
    case 'italic':
      replacement = `*${selected || 'teks miring'}*`;
      cursorOffset = selected ? replacement.length : 1;
      break;
    case 'strike':
      replacement = `~~${selected || 'teks coret'}~~`;
      cursorOffset = selected ? replacement.length : 2;
      break;
    case 'h2':
      replacement = `\n## ${selected || 'Judul Seksi'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'h3':
      replacement = `\n### ${selected || 'Sub-judul'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'bullet':
      if (selected.includes('\n')) {
        replacement = selected.split('\n').map(l => `- ${l}`).join('\n');
      } else {
        replacement = `\n- ${selected || 'Item poin'}\n`;
      }
      cursorOffset = replacement.length;
      break;
    case 'number':
      if (selected.includes('\n')) {
        replacement = selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
      } else {
        replacement = `\n1. ${selected || 'Item pertama'}\n`;
      }
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = `\n> ${selected || 'Catatan penting'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'code':
      if (selected.includes('\n')) {
        replacement = `\n\`\`\`\n${selected || '// kode atau data'}\n\`\`\`\n`;
      } else {
        replacement = `\`${selected || 'kode'}\``;
      }
      cursorOffset = selected ? replacement.length : 1;
      break;
    case 'table':
      replacement = `\n| Item | Nilai / Spesifikasi | Status |\n|---|---|---|\n| Sample 1 | Normal | PASS |\n| Sample 2 | 3.85V | OK |\n`;
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = `[${selected || 'Tautan Link'}](https://)`;
      cursorOffset = replacement.length - 1;
      break;
    case 'image':
      replacement = `\n![${selected || 'Keterangan Gambar'}|75%](https://)\n`;
      cursorOffset = replacement.length - 2;
      break;
    case 'hr':
      replacement = `\n---\n`;
      cursorOffset = replacement.length;
      break;
    default:
      return;
  }

  textarea.focus();
  let inserted = false;
  if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
    inserted = document.execCommand('insertText', false, replacement);
  }
  if (!inserted) {
    const newText = text.substring(0, start) + replacement + text.substring(end);
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, newText);
    } else {
      textarea.value = newText;
    }
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
  }

  const newPos = start + cursorOffset;
  textarea.setSelectionRange(newPos, newPos);
};

/**
 * Reusable Formatting Toolbar Component
 */
export const FormattingToolbar = ({
  textareaRef,
  onFormat,
  activeTab = 'write',
  onTabChange = null,
}) => {
  const imageInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleAction = (type) => {
    if (onFormat) {
      onFormat(type);
    } else if (textareaRef?.current) {
      applyFormat(textareaRef.current, type);
    }
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/comments/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = res.data.url;
      const fileName = res.data.name || file.name || 'Foto Lampiran';
      // ponytail: default to 75% width dimension preset for balanced layout
      const imgMarkdown = `\n![${fileName}|75%](${fileUrl})\n`;

      if (textareaRef?.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const text = textarea.value || '';
        textarea.focus();
        let inserted = false;
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          inserted = document.execCommand('insertText', false, imgMarkdown);
        }
        if (!inserted) {
          const newText = text.substring(0, start) + imgMarkdown + text.substring(end);
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(textarea, newText);
          } else {
            textarea.value = newText;
          }
          const ev = new Event('input', { bubbles: true });
          textarea.dispatchEvent(ev);
        }
        const newPos = start + imgMarkdown.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    } catch (err) {
      const altUrl = prompt('Gagal mengunggah gambar otomatis. Masukkan URL Gambar langsung:', 'https://');
      if (altUrl && textareaRef?.current) {
        const fallbackMarkdown = `\n![Foto Lampiran|75%](${altUrl})\n`;
        const textarea = textareaRef.current;
        textarea.focus();
        document.execCommand('insertText', false, fallbackMarkdown);
      }
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('bold')}
        title="Tebal / Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('italic')}
        title="Miring / Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('strike')}
        title="Coret / Strikethrough"
      >
        <Strikethrough size={13} />
      </button>

      <span className={styles.toolDivider} />

      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('h2')}
        title="Judul Utama (H2)"
      >
        <Heading2 size={14} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('h3')}
        title="Sub-judul (H3)"
      >
        <Heading3 size={14} />
      </button>

      <span className={styles.toolDivider} />

      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('bullet')}
        title="Daftar Poin (Bullet List)"
      >
        <List size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('number')}
        title="Daftar Nomor (Numbered List)"
      >
        <ListOrdered size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('quote')}
        title="Kutipan / Catatan (Blockquote)"
      >
        <Quote size={13} />
      </button>

      <span className={styles.toolDivider} />

      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('code')}
        title="Blok Kode / Monospace"
      >
        <Code size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('table')}
        title="Sisipkan Format Tabel Markdown"
      >
        <Table size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => {
          if (imageInputRef.current) {
            imageInputRef.current.click();
          } else {
            handleAction('image');
          }
        }}
        disabled={uploadingImage}
        title="Sisipkan / Unggah Gambar (Foto Bukti Lampiran)"
      >
        {uploadingImage ? (
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <ImageIcon size={13} />
        )}
      </button>
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('link')}
        title="Tautan / Link URL"
      >
        <Link2 size={13} />
      </button>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => handleAction('hr')}
        title="Garis Pemisah (Horizontal Rule)"
      >
        <Minus size={13} />
      </button>

      {/* View Mode Toggle: Tulis / Pratinjau / Split */}
      {onTabChange && (
        <div className={styles.viewModeGroup}>
          <button
            type="button"
            className={`${styles.modeBtn} ${activeTab === 'write' ? styles.modeBtnActive : ''}`}
            onClick={() => onTabChange('write')}
            title="Mode Tulis / Edit Markdown"
          >
            <PenTool size={11} />
            <span>Tulis</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${activeTab === 'preview' ? styles.modeBtnActive : ''}`}
            onClick={() => onTabChange('preview')}
            title="Pratinjau Hasil Render (Tabel & Gambar Resizable)"
          >
            <Eye size={11} />
            <span>Pratinjau</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${activeTab === 'split' ? styles.modeBtnActive : ''}`}
            onClick={() => onTabChange('split')}
            title="Tampilan Berdampingan (Editor & Pratinjau)"
          >
            <Columns size={11} />
            <span>Split</span>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Textarea wrapped with FormattingToolbar & Live Render Preview
 */
export const FormattingTextarea = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  required = false,
  name,
  style,
  minHeight = '120px',
  defaultTab = 'write',
}) => {
  const textareaRef = useRef(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormat(textareaRef.current, 'bold');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormat(textareaRef.current, 'italic');
    }
  };

  const safeValue = typeof value === 'string'
    ? value
    : (value != null && typeof value !== 'object' ? String(value) : '');

  // ponytail: handle image resize or text changes from preview tab
  const handleUpdateContent = (newContent) => {
    if (onChange) {
      onChange({ target: { name, value: newContent } });
    }
  };

  return (
    <div className={styles.container} style={style}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.toolbarWrapper}>
        <FormattingToolbar
          textareaRef={textareaRef}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Mode: Tulis (Editor Only) */}
        {activeTab === 'write' && (
          <textarea
            ref={textareaRef}
            name={name}
            rows={rows}
            required={required}
            value={safeValue}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={styles.textarea}
            style={{ minHeight }}
          />
        )}

        {/* Mode: Pratinjau (Rendered Table & Resizable Images) */}
        {activeTab === 'preview' && (
          <div className={styles.previewContainer} style={{ minHeight }}>
            {safeValue.trim() ? (
              <RichNotesViewer
                content={safeValue}
                onUpdateContent={handleUpdateContent}
              />
            ) : (
              <div className={styles.emptyPreview}>
                <span style={{ fontWeight: 600 }}>Belum ada konten untuk dipratinjau.</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Gunakan tombol pada toolbar di atas untuk menyisipkan Tabel atau mengunggah Foto PBA pada tab Tulis.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Mode: Split (Side-by-Side Editor & Preview) */}
        {activeTab === 'split' && (
          <div className={styles.splitContainer}>
            <div className={styles.splitEditor}>
              <textarea
                ref={textareaRef}
                name={name}
                rows={rows}
                required={required}
                value={safeValue}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={styles.textarea}
                style={{ minHeight }}
              />
            </div>
            <div className={styles.splitPreview} style={{ minHeight }}>
              {safeValue.trim() ? (
                <RichNotesViewer
                  content={safeValue}
                  onUpdateContent={handleUpdateContent}
                />
              ) : (
                <div className={styles.emptyPreview}>
                  <span style={{ fontWeight: 600 }}>Pratinjau Langsung</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Ketik teks atau sisipkan tabel di kiri untuk melihat hasil di sini.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormattingTextarea;
