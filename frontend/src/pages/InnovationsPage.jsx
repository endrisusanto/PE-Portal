import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, ThumbsUp } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Table } from '../components/common/Table';

export const InnovationsPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formCategory, setFormCategory] = useState('innovation');
  const [impactScore, setImpactScore] = useState(3);

  const fetchInnovations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/innovations', {
        params: { category: category || undefined },
      });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInnovations();
  }, [category]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/innovations', {
        title,
        description: description || undefined,
        category: formCategory,
        impact_score: Number(impactScore),
      });
      setItems((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const columns = [
    {
      title: 'Title',
      key: 'title',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          {row.description && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {row.description.slice(0, 80)}...
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      render: (val) => (
        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
          {val === 'best_practice' ? 'Best Practice' : 'Innovation Idea'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      title: 'Impact',
      key: 'impact_score',
      render: (val) => <span>★ {val || 0}/5</span>,
    },
    {
      title: 'Author',
      key: 'author_name',
      render: (val) => <span>{val || 'Engineer'}</span>,
    },
    {
      title: 'Date',
      key: 'created_at',
      render: (val) => <span>{new Date(val).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('nav.innovations')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Knowledge sharing, innovation ideas, and Best Practice (BP) standards for production engineering
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          {t('common.create')}
        </Button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { key: '', label: 'All Items' },
          { key: 'innovation', label: 'Innovation Ideas' },
          { key: 'best_practice', label: 'Best Practices' },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={category === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCategory(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Loading innovations..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No records found"
          description="Be the first to submit a new innovation idea or best practice procedure."
          actionLabel="Submit Idea"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <Table columns={columns} data={items} />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Innovation Idea / Best Practice"
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
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Automated SMT Stencil Cleaning Optimization"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Category
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="innovation">Innovation Idea</option>
              <option value="best_practice">Best Practice (BP)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Impact Score (1-5)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={impactScore}
              onChange={(e) => setImpactScore(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Description & Findings
            </label>
            <textarea
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the technical implementation, cost reduction, or quality improvement..."
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
        </form>
      </Modal>
    </div>
  );
};
