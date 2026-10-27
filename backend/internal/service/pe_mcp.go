package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PEMCPService provides Model Context Protocol (MCP) tool execution for all PE-Portal data
type PEMCPService struct {
	pool *pgxpool.Pool
}

func NewPEMCPService(pool *pgxpool.Pool) *PEMCPService {
	return &PEMCPService{pool: pool}
}

// GetTools returns definitions of all MCP tools provided by PE-Portal
func (s *PEMCPService) GetTools() []MCPToolDef {
	return []MCPToolDef{
		{
			Name:        "pe_get_portal_overview",
			Description: "Get executive dashboard metrics and overview of SEIN PE Portal: model counts by development stage, project/task breakdown, sample inventory loan status, innovations, and DHL tracking summary.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "pe_list_new_models",
			Description: "Query smartphone and device new models developed at SEIN PE, including model name, codename, marketing name, development stage (concept, prototype, EVT, DVT, PVT, MP, released), target SOP release date, and basic model variants.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"stage": map[string]interface{}{
						"type":        "string",
						"description": "Filter by development stage: concept, prototype, evt, dvt, pvt, mp, released",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search keyword for model name, codename, or marketing name",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max number of records to return (default: 20)",
					},
				},
			},
		},
		{
			Name:        "pe_get_model_details",
			Description: "Get comprehensive details for a specific new model by model name or ID, including stages, checkpoints, and all milestones (PVR, PRA, SRA, MP SOP, LQV, BOM, sample approvals) with schedules and statuses.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"model_name": map[string]interface{}{
						"type":        "string",
						"description": "Model name or codename (e.g., 'S26 Series', 'Paradigm')",
					},
					"model_id": map[string]interface{}{
						"type":        "string",
						"description": "UUID of the model",
					},
				},
			},
		},
		{
			Name:        "pe_get_model_schedules",
			Description: "Get all scheduled milestones, target dates, and ISO week numbers across active new models for timeline and calendar planning.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"stage": map[string]interface{}{
						"type":        "string",
						"description": "Filter by development stage",
					},
					"start_date": map[string]interface{}{
						"type":        "string",
						"description": "Filter schedule starting from date (YYYY-MM-DD)",
					},
					"end_date": map[string]interface{}{
						"type":        "string",
						"description": "Filter schedule ending at date (YYYY-MM-DD)",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 100)",
					},
				},
			},
		},
		{
			Name:        "pe_list_projects_and_tasks",
			Description: "Query engineering projects and Kanban tasks, including status (todo, in_progress, review, done), priority, due date, owner, and assignees.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"status": map[string]interface{}{
						"type":        "string",
						"description": "Filter by task status: todo, in_progress, review, done",
					},
					"priority": map[string]interface{}{
						"type":        "string",
						"description": "Filter by priority: low, medium, high, urgent",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Keyword in title or description",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max number of tasks to return (default: 30)",
					},
				},
			},
		},
		{
			Name:        "pe_list_innovations",
			Description: "Query PE engineering innovation proposals, including category, status, impact score, author name, class type, and cost-benefit descriptions.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"status": map[string]interface{}{
						"type":        "string",
						"description": "Filter by status: draft, submitted, under_review, approved, rejected",
					},
					"category": map[string]interface{}{
						"type":        "string",
						"description": "Filter by category",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search keyword in title or description",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 20)",
					},
				},
			},
		},
		{
			Name:        "pe_list_samples",
			Description: "Query sample units, test phones, and JIG devices in warehouse/lab, including asset number, model, serial, status_pinjam (AVAILABLE / BORROWED), borrower name, borrowed timestamp, and location.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"status_pinjam": map[string]interface{}{
						"type":        "string",
						"description": "Filter by loan status: AVAILABLE, BORROWED",
					},
					"model": map[string]interface{}{
						"type":        "string",
						"description": "Filter by phone/device model name",
					},
					"borrower": map[string]interface{}{
						"type":        "string",
						"description": "Filter by borrower name",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 30)",
					},
				},
			},
		},
		{
			Name:        "pe_list_dhl_shipments",
			Description: "Query DHL international shipments, tracking numbers (AWB), origin, destination, status label (e.g. DELIVERED, TRANSIT), PIC, and last checkpoint updates.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"status": map[string]interface{}{
						"type":        "string",
						"description": "Filter by status (transit, delivered, etc.)",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search by tracking number AWB, destination, or PIC",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 25)",
					},
				},
			},
		},
		{
			Name:        "pe_list_software_mrs",
			Description: "Query Software Maintenance Releases (MR) and companion releases, versions, models, and release schedules.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search keyword for release title, model, or version",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 20)",
					},
				},
			},
		},
		{
			Name:        "pe_list_documents_and_reports",
			Description: "Query technical engineering documents, digital reports, and knowledge base articles stored in PE Portal.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Keyword in title or content",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Max records (default: 20)",
					},
				},
			},
		},
		{
			Name:        "pe_query_database",
			Description: "Execute a read-only SQL SELECT query on the PE Portal PostgreSQL database to answer specific ad-hoc questions or cross-table analytics. Only SELECT queries are permitted.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"required": []string{"query"},
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "SQL SELECT statement (e.g. 'SELECT model_name, stage, target_release FROM new_models WHERE deleted_at IS NULL ORDER BY target_release ASC LIMIT 10')",
					},
				},
			},
		},
	}
}

// CallTool executes a tool by name with arguments
func (s *PEMCPService) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	if s.pool == nil {
		return nil, fmt.Errorf("database connection pool not initialized")
	}

	switch name {
	case "pe_get_portal_overview":
		return s.getPortalOverview(ctx)

	case "pe_list_new_models":
		return s.listNewModels(ctx, args)

	case "pe_get_model_details":
		return s.getModelDetails(ctx, args)

	case "pe_get_model_schedules":
		return s.getModelSchedules(ctx, args)

	case "pe_list_projects_and_tasks":
		return s.listProjectsAndTasks(ctx, args)

	case "pe_list_innovations":
		return s.listInnovations(ctx, args)

	case "pe_list_samples":
		return s.listSamples(ctx, args)

	case "pe_list_dhl_shipments":
		return s.listDHLShipments(ctx, args)

	case "pe_list_software_mrs":
		return s.listSoftwareMRs(ctx, args)

	case "pe_list_documents_and_reports":
		return s.listDocumentsAndReports(ctx, args)

	case "pe_query_database":
		return s.executeSafeQuery(ctx, args)

	default:
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
}

// 1. Overview
func (s *PEMCPService) getPortalOverview(ctx context.Context) (map[string]interface{}, error) {
	overview := make(map[string]interface{})

	// Models count & by stage
	var totalModels int
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM new_models WHERE deleted_at IS NULL").Scan(&totalModels)
	overview["total_new_models"] = totalModels

	stageRows, err := s.pool.Query(ctx, "SELECT stage, COUNT(*) FROM new_models WHERE deleted_at IS NULL GROUP BY stage")
	if err == nil {
		stages := make(map[string]int)
		for stageRows.Next() {
			var st string
			var count int
			if err := stageRows.Scan(&st, &count); err == nil {
				stages[st] = count
			}
		}
		stageRows.Close()
		overview["models_by_stage"] = stages
	}

	// Projects & Tasks
	var totalProjects int
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL").Scan(&totalProjects)
	overview["total_projects"] = totalProjects

	taskRows, err := s.pool.Query(ctx, "SELECT status, COUNT(*) FROM project_tasks GROUP BY status")
	if err == nil {
		tasks := make(map[string]int)
		for taskRows.Next() {
			var st string
			var count int
			if err := taskRows.Scan(&st, &count); err == nil {
				tasks[st] = count
			}
		}
		taskRows.Close()
		overview["tasks_by_status"] = tasks
	}

	// Samples
	var totalSamples, availableSamples, borrowedSamples int
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM samples WHERE deleted_at IS NULL").Scan(&totalSamples)
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM samples WHERE deleted_at IS NULL AND UPPER(status_pinjam) = 'AVAILABLE'").Scan(&availableSamples)
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM samples WHERE deleted_at IS NULL AND UPPER(status_pinjam) = 'BORROWED'").Scan(&borrowedSamples)
	overview["samples_summary"] = map[string]int{
		"total":     totalSamples,
		"available": availableSamples,
		"borrowed":  borrowedSamples,
	}

	// Innovations
	var totalInnovations int
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM innovations WHERE deleted_at IS NULL").Scan(&totalInnovations)
	overview["total_innovations"] = totalInnovations

	// DHL Shipments
	var activeDHL int
	_ = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM dhl_shipments WHERE LOWER(status_code) NOT IN ('delivered', 'complete')").Scan(&activeDHL)
	overview["active_dhl_shipments"] = activeDHL

	overview["server_time"] = time.Now().Format(time.RFC3339)
	overview["organization"] = "Samsung Electronics Indonesia (SEIN) - Production Engineering Group"

	return overview, nil
}

// 2. New Models
func (s *PEMCPService) listNewModels(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT m.id, m.model_name, COALESCE(m.codename, ''), COALESCE(m.marketing_name, ''),
		       m.stage, COALESCE(to_char(m.target_release, 'YYYY-MM-DD'), ''),
		       COALESCE(u.username, ''), m.created_at, m.basic_models
		FROM new_models m
		LEFT JOIN users u ON m.owner_id = u.id
		WHERE m.deleted_at IS NULL
	`
	params := []interface{}{}
	pIdx := 1

	if stageVal, ok := args["stage"].(string); ok && strings.TrimSpace(stageVal) != "" {
		query += fmt.Sprintf(" AND LOWER(m.stage) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(stageVal))
		pIdx++
	}

	if searchVal, ok := args["search"].(string); ok && strings.TrimSpace(searchVal) != "" {
		pattern := "%" + strings.TrimSpace(searchVal) + "%"
		query += fmt.Sprintf(" AND (m.model_name ILIKE $%d OR m.codename ILIKE $%d OR m.marketing_name ILIKE $%d)", pIdx, pIdx, pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 20
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY m.target_release ASC NULLS LAST, m.created_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id string
		var modelName, codename, marketingName, stage, targetRelease, owner string
		var createdAt time.Time
		var basicModels interface{}

		if err := rows.Scan(&id, &modelName, &codename, &marketingName, &stage, &targetRelease, &owner, &createdAt, &basicModels); err == nil {
			results = append(results, map[string]interface{}{
				"id":             id,
				"model_name":     modelName,
				"codename":       codename,
				"marketing_name": marketingName,
				"stage":          stage,
				"target_release": targetRelease,
				"owner":          owner,
				"basic_models":   basicModels,
				"created_at":     createdAt.Format("2006-01-02"),
			})
		}
	}
	return results, nil
}

// 3. Model Details with Milestones
func (s *PEMCPService) getModelDetails(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error) {
	modelIDVal, _ := args["model_id"].(string)
	modelNameVal, _ := args["model_name"].(string)

	if modelIDVal == "" && modelNameVal == "" {
		return nil, fmt.Errorf("either model_name or model_id is required")
	}

	var modelID, modelName, codename, marketingName, stage, targetRelease, desc, owner string
	var basicModels interface{}

	var err error
	if modelIDVal != "" {
		err = s.pool.QueryRow(ctx, `
			SELECT m.id, m.model_name, COALESCE(m.codename, ''), COALESCE(m.marketing_name, ''),
			       m.stage, COALESCE(to_char(m.target_release, 'YYYY-MM-DD'), ''),
			       COALESCE(m.description, ''), COALESCE(u.username, ''), m.basic_models
			FROM new_models m
			LEFT JOIN users u ON m.owner_id = u.id
			WHERE m.id = $1 AND m.deleted_at IS NULL
		`, modelIDVal).Scan(&modelID, &modelName, &codename, &marketingName, &stage, &targetRelease, &desc, &owner, &basicModels)
	} else {
		err = s.pool.QueryRow(ctx, `
			SELECT m.id, m.model_name, COALESCE(m.codename, ''), COALESCE(m.marketing_name, ''),
			       m.stage, COALESCE(to_char(m.target_release, 'YYYY-MM-DD'), ''),
			       COALESCE(m.description, ''), COALESCE(u.username, ''), m.basic_models
			FROM new_models m
			LEFT JOIN users u ON m.owner_id = u.id
			WHERE (m.model_name ILIKE $1 OR m.codename ILIKE $1 OR m.marketing_name ILIKE $1) AND m.deleted_at IS NULL
			ORDER BY m.created_at DESC LIMIT 1
		`, "%"+modelNameVal+"%").Scan(&modelID, &modelName, &codename, &marketingName, &stage, &targetRelease, &desc, &owner, &basicModels)
	}

	if err != nil {
		return nil, fmt.Errorf("model not found: %w", err)
	}

	// Fetch milestones
	milestonesQuery := `
		SELECT id, category, COALESCE(sub_category, ''), milestone_key, label,
		       COALESCE(plan_value, ''), COALESCE(actual_value, ''), status,
		       COALESCE(to_char(target_date, 'YYYY-MM-DD'), ''),
		       COALESCE(to_char(actual_date, 'YYYY-MM-DD'), ''),
		       COALESCE(variant_code, ''), COALESCE(notes, '')
		FROM new_model_milestones
		WHERE model_id = $1
		ORDER BY sort_order ASC, target_date ASC NULLS LAST
	`
	mRows, err := s.pool.Query(ctx, milestonesQuery, modelID)
	milestones := []map[string]interface{}{}
	if err == nil {
		for mRows.Next() {
			var mID, cat, subCat, key, lbl, planVal, actVal, status, targetDt, actDt, variant, notes string
			if err := mRows.Scan(&mID, &cat, &subCat, &key, &lbl, &planVal, &actVal, &status, &targetDt, &actDt, &variant, &notes); err == nil {
				milestones = append(milestones, map[string]interface{}{
					"id":           mID,
					"category":     cat,
					"sub_category": subCat,
					"key":          key,
					"label":        lbl,
					"plan_value":   planVal,
					"actual_value": actVal,
					"status":       status,
					"target_date":  targetDt,
					"actual_date":  actDt,
					"variant_code": variant,
					"notes":        notes,
				})
			}
		}
		mRows.Close()
	}

	return map[string]interface{}{
		"id":             modelID,
		"model_name":     modelName,
		"codename":       codename,
		"marketing_name": marketingName,
		"stage":          stage,
		"target_release": targetRelease,
		"description":    desc,
		"owner":          owner,
		"basic_models":   basicModels,
		"milestones":     milestones,
		"total_milestones": len(milestones),
	}, nil
}

// 4. Model Schedules across models
func (s *PEMCPService) getModelSchedules(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT mm.id, mm.model_id, m.model_name, COALESCE(m.codename, ''),
		       m.stage, mm.milestone_key, mm.label, mm.category,
		       to_char(mm.target_date, 'YYYY-MM-DD') AS target_date,
		       COALESCE(to_char(mm.actual_date, 'YYYY-MM-DD'), '') AS actual_date,
		       mm.status, COALESCE(mm.variant_code, '')
		FROM new_model_milestones mm
		JOIN new_models m ON mm.model_id = m.id
		WHERE m.deleted_at IS NULL AND mm.target_date IS NOT NULL
	`
	params := []interface{}{}
	pIdx := 1

	if stageVal, ok := args["stage"].(string); ok && strings.TrimSpace(stageVal) != "" {
		query += fmt.Sprintf(" AND LOWER(m.stage) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(stageVal))
		pIdx++
	}

	if startDt, ok := args["start_date"].(string); ok && strings.TrimSpace(startDt) != "" {
		query += fmt.Sprintf(" AND mm.target_date >= $%d", pIdx)
		params = append(params, strings.TrimSpace(startDt))
		pIdx++
	}

	if endDt, ok := args["end_date"].(string); ok && strings.TrimSpace(endDt) != "" {
		query += fmt.Sprintf(" AND mm.target_date <= $%d", pIdx)
		params = append(params, strings.TrimSpace(endDt))
		pIdx++
	}

	limit := 100
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY mm.target_date ASC, m.model_name ASC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, modelID, modelName, codename, stage, key, label, cat, targetDate, actDate, status, variant string
		if err := rows.Scan(&id, &modelID, &modelName, &codename, &stage, &key, &label, &cat, &targetDate, &actDate, &status, &variant); err == nil {
			var year, week int
			if parsed, err := time.Parse("2006-01-02", targetDate); err == nil {
				year, week = parsed.ISOWeek()
			}
			results = append(results, map[string]interface{}{
				"id":           id,
				"model_id":     modelID,
				"model_name":   modelName,
				"codename":     codename,
				"stage":        stage,
				"milestone":    label,
				"key":          key,
				"category":     cat,
				"target_date":  targetDate,
				"actual_date":  actDate,
				"status":       status,
				"variant_code": variant,
				"iso_week":     fmt.Sprintf("W%02d", week),
				"iso_year":     year,
			})
		}
	}
	return results, nil
}

// 5. Projects and Tasks
func (s *PEMCPService) listProjectsAndTasks(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT t.id, t.title, COALESCE(t.description, ''), t.status,
		       COALESCE(to_char(t.due_date, 'YYYY-MM-DD'), ''),
		       p.id AS project_id, p.title AS project_title,
		       p.priority, COALESCE(u.username, '') AS assignee
		FROM project_tasks t
		JOIN projects p ON t.project_id = p.id
		LEFT JOIN users u ON t.assignee_id = u.id
		WHERE p.deleted_at IS NULL
	`
	params := []interface{}{}
	pIdx := 1

	if st, ok := args["status"].(string); ok && strings.TrimSpace(st) != "" {
		query += fmt.Sprintf(" AND LOWER(t.status) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(st))
		pIdx++
	}

	if pr, ok := args["priority"].(string); ok && strings.TrimSpace(pr) != "" {
		query += fmt.Sprintf(" AND LOWER(p.priority) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(pr))
		pIdx++
	}

	if sVal, ok := args["search"].(string); ok && strings.TrimSpace(sVal) != "" {
		pattern := "%" + strings.TrimSpace(sVal) + "%"
		query += fmt.Sprintf(" AND (t.title ILIKE $%d OR t.description ILIKE $%d OR p.title ILIKE $%d)", pIdx, pIdx, pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 30
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, title, desc, status, dueDate, projID, projTitle, priority, assignee string
		if err := rows.Scan(&id, &title, &desc, &status, &dueDate, &projID, &projTitle, &priority, &assignee); err == nil {
			results = append(results, map[string]interface{}{
				"id":            id,
				"task_title":    title,
				"description":   desc,
				"status":        status,
				"due_date":      dueDate,
				"project_id":    projID,
				"project_title": projTitle,
				"priority":      priority,
				"assignee":      assignee,
			})
		}
	}
	return results, nil
}

// 6. Innovations
func (s *PEMCPService) listInnovations(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT i.id, i.title, COALESCE(i.description, ''), i.category, i.status,
		       COALESCE(i.impact_score, 0), COALESCE(i.class_type, ''),
		       COALESCE(u.username, '') AS author, to_char(i.created_at, 'YYYY-MM-DD')
		FROM innovations i
		LEFT JOIN users u ON i.author_id = u.id
		WHERE i.deleted_at IS NULL
	`
	params := []interface{}{}
	pIdx := 1

	if st, ok := args["status"].(string); ok && strings.TrimSpace(st) != "" {
		query += fmt.Sprintf(" AND LOWER(i.status) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(st))
		pIdx++
	}

	if cat, ok := args["category"].(string); ok && strings.TrimSpace(cat) != "" {
		query += fmt.Sprintf(" AND LOWER(i.category) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(cat))
		pIdx++
	}

	if sVal, ok := args["search"].(string); ok && strings.TrimSpace(sVal) != "" {
		pattern := "%" + strings.TrimSpace(sVal) + "%"
		query += fmt.Sprintf(" AND (i.title ILIKE $%d OR i.description ILIKE $%d)", pIdx, pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 20
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY i.created_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, title, desc, category, status, classType, author, date string
		var impact int
		if err := rows.Scan(&id, &title, &desc, &category, &status, &impact, &classType, &author, &date); err == nil {
			results = append(results, map[string]interface{}{
				"id":           id,
				"title":        title,
				"description":  desc,
				"category":     category,
				"status":       status,
				"impact_score": impact,
				"class_type":   classType,
				"author":       author,
				"date":         date,
			})
		}
	}
	return results, nil
}

// 7. Samples
func (s *PEMCPService) listSamples(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT id, asset_number, model, COALESCE(serial_number, ''),
		       COALESCE(category, ''), status_pinjam,
		       COALESCE(borrower_name, ''),
		       COALESCE(to_char(borrowed_at, 'YYYY-MM-DD HH24:MI'), ''),
		       COALESCE(location, ''), COALESCE(condition_status, ''),
		       COALESCE(imei, ''), COALESCE(hw_rev, '')
		FROM samples
		WHERE deleted_at IS NULL
	`
	params := []interface{}{}
	pIdx := 1

	if st, ok := args["status_pinjam"].(string); ok && strings.TrimSpace(st) != "" {
		query += fmt.Sprintf(" AND UPPER(status_pinjam) = UPPER($%d)", pIdx)
		params = append(params, strings.TrimSpace(st))
		pIdx++
	}

	if m, ok := args["model"].(string); ok && strings.TrimSpace(m) != "" {
		query += fmt.Sprintf(" AND model ILIKE $%d", pIdx)
		params = append(params, "%"+strings.TrimSpace(m)+"%")
		pIdx++
	}

	if b, ok := args["borrower"].(string); ok && strings.TrimSpace(b) != "" {
		query += fmt.Sprintf(" AND borrower_name ILIKE $%d", pIdx)
		params = append(params, "%"+strings.TrimSpace(b)+"%")
		pIdx++
	}

	limit := 30
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY borrowed_at DESC NULLS LAST, id DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var asset, model, serial, cat, status, borrower, borrowedAt, location, cond, imei, hwRev string
		if err := rows.Scan(&id, &asset, &model, &serial, &cat, &status, &borrower, &borrowedAt, &location, &cond, &imei, &hwRev); err == nil {
			results = append(results, map[string]interface{}{
				"id":               id,
				"asset_number":     asset,
				"model":            model,
				"serial_number":    serial,
				"category":         cat,
				"status_pinjam":    status,
				"borrower_name":    borrower,
				"borrowed_at":      borrowedAt,
				"location":         location,
				"condition_status": cond,
				"imei":             imei,
				"hw_rev":           hwRev,
			})
		}
	}
	return results, nil
}

// 8. DHL Shipments
func (s *PEMCPService) listDHLShipments(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT id, service_name, origin_country, origin_city,
		       dest_country, dest_city, status_code, status_label,
		       COALESCE(pic, ''), COALESCE(last_location, ''),
		       to_char(updated_at, 'YYYY-MM-DD HH24:MI')
		FROM dhl_shipments
		WHERE 1=1
	`
	params := []interface{}{}
	pIdx := 1

	if st, ok := args["status"].(string); ok && strings.TrimSpace(st) != "" {
		query += fmt.Sprintf(" AND LOWER(status_code) = LOWER($%d)", pIdx)
		params = append(params, strings.TrimSpace(st))
		pIdx++
	}

	if sVal, ok := args["search"].(string); ok && strings.TrimSpace(sVal) != "" {
		pattern := "%" + strings.TrimSpace(sVal) + "%"
		query += fmt.Sprintf(" AND (id ILIKE $%d OR dest_city ILIKE $%d OR pic ILIKE $%d)", pIdx, pIdx, pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 25
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY updated_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, service, origCountry, origCity, destCountry, destCity, statusCode, statusLabel, pic, lastLoc, updatedAt string
		if err := rows.Scan(&id, &service, &origCountry, &origCity, &destCountry, &destCity, &statusCode, &statusLabel, &pic, &lastLoc, &updatedAt); err == nil {
			results = append(results, map[string]interface{}{
				"awb":            id,
				"service_name":   service,
				"origin":         fmt.Sprintf("%s, %s", origCity, origCountry),
				"destination":    fmt.Sprintf("%s, %s", destCity, destCountry),
				"status_code":    statusCode,
				"status_label":   statusLabel,
				"pic":            pic,
				"last_location":  lastLoc,
				"last_update":    updatedAt,
			})
		}
	}
	return results, nil
}

// 9. Software MR
func (s *PEMCPService) listSoftwareMRs(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT id, release_title, version_name, target_model, status,
		       COALESCE(to_char(schedule_date, 'YYYY-MM-DD'), ''),
		       to_char(created_at, 'YYYY-MM-DD')
		FROM software_mr_releases
		WHERE 1=1
	`
	params := []interface{}{}
	pIdx := 1

	if sVal, ok := args["search"].(string); ok && strings.TrimSpace(sVal) != "" {
		pattern := "%" + strings.TrimSpace(sVal) + "%"
		query += fmt.Sprintf(" AND (release_title ILIKE $%d OR version_name ILIKE $%d OR target_model ILIKE $%d)", pIdx, pIdx, pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 20
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, title, version, targetModel, status, scheduleDt, createdAt string
		if err := rows.Scan(&id, &title, &version, &targetModel, &status, &scheduleDt, &createdAt); err == nil {
			results = append(results, map[string]interface{}{
				"id":            id,
				"release_title": title,
				"version_name":  version,
				"target_model":  targetModel,
				"status":        status,
				"schedule_date": scheduleDt,
				"created_at":    createdAt,
			})
		}
	}
	return results, nil
}

// 10. Documents and Reports
func (s *PEMCPService) listDocumentsAndReports(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	query := `
		SELECT id, title, category, file_type, file_size,
		       to_char(created_at, 'YYYY-MM-DD')
		FROM documents
		WHERE deleted_at IS NULL
	`
	params := []interface{}{}
	pIdx := 1

	if sVal, ok := args["search"].(string); ok && strings.TrimSpace(sVal) != "" {
		pattern := "%" + strings.TrimSpace(sVal) + "%"
		query += fmt.Sprintf(" AND title ILIKE $%d", pIdx)
		params = append(params, pattern)
		pIdx++
	}

	limit := 20
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d", limit)

	rows, err := s.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, title, cat, fileType, date string
		var size int64
		if err := rows.Scan(&id, &title, &cat, &fileType, &size, &date); err == nil {
			results = append(results, map[string]interface{}{
				"id":        id,
				"title":     title,
				"category":  cat,
				"file_type": fileType,
				"size_kb":   size / 1024,
				"date":      date,
			})
		}
	}
	return results, nil
}

// 11. Safe Read-Only Database Query
func (s *PEMCPService) executeSafeQuery(ctx context.Context, args map[string]interface{}) ([]map[string]interface{}, error) {
	rawQuery, _ := args["query"].(string)
	cleanQuery := strings.TrimSpace(rawQuery)
	if cleanQuery == "" {
		return nil, fmt.Errorf("query cannot be empty")
	}

	// Security: Only allow SELECT queries (prevent DDL/DML and multi-statement attacks)
	upper := strings.ToUpper(cleanQuery)
	if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
		return nil, fmt.Errorf("only SELECT or WITH...SELECT queries are permitted")
	}

	forbidden := []string{
		"INSERT ", "UPDATE ", "DELETE ", "DROP ", "TRUNCATE ", "ALTER ",
		"CREATE ", "GRANT ", "REVOKE ", "EXECUTE ", ";", "--", "/*",
	}
	for _, f := range forbidden {
		if strings.Contains(upper, f) {
			return nil, fmt.Errorf("statement contains forbidden operation '%s'", strings.TrimSpace(f))
		}
	}

	// Limit safety: append LIMIT 100 if not present
	if !strings.Contains(upper, "LIMIT") {
		cleanQuery += " LIMIT 100"
	}

	rows, err := s.pool.Query(ctx, cleanQuery)
	if err != nil {
		return nil, fmt.Errorf("database query error: %w", err)
	}
	defer rows.Close()

	fieldDescs := rows.FieldDescriptions()
	results := []map[string]interface{}{}

	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			continue
		}
		rowMap := make(map[string]interface{})
		for i, fd := range fieldDescs {
			colName := fd.Name
			val := vals[i]
			if t, ok := val.(time.Time); ok {
				rowMap[colName] = t.Format(time.RFC3339)
			} else {
				rowMap[colName] = val
			}
		}
		results = append(results, rowMap)
	}

	return results, nil
}
