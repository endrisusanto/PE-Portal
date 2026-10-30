package model

import (
	"time"

	"github.com/google/uuid"
)

// ECNReminderSettings defines scheduling and recipient configuration for Running BOM alerts.
type ECNReminderSettings struct {
	ID             uuid.UUID `json:"id"`
	IsEnabled      bool      `json:"is_enabled"`
	DaysBefore     int       `json:"days_before"`
	SendTime       string    `json:"send_time"` // Format "HH:MM" e.g. "08:00"
	Recipients     string    `json:"recipients"`
	CCRecipients   string    `json:"cc_recipients"`
	EmailSubject   string    `json:"email_subject"`
	IncludeOverdue bool      `json:"include_overdue"`
	LastSentDate   string    `json:"last_sent_date"` // "YYYY-MM-DD"
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// ponytail: Realtime BOM date change notification settings
	BOMChangeNotifyEnabled bool   `json:"bom_change_notify_enabled"`
	BOMChangeRecipients    string `json:"bom_change_recipients"`
	BOMChangeCCRecipients  string `json:"bom_change_cc_recipients"`
	BOMChangeEmailSubject  string `json:"bom_change_email_subject"`
}

// ECNReminderLog tracks email delivery history for reminders.
type ECNReminderLog struct {
	ID           uuid.UUID `json:"id"`
	SentAt       time.Time `json:"sent_at"`
	Recipients   string    `json:"recipients"`
	CCRecipients string    `json:"cc_recipients"`
	ItemCount    int       `json:"item_count"`
	ECNNumbers   string    `json:"ecn_numbers"`
	Status       string    `json:"status"` // "SUCCESS" or "FAILED"
	ErrorMessage string    `json:"error_message,omitempty"`
	TriggeredBy  string    `json:"triggered_by"` // "SCHEDULE" or "MANUAL_TEST"
}

// ECNReminderStatusResponse provides active settings and real-time preview of due items.
type ECNReminderStatusResponse struct {
	Settings   ECNReminderSettings `json:"settings"`
	DueCount   int                 `json:"due_count"`
	DueRecords []ECNRecord         `json:"due_records"`
	TargetDate string              `json:"target_date"`
	LastLog    *ECNReminderLog     `json:"last_log,omitempty"`
}
