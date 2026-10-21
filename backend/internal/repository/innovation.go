package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type InnovationRepository struct {
	pool *pgxpool.Pool
}

func NewInnovationRepository(pool *pgxpool.Pool) *InnovationRepository {
	return &InnovationRepository{pool: pool}
}

func (r *InnovationRepository) List(ctx context.Context, category, status, classType string, groupID *uuid.UUID) ([]model.Innovation, error) {
	query := `
		SELECT i.id, i.title, i.description, i.category, COALESCE(i.class_type, 'Class 4'), i.status,
		       i.author_id, u.full_name as author_name,
		       i.group_part_id, gp.name as group_part_name,
		       i.impact_score, i.attachments, i.created_at, i.updated_at
		FROM innovations i
		LEFT JOIN users u ON i.author_id = u.id
		LEFT JOIN group_parts gp ON i.group_part_id = gp.id
		WHERE i.deleted_at IS NULL
		  AND ($1 = '' OR i.category = $1)
		  AND ($2 = '' OR i.status = $2)
		  AND ($3 = '' OR i.class_type = $3)
		  AND ($4::uuid IS NULL OR i.group_part_id = $4)
		ORDER BY i.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, category, status, classType, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list innovations: %w", err)
	}
	defer rows.Close()

	items := []model.Innovation{}
	for rows.Next() {
		var item model.Innovation
		err := rows.Scan(
			&item.ID, &item.Title, &item.Description, &item.Category, &item.ClassType, &item.Status,
			&item.AuthorID, &item.AuthorName,
			&item.GroupPartID, &item.GroupPartName,
			&item.ImpactScore, &item.Attachments, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *InnovationRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Innovation, error) {
	query := `
		SELECT i.id, i.title, i.description, i.category, COALESCE(i.class_type, 'Class 4'), i.status,
		       i.author_id, u.full_name as author_name,
		       i.group_part_id, gp.name as group_part_name,
		       i.impact_score, i.attachments, i.created_at, i.updated_at
		FROM innovations i
		LEFT JOIN users u ON i.author_id = u.id
		LEFT JOIN group_parts gp ON i.group_part_id = gp.id
		WHERE i.id = $1 AND i.deleted_at IS NULL
	`

	var item model.Innovation
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&item.ID, &item.Title, &item.Description, &item.Category, &item.ClassType, &item.Status,
		&item.AuthorID, &item.AuthorName,
		&item.GroupPartID, &item.GroupPartName,
		&item.ImpactScore, &item.Attachments, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *InnovationRepository) Create(ctx context.Context, item *model.Innovation) (*model.Innovation, error) {
	if item.ID == uuid.Nil {
		item.ID = uuid.New()
	}
	if item.Status == "" {
		item.Status = "draft"
	}
	if item.ClassType == "" {
		item.ClassType = "Class 4"
	}
	if len(item.Attachments) == 0 {
		item.Attachments = json.RawMessage("[]")
	}

	query := `
		INSERT INTO innovations (id, title, description, category, class_type, status, author_id, group_part_id, impact_score, attachments)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		item.ID, item.Title, item.Description, item.Category, item.ClassType, item.Status,
		item.AuthorID, item.GroupPartID, item.ImpactScore, item.Attachments,
	).Scan(&item.CreatedAt, &item.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create innovation: %w", err)
	}

	return r.GetByID(ctx, item.ID)
}

func (r *InnovationRepository) Update(ctx context.Context, item *model.Innovation) (*model.Innovation, error) {
	if item.ClassType == "" {
		item.ClassType = "Class 4"
	}

	query := `
		UPDATE innovations
		SET title = $1, description = $2, category = $3, class_type = $4, impact_score = $5,
		    group_part_id = $6, updated_at = NOW()
		WHERE id = $7 AND deleted_at IS NULL
	`
	_, err := r.pool.Exec(ctx, query,
		item.Title, item.Description, item.Category, item.ClassType, item.ImpactScore,
		item.GroupPartID, item.ID,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, item.ID)
}

func (r *InnovationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE innovations SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`
	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *InnovationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE innovations SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// GetStats compiles monthly performance matrix and class distribution (BP MXPE reference)
func (r *InnovationRepository) GetStats(ctx context.Context, year int) (*model.InnovationStatsResponse, error) {
	if year <= 0 {
		year = time.Now().Year()
	}

	// 1. Available years
	yearsQuery := `
		SELECT DISTINCT y FROM (
			SELECT EXTRACT(YEAR FROM created_at)::int AS y FROM innovations WHERE deleted_at IS NULL
			UNION
			SELECT year AS y FROM innovation_targets
		) sub
		WHERE y IS NOT NULL
		ORDER BY y DESC
	`
	availableYears := []int{}
	yRows, err := r.pool.Query(ctx, yearsQuery)
	if err == nil {
		for yRows.Next() {
			var y int
			if err := yRows.Scan(&y); err == nil {
				availableYears = append(availableYears, y)
			}
		}
		yRows.Close()
	}
	if len(availableYears) == 0 {
		availableYears = append(availableYears, year)
	}

	// 2. Initialize 12 monthly slots
	monthNames := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Des"}
	monthlyStats := make([]model.InnovationMonthlyStat, 12)
	for i := 0; i < 12; i++ {
		monthlyStats[i] = model.InnovationMonthlyStat{
			Month:     i + 1,
			MonthName: monthNames[i],
		}
	}

	// 3. Query monthly actuals and class breakdown for target year
	actualQuery := `
		SELECT
			EXTRACT(MONTH FROM created_at)::int AS m,
			COUNT(*) AS actual_register,
			COUNT(*) FILTER (WHERE class_type = 'Class 3') AS c3,
			COUNT(*) FILTER (WHERE class_type = 'Class 4') AS c4,
			COUNT(*) FILTER (WHERE class_type = 'Class 5') AS c5,
			COUNT(*) FILTER (WHERE class_type = 'Non Adopt') AS non_adopt,
			COUNT(*) FILTER (WHERE class_type = 'Under Review') AS under_review
		FROM innovations
		WHERE deleted_at IS NULL AND EXTRACT(YEAR FROM created_at)::int = $1
		GROUP BY m
	`
	actRows, err := r.pool.Query(ctx, actualQuery, year)
	if err != nil {
		return nil, fmt.Errorf("failed to query innovation stats: %w", err)
	}
	defer actRows.Close()

	for actRows.Next() {
		var m, actual, c3, c4, c5, nonAdopt, underReview int
		if err := actRows.Scan(&m, &actual, &c3, &c4, &c5, &nonAdopt, &underReview); err == nil && m >= 1 && m <= 12 {
			monthlyStats[m-1].ActualRegister = actual
			monthlyStats[m-1].Class3 = c3
			monthlyStats[m-1].Class4 = c4
			monthlyStats[m-1].Class5 = c5
			monthlyStats[m-1].NonAdopt = nonAdopt
			monthlyStats[m-1].UnderReview = underReview
		}
	}

	// 4. Query monthly targets
	targetQuery := `
		SELECT month, target_register, target_challenge
		FROM innovation_targets
		WHERE year = $1
	`
	tarRows, err := r.pool.Query(ctx, targetQuery, year)
	if err == nil {
		for tarRows.Next() {
			var m, tReg, tChal int
			if err := tarRows.Scan(&m, &tReg, &tChal); err == nil && m >= 1 && m <= 12 {
				monthlyStats[m-1].TargetRegister = tReg
				monthlyStats[m-1].TargetChallenge = tChal
			}
		}
		tarRows.Close()
	}

	// 5. Calculate monthly TargetMet and year totals
	var totalActual, totalTarget, totalChallenge int
	var totalC3, totalC4, totalC5, totalNonAdopt, totalUnderReview int

	for i := range monthlyStats {
		m := &monthlyStats[i]
		if m.ActualRegister > 0 || m.TargetRegister > 0 {
			m.TargetMet = m.ActualRegister >= m.TargetRegister
		}
		totalActual += m.ActualRegister
		totalTarget += m.TargetRegister
		totalChallenge += m.TargetChallenge
		totalC3 += m.Class3
		totalC4 += m.Class4
		totalC5 += m.Class5
		totalNonAdopt += m.NonAdopt
		totalUnderReview += m.UnderReview
	}

	var achRate, adoptedRate float64
	if totalTarget > 0 {
		achRate = (float64(totalActual) / float64(totalTarget)) * 100.0
	}
	adoptedCount := totalC3 + totalC4 + totalC5
	if totalActual > 0 {
		adoptedRate = (float64(adoptedCount) / float64(totalActual)) * 100.0
	}

	// 6. Class distribution
	classDist := []model.InnovationClassDistribution{
		{Name: "Class 3", Count: totalC3, Color: "#e05780"},
		{Name: "Class 4", Count: totalC4, Color: "#2563eb"},
		{Name: "Class 5", Count: totalC5, Color: "#059669"},
		{Name: "Under Review", Count: totalUnderReview, Color: "#d97706"},
		{Name: "Non Adopt", Count: totalNonAdopt, Color: "#6b7280"},
	}
	for i := range classDist {
		if totalActual > 0 {
			classDist[i].Percentage = (float64(classDist[i].Count) / float64(totalActual)) * 100.0
		}
	}

	resp := &model.InnovationStatsResponse{
		Year:              year,
		AvailableYears:    availableYears,
		TotalActual:       totalActual,
		TotalTarget:       totalTarget,
		TotalChallenge:    totalChallenge,
		AchievementRate:   achRate,
		AdoptedRate:       adoptedRate,
		Class3Count:       totalC3,
		Class4Count:       totalC4,
		Class5Count:       totalC5,
		UnderReviewCount:  totalUnderReview,
		NonAdoptCount:     totalNonAdopt,
		Monthly:           monthlyStats,
		ClassDistribution: classDist,
	}

	return resp, nil
}

// SaveTarget upserts target values for a given month and year
func (r *InnovationRepository) SaveTarget(ctx context.Context, year, month, targetRegister, targetChallenge int) error {
	query := `
		INSERT INTO innovation_targets (year, month, target_register, target_challenge, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (year, month) DO UPDATE SET
			target_register = EXCLUDED.target_register,
			target_challenge = EXCLUDED.target_challenge,
			updated_at = NOW()
	`
	_, err := r.pool.Exec(ctx, query, year, month, targetRegister, targetChallenge)
	return err
}
