package model

import "time"

// TrainingModule represents an online employee training course
type TrainingModule struct {
	ID           int        `json:"id"`
	Title        string     `json:"title"`
	Category     string     `json:"category"`
	Description  string     `json:"description"`
	LinkURL      string     `json:"link_url"`
	Deadline     *time.Time `json:"deadline"`
	IsMandatory  bool       `json:"is_mandatory"`
	BannerImage  string     `json:"banner_image"`
	HasAnswerKey bool       `json:"has_answer_key"`
	IsLocked     bool       `json:"is_locked"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// TrainingAnswerKey is returned only after entering the correct password
type TrainingAnswerKey struct {
	ID              int      `json:"id"`
	Title           string   `json:"title"`
	AnswerKeyImages []string `json:"answer_key_images"`
	AnswerKeyNotes  string   `json:"answer_key_notes"`
}

// TrainingUnlockRequest payload to unlock answer key
type TrainingUnlockRequest struct {
	Password string `json:"password"`
}

// TrainingCreateRequest payload to create/update training
type TrainingCreateRequest struct {
	Title             string   `json:"title"`
	Category          string   `json:"category"`
	Description       string   `json:"description"`
	LinkURL           string   `json:"link_url"`
	Deadline          string   `json:"deadline"`
	IsMandatory       bool     `json:"is_mandatory"`
	BannerImage       string   `json:"banner_image"`
	HasAnswerKey      bool     `json:"has_answer_key"`
	AnswerKeyPassword string   `json:"answer_key_password"`
	AnswerKeyImages   []string `json:"answer_key_images"`
	AnswerKeyNotes    string   `json:"answer_key_notes"`
}
