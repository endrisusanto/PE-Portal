import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  User,
  Shield,
  Briefcase,
  Mail,
  Hash,
  Globe,
  Save,
  Bot,
  KeyRound,
  Sparkles,
  Users,
  Plus,
  Trash2,
  Palette,
  Type,
  Building2,
  Heart,
  Zap,
  Compass,
  Sun,
  Smartphone,
  Monitor,
  Terminal,
  Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Avatar } from '../components/common/Avatar';
import styles from './ProfilePage.module.css';

const renderThemeIcon = (iconKey, size = 16) => {
  switch (iconKey) {
    case 'building': return <Building2 size={size} />;
    case 'heart': return <Heart size={size} />;
    case 'zap': return <Zap size={size} />;
    case 'compass': return <Compass size={size} />;
    case 'sun': return <Sun size={size} />;
    case 'sparkles': return <Sparkles size={size} />;
    case 'palette': return <Palette size={size} />;
    default: return <Palette size={size} />;
  }
};

const renderFontIcon = (iconKey, size = 14) => {
  switch (iconKey) {
    case 'smartphone': return <Smartphone size={size} />;
    case 'monitor': return <Monitor size={size} />;
    case 'type': return <Type size={size} />;
    case 'terminal': return <Terminal size={size} />;
    default: return <Type size={size} />;
  }
};

export const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const {
    palette,
    setPalette,
    customAccent,
    setCustomAccent,
    presets,
    theme,
    animatedBg,
    toggleAnimatedBg,
    font,
    setFont,
    fontPresets,
  } = useTheme();

  const fileInputRef = useRef(null);


  const [fullName, setFullName] = useState(user?.full_name || '');
  const [preferredLang, setPreferredLang] = useState(user?.preferred_lang || 'en');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_path || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Personal LLM Config state
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState('LM Studio');
  const [savingCustomLlm, setSavingCustomLlm] = useState(false);

  // Custom Email Contact Lists (SMTP Quick Action)
  const [emailLists, setEmailLists] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [newListEmails, setNewListEmails] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);
  const [savingList, setSavingList] = useState(false);

  const fetchEmailLists = () => {
    api.get('/users/me/email-lists')
      .then((res) => setEmailLists(res.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchEmailLists();
    if (user?.role === 'admin') {
      api.get('/ai/config')
        .then((res) => {
          const { config, is_user_custom } = res.data;
          if (config) {
            setActiveProviderName(config.name || 'LM Studio');
            if (is_user_custom) {
              setHasCustomKey(true);
              setCustomBaseUrl(config.base_url || '');
              setCustomApiKey(config.api_key || '');
              setCustomModelName(config.model_name || '');
            }
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);

  const handleCreateEmailList = async (e) => {
    e.preventDefault();
    if (!newListName.trim() || !newListEmails.trim()) {
      showNotification('error', 'Group name and email addresses are required');
      return;
    }
    setSavingList(true);
    try {
      const res = await api.post('/users/me/email-lists', {
        name: newListName.trim(),
        emails: newListEmails.trim(),
        description: newListDesc.trim(),
      });
      setEmailLists([res.data, ...emailLists]);
      setNewListName('');
      setNewListEmails('');
      setNewListDesc('');
      setIsAddingList(false);
      showNotification('success', 'Custom email group added successfully!');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message);
    } finally {
      setSavingList(false);
    }
  };

  const handleDeleteEmailList = async (id, name) => {
    if (!window.confirm(`Delete recipient group "${name}"?`)) return;
    try {
      await api.delete(`/users/me/email-lists/${id}`);
      setEmailLists(emailLists.filter((l) => l.id !== id));
      showNotification('success', 'Email group removed');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message);
    }
  };

  const showNotification = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', 'File size exceeds 5MB limit');
      return;
    }

    // Local instant preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedUser = res.data.user || { ...user, avatar_path: res.data.avatar_path };
      updateUser(updatedUser);
      setAvatarPreview(res.data.avatar_path);
      showNotification('success', t('profile.upload_success'));
    } catch (err) {
      setAvatarPreview(user?.avatar_path || null);
      showNotification('error', err.response?.data?.message || err.message || 'Avatar upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await api.put('/users/me/preferences', {
        full_name: fullName,
        preferred_lang: preferredLang,
      });

      const updatedUser = res.data || { ...user, full_name: fullName, preferred_lang: preferredLang };
      updateUser(updatedUser);
      changeLanguage(preferredLang);
      showNotification('success', t('profile.save_success'));
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonalLlm = async (e) => {
    e.preventDefault();
    setSavingCustomLlm(true);
    try {
      await api.put('/ai/config', {
        name: 'My Personal API Key',
        provider: 'openai-compatible',
        base_url: customBaseUrl || 'https://lmstudio.endrisusanto.my.id/v1',
        api_key: customApiKey,
        model_name: customModelName || 'google/gemma-4-e4b',
        is_active: true,
        is_custom: true,
      });
      setHasCustomKey(true);
      setActiveProviderName('My Personal API Key');
      showNotification('success', 'Personal LLM API Key saved! AI Assistant will now use your key.');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to save personal API key');
    } finally {
      setSavingCustomLlm(false);
    }
  };

  const handleResetPersonalLlm = async () => {
    if (!window.confirm('Revert to the shared portal default LLM (LM Studio)?')) return;
    try {
      await api.delete('/ai/config/user');
      setHasCustomKey(false);
      setCustomApiKey('');
      setCustomBaseUrl('');
      setCustomModelName('');
      setActiveProviderName('LM Studio');
      showNotification('success', 'Reverted to shared portal default LLM (LM Studio)');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <p className={styles.subtitle}>{t('profile.subtitle')}</p>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div
          className={`${styles.alert} ${
            feedback.type === 'success' ? styles.alertSuccess : styles.alertError
          }`}
          role="status"
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Hero Section */}
      <div className={styles.heroCard}>
        <div className={styles.heroUser}>
          <div
            className={styles.avatarWrapper}
            onClick={() => fileInputRef.current?.click()}
            title={t('profile.change_photo')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Avatar name={user?.full_name} src={avatarPreview} size="xl" />
            <div className={styles.avatarOverlay}>
              <Camera size={22} />
            </div>
            {uploading && (
              <div className={styles.avatarUploading}>Uploading...</div>
            )}
          </div>

          <div className={styles.heroDetails}>
            <div className={styles.heroName}>{user?.full_name}</div>
            <div className={styles.heroMeta}>
              <span className={styles.roleBadge}>{user?.role}</span>
              <span className={styles.groupBadge}>
                {user?.group_part_name || 'Production Engineer'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarSelect}
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
          />
          <Button
            variant="outline"
            size="sm"
            icon={Upload}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('profile.change_photo')}
          </Button>
        </div>
      </div>

      {/* Main Grid: Form + Info */}
      <div className={styles.grid}>
        {/* Personal Details Form */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <User size={18} color="var(--color-accent)" />
            {t('profile.personal_info')}
          </h2>

          <form onSubmit={handleSavePreferences} className={styles.form}>
            <Input
              label={t('profile.full_name')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="e.g. John Doe"
            />

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('profile.preferred_lang')}
              </label>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                width: 'fit-content',
              }}>
                {[
                  { code: 'en', label: 'English (EN)' },
                  { code: 'id', label: 'Bahasa Indonesia (ID)' },
                  { code: 'ko', label: '한국어 (KO)' },
                ].map((l) => {
                  const isActive = preferredLang === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setPreferredLang(l.code)}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                        transition: 'all var(--transition-fast)',
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                      }}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
              <span className={styles.hint}>{t('profile.upload_hint')}</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={Save}
              loading={saving}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {t('common.save')}
            </Button>
          </form>
        </div>

        {/* Corporate Directory Details */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Shield size={18} color="var(--color-accent)" />
            Corporate Account Identity
          </h2>

          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <Hash size={15} />
                {t('profile.employee_id')}
              </span>
              <span className={styles.infoValue}>
                {user?.employee_id || 'SEIN-ENG-001'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <User size={15} />
                {t('profile.username')}
              </span>
              <span className={styles.infoValue}>{user?.username}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <Mail size={15} />
                {t('profile.email')}
              </span>
              <span className={styles.infoValue}>
                {user?.email || `${user?.username}@samsung.com`}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <Briefcase size={15} />
                {t('profile.group_part')}
              </span>
              <span className={styles.infoValue}>
                {user?.group_part_name || 'Production Engineer'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <Shield size={15} />
                {t('profile.role')}
              </span>
              <span className={styles.infoValue}>{user?.role}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoKey}>
                <Globe size={15} />
                Security Provider
              </span>
              <span className={styles.infoValue}>
                {user?.auth_provider ? user.auth_provider.toUpperCase() : 'LOCAL / AD'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Theme & Personal Color Scheme */}
      <div className={styles.card} style={{ marginTop: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <Palette size={18} color="var(--color-accent)" />
              Personal Decorative Theme & Color Scheme
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Pilih tema dekoratif estetis (termasuk Theme Cute Sakura, Neon Emerald, Sunset Amber) atau buat warna kustom Anda sendiri.
            </p>
          </div>

          <span style={{
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            backgroundColor: 'var(--color-accent-subtle)',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Sparkles size={12} />
            Active: {presets.find((p) => p.id === palette)?.name || 'Custom Color'}
          </span>
        </div>

        {/* Theme Presets Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          marginTop: '12px',
        }}>
          {presets.filter((p) => p.id !== 'custom').map((p) => {
            const activeColor = theme === 'dark' ? p.darkColor : p.color;
            const isSelected = palette === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPalette(p.id)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                  border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all var(--transition-fast)',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                  {renderThemeIcon(p.icon, 18)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {p.desc}
                  </div>
                </div>
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: activeColor,
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Custom Color Picker for personal preference */}
        <div style={{
          marginTop: '14px',
          padding: '12px 14px',
          backgroundColor: 'var(--color-bg-primary)',
          border: `2px solid ${palette === 'custom' ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Palette size={18} />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Custom Personal Color (Hex Picker)
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                Tentukan warna aksen personal bebas sesuai selera Anda
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="color"
              value={customAccent}
              onChange={(e) => setCustomAccent(e.target.value)}
              style={{
                width: '36px',
                height: '36px',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
            <input
              type="text"
              value={customAccent.toUpperCase()}
              onChange={(e) => setCustomAccent(e.target.value)}
              style={{
                width: '90px',
                height: '32px',
                padding: '0 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                textAlign: 'center',
              }}
            />
            <Button
              type="button"
              variant={palette === 'custom' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPalette('custom')}
            >
              {palette === 'custom' ? 'Active' : 'Apply Color'}
            </Button>
          </div>
        </div>

        {/* Animated Background Control Section */}
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Sparkles size={18} />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Animated Theme Background
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: animatedBg ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                  color: animatedBg ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: `1px solid ${animatedBg ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  fontWeight: 700,
                }}>
                  {animatedBg ? 'AKTIF (60 FPS)' : 'NONAKTIF'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Partikel hidup & ambient aurora bergerak lembut sesuai tema aktif (Sakura Petals, Matrix Rain, Twinkling Stars, Rising Embers, Lavender Crystals, Constellation Nodes)
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant={animatedBg ? 'primary' : 'outline'}
            size="sm"
            onClick={toggleAnimatedBg}
            style={{ minWidth: '130px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Sparkles size={13} />
            {animatedBg ? 'Matikan Animasi' : 'Aktifkan Animasi'}
          </Button>
        </div>

        {/* Typography & Font Family Switcher (Samsung Sans & Presets) */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Type size={16} color="var(--color-accent)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Typography & Interface Font Family
              </span>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
            }}>
              Font: {fontPresets?.find((f) => f.id === font)?.name || 'Samsung Sans'}
            </span>
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Pilih jenis huruf antarmuka portal. Dilengkapi font resmi <strong>Samsung Sans</strong> untuk integrasi desain standar Samsung Electronics.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '10px',
            marginTop: '10px',
          }}>
            {fontPresets?.map((f) => {
              const isSelected = font === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                    border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                        {renderFontIcon(f.icon, 14)}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }}>
                        {f.category}
                      </span>
                    </div>
                    {isSelected && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}>
                        <Check size={11} /> Active
                      </span>
                    )}
                  </div>

                  <div style={{
                    fontFamily: f.fontFamily,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}>
                    {f.name}
                  </div>

                  <div style={{
                    fontFamily: f.fontFamily,
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px dashed var(--color-border)',
                    color: 'var(--color-text-primary)',
                    letterSpacing: '0.2px',
                  }}>
                    SEIN PE Group 2026 • 12345
                  </div>

                  <div style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.3,
                  }}>
                    {f.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Personal LLM API Key Override - Admin Only */}
      {user?.role === 'admin' && (
        <div className={styles.card} style={{ marginTop: 'var(--space-2)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className={styles.cardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <KeyRound size={18} color="var(--color-accent)" />
              Personal LLM API Key & Endpoint (Custom Provider)
            </h2>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              backgroundColor: hasCustomKey ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
              color: hasCustomKey ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}>
              Active: {hasCustomKey ? 'Using My Personal API Key' : `Portal Default (${activeProviderName})`}
            </span>
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            If you prefer to use your own personal API key (LM Studio, OpenAI, Gemini, or Claude) instead of the portal's shared gateway, enter your endpoint credentials below.
          </p>

          <form onSubmit={handleSavePersonalLlm} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '12px' }}>
            <Input
              label="Custom Base URL (OpenAI-Compatible)"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://lmstudio.endrisusanto.my.id/v1"
            />

            <Input
              label="Personal API Key"
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="lm-studio or sk-..."
            />

            <Input
              label="Model ID / Name"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="google/gemma-4-e4b"
            />

            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '8px' }}>
              {hasCustomKey ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetPersonalLlm}
                >
                  Revert to Shared Portal Default
                </Button>
              ) : <div />}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingCustomLlm}
              >
                Save Personal API Key
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Email Lists / Recipient Groups for SMTP Reports */}
      <div className={styles.card} style={{ marginTop: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <Users size={18} color="var(--color-accent)" />
              Custom Email Lists (Email Quick Action)
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Simpan grup email (misal: Part Leader, Mecha Team, Shift 1) untuk quick-insert otomatis dengan 1-klik di editor laporan & jadwal pengiriman email.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddingList(!isAddingList)}
          >
            {isAddingList ? 'Close Form' : 'Add Email Group'}
          </Button>
        </div>

        {/* Add Email List Form */}
        {isAddingList && (
          <form
            onSubmit={handleCreateEmailList}
            style={{
              marginTop: '14px',
              padding: '16px',
              backgroundColor: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <Input
                label="Group / List Name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. PE Production Leads"
                required
              />
              <Input
                label="Description (Optional)"
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                placeholder="e.g. Recipients for daily line operations report"
              />
            </div>

            <Input
              label="Email Addresses (Comma separated)"
              value={newListEmails}
              onChange={(e) => setNewListEmails(e.target.value)}
              placeholder="lead.prod@samsung.com, manager.pe@samsung.com, spv.line@samsung.com"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingList(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingList}
              >
                Save Email Group
              </Button>
            </div>
          </form>
        )}

        {/* Saved Email Groups */}
        <div className={styles.emailListContainer}>
          {emailLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No custom email groups saved yet. Click "Add Email Group" above to create one.
            </div>
          ) : (
            emailLists.map((list) => {
              const emailsArr = (list.emails || '').split(',').map((e) => e.trim()).filter(Boolean);
              return (
                <div key={list.id} className={styles.emailListCard}>
                  <div className={styles.emailListInfo}>
                    <div className={styles.emailListName}>
                      <Mail size={14} color="var(--color-accent)" />
                      <span>{list.name}</span>
                      <span className={styles.countBadge}>{emailsArr.length} emails</span>
                    </div>
                    {list.description && (
                      <div className={styles.emailListDesc}>{list.description}</div>
                    )}
                    <div className={styles.emailListChips} title={list.emails}>
                      {list.emails}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDeleteEmailList(list.id, list.name)}
                    title="Delete group"
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>

  );
};
