import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  Eye,
  Plus,
  Trash2,
  Database,
  CheckSquare,
  Heading,
  AlignLeft,
  Server,
  Layers,
  Cpu,
  Kanban,
  CheckCircle2,
  AlertTriangle,
  Users,
  Mail,
} from 'lucide-react';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { EmailChipInput } from '../components/common/EmailChipInput';
import { Modal } from '../components/common/Modal';
import { LoadingState } from '../components/common/LoadingState';
import styles from './ReportEditorPage.module.css';

export const ReportEditorPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const templateIdParam = searchParams.get('templateId');
  const ragParam = searchParams.get('rag');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Document state
  const [reportId, setReportId] = useState(id || null);
  const [title, setTitle] = useState('Daily Engineering Work Report');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [toRecipients, setToRecipients] = useState('manager@samsung.com');
  const [ccRecipients, setCcRecipients] = useState('');
  const [status, setStatus] = useState('draft');
  const [blocks, setBlocks] = useState([
    { id: '1', type: 'heading', content: '1. Daily Operations & Technical Accomplishments' },
    { id: '2', type: 'paragraph', content: 'Conducted routine line inspection, monitored JIG sensor repeatability, and checked parameter offsets.' },
    { id: '3', type: 'db_widget', widget: 'tasks', title: 'Live Assigned Tasks' },
    { id: '4', type: 'heading', content: '2. Issues, Blockers & Tomorrow Action Plan' },
    {
      id: '5',
      type: 'checklist',
      items: [
        { text: 'Confirm updated firmware flash timing with Solution Team', done: true },
        { text: 'Submit JIG calibration report to Mecha Leader', done: false },
      ],
    },
  ]);

  // Live DB Scraped Data Cache
  const [liveDbData, setLiveDbData] = useState(null);
  const [emailLists, setEmailLists] = useState([]);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load live DB data and custom email lists on load
  const loadDbActivities = async () => {
    try {
      const res = await api.get('/reports/scrape/activities');
      setLiveDbData(res.data);
    } catch (e) {
      console.warn('Could not load DB activities cache', e);
    }
  };

  const loadEmailLists = async () => {
    try {
      const res = await api.get('/users/me/email-lists');
      setEmailLists(res.data || []);
    } catch (e) {
      // ignore
    }
  };

  const appendRecipients = (emails, target = 'to') => {
    const current = target === 'to' ? toRecipients : ccRecipients;
    const currList = current.split(',').map((s) => s.trim()).filter(Boolean);
    const addList = emails.split(',').map((s) => s.trim()).filter(Boolean);
    const combined = Array.from(new Set([...currList, ...addList])).join(', ');
    if (target === 'to') {
      setToRecipients(combined);
    } else {
      setCcRecipients(combined);
    }
    showNotification('success', `Quick added recipients to ${target.toUpperCase()}`);
  };

  useEffect(() => {
    loadDbActivities();
    loadEmailLists();

    if (id) {
      setLoading(true);

      api.get(`/reports/${id}`)
        .then((res) => {
          const rep = res.data;
          setReportId(rep.id);
          setTitle(rep.title);
          setReportDate(rep.report_date);
          setStatus(rep.status);
          if (rep.content) {
            try {
              const parsed = typeof rep.content === 'string' ? JSON.parse(rep.content) : rep.content;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setBlocks(parsed);
              }
            } catch (e) {
              // keep default
            }
          }
          if (rep.recipients) {
            try {
              const rec = typeof rep.recipients === 'string' ? JSON.parse(rep.recipients) : rep.recipients;
              setToRecipients((rec.to || []).join(', '));
              setCcRecipients((rec.cc || []).join(', '));
            } catch (e) {
              // keep default
            }
          }
        })
        .finally(() => setLoading(false));
    } else if (templateIdParam) {
      setLoading(true);
      api.get(`/reports/templates/${templateIdParam}`)
        .then((res) => {
          const tmpl = res.data;
          setTitle(tmpl.title);
          if (tmpl.content) {
            try {
              const parsed = typeof tmpl.content === 'string' ? JSON.parse(tmpl.content) : tmpl.content;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setBlocks(parsed);
              }
            } catch (e) {
              // keep default
            }
          }
        })
        .finally(() => setLoading(false));
    } else if (ragParam) {
      handleSynthesizeFromDB();
    }
  }, [id, templateIdParam]);

  // Synthesize via RAG from database activities
  const handleSynthesizeFromDB = async () => {
    setSynthesizing(true);
    try {
      const res = await api.post('/reports/ai-synthesize', {});
      if (res.data.title) setTitle(res.data.title);
      if (res.data.blocks && res.data.blocks.length > 0) {
        setBlocks(res.data.blocks);
      }
      showNotification('success', 'Synthesized report from your database activities!');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  // Block management
  const updateBlockContent = (index, newContent) => {
    setBlocks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], content: newContent };
      return copy;
    });
  };

  const updateChecklistItem = (blockIndex, itemIndex, done, text) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const items = [...(copy[blockIndex].items || [])];
      items[itemIndex] = { ...items[itemIndex], done, text };
      copy[blockIndex] = { ...copy[blockIndex], items };
      return copy;
    });
  };

  const addChecklistItem = (blockIndex) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const items = [...(copy[blockIndex].items || []), { text: '', done: false }];
      copy[blockIndex] = { ...copy[blockIndex], items };
      return copy;
    });
  };

  const removeBlock = (index) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const addBlock = (type, extra = {}) => {
    const newBlock = {
      id: String(Date.now()),
      type,
      content: type === 'heading' ? 'New Section' : type === 'paragraph' ? '' : undefined,
      ...extra,
    };
    setBlocks([...blocks, newBlock]);
  };

  // Compile to HTML
  const generateEmailHtml = () => {
    let bodyRows = '';

    blocks.forEach((b) => {
      if (b.type === 'heading') {
        bodyRows += `<h3 style="color:#0f172a; margin-top:20px; margin-bottom:8px; border-bottom:2px solid #e2e8f0; padding-bottom:6px; font-size:16px;">${b.content || ''}</h3>`;
      } else if (b.type === 'paragraph') {
        bodyRows += `<p style="color:#334155; line-height:1.6; margin:8px 0; font-size:13px;">${(b.content || '').replace(/\n/g, '<br>')}</p>`;
      } else if (b.type === 'checklist') {
        bodyRows += '<ul style="list-style:none; padding-left:0; margin:10px 0;">';
        (b.items || []).forEach((item) => {
          const checkIcon = item.done ? '☑' : '☐';
          const textStyle = item.done ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
          bodyRows += `<li style="margin:4px 0; font-size:13px;"><span style="color:#0d7377; font-weight:bold; margin-right:6px;">${checkIcon}</span><span style="${textStyle}">${item.text}</span></li>`;
        });
        bodyRows += '</ul>';
      } else if (b.type === 'db_widget') {
        bodyRows += `<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:12px; margin:12px 0;">
          <div style="font-weight:700; color:#0d7377; font-size:12px; margin-bottom:8px; text-transform:uppercase;">📊 LIVE DATABASE: ${b.title || b.widget}</div>`;

        if (b.widget === 'tasks' && liveDbData?.tasks?.length > 0) {
          bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
          liveDbData.tasks.slice(0, 5).forEach((t) => {
            bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:500;">${t.title}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1; text-transform:uppercase;">${t.status}</td></tr>`;
          });
          bodyRows += '</table>';
        } else if (b.widget === 'models' && liveDbData?.models?.length > 0) {
          bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
          liveDbData.models.slice(0, 4).forEach((m) => {
            bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0d7377;">${m.model_name}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#0369a1;">${m.stage.toUpperCase()}</td></tr>`;
          });
          bodyRows += '</table>';
        } else if (b.widget === 'projects' && liveDbData?.projects?.length > 0) {
          bodyRows += '<table width="100%" style="font-size:12px; border-collapse:collapse;">';
          liveDbData.projects.slice(0, 4).forEach((p) => {
            bodyRows += `<tr><td style="padding:6px; border-bottom:1px solid #e2e8f0; font-weight:600;">${p.title}</td><td style="padding:6px; border-bottom:1px solid #e2e8f0; color:#10b981;">${p.progress}%</td></tr>`;
          });
          bodyRows += '</table>';
        } else {
          bodyRows += '<p style="color:#64748b; font-size:12px; margin:0;">Active database query synchronized cleanly.</p>';
        }
        bodyRows += '</div>';
      }
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px 16px; margin: 0; color: #1e293b; }
    .email-container { width: 100%; max-width: 960px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05); }
    .email-header { background: #0d7377; padding: 24px 28px; color: #ffffff; }
    .email-content { padding: 28px; }
    .email-footer { background: #f8fafc; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
    @media only screen and (max-width: 600px) {
      body { padding: 8px !important; }
      .email-header { padding: 16px !important; }
      .email-content { padding: 16px !important; }
      .email-footer { padding: 12px 14px !important; }
    }
  </style>
</head>
<body>
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table class="email-container" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 960px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <tr>
            <td class="email-header" style="background-color: #0d7377; padding: 24px 28px; color: #ffffff;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px;">SEIN PE PORTAL</span>
              <h1 style="margin: 10px 0 4px 0; font-size: 22px;">${title}</h1>
              <p style="margin: 0; font-size: 12px; opacity: 0.9;">Report Date: ${reportDate}</p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding: 28px;">
              ${bodyRows}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="background: #f8fafc; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
              Production Engineer Team Portal • PT. Samsung Electronics Indonesia
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  };

  const handleOpenPreview = () => {
    setPreviewHtml(generateEmailHtml());
    setIsPreviewOpen(true);
  };

  // Save report
  const handleSave = async (saveStatus = status) => {
    setSaving(true);
    const toList = toRecipients.split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = ccRecipients.split(',').map((s) => s.trim()).filter(Boolean);
    const html = generateEmailHtml();

    const payload = {
      title,
      report_date: reportDate,
      status: saveStatus,
      content: blocks,
      rendered_html: html,
      recipients: { to: toList, cc: ccList },
    };

    try {
      let saved;
      if (reportId) {
        const res = await api.put(`/reports/${reportId}`, payload);
        saved = res.data;
      } else {
        const res = await api.post('/reports', payload);
        saved = res.data;
        setReportId(saved.id);
      }
      showNotification('success', 'Report saved successfully');
      return saved;
    } catch (err) {
      alert(err.response?.data?.message || err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Send via SMTP
  const handleSendViaSMTP = async () => {
    setSending(true);
    try {
      const saved = await handleSave('sent');
      if (!saved) return;

      await api.post(`/reports/${saved.id}/send`);
      setStatus('sent');
      showNotification('success', 'Email sent successfully!');
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState message="Loading report editor..." />;

  return (
    <div className={styles.container}>
      {/* Top action bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/reports')}
          >
            Back to Reports
          </Button>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Status: <strong style={{ textTransform: 'uppercase', color: status === 'sent' ? 'var(--color-success)' : 'var(--color-accent)' }}>{status}</strong>
          </span>
        </div>

        <div className={styles.topBarRight}>
          <Button
            variant="outline"
            size="sm"
            icon={Sparkles}
            loading={synthesizing}
            onClick={handleSynthesizeFromDB}
            title="Auto-draft from DB tasks & projects"
          >
            RAG AI Draft
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Eye}
            onClick={handleOpenPreview}
          >
            Preview Email
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={Save}
            loading={saving}
            onClick={() => handleSave(status)}
          >
            Save Draft
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            onClick={handleSendViaSMTP}
          >
            Send Email
          </Button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor:
              notification.type === 'success'
                ? 'var(--color-success-subtle)'
                : 'var(--color-error-subtle)',
            color:
              notification.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)',
            border: `1px solid ${
              notification.type === 'success'
                ? 'var(--color-success)'
                : 'var(--color-error)'
            }`,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Document header / metadata */}
      <div className={styles.documentMetaCard}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Report Title..."
          className={styles.titleInput}
        />

        <div className={styles.metaRow}>
          <Input
            label="Report Date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />

          <EmailChipInput
            label="Recipients (To)"
            value={toRecipients}
            onChange={(val) => setToRecipients(val)}
            placeholder="Type email & press Enter or comma..."
            required
          />

          <EmailChipInput
            label="Recipients (CC)"
            value={ccRecipients}
            onChange={(val) => setCcRecipients(val)}
            placeholder="Optional CC recipients..."
          />
        </div>


        {/* Quick Action: Insert from My Email Lists */}
        {emailLists.length > 0 && (
          <div className={styles.quickActionRow}>
            <span className={styles.quickActionLabel}>
              <Users size={13} />
              Quick Recipient Groups:
            </span>
            {emailLists.map((list) => (
              <div key={list.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  className={styles.quickActionChip}
                  onClick={() => appendRecipients(list.emails, 'to')}
                  title={`Click to add into TO: ${list.emails}`}
                >
                  <Mail size={11} />
                  + To: {list.name}
                </button>
                <button
                  type="button"
                  className={styles.quickActionChip}
                  onClick={() => appendRecipients(list.emails, 'cc')}
                  style={{ opacity: 0.8 }}
                  title={`Click to add into CC: ${list.emails}`}
                >
                  + CC
                </button>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Notion-style Document Canvas */}
      <div className={styles.editorCanvas}>
        {blocks.map((block, index) => (
          <div key={block.id || index} className={styles.blockRow}>
            <div className={styles.blockActions}>
              <button
                type="button"
                className={styles.blockActionBtn}
                onClick={() => removeBlock(index)}
                title="Remove block"
              >
                <Trash2 size={13} color="var(--color-error)" />
              </button>
            </div>

            <div className={styles.blockContent}>
              {/* Heading Block */}
              {block.type === 'heading' && (
                <input
                  type="text"
                  value={block.content || ''}
                  onChange={(e) => updateBlockContent(index, e.target.value)}
                  className={styles.headingInput}
                  placeholder="Heading title..."
                />
              )}

              {/* Paragraph Block */}
              {block.type === 'paragraph' && (
                <textarea
                  value={block.content || ''}
                  onChange={(e) => updateBlockContent(index, e.target.value)}
                  className={styles.paragraphInput}
                  placeholder="Type your notes or description here..."
                />
              )}

              {/* Checklist Block */}
              {block.type === 'checklist' && (
                <div className={styles.checklist}>
                  {(block.items || []).map((item, itemIdx) => (
                    <div key={itemIdx} className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          updateChecklistItem(index, itemIdx, e.target.checked, item.text)
                        }
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          updateChecklistItem(index, itemIdx, item.done, e.target.value)
                        }
                        className={`${styles.checklistInput} ${item.done ? styles.checkedText : ''}`}
                        placeholder="Task item..."
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addChecklistItem(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '2px 0',
                    }}
                  >
                    + Add checklist item
                  </button>
                </div>
              )}

              {/* Live Database Widget Block */}
              {block.type === 'db_widget' && (
                <div className={styles.dbWidget}>
                  <div className={styles.dbWidgetHeader}>
                    <div className={styles.dbWidgetTitle}>
                      <Database size={15} />
                      Live Database: {block.title || block.widget}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      Synchronized from PostgreSQL
                    </span>
                  </div>

                  {block.widget === 'tasks' && (
                    <table className={styles.dbTable}>
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Status</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(liveDbData?.tasks || []).length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No assigned tasks</td></tr>
                        ) : (
                          (liveDbData?.tasks || []).slice(0, 5).map((t) => (
                            <tr key={t.id}>
                              <td style={{ fontWeight: 500 }}>{t.title}</td>
                              <td style={{ color: t.status === 'done' ? 'var(--color-success)' : 'var(--color-accent)', textTransform: 'uppercase' }}>
                                {t.status}
                              </td>
                              <td style={{ color: 'var(--color-text-muted)' }}>{new Date(t.updated_at).toLocaleDateString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {block.widget === 'models' && (
                    <table className={styles.dbTable}>
                      <thead>
                        <tr>
                          <th>Model Name</th>
                          <th>Codename</th>
                          <th>Development Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(liveDbData?.models || []).length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No model records</td></tr>
                        ) : (
                          (liveDbData?.models || []).slice(0, 4).map((m) => (
                            <tr key={m.id}>
                              <td style={{ fontWeight: 600 }}>{m.model_name}</td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{m.codename || '-'}</td>
                              <td style={{ color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                                {m.stage}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {block.widget === 'projects' && (
                    <table className={styles.dbTable}>
                      <thead>
                        <tr>
                          <th>Project Title</th>
                          <th>Status</th>
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(liveDbData?.projects || []).length === 0 ? (
                          <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No projects</td></tr>
                        ) : (
                          (liveDbData?.projects || []).slice(0, 4).map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{p.title}</td>
                              <td style={{ textTransform: 'uppercase' }}>{p.status}</td>
                              <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>{p.progress}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {block.widget === 'mcp_gba' && (
                    <div style={{ padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>MCP: Google Build Approval Status</span>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                        Connected to http://107.102.39.55:3800/mcp • All GBA tasks synced with release milestone.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Floating Action Card Toolbar for Insert Block (Proper Floating, No Newline) */}
        <div className={styles.floatingInsertDock}>
          <div className={styles.dockLabel}>
            <Sparkles size={13} />
            Insert Block:
          </div>
          <div className={styles.dockDivider} />

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('heading')}
          >
            <Heading size={13} />
            Heading
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('paragraph')}
          >
            <AlignLeft size={13} />
            Text
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() =>
              addBlock('checklist', {
                items: [{ text: 'New action item', done: false }],
              })
            }
          >
            <CheckSquare size={13} />
            Checklist
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'tasks', title: 'Live Assigned Tasks' })}
          >
            <Database size={13} />
            DB Tasks Table
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'models', title: 'New Model Milestones' })}
          >
            <Cpu size={13} />
            DB New Models Table
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'projects', title: 'Active Projects' })}
          >
            <Kanban size={13} />
            DB Projects Table
          </button>

          <button
            type="button"
            className={styles.dockBtn}
            onClick={() => addBlock('db_widget', { widget: 'mcp_gba', title: 'MCP Google Build Approval' })}
          >
            <Server size={13} />
            MCP GBA Integration
          </button>
        </div>
      </div>

      {/* HTML Email Preview Modal (Full View Lebar) */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="HTML Email Preview (Full View)"
        maxWidth="94vw"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Simulasi tampilan email client SEIN (Desktop & Mobile view)
            </span>
            <Button variant="primary" onClick={() => setIsPreviewOpen(false)}>
              Close Preview
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Simulated Email Envelope Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
          }}>
            <div><strong style={{ color: 'var(--color-text-secondary)' }}>From:</strong> SEIN PE Portal Robot &lt;pe-reporter@samsung.com&gt;</div>
            <div><strong style={{ color: 'var(--color-text-secondary)' }}>Date:</strong> {reportDate}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>To:</strong> {toRecipients || '-'}</div>
            {ccRecipients && <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>CC:</strong> {ccRecipients}</div>}
            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--color-text-secondary)' }}>Subject:</strong> {title}</div>
          </div>

          {/* Wide Iframe Container */}
          <div style={{
            height: '72vh',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: '#e2e8f0',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
          }}>
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              style={{ width: '100%', height: '100%', border: 'none', background: '#f1f5f9' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
