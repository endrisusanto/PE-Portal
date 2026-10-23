-- Migration 017: Multi-group part support for users (multiple jobdesk)
CREATE TABLE IF NOT EXISTS user_group_parts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_part_id UUID NOT NULL REFERENCES group_parts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, group_part_id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_parts_user ON user_group_parts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_parts_group ON user_group_parts(group_part_id);

-- Backfill existing single group_part_id into user_group_parts
INSERT INTO user_group_parts (user_id, group_part_id)
SELECT id, group_part_id FROM users
WHERE group_part_id IS NOT NULL
ON CONFLICT (user_id, group_part_id) DO NOTHING;
