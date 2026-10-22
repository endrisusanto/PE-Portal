import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
            <span>{showCode ? 'Lihat Preview' : 'Kode SVG'}</span>
          </button>
          <button
            type="button"
            className={styles.svgActionBtn}
            onClick={handleCopy}
            title="Salin Kode SVG"
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
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
// 2. MARKDOWN TABLE COMPONENT
// ----------------------------------------------------------------------------
const TableBlock = ({ rawTableLines }) => {
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
    const tsvContent = [
      headers.join('\t'),
      ...rows.map((row) => row.join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (headers.length === 0) return null;

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableHeaderBar}>
        <span>Tabel Data ({rows.length} Baris)</span>
        <button
          type="button"
          onClick={handleCopyTable}
          className={styles.tableCopyBtn}
          title="Salin untuk paste langsung ke Excel / Google Sheets"
        >
          {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          <span>{copied ? 'Tersalin (Excel TSV)' : 'Salin ke Excel'}</span>
        </button>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.markdownTable}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{cell}</td>
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
          <span>{copied ? 'Tersalin' : 'Salin'}</span>
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
const RichMessageContent = ({ content }) => {
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

  // Render inline formatting (bold, inline code, links)
  const renderFormattedText = (text) => {
    // Process line by line
    return text.split('\n').map((line, idx) => {
      // Bold + Inline code regex replacement
      const parts = [];
      let lastIndex = 0;
      const regex = /(\*\*.*?\*\*|`.*?`)/g;
      let match;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith('**') && token.endsWith('**')) {
          parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          parts.push(
            <code
              key={match.index}
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                padding: '2px 5px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'var(--color-accent)',
              }}
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        lastIndex = match.index + token.length;
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      return (
        <React.Fragment key={idx}>
          {parts.length > 0 ? parts : line}
          {idx < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
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
        return <div key={idx}>{renderFormattedText(b.content)}</div>;
      })}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 5. MAIN AI CHAT WINDOW COMPONENT
// ----------------------------------------------------------------------------
export const AiChatWindow = ({ isDrawer = true, onClose }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Halo! Saya **SEIN PE AI Assistant**. Saya dapat membantu analisis dokumen/log teknis, JIG CAD, BOM verification, GBA Task approval, data Software MR, menyajikan data dalam **Tabel interaktif**, serta membuat **Diagram Alir / Skema SVG** langsung di sini.\n\nKetik pertanyaan Anda atau lampirkan dokumen untuk memulai!',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeModel, setActiveModel] = useState('google/gemma-4-e4b');
  const [activeProvider, setActiveProvider] = useState('LM Studio');
  const [isMaximized, setIsMaximized] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load active LLM config
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
    if (window.confirm('Kosongkan riwayat percakapan AI Assistant?')) {
      setMessages([
        {
          role: 'assistant',
          content: 'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru atau lampirkan dokumen!',
        },
      ]);
      setAttachments([]);
    }
  };

  // Handle Document Attachment
  const handleAttachFiles = async (filesList) => {
    const files = Array.from(filesList);
    if (files.length === 0) return;

    const newAttachments = [];

    for (const file of files) {
      try {
        let textContent = '';
        const ext = file.name.split('.').pop().toLowerCase();

        // 1. Plain text / Code / Logs / CSV / JSON
        if (
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
          ].includes(ext) ||
          file.type.startsWith('text/')
        ) {
          textContent = await file.text();
        } else if (file.type.startsWith('image/')) {
          textContent = `[Gambar: ${file.name} - Ukuran: ${(file.size / 1024).toFixed(1)} KB]`;
        } else {
          // Fallback slice text reading
          textContent = await file.text().catch(() => `[Dokumen Binary: ${file.name}]`);
        }

        // Truncate overly massive documents to ~30,000 characters to fit LLM context cleanly
        if (textContent.length > 30000) {
          textContent =
            textContent.substring(0, 30000) +
            `\n... [Sisa ${textContent.length - 30000} karakter dipangkas untuk keamanan konteks LLM]`;
        }

        newAttachments.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          type: file.type || ext,
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

    // Build user message with attachment summary
    let combinedPrompt = text;
    if (attachments.length > 0) {
      const attachmentsContext = attachments
        .map(
          (a) =>
            `\n\n--- DOKUMEN LAMPIRAN: ${a.name} (${(a.size / 1024).toFixed(1)} KB) ---\n${a.content}\n--- AKHIR DOKUMEN ---`
        )
        .join('');
      combinedPrompt = text ? `${text}\n${attachmentsContext}` : `Tolong analisa dokumen lampiran berikut:${attachmentsContext}`;
    }

    const currentAttachedPills = [...attachments];
    const newMessages = [
      ...messages,
      {
        role: 'user',
        content: combinedPrompt,
        displayContent: text || 'Analisa dokumen terlampir',
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
        { role: 'assistant', content: `⚠️ **Gagal terhubung ke AI Model:** ${errorMsg}\n\nPastikan service LM Studio atau API LLM aktif di menu Settings.` },
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
          <span>Lepaskan dokumen di sini untuk dilampirkan</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.botIconWrapper}>
            <Bot size={18} />
          </div>
          <div className={styles.headerText}>
            <h3>SEIN PE AI Assistant</h3>
            <div className={styles.headerModel}>
              <span className={styles.onlineBadge} />
              <span>{activeProvider} • {activeModel}</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={handleClearHistory}
            title="Bersihkan percakapan"
          >
            <Trash2 size={15} />
          </button>

          {isDrawer && (
            <>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? 'Perkecil Jendela' : 'Perbesar Jendela (Maximize)'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={handleDetachWindow}
                title="Buka di Jendela Baru (Detach Standalone)"
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
            title="Konfigurasi Model & Endpoint LLM"
          >
            <Settings size={15} />
          </button>

          {onClose && (
            <button
              type="button"
              className={styles.headerBtn}
              onClick={onClose}
              aria-label="Tutup Chat"
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
              {/* Show attached pills in user bubble */}
              {m.attachedFiles && m.attachedFiles.length > 0 && (
                <div className={styles.attachedPills}>
                  {m.attachedFiles.map((att) => (
                    <span key={att.id} className={styles.attachedPill}>
                      <FileText size={12} />
                      {att.name} ({(att.size / 1024).toFixed(1)} KB)
                    </span>
                  ))}
                </div>
              )}

              {/* Message Content with Markdown & Table & SVG parsing */}
              {m.role === 'user' ? (
                <div>{m.displayContent || m.content}</div>
              ) : (
                <RichMessageContent content={m.content} />
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
                Sedang memproses dengan {activeModel}...
              </em>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Tray */}
      {attachments.length > 0 && (
        <div className={styles.attachmentsTray}>
          {attachments.map((a) => (
            <div key={a.id} className={styles.attachmentChip}>
              {a.type.includes('csv') ? (
                <FileSpreadsheet size={13} color="#10b981" />
              ) : a.type.startsWith('image/') ? (
                <ImageIcon size={13} color="#f59e0b" />
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
                title="Hapus Lampiran"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className={styles.inputForm}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.csv,.json,.log,.md,.sql,.js,.jsx,.py,.go,.html,.xml,.yaml,.yml,.ini,.env,.php,.css,.pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleAttachFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          title="Lampirkan Dokumen (TXT, CSV, JSON, Log, Source Code, PDF)"
        >
          <Paperclip size={18} />
        </button>

        <div className={styles.textareaWrapper}>
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
            placeholder="Tanyakan analisis log, cek BOM, buat diagram SVG, atau format tabel..."
            className={styles.chatTextarea}
            disabled={isSending}
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={isSending || (!inputVal.trim() && attachments.length === 0)}
          className={styles.sendBtn}
          title="Kirim Pesan (Enter)"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
