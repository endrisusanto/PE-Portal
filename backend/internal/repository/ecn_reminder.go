package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"pe-portal/internal/model"
)

type ECNReminderRepository struct {
	pool *pgxpool.Pool
}

func NewECNReminderRepository(pool *pgxpool.Pool) *ECNReminderRepository {
	return &ECNReminderRepository{pool: pool}
}

// GetSettings fetches current ECN reminder settings or creates a default if none exist
func (r *ECNReminderRepository) GetSettings(ctx context.Context) (*model.ECNReminderSettings, error) {
	query := `
		SELECT id, is_enabled, days_before, send_time, recipients, cc_recipients,
		       email_subject, include_overdue, last_sent_date, created_at, updated_at,
		       COALESCE(bom_change_notify_enabled, TRUE),
		       COALESCE(bom_change_recipients, ''),
		       COALESCE(bom_change_cc_recipients, ''),
		       COALESCE(bom_change_email_subject, '[UPDATE] Perubahan Jadwal Running BOM - {ecn_no} ({model})')
		FROM ecn_reminder_settings
		ORDER BY created_at ASC
		LIMIT 1
	`
	var s model.ECNReminderSettings
	err := r.pool.QueryRow(ctx, query).Scan(
		&s.ID, &s.IsEnabled, &s.DaysBefore, &s.SendTime, &s.Recipients, &s.CCRecipients,
		&s.EmailSubject, &s.IncludeOverdue, &s.LastSentDate, &s.CreatedAt, &s.UpdatedAt,
		&s.BOMChangeNotifyEnabled, &s.BOMChangeRecipients, &s.BOMChangeCCRecipients, &s.BOMChangeEmailSubject,
	)
	if err != nil {
		// Insert default row
		insertQ := `
			INSERT INTO ecn_reminder_settings (is_enabled, days_before, send_time, recipients, email_subject, include_overdue,
			                                  bom_change_notify_enabled, bom_change_recipients, bom_change_email_subject)
			VALUES (TRUE, 1, '08:00', 'endri.s@samsung.com', '[REMINDER] ECN Running BOM Deadline Alert - SEIN PE', TRUE,
			        TRUE, 'endri.s@samsung.com', '[UPDATE] Perubahan Jadwal Running BOM - {ecn_no} ({model})')
			RETURNING id, is_enabled, days_before, send_time, recipients, cc_recipients,
			          email_subject, include_overdue, last_sent_date, created_at, updated_at,
			          bom_change_notify_enabled, bom_change_recipients, bom_change_cc_recipients, bom_change_email_subject
		`
		if insertErr := r.pool.QueryRow(ctx, insertQ).Scan(
			&s.ID, &s.IsEnabled, &s.DaysBefore, &s.SendTime, &s.Recipients, &s.CCRecipients,
			&s.EmailSubject, &s.IncludeOverdue, &s.LastSentDate, &s.CreatedAt, &s.UpdatedAt,
			&s.BOMChangeNotifyEnabled, &s.BOMChangeRecipients, &s.BOMChangeCCRecipients, &s.BOMChangeEmailSubject,
		); insertErr != nil {
			return nil, fmt.Errorf("failed to create default reminder settings: %w", insertErr)
		}
	}
	return &s, nil
}

// SaveSettings updates existing settings or inserts new
func (r *ECNReminderRepository) SaveSettings(ctx context.Context, s *model.ECNReminderSettings) (*model.ECNReminderSettings, error) {
	current, err := r.GetSettings(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		UPDATE ecn_reminder_settings
		SET is_enabled = $1,
		    days_before = $2,
		    send_time = $3,
		    recipients = $4,
		    cc_recipients = $5,
		    email_subject = $6,
		    include_overdue = $7,
		    bom_change_notify_enabled = $8,
		    bom_change_recipients = $9,
		    bom_change_cc_recipients = $10,
		    bom_change_email_subject = $11,
		    updated_at = NOW()
		WHERE id = $12
		RETURNING id, is_enabled, days_before, send_time, recipients, cc_recipients,
		          email_subject, include_overdue, last_sent_date, created_at, updated_at,
		          bom_change_notify_enabled, bom_change_recipients, bom_change_cc_recipients, bom_change_email_subject
	`
	var updated model.ECNReminderSettings
	err = r.pool.QueryRow(ctx, query,
		s.IsEnabled, s.DaysBefore, strings.TrimSpace(s.SendTime),
		strings.TrimSpace(s.Recipients), strings.TrimSpace(s.CCRecipients),
		strings.TrimSpace(s.EmailSubject), s.IncludeOverdue,
		s.BOMChangeNotifyEnabled, strings.TrimSpace(s.BOMChangeRecipients),
		strings.TrimSpace(s.BOMChangeCCRecipients), strings.TrimSpace(s.BOMChangeEmailSubject),
		current.ID,
	).Scan(
		&updated.ID, &updated.IsEnabled, &updated.DaysBefore, &updated.SendTime,
		&updated.Recipients, &updated.CCRecipients, &updated.EmailSubject,
		&updated.IncludeOverdue, &updated.LastSentDate, &updated.CreatedAt, &updated.UpdatedAt,
		&updated.BOMChangeNotifyEnabled, &updated.BOMChangeRecipients, &updated.BOMChangeCCRecipients, &updated.BOMChangeEmailSubject,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update reminder settings: %w", err)
	}
	return &updated, nil
}

// UpdateLastSentDate records the date string e.g. "2026-10-29" on which reminder was dispatched
func (r *ECNReminderRepository) UpdateLastSentDate(ctx context.Context, id uuid.UUID, dateStr string) error {
	_, err := r.pool.Exec(ctx, "UPDATE ecn_reminder_settings SET last_sent_date = $1, updated_at = NOW() WHERE id = $2", dateStr, id)
	return err
}

// parseDateString normalizes multi-format date strings into time.Time (year, month, day)
func parseDateString(raw string) (time.Time, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "-" {
		return time.Time{}, false
	}

	layouts := []string{
		"2006-01-02",
		"1/2/2006",
		"01/02/2006",
		"2006/01/02",
		"2/1/2006",
		"02/01/2006",
		"2006.01.02",
	}

	for _, l := range layouts {
		if t, err := time.Parse(l, trimmed); err == nil {
			return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), true
		}
	}
	return time.Time{}, false
}

// GetDueRunningBOMRecords retrieves active ECN records due for Running BOM notification
func (r *ECNReminderRepository) GetDueRunningBOMRecords(ctx context.Context, targetDate time.Time, includeOverdue bool) ([]model.ECNRecord, error) {
	// Normalize targetDate to midnight UTC
	targetMidnight := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, time.UTC)
	todayMidnight := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.UTC)

	query := `
		SELECT e.id, e.ecn_no, COALESCE(e.model, ''), COALESCE(e.function_type, ''),
		       COALESCE(e.purpose, ''), COALESCE(e.inventory_mgmt, ''), COALESCE(e.process, ''),
		       COALESCE(e.ec_title, ''), COALESCE(e.parent_code, ''), COALESCE(e.parent_name, ''),
		       COALESCE(e.part_before, ''), COALESCE(e.part_after, ''),
		       COALESCE(e.before_after, ''), COALESCE(e.dl, ''), COALESCE(e.child_code, ''),
		       COALESCE(e.child_name, ''), COALESCE(e.specification, ''), COALESCE(e.quantity, ''),
		       COALESCE(e.marking_point, ''), COALESCE(e.running_date_bom, ''), COALESCE(e.distribution_date, ''),
		       COALESCE(e.status, 'Pending'), COALESCE(e.remark, ''), e.created_by,
		       COALESCE(u.full_name, u.username, 'System') as author_name,
		       e.created_at, e.updated_at
		FROM ecn_records e
		LEFT JOIN users u ON e.created_by = u.id
		WHERE LOWER(COALESCE(e.status, '')) NOT IN ('completed', 'eco cancel')
		  AND e.running_date_bom IS NOT NULL
		  AND TRIM(e.running_date_bom) != ''
		  AND TRIM(e.running_date_bom) != '-'
		  AND (COALESCE(e.part_before, '') != '' OR COALESCE(e.part_after, '') != '')
		ORDER BY e.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active ecn records for reminder: %w", err)
	}
	defer rows.Close()

	var dueList []model.ECNRecord
	for rows.Next() {
		var rec model.ECNRecord
		if err := rows.Scan(
			&rec.ID, &rec.ECNNo, &rec.Model, &rec.FunctionType,
			&rec.Purpose, &rec.InventoryMgmt, &rec.Process,
			&rec.ECTitle, &rec.ParentCode, &rec.ParentName,
			&rec.PartBefore, &rec.PartAfter,
			&rec.BeforeAfter, &rec.DL, &rec.ChildCode,
			&rec.ChildName, &rec.Specification, &rec.Quantity,
			&rec.MarkingPoint, &rec.RunningDateBOM, &rec.DistributionDate,
			&rec.Status, &rec.Remark, &rec.CreatedBy,
			&rec.AuthorName, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			continue
		}

		bomDate, ok := parseDateString(rec.RunningDateBOM)
		if !ok {
			continue
		}

		// Filter criteria:
		// 1. Matches targetDate (e.g. tomorrow / H-1)
		// 2. OR if includeOverdue is true and bomDate is before targetDate (including today or earlier)
		if bomDate.Equal(targetMidnight) {
			dueList = append(dueList, rec)
		} else if includeOverdue && bomDate.Before(targetMidnight) {
			// Don't show prehistoric ancient dates older than 90 days
			if bomDate.After(todayMidnight.AddDate(0, 0, -90)) {
				dueList = append(dueList, rec)
			}
		}
	}

	return dueList, nil
}

// RecordLog saves a reminder dispatch record to ecn_reminder_logs
func (r *ECNReminderRepository) RecordLog(ctx context.Context, l *model.ECNReminderLog) error {
	query := `
		INSERT INTO ecn_reminder_logs (recipients, cc_recipients, item_count, ecn_numbers, status, error_message, triggered_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, sent_at
	`
	return r.pool.QueryRow(ctx, query,
		l.Recipients, l.CCRecipients, l.ItemCount, l.ECNNumbers,
		l.Status, l.ErrorMessage, l.TriggeredBy,
	).Scan(&l.ID, &l.SentAt)
}

// GetLogs returns recent reminder dispatch logs
func (r *ECNReminderRepository) GetLogs(ctx context.Context, limit int) ([]model.ECNReminderLog, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	query := `
		SELECT id, sent_at, COALESCE(recipients, ''), COALESCE(cc_recipients, ''),
		       item_count, COALESCE(ecn_numbers, ''), status, COALESCE(error_message, ''), triggered_by
		FROM ecn_reminder_logs
		ORDER BY sent_at DESC
		LIMIT $1
	`
	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.ECNReminderLog
	for rows.Next() {
		var l model.ECNReminderLog
		if err := rows.Scan(
			&l.ID, &l.SentAt, &l.Recipients, &l.CCRecipients,
			&l.ItemCount, &l.ECNNumbers, &l.Status, &l.ErrorMessage, &l.TriggeredBy,
		); err == nil {
			logs = append(logs, l)
		}
	}
	return logs, nil
}

// GetLastLog returns the most recent log
func (r *ECNReminderRepository) GetLastLog(ctx context.Context) (*model.ECNReminderLog, error) {
	logs, err := r.GetLogs(ctx, 1)
	if err != nil || len(logs) == 0 {
		return nil, err
	}
	return &logs[0], nil
}
