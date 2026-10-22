import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  History,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  Smile,
  X,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from './Avatar';
import { Button } from './Button';
import styles from './CommentTimelineSection.module.css';

const EMOJI_LIST = [
  '👍', '👎', '✅', '❌', '⚠️', '🚀', '🔥',
  '💡', '🔍', '📌', '🎯', '🔧', '🛠️', '📝',
  '📊', '📈', '👏', '🙌', '🎉', '✨', '💯',
  '😊', '😄', '🤔', '😅', '👀', '💬', '☕',
];

/**
 * Utility helper to record a timeline change log event for an entity.
 * Saves directly into the unified comments table with a `[LOG]` prefix.
 */
export const logTimelineEvent = async (entityType, entityId, message) => {
  if (!entityType || !entityId || !message) return null;
  try {
    const res = await api.post('/comments', {
      content: `[LOG] ${message}`,
      entity_type: entityType,
      entity_id: entityId,
    });
    return res.data;
  } catch (err) {
    console.error('Failed to record timeline log:', err);
    return null;
  }
};

export const CommentTimelineSection = ({
  entityType,
  entityId,
  entityTitle = '',
  refreshKey = 0,
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'comments' | 'logs'
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const streamEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSelectEmoji = (emoji) => {
    setNewComment((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const fetchTimeline = async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/comments', {
        params: {
          entity_type: entityType,
          entity_id: entityId,
        },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load comments/timeline:', err);
      setError('Gagal memuat komentar dan timeline log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [entityType, entityId, refreshKey]);

  const handlePostComment = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await api.post('/comments', {
        content: trimmed,
        entity_type: entityType,
        entity_id: entityId,
      });
      setItems((prev) => [...prev, res.data]);
      setNewComment('');
      // Scroll smoothly to bottom
      setTimeout(() => {
        streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengirim komentar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Hapus komentar ini?')) return;
    try {
      await api.delete(`/comments/${id}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus komentar');
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePostComment();
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isLogItem = (content = '') => {
    return content.startsWith('[LOG]') || content.startsWith('[TIMELINE]');
  };

  const getCleanLogText = (content = '') => {
    return content.replace(/^\[(LOG|TIMELINE)\]\s*/, '');
  };

  const logsCount = items.filter((it) => isLogItem(it.content)).length;
  const commentsCount = items.filter((it) => !isLogItem(it.content)).length;

  const filteredItems = items.filter((it) => {
    if (filter === 'comments') return !isLogItem(it.content);
    if (filter === 'logs') return isLogItem(it.content);
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Section Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>
            <MessageSquare size={15} color="var(--color-accent)" />
            Komentar & Timeline Aktivitas
          </h3>
          <span className={styles.countBadge}>{items.length}</span>
        </div>

        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            Semua ({items.length})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'comments' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('comments')}
          >
            Komentar ({commentsCount})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'logs' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('logs')}
          >
            Log Ubahan ({logsCount})
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div className={styles.stream}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Memuat timeline komentar dan log perubahan...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.emptyTimeline}>
            <MessageSquare size={20} color="var(--color-text-muted)" />
            <span>Belum ada diskusi atau catatan perubahan pada {entityTitle || 'item ini'}.</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Tulis tanggapan atau buat ubahan pertama Anda menggunakan form di bawah.
            </span>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLog = isLogItem(item.content);
            const canDelete =
              !isLog &&
              (user?.role === 'admin' ||
                (user?.id && item.author_id && String(user.id) === String(item.author_id)));

            if (isLog) {
              return (
                <div key={item.id} className={styles.logItem}>
                  <div className={styles.logIconWrapper} title="Log Perubahan Sistem">
                    <History size={12} />
                  </div>
                  <div className={styles.logContent}>
                    <span className={styles.logBadge}>LOG SISTEM</span>
                    <span className={styles.logActor}>
                      {item.author_name || user?.full_name || 'System'}
                    </span>
                    <span className={styles.logText}>
                      {getCleanLogText(item.content)}
                    </span>
                  </div>
                  <span className={styles.logTime} title={item.created_at}>
                    <Clock size={11} style={{ opacity: 0.6 }} />
                    {formatTime(item.created_at)}
                  </span>
                </div>
              );
            }

            return (
              <div key={item.id} className={styles.commentItem}>
                <Avatar name={item.author_name || 'User'} size="sm" />
                <div className={styles.commentBody}>
                  <div className={styles.commentMeta}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={styles.authorName}>
                        {item.author_name || 'Anggota Tim'}
                      </span>
                      {user?.id && item.author_id && String(user.id) === String(item.author_id) && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 4px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--color-accent-subtle)',
                          color: 'var(--color-accent)',
                          fontWeight: 600,
                        }}>
                          Anda
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.commentTime} title={item.created_at}>
                        {formatTime(item.created_at)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteItem(item.id)}
                          title="Hapus komentar ini"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.commentText}>{item.content}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={streamEndRef} />
      </div>

      {/* Comment Input Box */}
      <form onSubmit={handlePostComment} className={styles.formBox}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tulis komentar, catatan investigasi teknis, atau temuan verifikasi di sini..."
          disabled={submitting}
        />
        <div className={styles.formFooter}>
          <span className={styles.formHint}>
            Tekan <kbd style={{ padding: '1px 4px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '3px' }}>Ctrl + Enter</kbd> untuk kirim cepat
          </span>
          <div className={styles.formActionsRow}>
            {/* Emoji Picker Popover */}
            <div className={styles.emojiPickerContainer} ref={emojiPickerRef}>
              <button
                type="button"
                className={`${styles.emojiTriggerBtn} ${showEmojiPicker ? styles.emojiTriggerBtnActive : ''}`}
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Pilih Emoji"
              >
                <Smile size={15} />
                <span>Emoji</span>
              </button>

              {showEmojiPicker && (
                <div className={styles.emojiPopover}>
                  <div className={styles.emojiHeader}>
                    <span className={styles.emojiHeaderTitle}>Pilih Emoji</span>
                    <button
                      type="button"
                      className={styles.emojiCloseBtn}
                      onClick={() => setShowEmojiPicker(false)}
                      title="Tutup"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className={styles.emojiGrid}>
                    {EMOJI_LIST.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={styles.emojiBtn}
                        onClick={() => handleSelectEmoji(emoji)}
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Send}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? 'Mengirim...' : 'Kirim Komentar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
