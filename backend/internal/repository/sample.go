package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type SampleRepository struct {
	pool *pgxpool.Pool
}

func NewSampleRepository(pool *pgxpool.Pool) *SampleRepository {
	return &SampleRepository{pool: pool}
}

// FormatDuration computes human-friendly duration string
func formatDuration(t *time.Time) string {
	if t == nil {
		return "-"
	}
	d := time.Since(*t)
	if d < 0 {
		return "Baru saja"
	}
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return fmt.Sprintf("%d hr %d jam", days, hours)
	}
	if hours > 0 {
		return fmt.Sprintf("%d jam %d mnt", hours, minutes)
	}
	if minutes > 0 {
		return fmt.Sprintf("%d menit", minutes)
	}
	return "Baru saja"
}

// List retrieves paginated samples with filtering
func (r *SampleRepository) List(ctx context.Context, search, modelName, statusPinjam, condition string, limit, offset int) ([]model.Sample, int, error) {
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		s := "%" + strings.ToLower(search) + "%"
		where = append(where, fmt.Sprintf("(LOWER(asset_number) LIKE $%d OR LOWER(model) LIKE $%d OR LOWER(serial_number) LIKE $%d OR LOWER(imei) LIKE $%d OR LOWER(borrower_name) LIKE $%d OR LOWER(un_code) LIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	if modelName != "" {
		where = append(where, fmt.Sprintf("model = $%d", argIdx))
		args = append(args, modelName)
		argIdx++
	}

	if statusPinjam != "" {
		where = append(where, fmt.Sprintf("status_pinjam = $%d", argIdx))
		args = append(args, statusPinjam)
		argIdx++
	}

	if condition != "" {
		if condition == "Normal" {
			where = append(where, fmt.Sprintf("condition_status = 'Normal'"))
		} else if condition == "Defect" {
			where = append(where, fmt.Sprintf("condition_status != 'Normal'"))
		} else {
			where = append(where, fmt.Sprintf("condition_status = $%d", argIdx))
			args = append(args, condition)
			argIdx++
		}
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM samples WHERE %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count samples: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT id, asset_number, model, serial_number, category, status_pinjam,
		       borrower_name, borrowed_at, pic_sample, location, condition_status,
		       octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		FROM samples
		WHERE %s
		ORDER BY id DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query samples: %w", err)
	}
	defer rows.Close()

	items := []model.Sample{}
	for rows.Next() {
		var s model.Sample
		if err := rows.Scan(
			&s.ID, &s.AssetNumber, &s.Model, &s.SerialNumber, &s.Category, &s.StatusPinjam,
			&s.BorrowerName, &s.BorrowedAt, &s.PICSample, &s.Location, &s.ConditionStatus,
			&s.OctaStatus, &s.IMEI, &s.UNCode, &s.HWRev, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan sample: %w", err)
		}
		s.DurationFormatted = formatDuration(s.BorrowedAt)
		items = append(items, s)
	}

	return items, total, nil
}

// GetByID finds sample by primary key
func (r *SampleRepository) GetByID(ctx context.Context, id int) (*model.Sample, error) {
	query := `
		SELECT id, asset_number, model, serial_number, category, status_pinjam,
		       borrower_name, borrowed_at, pic_sample, location, condition_status,
		       octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		FROM samples
		WHERE id = $1 AND deleted_at IS NULL
	`
	var s model.Sample
	if err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.AssetNumber, &s.Model, &s.SerialNumber, &s.Category, &s.StatusPinjam,
		&s.BorrowerName, &s.BorrowedAt, &s.PICSample, &s.Location, &s.ConditionStatus,
		&s.OctaStatus, &s.IMEI, &s.UNCode, &s.HWRev, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		return nil, err
	}
	s.DurationFormatted = formatDuration(s.BorrowedAt)
	return &s, nil
}

// GetByAssetOrSerial finds sample by asset number, serial number, or IMEI
func (r *SampleRepository) GetByAssetOrSerial(ctx context.Context, identifier string) (*model.Sample, error) {
	ident := strings.TrimSpace(identifier)
	query := `
		SELECT id, asset_number, model, serial_number, category, status_pinjam,
		       borrower_name, borrowed_at, pic_sample, location, condition_status,
		       octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		FROM samples
		WHERE (LOWER(asset_number) = LOWER($1) OR LOWER(serial_number) = LOWER($1) OR LOWER(imei) = LOWER($1))
		  AND deleted_at IS NULL
		LIMIT 1
	`
	var s model.Sample
	if err := r.pool.QueryRow(ctx, query, ident).Scan(
		&s.ID, &s.AssetNumber, &s.Model, &s.SerialNumber, &s.Category, &s.StatusPinjam,
		&s.BorrowerName, &s.BorrowedAt, &s.PICSample, &s.Location, &s.ConditionStatus,
		&s.OctaStatus, &s.IMEI, &s.UNCode, &s.HWRev, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		return nil, err
	}
	s.DurationFormatted = formatDuration(s.BorrowedAt)
	return &s, nil
}

// GetStats returns summary metrics
func (r *SampleRepository) GetStats(ctx context.Context) (*model.SampleStats, error) {
	query := `
		SELECT
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status_pinjam = 'PINJAM') as borrowed,
			COUNT(*) FILTER (WHERE status_pinjam = 'AVAILABLE') as available,
			COUNT(*) FILTER (WHERE condition_status != 'Normal' AND condition_status != '') as defects,
			COUNT(DISTINCT borrower_name) FILTER (WHERE status_pinjam = 'PINJAM' AND borrower_name != '') as active_borrowers
		FROM samples
		WHERE deleted_at IS NULL
	`
	var stats model.SampleStats
	if err := r.pool.QueryRow(ctx, query).Scan(
		&stats.TotalSamples,
		&stats.Borrowed,
		&stats.Available,
		&stats.Defects,
		&stats.ActiveBorrowers,
	); err != nil {
		return nil, fmt.Errorf("failed to get sample stats: %w", err)
	}
	return &stats, nil
}

// GetBorrowerGroups returns cards of samples grouped by active borrower
func (r *SampleRepository) GetBorrowerGroups(ctx context.Context) ([]model.BorrowerGroup, error) {
	query := `
		SELECT id, asset_number, model, serial_number, category, status_pinjam,
		       borrower_name, borrowed_at, pic_sample, location, condition_status,
		       octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		FROM samples
		WHERE status_pinjam = 'PINJAM' AND borrower_name != '' AND deleted_at IS NULL
		ORDER BY borrower_name ASC, borrowed_at DESC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query borrower items: %w", err)
	}
	defer rows.Close()

	groupMap := make(map[string]*model.BorrowerGroup)
	order := []string{}

	for rows.Next() {
		var s model.Sample
		if err := rows.Scan(
			&s.ID, &s.AssetNumber, &s.Model, &s.SerialNumber, &s.Category, &s.StatusPinjam,
			&s.BorrowerName, &s.BorrowedAt, &s.PICSample, &s.Location, &s.ConditionStatus,
			&s.OctaStatus, &s.IMEI, &s.UNCode, &s.HWRev, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan item for borrower group: %w", err)
		}
		s.DurationFormatted = formatDuration(s.BorrowedAt)

		bName := s.BorrowerName
		if _, exists := groupMap[bName]; !exists {
			groupMap[bName] = &model.BorrowerGroup{
				BorrowerName: bName,
				Count:        0,
				Items:        []model.Sample{},
			}
			order = append(order, bName)
		}
		groupMap[bName].Count++
		groupMap[bName].Items = append(groupMap[bName].Items, s)
	}

	result := make([]model.BorrowerGroup, 0, len(order))
	for _, name := range order {
		result = append(result, *groupMap[name])
	}

	return result, nil
}

// GetModelMatrix returns card matrix grouped by model
func (r *SampleRepository) GetModelMatrix(ctx context.Context, search string) ([]model.ModelMatrixCard, error) {
	where := "deleted_at IS NULL"
	args := []interface{}{}
	if search != "" {
		where += " AND (LOWER(model) LIKE $1 OR LOWER(asset_number) LIKE $1 OR LOWER(serial_number) LIKE $1)"
		args = append(args, "%"+strings.ToLower(search)+"%")
	}

	query := fmt.Sprintf(`
		SELECT id, asset_number, model, serial_number, category, status_pinjam,
		       borrower_name, borrowed_at, pic_sample, location, condition_status,
		       octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		FROM samples
		WHERE %s
		ORDER BY model ASC, asset_number ASC
	`, where)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query samples for matrix: %w", err)
	}
	defer rows.Close()

	modelMap := make(map[string]*model.ModelMatrixCard)
	order := []string{}

	for rows.Next() {
		var s model.Sample
		if err := rows.Scan(
			&s.ID, &s.AssetNumber, &s.Model, &s.SerialNumber, &s.Category, &s.StatusPinjam,
			&s.BorrowerName, &s.BorrowedAt, &s.PICSample, &s.Location, &s.ConditionStatus,
			&s.OctaStatus, &s.IMEI, &s.UNCode, &s.HWRev, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan sample for matrix: %w", err)
		}
		s.DurationFormatted = formatDuration(s.BorrowedAt)

		mName := s.Model
		if _, exists := modelMap[mName]; !exists {
			modelMap[mName] = &model.ModelMatrixCard{
				Model:     mName,
				Total:     0,
				Borrowed:  0,
				Available: 0,
				Defects:   0,
				Items:     []model.Sample{},
			}
			order = append(order, mName)
		}

		card := modelMap[mName]
		card.Total++
		if s.StatusPinjam == "PINJAM" {
			card.Borrowed++
		} else {
			card.Available++
		}
		if s.ConditionStatus != "Normal" && s.ConditionStatus != "" {
			card.Defects++
		}
		card.Items = append(card.Items, s)
	}

	result := make([]model.ModelMatrixCard, 0, len(order))
	for _, m := range order {
		result = append(result, *modelMap[m])
	}

	return result, nil
}

// ScanTransaction executes quick borrow / return state machine
func (r *SampleRepository) ScanTransaction(ctx context.Context, req model.ScanRequest) (*model.ScanResponse, error) {
	sample, err := r.GetByAssetOrSerial(ctx, req.AssetNumber)
	if err != nil {
		return &model.ScanResponse{
			Success: false,
			Action:  "TIDAK_TERSEDIA",
			Message: fmt.Sprintf("Sample tidak ditemukan untuk nomor asset/serial: %s", req.AssetNumber),
		}, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	cleanName := strings.ToUpper(strings.TrimSpace(req.BorrowerName))
	prevName := strings.ToUpper(strings.TrimSpace(sample.BorrowerName))
	prevStatus := sample.StatusPinjam

	var newStatus string
	var actionType string
	var msg string

	if req.Action == "KEMBALI" {
		newStatus = "AVAILABLE"
		actionType = "KEMBALI"
		cleanName = "" // clear borrower on return
		msg = fmt.Sprintf("Sample %s (%s) berhasil dikembalikan", sample.Model, sample.AssetNumber)
	} else if req.Action == "PINJAM" {
		newStatus = "PINJAM"
		if prevStatus == "PINJAM" && cleanName != prevName {
			actionType = "TRANSFER"
			msg = fmt.Sprintf("Sample %s (%s) dialihkan dari %s ke %s", sample.Model, sample.AssetNumber, prevName, cleanName)
		} else {
			actionType = "PINJAM"
			msg = fmt.Sprintf("Sample %s (%s) berhasil dipinjam oleh %s", sample.Model, sample.AssetNumber, cleanName)
		}
	} else {
		// Smart Auto Toggle
		if prevStatus == "PINJAM" {
			if cleanName == prevName || cleanName == "" {
				newStatus = "AVAILABLE"
				actionType = "KEMBALI"
				cleanName = ""
				msg = fmt.Sprintf("Sample %s (%s) berhasil dikembalikan", sample.Model, sample.AssetNumber)
			} else {
				newStatus = "PINJAM"
				actionType = "TRANSFER"
				msg = fmt.Sprintf("Sample %s (%s) dialihkan dari %s ke %s", sample.Model, sample.AssetNumber, prevName, cleanName)
			}
		} else {
			newStatus = "PINJAM"
			actionType = "PINJAM"
			if cleanName == "" {
				cleanName = "PE ENGINEER"
			}
			msg = fmt.Sprintf("Sample %s (%s) berhasil dipinjam oleh %s", sample.Model, sample.AssetNumber, cleanName)
		}
	}

	var borrowedAt *time.Time
	if newStatus == "PINJAM" {
		borrowedAt = &now
	}

	updateQuery := `
		UPDATE samples
		SET status_pinjam = $1, borrower_name = $2, borrowed_at = $3, updated_at = $4
		WHERE id = $5
		RETURNING id, asset_number, model, serial_number, category, status_pinjam,
		          borrower_name, borrowed_at, pic_sample, location, condition_status,
		          octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
	`
	var updated model.Sample
	if err := tx.QueryRow(ctx, updateQuery, newStatus, cleanName, borrowedAt, now, sample.ID).Scan(
		&updated.ID, &updated.AssetNumber, &updated.Model, &updated.SerialNumber, &updated.Category, &updated.StatusPinjam,
		&updated.BorrowerName, &updated.BorrowedAt, &updated.PICSample, &updated.Location, &updated.ConditionStatus,
		&updated.OctaStatus, &updated.IMEI, &updated.UNCode, &updated.HWRev, &updated.Notes, &updated.CreatedAt, &updated.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to update sample status: %w", err)
	}

	// Insert flow history log
	flowBorrower := cleanName
	if actionType == "KEMBALI" {
		flowBorrower = prevName
		if flowBorrower == "" {
			flowBorrower = "PE ENGINEER"
		}
	}

	flowQuery := `
		INSERT INTO sample_flows (sample_id, asset_number, model, borrower_name, action, notes, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if _, err := tx.Exec(ctx, flowQuery, sample.ID, sample.AssetNumber, sample.Model, flowBorrower, actionType, req.Notes, now); err != nil {
		return nil, fmt.Errorf("failed to record sample flow: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	updated.DurationFormatted = formatDuration(updated.BorrowedAt)

	return &model.ScanResponse{
		Success: true,
		Action:  actionType,
		Message: msg,
		Sample:  &updated,
	}, nil
}

// BulkReturn returns multiple assets belonging to a borrower
func (r *SampleRepository) BulkReturn(ctx context.Context, req model.BulkReturnRequest) (int, error) {
	if len(req.Assets) == 0 {
		return 0, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to begin bulk return tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	returnedCount := 0

	for _, asset := range req.Assets {
		assetClean := strings.TrimSpace(asset)
		if assetClean == "" {
			continue
		}

		var sID int
		var sModel, sAsset, sPrevBorrower string
		err := tx.QueryRow(ctx, "SELECT id, model, asset_number, borrower_name FROM samples WHERE (asset_number = $1 OR serial_number = $1) AND deleted_at IS NULL", assetClean).Scan(&sID, &sModel, &sAsset, &sPrevBorrower)
		if err != nil {
			continue
		}

		_, err = tx.Exec(ctx, `
			UPDATE samples
			SET status_pinjam = 'AVAILABLE', borrower_name = '', borrowed_at = NULL, updated_at = $1
			WHERE id = $2
		`, now, sID)
		if err != nil {
			return 0, fmt.Errorf("failed to return asset %s: %w", sAsset, err)
		}

		borrowerLog := sPrevBorrower
		if borrowerLog == "" {
			borrowerLog = req.BorrowerName
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO sample_flows (sample_id, asset_number, model, borrower_name, action, notes, timestamp)
			VALUES ($1, $2, $3, $4, 'KEMBALI', 'Pengembalian massal', $5)
		`, sID, sAsset, sModel, borrowerLog, now)
		if err != nil {
			return 0, fmt.Errorf("failed to log return for asset %s: %w", sAsset, err)
		}

		returnedCount++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit bulk return: %w", err)
	}

	return returnedCount, nil
}

// Create inserts a new sample
func (r *SampleRepository) Create(ctx context.Context, s *model.Sample) error {
	query := `
		INSERT INTO samples (
			asset_number, model, serial_number, category, status_pinjam,
			borrower_name, borrowed_at, pic_sample, location, condition_status,
			octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at
	`
	now := time.Now()
	s.CreatedAt = now
	s.UpdatedAt = now

	return r.pool.QueryRow(ctx, query,
		s.AssetNumber, s.Model, s.SerialNumber, s.Category, s.StatusPinjam,
		s.BorrowerName, s.BorrowedAt, s.PICSample, s.Location, s.ConditionStatus,
		s.OctaStatus, s.IMEI, s.UNCode, s.HWRev, s.Notes, s.CreatedAt, s.UpdatedAt,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

// CreateBulk imports multiple samples efficiently
func (r *SampleRepository) CreateBulk(ctx context.Context, samples []model.Sample) (int, error) {
	if len(samples) == 0 {
		return 0, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to begin bulk insert: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	inserted := 0

	stmt := `
		INSERT INTO samples (
			asset_number, model, serial_number, category, status_pinjam,
			borrower_name, borrowed_at, pic_sample, location, condition_status,
			octa_status, imei, un_code, hw_rev, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		ON CONFLICT (asset_number) DO UPDATE SET
			model = EXCLUDED.model,
			serial_number = EXCLUDED.serial_number,
			category = EXCLUDED.category,
			condition_status = EXCLUDED.condition_status,
			octa_status = EXCLUDED.octa_status,
			imei = EXCLUDED.imei,
			un_code = EXCLUDED.un_code,
			hw_rev = EXCLUDED.hw_rev,
			notes = EXCLUDED.notes,
			updated_at = EXCLUDED.updated_at
	`

	for _, s := range samples {
		if strings.TrimSpace(s.AssetNumber) == "" {
			continue
		}
		if s.Category == "" {
			s.Category = "Engineering Sample"
		}
		if s.StatusPinjam == "" {
			s.StatusPinjam = "AVAILABLE"
		}
		if s.ConditionStatus == "" {
			s.ConditionStatus = "Normal"
		}

		_, err := tx.Exec(ctx, stmt,
			s.AssetNumber, s.Model, s.SerialNumber, s.Category, s.StatusPinjam,
			s.BorrowerName, s.BorrowedAt, s.PICSample, s.Location, s.ConditionStatus,
			s.OctaStatus, s.IMEI, s.UNCode, s.HWRev, s.Notes, now, now,
		)
		if err != nil {
			return inserted, fmt.Errorf("failed to bulk insert sample %s: %w", s.AssetNumber, err)
		}
		inserted++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit bulk insert: %w", err)
	}

	return inserted, nil
}

// Update modifies an existing sample
func (r *SampleRepository) Update(ctx context.Context, s *model.Sample) error {
	query := `
		UPDATE samples SET
			asset_number = $1, model = $2, serial_number = $3, category = $4,
			status_pinjam = $5, borrower_name = $6, borrowed_at = $7, pic_sample = $8,
			location = $9, condition_status = $10, octa_status = $11, imei = $12,
			un_code = $13, hw_rev = $14, notes = $15, updated_at = $16
		WHERE id = $17 AND deleted_at IS NULL
	`
	now := time.Now()
	res, err := r.pool.Exec(ctx, query,
		s.AssetNumber, s.Model, s.SerialNumber, s.Category,
		s.StatusPinjam, s.BorrowerName, s.BorrowedAt, s.PICSample,
		s.Location, s.ConditionStatus, s.OctaStatus, s.IMEI,
		s.UNCode, s.HWRev, s.Notes, now, s.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update sample: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("sample not found or already deleted")
	}
	return nil
}

// Delete soft deletes a sample
func (r *SampleRepository) Delete(ctx context.Context, id int) error {
	query := "UPDATE samples SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL"
	res, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete sample: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("sample not found or already deleted")
	}
	return nil
}
