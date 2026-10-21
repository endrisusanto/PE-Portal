-- Migration: 003_reports_smtp.sql
-- Description: Tables for SMTP configuration, report templates, digital reports, automated scheduling, and send logs

CREATE TABLE IF NOT EXISTS smtp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 587,
    username VARCHAR(255) NOT NULL DEFAULT '',
    password VARCHAR(255) NOT NULL DEFAULT '',
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) NOT NULL DEFAULT 'SEIN PE Portal',
    encryption VARCHAR(20) NOT NULL DEFAULT 'tls', -- 'tls', 'ssl', 'none'
    is_default BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'project', 'custom'
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_part_id UUID REFERENCES group_parts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS digital_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'sent'
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    rendered_html TEXT NOT NULL DEFAULT '',
    recipients JSONB NOT NULL DEFAULT '{"to":[],"cc":[]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    smtp_config_id UUID REFERENCES smtp_configs(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL DEFAULT '0 17 * * 1-5', -- Every workday at 17:00
    recipients JSONB NOT NULL DEFAULT '{"to":[],"cc":[]}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status VARCHAR(50) DEFAULT 'pending',
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
    report_id UUID REFERENCES digital_reports(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial default SMTP config template
INSERT INTO smtp_configs (name, host, port, username, password, from_email, from_name, encryption, is_default)
SELECT 'Corporate SEIN Mail Gateway', 'smtp.sein.corp.local', 587, 'pe-reporter@sein.corp.local', 'sein_pe_smtp_pass', 'pe-reporter@samsung.com', 'SEIN PE Portal Robot', 'tls', true
WHERE NOT EXISTS (SELECT 1 FROM smtp_configs WHERE name = 'Corporate SEIN Mail Gateway');

-- Seed default shared report templates
INSERT INTO report_templates (title, description, category, is_shared, content)
SELECT
  'Daily Engineering Work Report',
  'Standard daily reporting template for Production Engineers with live task list and blocker highlights',
  'daily',
  true,
  '[
    {"type": "heading", "content": "1. Daily Activity Summary"},
    {"type": "paragraph", "content": "Summarize key technical tasks and support provided today across production lines."},
    {"type": "db_widget", "widget": "tasks", "title": "Today Completed & In-Progress Tasks"},
    {"type": "heading", "content": "2. Production & JIG Status"},
    {"type": "paragraph", "content": "Status of JIG development, BOM checks, or IMEI flashing parameters."},
    {"type": "heading", "content": "3. Blockers / Technical Issues"},
    {"type": "checklist", "items": [{"text": "Verify new firmware package stability", "done": true}, {"text": "Escalate sensor calibration offset to R&D", "done": false}]},
    {"type": "heading", "content": "4. Tomorrow Plan"},
    {"type": "paragraph", "content": "Planned activities and production support schedule for tomorrow."}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE title = 'Daily Engineering Work Report');

INSERT INTO report_templates (title, description, category, is_shared, content)
SELECT
  'Weekly Project & Model Progress Report',
  'Weekly progress overview for Project Owners and Model Engineers',
  'weekly',
  true,
  '[
    {"type": "heading", "content": "1. Weekly Executive Summary"},
    {"type": "paragraph", "content": "High-level summary of model milestones achieved this week."},
    {"type": "db_widget", "widget": "models", "title": "New Model Development Stages"},
    {"type": "db_widget", "widget": "projects", "title": "Active Projects Status"},
    {"type": "heading", "content": "2. Key Innovations & BP Deployed"},
    {"type": "paragraph", "content": "List of best practices implemented on the line this week."},
    {"type": "heading", "content": "3. Risk Assessment & Support Needed"},
    {"type": "paragraph", "content": "Identified bottlenecks requiring management assistance."}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE title = 'Weekly Project & Model Progress Report');
