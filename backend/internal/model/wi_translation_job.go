package model

import (
	"time"

	"github.com/google/uuid"
)

type WITranslationJob struct {
	ID              uuid.UUID  `json:"id"`
	UserID          *uuid.UUID `json:"user_id,omitempty"`
	FileName        string     `json:"file_name"`
	FilePath        string     `json:"file_path"`
	FileSize        int64      `json:"file_size"`
	TargetLang      string     `json:"target_lang"`
	Mode            string     `json:"mode"`
	Status          string     `json:"status"` // "pending", "processing", "completed", "failed"
	CurrentPage     int        `json:"current_page"`
	TotalPages      int        `json:"total_pages"`
	ProgressPercent float64    `json:"progress_percent"`
	Message         string     `json:"message"`
	TranslatedCount int        `json:"translated_count"`
	DurationSec     float64    `json:"duration_sec"`
	TranslatedFile  string     `json:"translated_file,omitempty"`
	DownloadURL     string     `json:"download_url,omitempty"`
	ErrorMessage    string     `json:"error_message,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
