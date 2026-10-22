import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  Lock,
  Unlock,
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  FileCheck,
  ShieldCheck,
  Pencil,
  Trash2,
  X,
  Upload
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import styles from './TrainingPage.module.css';

const CATEGORIES = [
  'ALL',
  'EHS & Safety',
  'Information Security',
  'Technical & AI',
  'Compliance',
  'Quality & Standards'
];

export const TrainingPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [unlockTarget, setUnlockTarget] = useState(null); // module object
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Answer Key Viewer Modal
  const [answerKeyData, setAnswerKeyData] = useState(null); // { title, images, notes }

  // Banner Preview Modal
  const [bannerPreview, setBannerPreview] = useState(null); // image url

  // Create Training Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'EHS & Safety',
    description: '',
    link_url: 'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
    deadline: '',
    is_mandatory: true,
    banner_image: '/training-assets/training.png',
    has_answer_key: true,
    answer_key_password: '2025',
    answer_key_images: ['/training-assets/1759219281_jawaban.png'],
    answer_key_notes: ''
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit Training Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Upload state indicators: null | 'create' | 'edit'
  const [uploadingBanner, setUploadingBanner] = useState(null);
  const [uploadingAnswer, setUploadingAnswer] = useState(null);

  // Dynamic Menu / Feature Permissions
  const [menuPermissions, setMenuPermissions] = useState(() => {
    try {
      const cached = localStorage.getItem('pe_menu_permissions');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const fetchPerms = () => {
      api.get('/navigation/menu-permissions')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setMenuPermissions(res.data);
            localStorage.setItem('pe_menu_permissions', JSON.stringify(res.data));
          }
        })
        .catch(() => {});
    };

    fetchPerms();
    window.addEventListener('pe_menu_permissions_updated', fetchPerms);
    return () => window.removeEventListener('pe_menu_permissions_updated', fetchPerms);
  }, []);

  // Determine if current user is allowed to view/unlock post-test answer keys
  const isAnswerKeyAllowed = useMemo(() => {
    if (user?.role === 'admin') return true;
    if (!menuPermissions || !Array.isArray(menuPermissions)) return true;

    const perm = menuPermissions.find((p) => p.menu_key === 'training-answer-key');
    if (!perm) return true;

    // 1. Master toggle
    if (perm.is_visible === false) return false;

    // 2. Specific user restriction check
    if (perm.allowed_users && perm.allowed_users.length > 0) {
      const uName = (user?.username || '').toLowerCase();
      const uEmp = (user?.employee_id || '').toLowerCase();
      const uEmail = (user?.email || '').toLowerCase();
      const uId = (user?.id || '').toLowerCase();
      const match = perm.allowed_users.some((u) => {
        const t = (u || '').toLowerCase().trim();
        return t && (t === uName || t === uEmp || t === uEmail || t === uId);
      });
      if (!match) return false;
    }

    // 3. Role check
    if (perm.allowed_roles && perm.allowed_roles.length > 0) {
      const userRole = user?.role || 'member';
      if (!perm.allowed_roles.includes(userRole)) return false;
    }

    // 4. Department / Part check
    if (perm.allowed_groups && perm.allowed_groups.length > 0) {
      const userParentGroup = user?.parent_group || '';
      const userGroupId = user?.group_part_id || '';
      const match = perm.allowed_groups.some(
        (g) => g === userParentGroup || g === userGroupId
      );
      if (!match) return false;
    }

    return true;
  }, [user, menuPermissions]);

  // Current timestamp for live countdown
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTrainings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (mandatoryOnly) params.mandatory = 'true';
      if (search) params.search = search;

      const res = await api.get('/trainings', { params });
      setTrainings(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load trainings:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, mandatoryOnly, search]);

  useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  // Handle open password unlock modal
  const handleOpenUnlockModal = (training) => {
    setUnlockTarget(training);
    setPasswordInput('');
    setUnlockError('');
    setShowPassword(false);
  };

  // Submit unlock password
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!unlockTarget) return;

    if (!passwordInput.trim()) {
      setUnlockError('Masukkan password otorisasi untuk membuka.');
      return;
    }

    setUnlocking(true);
    setUnlockError('');

    try {
      const res = await api.post(`/trainings/${unlockTarget.id}/unlock`, {
        password: passwordInput
      });

      if (res.data?.success) {
        // Unlock successful: close unlock modal and open Answer Key Viewer!
        const currentTarget = unlockTarget;
        setUnlockTarget(null);
        setAnswerKeyData({
          title: currentTarget.title,
          images: res.data?.data?.answer_key_images || [],
          notes: res.data?.data?.answer_key_notes || ''
        });
      } else {
        setUnlockError(res.data?.error || 'Password salah. Akses ditolak.');
      }
    } catch (err) {
      setUnlockError(err.response?.data?.error || 'Password salah. Akses ditolak. Hubungi endri.s@samsung.com untuk akses.');
    } finally {
      setUnlocking(false);
    }
  };

  // Submit new training creation
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setCreateError('Judul training wajib diisi.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError('');

    try {
      await api.post('/trainings', createForm);
      setIsCreateModalOpen(false);
      fetchTrainings();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Gagal menyimpan training.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Asset Upload Handlers
  const handleUploadBannerFile = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingBanner(isEdit ? 'edit' : 'create');
      const res = await api.post('/trainings/upload-asset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.url) {
        if (isEdit) {
          setEditForm(prev => ({ ...prev, banner_image: res.data.url }));
        } else {
          setCreateForm(prev => ({ ...prev, banner_image: res.data.url }));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengupload gambar banner.');
    } finally {
      setUploadingBanner(null);
      e.target.value = '';
    }
  };

  const handleUploadAnswerKeys = async (e, isEdit = false) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setUploadingAnswer(isEdit ? 'edit' : 'create');
      const uploadedUrls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/trainings/upload-asset', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data?.url) {
          uploadedUrls.push(res.data.url);
        }
      }

      if (isEdit) {
        setEditForm(prev => ({
          ...prev,
          answer_key_images: [...(prev?.answer_key_images || []), ...uploadedUrls]
        }));
      } else {
        setCreateForm(prev => ({
          ...prev,
          answer_key_images: [...(prev?.answer_key_images || []), ...uploadedUrls]
        }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengupload gambar kunci jawaban.');
    } finally {
      setUploadingAnswer(null);
      e.target.value = '';
    }
  };

  const handleRemoveAnswerImage = (indexToRemove, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        answer_key_images: (prev?.answer_key_images || []).filter((_, i) => i !== indexToRemove)
      }));
    } else {
      setCreateForm(prev => ({
        ...prev,
        answer_key_images: (prev?.answer_key_images || []).filter((_, i) => i !== indexToRemove)
      }));
    }
  };

  // Open Edit Training Modal with existing course data
  const handleOpenEditModal = async (tItem) => {
    setEditForm({
      id: tItem.id,
      title: tItem.title || '',
      category: tItem.category || 'EHS & Safety',
      description: tItem.description || '',
      link_url: tItem.link_url || '',
      deadline: tItem.deadline ? tItem.deadline.split('T')[0] : '',
      is_mandatory: Boolean(tItem.is_mandatory),
      banner_image: tItem.banner_image || '/training-assets/training.png',
      has_answer_key: Boolean(tItem.has_answer_key),
      answer_key_password: '', // leave empty to keep existing password
      answer_key_images: Array.isArray(tItem.answer_key_images) ? tItem.answer_key_images : [],
      answer_key_notes: tItem.answer_key_notes || ''
    });
    setEditError('');
    setIsEditModalOpen(true);

    try {
      const res = await api.get(`/trainings/${tItem.id}`);
      if (res.data) {
        setEditForm((prev) => {
          if (!prev || prev.id !== tItem.id) return prev;
          return {
            ...prev,
            banner_image: res.data.banner_image || prev.banner_image,
            answer_key_images: Array.isArray(res.data.answer_key_images) ? res.data.answer_key_images : prev.answer_key_images,
            answer_key_notes: res.data.answer_key_notes !== undefined ? res.data.answer_key_notes : prev.answer_key_notes
          };
        });
      }
    } catch (e) {
      console.warn('Could not fetch full training details for edit:', e);
    }
  };

  // Submit Edit Training
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm || !editForm.title.trim()) {
      setEditError('Judul training wajib diisi.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      await api.put(`/trainings/${editForm.id}`, editForm);
      setIsEditModalOpen(false);
      setEditForm(null);
      fetchTrainings();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Gagal memperbarui modul training.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete Training
  const handleDeleteTraining = async (tItem) => {
    if (!window.confirm(`Hapus modul training "${tItem.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      await api.delete(`/trainings/${tItem.id}`);
      fetchTrainings();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus modul training.');
    }
  };

  // Format countdown string
  const getCountdownDisplay = (deadlineStr) => {
    if (!deadlineStr) return null;
    const deadlineTime = new Date(deadlineStr).getTime();
    const diff = deadlineTime - now;

    if (diff <= 0) {
      return { passed: true, text: 'Deadline Passed' };
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      passed: false,
      text: `${String(d).padStart(2, '0')}d : ${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`
    };
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <GraduationCap className="text-cyan-400" size={28} />
            {t('training.title', 'Online Training & Post-Test Portal')}
          </h1>
          <p className={styles.subtitle}>
            {t('training.subtitle', 'Mandatory and professional development courses with post-test guides')}
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={fetchTrainings}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {isAdmin && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setCreateForm({
                  title: '',
                  category: 'EHS & Safety',
                  description: '',
                  link_url: 'https://samsungu.csod.com/LMS/UserTranscript/MainView.aspx',
                  deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
                  is_mandatory: true,
                  banner_image: '/training-assets/training.png',
                  has_answer_key: true,
                  answer_key_password: '2025',
                  answer_key_images: ['/training-assets/1759219281_jawaban.png'],
                  answer_key_notes: '1. A, 2. C, 3. D, 4. B, 5. A'
                });
                setCreateError('');
                setIsCreateModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Tambah Training</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.categoriesWrapper}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={mandatoryOnly}
              onChange={(e) => setMandatoryOnly(e.target.checked)}
            />
            Hanya Wajib (Mandatory)
          </label>

          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari training..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Course Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p>Memuat daftar training online...</p>
        </div>
      ) : trainings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>Tidak ada modul training yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {trainings.map((tItem) => {
            const countdownInfo = getCountdownDisplay(tItem.deadline);
            return (
              <div key={tItem.id} className={styles.card}>
                {/* Banner Thumbnail */}
                <div
                  className={styles.bannerWrapper}
                  onClick={() => tItem.banner_image && setBannerPreview(tItem.banner_image)}
                  title="Klik untuk melihat banner penuh"
                >
                  <img
                    src={tItem.banner_image || '/training-assets/training.png'}
                    alt={tItem.title}
                    className={styles.bannerImg}
                    onError={(e) => {
                      e.target.src = '/training-assets/training.png';
                    }}
                  />
                  <div className={styles.badgeOverlay}>
                    <span className={styles.categoryTag}>{tItem.category}</span>
                    {tItem.is_mandatory ? (
                      <span className={styles.mandatoryBadge}>MANDATORY</span>
                    ) : (
                      <span className={styles.optionalBadge}>OPTIONAL</span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle} title={tItem.title}>
                    {tItem.title}
                  </h2>
                  <p className={styles.cardDesc}>
                    {tItem.description}
                  </p>

                  {/* Countdown Timer */}
                  {countdownInfo && (
                    <div className={styles.deadlineContainer}>
                      <div className={styles.deadlineLabel}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Registration / Completion Deadline
                      </div>
                      <div className={countdownInfo.passed ? styles.deadlinePassed : styles.countdownTimer}>
                        {countdownInfo.text}
                      </div>
                    </div>
                  )}

                  {/* Actions Area */}
                  <div className={styles.cardActions}>
                    {/* Launch LMS Link */}
                    <a
                      href={tItem.link_url || 'https://samsungu.csod.com/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.launchButton}
                    >
                      <ExternalLink size={16} />
                      <span>Buka Kursus Training</span>
                    </a>

                    {/* View Post-Test Key Button */}
                    {isAnswerKeyAllowed && (
                      tItem.has_answer_key ? (
                        <button
                          type="button"
                          className={styles.keyButton}
                          onClick={() => handleOpenUnlockModal(tItem)}
                        >
                          <Lock size={15} />
                          <span>Lihat Kunci Jawaban</span>
                        </button>
                      ) : (
                        <div className={styles.noKeyBadge}>
                          Tidak Ada Kunci Jawaban Post-Test
                        </div>
                      )
                    )}

                    {/* Admin Access: Edit & Delete (ponytail) */}
                    {isAdmin && (
                      <div className={styles.adminCardActions}>
                        <button
                          type="button"
                          className={styles.editCardBtn}
                          onClick={() => handleOpenEditModal(tItem)}
                          title="Edit Modul Training"
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className={styles.deleteCardBtn}
                          onClick={() => handleDeleteTraining(tItem)}
                          title="Hapus Modul Training"
                        >
                          <Trash2 size={13} />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Password Unlock Modal (Strictly in-app Modal, NO native prompt!) */}
      <Modal
        isOpen={Boolean(unlockTarget)}
        onClose={() => setUnlockTarget(null)}
        title="Buka Kunci Jawaban Post-Test"
        maxWidth="500px"
      >
        <form onSubmit={handleUnlockSubmit} className={styles.unlockBox}>
          <div className={styles.unlockNotice}>
            <KeyRound size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                {unlockTarget?.title}
              </div>
              <div>
                Masukkan password untuk membuka kunci jawaban & panduan soal post-test.
              </div>
            </div>
          </div>

          {unlockError && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{unlockError}</span>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="unlockPassword">Password Kunci Jawaban</label>
            <div className={styles.passwordInputWrapper}>
              <input
                id="unlockPassword"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Masukkan kata sandi (default: 2025)..."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className={styles.inputHelper}>
              Hubungi <strong>endri.s@samsung.com</strong> untuk akses otorisasi.
            </span>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setUnlockTarget(null)}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={unlocking}
            >
              {unlocking ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <Unlock size={15} />
                  <span>Buka Kunci</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Answer Key Viewer Modal */}
      <Modal
        isOpen={Boolean(answerKeyData)}
        onClose={() => setAnswerKeyData(null)}
        title={`Kunci Jawaban Post-Test: ${answerKeyData?.title}`}
        maxWidth="960px"
      >
        <div className={styles.viewerContainer}>
          {answerKeyData?.notes && (
            <div className={styles.notesCard}>
              <div className={styles.notesTitle}>
                <CheckCircle size={18} />
                Panduan Kunci Jawaban / Test Notes
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{answerKeyData.notes}</p>
            </div>
          )}

          <div className={styles.imageGallery}>
            {answerKeyData?.images && answerKeyData.images.length > 0 ? (
              answerKeyData.images.map((imgSrc, idx) => (
                <div key={idx} className={styles.answerImageCard}>
                  <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Dokumentasi Jawaban Lembar #{idx + 1}
                  </div>
                  <img
                    src={imgSrc}
                    alt={`Answer key screenshot ${idx + 1}`}
                    className={styles.answerImage}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Belum ada screenshot kunci jawaban yang diunggah.
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setAnswerKeyData(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Banner Preview Modal */}
      <Modal
        isOpen={Boolean(bannerPreview)}
        onClose={() => setBannerPreview(null)}
        title="Training Banner Preview"
        maxWidth="800px"
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src={bannerPreview}
            alt="Training Banner Preview"
            style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
          />
          <div className={styles.modalFooter} style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setBannerPreview(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Training Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Modul Training Online"
        maxWidth="680px"
      >
        <form onSubmit={handleCreateSubmit}>
          {createError && (
            <div className={styles.errorBanner} style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{createError}</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Judul Pelatihan</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="Contoh: 2026 Global Quality & Safety Standard"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Kategori</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
              >
                <option value="EHS & Safety">EHS & Safety</option>
                <option value="Information Security">Information Security</option>
                <option value="Technical & AI">Technical & AI</option>
                <option value="Compliance">Compliance</option>
                <option value="Quality & Standards">Quality & Standards</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Batas Waktu (Deadline)</label>
              <input
                type="date"
                value={createForm.deadline}
                onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Link Kursus / LMS URL</label>
            <input
              type="url"
              value={createForm.link_url}
              onChange={(e) => setCreateForm({ ...createForm, link_url: e.target.value })}
              placeholder="https://samsungu.csod.com/..."
            />
          </div>

          {/* Banner Image Upload & Presets */}
          <div className={styles.formGroup}>
            <label>Gambar Banner Pelatihan</label>
            <div className={styles.bannerUploadWrapper}>
              <div className={styles.bannerPreviewCard}>
                {createForm.banner_image ? (
                  <img
                    src={createForm.banner_image}
                    alt="Banner Preview"
                    className={styles.bannerPreviewImg}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className={styles.bannerPlaceholder}>
                    <ImageIcon size={32} />
                    <span>Belum ada gambar banner</span>
                  </div>
                )}
              </div>

              <div className={styles.uploadActionRow}>
                <label className={styles.fileUploadLabel}>
                  <Upload size={14} />
                  <span>{uploadingBanner === 'create' ? 'Mengupload...' : 'Upload Banner'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.fileUploadInput}
                    disabled={uploadingBanner === 'create'}
                    onChange={(e) => handleUploadBannerFile(e, false)}
                  />
                </label>

                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>Preset:</span>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => setCreateForm({ ...createForm, banner_image: '/training-assets/training.png' })}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => setCreateForm({ ...createForm, banner_image: '/training-assets/EHSss.png' })}
                >
                  EHS & Safety
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => setCreateForm({ ...createForm, banner_image: '/training-assets/PRIVACY.PNG' })}
                >
                  Security
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => setCreateForm({ ...createForm, banner_image: '/training-assets/gen.png' })}
                >
                  Tech & AI
                </button>
              </div>

              <input
                type="text"
                value={createForm.banner_image}
                onChange={(e) => setCreateForm({ ...createForm, banner_image: e.target.value })}
                placeholder="Path atau URL gambar banner (contoh: /training-assets/... atau upload)"
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Deskripsi Pelatihan</label>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Rincian kompetensi dan materi pelatihan..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={createForm.is_mandatory}
                onChange={(e) => setCreateForm({ ...createForm, is_mandatory: e.target.checked })}
              />
              Wajib bagi seluruh karyawan (Mandatory)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={createForm.has_answer_key}
                onChange={(e) => setCreateForm({ ...createForm, has_answer_key: e.target.checked })}
              />
              Sediakan Kunci Jawaban Post-Test (Protected)
            </label>
          </div>

          {createForm.has_answer_key && (
            <div className={styles.answerKeySection}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label>Password Kunci Jawaban</label>
                <input
                  type="text"
                  value={createForm.answer_key_password}
                  onChange={(e) => setCreateForm({ ...createForm, answer_key_password: e.target.value })}
                  placeholder="Contoh: 2025"
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label>Catatan / Ringkasan Kunci Jawaban</label>
                <textarea
                  rows={2}
                  value={createForm.answer_key_notes}
                  onChange={(e) => setCreateForm({ ...createForm, answer_key_notes: e.target.value })}
                  placeholder="Contoh: 1.A, 2.C, 3.B... atau rangkuman jawaban"
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Lampiran Screenshot Kunci Jawaban ({createForm.answer_key_images?.length || 0})</span>
                  <label className={styles.fileUploadLabel} style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>
                    <Upload size={12} />
                    <span>{uploadingAnswer === 'create' ? 'Mengupload...' : 'Upload Screenshot Kunci'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className={styles.fileUploadInput}
                      disabled={uploadingAnswer === 'create'}
                      onChange={(e) => handleUploadAnswerKeys(e, false)}
                    />
                  </label>
                </label>

                {createForm.answer_key_images && createForm.answer_key_images.length > 0 ? (
                  <div className={styles.answerKeyGrid}>
                    {createForm.answer_key_images.map((imgUrl, idx) => (
                      <div key={idx} className={styles.answerKeyCard}>
                        <img
                          src={imgUrl}
                          alt={`Kunci Jawaban ${idx + 1}`}
                          className={styles.answerKeyImg}
                          onClick={() => setBannerPreview(imgUrl)}
                          title="Klik untuk melihat ukuran penuh"
                        />
                        <button
                          type="button"
                          className={styles.deleteThumbBtn}
                          onClick={() => handleRemoveAnswerImage(idx, false)}
                          title="Hapus gambar ini"
                        >
                          <X size={13} />
                        </button>
                        <div className={styles.answerKeyFooter}>
                          <span>Hal #{idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0' }}>
                    Belum ada screenshot gambar kunci jawaban yang dilampirkan.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={createSubmitting}
            >
              {createSubmitting ? 'Menyimpan...' : 'Simpan Modul Training'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Training Modal */}
      <Modal
        isOpen={isEditModalOpen && Boolean(editForm)}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm(null);
        }}
        title="Edit Modul Training Online"
        maxWidth="680px"
      >
        {editForm && (
          <form onSubmit={handleEditSubmit}>
            {editError && (
              <div className={styles.errorBanner} style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Judul Pelatihan</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Contoh: 2026 Global Quality & Safety Standard"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Kategori</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  <option value="EHS & Safety">EHS & Safety</option>
                  <option value="Information Security">Information Security</option>
                  <option value="Technical & AI">Technical & AI</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Quality & Standards">Quality & Standards</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Batas Waktu (Deadline)</label>
                <input
                  type="date"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Link Kursus / LMS URL</label>
              <input
                type="url"
                value={editForm.link_url}
                onChange={(e) => setEditForm({ ...editForm, link_url: e.target.value })}
                placeholder="https://samsungu.csod.com/..."
              />
            </div>

            {/* Banner Image Upload & Presets */}
            <div className={styles.formGroup}>
              <label>Gambar Banner Pelatihan</label>
              <div className={styles.bannerUploadWrapper}>
                <div className={styles.bannerPreviewCard}>
                  {editForm.banner_image ? (
                    <img
                      src={editForm.banner_image}
                      alt="Banner Preview"
                      className={styles.bannerPreviewImg}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className={styles.bannerPlaceholder}>
                      <ImageIcon size={32} />
                      <span>Belum ada gambar banner</span>
                    </div>
                  )}
                </div>

                <div className={styles.uploadActionRow}>
                  <label className={styles.fileUploadLabel}>
                    <Upload size={14} />
                    <span>{uploadingBanner === 'edit' ? 'Mengupload...' : 'Upload Banner'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.fileUploadInput}
                      disabled={uploadingBanner === 'edit'}
                      onChange={(e) => handleUploadBannerFile(e, true)}
                    />
                  </label>

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>Preset:</span>
                  <button
                    type="button"
                    className={styles.presetChip}
                    onClick={() => setEditForm({ ...editForm, banner_image: '/training-assets/training.png' })}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={styles.presetChip}
                    onClick={() => setEditForm({ ...editForm, banner_image: '/training-assets/EHSss.png' })}
                  >
                    EHS & Safety
                  </button>
                  <button
                    type="button"
                    className={styles.presetChip}
                    onClick={() => setEditForm({ ...editForm, banner_image: '/training-assets/PRIVACY.PNG' })}
                  >
                    Security
                  </button>
                  <button
                    type="button"
                    className={styles.presetChip}
                    onClick={() => setEditForm({ ...editForm, banner_image: '/training-assets/gen.png' })}
                  >
                    Tech & AI
                  </button>
                </div>

                <input
                  type="text"
                  value={editForm.banner_image || ''}
                  onChange={(e) => setEditForm({ ...editForm, banner_image: e.target.value })}
                  placeholder="Path atau URL gambar banner (contoh: /training-assets/... atau upload)"
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Deskripsi Pelatihan</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Rincian kompetensi dan materi pelatihan..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_mandatory}
                  onChange={(e) => setEditForm({ ...editForm, is_mandatory: e.target.checked })}
                />
                Wajib bagi seluruh karyawan (Mandatory)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={editForm.has_answer_key}
                  onChange={(e) => setEditForm({ ...editForm, has_answer_key: e.target.checked })}
                />
                Sediakan Kunci Jawaban Post-Test (Protected)
              </label>
            </div>

            {editForm.has_answer_key && (
              <div className={styles.answerKeySection}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label>Password Kunci Jawaban (Kosongkan bila tidak ingin diubah)</label>
                  <input
                    type="text"
                    value={editForm.answer_key_password}
                    onChange={(e) => setEditForm({ ...editForm, answer_key_password: e.target.value })}
                    placeholder="Kosongkan jika tetap menggunakan password lama"
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label>Catatan / Ringkasan Kunci Jawaban</label>
                  <textarea
                    rows={2}
                    value={editForm.answer_key_notes}
                    onChange={(e) => setEditForm({ ...editForm, answer_key_notes: e.target.value })}
                    placeholder="Contoh: 1.A, 2.C, 3.B... atau rangkuman jawaban"
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Lampiran Screenshot Kunci Jawaban ({editForm.answer_key_images?.length || 0})</span>
                    <label className={styles.fileUploadLabel} style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>
                      <Upload size={12} />
                      <span>{uploadingAnswer === 'edit' ? 'Mengupload...' : 'Upload Screenshot Kunci'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className={styles.fileUploadInput}
                        disabled={uploadingAnswer === 'edit'}
                        onChange={(e) => handleUploadAnswerKeys(e, true)}
                      />
                    </label>
                  </label>

                  {editForm.answer_key_images && editForm.answer_key_images.length > 0 ? (
                    <div className={styles.answerKeyGrid}>
                      {editForm.answer_key_images.map((imgUrl, idx) => (
                        <div key={idx} className={styles.answerKeyCard}>
                          <img
                            src={imgUrl}
                            alt={`Kunci Jawaban ${idx + 1}`}
                            className={styles.answerKeyImg}
                            onClick={() => setBannerPreview(imgUrl)}
                            title="Klik untuk melihat ukuran penuh"
                          />
                          <button
                            type="button"
                            className={styles.deleteThumbBtn}
                            onClick={() => handleRemoveAnswerImage(idx, true)}
                            title="Hapus gambar ini"
                          >
                            <X size={13} />
                          </button>
                          <div className={styles.answerKeyFooter}>
                            <span>Hal #{idx + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0' }}>
                      Belum ada screenshot gambar kunci jawaban yang dilampirkan.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditForm(null);
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
