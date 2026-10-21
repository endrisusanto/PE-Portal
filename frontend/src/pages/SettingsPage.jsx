import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Activity, Trash2, Server, ShieldCheck, CheckCircle2, AlertTriangle, Mail, Send, Bot, Sparkles, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export const SettingsPage = () => {
  const { t } = useTranslation();

  const [servers, setServers] = useState([]);
  const [authConfig, setAuthConfig] = useState(null);
  const [smtpConfig, setSmtpConfig] = useState({
    name: 'Corporate SEIN Mail Gateway',
    host: 'smtp.sein.corp.local',
    port: 587,
    username: '',
    password: '',
    from_email: 'pe-reporter@samsung.com',
    from_name: 'SEIN PE Portal Robot',
    encryption: 'tls',
  });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState(null);
  const [testRecipient, setTestRecipient] = useState('');

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState({
    name: 'LM Studio',
    provider: 'openai-compatible',
    base_url: 'https://lmstudio.endrisusanto.my.id/v1',
    api_key: 'lm-studio',
    model_name: 'google/gemma-4-e4b',
    is_active: true,
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savingLlm, setSavingLlm] = useState(false);
  const [llmFeedback, setLlmFeedback] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [description, setDescription] = useState('');
  const [testingHealth, setTestingHealth] = useState(null);
  const [healthResults, setHealthResults] = useState({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mcpRes, authRes, smtpRes, llmRes] = await Promise.all([
        api.get('/mcp/servers'),
        api.get('/settings/auth').catch(() => ({ data: { provider: 'local' } })),
        api.get('/settings/smtp').catch(() => ({ data: null })),
        api.get('/ai/config').catch(() => ({ data: null })),
      ]);
      setServers(mcpRes.data);
      setAuthConfig(authRes.data);
      if (smtpRes.data) {
        setSmtpConfig(smtpRes.data);
      }
      if (llmRes.data?.config) {
        setLlmConfig(llmRes.data.config);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/mcp/servers', {
        name,
        url,
        auth_type: authType,
        auth_token: authToken || undefined,
        description: description || undefined,
        is_active: true,
      });
      setServers((prev) => [...prev, res.data]);
      setIsModalOpen(false);
      setName('');
      setUrl('');
      setAuthType('none');
      setAuthToken('');
      setDescription('');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteServer = async (id) => {
    if (!window.confirm(t('settings.confirm_delete_server', 'Remove this MCP server configuration?'))) return;
    try {
      await api.delete(`/mcp/servers/${id}`);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleTestHealth = async (id) => {
    setTestingHealth(id);
    try {
      const res = await api.post(`/mcp/servers/${id}/health`);
      setHealthResults((prev) => ({
        ...prev,
        [id]: res.data.status,
      }));
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, health_status: res.data.status } : s))
      );
    } catch (err) {
      setHealthResults((prev) => ({
        ...prev,
        [id]: 'unhealthy',
      }));
    } finally {
      setTestingHealth(null);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSavingSmtp(true);
    setSmtpFeedback(null);
    try {
      const res = await api.put('/settings/smtp', smtpConfig);
      setSmtpConfig(res.data);
      setSmtpFeedback({ type: 'success', text: 'SMTP gateway settings saved successfully' });
    } catch (err) {
      setSmtpFeedback({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpFeedback(null);
    try {
      const res = await api.post('/settings/smtp/test', {
        recipient: testRecipient || undefined,
      });
      setSmtpFeedback({ type: 'success', text: res.data.message });
    } catch (err) {
      setSmtpFeedback({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setLlmFeedback(null);
    try {
      const res = await api.get('/ai/models');
      setAvailableModels(res.data.models || []);
      setLlmFeedback({ type: 'success', text: `Successfully discovered ${res.data.models?.length || 0} models from ${res.data.endpoint}` });
    } catch (err) {
      setLlmFeedback({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSaveLlm = async (e) => {
    e.preventDefault();
    setSavingLlm(true);
    setLlmFeedback(null);
    try {
      const res = await api.put('/ai/config', { ...llmConfig, is_custom: false });
      setLlmConfig(res.data.config);
      setLlmFeedback({ type: 'success', text: res.data.message || 'LLM API settings saved successfully' });
    } catch (err) {
      setLlmFeedback({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setSavingLlm(false);
    }
  };

  if (loading) return <LoadingState message={t('settings.loading_configs', 'Loading portal configurations...')} />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
          {t('settings.title')}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {t('settings.subtitle', 'Manage engineering tool integrations, MCP endpoints, and corporate auth')}
        </p>
      </div>

      {/* MCP Servers Section */}
      <section style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--color-accent)" />
              {t('settings.mcp_servers')}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              {t('settings.mcp_desc')}
            </p>
          </div>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsModalOpen(true)}>
            {t('settings.add_server')}
          </Button>
        </div>

        {/* Server Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {servers.map((srv) => {
            const health = healthResults[srv.id] || srv.health_status;
            return (
              <div
                key={srv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{srv.name}</span>
                    <StatusBadge status={health} />
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-secondary)',
                    marginTop: '4px',
                  }}>
                    {srv.url}
                  </div>
                  {srv.description && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {srv.description}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={testingHealth === srv.id}
                    onClick={() => handleTestHealth(srv.id)}
                  >
                    {t('settings.test_connection')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteServer(srv.id)}
                    aria-label={t('settings.delete_server', 'Delete MCP Server')}
                  >
                    <Trash2 size={16} color="var(--color-error)" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Auth Settings Section */}
      <section style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldCheck size={18} color="var(--color-accent)" />
          {t('settings.auth_config')}
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: '16px' }}>
          {t('settings.auth_desc', 'Configured authentication method for engineers and managers')}
        </p>

        <div style={{
          padding: '16px',
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              {authConfig?.provider === 'ldap' ? t('settings.ldap_auth') : t('settings.local_auth')}
            </span>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {t('settings.auth_swappable', 'Swappable without code modifications via AUTH_PROVIDER setting')}
            </div>
          </div>
          <StatusBadge status="approved" label={authConfig?.provider || 'local'} />
        </div>
      </section>

      {/* SMTP Gateway Configuration */}
      <section style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color="var(--color-accent)" />
              {t('settings.smtp_title', 'Corporate SMTP Mail Gateway')}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              {t('settings.smtp_desc', 'Configure outbound email server for work reports, digital articles and automated scheduled deliveries')}
            </p>
          </div>
        </div>

        {smtpFeedback && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: 'var(--font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: smtpFeedback.type === 'success' ? 'var(--color-success-subtle)' : 'var(--color-error-subtle)',
            color: smtpFeedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            border: `1px solid ${smtpFeedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`,
          }}>
            {smtpFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{smtpFeedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSmtp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <Input
            label={t('settings.smtp_name', 'Gateway / Profile Name')}
            value={smtpConfig.name}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, name: e.target.value })}
            required
            placeholder="e.g. Corporate SEIN Gateway"
          />

          <Input
            label={t('settings.smtp_host', 'SMTP Hostname / IP')}
            value={smtpConfig.host}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
            required
            placeholder="smtp.sein.corp.local"
          />

          <Input
            label={t('settings.smtp_port', 'Port')}
            type="number"
            value={smtpConfig.port}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) || 587 })}
            required
            placeholder="587 or 465"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              {t('settings.smtp_encryption', 'Encryption')}
            </label>
            <select
              value={smtpConfig.encryption}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, encryption: e.target.value })}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="tls">{t('settings.smtp_enc_tls', 'STARTTLS (Port 587)')}</option>
              <option value="ssl">{t('settings.smtp_enc_ssl', 'SSL / TLS Direct (Port 465)')}</option>
              <option value="none">{t('settings.smtp_enc_none', 'Plain / None (Port 25)')}</option>
            </select>
          </div>

          <Input
            label={t('settings.smtp_username', 'Username (Optional)')}
            value={smtpConfig.username}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
            placeholder="pe-reporter@samsung.com"
          />

          <Input
            label={t('settings.smtp_password', 'Password (Optional)')}
            type="password"
            value={smtpConfig.password}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
            placeholder="••••••••"
          />

          <Input
            label={t('settings.smtp_from_email', 'Sender Address (From Email)')}
            value={smtpConfig.from_email}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
            required
            placeholder="pe-reports@samsung.com"
          />

          <Input
            label={t('settings.smtp_from_name', 'Sender Display Name')}
            value={smtpConfig.from_name}
            onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
            placeholder="SEIN PE Portal Robot"
          />

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="email"
                placeholder={t('settings.smtp_test_placeholder', 'Test email recipient...')}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  width: '220px',
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Send}
                loading={testingSmtp}
                onClick={handleTestSmtp}
              >
                {t('settings.smtp_send_test', 'Send Test Probe')}
              </Button>
            </div>

            <Button type="submit" variant="primary" size="sm" loading={savingSmtp}>
              {t('settings.smtp_save', 'Save SMTP Configuration')}
            </Button>
          </div>
        </form>
      </section>

      {/* LLM AI Provider Configuration */}
      <section style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="var(--color-accent)" />
              {t('settings.llm_title', 'LLM AI API Configuration (OpenAI-Compatible / LM Studio)')}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              {t('settings.llm_desc', 'Configure centralized LLM endpoint for PE Assistant, RAG database summarizer, and chat completion')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={fetchingModels}
            onClick={handleFetchModels}
          >
            {t('settings.llm_fetch_models', 'Fetch Available Models')}
          </Button>
        </div>

        {llmFeedback && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: 'var(--font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: llmFeedback.type === 'success' ? 'var(--color-success-subtle)' : 'var(--color-error-subtle)',
            color: llmFeedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            border: `1px solid ${llmFeedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`,
          }}>
            {llmFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{llmFeedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveLlm} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              {t('settings.llm_provider_type', 'Provider Type')}
            </label>
            <select
              value={llmConfig.provider}
              onChange={(e) => setLlmConfig({ ...llmConfig, provider: e.target.value })}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="openai-compatible">OpenAI-Compatible (LM Studio / vLLM / Local)</option>
              <option value="openai">OpenAI Official</option>
              <option value="gemini">Google Gemini API</option>
              <option value="claude">Anthropic Claude</option>
            </select>
          </div>

          <Input
            label={t('settings.llm_provider_name', 'Provider Name')}
            value={llmConfig.name}
            onChange={(e) => setLlmConfig({ ...llmConfig, name: e.target.value })}
            required
            placeholder="LM Studio"
          />

          <Input
            label={t('settings.llm_base_url', 'Base URL Endpoint')}
            value={llmConfig.base_url}
            onChange={(e) => setLlmConfig({ ...llmConfig, base_url: e.target.value })}
            required
            placeholder="https://lmstudio.endrisusanto.my.id/v1"
          />

          <Input
            label={t('settings.llm_api_key', 'API Key')}
            type="password"
            value={llmConfig.api_key}
            onChange={(e) => setLlmConfig({ ...llmConfig, api_key: e.target.value })}
            placeholder="lm-studio"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              {t('settings.llm_model_name', 'Active Model Name')}
            </label>
            {availableModels.length > 0 ? (
              <select
                value={llmConfig.model_name}
                onChange={(e) => setLlmConfig({ ...llmConfig, model_name: e.target.value })}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={llmConfig.model_name}
                onChange={(e) => setLlmConfig({ ...llmConfig, model_name: e.target.value })}
                placeholder="google/gemma-4-e4b"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '22px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
              <input
                type="checkbox"
                checked={llmConfig.is_active}
                onChange={(e) => setLlmConfig({ ...llmConfig, is_active: e.target.checked })}
              />
              <span>{t('settings.llm_enable_checkbox', 'Enable AI Assistant for all SEIN PE team members')}</span>
            </label>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <Button type="submit" variant="primary" size="sm" loading={savingLlm}>
              {t('settings.llm_save', 'Save LLM API Configuration')}
            </Button>
          </div>
        </form>
      </section>

      {/* Add MCP Server Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('settings.add_server')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateServer}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateServer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label={t('settings.server_name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Google Build Approval"
          />

          <Input
            label={t('settings.server_url')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="http://107.102.39.55:3800/mcp"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
            }}>
              {t('settings.auth_type')}
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="none">{t('settings.auth_none')}</option>
              <option value="bearer">{t('settings.auth_bearer')}</option>
              <option value="api_key">{t('settings.auth_api_key')}</option>
            </select>
          </div>

          {authType !== 'none' && (
            <Input
              label={t('settings.token_label', 'Token / API Key')}
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={t('settings.token_placeholder')}
            />
          )}

          <Input
            label={t('settings.server_description', 'Description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('settings.server_description_placeholder', 'Tool capabilities and purpose')}
          />
        </form>
      </Modal>
    </div>
  );
};
