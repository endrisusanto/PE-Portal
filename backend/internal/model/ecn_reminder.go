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

	// ponytail: BOM date change batch notification settings
	BOMChangeNotifyEnabled bool   `json:"bom_change_notify_enabled"`
	BOMChangeSendTime      string `json:"bom_change_send_time"` // "08:00, 13:00, 16:00"
	BOMChangeRecipients    string `json:"bom_change_recipients"`
	BOMChangeCCRecipients  string `json:"bom_change_cc_recipients"`
	BOMChangeEmailSubject  string `json:"bom_change_email_subject"`
}

// ECNBOMChangeItem represents an unnotified BOM change entry for batch email dispatch.
type ECNBOMChangeItem struct {
	LogID         uuid.UUID `json:"log_id"`
	ECNID         uuid.UUID `json:"ecn_id"`
	ECNNo         string    `json:"ecn_no"`
	Model         string    `json:"model"`
	Process       string    `json:"process"`
	Status        string    `json:"status"`
	ECTitle       string    `json:"ec_title"`
	OldDate       string    `json:"old_date"`
	NewDate       string    `json:"new_date"`
	ChangedByName string    `json:"changed_by_name"`
	PartBefore    string    `json:"part_before"`
	PartAfter     string    `json:"part_after"`
	Remark        string    `json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
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
	Settings              ECNReminderSettings `json:"settings"`
	DueCount              int                 `json:"due_count"`
	DueRecords            []ECNRecord         `json:"due_records"`
	TargetDate            string              `json:"target_date"`
	BOMChangePendingCount int                 `json:"bom_change_pending_count"`
	LastLog               *ECNReminderLog     `json:"last_log,omitempty"`
}
