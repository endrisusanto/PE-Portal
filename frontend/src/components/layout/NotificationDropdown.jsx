import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Zap,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Video,
  Scissors,
  FileText,
  Files,
  FileSpreadsheet,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import styles from './NotificationDropdown.module.css';

// Format bytes into human readable string
const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Relative time formatting
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  return `${Math.floor(diffHour / 24)}h lalu`;
};

// Map tool type to icon and metadata
const getToolConfig = (type) => {
  switch (type) {
    case 'video-compress':
      return {
        label: 'Video Compressor',
        icon: Video,
        route: '/tools/videos',
        color: '#3b82f6',
      };
    case 'remove-bg':
      return {
        label: 'Remove Background',
        icon: Scissors,
        route: '/tools/images',
        color: '#10b981',
      };
    case 'compress-pdf':
      return {
        label: 'Compress PDF',
        icon: FileText,
        route: '/tools/documents',
        color: '#f59e0b',
      };
    case 'merge-pdf':
      return {
        label: 'Merge PDF',
        icon: Files,
        route: '/tools/documents',
        color: '#8b5cf6',
      };
    case 'split-pdf':
      return {
        label: 'Split PDF',
        icon: Files,
        route: '/tools/documents',
        color: '#ec4899',
      };
    case 'pptx-summary':
      return {
        label: 'PPTX Auto Summary',
        icon: FileSpreadsheet,
        route: '/tools/summary',
        color: '#06b6d4',
      };
    default:
      return {
        label: 'Proses Server',
        icon: Sparkles,
        route: '/tools',
        color: 'var(--color-accent)',
      };
  }
};

export const NotificationDropdown = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const {
    toolsProgress,
    changeLogs,
    activeJobsCount,
    unreadLogsCount,
    fetchSummary,
    cancelJob,
    deleteJob,
    downloadJobResult,
  } = useNotifications();

  const activeTools = useMemo(() => {
    return toolsProgress.filter((j) => j.status === 'processing' || j.status === 'pending');
  }, [toolsProgress]);

  const completedTools = useMemo(() => {
    return toolsProgress.filter((j) => j.status !== 'processing' && j.status !== 'pending');
  }, [toolsProgress]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        fetchSummary();
      }
      return next;
    });
  };

  const totalBadgeCount = activeJobsCount + unreadLogsCount;

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* Navbar Trigger Button with Active Pill & Bell */}
      <div className={styles.triggerWrapper}>
        {activeJobsCount > 0 && (
          <button
            type="button"
            className={styles.activePill}
            onClick={handleToggle}
            title={`${activeJobsCount} proses latar belakang sedang berjalan`}
          >
            <Zap size={12} className={styles.zapIcon} />
            <span className={styles.activePillText}>
              {activeJobsCount} {t('common.processing', 'Berjalan')}
            </span>
          </button>
        )}

        <button
          type="button"
          className={`${styles.bellButton} ${isOpen ? styles.bellButtonActive : ''}`}
          onClick={handleToggle}
          aria-label="Notifications"
          title={t('common.notifications', 'Notifikasi & Status Tools')}
        >
          <Bell size={16} />
          {totalBadgeCount > 0 && (
            <span
              className={`${styles.badge} ${activeJobsCount > 0 ? styles.badgeActive : ''}`}
            >
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </span>
          )}
        </button>
      </div>

      {/* Origin-aware Popover Dropdown Card */}
      {isOpen && (
        <div className={styles.dropdownPopover}>
          {/* Header */}
          <div className={styles.popoverHeader}>
            <div className={styles.headerTitleRow}>
              <h3 className={styles.popoverTitle}>
                {t('common.notifications', 'Pusat Notifikasi & Tools')}
              </h3>
              {activeJobsCount > 0 && (
                <span className={styles.headerActiveBadge}>
                  <Zap size={11} /> {activeJobsCount} Aktif
                </span>
              )}
            </div>
            <p className={styles.popoverSub}>
              {t('common.notif_desc', 'Progress server-side background tools & log perubahan')}
            </p>
          </div>

          <div className={styles.scrollArea}>
            {/* ======================================================== */}
            {/* SECTION 1: PROSES TOOLS AKTIF BERJALAN (PRIORITAS TINGGI) */}
            {/* ======================================================== */}
            {activeTools.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div className={styles.sectionHeaderActive}>
                  <span className={styles.sectionTitleActive}>
                    <Zap size={14} className={styles.zapIcon} />
                    {t('tools.active_running_title', 'SEDANG BERJALAN')} ({activeTools.length})
                  </span>
                  <span className={styles.livePulseDot} />
                </div>
                <div className={styles.cardsList}>
                  {activeTools.map((job, idx) => (
                    <div
                      key={job.id}
                      className={`${styles.toolCard} ${styles.toolCardActive}`}
                      style={{ '--stagger': idx }}
                    >
                      <div className={styles.cardTopRow}>
                        <div
                          className={styles.toolIconWrap}
                          style={{
                            backgroundColor: `${getToolConfig(job.tool_type).color}1a`,
                            borderColor: `${getToolConfig(job.tool_type).color}4d`,
                          }}
                        >
                          {React.createElement(getToolConfig(job.tool_type).icon, {
                            size: 16,
                            color: getToolConfig(job.tool_type).color,
                          })}
                        </div>
                        <div className={styles.toolInfo}>
                          <span className={styles.toolName}>{getToolConfig(job.tool_type).label}</span>
                          <span className={styles.fileName} title={job.file_name}>
                            {job.file_name}
                          </span>
                        </div>
                        <span className={`${styles.statusBadge} ${styles.badgeProcessing}`}>
                          {job.status === 'pending' ? 'Antrean' : `${Math.round(job.progress_percent)}%`}
                        </span>
                      </div>

                      {/* Live animated progress bar for active running jobs */}
                      <div className={styles.progressSection}>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{ width: `${Math.max(6, job.progress_percent)}%` }}
                          >
                            <div className={styles.progressShimmer} />
                          </div>
                        </div>
                        <div className={styles.stepRow}>
                          <span className={styles.stepText}>
                            {job.current_step || 'Memproses di background server...'}
                          </span>
                          <span className={styles.percentText}>
                            {Math.round(job.progress_percent)}%
                          </span>
                        </div>
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.cardSecondaryBtn}
                          onClick={() => {
                            navigate(getToolConfig(job.tool_type).route);
                            setIsOpen(false);
                          }}
                        >
                          <ExternalLink size={12} />
                          <span>{t('tools.open_tool', 'Buka Tool')}</span>
                        </button>

                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => cancelJob(job.id)}
                        >
                          <X size={12} />
                          <span>{t('common.cancel', 'Batal')}</span>
                        </button>

                        <span className={styles.timeMeta}>
                          {timeAgo(job.created_at)}
                          {job.file_size > 0 && ` • ${formatBytes(job.file_size)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SECTION 2: RIWAYAT TOOLS SELESAI / GAGAL                */}
            {/* ======================================================== */}
            {completedTools.length > 0 && (
              <div>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    <CheckCircle2 size={13} color="var(--color-success, #10b981)" />
                    {t('tools.completed_title', 'Riwayat Selesai')}
                  </span>
                  <span className={styles.sectionCountBadge}>{completedTools.length}</span>
                </div>
                <div className={styles.cardsList}>
                  {completedTools.map((job, idx) => {
                    const cfg = getToolConfig(job.tool_type);
                    const Icon = cfg.icon;
                    const isCompleted = job.status === 'completed';
                    const isFailed = job.status === 'failed';
                    const isCancelled = job.status === 'cancelled';

                    let statusText = 'Selesai';
                    let statusClass = styles.badgeCompleted;
                    if (isFailed) {
                      statusText = 'Gagal';
                      statusClass = styles.badgeFailed;
                    } else if (isCancelled) {
                      statusText = 'Dibatalkan';
                      statusClass = styles.badgeCancelled;
                    }

                    const meta = typeof job.result_meta === 'string'
                      ? JSON.parse(job.result_meta || '{}')
                      : (job.result_meta || {});

                    return (
                      <div
                        key={job.id}
                        className={styles.toolCard}
                        style={{ '--stagger': idx }}
                      >
                        <div className={styles.cardTopRow}>
                          <div className={styles.toolIconWrap} style={{ backgroundColor: `${cfg.color}1a`, borderColor: `${cfg.color}4d` }}>
                            <Icon size={16} color={cfg.color} />
                          </div>
                          <div className={styles.toolInfo}>
                            <span className={styles.toolName}>{cfg.label}</span>
                            <span className={styles.fileName} title={job.file_name}>
                              {job.file_name}
                            </span>
                          </div>
                          <span className={`${styles.statusBadge} ${statusClass}`}>
                            {statusText}
                          </span>
                          <button
                            type="button"
                            className={styles.dismissBtn}
                            onClick={() => deleteJob(job.id)}
                            title="Hapus notifikasi"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        {/* Informative Metadata Pill Row */}
                        {(isCompleted || (meta && Object.keys(meta).length > 0)) && (
                          <div className={styles.metaPillsRow}>
                            {meta.savings_percent > 0 && (
                              <span className={styles.savingsPill}>
                                Hemat {meta.savings_percent}%
                              </span>
                            )}
                            {meta.original_size > 0 && meta.compressed_size > 0 && (
                              <span className={styles.metaInfoPill}>
                                {formatBytes(meta.original_size)} ➔ {formatBytes(meta.compressed_size)}
                              </span>
                            )}
                            {meta.encoder && (
                              <span className={styles.metaInfoPill}>
                                {meta.encoder.toUpperCase()}
                              </span>
                            )}
                            {job.duration_sec > 0 && (
                              <span className={styles.metaInfoPill}>
                                ⏱️ {job.duration_sec.toFixed(1)}s
                              </span>
                            )}
                          </div>
                        )}

                        {isFailed && job.error_message && (
                          <p className={styles.errorText}>
                            <AlertCircle size={12} /> {job.error_message}
                          </p>
                        )}

                        <div className={styles.cardActions}>
                          {isCompleted && (
                            <button
                              type="button"
                              className={styles.downloadBtn}
                              onClick={() => downloadJobResult(job.id, job.file_name)}
                            >
                              <Download size={13} />
                              <span>{t('tools.download_result', 'Unduh Hasil')}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.cardSecondaryBtn}
                            onClick={() => {
                              navigate(cfg.route);
                              setIsOpen(false);
                            }}
                          >
                            <ExternalLink size={12} />
                            <span>{t('tools.open_tool', 'Buka Tool')}</span>
                          </button>

                          <span className={styles.timeMeta}>
                            {timeAgo(job.created_at)}
                            {job.file_size > 0 && ` • ${formatBytes(job.file_size)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state if both active and completed are 0 */}
            {toolsProgress.length === 0 && (
              <div className={styles.emptyState}>
                <Clock size={20} className={styles.emptyIcon} />
                <p>{t('tools.no_active_jobs', 'Belum ada proses tools yang berjalan.')}</p>
                <button
                  type="button"
                  className={styles.openToolsLink}
                  onClick={() => {
                    navigate('/tools');
                    setIsOpen(false);
                  }}
                >
                  {t('tools.open_utilities', 'Buka Tools & Utilitas')} <ChevronRight size={13} />
                </button>
              </div>
            )}

            {/* ======================================================== */}
            {/* SECTION 2: LOG PERUBAHAN & UPDATE SISTEM                  */}
            {/* ======================================================== */}
            <div className={styles.sectionHeader} style={{ marginTop: '16px' }}>
              <span className={styles.sectionTitle}>
                <Clock size={13} color="#94a3b8" />
                {t('common.change_logs', 'Log Perubahan & Update Sistem')}
              </span>
              <span className={styles.sectionCountBadge}>
                {changeLogs.length}
              </span>
            </div>

            {changeLogs.length === 0 ? (
              <p className={styles.emptyLogsText}>
                {t('common.no_recent_logs', 'Belum ada log perubahan baru.')}
              </p>
            ) : (
              <div className={styles.logsList}>
                {changeLogs.map((log, lIdx) => (
                  <div
                    key={log.id || lIdx}
                    className={styles.logItem}
                    style={{ '--stagger': lIdx + toolsProgress.length }}
                    onClick={() => {
                      if (log.link) {
                        navigate(log.link);
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className={styles.logLeft}>
                      <span className={styles.logTag}>{log.tag || 'UPDATE'}</span>
                      <div className={styles.logContent}>
                        <h5 className={styles.logTitle}>{log.title}</h5>
                        <p className={styles.logMessage}>{log.message}</p>
                      </div>
                    </div>
                    <span className={styles.logTime}>{timeAgo(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

