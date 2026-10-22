-- ============================================================================
-- PE-Portal Initial Database Schema
-- Migration: 001_init.sql
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector extension for RAG search (graceful fallback if not installed)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    NULL;
END
$$;

-- 1. Auth providers configuration
CREATE TABLE IF NOT EXISTS auth_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL DEFAULT 'local', -- local, ldap
    ldap_host VARCHAR(255),
    ldap_port INT DEFAULT 389,
    ldap_base_dn VARCHAR(255),
    ldap_bind_dn VARCHAR(255),
    ldap_bind_password VARCHAR(255),
    ldap_user_filter VARCHAR(255) DEFAULT '(sAMAccountName=%s)',
    ldap_use_tls BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization structure (Group Parts)
CREATE TABLE IF NOT EXISTS group_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    parent_group VARCHAR(50) NOT NULL, -- pe_production, pe_mecha, pe_solution
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),          -- NULL when LDAP-only
    full_name VARCHAR(100) NOT NULL,
    avatar_path VARCHAR(500),
    preferred_lang VARCHAR(5) DEFAULT 'en',
    group_part_id UUID REFERENCES group_parts(id) ON DELETE SET NULL,
    role VARCHAR(20) DEFAULT 'member',   -- admin, manager, member
    auth_provider VARCHAR(20) DEFAULT 'local',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. Innovations & Best Practices
CREATE TABLE IF NOT EXISTS innovations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL,       -- innovation, best_practice
    status VARCHAR(20) DEFAULT 'draft',  -- draft, review, approved, implemented
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_part_id UUID REFERENCES group_parts(id) ON DELETE SET NULL,
    impact_score INT CHECK (impact_score BETWEEN 1 AND 5),
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(30) NOT NULL,   -- development, new_model, internal
    status VARCHAR(20) DEFAULT 'planning', -- planning, in_progress, review, completed, on_hold
    priority VARCHAR(10) DEFAULT 'medium', -- low, medium, high, urgent
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_part_id UUID REFERENCES group_parts(id) ON DELETE SET NULL,
    start_date DATE,
    target_date DATE,
    completion_date DATE,
    progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- lead, member
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Project Tasks
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'todo', -- todo, in_progress, review, done
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. New Model Development
CREATE TABLE IF NOT EXISTS new_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,     -- e.g. "S26 Series"
    codename VARCHAR(100),                -- e.g. "Paradigm"
    stage VARCHAR(30) DEFAULT 'concept',  -- concept, design, prototype, evt, dvt, pvt, mp, released
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_release DATE,
    specifications JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS new_model_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES new_models(id) ON DELETE CASCADE,
    stage VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, blocked
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. IMEI Management (article-based notes per model project)
CREATE TABLE IF NOT EXISTS imei_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,                          -- markdown / notes
    model_id UUID REFERENCES new_models(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. Documents / File Archive
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type VARCHAR(10) NOT NULL,       -- pdf, docx, xlsx, pptx, csv, txt, img
    category VARCHAR(50),
    tags JSONB DEFAULT '[]',
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    group_part_id UUID REFERENCES group_parts(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    model_id UUID REFERENCES new_models(id) ON DELETE SET NULL,
    version INT DEFAULT 1,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 9. Comments (full UTF-8 with emoji + reactions)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    entity_type VARCHAR(30) NOT NULL,     -- innovation, project, task, document, model, imei_article
    entity_id UUID NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    reactions JSONB DEFAULT '{}',         -- e.g. {"👍":["user-uuid-1"], "🔥":["user-uuid-2"]}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. MCP Server Registry
CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    auth_type VARCHAR(20) DEFAULT 'none', -- none, bearer, api_key
    auth_token VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    health_status VARCHAR(20) DEFAULT 'unknown', -- healthy, unhealthy, unknown
    last_health_check TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Document Embeddings (RAG)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS document_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INT NOT NULL,
            chunk_text TEXT NOT NULL,
            embedding vector(1536),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )';
    ELSE
        EXECUTE 'CREATE TABLE IF NOT EXISTS document_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INT NOT NULL,
            chunk_text TEXT NOT NULL,
            embedding TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )';
    END IF;
END
$$;

-- 12. Chat Sessions & Messages
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL,           -- user, assistant, system
    content TEXT NOT NULL,
    context_docs JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. LLM Provider Configurations
CREATE TABLE IF NOT EXISTS llm_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,        -- openai, gemini, claude
    api_key VARCHAR(500) NOT NULL,
    model_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,          -- e.g. user.login, project.create, model.stage_change
    entity_type VARCHAR(30),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_part_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_innovations_status ON innovations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_innovations_author ON innovations(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(file_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_group ON documents(group_part_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_new_models_stage ON new_models(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_imei_articles_model ON imei_articles(model_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_embeddings_doc ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
