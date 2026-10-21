import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pin, FileText, Search, Edit2 } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { FormattingTextarea } from '../components/common/FormattingTextarea';

export const ImeiArticlesPage = () => {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modelId, setModelId] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  // Edit Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editIsPinned, setEditIsPinned] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [artRes, modRes] = await Promise.all([
        api.get('/imei/articles', {
          params: {
            search: search || undefined,
            model_id: selectedModel || undefined,
          },
        }),
        api.get('/models'),
      ]);
      setArticles(artRes.data);
      setModels(modRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedModel]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/imei/articles', {
        title,
        content,
        model_id: modelId || undefined,
        is_pinned: isPinned,
      });
      setArticles((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setTitle('');
      setContent('');
      setModelId('');
      setIsPinned(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleOpenEdit = (art) => {
    setEditingArticle(art);
    setEditTitle(art.title || '');
    setEditContent(art.content || '');
    setEditModelId(art.model_id || '');
    setEditIsPinned(!!art.is_pinned);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!editingArticle) return;
    try {
      const res = await api.put(`/imei/articles/${editingArticle.id}`, {
        title: editTitle,
        content: editContent,
        model_id: editModelId || undefined,
        is_pinned: editIsPinned,
      });
      setArticles((prev) =>
        prev.map((a) => (a.id === editingArticle.id ? { ...a, ...res.data } : a))
      );
      setIsEditModalOpen(false);
      setEditingArticle(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('imei.title', t('nav.imei', 'Artikel'))}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('imei.subtitle', 'Catatan & artikel bersama tim PE: posting update teknis, investigasi issue, tips proses, dan panduan kerja')}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          {t('imei.new_post', 'Post Artikel Baru')}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: '380px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('imei.search_placeholder', 'Cari artikel, topik, atau kata kunci...')}
          />
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{
            height: '36px',
            padding: '0 12px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="">{t('imei.all_models', 'Semua Model / Kategori')}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState message="Memuat timeline artikel..." />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada artikel / catatan bersama"
          description="Siapa saja anggota tim PE bisa memposting catatan analisa, SOP, atau update teknis di sini."
          actionLabel="Tulis Catatan Pertama"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {articles.map((art) => (
            <div
              key={art.id}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {art.model_name || 'General'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {art.is_pinned && <Pin size={14} color="var(--color-accent)" />}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(art)}
                    title="Edit Article"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-primary)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-accent)';
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {art.title}
              </h3>

              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
                flex: 1,
                maxHeight: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {art.content}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                borderTop: '1px solid var(--color-border-subtle)',
                paddingTop: '8px',
                marginTop: '8px',
              }}>
                <span>By {art.author_name || 'Engineer'}</span>
                <span>{new Date(art.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Article Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Model Technical Article"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Article Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. S26 Paradigm IMEI Calibration Procedure"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Associated Product Model
            </label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">None / General</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.model_name} ({m.codename || 'Standard'})</option>
              ))}
            </select>
          </div>

          <FormattingTextarea
            label="Article Notes / Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            placeholder="Record parameters, line settings, error handling..."
            rows={6}
            minHeight="140px"
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            Pin article to top of list
          </label>
        </form>
      </Modal>

      {/* Edit Article Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingArticle(null);
        }}
        title={`Edit Article: ${editingArticle?.title || ''}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingArticle(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleUpdate}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Article Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
            placeholder="e.g. S26 Paradigm IMEI Calibration Procedure"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Associated Product Model
            </label>
            <select
              value={editModelId}
              onChange={(e) => setEditModelId(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">None / General</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.model_name} ({m.codename || 'Standard'})</option>
              ))}
            </select>
          </div>

          <FormattingTextarea
            label="Article Notes / Content"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            required
            placeholder="Record parameters, line settings, error handling..."
            rows={8}
            minHeight="160px"
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            <input
              type="checkbox"
              checked={editIsPinned}
              onChange={(e) => setEditIsPinned(e.target.checked)}
            />
            Pin article to top of list
          </label>
        </form>
      </Modal>
    </div>
  );
};
