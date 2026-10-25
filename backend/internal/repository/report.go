package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type ReportRepository struct {
	pool *pgxpool.Pool
}

func NewReportRepository(pool *pgxpool.Pool) *ReportRepository {
	return &ReportRepository{pool: pool}
}

// ==========================================
// SMTP Configuration
// ==========================================

func (r *ReportRepository) GetDefaultSMTP(ctx context.Context) (*model.SMTPConfig, error) {
	query := `
		SELECT id, name, host, port, username, password, from_email, from_name, encryption, is_default, created_by, created_at, updated_at
		FROM smtp_configs
		WHERE is_default = true
		ORDER BY updated_at DESC
		LIMIT 1
	`
	var cfg model.SMTPConfig
	err := r.pool.QueryRow(ctx, query).Scan(
		&cfg.ID, &cfg.Name, &cfg.Host, &cfg.Port, &cfg.Username, &cfg.Password,
		&cfg.FromEmail, &cfg.FromName, &cfg.Encryption, &cfg.IsDefault, &cfg.CreatedBy,
		&cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *ReportRepository) SaveSMTP(ctx context.Context, cfg *model.SMTPConfig) (*model.SMTPConfig, error) {
	if cfg.ID == uuid.Nil {
		query := `
			INSERT INTO smtp_configs (name, host, port, username, password, from_email, from_name, encryption, is_default, created_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, name, host, port, username, password, from_email, from_name, encryption, is_default, created_by, created_at, updated_at
		`
		var saved model.SMTPConfig
		err := r.pool.QueryRow(ctx, query,
			cfg.Name, cfg.Host, cfg.Port, cfg.Username, cfg.Password,
			cfg.FromEmail, cfg.FromName, cfg.Encryption, cfg.IsDefault, cfg.CreatedBy,
		).Scan(
			&saved.ID, &saved.Name, &saved.Host, &saved.Port, &saved.Username, &saved.Password,
			&saved.FromEmail, &saved.FromName, &saved.Encryption, &saved.IsDefault, &saved.CreatedBy,
			&saved.CreatedAt, &saved.UpdatedAt,
		)
		return &saved, err
	}

	query := `
		UPDATE smtp_configs
		SET name = $1, host = $2, port = $3, username = $4, password = $5, from_email = $6, from_name = $7, encryption = $8, is_default = $9, updated_at = NOW()
		WHERE id = $10
		RETURNING id, name, host, port, username, password, from_email, from_name, encryption, is_default, created_by, created_at, updated_at
	`
	var updated model.SMTPConfig
	err := r.pool.QueryRow(ctx, query,
		cfg.Name, cfg.Host, cfg.Port, cfg.Username, cfg.Password,
		cfg.FromEmail, cfg.FromName, cfg.Encryption, cfg.IsDefault, cfg.ID,
	).Scan(
		&updated.ID, &updated.Name, &updated.Host, &updated.Port, &updated.Username, &updated.Password,
		&updated.FromEmail, &updated.FromName, &updated.Encryption, &updated.IsDefault, &updated.CreatedBy,
		&updated.CreatedAt, &updated.UpdatedAt,
	)
	return &updated, err
}

// ==========================================
// Report Templates (Personal + Shared)
// ==========================================

func (r *ReportRepository) ListTemplates(ctx context.Context, userID uuid.UUID) ([]model.ReportTemplate, error) {
	query := `
		SELECT t.id, t.title, t.description, t.category, t.content, t.is_shared, t.author_id, u.full_name, t.group_part_id, gp.name, t.created_at, t.updated_at
		FROM report_templates t
		LEFT JOIN users u ON t.author_id = u.id
		LEFT JOIN group_parts gp ON t.group_part_id = gp.id
		WHERE t.is_shared = true OR t.author_id = $1
		ORDER BY t.is_shared DESC, t.updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []model.ReportTemplate
	for rows.Next() {
		var t model.ReportTemplate
		var rawContent []byte
		if err := rows.Scan(
			&t.ID, &t.Title, &t.Description, &t.Category, &rawContent, &t.IsShared,
			&t.AuthorID, &t.AuthorName, &t.GroupPartID, &t.GroupPartName, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		t.Content = rawContent
		templates = append(templates, t)
	}
	return templates, nil
}

func (r *ReportRepository) GetTemplate(ctx context.Context, id uuid.UUID) (*model.ReportTemplate, error) {
	query := `
		SELECT t.id, t.title, t.description, t.category, t.content, t.is_shared, t.author_id, u.full_name, t.group_part_id, gp.name, t.created_at, t.updated_at
		FROM report_templates t
		LEFT JOIN users u ON t.author_id = u.id
		LEFT JOIN group_parts gp ON t.group_part_id = gp.id
		WHERE t.id = $1
	`
	var t model.ReportTemplate
	var rawContent []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Title, &t.Description, &t.Category, &rawContent, &t.IsShared,
		&t.AuthorID, &t.AuthorName, &t.GroupPartID, &t.GroupPartName, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.Content = rawContent
	return &t, nil
}

func (r *ReportRepository) CreateTemplate(ctx context.Context, t *model.ReportTemplate) (*model.ReportTemplate, error) {
	query := `
		INSERT INTO report_templates (title, description, category, content, is_shared, author_id, group_part_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, title, description, category, content, is_shared, author_id, group_part_id, created_at, updated_at
	`
	var saved model.ReportTemplate
	var rawContent []byte
	err := r.pool.QueryRow(ctx, query,
		t.Title, t.Description, t.Category, t.Content, t.IsShared, t.AuthorID, t.GroupPartID,
	).Scan(
		&saved.ID, &saved.Title, &saved.Description, &saved.Category, &rawContent, &saved.IsShared,
		&saved.AuthorID, &saved.GroupPartID, &saved.CreatedAt, &saved.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	saved.Content = rawContent
	return &saved, nil
}

func (r *ReportRepository) UpdateTemplate(ctx context.Context, t *model.ReportTemplate) (*model.ReportTemplate, error) {
	query := `
		UPDATE report_templates
		SET title = $1, description = $2, category = $3, content = $4, is_shared = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING id, title, description, category, content, is_shared, author_id, group_part_id, created_at, updated_at
	`
	var updated model.ReportTemplate
	var rawContent []byte
	err := r.pool.QueryRow(ctx, query,
		t.Title, t.Description, t.Category, t.Content, t.IsShared, t.ID,
	).Scan(
		&updated.ID, &updated.Title, &updated.Description, &updated.Category, &rawContent, &updated.IsShared,
		&updated.AuthorID, &updated.GroupPartID, &updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	updated.Content = rawContent
	return &updated, nil
}

func (r *ReportRepository) DeleteTemplate(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM report_templates WHERE id = $1", id)
	return err
}

// ==========================================
// Digital Reports
// ==========================================

func (r *ReportRepository) ListReports(ctx context.Context, userID uuid.UUID) ([]model.DigitalReport, error) {
	query := `
		SELECT dr.id, dr.title, dr.template_id, rt.title, dr.author_id, u.full_name, dr.report_date::text, dr.status, dr.content, dr.rendered_html, dr.recipients, dr.created_at, dr.updated_at
		FROM digital_reports dr
		LEFT JOIN report_templates rt ON dr.template_id = rt.id
		LEFT JOIN users u ON dr.author_id = u.id
		WHERE dr.author_id = $1
		ORDER BY dr.report_date DESC, dr.updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []model.DigitalReport
	for rows.Next() {
		var rep model.DigitalReport
		var rawContent, rawRecipients []byte
		if err := rows.Scan(
			&rep.ID, &rep.Title, &rep.TemplateID, &rep.TemplateName, &rep.AuthorID, &rep.AuthorName,
			&rep.ReportDate, &rep.Status, &rawContent, &rep.RenderedHTML, &rawRecipients, &rep.CreatedAt, &rep.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rep.Content = rawContent
		rep.Recipients = rawRecipients
		reports = append(reports, rep)
	}
	return reports, nil
}

func (r *ReportRepository) GetReport(ctx context.Context, id uuid.UUID) (*model.DigitalReport, error) {
	query := `
		SELECT dr.id, dr.title, dr.template_id, rt.title, dr.author_id, u.full_name, dr.report_date::text, dr.status, dr.content, dr.rendered_html, dr.recipients, dr.created_at, dr.updated_at
		FROM digital_reports dr
		LEFT JOIN report_templates rt ON dr.template_id = rt.id
		LEFT JOIN users u ON dr.author_id = u.id
		WHERE dr.id = $1
	`
	var rep model.DigitalReport
	var rawContent, rawRecipients []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&rep.ID, &rep.Title, &rep.TemplateID, &rep.TemplateName, &rep.AuthorID, &rep.AuthorName,
		&rep.ReportDate, &rep.Status, &rawContent, &rep.RenderedHTML, &rawRecipients, &rep.CreatedAt, &rep.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	rep.Content = rawContent
	rep.Recipients = rawRecipients
	return &rep, nil
}

func (r *ReportRepository) CreateReport(ctx context.Context, rep *model.DigitalReport) (*model.DigitalReport, error) {
	query := `
		INSERT INTO digital_reports (title, template_id, author_id, report_date, status, content, rendered_html, recipients)
		VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)
		RETURNING id, title, template_id, author_id, report_date::text, status, content, rendered_html, recipients, created_at, updated_at
	`
	var saved model.DigitalReport
	var rawContent, rawRecipients []byte
	err := r.pool.QueryRow(ctx, query,
		rep.Title, rep.TemplateID, rep.AuthorID, rep.ReportDate, rep.Status, rep.Content, rep.RenderedHTML, rep.Recipients,
	).Scan(
		&saved.ID, &saved.Title, &saved.TemplateID, &saved.AuthorID, &saved.ReportDate,
		&saved.Status, &rawContent, &saved.RenderedHTML, &rawRecipients, &saved.CreatedAt, &saved.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	saved.Content = rawContent
	saved.Recipients = rawRecipients
	return &saved, nil
}

func (r *ReportRepository) UpdateReport(ctx context.Context, rep *model.DigitalReport) (*model.DigitalReport, error) {
	query := `
		UPDATE digital_reports
		SET title = $1, template_id = $2, report_date = $3::date, status = $4, content = $5, rendered_html = $6, recipients = $7, updated_at = NOW()
		WHERE id = $8
		RETURNING id, title, template_id, author_id, report_date::text, status, content, rendered_html, recipients, created_at, updated_at
	`
	var updated model.DigitalReport
	var rawContent, rawRecipients []byte
	err := r.pool.QueryRow(ctx, query,
		rep.Title, rep.TemplateID, rep.ReportDate, rep.Status, rep.Content, rep.RenderedHTML, rep.Recipients, rep.ID,
	).Scan(
		&updated.ID, &updated.Title, &updated.TemplateID, &updated.AuthorID, &updated.ReportDate,
		&updated.Status, &rawContent, &updated.RenderedHTML, &rawRecipients, &updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	updated.Content = rawContent
	updated.Recipients = rawRecipients
	return &updated, nil
}

func (r *ReportRepository) DeleteReport(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM digital_reports WHERE id = $1", id)
	return err
}

// ==========================================
// Automated Report Schedules
// ==========================================

func (r *ReportRepository) ListSchedules(ctx context.Context, userID uuid.UUID) ([]model.ReportSchedule, error) {
	query := `
		SELECT s.id, s.user_id, u.full_name, s.template_id, t.title, s.smtp_config_id, s.title, s.cron_expression,
		       s.recipients, s.is_active, s.last_run_at, s.next_run_at, s.last_status, s.last_error, s.created_at, s.updated_at
		FROM report_schedules s
		LEFT JOIN users u ON s.user_id = u.id
		LEFT JOIN report_templates t ON s.template_id = t.id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []model.ReportSchedule
	for rows.Next() {
		var s model.ReportSchedule
		var rawRecipients []byte
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.UserName, &s.TemplateID, &s.TemplateName, &s.SMTPConfigID,
			&s.Title, &s.CronExpression, &rawRecipients, &s.IsActive, &s.LastRunAt, &s.NextRunAt,
			&s.LastStatus, &s.LastError, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		s.Recipients = rawRecipients
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func (r *ReportRepository) GetActiveSchedules(ctx context.Context) ([]model.ReportSchedule, error) {
	query := `
		SELECT s.id, s.user_id, u.full_name, s.template_id, t.title, s.smtp_config_id, s.title, s.cron_expression,
		       s.recipients, s.is_active, s.last_run_at, s.next_run_at, s.last_status, s.last_error, s.created_at, s.updated_at
		FROM report_schedules s
		LEFT JOIN users u ON s.user_id = u.id
		LEFT JOIN report_templates t ON s.template_id = t.id
		WHERE s.is_active = true
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []model.ReportSchedule
	for rows.Next() {
		var s model.ReportSchedule
		var rawRecipients []byte
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.UserName, &s.TemplateID, &s.TemplateName, &s.SMTPConfigID,
			&s.Title, &s.CronExpression, &rawRecipients, &s.IsActive, &s.LastRunAt, &s.NextRunAt,
			&s.LastStatus, &s.LastError, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		s.Recipients = rawRecipients
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func (r *ReportRepository) CreateSchedule(ctx context.Context, s *model.ReportSchedule) (*model.ReportSchedule, error) {
	query := `
		INSERT INTO report_schedules (user_id, template_id, smtp_config_id, title, cron_expression, recipients, is_active, next_run_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, user_id, template_id, smtp_config_id, title, cron_expression, recipients, is_active, last_run_at, next_run_at, last_status, last_error, created_at, updated_at
	`
	var saved model.ReportSchedule
	var rawRecipients []byte
	err := r.pool.QueryRow(ctx, query,
		s.UserID, s.TemplateID, s.SMTPConfigID, s.Title, s.CronExpression, s.Recipients, s.IsActive, s.NextRunAt,
	).Scan(
		&saved.ID, &saved.UserID, &saved.TemplateID, &saved.SMTPConfigID, &saved.Title, &saved.CronExpression,
		&rawRecipients, &saved.IsActive, &saved.LastRunAt, &saved.NextRunAt, &saved.LastStatus, &saved.LastError,
		&saved.CreatedAt, &saved.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	saved.Recipients = rawRecipients
	return &saved, nil
}

func (r *ReportRepository) UpdateSchedule(ctx context.Context, s *model.ReportSchedule) (*model.ReportSchedule, error) {
	query := `
		UPDATE report_schedules
		SET template_id = $1, smtp_config_id = $2, title = $3, cron_expression = $4, recipients = $5, is_active = $6, updated_at = NOW()
		WHERE id = $7
		RETURNING id, user_id, template_id, smtp_config_id, title, cron_expression, recipients, is_active, last_run_at, next_run_at, last_status, last_error, created_at, updated_at
	`
	var updated model.ReportSchedule
	var rawRecipients []byte
	err := r.pool.QueryRow(ctx, query,
		s.TemplateID, s.SMTPConfigID, s.Title, s.CronExpression, s.Recipients, s.IsActive, s.ID,
	).Scan(
		&updated.ID, &updated.UserID, &updated.TemplateID, &updated.SMTPConfigID, &updated.Title, &updated.CronExpression,
		&rawRecipients, &updated.IsActive, &updated.LastRunAt, &updated.NextRunAt, &updated.LastStatus, &updated.LastError,
		&updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	updated.Recipients = rawRecipients
	return &updated, nil
}

func (r *ReportRepository) UpdateScheduleExecution(ctx context.Context, id uuid.UUID, lastStatus string, lastErr *string, nextRun *time.Time) error {
	now := time.Now()
	query := `
		UPDATE report_schedules
		SET last_run_at = $1, last_status = $2, last_error = $3, next_run_at = $4, updated_at = NOW()
		WHERE id = $5
	`
	_, err := r.pool.Exec(ctx, query, now, lastStatus, lastErr, nextRun, id)
	return err
}

func (r *ReportRepository) DeleteSchedule(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM report_schedules WHERE id = $1", id)
	return err
}

// ==========================================
// Logs
// ==========================================

func (r *ReportRepository) CreateLog(ctx context.Context, l *model.ReportSendLog) error {
	query := `
		INSERT INTO report_send_logs (schedule_id, report_id, user_id, recipients, subject, status, error_message, sent_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`
	_, err := r.pool.Exec(ctx, query, l.ScheduleID, l.ReportID, l.UserID, l.Recipients, l.Subject, l.Status, l.ErrorMessage)
	return err
}

func (r *ReportRepository) ListLogs(ctx context.Context, userID *uuid.UUID, limit int) ([]model.ReportSendLog, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT l.id, l.schedule_id, l.report_id, l.user_id, u.full_name, l.recipients, l.subject, l.status, l.error_message, l.sent_at
		FROM report_send_logs l
		LEFT JOIN users u ON l.user_id = u.id
		WHERE ($1::uuid IS NULL OR l.user_id = $1)
		ORDER BY l.sent_at DESC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.ReportSendLog
	for rows.Next() {
		var l model.ReportSendLog
		var rawRecipients []byte
		if err := rows.Scan(
			&l.ID, &l.ScheduleID, &l.ReportID, &l.UserID, &l.UserName, &rawRecipients,
			&l.Subject, &l.Status, &l.ErrorMessage, &l.SentAt,
		); err != nil {
			return nil, err
		}
		l.Recipients = rawRecipients
		logs = append(logs, l)
	}
	return logs, nil
}

// ==========================================
// RAG & Database Scraping Engine
// ==========================================

type ScrapedActivities struct {
	User        model.User          `json:"user"`
	Tasks       []model.ProjectTask `json:"tasks"`
	Projects    []model.Project     `json:"projects"`
	Models      []model.NewModel    `json:"models"`
	Articles    []model.ImeiArticle `json:"articles"`
	Innovations []model.Innovation  `json:"innovations"`
	DHL         []DHLShipmentRecord `json:"dhl"`
	GeneratedAt time.Time           `json:"generated_at"`
}

// ScrapeMemberActivities extracts database records belonging to or worked on by this member
func (r *ReportRepository) ScrapeMemberActivities(ctx context.Context, userID uuid.UUID) (*ScrapedActivities, error) {
	activities := &ScrapedActivities{GeneratedAt: time.Now()}

	// 1. Get User info
	userQuery := `SELECT id, employee_id, username, email, full_name, role, group_part_id FROM users WHERE id = $1`
	_ = r.pool.QueryRow(ctx, userQuery, userID).Scan(
		&activities.User.ID, &activities.User.EmployeeID, &activities.User.Username,
		&activities.User.Email, &activities.User.FullName, &activities.User.Role, &activities.User.GroupPartID,
	)

	// 2. Tasks assigned to user
	taskQuery := `
		SELECT pt.id, pt.project_id, pt.title, pt.description, pt.status, pt.assignee_id, u.full_name, pt.due_date::text, pt.sort_order, pt.created_at, pt.updated_at
		FROM project_tasks pt
		LEFT JOIN users u ON pt.assignee_id = u.id
		WHERE pt.assignee_id = $1
		ORDER BY pt.updated_at DESC
		LIMIT 20
	`
	tRows, err := r.pool.Query(ctx, taskQuery, userID)
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var pt model.ProjectTask
			if err := tRows.Scan(
				&pt.ID, &pt.ProjectID, &pt.Title, &pt.Description, &pt.Status,
				&pt.AssigneeID, &pt.AssigneeName, &pt.DueDate, &pt.SortOrder, &pt.CreatedAt, &pt.UpdatedAt,
			); err == nil {
				activities.Tasks = append(activities.Tasks, pt)
			}
		}
	}

	// 3. Projects owned by user
	projQuery := `
		SELECT p.id, p.title, p.description, p.project_type, p.status, p.priority, p.owner_id, u.full_name, p.group_part_id, gp.name, p.start_date::text, p.target_date::text, p.completion_date::text, p.progress, p.metadata, p.created_at, p.updated_at
		FROM projects p
		LEFT JOIN users u ON p.owner_id = u.id
		LEFT JOIN group_parts gp ON p.group_part_id = gp.id
		WHERE p.owner_id = $1
		ORDER BY p.updated_at DESC
		LIMIT 10
	`
	pRows, err := r.pool.Query(ctx, projQuery, userID)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var p model.Project
			var rawMeta []byte
			if err := pRows.Scan(
				&p.ID, &p.Title, &p.Description, &p.ProjectType, &p.Status, &p.Priority,
				&p.OwnerID, &p.OwnerName, &p.GroupPartID, &p.GroupPartName,
				&p.StartDate, &p.TargetDate, &p.CompletionDate, &p.Progress, &rawMeta, &p.CreatedAt, &p.UpdatedAt,
			); err == nil {
				p.Metadata = rawMeta
				activities.Projects = append(activities.Projects, p)
			}
		}
	}

	// 4. New Models
	modelQuery := `
		SELECT m.id, m.model_name, m.codename, m.stage, m.description, m.project_id, m.owner_id, u.full_name, m.target_release::text, m.specifications, m.created_at, m.updated_at
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		ORDER BY m.updated_at DESC
		LIMIT 5
	`
	mRows, err := r.pool.Query(ctx, modelQuery)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var m model.NewModel
			var rawSpec []byte
			if err := mRows.Scan(
				&m.ID, &m.ModelName, &m.Codename, &m.Stage, &m.Description, &m.ProjectID,
				&m.OwnerID, &m.OwnerName, &m.TargetRelease, &rawSpec, &m.CreatedAt, &m.UpdatedAt,
			); err == nil {
				m.Specifications = rawSpec
				activities.Models = append(activities.Models, m)
			}
		}
	}

	// 5. DHL Express Shipments (recent 30 shipments)
	dhlQuery := `
		SELECT id, service_name, origin_country, origin_city, dest_country, dest_city, status_code, status_label, status_description, last_event_time, last_location, pic, is_collected, notes, created_at, updated_at
		FROM dhl_shipments
		ORDER BY updated_at DESC
		LIMIT 30
	`
	dRows, err := r.pool.Query(ctx, dhlQuery)
	if err == nil {
		defer dRows.Close()
		for dRows.Next() {
			var s DHLShipmentRecord
			if err := dRows.Scan(
				&s.ID, &s.ServiceName, &s.OriginCountry, &s.OriginCity, &s.DestCountry, &s.DestCity,
				&s.StatusCode, &s.StatusLabel, &s.StatusDescription, &s.LastEventTime, &s.LastLocation,
				&s.PIC, &s.IsCollected, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
			); err == nil {
				activities.DHL = append(activities.DHL, s)
			}
		}
	}

	return activities, nil
}
