import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Download,
  Eye,
  Lock,
  KeyRound,
  Globe,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Calendar,
  User,
  CheckCircle2,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import styles from './SharedDocumentPage.module.css';

export const SharedDocumentPage = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const { user } = useAuth();

  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password Unlock State
  const [passwordInput, setPasswordInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [unlockedPassword, setUnlockedPassword] = useState('');

  // Fetch shared document metadata
  const fetchShareInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/v1/shared/documents/${token}`);
      setShareData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || t('shared_doc.link_expired_desc', 'Dokumen tidak ditemukan atau link telah kedaluwarsa.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchShareInfo();
    }
  }, [token]);

  // Handle Password Unlock
  const handleUnlockPassword = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError(t('shared_doc.input_password_placeholder', 'Silakan masukkan kata sandi.'));
      return;
    }

    setVerifying(true);
    setPasswordError('');
    try {
      await axios.post(`/api/v1/shared/documents/${token}/verify`, {
        password: passwordInput,
      });
      setUnlockedPassword(passwordInput);
    } catch (err) {
      setPasswordError(err.response?.data?.message || t('shared_doc.wrong_password', 'Kata sandi tidak sesuai. Silakan coba lagi.'));
    } finally {
      setVerifying(false);
    }
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // URL builders
  const getDownloadUrl = () => {
    const params = new URLSearchParams();
    if (shareData?.access_rule === 'login_required') {
      const authToken = localStorage.getItem('pe_portal_token');
      if (authToken) params.set('token', authToken);
    } else if (shareData?.access_rule === 'password' && unlockedPassword) {
      params.set('password', unlockedPassword);
    }
    const qs = params.toString();
    return `/api/v1/shared/documents/${token}/download${qs ? `?${qs}` : ''}`;
  };

  const getPreviewUrl = () => {
    const params = new URLSearchParams();
    if (shareData?.access_rule === 'login_required') {
      const authToken = localStorage.getItem('pe_portal_token');
      if (authToken) params.set('token', authToken);
    } else if (shareData?.access_rule === 'password' && unlockedPassword) {
      params.set('password', unlockedPassword);
    }
    const qs = params.toString();
    return `/api/v1/shared/documents/${token}/preview${qs ? `?${qs}` : ''}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="PE-Portal" className={styles.logo} />
            <div>
              <div className={styles.brandText}>PE-Portal File Share</div>
              <div className={styles.brandSub}>Samsung Electronics Indonesia</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
        <div className={styles.contentWrapper} style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {t('common.loading', 'Memuat...')}
          </div>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="PE-Portal" className={styles.logo} />
            <div>
              <div className={styles.brandText}>PE-Portal File Share</div>
              <div className={styles.brandSub}>Samsung Electronics Indonesia</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
        <div className={styles.contentWrapper}>
          <div className={styles.gateCard}>
            <div className={styles.gateIconBox} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
              <AlertCircle size={32} />
            </div>
            <h2 className={styles.gateTitle}>{t('shared_doc.link_expired_title', 'Tautan Tidak Tersedia')}</h2>
            <p className={styles.gateDesc}>{error || t('shared_doc.link_expired_desc', 'Dokumen tidak ditemukan atau tautan ini telah dinonaktifkan.')}</p>
            <Link to="/" className={styles.btnSecondary}>
              {t('common.back', 'Kembali ke Beranda')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const doc = shareData.document;
  const rule = shareData.access_rule;

  // Render Rule 1: Login Required Gate
  if (rule === 'login_required' && !user) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="PE-Portal" className={styles.logo} />
            <div>
              <div className={styles.brandText}>PE-Portal File Share</div>
              <div className={styles.brandSub}>Samsung Electronics Indonesia</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
        <div className={styles.contentWrapper}>
          <div className={styles.gateCard}>
            <div className={styles.gateIconBox} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <ShieldCheck size={32} />
            </div>
            <h2 className={styles.gateTitle}>{t('auth.login_title', 'Login Diperlukan')}</h2>
            <p className={styles.gateDesc}>
              {t('documents.rule_login_required', 'Login Required')}: {doc?.title || ''}. {t('auth.login_prompt', 'Silakan masuk dengan akun PE-Portal Anda untuk membuka dan mengunduh berkas.')}
            </p>
            <Link to={`/login?redirect=/share/${token}`} className={styles.btnPrimary}>
              {t('nav.login', 'Masuk ke Akun PE-Portal')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render Rule 2: Password Gate
  if (rule === 'password' && !unlockedPassword) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="PE-Portal" className={styles.logo} />
            <div>
              <div className={styles.brandText}>PE-Portal File Share</div>
              <div className={styles.brandSub}>Samsung Electronics Indonesia</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
        <div className={styles.contentWrapper}>
          <div className={styles.gateCard}>
            <div className={styles.gateIconBox} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <KeyRound size={32} />
            </div>
            <h2 className={styles.gateTitle}>{t('shared_doc.password_prompt_title', 'Dokumen Diproteksi Kata Sandi')}</h2>
            <p className={styles.gateDesc}>
              {t('shared_doc.password_prompt_desc', 'File dikunci dengan proteksi kata sandi. Masukkan kata sandi yang diberikan untuk melihat dan mengunduh.')}
            </p>

            {passwordError && (
              <div className={styles.errorBanner}>
                <AlertCircle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockPassword} className={styles.formBox}>
              <div className={styles.inputGroup}>
                <label>{t('shared_doc.input_password_label', 'Kata Sandi Akses')}</label>
                <input
                  type="password"
                  className={styles.inputField}
                  placeholder={t('shared_doc.input_password_placeholder', 'Masukkan password dokumen...')}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={verifying}>
                {verifying ? t('common.loading', 'Memverifikasi...') : t('shared_doc.submit_btn', 'Buka Dokumen')}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked / Public Document View
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'img'].includes(doc?.file_type?.toLowerCase());
  const isPdf = doc?.file_type?.toLowerCase() === 'pdf';
  const isText = ['txt', 'log', 'json', 'xml', 'yaml', 'yml', 'md', 'csv'].includes(doc?.file_type?.toLowerCase());

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="PE-Portal" className={styles.logo} />
          <div>
            <div className={styles.brandText}>PE-Portal File Share</div>
            <div className={styles.brandSub}>Samsung Electronics Indonesia</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <LanguageSwitcher />
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{t('common.logged_in_as', 'Login sebagai:')}</span>
              <strong>{user.full_name || user.username}</strong>
              <Link to="/" style={{ color: 'var(--color-accent)', textDecoration: 'none', marginLeft: '8px', fontWeight: 600 }}>
                {t('nav.portal', 'Ke Portal')}
              </Link>
            </div>
          ) : (
            <Link to={`/login?redirect=/share/${token}`} className={styles.btnSecondary} style={{ padding: '6px 12px', fontSize: '12px' }}>
              {t('nav.login', 'Masuk Portal')}
            </Link>
          )}
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <div className={styles.card}>
          <div className={styles.docHeader}>
            <div className={styles.titleArea}>
              <div className={styles.fileIconBox}>
                <FileText size={26} />
              </div>
              <div>
                <h1 className={styles.docTitle}>{doc?.title}</h1>
                <div className={styles.docMeta}>
                  <span className={styles.docMetaItem}>
                    <strong>{doc?.file_name}</strong>
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(doc?.file_size)}</span>
                  <span>•</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                    {doc?.file_type}
                  </span>
                  <span>•</span>
                  <span className={styles.docMetaItem}>
                    <Calendar size={13} />
                    {doc?.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                  </span>
                  {doc?.uploader_name && (
                    <>
                      <span>•</span>
                      <span className={styles.docMetaItem}>
                        <User size={13} />
                        {doc.uploader_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Access Rule Badge */}
            <div>
              {rule === 'public' && (
                <div className={styles.badgePublic}>
                  <Globe size={13} />
                  <span>Open Public</span>
                </div>
              )}
              {rule === 'login_required' && (
                <div className={styles.badgeLogin}>
                  <ShieldCheck size={13} />
                  <span>Login Required (Terverifikasi)</span>
                </div>
              )}
              {rule === 'password' && (
                <div className={styles.badgePassword}>
                  <KeyRound size={13} />
                  <span>Password Protected (Unlocked)</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.actionsBar}>
            {shareData.allow_download && (
              <a href={getDownloadUrl()} download className={styles.btnPrimary}>
                <Download size={16} />
                <span>{t('shared_doc.download_btn', 'Unduh File Asli')}</span>
              </a>
            )}
            <a
              href={getPreviewUrl()}
              target="_blank"
              rel="noreferrer"
              className={styles.btnSecondary}
            >
              <ExternalLink size={16} />
              <span>{t('shared_doc.open_new_tab', 'Buka di Tab Baru')}</span>
            </a>
          </div>
        </div>

        {/* In-Browser Preview Section */}
        <div className={styles.card} style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={16} color="var(--color-accent)" />
              <span>{t('shared_doc.preview_title', 'Pratinjau Dokumen')}</span>
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t('common.views', 'Dilihat')}: {shareData.view_count || 1} • {t('common.downloads', 'Diunduh')}: {shareData.download_count || 0}
            </span>
          </div>

          <div className={styles.previewBox}>
            {isPdf ? (
              <iframe
                src={getPreviewUrl()}
                title={doc.title}
                className={styles.previewFrame}
              />
            ) : isImage ? (
              <img
                src={getPreviewUrl()}
                alt={doc.title}
                className={styles.previewImg}
              />
            ) : isText ? (
              <iframe
                src={getPreviewUrl()}
                title={doc.title}
                className={styles.previewFrame}
              />
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <FileText size={48} color="var(--color-accent)" style={{ marginBottom: '14px' }} />
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{t('shared_doc.office_preview_title', 'Pratinjau File Office / Biner')}</h4>
                <p style={{ margin: '0 0 20px 0', color: 'var(--color-text-secondary)', fontSize: '13px', maxWidth: '420px' }}>
                  {t('shared_doc.office_preview_desc', 'Format berkas disarankan untuk diunduh langsung untuk melihat isi lembar kerja atau presentasi secara penuh.')}
                </p>
                {shareData.allow_download && (
                  <a href={getDownloadUrl()} download className={styles.btnPrimary}>
                    <Download size={15} />
                    <span>{t('shared_doc.download_file', 'Unduh')} {doc.file_name}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
