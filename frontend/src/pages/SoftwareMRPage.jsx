import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitCompare,
  Layers,
  Cpu,
  Calendar,
  Users,
  Search,
  Copy,
  Check,
  Eye,
  RefreshCw,
  FileCode,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import api from '../api/client';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import styles from './SoftwareMRPage.module.css';

export const SoftwareMRPage = () => {
  const { t } = useTranslation();

  // State
  const [stats, setStats] = useState({
    total_releases: 0,
    unique_models: 0,
    today_releases: 0,
    active_pics: 0
  });

  const [filters, setFilters] = useState({
    models: [],
    pics: [],
    years: []
  });

  const [releases, setReleases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState(null);

  // Copy Feedback Toast
  const [copyFeedback, setCopyFeedback] = useState('');

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/software-mr/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch Software MR stats:', err);
    }
  }, []);

  // Fetch Filter Dropdowns
  const fetchFilters = useCallback(async () => {
    try {
      const { data } = await api.get('/software-mr/filters');
      setFilters(data);
    } catch (err) {
      console.error('Failed to fetch Software MR filters:', err);
    }
  }, []);

  // Fetch Releases List
  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit
      };
      if (search) params.search = search;
      if (selectedPic) params.pic = selectedPic;
      if (selectedModel) params.model = selectedModel;
      if (selectedStatus) params.status = selectedStatus;

      const { data } = await api.get('/software-mr', { params });
      setReleases(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch Software MR releases:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedPic, selectedModel, selectedStatus]);

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, [fetchStats, fetchFilters]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  // Copy to clipboard helper
  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} berhasil disalin!`);
    setTimeout(() => {
      setCopyFeedback('');
    }, 2000);
  };

  // Open Detail Modal
  const handleOpenDetail = (rel) => {
    setSelectedRelease(rel);
    setDetailModalOpen(true);
  };

  return (
    <div className={styles.container}>
      {/* Toast Feedback */}
      {copyFeedback && (
        <div className={styles.copySuccessBadge}>
          <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
          {copyFeedback}
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <GitCompare size={26} color="var(--color-accent)" />
            Software MR (Maintenance Release)
          </h1>
          <p className={styles.subtitle}>
            Cheatsheet Pemetaan Binary Firmware, CSC Version Up & Catatan Rilis Perangkat SEIN
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={styles.viewOnlyBadge}>
            <Eye size={13} />
            View-Only Mode
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchFilters();
              fetchReleases();
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Rilis Firmware</span>
            <span className={styles.kpiValue}>
              {stats.total_releases.toLocaleString()} Rilis
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Model Terdaftar</span>
            <span className={styles.kpiValue} style={{ color: '#818cf8' }}>
              {stats.unique_models.toLocaleString()} Model
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
            <Cpu size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Rilis Hari Ini</span>
            <span className={styles.kpiValue} style={{ color: '#34d399' }}>
              {stats.today_releases.toLocaleString()} Rilis
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Calendar size={22} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>PIC Engineer Aktif</span>
            <span className={styles.kpiValue} style={{ color: '#f59e0b' }}>
              {stats.active_pics.toLocaleString()} PIC
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className={styles.tableContainer}>
        {/* Toolbar & Filters */}
        <div className={styles.tableToolbar}>
          <div className={styles.tableFilters}>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Cari model, AP, CP, CSC, PIC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <select
              className={styles.filterSelect}
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Model</option>
              {filters.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedPic}
              onChange={(e) => {
                setSelectedPic(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua PIC</option>
              {filters.pics.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {total} Rilis Ditemukan
          </span>
        </div>

        {/* Master Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.mainTable}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Model</th>
                <th>PIC</th>
                <th>AP Version</th>
                <th>CP Version</th>
                <th>CSC Version</th>
                <th>CSC Version Up</th>
                <th>Tanggal Rilis</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Cheatsheet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    Memuat data rilis firmware...
                  </td>
                </tr>
              ) : releases.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    Tidak ada catatan rilis yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                releases.map((rel, idx) => (
                  <tr
                    key={rel.id}
                    className={styles.clickableRow}
                    onClick={() => handleOpenDetail(rel)}
                  >
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {(page - 1) * limit + idx + 1}
                    </td>

                    <td>
                      <span className={styles.modelBadge}>
                        <FileCode size={13} />
                        {rel.model}
                      </span>
                    </td>

                    <td>
                      <span className={styles.picBadge}>
                        {rel.pic}
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.ap}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.ap, `AP ${rel.ap}`);
                          }}
                          title="Salin AP"
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.cp}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.cp, `CP ${rel.cp}`);
                          }}
                          title="Salin CP"
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill}>
                        {rel.csc}
                        <button
                          type="button"
                          className={styles.copyIconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rel.csc, `CSC ${rel.csc}`);
                          }}
                          title="Salin CSC"
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className={styles.monoPill} style={{ color: '#34d399' }}>
                        {rel.csc_version_up || '-'}
                      </span>
                    </td>

                    <td style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(rel.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    <td>
                      <span className={styles.statusPillDone}>
                        <ShieldCheck size={11} />
                        {rel.status || 'DONE'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={styles.btnDetail}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(rel);
                        }}
                      >
                        <Eye size={12} />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Menampilkan {releases.length} dari {total} rilis maintenance
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </div>

      {/* CHEATSHEET DETAIL MODAL */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Release Cheatsheet: ${selectedRelease?.model || ''}`}
        maxWidth="min(880px, 92vw)"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              PIC: <strong>{selectedRelease?.pic}</strong> • Rilis: {selectedRelease ? new Date(selectedRelease.created_at).toLocaleDateString('id-ID') : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Tutup
              </Button>
              <Button
                variant="primary"
                onClick={() => handleCopy(selectedRelease?.release_note_format, 'Format Release Note')}
              >
                <Copy size={14} />
                Salin Release Note
              </Button>
            </div>
          </div>
        }
      >
        {selectedRelease && (
          <div>
            {/* Version Information Grid */}
            <div className={styles.modalGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Model Target</span>
                <span className={styles.infoValue}>
                  {selectedRelease.model}
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.model, 'Model')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>PIC Release</span>
                <span className={styles.infoValue}>{selectedRelease.pic}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>AP Version</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.ap}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.ap, 'AP')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>CP Version</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.cp}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.cp, 'CP')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>CSC Version (Base)</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{selectedRelease.csc}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.csc, 'CSC')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>CSC Version Up</span>
                <span className={styles.infoValue}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#34d399' }}>{selectedRelease.csc_version_up}</span>
                  <button
                    type="button"
                    className={styles.copyIconBtn}
                    onClick={() => handleCopy(selectedRelease.csc_version_up, 'CSC Version Up')}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </div>
            </div>

            {/* Release Note Block */}
            <div>
              <span className={styles.infoLabel} style={{ display: 'block', marginBottom: 6 }}>
                Format Release Note (Cheatsheet Preview):
              </span>
              <div className={styles.releaseNoteBox}>
                {selectedRelease.release_note_format || 'Tidak ada teks release note.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
