package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type GmesRepository struct {
	pool *pgxpool.Pool
}

func NewGmesRepository(pool *pgxpool.Pool) *GmesRepository {
	return &GmesRepository{pool: pool}
}

// ListIssues returns filtered GMES worst defect issues
func (r *GmesRepository) ListIssues(ctx context.Context, process, line, modelName, status, search string, limit, offset int) ([]model.GmesIssue, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if process != "" && process != "ALL" {
		where = append(where, fmt.Sprintf("process = $%d", argIdx))
		args = append(args, process)
		argIdx++
	}

	if line != "" && line != "ALL" {
		where = append(where, fmt.Sprintf("line_name = $%d", argIdx))
		args = append(args, line)
		argIdx++
	}

	if modelName != "" && modelName != "ALL" {
		where = append(where, fmt.Sprintf("model = $%d", argIdx))
		args = append(args, modelName)
		argIdx++
	}

	if status != "" && status != "ALL" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if search != "" {
		s := "%" + strings.ToLower(search) + "%"
		where = append(where, fmt.Sprintf("(LOWER(test_item) LIKE $%d OR LOWER(pic) LIKE $%d OR LOWER(countermeasure) LIKE $%d OR LOWER(line_name) LIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM gmes_issues WHERE %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count gmes issues: %w", err)
	}

	if limit <= 0 {
		limit = 50
	}
	query := fmt.Sprintf(`
		SELECT id, process, line_name, model, test_item, share, fail_qty, status, pic, countermeasure, created_at, updated_at
		FROM gmes_issues
		WHERE %s
		ORDER BY fail_qty DESC, id ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query gmes issues: %w", err)
	}
	defer rows.Close()

	var issues []model.GmesIssue
	for rows.Next() {
		var i model.GmesIssue
		if err := rows.Scan(&i.ID, &i.Process, &i.LineName, &i.Model, &i.TestItem, &i.Share, &i.FailQty, &i.Status, &i.PIC, &i.Countermeasure, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan gmes issue: %w", err)
		}
		issues = append(issues, i)
	}

	return issues, total, nil
}

// GetIssue fetches a single issue
func (r *GmesRepository) GetIssue(ctx context.Context, id int) (*model.GmesIssue, error) {
	query := `
		SELECT id, process, line_name, model, test_item, share, fail_qty, status, pic, countermeasure, created_at, updated_at
		FROM gmes_issues WHERE id = $1
	`
	var i model.GmesIssue
	err := r.pool.QueryRow(ctx, query, id).Scan(&i.ID, &i.Process, &i.LineName, &i.Model, &i.TestItem, &i.Share, &i.FailQty, &i.Status, &i.PIC, &i.Countermeasure, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// CreateIssue adds a new line issue
func (r *GmesRepository) CreateIssue(ctx context.Context, issue *model.GmesIssue) error {
	query := `
		INSERT INTO gmes_issues (process, line_name, model, test_item, share, fail_qty, status, pic, countermeasure, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(ctx, query,
		issue.Process, issue.LineName, issue.Model, issue.TestItem, issue.Share, issue.FailQty, issue.Status, issue.PIC, issue.Countermeasure,
	).Scan(&issue.ID, &issue.CreatedAt, &issue.UpdatedAt)
}

// UpdateIssue updates an issue status and countermeasure
func (r *GmesRepository) UpdateIssue(ctx context.Context, issue *model.GmesIssue) error {
	query := `
		UPDATE gmes_issues
		SET process = $1, line_name = $2, model = $3, test_item = $4, share = $5, fail_qty = $6, status = $7, pic = $8, countermeasure = $9, updated_at = NOW()
		WHERE id = $10
	`
	_, err := r.pool.Exec(ctx, query,
		issue.Process, issue.LineName, issue.Model, issue.TestItem, issue.Share, issue.FailQty, issue.Status, issue.PIC, issue.Countermeasure, issue.ID,
	)
	return err
}

// DeleteIssue deletes an issue
func (r *GmesRepository) DeleteIssue(ctx context.Context, id int) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM gmes_issues WHERE id = $1", id)
	return err
}

// GetStats returns summary metrics
func (r *GmesRepository) GetStats(ctx context.Context) (*model.GmesStats, error) {
	stats := &model.GmesStats{
		ProcessCounts: make(map[string]int),
		ProcessFails:  make(map[string]int),
	}

	// Total fails & active issues
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(fail_qty), 0), COUNT(CASE WHEN status != 'RESOLVED' THEN 1 END)
		FROM gmes_issues
	`).Scan(&stats.TotalFailQty, &stats.ActiveIssues)
	if err != nil {
		return nil, err
	}

	// Worst line
	_ = r.pool.QueryRow(ctx, `
		SELECT line_name FROM gmes_issues GROUP BY line_name ORDER BY SUM(fail_qty) DESC LIMIT 1
	`).Scan(&stats.WorstLine)

	// Worst process
	_ = r.pool.QueryRow(ctx, `
		SELECT process FROM gmes_issues GROUP BY process ORDER BY SUM(fail_qty) DESC LIMIT 1
	`).Scan(&stats.WorstProcess)

	// Process aggregations
	rows, err := r.pool.Query(ctx, `
		SELECT process, COUNT(*), COALESCE(SUM(fail_qty), 0)
		FROM gmes_issues
		GROUP BY process
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var proc string
			var count, fails int
			if err := rows.Scan(&proc, &count, &fails); err == nil {
				stats.ProcessCounts[proc] = count
				stats.ProcessFails[proc] = fails
			}
		}
	}

	return stats, nil
}

// ListMeasurements returns recent measurement logs
func (r *GmesRepository) ListMeasurements(ctx context.Context, process string, limit int) ([]model.GmesMeasurement, error) {
	if limit <= 0 {
		limit = 20
	}
	var query string
	var args []interface{}
	if process != "" && process != "ALL" {
		query = `
			SELECT id, process, line_name, model, test_item, sn, cn, port, test_time, equip_no, measure_usl, measure_value, measure_lsl, remark, created_at
			FROM gmes_measurements
			WHERE process = $1
			ORDER BY id DESC
			LIMIT $2
		`
		args = []interface{}{process, limit}
	} else {
		query = `
			SELECT id, process, line_name, model, test_item, sn, cn, port, test_time, equip_no, measure_usl, measure_value, measure_lsl, remark, created_at
			FROM gmes_measurements
			ORDER BY id DESC
			LIMIT $1
		`
		args = []interface{}{limit}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.GmesMeasurement
	for rows.Next() {
		var m model.GmesMeasurement
		if err := rows.Scan(&m.ID, &m.Process, &m.LineName, &m.Model, &m.TestItem, &m.SN, &m.CN, &m.Port, &m.TestTime, &m.EquipNo, &m.MeasureUSL, &m.MeasureValue, &m.MeasureLSL, &m.Remark, &m.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, m)
	}
	return logs, nil
}
