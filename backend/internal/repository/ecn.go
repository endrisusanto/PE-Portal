package repository

import (
	"context"
	"encoding/json"
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
	if q.Limit <= 0 {
		q.Limit = 50
	} else if q.Limit > 100000 {
		q.Limit = 100000
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
			LOWER(e.ecn_no) LIKE $%d OR 
			LOWER(e.model) LIKE $%d OR 
			LOWER(e.ec_title) LIKE $%d OR 
			LOWER(e.remark) LIKE $%d OR 
			LOWER(e.parent_code) LIKE $%d OR 
			LOWER(e.child_code) LIKE $%d OR
			LOWER(COALESCE(u_up.full_name, u_up.username, u_cr.full_name, u_cr.username, '')) LIKE $%d
		)`, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	if q.Model != "" {
		where = append(where, fmt.Sprintf("LOWER(e.model) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(q.Model)+"%")
		argIdx++
	}

	if q.Status != "" {
		st := strings.ToLower(strings.TrimSpace(q.Status))
		if st == "progress" || st == "in progress" {
			where = append(where, fmt.Sprintf("(LOWER(e.status) = 'progress' OR LOWER(e.status) = 'in progress')"))
		} else {
			where = append(where, fmt.Sprintf("LOWER(e.status) = LOWER($%d)", argIdx))
			args = append(args, q.Status)
			argIdx++
		}
	}

	if q.Process != "" {
		where = append(where, fmt.Sprintf("e.process = $%d", argIdx))
		args = append(args, q.Process)
		argIdx++
	}

	if q.FunctionType != "" {
		where = append(where, fmt.Sprintf("e.function_type = $%d", argIdx))
		args = append(args, q.FunctionType)
		argIdx++
	}

	// ponytail: Table header column filters applied directly in SQL for full DB pagination support
	if q.ECNNo != "" {
		where = append(where, fmt.Sprintf("LOWER(e.ecn_no) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.ECNNo))+"%")
		argIdx++
	}

	if q.ColModel != "" {
		where = append(where, fmt.Sprintf("LOWER(e.model) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.ColModel))+"%")
		argIdx++
	}

	if q.ColFunctionType != "" {
		where = append(where, fmt.Sprintf("LOWER(e.function_type) = LOWER($%d)", argIdx))
		args = append(args, strings.TrimSpace(q.ColFunctionType))
		argIdx++
	}

	if q.ColProcess != "" {
		where = append(where, fmt.Sprintf("LOWER(e.process) = LOWER($%d)", argIdx))
		args = append(args, strings.TrimSpace(q.ColProcess))
		argIdx++
	}

	if q.ColStatus != "" {
		st := strings.ToLower(strings.TrimSpace(q.ColStatus))
		if st == "progress" || st == "in progress" {
			where = append(where, fmt.Sprintf("(LOWER(e.status) = 'progress' OR LOWER(e.status) = 'in progress')"))
		} else {
			where = append(where, fmt.Sprintf("LOWER(e.status) = LOWER($%d)", argIdx))
			args = append(args, strings.TrimSpace(q.ColStatus))
			argIdx++
		}
	}

	if q.ECTitle != "" {
		where = append(where, fmt.Sprintf("LOWER(e.ec_title) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.ECTitle))+"%")
		argIdx++
	}

	if q.ChildCode != "" {
		where = append(where, fmt.Sprintf("LOWER(e.child_code) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.ChildCode))+"%")
		argIdx++
	}

	if q.ChildName != "" {
		where = append(where, fmt.Sprintf("LOWER(e.child_name) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.ChildName))+"%")
		argIdx++
	}

	if q.Specification != "" {
		where = append(where, fmt.Sprintf("LOWER(e.specification) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.Specification))+"%")
		argIdx++
	}

	if q.Quantity != "" {
		where = append(where, fmt.Sprintf("LOWER(e.quantity) LIKE $%d", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.Quantity))+"%")
		argIdx++
	}

	if q.RunningDateBOM != "" {
		trimmed := strings.TrimSpace(q.RunningDateBOM)
		parts := strings.Split(trimmed, "-")
		if len(parts) == 3 {
			mShort := strings.TrimPrefix(parts[1], "0")
			dShort := strings.TrimPrefix(parts[2], "0")
			where = append(where, fmt.Sprintf(`(
				e.running_date_bom LIKE $%d OR 
				e.running_date_bom LIKE $%d OR 
				e.running_date_bom LIKE $%d OR 
				e.running_date_bom LIKE $%d
			)`, argIdx, argIdx+1, argIdx+2, argIdx+3))
			args = append(args,
				"%"+trimmed+"%",
				fmt.Sprintf("%%%s/%s/%s%%", mShort, dShort, parts[0]),
				fmt.Sprintf("%%%s/%s/%s%%", parts[1], parts[2], parts[0]),
				fmt.Sprintf("%%%s/%s/%s%%", parts[0], parts[1], parts[2]),
			)
			argIdx += 4
		} else {
			where = append(where, fmt.Sprintf("LOWER(e.running_date_bom) LIKE $%d", argIdx))
			args = append(args, "%"+strings.ToLower(trimmed)+"%")
			argIdx++
		}
	}

	if q.DistributionDate != "" {
		trimmed := strings.TrimSpace(q.DistributionDate)
		parts := strings.Split(trimmed, "-")
		if len(parts) == 3 {
			mShort := strings.TrimPrefix(parts[1], "0")
			dShort := strings.TrimPrefix(parts[2], "0")
			where = append(where, fmt.Sprintf(`(
				e.distribution_date LIKE $%d OR 
				e.distribution_date LIKE $%d OR 
				e.distribution_date LIKE $%d OR 
				e.distribution_date LIKE $%d
			)`, argIdx, argIdx+1, argIdx+2, argIdx+3))
			args = append(args,
				"%"+trimmed+"%",
				fmt.Sprintf("%%%s/%s/%s%%", mShort, dShort, parts[0]),
				fmt.Sprintf("%%%s/%s/%s%%", parts[1], parts[2], parts[0]),
				fmt.Sprintf("%%%s/%s/%s%%", parts[0], parts[1], parts[2]),
			)
			argIdx += 4
		} else {
			where = append(where, fmt.Sprintf("LOWER(e.distribution_date) LIKE $%d", argIdx))
			args = append(args, "%"+strings.ToLower(trimmed)+"%")
			argIdx++
		}
	}

	if q.AuthorName != "" {
		where = append(where, fmt.Sprintf("(LOWER(COALESCE(u_up.full_name, u_up.username, u_cr.full_name, u_cr.username, '')) LIKE $%d)", argIdx))
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(q.AuthorName))+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM ecn_records e 
		LEFT JOIN users u_cr ON e.created_by = u_cr.id 
		LEFT JOIN users u_up ON e.updated_by = u_up.id 
		WHERE %s
	`, whereClause)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count ecn records: %w", err)
	}

	// Order by
	sortCol := "e.created_at"
	switch q.SortBy {
	case "ecn_no":
		sortCol = "e.ecn_no"
	case "model":
		sortCol = "e.model"
	case "function_type":
		sortCol = "e.function_type"
	case "purpose":
		sortCol = "e.purpose"
	case "status":
		sortCol = "e.status"
	case "process":
		sortCol = "e.process"
	case "ec_title":
		sortCol = "e.ec_title"
	case "child_code":
		sortCol = "e.child_code"
	case "child_name":
		sortCol = "e.child_name"
	case "specification":
		sortCol = "e.specification"
	case "quantity":
		sortCol = "e.quantity"
	case "running_date_bom":
		sortCol = "e.running_date_bom"
	case "distribution_date":
		sortCol = "e.distribution_date"
	case "created_at":
		sortCol = "e.created_at"
	case "updated_at":
		sortCol = "e.updated_at"
	case "author_name":
		sortCol = "COALESCE(u_up.full_name, u_up.username, u_cr.full_name, u_cr.username, 'System')"
	}

	sortDir := "DESC"
	if strings.ToUpper(q.SortOrder) == "ASC" {
		sortDir = "ASC"
	}

	query := fmt.Sprintf(`
		SELECT e.id, e.ecn_no, e.model, e.function_type, e.purpose, e.inventory_mgmt, e.process,
		       e.ec_title, e.parent_code, e.parent_name, e.before_after, e.dl, e.child_code,
		       e.child_name, e.specification, e.quantity, e.marking_point, e.running_date_bom,
		       e.distribution_date, e.status, e.remark, e.created_by, e.updated_by, e.created_at, e.updated_at,
		       COALESCE(u_up.full_name, u_up.username, u_cr.full_name, u_cr.username, 'System') AS author_name,
		       COALESCE(u_cr.full_name, u_cr.username, 'System') AS created_by_name,
		       COALESCE(u_up.full_name, u_up.username, '') AS updater_name
		FROM ecn_records e
		LEFT JOIN users u_cr ON e.created_by = u_cr.id
		LEFT JOIN users u_up ON e.updated_by = u_up.id
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
			&rec.DistributionDate, &rec.Status, &rec.Remark, &rec.CreatedBy, &rec.UpdatedBy, &rec.CreatedAt, &rec.UpdatedAt,
			&rec.AuthorName, &rec.CreatedByName, &rec.UpdaterName,
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

// GetByID retrieves a single ECN record by ID with author and updater names
func (r *ECNRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ECNRecord, error) {
	query := `
		SELECT e.id, e.ecn_no, e.model, e.function_type, e.purpose, e.inventory_mgmt, e.process,
		       e.ec_title, e.parent_code, e.parent_name, e.before_after, e.dl, e.child_code,
		       e.child_name, e.specification, e.quantity, e.marking_point, e.running_date_bom,
		       e.distribution_date, e.status, e.remark, e.created_by, e.updated_by, e.created_at, e.updated_at,
		       COALESCE(u_up.full_name, u_up.username, u_cr.full_name, u_cr.username, 'System') AS author_name,
		       COALESCE(u_cr.full_name, u_cr.username, 'System') AS created_by_name,
		       COALESCE(u_up.full_name, u_up.username, '') AS updater_name
		FROM ecn_records e
		LEFT JOIN users u_cr ON e.created_by = u_cr.id
		LEFT JOIN users u_up ON e.updated_by = u_up.id
		WHERE e.id = $1
	`
	var rec model.ECNRecord
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&rec.ID, &rec.ECNNo, &rec.Model, &rec.FunctionType, &rec.Purpose, &rec.InventoryMgmt, &rec.Process,
		&rec.ECTitle, &rec.ParentCode, &rec.ParentName, &rec.BeforeAfter, &rec.DL, &rec.ChildCode,
		&rec.ChildName, &rec.Specification, &rec.Quantity, &rec.MarkingPoint, &rec.RunningDateBOM,
		&rec.DistributionDate, &rec.Status, &rec.Remark, &rec.CreatedBy, &rec.UpdatedBy, &rec.CreatedAt, &rec.UpdatedAt,
		&rec.AuthorName, &rec.CreatedByName, &rec.UpdaterName,
	)
	if err != nil {
		return nil, fmt.Errorf("ecn record not found: %w", err)
	}
	return &rec, nil
}

// Update updates an existing ECN record and sets updated_by and updated_at
func (r *ECNRepository) Update(ctx context.Context, id uuid.UUID, item *model.ECNRecord) (*model.ECNRecord, error) {
	item.ID = id
	item.UpdatedAt = time.Now()

	query := `
		UPDATE ecn_records SET
			ecn_no = $1, model = $2, function_type = $3, purpose = $4, inventory_mgmt = $5,
			process = $6, ec_title = $7, parent_code = $8, parent_name = $9, before_after = $10,
			dl = $11, child_code = $12, child_name = $13, specification = $14, quantity = $15,
			marking_point = $16, running_date_bom = $17, distribution_date = $18, status = $19,
			remark = $20, updated_by = $21, updated_at = $22
		WHERE id = $23
	`
	tag, err := r.pool.Exec(ctx, query,
		item.ECNNo, item.Model, item.FunctionType, item.Purpose, item.InventoryMgmt,
		item.Process, item.ECTitle, item.ParentCode, item.ParentName, item.BeforeAfter,
		item.DL, item.ChildCode, item.ChildName, item.Specification, item.Quantity,
		item.MarkingPoint, item.RunningDateBOM, item.DistributionDate, item.Status,
		item.Remark, item.UpdatedBy, item.UpdatedAt, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update ecn record: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("ecn record not found")
	}
	return item, nil
}

// RecordChangeLog logs an audit breadcrumb entry for changes to an ECN record
func (r *ECNRepository) RecordChangeLog(ctx context.Context, log *model.ECNChangeLog) error {
	query := `
		INSERT INTO ecn_change_logs (ecn_id, action, changed_by, changes, note, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	changesJSON, _ := json.Marshal(log.Changes)
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	return r.pool.QueryRow(ctx, query, log.ECNID, log.Action, log.ChangedBy, changesJSON, log.Note, log.CreatedAt).Scan(&log.ID)
}

// GetChangeLogs retrieves all historical audit logs for a specific ECN
func (r *ECNRepository) GetChangeLogs(ctx context.Context, ecnID uuid.UUID) ([]model.ECNChangeLog, error) {
	query := `
		SELECT l.id, l.ecn_id, l.action, l.changed_by,
		       COALESCE(u.full_name, u.username, 'System') AS changed_by_name,
		       l.changes, l.note, l.created_at
		FROM ecn_change_logs l
		LEFT JOIN users u ON l.changed_by = u.id
		WHERE l.ecn_id = $1
		ORDER BY l.created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, ecnID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ecn change logs: %w", err)
	}
	defer rows.Close()

	logs := make([]model.ECNChangeLog, 0)
	for rows.Next() {
		var item model.ECNChangeLog
		var changesJSON []byte
		if err := rows.Scan(&item.ID, &item.ECNID, &item.Action, &item.ChangedBy, &item.ChangedByName, &changesJSON, &item.Note, &item.CreatedAt); err != nil {
			continue
		}
		if len(changesJSON) > 0 {
			_ = json.Unmarshal(changesJSON, &item.Changes)
		}
		logs = append(logs, item)
	}
	return logs, nil
}

// Delete removes an ECN record by ID
func (r *ECNRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM ecn_records WHERE id = $1", id)
	return err
}

// BulkDelete removes multiple ECN records by their IDs (ponytail)
func (r *ECNRepository) BulkDelete(ctx context.Context, ids []uuid.UUID) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	tag, err := r.pool.Exec(ctx, "DELETE FROM ecn_records WHERE id = ANY($1)", ids)
	if err != nil {
		return 0, fmt.Errorf("failed to bulk delete ecn records: %w", err)
	}
	return tag.RowsAffected(), nil
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

	// ponytail: simple batch insert with fallback defaults for empty columns
	inserted := 0
	for _, rec := range records {
		recID := uuid.New()
		st := strings.TrimSpace(rec.Status)
		if st == "" {
			st = "Pending"
		}
		ecnNo := strings.TrimSpace(rec.ECNNo)
		if ecnNo == "" {
			ecnNo = "-"
		}

		batch.Queue(insertSQL,
			recID, ecnNo, strings.TrimSpace(rec.Model), strings.TrimSpace(rec.FunctionType),
			strings.TrimSpace(rec.Purpose), strings.TrimSpace(rec.InventoryMgmt), strings.TrimSpace(rec.Process),
			strings.TrimSpace(rec.ECTitle), strings.TrimSpace(rec.ParentCode), strings.TrimSpace(rec.ParentName),
			strings.TrimSpace(rec.BeforeAfter), strings.TrimSpace(rec.DL), strings.TrimSpace(rec.ChildCode),
			strings.TrimSpace(rec.ChildName), strings.TrimSpace(rec.Specification), strings.TrimSpace(rec.Quantity),
			strings.TrimSpace(rec.MarkingPoint), strings.TrimSpace(rec.RunningDateBOM), strings.TrimSpace(rec.DistributionDate),
			st, strings.TrimSpace(rec.Remark), createdBy, now, now,
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
