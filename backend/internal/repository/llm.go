package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type LLMRepository struct {
	pool *pgxpool.Pool
}

func NewLLMRepository(pool *pgxpool.Pool) *LLMRepository {
	return &LLMRepository{pool: pool}
}

// GetActiveLLM returns user's custom LLM if configured; otherwise falls back to portal global default
func (r *LLMRepository) GetActiveLLM(ctx context.Context, userID *uuid.UUID) (*model.LLMConfig, bool, error) {
	if userID != nil && *userID != uuid.Nil {
		var userCfg model.LLMConfig
		query := `
			SELECT id, name, provider, base_url, api_key, model_name, user_id, is_active, is_default, created_at, updated_at
			FROM llm_config
			WHERE user_id = $1 AND is_active = true
			LIMIT 1
		`
		err := r.pool.QueryRow(ctx, query, *userID).Scan(
			&userCfg.ID, &userCfg.Name, &userCfg.Provider, &userCfg.BaseURL, &userCfg.APIKey,
			&userCfg.ModelName, &userCfg.UserID, &userCfg.IsActive, &userCfg.IsDefault,
			&userCfg.CreatedAt, &userCfg.UpdatedAt,
		)
		if err == nil {
			return &userCfg, true, nil // true = is personal custom
		}
	}

	// Fallback to Portal Global Default
	var defaultCfg model.LLMConfig
	query := `
		SELECT id, name, provider, base_url, api_key, model_name, user_id, is_active, is_default, created_at, updated_at
		FROM llm_config
		WHERE user_id IS NULL AND is_default = true
		LIMIT 1
	`
	err := r.pool.QueryRow(ctx, query).Scan(
		&defaultCfg.ID, &defaultCfg.Name, &defaultCfg.Provider, &defaultCfg.BaseURL, &defaultCfg.APIKey,
		&defaultCfg.ModelName, &defaultCfg.UserID, &defaultCfg.IsActive, &defaultCfg.IsDefault,
		&defaultCfg.CreatedAt, &defaultCfg.UpdatedAt,
	)
	if err != nil {
		return nil, false, err
	}
	return &defaultCfg, false, nil // false = is portal global
}

// SavePortalLLM updates or inserts the portal global default configuration
func (r *LLMRepository) SavePortalLLM(ctx context.Context, cfg *model.LLMConfig) (*model.LLMConfig, error) {
	query := `
		UPDATE llm_config
		SET name = $1, provider = $2, base_url = $3, api_key = $4, model_name = $5, is_active = $6, updated_at = NOW()
		WHERE user_id IS NULL AND is_default = true
		RETURNING id, name, provider, base_url, api_key, model_name, user_id, is_active, is_default, created_at, updated_at
	`
	var saved model.LLMConfig
	err := r.pool.QueryRow(ctx, query,
		cfg.Name, cfg.Provider, cfg.BaseURL, cfg.APIKey, cfg.ModelName, cfg.IsActive,
	).Scan(
		&saved.ID, &saved.Name, &saved.Provider, &saved.BaseURL, &saved.APIKey,
		&saved.ModelName, &saved.UserID, &saved.IsActive, &saved.IsDefault,
		&saved.CreatedAt, &saved.UpdatedAt,
	)
	if err != nil {
		// Insert if not exists
		insertQuery := `
			INSERT INTO llm_config (name, provider, base_url, api_key, model_name, is_active, is_default)
			VALUES ($1, $2, $3, $4, $5, $6, true)
			RETURNING id, name, provider, base_url, api_key, model_name, user_id, is_active, is_default, created_at, updated_at
		`
		err = r.pool.QueryRow(ctx, insertQuery,
			cfg.Name, cfg.Provider, cfg.BaseURL, cfg.APIKey, cfg.ModelName, cfg.IsActive,
		).Scan(
			&saved.ID, &saved.Name, &saved.Provider, &saved.BaseURL, &saved.APIKey,
			&saved.ModelName, &saved.UserID, &saved.IsActive, &saved.IsDefault,
			&saved.CreatedAt, &saved.UpdatedAt,
		)
	}
	return &saved, err
}

// SaveUserLLM saves a custom personal LLM API configuration for this specific member
func (r *LLMRepository) SaveUserLLM(ctx context.Context, userID uuid.UUID, cfg *model.LLMConfig) (*model.LLMConfig, error) {
	// Delete any existing user override first for simplicity
	_, _ = r.pool.Exec(ctx, "DELETE FROM llm_config WHERE user_id = $1", userID)

	insertQuery := `
		INSERT INTO llm_config (name, provider, base_url, api_key, model_name, user_id, is_active, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7, false)
		RETURNING id, name, provider, base_url, api_key, model_name, user_id, is_active, is_default, created_at, updated_at
	`
	var saved model.LLMConfig
	err := r.pool.QueryRow(ctx, insertQuery,
		cfg.Name, cfg.Provider, cfg.BaseURL, cfg.APIKey, cfg.ModelName, userID, cfg.IsActive,
	).Scan(
		&saved.ID, &saved.Name, &saved.Provider, &saved.BaseURL, &saved.APIKey,
		&saved.ModelName, &saved.UserID, &saved.IsActive, &saved.IsDefault,
		&saved.CreatedAt, &saved.UpdatedAt,
	)
	return &saved, err
}

// DeleteUserLLM removes personal custom configuration so user reverts to portal global default
func (r *LLMRepository) DeleteUserLLM(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM llm_config WHERE user_id = $1", userID)
	return err
}
