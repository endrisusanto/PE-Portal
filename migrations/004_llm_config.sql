-- Migration: 004_llm_config.sql
-- Description: Update llm_config table with name, base_url, user_id and seed LM Studio OpenAI-compatible endpoint

ALTER TABLE llm_config ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT 'LM Studio';
ALTER TABLE llm_config ADD COLUMN IF NOT EXISTS base_url VARCHAR(500) DEFAULT 'https://lmstudio.endrisusanto.my.id/v1';
ALTER TABLE llm_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Clear and insert active default LM Studio configuration
DELETE FROM llm_config WHERE user_id IS NULL;

INSERT INTO llm_config (name, provider, base_url, api_key, model_name, is_active, is_default)
VALUES (
    'LM Studio',
    'openai-compatible',
    'https://lmstudio.endrisusanto.my.id/v1',
    'lm-studio',
    'google/gemma-4-e4b',
    true,
    true
);
