import React, { useState } from 'react';
import {
  Table as TableIcon,
  Copy,
  Check,
  Maximize2,
  X,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import styles from './RichNotesViewer.module.css';

/**
 * RichNotesViewer renders validation notes with support for:
 * 1. Markdown Tables (parsed with headers, zebra rows, and Excel copy button)
 * 2. Embedded Photos & Images (![caption](url)) with Lightbox preview
 * 3. Formatted text (bold, italic, bullet lists, code)
 */
export const RichNotesViewer = ({ content = '', className = '' }) => {
  const [activeImage, setActiveImage] = useState(null);
  const [copiedTableIdx, setCopiedTableIdx] = useState(null);

  if (!content || typeof content !== 'string') {
    return null;
  }

  // Parse lines into tokens: paragraphs, tables, images, code blocks
  const lines = content.split('\n');
  const blocks = [];
  let currentTable = null;
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: currentParagraph.join('\n'),
      });
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push(currentTable);
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for Image markdown: ![alt](url)
    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushTable();
      blocks.push({
        type: 'image',
        alt: imageMatch[1] || 'Foto Validasi',
        url: imageMatch[2],
      });
      continue;
    }

    // Check if line is a table row: starts and ends with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if it's delimiter row (e.g. |---|---|)
      const isDelimiter = cells.every((c) => /^:?-+:?$/.test(c));

      if (isDelimiter) {
        if (currentTable && currentTable.headers.length === 0 && currentTable.tempHeader) {
          currentTable.headers = currentTable.tempHeader;
          currentTable.tempHeader = null;
        }
        continue;
      }

      if (!currentTable) {
        currentTable = {
          type: 'table',
          headers: [],
          rows: [],
          tempHeader: cells,
        };
      } else if (currentTable.headers.length === 0 && currentTable.tempHeader) {
        // No delimiter was found, treat tempHeader as headers
        currentTable.headers = currentTable.tempHeader;
        currentTable.tempHeader = null;
        currentTable.rows.push(cells);
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    }

    // If not a table row, flush pending table
    if (currentTable) {
      if (currentTable.headers.length === 0 && currentTable.tempHeader) {
        currentTable.headers = currentTable.tempHeader;
      }
      flushTable();
    }

    currentParagraph.push(line);
  }

  flushParagraph();
  if (currentTable) {
    if (currentTable.headers.length === 0 && currentTable.tempHeader) {
      currentTable.headers = currentTable.tempHeader;
    }
    flushTable();
  }

  const handleCopyTable = (tableBlock, index) => {
    const tsvContent = [
      tableBlock.headers.join('\t'),
      ...tableBlock.rows.map((row) => row.join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsvContent);
    setCopiedTableIdx(index);
    setTimeout(() => setCopiedTableIdx(null), 2000);
  };

  // Helper to format inline bold, italic, code
  const formatInline = (text) => {
    if (!text) return '';
    // Look for image tag inside paragraph if any
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push({
        inlineImg: true,
        alt: match[1] || 'Foto',
        url: match[2],
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.map((part, pIdx) => {
      if (typeof part === 'object' && part.inlineImg) {
        return (
          <div
            key={pIdx}
            className={styles.imageCard}
            onClick={() => setActiveImage({ alt: part.alt, url: part.url })}
          >
            <img src={part.url} alt={part.alt} className={styles.imageThumb} />
            <div className={styles.imageCaption}>
              <span>{part.alt}</span>
              <Maximize2 size={12} />
            </div>
          </div>
        );
      }

      // Format bold, italic, code
      const formattedLines = part.split('\n').map((line, lIdx) => {
        // Simple bold replace
        let elements = [line];
        // Handle bold **text**
        const boldRegex = /\*\*(.*?)\*\*/g;
        // If has bold, replace
        if (boldRegex.test(line)) {
          const subParts = line.split(/\*\*(.*?)\*\*/g);
          elements = subParts.map((sub, sIdx) => {
            if (sIdx % 2 === 1) {
              return <strong key={sIdx}>{sub}</strong>;
            }
            return sub;
          });
        }

        return (
          <React.Fragment key={lIdx}>
            {elements}
            {lIdx < part.split('\n').length - 1 && <br />}
          </React.Fragment>
        );
      });

      return <span key={pIdx}>{formattedLines}</span>;
    });
  };

  return (
    <div className={`${styles.notesContainer} ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          return (
            <div key={idx} className={styles.tableWrapper}>
              <div className={styles.tableHeaderBar}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TableIcon size={13} color="var(--color-accent)" />
                  Tabel Hasil Uji ({block.rows.length} Baris)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyTable(block, idx)}
                  className={styles.tableCopyBtn}
                  title="Salin ke Excel / Spreadsheet"
                >
                  {copiedTableIdx === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedTableIdx === idx ? 'Tersalin (Excel TSV)' : 'Salin ke Excel'}</span>
                </button>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.markdownTable}>
                  {block.headers.length > 0 && (
                    <thead>
                      <tr>
                        {block.headers.map((h, hIdx) => (
                          <th key={hIdx}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {block.rows.map((row, rIdx) => (
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
        }

        if (block.type === 'image') {
          return (
            <div
              key={idx}
              className={styles.imageCard}
              onClick={() => setActiveImage({ alt: block.alt, url: block.url })}
            >
              <img src={block.url} alt={block.alt} className={styles.imageThumb} />
              <div className={styles.imageCaption}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ImageIcon size={13} color="var(--color-accent)" />
                  {block.alt}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px' }}>
                  <Maximize2 size={11} /> Klik Perbesar
                </span>
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className={styles.paragraph}>
            {formatInline(block.text)}
          </p>
        );
      })}

      {/* Lightbox Image Preview Modal */}
      {activeImage && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setActiveImage(null)}
        >
          <button
            type="button"
            className={styles.lightboxCloseBtn}
            onClick={() => setActiveImage(null)}
            title="Tutup (Esc)"
          >
            <X size={20} />
          </button>
          <img
            src={activeImage.url}
            alt={activeImage.alt}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{
            marginTop: '12px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }} onClick={(e) => e.stopPropagation()}>
            <span>{activeImage.alt}</span>
            <a
              href={activeImage.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ExternalLink size={12} /> Buka Tab Baru
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
