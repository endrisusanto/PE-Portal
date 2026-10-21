package model

import "time"

// SoftwareMRRelease represents a software maintenance release firmware record
type SoftwareMRRelease struct {
	ID                int        `json:"id"`
	Model             string     `json:"model"`
	OLEVersion        string     `json:"ole_version"`
	OXMOLMNewVersion  string     `json:"oxm_olm_new_version"`
	AP                string     `json:"ap"`
	CP                string     `json:"cp"`
	CSC               string     `json:"csc"`
	APMapping         string     `json:"ap_mapping"`
	CPMapping         string     `json:"cp_mapping"`
	CSCVersionUp      string     `json:"csc_version_up"`
	Status            string     `json:"status"` // 'DONE', 'IN PROGRESS', 'PENDING', 'DELAYED'
	PIC               string     `json:"pic"`
	ReleaseNoteFormat string     `json:"release_note_format"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"deleted_at,omitempty"`
}

// SoftwareMRStats provides dashboard KPIs for Software MR
type SoftwareMRStats struct {
	TotalReleases int `json:"total_releases"`
	UniqueModels  int `json:"unique_models"`
	TodayReleases int `json:"today_releases"`
	ActivePICs    int `json:"active_pics"`
}

// SoftwareMRFilters provides dropdown choices for filtering
type SoftwareMRFilters struct {
	Models []string `json:"models"`
	PICs   []string `json:"pics"`
	Years  []int    `json:"years"`
}
