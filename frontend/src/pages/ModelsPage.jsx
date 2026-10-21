import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronRight, Cpu, Edit2 } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { FormattingTextarea } from '../components/common/FormattingTextarea';

const PIPELINE_STAGES = [
  { key: 'concept', label: 'Concept' },
  { key: 'design', label: 'Design' },
  { key: 'prototype', label: 'Proto' },
  { key: 'evt', label: 'EVT' },
  { key: 'dvt', label: 'DVT' },
  { key: 'pvt', label: 'PVT' },
  { key: 'mp', label: 'MP' },
  { key: 'released', label: 'Release' },
];

export const ModelsPage = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [activeModel, setActiveModel] = useState(null);

  // Add form
  const [modelName, setModelName] = useState('');
  const [codename, setCodename] = useState('');
  const [stage, setStage] = useState('concept');
  const [targetRelease, setTargetRelease] = useState('');
  const [description, setDescription] = useState('');

  // Advance form
  const [nextStage, setNextStage] = useState('');
  const [stageNotes, setStageNotes] = useState('');

  // Edit form
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [editModelName, setEditModelName] = useState('');
  const [editCodename, setEditCodename] = useState('');
  const [editTargetRelease, setEditTargetRelease] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/models');
      setModels(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleCreateModel = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/models', {
        model_name: modelName,
        codename: codename || undefined,
        stage,
        target_release: targetRelease || undefined,
        description: description || undefined,
      });
      setModels((prev) => [res.data, ...prev]);
      setIsAddModalOpen(false);
      setModelName('');
      setCodename('');
      setTargetRelease('');
      setDescription('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleAdvanceStage = async (e) => {
    e.preventDefault();
    if (!activeModel) return;

    try {
      await api.post(`/models/${activeModel.id}/stages`, {
        stage: nextStage,
        notes: stageNotes,
      });
      setIsAdvanceModalOpen(false);
      setActiveModel(null);
      setStageNotes('');
      fetchModels();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const openAdvanceModal = (m) => {
    setActiveModel(m);
    const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === m.stage);
    const next = PIPELINE_STAGES[currentIndex + 1]?.key || m.stage;
    setNextStage(next);
    setIsAdvanceModalOpen(true);
  };

  const openEditModal = (m) => {
    setEditingModel(m);
    setEditModelName(m.model_name || '');
    setEditCodename(m.codename || '');
    setEditTargetRelease(m.target_release ? m.target_release.substring(0, 10) : '');
    setEditDescription(m.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateModel = async (e) => {
    if (e) e.preventDefault();
    if (!editingModel) return;

    try {
      const res = await api.put(`/models/${editingModel.id}`, {
        model_name: editModelName,
        codename: editCodename || undefined,
        target_release: editTargetRelease || undefined,
        description: editDescription || undefined,
      });
      setModels((prev) =>
        prev.map((m) => (m.id === editingModel.id ? { ...m, ...res.data } : m))
      );
      setIsEditModalOpen(false);
      setEditingModel(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
            {t('models.title')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('models.subtitle')}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
          {t('models.add_model')}
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading new model pipeline..." />
      ) : models.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No models registered"
          description="Register a new product model (e.g. S26 Series codename Paradigm) to begin tracking."
          actionLabel="Register Model"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {models.map((m) => {
            const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === m.stage);
            return (
              <div
                key={m.id}
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Model Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
                        {m.model_name}
                      </h2>
                      {m.codename && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-accent-subtle)',
                          color: 'var(--color-accent)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          Codename: {m.codename}
                        </span>
                      )}
                      <StatusBadge status={m.stage} />
                      {m.target_release && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Target: {new Date(m.target_release).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Edit2}
                      onClick={() => openEditModal(m)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ChevronRight}
                      onClick={() => openAdvanceModal(m)}
                    >
                      {t('models.advance_stage')}
                    </Button>
                  </div>
                </div>

                {/* Pipeline visual bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  overflowX: 'auto',
                }}>
                  {PIPELINE_STAGES.map((s, idx) => {
                    const isPassed = idx < currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <React.Fragment key={s.key}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: isCurrent
                            ? 'var(--color-accent)'
                            : isPassed
                            ? 'var(--color-success)'
                            : 'var(--color-text-muted)',
                          fontWeight: isCurrent ? 700 : 500,
                          fontSize: 'var(--font-size-xs)',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCurrent
                              ? 'var(--color-accent)'
                              : isPassed
                              ? 'var(--color-success)'
                              : 'var(--color-border)',
                            color: '#ffffff',
                            fontSize: '10px',
                            fontWeight: 700,
                          }}>
                            {isPassed ? '✓' : idx + 1}
                          </span>
                          <span>{s.label}</span>
                        </div>
                        {idx < PIPELINE_STAGES.length - 1 && (
                          <div style={{
                            flex: 1,
                            minWidth: '24px',
                            height: '2px',
                            backgroundColor: idx < currentStageIndex
                              ? 'var(--color-success)'
                              : 'var(--color-border)',
                            margin: '0 8px',
                          }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Model Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Product Model"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateModel}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Model Name"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            required
            placeholder="e.g. S26 Series"
          />

          <Input
            label="Codename"
            value={codename}
            onChange={(e) => setCodename(e.target.value)}
            placeholder="e.g. Paradigm"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Initial Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Target Release Date"
            type="date"
            value={targetRelease}
            onChange={(e) => setTargetRelease(e.target.value)}
          />

          <FormattingTextarea
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Model specifications, line configuration..."
            minHeight="100px"
          />
        </form>
      </Modal>

      {/* Edit Model Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingModel(null);
        }}
        title={`Edit Model: ${editingModel?.model_name || ''}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingModel(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleUpdateModel}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Model Name"
            value={editModelName}
            onChange={(e) => setEditModelName(e.target.value)}
            required
            placeholder="e.g. S26 Series"
          />

          <Input
            label="Codename"
            value={editCodename}
            onChange={(e) => setEditCodename(e.target.value)}
            placeholder="e.g. Paradigm"
          />

          <Input
            label="Target Release Date"
            type="date"
            value={editTargetRelease}
            onChange={(e) => setEditTargetRelease(e.target.value)}
          />

          <FormattingTextarea
            label="Description"
            rows={4}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Model specifications, line configuration..."
            minHeight="120px"
          />
        </form>
      </Modal>

      {/* Advance Stage Modal */}
      <Modal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        title={`Advance Stage: ${activeModel?.model_name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAdvanceModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleAdvanceStage}>
              Confirm Stage Advancement
            </Button>
          </>
        }
      >
        <form onSubmit={handleAdvanceStage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Select Next Stage
            </label>
            <select
              value={nextStage}
              onChange={(e) => setNextStage(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <FormattingTextarea
            label="Advancement Notes / Verification"
            rows={4}
            value={stageNotes}
            onChange={(e) => setStageNotes(e.target.value)}
            placeholder="Record approval criteria, build approval results, JIG validation..."
            minHeight="120px"
          />
        </form>
      </Modal>
    </div>
  );
};
