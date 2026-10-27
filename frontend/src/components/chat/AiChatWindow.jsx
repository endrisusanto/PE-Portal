import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Send,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Paperclip,
  Trash2,
  Settings,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import api from '../../api/client';
import styles from './AiChatWindow.module.css';

// Universal download blob helper
const downloadBlob = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ----------------------------------------------------------------------------
// 1. LIVE SVG BLOCK COMPONENT
// ----------------------------------------------------------------------------
const SvgBlock = ({ rawSvg, id }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Clean SVG code by stripping markdown fences if any
  const cleanSvg = useMemo(() => {
    let code = rawSvg.trim();
    if (code.startsWith('```svg')) code = code.replace(/^```svg\s*/i, '');
    if (code.startsWith('```xml')) code = code.replace(/^```xml\s*/i, '');
    if (code.startsWith('```')) code = code.replace(/^```\s*/, '');
    if (code.endsWith('```')) code = code.replace(/\s*```$/, '');
    return code.trim();
  }, [rawSvg]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadBlob(cleanSvg, `sein_pe_diagram_${id || Date.now()}.svg`, 'image/svg+xml');
  };

  return (
    <div className={styles.svgContainer}>
      <div className={styles.svgToolbar}>
        <div className={styles.svgTitle}>
          <Layers size={14} color="#3b82f6" />
          <span>Interactive SVG Diagram</span>
        </div>
        <div className={styles.svgActions}>
          <button
            type="button"
            className={styles.svgActionBtn}
            onClick={() => setShowCode((prev) => !prev)}
            title="Toggle Code / Preview"
          >
            {showCode ? <Eye size={12} /> : <Code2 size={12} />}
            <span>{showCode ? t('common.view', 'Lihat Preview') : 'SVG'}</span>
          </button>
          <button
            type="button"
            className={styles.svgActionBtn}
            onClick={handleCopy}
            title={t('ai_chat.copy_code', 'Salin Kode SVG')}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? t('common.copied', 'Tersalin') : t('common.copy', 'Salin')}</span>
          </button>
          <button
            type="button"
            className={styles.svgActionBtn}
            onClick={handleDownload}
            title="Download file .svg"
          >
            <Download size={12} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {showCode ? (
        <pre className={styles.svgRawCode}>{cleanSvg}</pre>
      ) : (
        <div
          className={styles.svgPreviewBox}
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 2. INLINE FORMATTER & MARKDOWN TABLE COMPONENT
// ----------------------------------------------------------------------------
// Universal inline markdown formatter (bold, italic, bold-italic, underline, strikethrough, inline code, links)
export const formatInline = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Regex matches:
  // 1. Bold-italic: ***text*** or ___text___
  // 2. Bold: **text** or __text__
  // 3. Italic: *text* (no leading/trailing whitespace inside) or _text_
  // 4. Underline: <u>text</u>
  // 5. Strikethrough: ~~text~~
  // 6. Inline code: `text`
  // 7. Link: [label](url)
  const regex = /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?:\*|_)(?!\s)[\s\S]+?(?<!\s)(?:\*|_)|<u>[\s\S]+?<\/u>|~~[\s\S]+?~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    const key = `inline-${match.index}`;

    if (
      (token.startsWith('***') && token.endsWith('***')) ||
      (token.startsWith('___') && token.endsWith('___'))
    ) {
      parts.push(
        <strong key={key} className={styles.chatStrong}>
          <em className={styles.chatEm}>{token.slice(3, -3)}</em>
        </strong>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      parts.push(
        <strong key={key} className={styles.chatStrong}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push(
        <em key={key} className={styles.chatEm}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('<u>') && token.endsWith('</u>')) {
      parts.push(
        <u key={key} className={styles.chatUnderline}>
          {token.slice(3, -4)}
        </u>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <del key={key} style={{ opacity: 0.65 }}>
          {token.slice(2, -2)}
        </del>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key} className={styles.inlineCode}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.chatLink}
          >
            {linkMatch[1]}
            <ArrowUpRight size={11} style={{ marginLeft: 2, display: 'inline-block' }} />
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const TableBlock = ({ rawTableLines }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Parse Markdown Table Lines
  const { headers, rows } = useMemo(() => {
    const lines = rawTableLines.map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseLine = (line) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());

    const hdrs = parseLine(lines[0]);
    // Skip line index 1 if it's separator (|---|---|)
    const dataLines = lines.slice(1).filter((l) => !/^[|\s-:]+$/.test(l));
    const rws = dataLines.map((l) => parseLine(l));

    return { headers: hdrs, rows: rws };
  }, [rawTableLines]);

  const handleCopyTable = () => {
    // Generate TSV for direct paste into Excel / Google Sheets
    const cleanCell = (str) =>
      str
        ? str
            .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/<u>(.*?)<\/u>/g, '$1')
        : '';
    const tsvContent = [
      headers.map(cleanCell).join('\t'),
      ...rows.map((row) => row.map(cleanCell).join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (headers.length === 0) return null;

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableHeaderBar}>
        <span>Table ({rows.length})</span>
        <button
          type="button"
          onClick={handleCopyTable}
          className={styles.tableCopyBtn}
          title={t('ai_chat.copy_table_excel', 'Salin untuk paste langsung ke Excel / Google Sheets')}
        >
          {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          <span>{copied ? t('ai_chat.copy_table_copied', 'Tersalin (Excel TSV)') : t('ai_chat.copy_table', 'Salin ke Excel')}</span>
        </button>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.markdownTable}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{formatInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{formatInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// 3. CODE BLOCK COMPONENT
// ----------------------------------------------------------------------------
const CodeBlock = ({ language, code }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={styles.tableCopyBtn}
          style={{ color: '#cdd6f4' }}
        >
          {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          <span>{copied ? t('common.copied', 'Tersalin') : t('common.copy', 'Salin')}</span>
        </button>
      </div>
      <pre className={styles.codeContent}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

// ----------------------------------------------------------------------------
// 4. RICH CONTENT RENDERER (Markdown, SVG, Tables, Formatting)
// ----------------------------------------------------------------------------
export const RichMessageContent = ({ content }) => {
  if (!content) return null;

  // Split content into blocks: Code blocks, Markdown tables, and Paragraphs
  const blocks = useMemo(() => {
    const result = [];
    const lines = content.split('\n');
    let currentTable = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let currentCode = [];
    let currentText = [];

    const flushText = () => {
      if (currentText.length > 0) {
        result.push({ type: 'text', content: currentText.join('\n') });
        currentText = [];
      }
    };

    const flushTable = () => {
      if (currentTable.length > 0) {
        result.push({ type: 'table', lines: currentTable });
        currentTable = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code Block Detection
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          flushText();
          flushTable();
          inCodeBlock = true;
          codeLanguage = line.trim().replace(/^```/, '').trim().toLowerCase();
          currentCode = [];
        } else {
          inCodeBlock = false;
          const fullCode = currentCode.join('\n');
          if (codeLanguage === 'svg' || (codeLanguage === 'xml' && fullCode.includes('<svg')) || fullCode.includes('<svg')) {
            result.push({ type: 'svg', code: fullCode });
          } else {
            result.push({ type: 'code', language: codeLanguage, code: fullCode });
          }
          currentCode = [];
        }
        continue;
      }

      if (inCodeBlock) {
        currentCode.push(line);
        continue;
      }

      // Standalone inline SVG detection
      if (line.includes('<svg') && line.includes('</svg>')) {
        flushText();
        flushTable();
        result.push({ type: 'svg', code: line });
        continue;
      }

      // Markdown Table Detection (Line with pipe format)
      const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|') && line.includes('|');
      if (isTableLine) {
        flushText();
        currentTable.push(line);
        continue;
      } else if (currentTable.length > 0) {
        flushTable();
      }

      currentText.push(line);
    }

    if (inCodeBlock && currentCode.length > 0) {
      const fullCode = currentCode.join('\n');
      if (codeLanguage === 'svg' || fullCode.includes('<svg')) {
        result.push({ type: 'svg', code: fullCode });
      } else {
        result.push({ type: 'code', language: codeLanguage, code: fullCode });
      }
    }
    flushTable();
    flushText();

    return result;
  }, [content]);

  // Render block-level elements (Headers, Blockquotes, Dividers, Lists, Paragraphs)
  const renderFormattedParagraph = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // 1. Horizontal divider
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            return <hr key={idx} className={styles.chatDivider} />;
          }

          // 2. Headings
          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className={styles.chatH4}>
                {formatInline(trimmed.substring(5))}
              </h4>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className={styles.chatH3}>
                {formatInline(trimmed.substring(4))}
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className={styles.chatH2}>
                {formatInline(trimmed.substring(3))}
              </h2>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className={styles.chatH1}>
                {formatInline(trimmed.substring(2))}
              </h1>
            );
          }

          // 3. Blockquotes (> quote)
          if (trimmed.startsWith('>')) {
            return (
              <blockquote key={idx} className={styles.chatBlockquote}>
                {formatInline(trimmed.replace(/^>\s*/, ''))}
              </blockquote>
            );
          }

          // 4. Bullet list (* item, - item, • item)
          if (/^[\*\-•]\s+/.test(trimmed)) {
            return (
              <div key={idx} className={styles.chatListItem}>
                <span className={styles.chatBullet}>•</span>
                <div>{formatInline(trimmed.replace(/^[\*\-•]\s+/, ''))}</div>
              </div>
            );
          }

          // 5. Numbered list (1. item, 2. item)
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            return (
              <div key={idx} className={styles.chatListItem}>
                <span className={styles.chatNumberBadge}>{numMatch[1]}.</span>
                <div>{formatInline(numMatch[2])}</div>
              </div>
            );
          }

          // 6. Blank line spacer
          if (trimmed === '') {
            return <div key={idx} style={{ height: '6px' }} />;
          }

          // 7. Regular paragraph line
          return (
            <div key={idx} className={styles.chatParagraphLine}>
              {formatInline(line)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'svg') {
          return <SvgBlock key={idx} rawSvg={b.code} id={idx} />;
        }
        if (b.type === 'table') {
          return <TableBlock key={idx} rawTableLines={b.lines} />;
        }
        if (b.type === 'code') {
          return <CodeBlock key={idx} language={b.language} code={b.code} />;
        }
        return <div key={idx}>{renderFormattedParagraph(b.content)}</div>;
      })}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 5. MAIN AI CHAT WINDOW COMPONENT
// ----------------------------------------------------------------------------
export const AiChatWindow = ({ isDrawer = true, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const welcomeGreetingText = t(
    'ai_chat.welcome_greeting',
    'Halo! Saya **SEIN PE AI Assistant**. Saya dapat membantu analisis dokumen/log teknis, JIG CAD, BOM verification, GBA Task approval, data Software MR, menyajikan data dalam **Tabel interaktif**, serta membuat **Diagram Alir / Skema SVG** langsung di sini.\n\nKetik pertanyaan Anda atau lampirkan dokumen untuk memulai!'
  );

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      isWelcome: true,
      content: welcomeGreetingText,
    },
  ]);

  // Dynamically update greeting / cleared message when language toggle changes
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.isWelcome) {
          return {
            ...m,
            content: t(
              'ai_chat.welcome_greeting',
              'Halo! Saya **SEIN PE AI Assistant**. Saya dapat membantu analisis dokumen/log teknis, JIG CAD, BOM verification, GBA Task approval, data Software MR, menyajikan data dalam **Tabel interaktif**, serta membuat **Diagram Alir / Skema SVG** langsung di sini.\n\nKetik pertanyaan Anda atau lampirkan dokumen untuk memulai!'
            ),
          };
        }
        if (m.isCleared) {
          return {
            ...m,
            content: t(
              'ai_chat.history_cleared',
              'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru atau lampirkan dokumen!'
            ),
          };
        }
        return m;
      })
    );
  }, [i18n.language, t]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeModel, setActiveModel] = useState('google/gemma-4-e4b');
  const [activeProvider, setActiveProvider] = useState('LM Studio');
  const [isMaximized, setIsMaximized] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mcpConnectors, setMcpConnectors] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load active LLM config and registered MCP connectors
  useEffect(() => {
    api
      .get('/ai/config')
      .then((res) => {
        if (res.data?.config) {
          setActiveModel(res.data.config.model_name || 'google/gemma-4-e4b');
          setActiveProvider(res.data.config.name || 'LM Studio');
        }
      })
      .catch(() => {});

    api
      .get('/ai/mcp-connectors')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMcpConnectors(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Auto-focus textarea when finished sending, on mount, or after state reset
  useEffect(() => {
    if (!isSending) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isSending]);

  // Auto-expand textarea height as user types or adds newlines (up to 160px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const targetHeight = Math.min(Math.max(el.scrollHeight, 36), 160);
    el.style.height = `${targetHeight}px`;
  }, [inputVal]);

  // Handle Detach to Standalone Window
  const handleDetachWindow = () => {
    const width = 1100;
    const height = 800;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    window.open(
      '/chat?standalone=1',
      'PEPortal_AIChat_Window',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    if (onClose) onClose();
  };

  // Clear Chat History
  const handleClearHistory = () => {
    if (window.confirm(t('ai_chat.confirm_clear', 'Kosongkan riwayat percakapan AI Assistant?'))) {
      setMessages([
        {
          role: 'assistant',
          isCleared: true,
          content: t('ai_chat.history_cleared', 'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru atau lampirkan dokumen!'),
        },
      ]);
      setAttachments([]);
    }
  };

  // Helper: Resize and convert image to Base64 Data URL for Vision LLMs (9router/OpenAI)
  const processImageForVision = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let w = img.width;
          let h = img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Helper: Extract text from PDF files natively in the browser
  const extractPdfText = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawStr = textDecoder.decode(bytes);

      const words = [];
      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let match;
      while ((match = tjRegex.exec(rawStr)) !== null) {
        const cleaned = match[1].replace(/\\([()\\])/g, '$1').trim();
        if (cleaned.length > 0) words.push(cleaned);
      }

      const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((match = arrayTjRegex.exec(rawStr)) !== null) {
        const inner = match[1];
        const partRegex = /\(([^)]+)\)/g;
        let partMatch;
        let lineParts = '';
        while ((partMatch = partRegex.exec(inner)) !== null) {
          lineParts += partMatch[1].replace(/\\([()\\])/g, '$1') + ' ';
        }
        if (lineParts.trim()) words.push(lineParts.trim());
      }

      if (words.length > 10) {
        return words.join(' ');
      }

      const printableMatches = rawStr.match(/[\x20-\x7E\s]{6,}/g) || [];
      const filtered = printableMatches.filter(
        (s) =>
          !s.includes('obj') &&
          !s.includes('endobj') &&
          !s.includes('xref') &&
          !s.includes('Font') &&
          !s.includes('MediaBox')
      );
      if (filtered.length > 0) {
        return filtered.join('\n').trim();
      }

      return `[Dokumen PDF: ${file.name} - Ukuran ${(file.size / 1024).toFixed(1)} KB]`;
    } catch (err) {
      return `[Dokumen PDF: ${file.name} - Gagal ekstrak teks]`;
    }
  };

  // Handle Document & Image Attachment
  const handleAttachFiles = async (filesList) => {
    const files = Array.from(filesList);
    if (files.length === 0) return;

    const newAttachments = [];

    for (const file of files) {
      try {
        let textContent = '';
        let isImage = false;
        let dataUrl = null;
        const ext = file.name.split('.').pop().toLowerCase();

        // 1. Image Files (Vision Multimodal for 9router / GPT-4o / Claude)
        if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
          isImage = true;
          dataUrl = await processImageForVision(file);
          textContent = `[Foto/Gambar: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
        }
        // 2. PDF Documents
        else if (ext === 'pdf' || file.type === 'application/pdf') {
          textContent = await extractPdfText(file);
        }
        // 3. Plain text / Code / Logs / CSV / JSON
        else if (
          [
            'txt',
            'csv',
            'json',
            'log',
            'md',
            'sql',
            'js',
            'jsx',
            'py',
            'go',
            'html',
            'xml',
            'yaml',
            'yml',
            'ini',
            'env',
            'php',
            'css',
            'tsv',
          ].includes(ext) ||
          file.type.startsWith('text/')
        ) {
          textContent = await file.text();
        } else {
          // Fallback text reading
          textContent = await file.text().catch(() => `[Dokumen Binary: ${file.name}]`);
        }

        // Generous limit for 9router / modern LLMs (up to 80,000 characters)
        if (textContent.length > 80000) {
          textContent =
            textContent.substring(0, 80000) +
            `\n... [Sisa ${textContent.length - 80000} karakter dipangkas untuk optimasi token LLM]`;
        }

        newAttachments.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          type: file.type || ext,
          isImage,
          dataUrl,
          content: textContent,
        });
      } catch (err) {
        console.error('Failed to read file:', file.name, err);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag and Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleAttachFiles(e.dataTransfer.files);
    }
  };

  // Send Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputVal.trim();
    if ((!text && attachments.length === 0) || isSending) return;

    const imageAttachments = attachments.filter((a) => a.isImage && a.dataUrl);
    const docAttachments = attachments.filter((a) => !a.isImage);

    // Build text context for attached documents
    let combinedPrompt = text;
    if (docAttachments.length > 0) {
      const attachmentsContext = docAttachments
        .map(
          (a) =>
            `\n\n--- DOKUMEN LAMPIRAN: ${a.name} (${(a.size / 1024).toFixed(1)} KB) ---\n${a.content}\n--- AKHIR DOKUMEN ---`
        )
        .join('');
      combinedPrompt = text ? `${text}\n${attachmentsContext}` : `Tolong analisa dokumen lampiran berikut:${attachmentsContext}`;
    }

    // Determine message payload: string or OpenAI Multimodal Vision content parts
    let messageContent = combinedPrompt;
    if (imageAttachments.length > 0) {
      const parts = [];
      const promptText = combinedPrompt || 'Tolong analisa foto/gambar lampiran berikut secara teliti.';
      parts.push({ type: 'text', text: promptText });

      for (const img of imageAttachments) {
        parts.push({
          type: 'image_url',
          image_url: {
            url: img.dataUrl,
            detail: 'auto',
          },
        });
      }
      messageContent = parts;
    }

    const currentAttachedPills = [...attachments];
    const displayLabel = text || (imageAttachments.length > 0 ? 'Analisa foto terlampir' : 'Analisa dokumen terlampir');

    const newMessages = [
      ...messages,
      {
        role: 'user',
        content: messageContent,
        displayContent: displayLabel,
        attachedFiles: currentAttachedPills,
      },
    ];

    setMessages(newMessages);
    setInputVal('');
    setAttachments([]);
    setIsSending(true);

    try {
      const res = await api.post('/ai/chat', {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply || 'Tidak ada respon yang dikembalikan.' },
      ]);
      if (res.data.model) setActiveModel(res.data.model);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memanggil endpoint AI.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ **Gagal terhubung ke AI Model:** ${errorMsg}\n\nPastikan service LM Studio, 9router, atau API LLM aktif di menu Settings.` },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Determine container styling class
  const containerClass = !isDrawer
    ? styles.standaloneMode
    : isMaximized
    ? styles.maximizedMode
    : styles.drawerMode;

  return (
    <div
      className={`${styles.chatContainer} ${containerClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={styles.dragOverlay}>
          <Paperclip size={36} />
          <span>{t('ai_chat.drop_files', 'Lepaskan dokumen di sini untuk dilampirkan')}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.botIconWrapper}>
            <Bot size={18} />
          </div>
          <div className={styles.headerText}>
            <h3>{t('ai_chat.title', 'SEIN PE AI Assistant')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.headerModel}>
                <span className={styles.onlineBadge} />
                <span>{activeProvider} • {activeModel}</span>
              </div>
              {mcpConnectors.length > 0 && (
                <div
                  title={`Terhubung dengan ${mcpConnectors.length} MCP Connector: ${mcpConnectors.map((m) => `${m.name} (${m.tools_count} tools: ${m.tools?.join(', ') || ''})`).join('; ')}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onClick={() => navigate('/settings')}
                >
                  <span style={{ fontSize: '10px' }}>🔌</span>
                  <span>
                    {mcpConnectors[0]?.name || 'MCP'}
                    {mcpConnectors[0]?.tools_count > 0 && ` (${mcpConnectors[0].tools_count} tools)`}
                  </span>
                  {mcpConnectors.length > 1 && (
                    <span style={{ fontWeight: 700 }}>+{mcpConnectors.length - 1}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={handleClearHistory}
            title={t('ai_chat.clear_btn', 'Bersihkan percakapan')}
          >
            <Trash2 size={15} />
          </button>

          {isDrawer && (
            <>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? t('common.minimize', 'Perkecil Jendela') : t('common.maximize', 'Perbesar Jendela')}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={handleDetachWindow}
                title={t('ai_chat.open_standalone', 'Buka di Jendela Baru (Detach Standalone)')}
              >
                <ExternalLink size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => {
              if (onClose) onClose();
              navigate('/settings');
            }}
            title={t('nav.settings', 'Konfigurasi Model & Endpoint LLM')}
          >
            <Settings size={15} />
          </button>

          {onClose && (
            <button
              type="button"
              className={styles.headerBtn}
              onClick={onClose}
              aria-label={t('common.close', 'Tutup Chat')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className={styles.messagesList}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`${styles.messageRow} ${
              m.role === 'user' ? styles.userRow : styles.assistantRow
            }`}
          >
            <span className={styles.messageSender}>
              {m.role === 'user' ? 'Anda (Engineer)' : 'PE Assistant'}
            </span>
            <div
              className={`${styles.messageBubble} ${
                m.role === 'user' ? styles.userBubble : styles.assistantBubble
              }`}
            >
              {/* Show attached pills / images in user bubble */}
              {m.attachedFiles && m.attachedFiles.length > 0 && (
                <div className={styles.attachedPills}>
                  {m.attachedFiles.map((att) => (
                    <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {att.isImage && att.dataUrl ? (
                        <div style={{ position: 'relative', width: 'fit-content' }}>
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            style={{
                              maxWidth: '220px',
                              maxHeight: '160px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              display: 'block',
                            }}
                          />
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block' }}>
                            {att.name} ({(att.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ) : (
                        <span className={styles.attachedPill}>
                          <FileText size={12} />
                          {att.name} ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Message Content with Markdown & Table & SVG parsing */}
              {m.role === 'user' ? (
                <div>
                  {typeof m.displayContent === 'string'
                    ? formatInline(m.displayContent)
                    : (typeof m.content === 'string' ? formatInline(m.content) : 'Analisa foto/dokumen')}
                </div>
              ) : (
                <RichMessageContent
                  content={
                    m.isWelcome
                      ? t(
                          'ai_chat.welcome_greeting',
                          m.content ||
                            'Halo! Saya **SEIN PE AI Assistant**. Saya dapat membantu analisis dokumen/log teknis, JIG CAD, BOM verification, GBA Task approval, data Software MR, menyajikan data dalam **Tabel interaktif**, serta membuat **Diagram Alir / Skema SVG** langsung di sini.\n\nKetik pertanyaan Anda atau lampirkan dokumen untuk memulai!'
                        )
                      : m.isCleared
                      ? t(
                          'ai_chat.history_cleared',
                          m.content ||
                            'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru atau lampirkan dokumen!'
                        )
                      : m.content
                  }
                />
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className={`${styles.messageRow} ${styles.assistantRow}`}>
            <span className={styles.messageSender}>PE Assistant</span>
            <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
              <em style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="#3b82f6" />
                {t('ai_chat.thinking', 'Sedang memproses...')} ({activeModel})
              </em>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Unified Input Composer */}
      <form onSubmit={handleSendMessage} className={styles.composerForm}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.csv,.json,.log,.md,.sql,.js,.jsx,.py,.go,.html,.xml,.yaml,.yml,.ini,.env,.php,.css,.tsv,.pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleAttachFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className={styles.composerContainer}>
          {/* Attachments Inside Composer */}
          {attachments.length > 0 && (
            <div className={styles.composerAttachments}>
              {attachments.map((a) => (
                <div key={a.id} className={styles.attachmentChip}>
                  {a.isImage && a.dataUrl ? (
                    <img src={a.dataUrl} alt={a.name} style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: '3px' }} />
                  ) : a.type.includes('csv') ? (
                    <FileSpreadsheet size={13} color="#10b981" />
                  ) : a.type.includes('pdf') ? (
                    <FileText size={13} color="#ef4444" />
                  ) : (
                    <FileText size={13} color="#3b82f6" />
                  )}
                  <span className={styles.attachmentChipText}>
                    {a.name} ({(a.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    className={styles.attachmentRemoveBtn}
                    onClick={() => handleRemoveAttachment(a.id)}
                    title={t('common.delete', 'Hapus')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Auto-expanding Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('ai_chat.input_placeholder', 'Tanya apa saja ke AI...')}
            className={styles.composerTextarea}
            disabled={isSending}
            autoFocus
          />

          {/* Bottom Action Toolbar */}
          <div className={styles.composerToolbar}>
            <div className={styles.toolbarLeft}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={() => fileInputRef.current?.click()}
                title={t('ai_chat.attach_tooltip', 'Lampirkan Dokumen (TXT, CSV, JSON, Log, PDF, Image)')}
              >
                <Paperclip size={17} />
              </button>
              {attachments.length > 0 && (
                <span className={styles.attachmentsCount}>
                  {attachments.length} {t('common.files', 'lampiran')}
                </span>
              )}
            </div>

            <div className={styles.toolbarRight}>
              <button
                type="submit"
                disabled={isSending || (!inputVal.trim() && attachments.length === 0)}
                className={styles.sendBtn}
                title={t('ai_chat.send_btn', 'Kirim Pesan (Enter)')}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
