import React, { useRef } from 'react';
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
  Minus
} from 'lucide-react';
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
export const FormattingToolbar = ({ textareaRef, onFormat }) => {
  const handleAction = (type) => {
    if (onFormat) {
      onFormat(type);
    } else if (textareaRef?.current) {
      applyFormat(textareaRef.current, type);
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
        title="Format Tabel Markdown"
      >
        <Table size={13} />
      </button>
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
    </div>
  );
};

/**
 * Textarea wrapped with FormattingToolbar
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
  minHeight = '100px'
}) => {
  const textareaRef = useRef(null);

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

  return (
    <div className={styles.container} style={style}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.toolbarWrapper}>
        <FormattingToolbar textareaRef={textareaRef} />
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
    </div>
  );
};

export default FormattingTextarea;
