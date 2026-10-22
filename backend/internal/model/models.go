package model

import (
	"encoding/json"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// User represents an engineer or administrator in SEIN PE
type User struct {
	ID            uuid.UUID  `json:"id"`
	EmployeeID    string     `json:"employee_id"`
	Username      string     `json:"username"`
	Email         string     `json:"email"`
	PasswordHash  *string    `json:"-"`
	FullName      string     `json:"full_name"`
	AvatarPath    *string    `json:"avatar_path"`
	PreferredLang string     `json:"preferred_lang"`
	GroupPartID   *uuid.UUID `json:"group_part_id"`
	GroupPartName *string    `json:"group_part_name,omitempty"`
	ParentGroup   *string    `json:"parent_group,omitempty"`
	Role          string     `json:"role"` // admin, manager, member
	AuthProvider  string     `json:"auth_provider"`
	IsActive      bool       `json:"is_active"`
	LastLoginAt   *time.Time `json:"last_login_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	DeletedAt     *time.Time `json:"-"`
}

// UserClaims defines the JWT claims payload
type UserClaims struct {
	UserID        uuid.UUID  `json:"user_id"`
	Username      string     `json:"username"`
	Role          string     `json:"role"`
	GroupPartID   *uuid.UUID `json:"group_part_id"`
	PreferredLang string     `json:"preferred_lang"`
	jwt.RegisteredClaims
}

// GroupPart represents a sub-division of the PE team
type GroupPart struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	ParentGroup string    `json:"parent_group"` // pe_production, pe_mecha, pe_solution
	Description *string   `json:"description"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
}

// AuthConfig stores LDAP / Local authentication settings
type AuthConfig struct {
	ID               uuid.UUID `json:"id"`
	Provider         string    `json:"provider"` // local, ldap
	LDAPHost         *string   `json:"ldap_host"`
	LDAPPort         int       `json:"ldap_port"`
	LDAPBaseDN       *string   `json:"ldap_base_dn"`
	LDAPBindDN       *string   `json:"ldap_bind_dn"`
	LDAPBindPassword *string   `json:"ldap_bind_password,omitempty"`
	LDAPUserFilter   string    `json:"ldap_user_filter"`
	LDAPUseTLS       bool      `json:"ldap_use_tls"`
	IsActive         bool      `json:"is_active"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// Innovation represents an Innovation Idea or Best Practice (BP)
type Innovation struct {
	ID            uuid.UUID       `json:"id"`
	Title         string          `json:"title"`
	Description   *string         `json:"description"`
	Category      string          `json:"category"`   // innovation, best_practice
	ClassType     string          `json:"class_type"` // Class 3, Class 4, Class 5, Non Adopt, Under Review
	Status        string          `json:"status"`     // draft, review, approved, implemented
	AuthorID      *uuid.UUID      `json:"author_id"`
	AuthorName    *string         `json:"author_name,omitempty"`
	GroupPartID   *uuid.UUID      `json:"group_part_id"`
	GroupPartName *string         `json:"group_part_name,omitempty"`
	ImpactScore   *int            `json:"impact_score"`
	Attachments   json.RawMessage `json:"attachments"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type InnovationTarget struct {
	ID              uuid.UUID `json:"id"`
	Year            int       `json:"year"`
	Month           int       `json:"month"`
	TargetRegister  int       `json:"target_register"`
	TargetChallenge int       `json:"target_challenge"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type InnovationMonthlyStat struct {
	Month           int    `json:"month"`
	MonthName       string `json:"month_name"`
	ActualRegister  int    `json:"actual_register"`
	TargetRegister  int    `json:"target_register"`
	TargetChallenge int    `json:"target_challenge"`
	Class3          int    `json:"class3"`
	Class4          int    `json:"class4"`
	Class5          int    `json:"class5"`
	NonAdopt        int    `json:"non_adopt"`
	UnderReview     int    `json:"under_review"`
	TargetMet       bool   `json:"target_met"`
}

type InnovationClassDistribution struct {
	Name       string  `json:"name"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
	Color      string  `json:"color"`
}

type InnovationStatsResponse struct {
	Year              int                           `json:"year"`
	AvailableYears    []int                         `json:"available_years"`
	TotalActual       int                           `json:"total_actual"`
	TotalTarget       int                           `json:"total_target"`
	TotalChallenge    int                           `json:"total_challenge"`
	AchievementRate   float64                       `json:"achievement_rate"`
	AdoptedRate       float64                       `json:"adopted_rate"`
	Class3Count       int                           `json:"class3_count"`
	Class4Count       int                           `json:"class4_count"`
	Class5Count       int                           `json:"class5_count"`
	UnderReviewCount  int                           `json:"under_review_count"`
	NonAdoptCount     int                           `json:"non_adopt_count"`
	Monthly           []InnovationMonthlyStat       `json:"monthly"`
	ClassDistribution []InnovationClassDistribution `json:"class_distribution"`
}

// Project represents a project tracked by PE
type Project struct {
	ID             uuid.UUID       `json:"id"`
	Title          string          `json:"title"`
	Description    *string         `json:"description"`
	ProjectType    string          `json:"project_type"` // development, new_model, internal
	Status         string          `json:"status"`       // planning, in_progress, review, completed, on_hold
	Priority       string          `json:"priority"`     // low, medium, high, urgent
	OwnerID        *uuid.UUID      `json:"owner_id"`
	OwnerName      *string         `json:"owner_name,omitempty"`
	GroupPartID    *uuid.UUID      `json:"group_part_id"`
	GroupPartName  *string         `json:"group_part_name,omitempty"`
	StartDate      *string         `json:"start_date"`
	TargetDate     *string         `json:"target_date"`
	CompletionDate *string         `json:"completion_date"`
	Progress       int             `json:"progress"`
	Metadata       json.RawMessage `json:"metadata"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// ProjectTask represents an action item in a project
type ProjectTask struct {
	ID           uuid.UUID  `json:"id"`
	ProjectID    uuid.UUID  `json:"project_id"`
	Title        string     `json:"title"`
	Description  *string    `json:"description"`
	Status       string     `json:"status"` // todo, in_progress, review, done
	AssigneeID   *uuid.UUID `json:"assignee_id"`
	AssigneeName *string    `json:"assignee_name,omitempty"`
	DueDate      *string    `json:"due_date"`
	SortOrder    int        `json:"sort_order"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// NewModel represents a product model under engineering development
type NewModel struct {
	ID             uuid.UUID       `json:"id"`
	ModelName      string          `json:"model_name"` // e.g. "S26 Series"
	Codename       *string         `json:"codename"`   // e.g. "Paradigm"
	Stage          string          `json:"stage"`      // concept, design, prototype, evt, dvt, pvt, mp, released
	Description    *string         `json:"description"`
	ProjectID      *uuid.UUID      `json:"project_id"`
	OwnerID        *uuid.UUID      `json:"owner_id"`
	OwnerName      *string         `json:"owner_name,omitempty"`
	TargetRelease  *string         `json:"target_release"`
	Specifications json.RawMessage `json:"specifications"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// NewModelStage records stage advancement history
type NewModelStage struct {
	ID           uuid.UUID  `json:"id"`
	ModelID      uuid.UUID  `json:"model_id"`
	Stage        string     `json:"stage"`
	Status       string     `json:"status"` // pending, in_progress, completed, blocked
	StartedAt    *time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	Notes        *string    `json:"notes"`
	ApprovedBy   *uuid.UUID `json:"approved_by"`
	ApproverName *string    `json:"approver_name,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// ImeiArticle represents engineering notes or articles grouped per model project
type ImeiArticle struct {
	ID          uuid.UUID       `json:"id"`
	Title       string          `json:"title"`
	Content     string          `json:"content"`
	ModelID     *uuid.UUID      `json:"model_id"`
	ModelName   *string         `json:"model_name,omitempty"`
	ProjectID   *uuid.UUID      `json:"project_id"`
	AuthorID    *uuid.UUID      `json:"author_id"`
	AuthorName  *string         `json:"author_name,omitempty"`
	Tags        json.RawMessage `json:"tags"`
	IsPinned    bool            `json:"is_pinned"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// Article is the clean canonical alias for ImeiArticle
type Article = ImeiArticle

// Document represents an archived document in the portal
type Document struct {
	ID            uuid.UUID       `json:"id"`
	Title         string          `json:"title"`
	FileName      string          `json:"file_name"`
	FilePath      string          `json:"file_path"`
	FileSize      int64           `json:"file_size"`
	MimeType      string          `json:"mime_type"`
	FileType      string          `json:"file_type"` // pdf, docx, xlsx, pptx, csv, txt, img
	Category      *string         `json:"category"`
	Tags          json.RawMessage `json:"tags"`
	UploadedBy    *uuid.UUID      `json:"uploaded_by"`
	UploaderName  *string         `json:"uploader_name,omitempty"`
	GroupPartID   *uuid.UUID      `json:"group_part_id"`
	GroupPartName *string         `json:"group_part_name,omitempty"`
	ProjectID     *uuid.UUID      `json:"project_id"`
	ModelID       *uuid.UUID      `json:"model_id"`
	Version       int             `json:"version"`
	IsArchived    bool            `json:"is_archived"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// DocumentShare represents sharing settings for a document (open public, login required, or password-locked)
type DocumentShare struct {
	ID            uuid.UUID  `json:"id"`
	DocumentID    uuid.UUID  `json:"document_id"`
	ShareToken    string     `json:"share_token"`
	AccessRule    string     `json:"access_rule"` // public, login_required, password
	PasswordHash  string     `json:"-"`
	PlainPassword string     `json:"plain_password,omitempty"`
	AllowDownload bool       `json:"allow_download"`
	ExpiresAt     *time.Time `json:"expires_at"`
	ViewCount     int        `json:"view_count"`
	DownloadCount int        `json:"download_count"`
	CreatedBy     *uuid.UUID `json:"created_by"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	Document      *Document  `json:"document,omitempty"`
}

type CreateShareRequest struct {
	AccessRule    string `json:"access_rule"` // public, login_required, password
	Password      string `json:"password"`
	AllowDownload *bool  `json:"allow_download"`
	ExpiresInDays *int   `json:"expires_in_days"`
}

type VerifySharePasswordRequest struct {
	Password string `json:"password"`
}

// Comment supports comments with full emoji UTF-8 and reaction counters
type Comment struct {
	ID         uuid.UUID       `json:"id"`
	Content    string          `json:"content"`
	EntityType string          `json:"entity_type"` // innovation, project, task, document, model, imei_article
	EntityID   uuid.UUID       `json:"entity_id"`
	AuthorID   *uuid.UUID      `json:"author_id"`
	AuthorName *string         `json:"author_name,omitempty"`
	ParentID   *uuid.UUID      `json:"parent_id"`
	Reactions  json.RawMessage `json:"reactions"` // e.g. {"👍":["user-1"]}
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// MCPServer stores registered custom MCP Server endpoints
type MCPServer struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	URL             string     `json:"url"`
	Description     *string    `json:"description"`
	AuthType        string     `json:"auth_type"` // none, bearer, api_key
	AuthToken       *string    `json:"auth_token,omitempty"`
	IsActive        bool       `json:"is_active"`
	HealthStatus    string     `json:"health_status"` // healthy, unhealthy, unknown
	LastHealthCheck *time.Time `json:"last_health_check"`
	CreatedBy       *uuid.UUID `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// AuditLog logs operations for transparency and activity feed
type AuditLog struct {
	ID         uuid.UUID       `json:"id"`
	UserID     *uuid.UUID      `json:"user_id"`
	UserName   *string         `json:"user_name,omitempty"`
	Action     string          `json:"action"`
	EntityType *string         `json:"entity_type"`
	EntityID   *uuid.UUID      `json:"entity_id"`
	Details    json.RawMessage `json:"details"`
	IPAddress  *string         `json:"ip_address"`
	CreatedAt  time.Time       `json:"created_at"`
}

// Auth Request / Response DTOs
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// SMTPConfig represents email gateway settings
type SMTPConfig struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	Host       string     `json:"host"`
	Port       int        `json:"port"`
	Username   string     `json:"username"`
	Password   string     `json:"password,omitempty"`
	FromEmail  string     `json:"from_email"`
	FromName   string     `json:"from_name"`
	Encryption string     `json:"encryption"` // tls, ssl, none
	IsDefault  bool       `json:"is_default"`
	CreatedBy  *uuid.UUID `json:"created_by"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ReportTemplate represents a customizable and shareable format for work reports
type ReportTemplate struct {
	ID            uuid.UUID       `json:"id"`
	Title         string          `json:"title"`
	Description   *string         `json:"description"`
	Category      string          `json:"category"` // daily, weekly, project, custom
	Content       json.RawMessage `json:"content"`  // array of blocks
	IsShared      bool            `json:"is_shared"`
	AuthorID      *uuid.UUID      `json:"author_id"`
	AuthorName    *string         `json:"author_name,omitempty"`
	GroupPartID   *uuid.UUID      `json:"group_part_id"`
	GroupPartName *string         `json:"group_part_name,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// DigitalReport represents an authored work report article
type DigitalReport struct {
	ID           uuid.UUID       `json:"id"`
	Title        string          `json:"title"`
	TemplateID   *uuid.UUID      `json:"template_id"`
	TemplateName *string         `json:"template_name,omitempty"`
	AuthorID     *uuid.UUID      `json:"author_id"`
	AuthorName   *string         `json:"author_name,omitempty"`
	ReportDate   string          `json:"report_date"`
	Status       string          `json:"status"` // draft, submitted, sent
	Content      json.RawMessage `json:"content"`
	RenderedHTML string          `json:"rendered_html"`
	Recipients   json.RawMessage `json:"recipients"` // {"to": [], "cc": []}
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// ReportSchedule represents an automated recurring report job
type ReportSchedule struct {
	ID             uuid.UUID       `json:"id"`
	UserID         uuid.UUID       `json:"user_id"`
	UserName       *string         `json:"user_name,omitempty"`
	TemplateID     *uuid.UUID      `json:"template_id"`
	TemplateName   *string         `json:"template_name,omitempty"`
	SMTPConfigID   *uuid.UUID      `json:"smtp_config_id"`
	Title          string          `json:"title"`
	CronExpression string          `json:"cron_expression"`
	Recipients     json.RawMessage `json:"recipients"`
	IsActive       bool            `json:"is_active"`
	LastRunAt      *time.Time      `json:"last_run_at"`
	NextRunAt      *time.Time      `json:"next_run_at"`
	LastStatus     string          `json:"last_status"`
	LastError      *string         `json:"last_error"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// ReportSendLog represents an execution audit trail for dispatched emails
type ReportSendLog struct {
	ID           uuid.UUID       `json:"id"`
	ScheduleID   *uuid.UUID      `json:"schedule_id"`
	ReportID     *uuid.UUID      `json:"report_id"`
	UserID       *uuid.UUID      `json:"user_id"`
	UserName     *string         `json:"user_name,omitempty"`
	Recipients   json.RawMessage `json:"recipients"`
	Subject      string          `json:"subject"`
	Status       string          `json:"status"` // success, failed
	ErrorMessage *string         `json:"error_message"`
	SentAt       time.Time       `json:"sent_at"`
}

// LLMConfig represents AI provider endpoint configurations
type LLMConfig struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Provider  string     `json:"provider"` // openai-compatible, openai, gemini, claude
	BaseURL   string     `json:"base_url"`
	APIKey    string     `json:"api_key"`
	ModelName string     `json:"model_name"`
	UserID    *uuid.UUID `json:"user_id,omitempty"`
	IsActive  bool       `json:"is_active"`
	IsDefault bool       `json:"is_default"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// ChatMessage represents a single turn in LLM conversation
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AIChatRequest defines the payload sent to PE AI Assistant
type AIChatRequest struct {
	Messages    []ChatMessage `json:"messages"`
	Model       string        `json:"model,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
}

// UserEmailList represents custom recipient contact groups saved by a member
type UserEmailList struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Emails      string    `json:"emails"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

