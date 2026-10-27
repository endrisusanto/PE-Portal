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
  Copy,
  ExternalLink,
  Layers,
  Database,
  ChevronDown,
  ChevronUp,
  Cpu,
  BookOpen,
  Code2,
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

const MCP_TOOLS_CATALOG = [
  {
    name: 'pe_get_portal_overview',
    category: 'analytics',
    badge: 'Executive Pulse',
    desc: 'Ambil statistik eksekutif real-time portal: total model aktif per tahap (DVT/PVT/MP), jumlah tugas proyek, unit sampel tersedia/dipinjam, inovasi, dan tracking DHL.',
    params: 'Tidak memerlukan parameter (empty arguments).',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_get_portal_overview",\n    "arguments": {}\n  }\n}',
  },
  {
    name: 'pe_list_new_models',
    category: 'models',
    badge: 'New Models',
    desc: 'Query daftar model smartphone & perangkat baru yang dikembangkan di SEIN PE beserta codename, marketing name, tahap pengembangan, dan varian BSM.',
    params: 'stage (string, optional: concept, prototype, evt, dvt, pvt, mp), search (string), limit (int, default: 20)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 2,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_new_models",\n    "arguments": { "stage": "pvt", "limit": 10 }\n  }\n}',
  },
  {
    name: 'pe_get_model_details',
    category: 'models',
    badge: '41+ Checkpoints',
    desc: 'Dapatkan rincian menyeluruh satu model: seluruh 41+ checkpoint & milestone (PVR, PRA, SRA, LQV, BOM HQ/SEIN, JIG, spesifikasi, dan sertifikasi TKDN/Postel).',
    params: 'model_name (string, e.g. "SM-A186", "S26") atau model_id (UUID)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 3,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_get_model_details",\n    "arguments": { "model_name": "SM-A186" }\n  }\n}',
  },
  {
    name: 'pe_get_model_schedules',
    category: 'models',
    badge: 'Timeline & Calendar',
    desc: 'Ambil seluruh jadwal milestone, target tanggal rilis, dan ISO week number (W01-W52) lintas model untuk visualisasi kalender dan Gantt chart.',
    params: 'stage (string), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), limit (int)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 4,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_get_model_schedules",\n    "arguments": { "stage": "dvt" }\n  }\n}',
  },
  {
    name: 'pe_list_projects_and_tasks',
    category: 'projects',
    badge: 'Kanban Tasks',
    desc: 'Query proyek rekayasa dan tugas Kanban: status (todo, in_progress, review, done), prioritas, tenggat waktu, dan anggota yang ditugaskan.',
    params: 'status (string: todo, in_progress, done), priority (low, medium, high, urgent), search (string), limit (int)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 5,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_projects_and_tasks",\n    "arguments": { "status": "in_progress" }\n  }\n}',
  },
  {
    name: 'pe_list_samples',
    category: 'warehouse',
    badge: 'Sample Inventory',
    desc: 'Query unit sampel hardware, ponsel uji laboratorium, status peminjaman (AVAILABLE / BORROWED), nama peminjam, nomor seri, IMEI, dan lokasi fisik.',
    params: 'status_pinjam (AVAILABLE, BORROWED), model (string), borrower (string), limit (int)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 6,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_samples",\n    "arguments": { "status_pinjam": "BORROWED" }\n  }\n}',
  },
  {
    name: 'pe_list_dhl_shipments',
    category: 'warehouse',
    badge: 'DHL Tracking',
    desc: 'Query status pelacakan pengiriman internasional DHL, nomor resi AWB, rute asal/tujuan, PIC penerima, status transit/delivered, dan update lokasi terakhir.',
    params: 'status (transit, delivered), search (AWB, PIC, tujuan), limit (int)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 7,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_dhl_shipments",\n    "arguments": { "search": "DELIVERED" }\n  }\n}',
  },
  {
    name: 'pe_list_software_mrs',
    category: 'warehouse',
    badge: 'Software MR',
    desc: 'Query rilis pemeliharaan perangkat lunak (Software Maintenance Release), versi software, model target, jadwal rilis, dan companion release.',
    params: 'search (keyword model / versi), limit (int, default: 20)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 8,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_software_mrs",\n    "arguments": { "search": "S25" }\n  }\n}',
  },
  {
    name: 'pe_list_innovations',
    category: 'analytics',
    badge: 'Kaizen & Ideas',
    desc: 'Query proposal inovasi teknik, ide Kaizen efisiensi, estimasi penghematan biaya, skor dampak (1-5), dan status persetujuan manajemen.',
    params: 'status (draft, submitted, approved), category (string), search (string), limit (int)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 9,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_innovations",\n    "arguments": { "status": "approved" }\n  }\n}',
  },
  {
    name: 'pe_list_documents_and_reports',
    category: 'analytics',
    badge: 'Tech Docs & Reports',
    desc: 'Query arsip dokumen rekayasa teknik, laporan digital berkala, dan artikel panduan teknis yang tersimpan di PE Portal.',
    params: 'search (keyword judul / konten), limit (int, default: 20)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 10,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_list_documents_and_reports",\n    "arguments": { "search": "BOM" }\n  }\n}',
  },
  {
    name: 'pe_query_database',
    category: 'analytics',
    badge: 'Safe SQL Read-Only',
    desc: 'Eksekusi kueri SQL SELECT read-only langsung pada database PostgreSQL PE Portal untuk analisa kustom dan agregasi data. Operasi mutasi data otomatis diblokir.',
    params: 'query (string, query SQL SELECT yang valid)',
    example: '{\n  "jsonrpc": "2.0",\n  "id": 11,\n  "method": "tools/call",\n  "params": {\n    "name": "pe_query_database",\n    "arguments": { "query": "SELECT model_name, stage, marketing_name FROM new_models WHERE deleted_at IS NULL LIMIT 5" }\n  }\n}',
  },
];

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

  // MCP Documentation state
  const [mcpConfigTab, setMcpConfigTab] = useState('claude'); // 'claude' | 'cursor' | 'curl' | 'python'
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedTool, setExpandedTool] = useState(null);
  const [mcpCategoryFilter, setMcpCategoryFilter] = useState('all');
  const [mcpSearchFilter, setMcpSearchFilter] = useState('');
  const [mcpTesting, setMcpTesting] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState(null);

  const handleCopyText = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestMcp = async () => {
    setMcpTesting(true);
    setMcpTestResult(null);
    const start = Date.now();
    try {
      const res = await api.post('/mcp', {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'pe_get_portal_overview',
          arguments: {},
        },
      });
      const latency = Date.now() - start;
      if (res.data?.result) {
        setMcpTestResult({ success: true, latency, message: 'MCP Server responding smoothly!' });
      } else {
        setMcpTestResult({ success: false, latency, message: res.data?.error?.message || 'Unexpected response' });
      }
    } catch (err) {
      setMcpTestResult({ success: false, latency: Date.now() - start, message: err.message });
    } finally {
      setMcpTesting(false);
    }
  };

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
                placeholder="e.g. PE Part Leads"
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

      {/* ========================================================================= */}
      {/* MODEL CONTEXT PROTOCOL (MCP) SERVER DOCUMENTATION SECTION                  */}
      {/* ========================================================================= */}
      <div className={styles.card} style={{ marginTop: 'var(--space-2)' }}>
        {/* Header */}
        <div className={styles.mcpHeader}>
          <div>
            <h2 className={styles.cardTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <Terminal size={19} color="var(--color-accent)" />
              Model Context Protocol (MCP) Server Documentation
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Dokumentasi & panduan integrasi Model Context Protocol resmi SEIN PE-Portal. Menghubungkan seluruh data live produksi, model baru, milestone, task, inventaris sampel, hingga logistik DHL dengan AI Assistant, Cursor IDE, Claude Desktop, Antigravity, dan AI Agent otonom.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={styles.mcpStatusBadge}>
              <span className={styles.mcpStatusDot} />
              <span>MCP Server Active • 11 Tools</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Zap}
              loading={mcpTesting}
              onClick={handleTestMcp}
              title="Test real-time connection to PE Portal MCP Server"
            >
              Test Ping
            </Button>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {mcpTestResult && (
          <div
            className={`${styles.alert} ${mcpTestResult.success ? styles.alertSuccess : styles.alertError}`}
            style={{ margin: 0, padding: '8px 14px' }}
          >
            {mcpTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ fontSize: '12px' }}>
              <strong>Status:</strong> {mcpTestResult.message} (Latency: {mcpTestResult.latency}ms)
            </span>
          </div>
        )}

        {/* Server Endpoint Details Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          <div className={styles.mcpEndpointBox}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                Primary HTTP Endpoint (JSON-RPC 2.0)
              </span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={copiedKey === 'endpoint' ? Check : Copy}
              onClick={() => handleCopyText(typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp', 'endpoint')}
            >
              {copiedKey === 'endpoint' ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className={styles.mcpEndpointBox}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                Backend Direct Port (Docker Host)
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                http://localhost:8085/api/v1/mcp
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={copiedKey === 'backend-port' ? Check : Copy}
              onClick={() => handleCopyText('http://localhost:8085/api/v1/mcp', 'backend-port')}
            >
              {copiedKey === 'backend-port' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Client Setup Configuration Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Code2 size={16} color="var(--color-accent)" />
              Client Setup & Configuration Examples
            </span>
          </div>

          {/* Config Tabs */}
          <div className={styles.mcpTabs}>
            <button
              type="button"
              className={`${styles.mcpTab} ${mcpConfigTab === 'claude' ? styles.mcpTabActive : ''}`}
              onClick={() => setMcpConfigTab('claude')}
            >
              Claude Desktop
            </button>
            <button
              type="button"
              className={`${styles.mcpTab} ${mcpConfigTab === 'cursor' ? styles.mcpTabActive : ''}`}
              onClick={() => setMcpConfigTab('cursor')}
            >
              Cursor IDE / Antigravity
            </button>
            <button
              type="button"
              className={`${styles.mcpTab} ${mcpConfigTab === 'curl' ? styles.mcpTabActive : ''}`}
              onClick={() => setMcpConfigTab('curl')}
            >
              cURL (JSON-RPC)
            </button>
            <button
              type="button"
              className={`${styles.mcpTab} ${mcpConfigTab === 'python' ? styles.mcpTabActive : ''}`}
              onClick={() => setMcpConfigTab('python')}
            >
              Python Client
            </button>
          </div>

          {/* Code Container */}
          <div className={styles.mcpCodeContainer}>
            <button
              type="button"
              className={styles.mcpCopyBtn}
              onClick={() => {
                let code = '';
                if (mcpConfigTab === 'claude') {
                  code = `{\n  "mcpServers": {\n    "sein-pe-portal": {\n      "url": "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}"\n    }\n  }\n}`;
                } else if (mcpConfigTab === 'cursor') {
                  code = `{\n  "mcpServers": {\n    "sein-pe-portal": {\n      "url": "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}",\n      "type": "http"\n    }\n  }\n}`;
                } else if (mcpConfigTab === 'curl') {
                  code = `curl -X POST ${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'} \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "jsonrpc": "2.0",\n    "id": 1,\n    "method": "tools/call",\n    "params": {\n      "name": "pe_get_portal_overview",\n      "arguments": {}\n    }\n  }'`;
                } else if (mcpConfigTab === 'python') {
                  code = `import requests\n\nMCP_URL = "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}"\n\npayload = {\n    "jsonrpc": "2.0",\n    "id": 1,\n    "method": "tools/call",\n    "params": {\n        "name": "pe_list_new_models",\n        "arguments": {"stage": "pvt"}\n    }\n}\n\nres = requests.post(MCP_URL, json=payload)\nprint(res.json()["result"]["content"][0]["text"])`;
                }
                handleCopyText(code, 'mcp-config');
              }}
            >
              {copiedKey === 'mcp-config' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey === 'mcp-config' ? 'Copied!' : 'Copy Config'}</span>
            </button>

            {mcpConfigTab === 'claude' && (
              <pre style={{ margin: 0 }}>
                <code>
{`// File: %APPDATA%\\Claude\\claude_desktop_config.json (Windows)
// atau ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
{
  "mcpServers": {
    "sein-pe-portal": {
      "url": "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}"
    }
  }
}`}
                </code>
              </pre>
            )}

            {mcpConfigTab === 'cursor' && (
              <pre style={{ margin: 0 }}>
                <code>
{`// File: .cursor/mcp.json atau Settings > Features > MCP Servers
{
  "mcpServers": {
    "sein-pe-portal": {
      "url": "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}",
      "type": "http"
    }
  }
}`}
                </code>
              </pre>
            )}

            {mcpConfigTab === 'curl' && (
              <pre style={{ margin: 0 }}>
                <code>
{`# Test query ringkasan data portal via terminal
curl -X POST ${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "pe_get_portal_overview",
      "arguments": {}
    }
  }'`}
                </code>
              </pre>
            )}

            {mcpConfigTab === 'python' && (
              <pre style={{ margin: 0 }}>
                <code>
{`import requests

MCP_URL = "${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/mcp` : 'http://localhost:8085/api/v1/mcp'}"

payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "pe_list_new_models",
        "arguments": {"stage": "pvt"}
    }
}

response = requests.post(MCP_URL, json=payload)
data_text = response.json()["result"]["content"][0]["text"]
print(data_text)`}
                </code>
              </pre>
            )}
          </div>
        </div>

        {/* MCP Tools Catalog Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="var(--color-accent)" />
                Katalog Tool MCP PE-Portal ({MCP_TOOLS_CATALOG.length} Available Tools)
              </span>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Klik pada kartu tool untuk melihat skema parameter input dan contoh payload JSON-RPC.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Tools' },
                { id: 'models', label: 'Models & Schedules' },
                { id: 'projects', label: 'Tasks' },
                { id: 'warehouse', label: 'Warehouse & DHL' },
                { id: 'analytics', label: 'Analytics & SQL' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setMcpCategoryFilter(cat.id)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: mcpCategoryFilter === cat.id ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: mcpCategoryFilter === cat.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-primary)',
                    color: mcpCategoryFilter === cat.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: mcpCategoryFilter === cat.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className={styles.mcpToolsGrid}>
            {MCP_TOOLS_CATALOG
              .filter((tool) => mcpCategoryFilter === 'all' || tool.category === mcpCategoryFilter)
              .map((tool) => {
                const isExpanded = expandedTool === tool.name;
                return (
                  <div
                    key={tool.name}
                    className={`${styles.mcpToolCard} ${isExpanded ? styles.mcpToolCardActive : ''}`}
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  >
                    <div className={styles.mcpToolName}>
                      <span>{tool.name}</span>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                        border: '1px solid var(--color-border-subtle)',
                      }}>
                        {tool.badge}
                      </span>
                    </div>

                    <div className={styles.mcpToolDesc}>
                      {tool.desc}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-accent)', marginTop: '4px', fontWeight: 600 }}>
                      <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Skema & Contoh Payload'}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </div>

                    {isExpanded && (
                      <div className={styles.mcpToolSchema} onClick={(e) => e.stopPropagation()}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong style={{ color: 'var(--color-text-primary)' }}>Parameters: </strong>
                          <span>{tool.params}</span>
                        </div>

                        <div style={{ position: 'relative', marginTop: '6px' }}>
                          <pre style={{
                            backgroundColor: '#0d1117',
                            color: '#7ee787',
                            padding: '8px',
                            borderRadius: 'var(--radius-sm)',
                            margin: 0,
                            fontSize: '11px',
                            overflowX: 'auto',
                          }}>
                            <code>{tool.example}</code>
                          </pre>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            style={{ position: 'absolute', top: '4px', right: '4px', padding: '2px 6px', height: '22px' }}
                            onClick={() => handleCopyText(tool.example, `tool-${tool.name}`)}
                          >
                            {copiedKey === `tool-${tool.name}` ? <Check size={11} /> : <Copy size={11} />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* AI Assistant Direct Grounding Notice */}
        <div style={{
          marginTop: '8px',
          padding: '12px 14px',
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <Bot size={20} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Terhubung Otomatis ke Chatbot PE-Portal:</strong> Anda tidak perlu konfigurasi manual untuk menggunakan fitur ini di web! AI Assistant di PE-Portal telah terhubung langsung ke MCP Server ini. Anda dapat langsung bertanya ke Chatbot: <em>"Berapa jumlah model baru yang sedang PVT?", "Bagaimana jadwal milestone SM-A186?",</em> atau <em>"Cek apakah ada sampel yang dipinjam"</em> dan AI akan mengambil data live real-time dari database.
          </div>
        </div>
      </div>
    </div>

  );
};
