package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type SoftwareMRRepository struct {
	pool *pgxpool.Pool
}

func NewSoftwareMRRepository(pool *pgxpool.Pool) *SoftwareMRRepository {
	return &SoftwareMRRepository{pool: pool}
}

// List returns paginated Software MR releases with filtering
func (r *SoftwareMRRepository) List(ctx context.Context, search, pic, modelName, status, date string, limit, offset int) ([]model.SoftwareMRRelease, int, error) {
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		s := "%" + strings.ToLower(search) + "%"
		where = append(where, fmt.Sprintf("(LOWER(model) LIKE $%d OR LOWER(ap) LIKE $%d OR LOWER(cp) LIKE $%d OR LOWER(csc) LIKE $%d OR LOWER(pic) LIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, s)
		argIdx++
	}

	if pic != "" {
		where = append(where, fmt.Sprintf("UPPER(pic) = UPPER($%d)", argIdx))
		args = append(args, pic)
		argIdx++
	}

	if modelName != "" {
		where = append(where, fmt.Sprintf("model = $%d", argIdx))
		args = append(args, modelName)
		argIdx++
	}

	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if date != "" {
		if len(date) == 7 { // YYYY-MM
			where = append(where, fmt.Sprintf("TO_CHAR(created_at, 'YYYY-MM') = $%d", argIdx))
			args = append(args, date)
			argIdx++
		} else if len(date) == 10 { // YYYY-MM-DD
			where = append(where, fmt.Sprintf("TO_CHAR(created_at, 'YYYY-MM-DD') = $%d", argIdx))
			args = append(args, date)
			argIdx++
		}
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM software_mr_releases WHERE %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count software mr releases: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT id, model, ole_version, oxm_olm_new_version, ap, cp, csc,
		       ap_mapping, cp_mapping, csc_version_up, status, pic,
		       release_note_format, created_at, updated_at
		FROM software_mr_releases
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query software mr releases: %w", err)
	}
	defer rows.Close()

	items := []model.SoftwareMRRelease{}
	for rows.Next() {
		var rel model.SoftwareMRRelease
		if err := rows.Scan(
			&rel.ID, &rel.Model, &rel.OLEVersion, &rel.OXMOLMNewVersion,
			&rel.AP, &rel.CP, &rel.CSC, &rel.APMapping, &rel.CPMapping,
			&rel.CSCVersionUp, &rel.Status, &rel.PIC, &rel.ReleaseNoteFormat,
			&rel.CreatedAt, &rel.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan software mr release: %w", err)
		}
		items = append(items, rel)
	}

	return items, total, nil
}

// GetStats returns summary KPI counts
func (r *SoftwareMRRepository) GetStats(ctx context.Context) (*model.SoftwareMRStats, error) {
	query := `
		SELECT
			COUNT(*) as total_releases,
			COUNT(DISTINCT model) as unique_models,
			COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_releases,
			COUNT(DISTINCT UPPER(pic)) FILTER (WHERE pic != '') as active_pics
		FROM software_mr_releases
		WHERE deleted_at IS NULL
	`
	var stats model.SoftwareMRStats
	if err := r.pool.QueryRow(ctx, query).Scan(
		&stats.TotalReleases,
		&stats.UniqueModels,
		&stats.TodayReleases,
		&stats.ActivePICs,
	); err != nil {
		return nil, fmt.Errorf("failed to get software mr stats: %w", err)
	}
	return &stats, nil
}

// GetFilters returns list of unique models, pics, and release years
func (r *SoftwareMRRepository) GetFilters(ctx context.Context) (*model.SoftwareMRFilters, error) {
	models := []string{}
	mRows, err := r.pool.Query(ctx, "SELECT DISTINCT model FROM software_mr_releases WHERE deleted_at IS NULL ORDER BY model ASC")
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var m string
			if err := mRows.Scan(&m); err == nil && m != "" {
				models = append(models, m)
			}
		}
	}

	pics := []string{}
	pRows, err := r.pool.Query(ctx, "SELECT DISTINCT UPPER(pic) FROM software_mr_releases WHERE deleted_at IS NULL AND pic != '' ORDER BY UPPER(pic) ASC")
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var p string
			if err := pRows.Scan(&p); err == nil && p != "" {
				pics = append(pics, p)
			}
		}
	}

	years := []int{}
	yRows, err := r.pool.Query(ctx, "SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int as y FROM software_mr_releases WHERE deleted_at IS NULL ORDER BY y DESC")
	if err == nil {
		defer yRows.Close()
		for yRows.Next() {
			var y int
			if err := yRows.Scan(&y); err == nil && y > 0 {
				years = append(years, y)
			}
		}
	}

	return &model.SoftwareMRFilters{
		Models: models,
		PICs:   pics,
		Years:  years,
	}, nil
}

// GetByID returns single release by primary key
func (r *SoftwareMRRepository) GetByID(ctx context.Context, id int) (*model.SoftwareMRRelease, error) {
	query := `
		SELECT id, model, ole_version, oxm_olm_new_version, ap, cp, csc,
		       ap_mapping, cp_mapping, csc_version_up, status, pic,
		       release_note_format, created_at, updated_at
		FROM software_mr_releases
		WHERE id = $1 AND deleted_at IS NULL
	`
	var rel model.SoftwareMRRelease
	if err := r.pool.QueryRow(ctx, query, id).Scan(
		&rel.ID, &rel.Model, &rel.OLEVersion, &rel.OXMOLMNewVersion,
		&rel.AP, &rel.CP, &rel.CSC, &rel.APMapping, &rel.CPMapping,
		&rel.CSCVersionUp, &rel.Status, &rel.PIC, &rel.ReleaseNoteFormat,
		&rel.CreatedAt, &rel.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &rel, nil
}

// GetDailyTrend returns daily release count for the last 30 days
func (r *SoftwareMRRepository) GetDailyTrend(ctx context.Context, modelName string) ([]model.DailyReleaseTrend, error) {
	query := `
		WITH latest AS (
			SELECT 
				CASE 
					WHEN EXISTS (SELECT 1 FROM software_mr_releases WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND deleted_at IS NULL)
					THEN CURRENT_DATE
					ELSE COALESCE((SELECT MAX(DATE(created_at)) FROM software_mr_releases WHERE deleted_at IS NULL), CURRENT_DATE)
				END AS end_date
		)
		SELECT 
			TO_CHAR(d::date, 'YYYY-MM-DD') AS date,
			TO_CHAR(d::date, 'DD Mon') AS label,
			COALESCE(COUNT(r.id), 0)::int AS count
		FROM latest,
		     generate_series(latest.end_date - INTERVAL '29 days', latest.end_date, '1 day'::interval) d
		LEFT JOIN software_mr_releases r 
			ON DATE(r.created_at) = d::date 
			AND r.deleted_at IS NULL
			AND ($1 = '' OR r.model = $1)
		GROUP BY d::date
		ORDER BY d::date ASC
	`
	rows, err := r.pool.Query(ctx, query, modelName)
	if err != nil {
		return nil, fmt.Errorf("failed to query daily release trend: %w", err)
	}
	defer rows.Close()

	var trends []model.DailyReleaseTrend
	for rows.Next() {
		var t model.DailyReleaseTrend
		if err := rows.Scan(&t.Date, &t.Label, &t.Count); err != nil {
			return nil, fmt.Errorf("failed to scan daily release trend: %w", err)
		}
		trends = append(trends, t)
	}
	return trends, nil
}
