-- 018_article_status.sql
-- Add status column to imei_articles for Draft / Published visibility control

ALTER TABLE imei_articles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';
CREATE INDEX IF NOT EXISTS idx_imei_articles_status ON imei_articles(status);
