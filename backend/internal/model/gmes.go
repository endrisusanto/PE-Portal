package model

import "time"

// GmesIssue represents a production line defect/worst item in GMES
type GmesIssue struct {
	ID             int       `json:"id"`
	Process        string    `json:"process"`
	LineName       string    `json:"line_name"`
	Model          string    `json:"model"`
	TestItem       string    `json:"test_item"`
	Share          string    `json:"share"`
	FailQty        int       `json:"fail_qty"`
	Status         string    `json:"status"` // OPEN, INVESTIGATING, ACTION_TAKEN, RESOLVED
	PIC            string    `json:"pic"`
	Countermeasure string    `json:"countermeasure"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// GmesMeasurement represents detailed test measurement record for an issue
type GmesMeasurement struct {
	ID           int       `json:"id"`
	Process      string    `json:"process"`
	LineName     string    `json:"line_name"`
	Model        string    `json:"model"`
	TestItem     string    `json:"test_item"`
	SN           string    `json:"sn"`
	CN           string    `json:"cn"`
	Port         string    `json:"port"`
	TestTime     string    `json:"test_time"`
	EquipNo      string    `json:"equip_no"`
	MeasureUSL   string    `json:"measure_usl"`
	MeasureValue string    `json:"measure_value"`
	MeasureLSL   string    `json:"measure_lsl"`
	Remark       string    `json:"remark"`
	CreatedAt    time.Time `json:"created_at"`
}

// GmesStats provides summary KPIs for GMES dashboard
type GmesStats struct {
	TotalFailQty   int               `json:"total_fail_qty"`
	ActiveIssues   int               `json:"active_issues"`
	WorstLine      string            `json:"worst_line"`
	WorstProcess   string            `json:"worst_process"`
	ProcessCounts  map[string]int    `json:"process_counts"`
	ProcessFails   map[string]int    `json:"process_fails"`
}
