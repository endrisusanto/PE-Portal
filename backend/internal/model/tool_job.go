package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ToolJob struct {
	ID              uuid.UUID       `json:"id"`
	UserID          *uuid.UUID      `json:"user_id,omitempty"`
	ToolType        string          `json:"tool_type"` // "video-compress", "remove-bg", "compress-pdf", "merge-pdf", "split-pdf", "pptx-summary"
	FileName        string          `json:"file_name"`
	FileSize        int64           `json:"file_size"`
	Status          string          `json:"status"` // "pending", "processing", "completed", "failed", "cancelled"
	ProgressPercent float64         `json:"progress_percent"`
	CurrentStep     string          `json:"current_step"`
	OutputPath      string          `json:"output_path,omitempty"`
	ResultURL       string          `json:"result_url,omitempty"`
	ResultMeta      json.RawMessage `json:"result_meta,omitempty"`
	ErrorMessage    string          `json:"error_message,omitempty"`
	DurationSec     float64         `json:"duration_sec"`
	CreatedAt       time.Time       `json:"created_at"`
	StartedAt       *time.Time      `json:"started_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type NotificationChangeLog struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // "ecn", "milestone", "system"
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Tag       string    `json:"tag,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Link      string    `json:"link,omitempty"`
}

type NotificationSummary struct {
	ToolsProgress   []ToolJob               `json:"tools_progress"`
	ChangeLogs      []NotificationChangeLog `json:"change_logs"`
	ActiveJobsCount int                     `json:"active_jobs_count"`
	UnreadLogsCount int                     `json:"unread_logs_count"`
}

