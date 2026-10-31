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
	PartBefore       string     `json:"part_before"`
	PartAfter        string     `json:"part_after"`
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
	UpdatedBy        *uuid.UUID `json:"updated_by,omitempty"`
	AuthorName       string     `json:"author_name,omitempty"`
	CreatedByName    string     `json:"created_by_name,omitempty"`
	UpdaterName      string     `json:"updater_name,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// PLM Workflow & Stepper Tracking (Migration 039)
	PLMStatus          string     `json:"plm_status"`
	PLMNewModelID      *uuid.UUID `json:"plm_new_model_id,omitempty"`
	PLMPICModelID      *uuid.UUID `json:"plm_pic_model_id,omitempty"`
	PLMPICModelName    string     `json:"plm_pic_model_name,omitempty"`
	PLMModelStage      string     `json:"plm_model_stage,omitempty"`
	PLMChangeReason    string     `json:"plm_change_reason,omitempty"`
	PLMVendorETA       *string    `json:"plm_vendor_eta,omitempty"`
	PLMModelApprovedAt *time.Time `json:"plm_model_approved_at,omitempty"`
	PLMModelNote       string     `json:"plm_model_note,omitempty"`
	PLMEcoNo           string     `json:"plm_eco_no,omitempty"`
	PLMUpdatedAt       *time.Time `json:"plm_updated_at,omitempty"`
	PLMUpdatedBy       *uuid.UUID `json:"plm_updated_by,omitempty"`
	PLMUpdatedByName   string     `json:"plm_updated_by_name,omitempty"`
	PLMFeedbackNote    string     `json:"plm_feedback_note,omitempty"`
}

// ECNChangeLog represents an audit log entry for changes made to an ECN record
type ECNChangeLog struct {
	ID            uuid.UUID              `json:"id"`
	ECNID         uuid.UUID              `json:"ecn_id"`
	Action        string                 `json:"action"`
	ChangedBy     *uuid.UUID             `json:"changed_by,omitempty"`
	ChangedByName string                 `json:"changed_by_name,omitempty"`
	Changes       map[string]interface{} `json:"changes,omitempty"`
	Note          string                 `json:"note,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
}

// ECNListQuery parameters for filtering, searching, and pagination.
type ECNListQuery struct {
	Tab              string `query:"tab"` // "all", "in_progress", "bom_queue", "completed"
	Page             int    `query:"page"`
	Limit            int    `query:"limit"`
	Search           string `query:"search"`
	Model            string `query:"model"`
	Status           string `query:"status"`
	Process          string `query:"process"`
	FunctionType     string `query:"function_type"`
	SortBy           string `query:"sort_by"`
	SortOrder        string `query:"sort_order"`

	// Table header column filters (ponytail: query entire DB across pages)
	ECNNo            string `query:"ecn_no"`
	ColModel         string `query:"col_model"`
	ColFunctionType  string `query:"col_function_type"`
	ColProcess       string `query:"col_process"`
	ColStatus        string `query:"col_status"`
	ECTitle          string `query:"ec_title"`
	ChildCode        string `query:"child_code"`
	ChildName        string `query:"child_name"`
	PartBefore       string `query:"col_part_before"`
	PartAfter        string `query:"col_part_after"`
	HasPartChange    string `query:"has_part_change"` // ponytail: shortcut filter for records with part changes
	Specification    string `query:"specification"`
	Quantity         string `query:"quantity"`
	RunningDateBOM   string `query:"running_date_bom"`
	DistributionDate string `query:"distribution_date"`
	AuthorName       string `query:"author_name"`
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

// PurchasingBOMShiftRequest represents payload from Purchasing (PIC A) when shifting Running BOM date
type PurchasingBOMShiftRequest struct {
	NewRunningDateBOM string  `json:"new_running_date_bom"`
	ReasonCategory    string  `json:"reason_category"`
	ClarificationNote string  `json:"clarification_note"`
	VendorETA         *string `json:"vendor_eta,omitempty"`
}

