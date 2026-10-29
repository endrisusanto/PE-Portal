package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type NewModelRepository struct {
	pool *pgxpool.Pool
}

func NewNewModelRepository(pool *pgxpool.Pool) *NewModelRepository {
	return &NewModelRepository{pool: pool}
}

func (r *NewModelRepository) List(ctx context.Context, stage string) ([]model.NewModel, error) {
	query := `
		SELECT m.id, m.model_name, m.marketing_name, m.codename, COALESCE(m.basic_models, '[]'::jsonb),
		       m.stage, m.description, m.project_id, m.owner_id, u.full_name as owner_name,
		       m.target_release::text, m.specifications, m.is_active, m.sort_order,
		       m.created_at, m.updated_at
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		WHERE m.deleted_at IS NULL
		  AND ($1 = '' OR m.stage = $1)
		ORDER BY m.sort_order ASC, m.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, stage)
	if err != nil {
		return nil, fmt.Errorf("failed to list new models: %w", err)
	}
	defer rows.Close()

	items := []model.NewModel{}
	for rows.Next() {
		var m model.NewModel
		err := rows.Scan(
			&m.ID, &m.ModelName, &m.MarketingName, &m.Codename, &m.BasicModels,
			&m.Stage, &m.Description, &m.ProjectID, &m.OwnerID, &m.OwnerName,
			&m.TargetRelease, &m.Specifications, &m.IsActive, &m.SortOrder,
			&m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, nil
}

func (r *NewModelRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.NewModel, error) {
	query := `
		SELECT m.id, m.model_name, m.marketing_name, m.codename, COALESCE(m.basic_models, '[]'::jsonb),
		       m.stage, m.description, m.project_id, m.owner_id, u.full_name as owner_name,
		       m.target_release::text, m.specifications, m.is_active, m.sort_order,
		       m.created_at, m.updated_at
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		WHERE m.id = $1 AND m.deleted_at IS NULL
	`

	var m model.NewModel
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.ModelName, &m.MarketingName, &m.Codename, &m.BasicModels,
		&m.Stage, &m.Description, &m.ProjectID, &m.OwnerID, &m.OwnerName,
		&m.TargetRelease, &m.Specifications, &m.IsActive, &m.SortOrder,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *NewModelRepository) Create(ctx context.Context, m *model.NewModel) (*model.NewModel, error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Stage == "" {
		m.Stage = "concept"
	}
	if len(m.Specifications) == 0 {
		m.Specifications = json.RawMessage("{}")
	}
	if len(m.BasicModels) == 0 {
		m.BasicModels = json.RawMessage("[]")
	}

	var targetRelease string
	if m.TargetRelease != nil {
		targetRelease = *m.TargetRelease
	}

	query := `
		INSERT INTO new_models (id, model_name, marketing_name, codename, basic_models, stage, description, project_id, owner_id, target_release, specifications, is_active, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, '')::date, $11, $12, $13)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		m.ID, m.ModelName, m.MarketingName, m.Codename, m.BasicModels,
		m.Stage, m.Description, m.ProjectID, m.OwnerID, targetRelease,
		m.Specifications, m.IsActive, m.SortOrder,
	).Scan(&m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create new model: %w", err)
	}

	// Record initial stage history entry
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO new_model_stages (model_id, stage, status, started_at)
		VALUES ($1, $2, 'in_progress', NOW())
	`, m.ID, m.Stage)

	// Seed default milestone template for this model
	_ = r.SeedDefaultMilestones(ctx, m.ID)

	return r.GetByID(ctx, m.ID)
}

func (r *NewModelRepository) Update(ctx context.Context, m *model.NewModel) (*model.NewModel, error) {
	var targetRelease string
	if m.TargetRelease != nil {
		targetRelease = *m.TargetRelease
	}

	var specParam any = nil
	if len(m.Specifications) > 0 && string(m.Specifications) != "null" {
		specParam = m.Specifications
	}

	var basicModelsParam any = nil
	if len(m.BasicModels) > 0 && string(m.BasicModels) != "null" {
		basicModelsParam = m.BasicModels
	}

	query := `
		UPDATE new_models
		SET model_name = $1,
		    marketing_name = COALESCE($2, marketing_name),
		    codename = $3,
		    basic_models = COALESCE($4::jsonb, basic_models),
		    description = $5,
		    project_id = $6,
		    owner_id = COALESCE($7, owner_id),
		    target_release = NULLIF($8, '')::date,
		    specifications = COALESCE($9::jsonb, specifications),
		    is_active = COALESCE($10, is_active),
		    sort_order = COALESCE($11, sort_order),
		    updated_at = NOW()
		WHERE id = $12 AND deleted_at IS NULL
	`

	_, err := r.pool.Exec(ctx, query,
		m.ModelName, m.MarketingName, m.Codename, basicModelsParam, m.Description,
		m.ProjectID, m.OwnerID, targetRelease, specParam, m.IsActive, m.SortOrder, m.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, m.ID)
}

// Stages
func (r *NewModelRepository) ListStages(ctx context.Context, modelID uuid.UUID) ([]model.NewModelStage, error) {
	query := `
		SELECT s.id, s.model_id, s.stage, s.status, s.started_at, s.completed_at,
		       s.notes, s.approved_by, u.full_name as approver_name,
		       COALESCE(s.attachments, '[]'::jsonb) as attachments, s.created_at
		FROM new_model_stages s
		LEFT JOIN users u ON s.approved_by = u.id
		WHERE s.model_id = $1
		ORDER BY s.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := []model.NewModelStage{}
	for rows.Next() {
		var s model.NewModelStage
		err := rows.Scan(
			&s.ID, &s.ModelID, &s.Stage, &s.Status, &s.StartedAt, &s.CompletedAt,
			&s.Notes, &s.ApprovedBy, &s.ApproverName, &s.Attachments, &s.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		stages = append(stages, s)
	}
	return stages, nil
}

func (r *NewModelRepository) AdvanceStage(ctx context.Context, modelID uuid.UUID, newStage, notes string, attachments json.RawMessage, approverID *uuid.UUID) error {
	now := time.Now()
	if len(attachments) == 0 {
		attachments = json.RawMessage("[]")
	}

	// Complete current stage
	_, _ = r.pool.Exec(ctx, `
		UPDATE new_model_stages
		SET status = 'completed', completed_at = $1
		WHERE model_id = $2 AND status = 'in_progress'
	`, now, modelID)

	// Add new stage
	_, err := r.pool.Exec(ctx, `
		INSERT INTO new_model_stages (model_id, stage, status, started_at, notes, attachments, approved_by)
		VALUES ($1, $2, 'in_progress', $3, $4, $5, $6)
	`, modelID, newStage, now, notes, attachments, approverID)
	if err != nil {
		return err
	}

	// Update current stage on model
	_, err = r.pool.Exec(ctx, `
		UPDATE new_models SET stage = $1, updated_at = $2 WHERE id = $3
	`, newStage, now, modelID)

	return err
}

func (r *NewModelRepository) UpdateCurrentStage(ctx context.Context, modelID uuid.UUID, notes string, attachments json.RawMessage, approverID *uuid.UUID) error {
	if len(attachments) == 0 {
		attachments = json.RawMessage("[]")
	}

	// Check if in_progress stage exists
	var stageID uuid.UUID
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM new_model_stages WHERE model_id = $1 AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1
	`, modelID).Scan(&stageID)
	if err == nil {
		_, err = r.pool.Exec(ctx, `
			UPDATE new_model_stages
			SET notes = $1, attachments = $2, approved_by = COALESCE($3, approved_by)
			WHERE id = $4
		`, notes, attachments, approverID, stageID)
		return err
	}

	// If not found, create an in_progress stage with model's current stage
	_, err = r.pool.Exec(ctx, `
		INSERT INTO new_model_stages (model_id, stage, status, started_at, notes, attachments, approved_by)
		SELECT id, stage, 'in_progress', NOW(), $1, $2, $3
		FROM new_models WHERE id = $4
	`, notes, attachments, approverID, modelID)
	return err
}

func (r *NewModelRepository) UpdateStageByID(ctx context.Context, stageID uuid.UUID, notes string, attachments json.RawMessage, approverID *uuid.UUID) error {
	if len(attachments) == 0 {
		attachments = json.RawMessage("[]")
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE new_model_stages
		SET notes = $1, attachments = $2, approved_by = COALESCE($3, approved_by)
		WHERE id = $4
	`, notes, attachments, approverID, stageID)
	return err
}

func (r *NewModelRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE new_models SET deleted_at = NOW() WHERE id = $1`, id)
	return err
}

// Milestone Templates definitions
type MilestoneDef struct {
	Category     string
	SubCategory  string
	MilestoneKey string
	Label        string
	SortOrder    int
}

var DefaultMilestoneDefs = []MilestoneDef{
	{Category: "gating", SubCategory: "Gating", MilestoneKey: "pvr_basic", Label: "PVR (BASIC)", SortOrder: 10},
	{Category: "gating", SubCategory: "Gating", MilestoneKey: "pra_sea", Label: "PRA (SEA)", SortOrder: 20},
	{Category: "gating", SubCategory: "Gating", MilestoneKey: "sra_sea", Label: "SRA (SEA)", SortOrder: 30},

	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "lqv_subline", Label: "Subline", SortOrder: 40},
	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "lqv_smd_sec", Label: "SMD Secondary", SortOrder: 50},
	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "lqv_smd_main", Label: "SMD Main", SortOrder: 60},
	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "lqv_assembly", Label: "Assembly", SortOrder: 70},
	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "lqv_inspection", Label: "Inspection", SortOrder: 80},
	{Category: "lqv", SubCategory: "LQV", MilestoneKey: "progress_prep_lqv", Label: "Progress Preparation LQV", SortOrder: 85},

	{Category: "lqva_mp", SubCategory: "LQVA", MilestoneKey: "lqva", Label: "LQVA", SortOrder: 90},
	{Category: "lqva_mp", SubCategory: "MP Plan", MilestoneKey: "mp_sop", Label: "MP (Base on SOP Plan)", SortOrder: 100},

	{Category: "bom", SubCategory: "BOM", MilestoneKey: "bom_hq", Label: "HQ", SortOrder: 110},
	{Category: "bom", SubCategory: "BOM", MilestoneKey: "bom_sein", Label: "SEIN", SortOrder: 120},

	{Category: "sample", SubCategory: "Sample", MilestoneKey: "sample_tkdn_bom", Label: "TKDN/BOM", SortOrder: 130},
	{Category: "sample", SubCategory: "Sample", MilestoneKey: "sample_std_oqc", Label: "STD OQC", SortOrder: 140},
	{Category: "sample", SubCategory: "Sample", MilestoneKey: "sample_std_main", Label: "STD Main", SortOrder: 150},
	{Category: "sample", SubCategory: "Sample", MilestoneKey: "sample_disassembly", Label: "Disassembly", SortOrder: 160},

	{Category: "eng_verify", SubCategory: "Engineering Verify", MilestoneKey: "working_spec_register", Label: "Working Spec Register", SortOrder: 170},
	{Category: "eng_verify", SubCategory: "Engineering Verify", MilestoneKey: "sw_confirm_verify", Label: "S/W confirm & verify", SortOrder: 180},
	{Category: "eng_verify", SubCategory: "Engineering Verify", MilestoneKey: "pgm_verify", Label: "PGM verify", SortOrder: 190},

	{Category: "jig", SubCategory: "JIG Status", MilestoneKey: "jig_list", Label: "Jig List", SortOrder: 200},
	{Category: "jig", SubCategory: "JIG Status", MilestoneKey: "jig_pr_po", Label: "JIG PR & PO", SortOrder: 210},
	{Category: "jig", SubCategory: "JIG Status", MilestoneKey: "jig_eta", Label: "JIG ETA", SortOrder: 220},
	{Category: "jig", SubCategory: "JIG Status", MilestoneKey: "jig_verify", Label: "JIG Verify", SortOrder: 230},

	{Category: "equipment", SubCategory: "Equipment & Cable", MilestoneKey: "cable_list", Label: "Cable List", SortOrder: 240},
	{Category: "equipment", SubCategory: "Equipment & Cable", MilestoneKey: "cable_pr_po", Label: "Cable PR & PO", SortOrder: 250},
	{Category: "equipment", SubCategory: "Equipment & Cable", MilestoneKey: "cable_eta", Label: "Cable ETA", SortOrder: 260},

	{Category: "local_part", SubCategory: "Local Part Approval", MilestoneKey: "part_drawing", Label: "Drawing data", SortOrder: 270},
	{Category: "local_part", SubCategory: "Local Part Approval", MilestoneKey: "part_bidding", Label: "Bidding", SortOrder: 280},
	{Category: "local_part", SubCategory: "Local Part Approval", MilestoneKey: "part_sample", Label: "Sample", SortOrder: 290},
	{Category: "local_part", SubCategory: "Local Part Approval", MilestoneKey: "part_iqc", Label: "IQC Test", SortOrder: 300},
	{Category: "local_part", SubCategory: "Local Part Approval", MilestoneKey: "part_approval", Label: "Approval", SortOrder: 310},

	{Category: "cert", SubCategory: "Certification & Docs", MilestoneKey: "tkdn_approved", Label: "TKDN Approved", SortOrder: 320},
	{Category: "cert", SubCategory: "Certification & Docs", MilestoneKey: "tkdn_value", Label: "TKDN Value", SortOrder: 330},
	{Category: "cert", SubCategory: "Certification & Docs", MilestoneKey: "postel_approved", Label: "Postel Approved", SortOrder: 340},
	{Category: "cert", SubCategory: "Certification & Docs", MilestoneKey: "mkg_approved", Label: "MKG (Manual & Kartu Garansi)", SortOrder: 350},

	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_bonding", Label: "Bonding", SortOrder: 360},
	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_wpt_bonding", Label: "WPT Bonding", SortOrder: 370},
	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_octa_pad", Label: "Octa Pad", SortOrder: 380},
	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_act", Label: "ACT", SortOrder: 390},
	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_final_insp", Label: "Final Inspection", SortOrder: 400},
	{Category: "special_process", SubCategory: "Special Process", MilestoneKey: "sp_waterproof", Label: "Waterproof", SortOrder: 410},
}

// SeedDefaultMilestones inserts default items for a model if missing
func (r *NewModelRepository) SeedDefaultMilestones(ctx context.Context, modelID uuid.UUID) error {
	query := `
		INSERT INTO new_model_milestones (
			model_id, variant_code, category, sub_category, milestone_key, label, sort_order
		) VALUES ($1, '', $2, $3, $4, $5, $6)
		ON CONFLICT (model_id, milestone_key, variant_code) DO NOTHING
	`
	for _, def := range DefaultMilestoneDefs {
		_, _ = r.pool.Exec(ctx, query, modelID, def.Category, def.SubCategory, def.MilestoneKey, def.Label, def.SortOrder)
	}
	return nil
}

// ponytail: fast single-query schedule loader for calendar & matrix integration
func (r *NewModelRepository) ListScheduledMilestones(ctx context.Context) ([]model.NewModelMilestone, error) {
	query := `
		SELECT m.id, m.model_id, nm.model_name, nm.codename, COALESCE(m.variant_code, ''), 
		       m.category, m.sub_category, m.milestone_key, m.label,
		       COALESCE(m.plan_value, ''), COALESCE(m.actual_value, ''), m.status, m.sort_order,
		       m.target_date::text, m.actual_date::text, m.notes, COALESCE(m.attachments, '[]'::jsonb),
		       m.updated_by, u.full_name as updater_name, m.created_at, m.updated_at
		FROM new_model_milestones m
		JOIN new_models nm ON m.model_id = nm.id
		LEFT JOIN users u ON m.updated_by = u.id
		WHERE nm.deleted_at IS NULL
		  AND (
		    (m.plan_value IS NOT NULL AND m.plan_value != '' AND m.plan_value != '-' AND m.plan_value != 'N/A' AND m.plan_value != 'TBD')
		    OR m.target_date IS NOT NULL
		  )
		ORDER BY m.target_date ASC NULLS LAST, m.sort_order ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list scheduled milestones: %w", err)
	}
	defer rows.Close()

	items := []model.NewModelMilestone{}
	for rows.Next() {
		var item model.NewModelMilestone
		err := rows.Scan(
			&item.ID, &item.ModelID, &item.ModelName, &item.Codename, &item.VariantCode,
			&item.Category, &item.SubCategory, &item.MilestoneKey, &item.Label,
			&item.PlanValue, &item.ActualValue, &item.Status, &item.SortOrder,
			&item.TargetDate, &item.ActualDate, &item.Notes, &item.Attachments,
			&item.UpdatedBy, &item.UpdaterName, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// ListMilestones returns milestones for a specific model
func (r *NewModelRepository) ListMilestones(ctx context.Context, modelID uuid.UUID) ([]model.NewModelMilestone, error) {
	// Auto seed if empty
	var count int
	_ = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM new_model_milestones WHERE model_id = $1", modelID).Scan(&count)
	if count == 0 {
		_ = r.SeedDefaultMilestones(ctx, modelID)
	}

	query := `
		SELECT m.id, m.model_id, COALESCE(m.variant_code, ''), m.category, m.sub_category, m.milestone_key, m.label,
		       COALESCE(m.plan_value, ''), COALESCE(m.actual_value, ''), m.status, m.sort_order,
		       m.target_date::text, m.actual_date::text, m.notes, COALESCE(m.attachments, '[]'::jsonb), m.updated_by, u.full_name as updater_name,
		       m.created_at, m.updated_at
		FROM new_model_milestones m
		LEFT JOIN users u ON m.updated_by = u.id
		WHERE m.model_id = $1
		ORDER BY m.sort_order ASC, m.variant_code ASC, m.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []model.NewModelMilestone{}
	for rows.Next() {
		var item model.NewModelMilestone
		err := rows.Scan(
			&item.ID, &item.ModelID, &item.VariantCode, &item.Category, &item.SubCategory, &item.MilestoneKey, &item.Label,
			&item.PlanValue, &item.ActualValue, &item.Status, &item.SortOrder,
			&item.TargetDate, &item.ActualDate, &item.Notes, &item.Attachments, &item.UpdatedBy, &item.UpdaterName,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func sanitizeMilestoneDate(d string) string {
	d = strings.TrimSpace(d)
	if d == "" {
		return ""
	}
	// Try YYYY-MM-DD
	if t, err := time.Parse("2006-01-02", d); err == nil {
		return t.Format("2006-01-02")
	}
	// Try DD-Mon-YYYY or DD-Mon
	if t, err := time.Parse("02-Jan-2006", d); err == nil {
		return t.Format("2006-01-02")
	}
	if t, err := time.Parse("2-Jan-2006", d); err == nil {
		return t.Format("2006-01-02")
	}
	nowYear := time.Now().Year()
	if t, err := time.Parse("02-Jan", d); err == nil {
		return fmt.Sprintf("%04d-%02d-%02d", nowYear, t.Month(), t.Day())
	}
	if t, err := time.Parse("2-Jan", d); err == nil {
		return fmt.Sprintf("%04d-%02d-%02d", nowYear, t.Month(), t.Day())
	}
	return ""
}

// UpsertMilestone updates or inserts a single milestone cell
func (r *NewModelRepository) UpsertMilestone(ctx context.Context, item *model.NewModelMilestone) error {
	query := `
		INSERT INTO new_model_milestones (
			model_id, variant_code, category, sub_category, milestone_key, label,
			plan_value, actual_value, status, sort_order, target_date, actual_date, notes, attachments, updated_by, updated_at
		) VALUES (
			$1, COALESCE($2, ''), $3, $4, $5, $6,
			$7, $8, $9, $10, NULLIF($11, '')::date, NULLIF($12, '')::date, $13, COALESCE($14, '[]'::jsonb), $15, NOW()
		)
		ON CONFLICT (model_id, milestone_key, variant_code) DO UPDATE SET
			plan_value = EXCLUDED.plan_value,
			actual_value = EXCLUDED.actual_value,
			status = EXCLUDED.status,
			target_date = EXCLUDED.target_date,
			actual_date = EXCLUDED.actual_date,
			notes = COALESCE(EXCLUDED.notes, new_model_milestones.notes),
			attachments = COALESCE(EXCLUDED.attachments, new_model_milestones.attachments),
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
	`
	var targetDate, actualDate string
	if item.TargetDate != nil {
		targetDate = sanitizeMilestoneDate(*item.TargetDate)
	}
	if item.ActualDate != nil {
		actualDate = sanitizeMilestoneDate(*item.ActualDate)
	}

	attachments := item.Attachments
	if len(attachments) == 0 {
		attachments = []byte("[]")
	}

	_, err := r.pool.Exec(ctx, query,
		item.ModelID, item.VariantCode, item.Category, item.SubCategory, item.MilestoneKey, item.Label,
		item.PlanValue, item.ActualValue, item.Status, item.SortOrder,
		targetDate, actualDate, item.Notes, attachments, item.UpdatedBy,
	)
	return err
}

// BatchUpsertMilestones updates multiple milestones at once
func (r *NewModelRepository) BatchUpsertMilestones(ctx context.Context, modelID uuid.UUID, items []model.NewModelMilestone, userID *uuid.UUID) error {
	for _, item := range items {
		item.ModelID = modelID
		item.UpdatedBy = userID
		if err := r.UpsertMilestone(ctx, &item); err != nil {
			return err
		}
	}
	return nil
}
