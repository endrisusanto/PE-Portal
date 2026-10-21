import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Truck,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ChevronRight,
  Trash2,
  Edit3,
  Calendar,
  User,
  ArrowRight,
  Copy,
  Check,
  Building2,
  FileText,
  Filter,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import styles from './DhlTrackerPage.module.css';

export const DhlTrackerPage = () => {
  const { t, i18n } = useTranslation();

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collectedFilter, setCollectedFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const [copiedId, setCopiedId] = useState('');

  // DHL API Connectivity Status
  const [apiStatus, setApiStatus] = useState({ valid: true, status: 'checking', message: '' });

  // Add Form
  const [addForm, setAddForm] = useState({
    tracking_number: '',
    pic: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit Form
  const [editForm, setEditForm] = useState({
    id: '',
    pic: '',
    is_collected: false,
    notes: '',
  });

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (collectedFilter !== 'all') params.collected = collectedFilter;

      const { data } = await api.get('/dhl/shipments', { params });
      setShipments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load DHL shipments:', err);
      setErrorMsg(err.response?.data?.message || t('common.error', 'Terjadi kesalahan'));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, collectedFilter, t]);

  const checkDHLStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/dhl/status');
      setApiStatus(data || { valid: true, status: 'active', message: 'DHL API Connected' });
    } catch (err) {
      console.error('Failed to check DHL status:', err);
      setApiStatus({ valid: false, status: 'offline', message: 'DHL API Offline' });
    }
  }, []);

  useEffect(() => {
    fetchShipments();
    checkDHLStatus();
  }, [fetchShipments, checkDHLStatus]);

  // Flash message auto dismiss
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = shipments.length;
    let delivered = 0;
    let inTransit = 0;
    let waitingCollection = 0;

    shipments.forEach((s) => {
      const code = (s.status_code || '').toLowerCase();
      if (code === 'delivered') {
        delivered += 1;
        if (!s.is_collected) waitingCollection += 1;
      } else if (code === 'transit' || code === 'pre-transit') {
        inTransit += 1;
      }
    });

    return { total, inTransit, delivered, waitingCollection };
  }, [shipments]);

  // Handle Create / Track New AWB
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.tracking_number.trim()) return;

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload = {
        tracking_number: addForm.tracking_number.trim(),
        pic: addForm.pic.trim(),
        notes: addForm.notes.trim(),
      };
      await api.post('/dhl/shipments', payload);
      setSuccessMsg(t('dhl.success_added', { id: payload.tracking_number, defaultValue: `AWB #${payload.tracking_number} berhasil dilacak & disimpan.` }));
      setIsAddModalOpen(false);
      setAddForm({ tracking_number: '', pic: '', notes: '' });
      fetchShipments();
    } catch (err) {
      console.error('Error tracking DHL AWB:', err);
      setErrorMsg(err.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Refresh AWB Live Status
  const handleRefresh = async (id) => {
    try {
      setActionLoadingId(id);
      setErrorMsg('');
      const { data } = await api.post(`/dhl/shipments/${id}/refresh`);
      setSuccessMsg(t('dhl.success_refreshed', { id, defaultValue: `Status AWB #${id} berhasil diperbarui.` }));
      setShipments((prev) => prev.map((s) => (s.id === id ? data : s)));
      if (activeShipment?.id === id) {
        setActiveShipment(data);
      }
    } catch (err) {
      console.error('Refresh error:', err);
      setErrorMsg(err.response?.data?.message || t('common.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Is Collected
  const handleToggleCollected = async (shipment) => {
    const nextState = !shipment.is_collected;
    try {
      setActionLoadingId(shipment.id);
      await api.put(`/dhl/shipments/${shipment.id}`, {
        pic: shipment.pic,
        is_collected: nextState,
        notes: shipment.notes,
      });
      setShipments((prev) =>
        prev.map((s) =>
          s.id === shipment.id
            ? { ...s, is_collected: nextState, collected_at: nextState ? new Date().toISOString() : null }
            : s
        )
      );
      setSuccessMsg(
        nextState
          ? t('dhl.success_collected', { id: shipment.id, pic: shipment.pic || 'PIC', defaultValue: `Sample AWB #${shipment.id} ditandai: SUDAH DIAMBIL oleh ${shipment.pic || 'PIC'}.` })
          : t('dhl.success_uncollected', { id: shipment.id, defaultValue: `Sample AWB #${shipment.id} ditandai: BELUM DIAMBIL.` })
      );
    } catch (err) {
      console.error('Toggle collection error:', err);
      setErrorMsg(t('common.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (shipment) => {
    setEditForm({
      id: shipment.id,
      pic: shipment.pic || '',
      is_collected: Boolean(shipment.is_collected),
      notes: shipment.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.put(`/dhl/shipments/${editForm.id}`, {
        pic: editForm.pic.trim(),
        is_collected: editForm.is_collected,
        notes: editForm.notes.trim(),
      });
      setSuccessMsg(t('dhl.success_updated', { id: editForm.id, defaultValue: `Informasi AWB #${editForm.id} berhasil disimpan.` }));
      setIsEditModalOpen(false);
      fetchShipments();
    } catch (err) {
      console.error('Update error:', err);
      setErrorMsg(err.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Shipment
  const handleDelete = async (id) => {
    const confirmText = t('dhl.delete_confirm', { id, defaultValue: `Hapus AWB #${id} dari database pelacakan portal?` });
    if (!window.confirm(confirmText)) return;
    try {
      setActionLoadingId(id);
      await api.delete(`/dhl/shipments/${id}`);
      setSuccessMsg(t('dhl.success_deleted', { id, defaultValue: `AWB #${id} telah dihapus.` }));
      setShipments((prev) => prev.filter((s) => s.id !== id));
      if (activeShipment?.id === id) {
        setIsDetailModalOpen(false);
        setActiveShipment(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMsg(t('common.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Copy AWB
  const handleCopyAwb = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Format Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const locale = i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'en' ? 'en-US' : 'id-ID';
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Badge Status Styling
  const getStatusBadge = (code, label) => {
    const c = (code || '').toLowerCase();
    if (c === 'delivered') {
      return (
        <span className={`${styles.badge} ${styles.badgeDelivered}`}>
          <CheckCircle2 size={13} />
          {label || t('dhl.status_delivered', 'Delivered')}
        </span>
      );
    }
    if (c === 'transit') {
      return (
        <span className={`${styles.badge} ${styles.badgeTransit}`}>
          <Truck size={13} />
          {label || t('dhl.status_transit', 'In Transit')}
        </span>
      );
    }
    if (c === 'pre-transit') {
      return (
        <span className={`${styles.badge} ${styles.badgePreTransit}`}>
          <Clock size={13} />
          {label || t('dhl.status_pre_transit', 'Pre-Transit')}
        </span>
      );
    }
    return (
      <span className={`${styles.badge} ${styles.badgeFailure}`}>
        <AlertCircle size={13} />
        {label || code || 'Unknown'}
      </span>
    );
  };

  // Extract events and details from active shipment
  const activeEvents = useMemo(() => {
    if (!activeShipment?.shipment_data) return [];
    try {
      const parsed =
        typeof activeShipment.shipment_data === 'string'
          ? JSON.parse(activeShipment.shipment_data)
          : activeShipment.shipment_data;
      return Array.isArray(parsed.events) ? parsed.events : [];
    } catch {
      return [];
    }
  }, [activeShipment]);

  const activeDetails = useMemo(() => {
    if (!activeShipment?.shipment_data) return null;
    try {
      const parsed =
        typeof activeShipment.shipment_data === 'string'
          ? JSON.parse(activeShipment.shipment_data)
          : activeShipment.shipment_data;
      return parsed.details || null;
    } catch {
      return null;
    }
  }, [activeShipment]);

  return (
    <div className={styles.pageContainer}>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbBar} aria-label="Breadcrumb">
        <span className={styles.breadcrumbItem}>{t('nav.dashboard', 'Dashboard')}</span>
        <ChevronRight size={14} className={styles.breadcrumbSep} />
        <span className={styles.breadcrumbItem}>{t('nav.sample_management', 'Sample Management')}</span>
        <ChevronRight size={14} className={styles.breadcrumbSep} />
        <span className={`${styles.breadcrumbItem} ${styles.breadcrumbActive}`}>
          <Truck size={14} />
          {t('nav.dhl_tracker', 'DHL Tracker')}
        </span>
      </nav>

      {/* Header Banner */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitleWrap}>
            <div className={styles.dhlLogoBadge}>
              <span className={styles.dhlText}>DHL</span>
              <span className={styles.expressText}>EXPRESS</span>
            </div>
            <div>
              <div className={styles.titleWithStatus}>
                <h1 className={styles.pageTitle}>{t('dhl.title', 'DHL Shipment Tracker')}</h1>
                <div
                  className={`${styles.apiStatusBadge} ${
                    apiStatus?.valid
                      ? styles.apiStatusActive
                      : apiStatus?.status === 'checking'
                      ? styles.apiStatusChecking
                      : styles.apiStatusOffline
                  }`}
                  title={apiStatus?.message || (apiStatus?.valid ? 'DHL API Valid & Connected' : 'DHL API Offline')}
                >
                  <span className={styles.statusDotPulse} />
                  <span className={styles.apiStatusText}>
                    {apiStatus?.status === 'checking'
                      ? t('dhl.api_status_checking', 'Checking DHL API...')
                      : apiStatus?.valid
                      ? t('dhl.api_status_valid', 'DHL API Active')
                      : t('dhl.api_status_invalid', 'DHL API Offline')}
                  </span>
                </div>
              </div>
              <p className={styles.pageSubtitle}>
                {t('dhl.subtitle', 'Pelacakan Real-time Pengiriman Sample Engineering, Part Trial & Komponen via DHL API')}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            onClick={() => {
              fetchShipments();
              checkDHLStatus();
            }}
            disabled={loading}
            title={t('dhl.refresh', 'Refresh')}
          >
            <RefreshCw size={15} className={loading ? styles.spin : ''} />
            {t('dhl.refresh', 'Refresh')}
          </Button>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} />
            {t('dhl.track_new_awb', 'Lacak AWB Baru')}
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className={styles.alertError}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button className={styles.alertClose} onClick={() => setErrorMsg('')}>
            &times;
          </button>
        </div>
      )}
      {successMsg && (
        <div className={styles.alertSuccess}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button className={styles.alertClose} onClick={() => setSuccessMsg('')}>
            &times;
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Package size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{t('dhl.total_tracked', 'Total Dipantau')}</span>
            <span className={styles.statValue}>{stats.total}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Truck size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{t('dhl.in_transit', 'Dalam Perjalanan')}</span>
            <span className={styles.statValue}>{stats.inTransit}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{t('dhl.delivered', 'Tiba di Tujuan')}</span>
            <span className={styles.statValue}>{stats.delivered}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <Clock size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>{t('dhl.waiting_collection', 'Menunggu Ambil PIC')}</span>
            <span className={styles.statValue}>{stats.waitingCollection}</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className={styles.filterSection}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('dhl.search_placeholder', 'Cari AWB, PIC, Kota, atau catatan...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.selectWrap}>
            <Filter size={14} className={styles.selectIcon} />
            <select
              className={styles.selectInput}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{t('dhl.all_status', 'Semua Status')}</option>
              <option value="transit">{t('dhl.status_transit', 'Dalam Perjalanan (Transit)')}</option>
              <option value="delivered">{t('dhl.status_delivered', 'Sudah Tiba (Delivered)')}</option>
              <option value="pre-transit">{t('dhl.status_pre_transit', 'Pre-Transit / Manifest')}</option>
            </select>
          </div>

          <div className={styles.selectWrap}>
            <User size={14} className={styles.selectIcon} />
            <select
              className={styles.selectInput}
              value={collectedFilter}
              onChange={(e) => setCollectedFilter(e.target.value)}
            >
              <option value="all">{t('dhl.all_samples', 'Semua Status Sample')}</option>
              <option value="uncollected">{t('dhl.filter_waiting_collection', 'Menunggu Pengambilan')}</option>
              <option value="collected">{t('dhl.filter_collected', 'Sudah Diambil PIC')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content List / Table */}
      {loading && shipments.length === 0 ? (
        <LoadingState message={t('common.loading', 'Memuat data...')} />
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t('dhl.empty_title', 'Belum ada kiriman DHL yang dilacak')}
          description={t('dhl.empty_desc', 'Tambahkan nomor resi / AWB pengiriman sample engineering untuk memantau pergerakan dari Korea/luar negeri secara real-time.')}
          actionText={t('dhl.track_new_awb', 'Lacak AWB Baru')}
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div className={styles.cardsGrid}>
          {shipments.map((item) => {
            const isDelivered = (item.status_code || '').toLowerCase() === 'delivered';
            const isCollected = Boolean(item.is_collected);
            const isActionLoading = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                className={`${styles.shipmentCard} ${isCollected ? styles.cardCollected : ''}`}
              >
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.awbBadgeGroup}>
                    <span className={styles.awbNumber}>{item.id}</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('dhl.copy_awb', 'Salin AWB')}
                      onClick={() => handleCopyAwb(item.id)}
                    >
                      {copiedId === item.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                    <a
                      href={`https://www.dhl.com/en/express/tracking.html?AWB=${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.iconBtn}
                      title={t('dhl.open_dhl_site', 'Buka di DHL Tracking Website')}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  <div>{getStatusBadge(item.status_code, item.status_label)}</div>
                </div>

                {/* Route Flow */}
                <div className={styles.routeBox}>
                  <div className={styles.routePoint}>
                    <Building2 size={14} className={styles.routeIcon} />
                    <div>
                      <div className={styles.routeCity}>{item.origin_city || item.origin_country || 'Origin'}</div>
                      <div className={styles.routeCountry}>{item.origin_country || '-'}</div>
                    </div>
                  </div>

                  <div className={styles.routeArrowWrap}>
                    <div className={styles.routeLine} />
                    <ArrowRight size={14} className={styles.routeArrow} />
                  </div>

                  <div className={styles.routePoint} style={{ textAlign: 'right' }}>
                    <div>
                      <div className={styles.routeCity}>{item.dest_city || item.dest_country || 'Destination'}</div>
                      <div className={styles.routeCountry}>{item.dest_country || '-'}</div>
                    </div>
                    <MapPin size={14} className={styles.routeIcon} />
                  </div>
                </div>

                {/* Latest Event Checkpoint */}
                <div className={styles.checkpointBox}>
                  <div className={styles.checkpointHeader}>
                    <Clock size={13} />
                    <span>{t('dhl.last_checkpoint', 'Checkpoint Terakhir:')}</span>
                    <span className={styles.checkpointTime}>{formatDate(item.last_event_time)}</span>
                  </div>
                  <div className={styles.checkpointDesc}>
                    {item.status_description || item.status_label || '-'}
                  </div>
                  {item.last_location && (
                    <div className={styles.checkpointLoc}>
                      <MapPin size={12} />
                      {item.last_location}
                    </div>
                  )}
                </div>

                {/* PIC and Physical Sample Collection Status */}
                <div className={styles.picSection}>
                  <div className={styles.picInfo}>
                    <User size={14} className={styles.picIcon} />
                    <div>
                      <div className={styles.picLabel}>{t('dhl.pic_label', 'PIC Penerima:')}</div>
                      <div className={styles.picName}>{item.pic || t('dhl.unassigned', 'Belum Ditugaskan')}</div>
                    </div>
                  </div>

                  {isDelivered && (
                    <button
                      type="button"
                      className={`${styles.collectionToggle} ${isCollected ? styles.toggleCollected : styles.togglePending}`}
                      onClick={() => handleToggleCollected(item)}
                      disabled={isActionLoading}
                      title={isCollected ? t('dhl.sample_collected') : t('dhl.waiting_pickup')}
                    >
                      {isCollected ? (
                        <>
                          <CheckCircle2 size={13} />
                          {t('dhl.sample_collected', 'Sample Diambil')}
                        </>
                      ) : (
                        <>
                          <Clock size={13} />
                          {t('dhl.waiting_pickup', 'Menunggu Ambil')}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Notes if any */}
                {item.notes && (
                  <div className={styles.notesBox}>
                    <FileText size={12} />
                    <span>{item.notes}</span>
                  </div>
                )}

                {/* Card Action Footer */}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={styles.timelineBtn}
                    onClick={() => {
                      setActiveShipment(item);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <Layers size={14} />
                    {t('dhl.detail_history', 'Detail Riwayat')}
                  </button>

                  <div className={styles.cardActionGroup}>
                    <button
                      type="button"
                      className={styles.smallActionBtn}
                      title={t('dhl.refresh', 'Refresh')}
                      onClick={() => handleRefresh(item.id)}
                      disabled={isActionLoading}
                    >
                      <RefreshCw size={14} className={isActionLoading ? styles.spin : ''} />
                    </button>
                    <button
                      type="button"
                      className={styles.smallActionBtn}
                      title={t('dhl.edit_info', 'Edit PIC & Catatan')}
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.smallActionBtn} ${styles.btnDanger}`}
                      title={t('dhl.delete_awb', 'Hapus dari pelacakan')}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add New Tracking Number */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('dhl.modal_add_title', 'Lacak Pengiriman DHL Express Baru')}
        maxWidth="560px"
      >
        <form onSubmit={handleAddSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t('dhl.awb_number_label', 'Nomor Resi / AWB DHL')} <span className={styles.req}>*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: 1234567890"
              value={addForm.tracking_number}
              onChange={(e) => setAddForm({ ...addForm, tracking_number: e.target.value })}
              required
              autoFocus
            />
            <span className={styles.formHint}>
              {t('dhl.awb_number_hint', 'Masukkan 10 digit AWB DHL Express. Data checkpoint otomatis diambil dari API resmi DHL.')}
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('dhl.pic_input_label', 'PIC Penerima')}</label>
            <Input
              type="text"
              placeholder={t('dhl.pic_input_placeholder', 'Nama PIC penerima sample')}
              value={addForm.pic}
              onChange={(e) => setAddForm({ ...addForm, pic: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('dhl.notes_label', 'Catatan / Identitas Sample')}</label>
            <textarea
              className={styles.textareaInput}
              rows={3}
              placeholder={t('dhl.notes_placeholder', 'Contoh: Sample Main Board Model SM-A566B, 5 Pcs trial dari HQ Korea')}
              value={addForm.notes}
              onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
              {t('dhl.cancel', 'Batal')}
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || !addForm.tracking_number.trim()}>
              {submitting ? t('dhl.contacting_dhl', 'Menghubungi DHL...') : t('dhl.track_and_save', 'Lacak & Simpan')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit PIC & Notes */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`${t('dhl.modal_edit_title', 'Edit Informasi Kiriman')} #${editForm.id}`}
        maxWidth="500px"
      >
        <form onSubmit={handleEditSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('dhl.pic_input_label', 'PIC Penerima')}</label>
            <Input
              type="text"
              placeholder={t('dhl.pic_input_placeholder', 'Nama PIC penerima sample')}
              value={editForm.pic}
              onChange={(e) => setEditForm({ ...editForm, pic: e.target.value })}
            />
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={editForm.is_collected}
                onChange={(e) => setEditForm({ ...editForm, is_collected: e.target.checked })}
              />
              <span>{t('dhl.checkbox_collected', 'Fisik sample sudah diambil dari security/reception oleh PIC')}</span>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('dhl.special_notes', 'Catatan Khusus')}</label>
            <textarea
              className={styles.textareaInput}
              rows={3}
              placeholder="Catatan sample..."
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)}>
              {t('dhl.cancel', 'Batal')}
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? t('dhl.saving', 'Menyimpan...') : t('dhl.save_changes', 'Simpan Perubahan')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detailed Timeline History */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`${t('dhl.modal_history_title', 'Riwayat Pengiriman DHL')} - AWB #${activeShipment?.id || ''}`}
        maxWidth="760px"
      >
        {activeShipment && (
          <div className={styles.detailContainer}>
            {/* Summary Top Row */}
            <div className={styles.detailSummaryRow}>
              <div>
                <div className={styles.detailStatusWrap}>
                  {getStatusBadge(activeShipment.status_code, activeShipment.status_label)}
                  <span className={styles.detailService}>{activeShipment.service_name || 'DHL Express'}</span>
                </div>
                <div className={styles.detailRouteBadge}>
                  <span className={styles.routeChip}>
                    <MapPin size={12} />
                    {activeShipment.origin_city || activeShipment.origin_country || 'Origin'}
                  </span>
                  <ArrowRight size={13} className={styles.routeArrow} />
                  <span className={styles.routeChipActive}>
                    <CheckCircle2 size={12} />
                    {activeShipment.dest_city || activeShipment.dest_country || 'Destination'}
                  </span>
                </div>
              </div>

              {activeDetails && (
                <div className={styles.detailSpecs}>
                  {activeDetails.totalNumberOfPieces && (
                    <div className={styles.specItem}>
                      <span className={styles.specLabel}>{t('dhl.pieces_count', 'Jumlah Koli/Pieces:')}</span>
                      <span className={styles.specVal}>{activeDetails.totalNumberOfPieces}</span>
                    </div>
                  )}
                  {activeDetails.weight && (
                    <div className={styles.specItem}>
                      <span className={styles.specLabel}>{t('dhl.weight', 'Berat:')}</span>
                      <span className={styles.specVal}>
                        {activeDetails.weight.value} {activeDetails.weight.unitText || 'kg'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vertical Events Timeline */}
            <h3 className={styles.timelineSectionTitle}>{t('dhl.events_title', 'Perjalanan Paket (Events Checkpoint)')}</h3>

            {activeEvents.length === 0 ? (
              <div className={styles.emptyEvents}>{t('dhl.no_events', 'Tidak ada rincian event checkpoint dari DHL.')}</div>
            ) : (
              <div className={styles.timelineTrack}>
                {activeEvents.map((ev, idx) => {
                  const evLoc = ev.location?.address?.addressLocality || ev.location?.address?.countryCode || '';
                  const isLatest = idx === 0;

                  return (
                    <div key={`${ev.timestamp}-${idx}`} className={styles.timelineItem}>
                      <div className={`${styles.timelineDot} ${isLatest ? styles.timelineDotActive : ''}`} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineStatus}>
                            {ev.description || ev.status || 'Checkpoint Update'}
                          </span>
                          <span className={styles.timelineDate}>{formatDate(ev.timestamp)}</span>
                        </div>
                        {evLoc && (
                          <div className={styles.timelineLoc}>
                            <MapPin size={12} />
                            {evLoc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.detailFooter}>
              <a
                href={`https://www.dhl.com/en/express/tracking.html?AWB=${activeShipment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLinkBtn}
              >
                <ExternalLink size={14} />
                {t('dhl.open_dhl_site', 'Buka di DHL Tracking Website')}
              </a>
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                {t('dhl.close', 'Tutup')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DhlTrackerPage;
