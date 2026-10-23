import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Calendar,
  Send,
  Clock,
  LayoutTemplate,
  History,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  Users,
  Sparkles,
  Mail,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { EmailChipInput } from '../components/common/EmailChipInput';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Table } from '../components/common/Table';
import styles from './ReportsPage.module.css';

export const ReportsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('reports'); // reports, templates, schedules, logs
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCat, setTemplateCat] = useState('daily');
  const [templateShared, setTemplateShared] = useState(true);

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [freqType, setFreqType] = useState('weekdays'); // weekdays, daily, weekly_fri, weekly_mon, custom
  const [scheduleTime, setScheduleTime] = useState('17:00');
  const [cronExpr, setCronExpr] = useState('0 17 * * 1-5');
  const [scheduleTo, setScheduleTo] = useState('');
  const [scheduleCc, setScheduleCc] = useState('');
  const [emailLists, setEmailLists] = useState([]);

  const [sendingReportId, setSendingReportId] = useState(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState(null);

  // Helper to recompute cron from frequency & custom time
  const handleTimeOrFreqChange = (newFreq, newTime) => {
    const freq = newFreq !== undefined ? newFreq : freqType;
    const time = newTime !== undefined ? newTime : scheduleTime;
    if (newFreq !== undefined) setFreqType(newFreq);
    if (newTime !== undefined) setScheduleTime(newTime);

    if (freq === 'custom') return;

    const [hStr, mStr] = (time || '17:00').split(':');
    const h = parseInt(hStr || '17', 10);
    const m = parseInt(mStr || '0', 10);

    let expr = `${m} ${h} * * 1-5`;
    if (freq === 'daily') expr = `${m} ${h} * * *`;
    else if (freq === 'weekly_fri') expr = `${m} ${h} * * 5`;
    else if (freq === 'weekly_mon') expr = `${m} ${h} * * 1`;

    setCronExpr(expr);
  };

  const formatCronSchedule = (cron) => {
    if (!cron) return 'Not configured';
    const parts = cron.trim().split(/\s+/);
    if (parts.length >= 5) {
      const min = parts[0].padStart(2, '0');
      const hour = parts[1].padStart(2, '0');
      const dayOfWeek = parts[4];
      if (dayOfWeek === '1-5') return `Senin - Jumat @ ${hour}:${min} WIB`;
      if (dayOfWeek === '*' || dayOfWeek === '?') return `Setiap Hari @ ${hour}:${min} WIB`;
      if (dayOfWeek === '5') return `Setiap Jumat @ ${hour}:${min} WIB`;
      if (dayOfWeek === '1') return `Setiap Senin @ ${hour}:${min} WIB`;
      return `Pukul ${hour}:${min} (hari: ${dayOfWeek})`;
    }
    return cron;
  };

  const appendScheduleRecipients = (emails, target = 'to') => {
    const current = target === 'to' ? scheduleTo : scheduleCc;
    const currList = current.split(',').map((s) => s.trim()).filter(Boolean);
    const addList = emails.split(',').map((s) => s.trim()).filter(Boolean);
    const combined = Array.from(new Set([...currList, ...addList])).join(', ');
    if (target === 'to') setScheduleTo(combined);
    else setScheduleCc(combined);
    showNotification('success', `Quick added to ${target.toUpperCase()}`);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [repRes, tmplRes, schRes, logRes, emailListsRes] = await Promise.all([
        api.get('/reports').catch(() => ({ data: [] })),
        api.get('/reports/templates').catch(() => ({ data: [] })),
        api.get('/reports/schedules').catch(() => ({ data: [] })),
        api.get('/reports/logs').catch(() => ({ data: [] })),
        api.get('/users/me/email-lists').catch(() => ({ data: [] })),
      ]);
      setReports(repRes.data || []);
      setTemplates(tmplRes.data || []);
      setSchedules(schRes.data || []);
      setLogs(logRes.data || []);
      setEmailLists(emailListsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const showNotification = (type, text) => {
    setActionFeedback({ type, text });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Create Template
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/reports/templates', {
        title: templateTitle,
        description: templateDesc || undefined,
        category: templateCat,
        is_shared: templateShared,
        content: [
          { type: 'heading', content: '1. Summary of Work & Accomplishments' },
          { type: 'paragraph', content: 'Describe daily tasks completed today.' },
          { type: 'db_widget', widget: 'tasks', title: 'Today Assigned Tasks' },
          { type: 'heading', content: '2. Issues & Tomorrow Plan' },
          { type: 'paragraph', content: 'Follow-up actions.' },
        ],
      });
      setTemplates([res.data, ...templates]);
      setIsTemplateModalOpen(false);
      setTemplateTitle('');
      setTemplateDesc('');
      showNotification('success', 'Template created successfully');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this report template?')) return;
    try {
      await api.delete(`/reports/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
      showNotification('success', 'Template deleted');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Create Schedule
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const toList = scheduleTo.split(',').map((s) => s.trim()).filter(Boolean);
      const ccList = scheduleCc.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await api.post('/reports/schedules', {
        title: scheduleTitle,
        template_id: selectedTemplateId || undefined,
        cron_expression: cronExpr,
        recipients: { to: toList, cc: ccList },
        is_active: true,
      });

      setSchedules([res.data, ...schedules]);
      setIsScheduleModalOpen(false);
      setScheduleTitle('');
      setScheduleTo('');
      setScheduleCc('');
      showNotification('success', 'Automated schedule registered');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Remove this automated schedule?')) return;
    try {
      await api.delete(`/reports/schedules/${id}`);
      setSchedules(schedules.filter((s) => s.id !== id));
      showNotification('success', 'Schedule removed');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Trigger Schedule Now
  const handleTriggerSchedule = async (id) => {
    setTriggeringScheduleId(id);
    try {
      await api.post(`/reports/schedules/${id}/trigger`);
      showNotification('success', 'Schedule triggered. Email dispatched successfully!');
      // Refresh logs after 2s
      setTimeout(fetchData, 2000);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setTriggeringScheduleId(null);
    }
  };

  // Send Report Now via Email
  const handleSendReport = async (id) => {
    setSendingReportId(id);
    try {
      await api.post(`/reports/${id}/send`);
      showNotification('success', 'Report sent successfully via Email!');
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'sent' } : r))
      );
      // Refresh logs after 2s
      setTimeout(fetchData, 2000);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSendingReportId(null);
    }
  };

  // Delete Report
  const handleDeleteReport = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await api.delete(`/reports/${id}`);
      setReports(reports.filter((r) => r.id !== id));
      showNotification('success', 'Report deleted');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (loading) return <LoadingState message="Loading work reports and automation schedules..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{t('reports.title')}</h1>
          <p className={styles.subtitle}>{t('reports.subtitle')}</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            icon={Sparkles}
            onClick={() => navigate('/reports/new?rag=true')}
          >
            {t('reports.scrape_db')}
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/reports/new')}
          >
            {t('reports.new_report')}
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {actionFeedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor:
              actionFeedback.type === 'success'
                ? 'var(--color-success-subtle)'
                : 'var(--color-error-subtle)',
            color:
              actionFeedback.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)',
            border: `1px solid ${
              actionFeedback.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)'
            }`,
          }}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`${styles.tabBtn} ${activeTab === 'reports' ? styles.activeTab : ''}`}
        >
          <FileText size={16} />
          {t('reports.tab_reports')}
          <span className={styles.tabBadge}>{reports.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.activeTab : ''}`}
        >
          <LayoutTemplate size={16} />
          {t('reports.tab_templates')}
          <span className={styles.tabBadge}>{templates.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`${styles.tabBtn} ${activeTab === 'schedules' ? styles.activeTab : ''}`}
        >
          <Clock size={16} />
          {t('reports.tab_schedules')}
          <span className={styles.tabBadge}>{schedules.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.activeTab : ''}`}
        >
          <History size={16} />
          {t('reports.tab_logs')}
          <span className={styles.tabBadge}>{logs.length}</span>
        </button>
      </div>

      {/* TAB 1: REPORTS */}
      {activeTab === 'reports' && (
        <>
          {reports.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={40} color="var(--color-text-muted)" />
              <div>
                <strong>{t('reports.empty_reports')}</strong>
                <p style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                  Create your first interactive digital report with live database embeds or scrape your daily activities.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/reports/new')}
              >
                {t('reports.new_report')}
              </Button>
            </div>
          ) : (
            <div className={styles.grid}>
              {reports.map((rep) => {
                let recCount = 0;
                try {
                  const parsed = typeof rep.recipients === 'string' ? JSON.parse(rep.recipients) : rep.recipients;
                  recCount = (parsed?.to?.length || 0) + (parsed?.cc?.length || 0);
                } catch (e) {
                  // ignore
                }
                return (
                  <div key={rep.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>{rep.title}</div>
                        <StatusBadge
                          status={rep.status === 'sent' ? 'approved' : 'pending'}
                          label={rep.status}
                        />
                      </div>
                      <div className={styles.cardMeta}>
                        <span><Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />{rep.report_date}</span>
                        {rep.template_name && <span>• Template: {rep.template_name}</span>}
                        {recCount > 0 && <span>• {recCount} Recipients</span>}
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => navigate(`/reports/editor/${rep.id}`)}
                        >
                          {t('reports.open_editor', 'Open Editor')}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Send}
                          loading={sendingReportId === rep.id}
                          onClick={() => handleSendReport(rep.id)}
                        >
                          {t('reports.send_email', 'Send Email')}
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReport(rep.id)}
                        aria-label="Delete report"
                      >
                        <Trash2 size={15} color="var(--color-error)" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: TEMPLATES */}
      {activeTab === 'templates' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsTemplateModalOpen(true)}
            >
              {t('reports.new_template')}
            </Button>
          </div>

          <div className={styles.grid}>
            {templates.map((tmpl) => (
              <div key={tmpl.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{tmpl.title}</div>
                    <span className={tmpl.is_shared ? styles.badgeShared : styles.badgePrivate}>
                      {tmpl.is_shared ? t('reports.shared_team', 'Shared with Team') : t('reports.personal', 'Personal')}
                    </span>
                  </div>
                  {tmpl.description && <div className={styles.cardDesc}>{tmpl.description}</div>}
                  <div className={styles.cardMeta}>
                    <span>Category: {tmpl.category.toUpperCase()}</span>
                    {tmpl.author_name && <span>• Author: {tmpl.author_name}</span>}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => navigate(`/reports/new?templateId=${tmpl.id}`)}
                  >
                    {t('reports.use_template', 'Use This Template')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTemplate(tmpl.id)}
                    aria-label="Delete template"
                  >
                    <Trash2 size={15} color="var(--color-error)" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB 3: SCHEDULES */}
      {activeTab === 'schedules' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsScheduleModalOpen(true)}
            >
              {t('reports.new_schedule')}
            </Button>
          </div>

          {schedules.length === 0 ? (
            <div className={styles.emptyState}>
              <Clock size={40} color="var(--color-text-muted)" />
              <div>
                <strong>{t('reports.empty_schedules')}</strong>
                <p style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                  Set up automatic recurring work reports dispatched directly to managers via SMTP.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setIsScheduleModalOpen(true)}
              >
                {t('reports.new_schedule')}
              </Button>
            </div>
          ) : (
            <div className={styles.grid}>
              {schedules.map((sch) => {
                let toList = [];
                try {
                  const parsed = typeof sch.recipients === 'string' ? JSON.parse(sch.recipients) : sch.recipients;
                  toList = parsed?.to || [];
                } catch (e) {
                  // ignore
                }

                return (
                  <div key={sch.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>{sch.title}</div>
                        <StatusBadge
                          status={sch.is_active ? 'approved' : 'rejected'}
                          label={sch.is_active ? 'Active Auto-Send' : 'Paused'}
                        />
                      </div>
                      <div className={styles.cardDesc}>
                        <strong>Frequency:</strong> {formatCronSchedule(sch.cron_expression)}{' '}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>({sch.cron_expression})</span><br />
                        <strong>To:</strong> {toList.join(', ') || 'No recipients'}
                      </div>
                      <div className={styles.cardMeta}>
                        {sch.last_status && <span>Last: {sch.last_status.toUpperCase()}</span>}
                        {sch.next_run_at && (
                          <span>• Next Run: {new Date(sch.next_run_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Play}
                        loading={triggeringScheduleId === sch.id}
                        onClick={() => handleTriggerSchedule(sch.id)}
                      >
                        {t('reports.run_now', 'Run Now')}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSchedule(sch.id)}
                        aria-label="Delete schedule"
                      >
                        <Trash2 size={15} color="var(--color-error)" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 4: DELIVERY LOGS */}
      {activeTab === 'logs' && (
        <Table
          columns={[
            {
              title: t('reports.col_dispatched_at', 'Dispatched At'),
              key: 'sent_at',
              render: (val) => <span style={{ whiteSpace: 'nowrap' }}>{new Date(val).toLocaleString()}</span>,
            },
            {
              title: t('reports.col_subject', 'Subject'),
              key: 'subject',
              render: (val) => <span style={{ fontWeight: 600 }}>{val}</span>,
            },
            {
              title: t('reports.col_recipients', 'Recipients'),
              key: 'recipients',
              render: (val) => {
                let recDisplay = '-';
                try {
                  const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                  if (Array.isArray(parsed)) recDisplay = parsed.join(', ');
                } catch (e) {}
                return <span>{recDisplay}</span>;
              },
            },
            {
              title: t('common.status', 'Status'),
              key: 'status',
              render: (val) => (
                <StatusBadge
                  status={val === 'success' ? 'approved' : 'rejected'}
                  label={val}
                />
              ),
            },
            {
              title: t('reports.col_details', 'Details'),
              key: 'error_message',
              sortable: false,
              render: (val) => (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {val || 'Transmitted cleanly via SMTP gateway'}
                </span>
              ),
            },
          ]}
          data={logs}
          emptyMessage={t('reports.empty_logs')}
        />
      )}

      {/* Create Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Create Shared Report Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateTemplate}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Template Title"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            required
            placeholder="e.g. Daily JIG & Production Operations Report"
          />

          <Input
            label="Description"
            value={templateDesc}
            onChange={(e) => setTemplateDesc(e.target.value)}
            placeholder="Recommended usage and target audience"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Category
            </label>
            <select
              value={templateCat}
              onChange={(e) => setTemplateCat(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="daily">Daily Work Report</option>
              <option value="weekly">Weekly Progress Report</option>
              <option value="project">Project Milestone Report</option>
              <option value="custom">Specialized / Custom Report</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            <input
              type="checkbox"
              checked={templateShared}
              onChange={(e) => setTemplateShared(e.target.checked)}
            />
            <span>Share this template with all SEIN PE team members</span>
          </label>
        </form>
      </Modal>

      {/* Create Schedule Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Register Automated SMTP Delivery Schedule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsScheduleModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateSchedule}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label={t('reports.schedule_title')}
            value={scheduleTitle}
            onChange={(e) => setScheduleTitle(e.target.value)}
            required
            placeholder="e.g. Daily EOD Work Summary to Manager"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Base Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Default Live Activities Summary</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Custom Schedule & Time Picker */}
          <div style={{ display: 'grid', gridTemplateColumns: freqType === 'custom' ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Pengulangan Jadwal
              </label>
              <select
                value={freqType}
                onChange={(e) => handleTimeOrFreqChange(e.target.value, scheduleTime)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="weekdays">Senin - Jumat (Workdays)</option>
                <option value="daily">Setiap Hari (Senin - Minggu)</option>
                <option value="weekly_fri">Mingguan (Setiap Jumat)</option>
                <option value="weekly_mon">Mingguan (Setiap Senin)</option>
                <option value="custom">Kustom (Format Cron Manual)</option>
              </select>
            </div>

            {freqType !== 'custom' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} color="var(--color-accent)" />
                  Pilih Jam Kirim
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => handleTimeOrFreqChange(freqType, e.target.value)}
                  required
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            ) : (
              <Input
                label="Custom Cron Expression"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="0 17 * * 1-5"
                required
              />
            )}
          </div>

          {/* Live schedule preview badge */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-accent)',
          }}>
            <Clock size={14} />
            <span>
              <strong>Otomatisasi:</strong> {formatCronSchedule(cronExpr)} &bull;{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>{cronExpr}</code>
            </span>
          </div>

          {/* Quick Action: Insert from My Email Lists */}
          {emailLists.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              padding: '8px 10px',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                <Users size={12} /> Quick Email Groups:
              </span>
              {emailLists.map((list) => (
                <div key={list.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <button
                    type="button"
                    onClick={() => appendScheduleRecipients(list.emails, 'to')}
                    style={{
                      padding: '3px 8px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Mail size={10} />
                    + To: {list.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => appendScheduleRecipients(list.emails, 'cc')}
                    style={{
                      padding: '3px 6px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      opacity: 0.8,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    + CC
                  </button>
                </div>
              ))}
            </div>
          )}

          <EmailChipInput
            label={t('reports.recipients')}
            value={scheduleTo}
            onChange={(val) => setScheduleTo(val)}
            placeholder="Type email & press Enter or comma..."
            required
          />

          <EmailChipInput
            label={t('reports.cc_recipients')}
            value={scheduleCc}
            onChange={(val) => setScheduleCc(val)}
            placeholder="Optional CC recipients..."
          />
        </form>
      </Modal>


    </div>
  );
};
