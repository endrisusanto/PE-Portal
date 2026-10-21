import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pin, FileText, Search } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';

export const ImeiArticlesPage = () => {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modelId, setModelId] = useState('');
  const [isPinned, setIsPinned] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('nav.imei')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Technical notes, IMEI articles, and firmware process records grouped per model
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          New Article
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: '360px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search article titles and contents..."
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
          <option value="">All Models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.model_name} ({m.codename || 'Standard'})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState message="Loading IMEI articles..." />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No articles found"
          description="Create technical post notes for project models."
          actionLabel="Create Note"
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  {art.model_name || 'General'}
                </span>
                {art.is_pinned && <Pin size={14} color="var(--color-accent)" />}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Article Notes / Content
            </label>
            <textarea
              rows="6"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Record parameters, line settings, error handling..."
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
              }}
            />
          </div>

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
    </div>
  );
};
