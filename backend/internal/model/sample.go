package model

import "time"

// Sample represents a physical engineering/testing device or asset
type Sample struct {
	ID              int        `json:"id"`
	AssetNumber     string     `json:"asset_number"`
	Model           string     `json:"model"`
	SerialNumber    string     `json:"serial_number"`
	Category        string     `json:"category"`
	StatusPinjam    string     `json:"status_pinjam"` // 'AVAILABLE' | 'PINJAM'
	BorrowerName    string     `json:"borrower_name"`
	BorrowedAt      *time.Time `json:"borrowed_at,omitempty"`
	PICSample       string     `json:"pic_sample"`
	Location        string     `json:"location"`
	ConditionStatus string     `json:"condition_status"` // 'Normal', 'Defect (...)'
	OctaStatus      string     `json:"octa_status"`
	IMEI            string     `json:"imei"`
	UNCode          string     `json:"un_code"`
	HWRev           string     `json:"hw_rev"`
	Notes           string     `json:"notes"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`

	// Calculated helpers
	DurationFormatted string `json:"duration_formatted,omitempty"`
}

// SampleFlow represents loan & return history log
type SampleFlow struct {
	ID           int       `json:"id"`
	SampleID     *int      `json:"sample_id,omitempty"`
	AssetNumber  string    `json:"asset_number"`
	Model        string    `json:"model"`
	BorrowerName string    `json:"borrower_name"`
	Action       string    `json:"action"` // 'PINJAM', 'KEMBALI', 'TRANSFER'
	Notes        string    `json:"notes"`
	Timestamp    time.Time `json:"timestamp"`
}

// SampleStats provides high-level summary KPIs
type SampleStats struct {
	TotalSamples    int `json:"total_samples"`
	Borrowed        int `json:"borrowed"`
	Available       int `json:"available"`
	Defects         int `json:"defects"`
	ActiveBorrowers int `json:"active_borrowers"`
}

// BorrowerGroup represents card of active loans grouped by borrower
type BorrowerGroup struct {
	BorrowerName string   `json:"borrower_name"`
	Count        int      `json:"count"`
	Items        []Sample `json:"items"`
}

// ModelMatrixCard represents card in Matrix Card View
type ModelMatrixCard struct {
	Model     string   `json:"model"`
	Total     int      `json:"total"`
	Borrowed  int      `json:"borrowed"`
	Available int      `json:"available"`
	Defects   int      `json:"defects"`
	Items     []Sample `json:"items"`
}

// ScanRequest is input for quick 1-step borrow/return
type ScanRequest struct {
	AssetNumber  string `json:"asset_number"`
	BorrowerName string `json:"borrower_name"`
	Action       string `json:"action,omitempty"` // optional force: 'PINJAM' | 'KEMBALI'
	Notes        string `json:"notes,omitempty"`
}

// ScanResponse is the result of borrow/return scan
type ScanResponse struct {
	Success bool    `json:"success"`
	Action  string  `json:"action"` // 'PINJAM', 'KEMBALI', 'TRANSFER', 'TIDAK_TERSEDIA'
	Message string  `json:"message"`
	Sample  *Sample `json:"sample,omitempty"`
}

// BulkReturnRequest allows returning multiple assets for a borrower
type BulkReturnRequest struct {
	BorrowerName string   `json:"borrower_name"`
	Assets       []string `json:"assets"`
}
