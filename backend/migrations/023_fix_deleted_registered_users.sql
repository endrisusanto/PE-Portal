-- 023_fix_deleted_registered_users.sql
-- Ensure any re-registered or active users with leftover deleted_at timestamps are restored and made active

UPDATE users 
SET deleted_at = NULL, is_active = true 
WHERE deleted_at IS NOT NULL;
