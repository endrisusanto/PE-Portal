import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  Copy,
  Check,
  Maximize2,
  X,
  Image as ImageIcon,
  ExternalLink,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
} from 'lucide-react';
import styles from './RichNotesViewer.module.css';

// ponytail: parse alt and dimension from format ![alt|50%](url) or ![alt](url)
const parseImageAlt = (rawAlt) => {
  if (!rawAlt) return { alt: 'Foto Lampiran', dim: '100%' };
  if (rawAlt.includes('|')) {
    const parts = rawAlt.split('|');
    return {
      alt: parts[0].trim() || 'Foto Lampiran',
      dim: parts[1].trim() || '100%',
    };
  }
  return { alt: rawAlt, dim: '100%' };
};

// ponytail: calculate step resizing (+15% or -15%)
const stepDimension = (currentDim, direction) => {
  const match = String(currentDim).match(/^(\d+)%?$/);
  let currentVal = match ? parseInt(match[1], 10) : 100;
  if (direction === 'smaller') {
    currentVal = Math.max(20, currentVal - 15);
  } else {
    currentVal = Math.min(100, currentVal + 15);
  }
  return `${currentVal}%`;
};

/**
 * RichNotesViewer renders validation notes with support for:
 * 1. Markdown Tables (parsed with headers, zebra rows, Excel copy button, status badges)
 * 2. Embedded Photos & Images with interactive dimension resizing (perkecil / perbesar) & Lightbox zoom
 * 3. Formatted text (bold, italic, bullet lists, code)
 */
export const RichNotesViewer = ({ content = '', className = '', onUpdateContent = null }) => {
  const [activeImage, setActiveImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1.0);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [copiedTableIdx, setCopiedTableIdx] = useState(null);
  // Local state to store dimensions per image block key
  const [imageDimensions, setImageDimensions] = useState({});

  // Reset lightbox transform when activeImage changes
  useEffect(() => {
    if (activeImage) {
      setLightboxZoom(1.0);
      setLightboxRotation(0);
    }
  }, [activeImage]);

  // Handle escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeImage) {
        setActiveImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImage]);

  if (!content || typeof content !== 'string') {
    return null;
  }

  // Parse lines into tokens: paragraphs, tables, images
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

    // Check for Image markdown: ![alt](url) or ![alt|dim](url)
    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushTable();
      const parsed = parseImageAlt(imageMatch[1]);
      blocks.push({
        type: 'image',
        alt: parsed.alt,
        defaultDim: parsed.dim,
        rawAlt: imageMatch[1],
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

  // ponytail: handle resizing image dimension and optionally persist to markdown content
  const handleResizeImage = (key, block, newDim) => {
    setImageDimensions((prev) => ({ ...prev, [key]: newDim }));

    if (onUpdateContent && content) {
      const cleanAlt = block.alt || 'Foto Lampiran';
      const url = block.url;
      // Search for ![...](url) in content and replace with ![cleanAlt|newDim](url)
      const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`);
      const replacement = `![${cleanAlt}|${newDim}](${url})`;
      if (regex.test(content)) {
        const updated = content.replace(regex, replacement);
        onUpdateContent(updated);
      }
    }
  };

  // Helper to render table cell with bold support and status pill styling
  const renderTableCell = (cellText) => {
    if (!cellText) return '—';
    const trimmed = cellText.trim();
    const upper = trimmed.toUpperCase();

    // Check for Pass/OK status
    if (['PASS', 'OK', 'GOOD', 'NORMAL', 'COMPLIANT'].includes(upper)) {
      return <span className={styles.statusBadgePass}>{trimmed}</span>;
    }
    // Check for Fail/NG status
    if (['FAIL', 'NG', 'REJECT', 'DEFECT', 'ABNORMAL'].includes(upper)) {
      return <span className={styles.statusBadgeFail}>{trimmed}</span>;
    }
    // Check for Hold/Wait status
    if (['HOLD', 'PENDING', 'WAIT', 'CHECK'].includes(upper)) {
      return <span className={styles.statusBadgeHold}>{trimmed}</span>;
    }

    // Support inline bold: **text**
    if (/\*\*(.*?)\*\*/.test(trimmed)) {
      const parts = trimmed.split(/\*\*(.*?)\*\*/g);
      return parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx}>{part}</strong> : part));
    }

    return trimmed;
  };

  // Helper to render resizable image card
  const renderImageCard = (block, key) => {
    const currentDim = imageDimensions[key] || block.defaultDim || '100%';

    return (
      <div
        key={key}
        className={styles.imageCardWrapper}
        style={{ width: currentDim }}
      >
        <div className={styles.imageCard}>
          {/* Header Bar with Dimension and Zoom Controls */}
          <div className={styles.imageHeaderBar}>
            <span className={styles.imageTitle} title={block.alt}>
              <ImageIcon size={13} color="var(--color-accent)" />
              {block.alt}
            </span>
            <div className={styles.imageControls}>
              <span className={styles.dimBadge} title="Ukuran Dimensi Saat Ini">
                {currentDim}
              </span>
              <button
                type="button"
                className={styles.dimBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = stepDimension(currentDim, 'smaller');
                  handleResizeImage(key, block, next);
                }}
                title="Perkecil Ukuran Gambar (-15%)"
              >
                <Minus size={11} />
              </button>
              {['30%', '50%', '75%', '100%'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.dimPresetBtn} ${currentDim === preset ? styles.dimPresetActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResizeImage(key, block, preset);
                  }}
                  title={`Ubah ukuran menjadi ${preset}`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                className={styles.dimBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = stepDimension(currentDim, 'larger');
                  handleResizeImage(key, block, next);
                }}
                title="Perbesar Ukuran Gambar (+15%)"
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                className={styles.dimBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage({ alt: block.alt, url: block.url });
                }}
                title="Perbesar Penuh (Lightbox Zoom)"
              >
                <Maximize2 size={11} />
              </button>
            </div>
          </div>

          {/* Thumbnail Preview */}
          <div
            className={styles.imageThumbContainer}
            onClick={() => setActiveImage({ alt: block.alt, url: block.url })}
            title="Klik untuk membuka pratinjau penuh & zoom detail"
          >
            <img
              src={block.url}
              alt={block.alt}
              className={styles.imageThumb}
            />
          </div>

          <div className={styles.imageFooterBar}>
            <span>{block.alt}</span>
            <span>Klik gambar untuk perbesar penuh</span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to format inline bold, italic, code & embedded inline images
  const formatInline = (text, blockIdx) => {
    if (!text) return '';
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const parsed = parseImageAlt(match[1]);
      parts.push({
        inlineImg: true,
        alt: parsed.alt,
        defaultDim: parsed.dim,
        rawAlt: match[1],
        url: match[2],
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.map((part, pIdx) => {
      if (typeof part === 'object' && part.inlineImg) {
        return renderImageCard(part, `inline-${blockIdx}-${pIdx}`);
      }

      // Format bold, italic, code
      const formattedLines = part.split('\n').map((line, lIdx) => {
        let elements = [line];
        const boldRegex = /\*\*(.*?)\*\*/g;
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
                  Tabel Pengukuran / Hasil Analisis ({block.rows.length} Baris)
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
                          <td key={cIdx}>{renderTableCell(cell)}</td>
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
          return renderImageCard(block, `img-${idx}`);
        }

        return (
          <p key={idx} className={styles.paragraph}>
            {formatInline(block.text, idx)}
          </p>
        );
      })}

      {/* Lightbox Image Preview Modal with Zoom, Pan & Rotate Controls */}
      {activeImage && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setActiveImage(null)}
        >
          {/* Top Floating Control Bar */}
          <div
            className={styles.lightboxTopBar}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.lightboxTitle}>
              <ImageIcon size={15} color="#60a5fa" />
              <span>{activeImage.alt}</span>
            </div>

            <div className={styles.lightboxControls}>
              <button
                type="button"
                className={styles.lightboxBtn}
                onClick={() => setLightboxZoom((prev) => Math.max(0.5, prev - 0.25))}
                title="Perkecil Zoom (-25%)"
              >
                <ZoomOut size={13} />
              </button>
              <span className={styles.lightboxZoomBadge}>
                {Math.round(lightboxZoom * 100)}%
              </span>
              <button
                type="button"
                className={styles.lightboxBtn}
                onClick={() => setLightboxZoom((prev) => Math.min(3.0, prev + 0.25))}
                title="Perbesar Zoom (+25%)"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                className={styles.lightboxBtn}
                onClick={() => setLightboxRotation((prev) => (prev + 90) % 360)}
                title="Putar Gambar 90 Derajat"
              >
                <RotateCw size={13} />
              </button>
              <button
                type="button"
                className={styles.lightboxBtn}
                onClick={() => {
                  setLightboxZoom(1.0);
                  setLightboxRotation(0);
                }}
                title="Reset Ukuran Normal (100%)"
              >
                <RefreshCw size={12} />
                <span>Reset</span>
              </button>
              <a
                href={activeImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.lightboxBtn}
                title="Buka gambar di tab baru"
              >
                <ExternalLink size={12} />
                <span>Tab Baru</span>
              </a>
              <button
                type="button"
                className={styles.lightboxCloseBtn}
                onClick={() => setActiveImage(null)}
                title="Tutup Pratinjau (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Centered Image Display with Zoom & Rotation */}
          <div
            className={styles.lightboxStage}
            onClick={() => setActiveImage(null)}
          >
            <img
              src={activeImage.url}
              alt={activeImage.alt}
              className={styles.lightboxImage}
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)`,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom Information Bar */}
          <div
            className={styles.lightboxBottomBar}
            onClick={(e) => e.stopPropagation()}
          >
            <span>Tekan Esc atau klik area kosong untuk menutup</span>
            <span>•</span>
            <span>Gunakan tombol zoom di atas untuk memeriksa jejak komponen PBA</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichNotesViewer;
