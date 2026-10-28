package model

import (
	"time"

	"github.com/google/uuid"
)

// ECNRecord represents an Engineering Change Notice record in SEIN Production Engineering.
type ECNRecord struct {
	ID               uuid.UUID  `json:"id"`
	ECNNo            string     `json:"ecn_no"`
	Model            string     `json:"model"`
	FunctionType     string     `json:"function_type"`
	Purpose          string     `json:"purpose"`
	InventoryMgmt    string     `json:"inventory_mgmt"`
	Process          string     `json:"process"`
	ECTitle          string     `json:"ec_title"`
	ParentCode       string     `json:"parent_code"`
	ParentName       string     `json:"parent_name"`
	BeforeAfter      string     `json:"before_after"`
	DL               string     `json:"dl"`
	ChildCode        string     `json:"child_code"`
	ChildName        string     `json:"child_name"`
	Specification    string     `json:"specification"`
	Quantity         string     `json:"quantity"`
	MarkingPoint     string     `json:"marking_point"`
	RunningDateBOM   string     `json:"running_date_bom"`
	DistributionDate string     `json:"distribution_date"`
	Status           string     `json:"status"`
	Remark           string     `json:"remark"`
	CreatedBy        *uuid.UUID `json:"created_by,omitempty"`
	AuthorName       string     `json:"author_name,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ECNListQuery parameters for filtering, searching, and pagination.
type ECNListQuery struct {
	Page         int    `query:"page"`
	Limit        int    `query:"limit"`
	Search       string `query:"search"`
	Model        string `query:"model"`
	Status       string `query:"status"`
	Process      string `query:"process"`
	FunctionType string `query:"function_type"`
	SortBy       string `query:"sort_by"`
	SortOrder    string `query:"sort_order"`
}

// ECNListResponse paginated response.
type ECNListResponse struct {
	Records    []ECNRecord `json:"records"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// ECNBulkImportRequest for importing batch records from Paste Table or Excel.
type ECNBulkImportRequest struct {
	Records []ECNRecord `json:"records"`
}

// ECNBulkDeleteRequest for deleting batch records by IDs.
type ECNBulkDeleteRequest struct {
	IDs []uuid.UUID `json:"ids"`
}

// ECNStatsSummary for top dashboard metrics.
type ECNStatsSummary struct {
	Total        int            `json:"total"`
	Completed    int            `json:"completed"`
	InProgress   int            `json:"in_progress"`
	Pending      int            `json:"pending"`
	ECOCancel    int            `json:"eco_cancel"`
	UniqueModels int            `json:"unique_models"`
	ModelCounts  map[string]int `json:"model_counts"`
}
