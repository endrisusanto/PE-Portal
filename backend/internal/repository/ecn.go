package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type ECNRepository struct {
	pool *pgxpool.Pool
}

func NewECNRepository(pool *pgxpool.Pool) *ECNRepository {
	return &ECNRepository{pool: pool}
}

// List returns filtered and paginated ECN records
func (r *ECNRepository) List(ctx context.Context, q model.ECNListQuery) (*model.ECNListResponse, error) {
	if q.Limit <= 0 || q.Limit > 500 {
		q.Limit = 50
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.Limit

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if q.Search != "" {
		s := "%" + strings.ToLower(q.Search) + "%"
		where = append(where, fmt.Sprintf(`(
			LOWER(ecn_no) LIKE $%d OR 
			LOWER(model) LIKE $%d OR 
			LOWER(ec_title) LIKE $%d OR 
			LOWER(remark) LIKE $%d OR 
			LOWER(parent_code) LIKE $%d OR 
			LOWER(child_code) LIKE $%d
		)`, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	if q.Model != "" {
		where = append(where, fmt.Sprintf("LOWER(model) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(q.Model)+"%")
		argIdx++
	}

	if q.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Process != "" {
		where = append(where, fmt.Sprintf("process = $%d", argIdx))
		args = append(args, q.Process)
		argIdx++
	}

	if q.FunctionType != "" {
		where = append(where, fmt.Sprintf("function_type = $%d", argIdx))
		args = append(args, q.FunctionType)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM ecn_records WHERE %s", whereClause)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count ecn records: %w", err)
	}

	// Order by
	sortCol := "created_at"
	switch q.SortBy {
	case "ecn_no":
		sortCol = "ecn_no"
	case "model":
		sortCol = "model"
	case "function_type":
		sortCol = "function_type"
	case "purpose":
		sortCol = "purpose"
	case "status":
		sortCol = "status"
	case "process":
		sortCol = "process"
	case "ec_title":
		sortCol = "ec_title"
	case "child_code":
		sortCol = "child_code"
	case "child_name":
		sortCol = "child_name"
	case "specification":
		sortCol = "specification"
	case "quantity":
		sortCol = "quantity"
	case "running_date_bom":
		sortCol = "running_date_bom"
	case "distribution_date":
		sortCol = "distribution_date"
	case "created_at":
		sortCol = "created_at"
	case "updated_at":
		sortCol = "updated_at"
	}

	sortDir := "DESC"
	if strings.ToUpper(q.SortOrder) == "ASC" {
		sortDir = "ASC"
	}

	query := fmt.Sprintf(`
		SELECT id, ecn_no, model, function_type, purpose, inventory_mgmt, process,
		       ec_title, parent_code, parent_name, before_after, dl, child_code,
		       child_name, specification, quantity, marking_point, running_date_bom,
		       distribution_date, status, remark, created_by, created_at, updated_at
		FROM ecn_records
		WHERE %s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereClause, sortCol, sortDir, argIdx, argIdx+1)

	args = append(args, q.Limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list ecn records: %w", err)
	}
	defer rows.Close()

	records := make([]model.ECNRecord, 0)
	for rows.Next() {
		var rec model.ECNRecord
		if err := rows.Scan(
			&rec.ID, &rec.ECNNo, &rec.Model, &rec.FunctionType, &rec.Purpose, &rec.InventoryMgmt, &rec.Process,
			&rec.ECTitle, &rec.ParentCode, &rec.ParentName, &rec.BeforeAfter, &rec.DL, &rec.ChildCode,
			&rec.ChildName, &rec.Specification, &rec.Quantity, &rec.MarkingPoint, &rec.RunningDateBOM,
			&rec.DistributionDate, &rec.Status, &rec.Remark, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan ecn record: %w", err)
		}
		records = append(records, rec)
	}

	totalPages := (total + q.Limit - 1) / q.Limit
	if totalPages == 0 {
		totalPages = 1
	}

	return &model.ECNListResponse{
		Records:    records,
		Total:      total,
		Page:       q.Page,
		Limit:      q.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetStats returns summary metrics for the dashboard cards
func (r *ECNRepository) GetStats(ctx context.Context) (*model.ECNStatsSummary, error) {
	stats := &model.ECNStatsSummary{
		ModelCounts: make(map[string]int),
	}

	// 1. Total counts by status
	rows, err := r.pool.Query(ctx, `
		SELECT 
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed,
			COUNT(*) FILTER (WHERE LOWER(status) IN ('in progress', 'progress')) AS in_progress,
			COUNT(*) FILTER (WHERE LOWER(status) = 'pending') AS pending,
			COUNT(*) FILTER (WHERE LOWER(status) = 'eco cancel') AS eco_cancel,
			COUNT(DISTINCT model) AS unique_models
		FROM ecn_records
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get ecn stats: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(
			&stats.Total,
			&stats.Completed,
			&stats.InProgress,
			&stats.Pending,
			&stats.ECOCancel,
			&stats.UniqueModels,
		); err != nil {
			return nil, err
		}
	}

	// 2. Top models
	mRows, err := r.pool.Query(ctx, `
		SELECT model, COUNT(*) 
		FROM ecn_records 
		WHERE model IS NOT NULL AND model != ''
		GROUP BY model 
		ORDER BY COUNT(*) DESC 
		LIMIT 10
	`)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var m string
			var c int
			if err := mRows.Scan(&m, &c); err == nil {
				stats.ModelCounts[m] = c
			}
		}
	}

	return stats, nil
}

// Create inserts a single ECN record
func (r *ECNRepository) Create(ctx context.Context, item *model.ECNRecord) (*model.ECNRecord, error) {
	item.ID = uuid.New()
	item.CreatedAt = time.Now()
	item.UpdatedAt = time.Now()
	if item.Status == "" {
		item.Status = "Pending"
	}

	query := `
		INSERT INTO ecn_records (
			id, ecn_no, model, function_type, purpose, inventory_mgmt, process,
			ec_title, parent_code, parent_name, before_after, dl, child_code,
			child_name, specification, quantity, marking_point, running_date_bom,
			distribution_date, status, remark, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, $21, $22, $23, $24
		)
	`
	_, err := r.pool.Exec(ctx, query,
		item.ID, item.ECNNo, item.Model, item.FunctionType, item.Purpose, item.InventoryMgmt, item.Process,
		item.ECTitle, item.ParentCode, item.ParentName, item.BeforeAfter, item.DL, item.ChildCode,
		item.ChildName, item.Specification, item.Quantity, item.MarkingPoint, item.RunningDateBOM,
		item.DistributionDate, item.Status, item.Remark, item.CreatedBy, item.CreatedAt, item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert ecn record: %w", err)
	}
	return item, nil
}

// Update updates an existing ECN record
func (r *ECNRepository) Update(ctx context.Context, id uuid.UUID, item *model.ECNRecord) (*model.ECNRecord, error) {
	item.ID = id
	item.UpdatedAt = time.Now()

	query := `
		UPDATE ecn_records SET
			ecn_no = $1, model = $2, function_type = $3, purpose = $4, inventory_mgmt = $5,
			process = $6, ec_title = $7, parent_code = $8, parent_name = $9, before_after = $10,
			dl = $11, child_code = $12, child_name = $13, specification = $14, quantity = $15,
			marking_point = $16, running_date_bom = $17, distribution_date = $18, status = $19,
			remark = $20, updated_at = $21
		WHERE id = $22
	`
	tag, err := r.pool.Exec(ctx, query,
		item.ECNNo, item.Model, item.FunctionType, item.Purpose, item.InventoryMgmt,
		item.Process, item.ECTitle, item.ParentCode, item.ParentName, item.BeforeAfter,
		item.DL, item.ChildCode, item.ChildName, item.Specification, item.Quantity,
		item.MarkingPoint, item.RunningDateBOM, item.DistributionDate, item.Status,
		item.Remark, item.UpdatedAt, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update ecn record: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("ecn record not found")
	}
	return item, nil
}

// Delete removes an ECN record by ID
func (r *ECNRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM ecn_records WHERE id = $1", id)
	return err
}

// BulkInsert inserts a list of ECN records in batches using high-performance pgx Batch
func (r *ECNRepository) BulkInsert(ctx context.Context, records []model.ECNRecord, createdBy *uuid.UUID) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	batch := &pgx.Batch{}
	now := time.Now()

	insertSQL := `
		INSERT INTO ecn_records (
			id, ecn_no, model, function_type, purpose, inventory_mgmt, process,
			ec_title, parent_code, parent_name, before_after, dl, child_code,
			child_name, specification, quantity, marking_point, running_date_bom,
			distribution_date, status, remark, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, $21, $22, $23, $24
		)
	`

	inserted := 0
	for _, rec := range records {
		recID := uuid.New()
		st := rec.Status
		if st == "" {
			st = "Pending"
		}

		batch.Queue(insertSQL,
			recID, rec.ECNNo, rec.Model, rec.FunctionType, rec.Purpose, rec.InventoryMgmt, rec.Process,
			rec.ECTitle, rec.ParentCode, rec.ParentName, rec.BeforeAfter, rec.DL, rec.ChildCode,
			rec.ChildName, rec.Specification, rec.Quantity, rec.MarkingPoint, rec.RunningDateBOM,
			rec.DistributionDate, st, rec.Remark, createdBy, now, now,
		)
		inserted++
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < inserted; i++ {
		_, err := br.Exec()
		if err != nil {
			return i, fmt.Errorf("error inserting batch record at index %d: %w", i, err)
		}
	}

	return inserted, nil
}
