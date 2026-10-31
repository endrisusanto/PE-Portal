package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"

	"pe-portal/internal/auth"
	"pe-portal/internal/config"
	"pe-portal/internal/database"
	"pe-portal/internal/handler"
	"pe-portal/internal/i18n"
	"pe-portal/internal/middleware"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

func main() {
	cfg := config.Load()
	log.Println("[Init] Starting PE-Portal server on port:", cfg.Port)

	// Connect PostgreSQL
	pgPool, err := database.ConnectPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[DB] Fatal: Could not connect to PostgreSQL: %v", err)
	}
	defer pgPool.Close()

	// Run migrations if needed (idempotent)
	if err := pgPool.RunMigrations("migrations"); err != nil {
		log.Printf("[DB] Note: auto-migration check returned: %v", err)
	}

	// Connect Redis
	redisClient := database.ConnectRedis(cfg.RedisURL)
	defer redisClient.Close()

	// Initialize JWT Service
	jwtService := auth.NewJWTService(cfg.JWTSecret)

	// Repositories
	userRepo := repository.NewUserRepository(pgPool.Pool)
	groupRepo := repository.NewGroupRepository(pgPool.Pool)
	innovationRepo := repository.NewInnovationRepository(pgPool.Pool)
	projectRepo := repository.NewProjectRepository(pgPool.Pool)
	modelRepo := repository.NewNewModelRepository(pgPool.Pool)
	articleRepo := repository.NewArticleRepository(pgPool.Pool)
	docRepo := repository.NewDocumentRepository(pgPool.Pool)
	commentRepo := repository.NewCommentRepository(pgPool.Pool)
	mcpRepo := repository.NewMCPRepository(pgPool.Pool)
	settingsRepo := repository.NewSettingsRepository(pgPool.Pool)
	reportRepo := repository.NewReportRepository(pgPool.Pool)
	llmRepo := repository.NewLLMRepository(pgPool.Pool)
	emailListRepo := repository.NewEmailListRepository(pgPool.Pool)
	sampleRepo := repository.NewSampleRepository(pgPool.Pool)
	softwareMRRepo := repository.NewSoftwareMRRepository(pgPool.Pool)

	// SMTP & Automated Report Scheduler
	smtpService := service.NewSMTPService()
	reportScheduler := service.NewReportScheduler(reportRepo, smtpService)
	reportScheduler.Start(context.Background())

	// AI & LLM Service (OpenAI-compatible / LM Studio)
	llmService := service.NewLLMService()

	// Auth Provider selection (local vs ldap)
	var activeAuthProvider auth.AuthProvider
	if cfg.AuthProvider == "ldap" {
		log.Println("[Auth] Initializing LDAP Active Directory provider")
		activeAuthProvider = auth.NewLDAPAuthProvider(cfg, pgPool.Pool)
	} else {
		log.Println("[Auth] Initializing Local bcrypt provider")
		activeAuthProvider = auth.NewLocalAuthProvider(pgPool.Pool)
	}

	// Handlers
	authHandler := handler.NewAuthHandler(activeAuthProvider, jwtService, userRepo)
	userHandler := handler.NewUserHandler(userRepo, cfg.FileStoragePath)
	groupHandler := handler.NewGroupHandler(groupRepo)
	innovationHandler := handler.NewInnovationHandler(innovationRepo)
	projectHandler := handler.NewProjectHandler(projectRepo, userRepo, reportRepo, commentRepo, smtpService)
	modelHandler := handler.NewNewModelHandler(modelRepo)
	articleHandler := handler.NewArticleHandler(articleRepo)
	datahubService := service.NewDataHubService(settingsRepo)
	datahubService.StartWatchWorker(context.Background(), docRepo)
	docHandler := handler.NewDocumentHandler(docRepo, cfg.FileStoragePath, jwtService, datahubService)
	commentHandler := handler.NewCommentHandler(commentRepo, cfg.FileStoragePath)
	peMCPSvc := service.NewPEMCPService(pgPool.Pool)
	peMCPHandler := handler.NewPEMCPHandler(peMCPSvc)
	mcpHandler := handler.NewMCPHandler(mcpRepo, peMCPSvc)
	settingsHandler := handler.NewSettingsHandler(settingsRepo, docRepo, pgPool.Pool, datahubService)
	mcpClientService := service.NewMCPClientService(peMCPSvc)
	reportHandler := handler.NewReportHandler(reportRepo, smtpService, reportScheduler, llmRepo, llmService, mcpRepo, mcpClientService)
	aiHandler := handler.NewAIHandler(llmRepo, mcpRepo, mcpClientService, llmService, peMCPSvc)
	emailListHandler := handler.NewEmailListHandler(emailListRepo)
	sampleHandler := handler.NewSampleHandler(sampleRepo)
	softwareMRHandler := handler.NewSoftwareMRHandler(softwareMRRepo)
	wiRepo := repository.NewWITranslatorRepository(pgPool.Pool)
	utilityHandler := handler.NewUtilityHandler(llmRepo, wiRepo)
	dhlRepo := repository.NewDHLRepository(pgPool.Pool)
	dhlHandler := handler.NewDHLHandler(dhlRepo, userRepo, reportRepo, smtpService)
	dhlHandler.StartAutoUpdateWorker(context.Background(), 1*time.Hour)
	gmesRepo := repository.NewGmesRepository(pgPool.Pool)
	gmesHandler := handler.NewGmesHandler(gmesRepo)
	navRepo := repository.NewNavigationRepository(pgPool.Pool)
	navHandler := handler.NewNavigationHandler(navRepo)
	trainingRepo := repository.NewTrainingRepository(pgPool.Pool)
	trainingHandler := handler.NewTrainingHandler(trainingRepo, navRepo, cfg.FileStoragePath)

	// ECN Running BOM Deadline Reminder Worker & Handler (ponytail)
	ecnReminderRepo := repository.NewECNReminderRepository(pgPool.Pool)
	ecnReminderWorker := service.NewECNReminderWorker(ecnReminderRepo, reportRepo, smtpService)
	ecnReminderWorker.Start(context.Background())
	ecnReminderHandler := handler.NewECNReminderHandler(ecnReminderRepo, ecnReminderWorker)

	ecnRepo := repository.NewECNRepository(pgPool.Pool)
	ecnHandler := handler.NewECNHandler(ecnRepo, ecnReminderWorker)

	// Echo App
	e := echo.New()
	e.HideBanner = true
	// ponytail: robust client IP extraction (handles Vite/Nginx reverse proxy, X-Real-IP, and multi-hop X-Forwarded-For)
	e.IPExtractor = func(req *http.Request) string {
		if realIP := req.Header.Get("X-Real-IP"); realIP != "" {
			if cleaned := middleware.CleanIP(realIP); cleaned != "" && cleaned != "127.0.0.1" && cleaned != "::1" {
				return cleaned
			}
		}
		if xff := req.Header.Get("X-Forwarded-For"); xff != "" {
			for _, p := range strings.Split(xff, ",") {
				if cleaned := middleware.CleanIP(p); cleaned != "" && cleaned != "127.0.0.1" && cleaned != "::1" {
					return cleaned
				}
			}
		}
		return middleware.CleanIP(req.RemoteAddr)
	}

	// Standard middlewares
	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.LoggerWithConfig(echoMiddleware.LoggerConfig{
		Format: "[HTTP] ${time_rfc3339} ${method} ${uri} status=${status} latency=${latency_human}\n",
	}))
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))
	e.Use(middleware.AuditMiddleware(pgPool.Pool))

	// Health check
	e.GET("/api/v1/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status":    "healthy",
			"app":       "PE-Portal",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"auth_mode": activeAuthProvider.Type(),
		})
	})

	// i18n dictionary endpoint
	e.GET("/api/v1/i18n/:lang", func(c echo.Context) error {
		lang := c.Param("lang")
		return c.JSON(http.StatusOK, i18n.GetTranslations(lang))
	})

	// Public Auth routes
	authGroup := e.Group("/api/v1/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)

	// Public Shared Documents Endpoints (Open public, Login required, Password protected)
	e.GET("/api/v1/shared/documents/:token", docHandler.GetPublicShare)
	e.POST("/api/v1/shared/documents/:token/verify", docHandler.VerifySharePassword)
	e.GET("/api/v1/shared/documents/:token/download", docHandler.DownloadSharedFile)
	e.GET("/api/v1/shared/documents/:token/preview", docHandler.PreviewSharedFile)

	// Model Context Protocol (MCP) Server endpoints (JSON-RPC 2.0 & REST)
	e.Match([]string{http.MethodGet, http.MethodPost}, "/mcp", peMCPHandler.Handle)
	e.Match([]string{http.MethodGet, http.MethodPost}, "/mcp/tools", peMCPHandler.Handle)
	e.Match([]string{http.MethodGet, http.MethodPost}, "/mcp/call", peMCPHandler.Handle)
	e.GET("/mcp/sse", peMCPHandler.Handle)

	e.Match([]string{http.MethodGet, http.MethodPost}, "/api/v1/mcp", peMCPHandler.Handle)
	e.Match([]string{http.MethodGet, http.MethodPost}, "/api/v1/mcp/tools", peMCPHandler.Handle)
	e.Match([]string{http.MethodGet, http.MethodPost}, "/api/v1/mcp/call", peMCPHandler.Handle)
	e.GET("/api/v1/mcp/sse", peMCPHandler.Handle)

	// Protected routes (Require JWT)
	jwtMiddleware := middleware.AuthMiddleware(jwtService)
	api := e.Group("/api/v1", jwtMiddleware)

	// Auth profile
	api.GET("/auth/me", authHandler.Me)

	// Users & Preferences
	e.GET("/api/v1/users/avatar/:filename", userHandler.ServeAvatar)
	api.GET("/users", userHandler.ListUsers)
	api.GET("/users/:id", userHandler.GetUser)
	api.PUT("/users/me/preferences", userHandler.UpdatePreferences)
	api.POST("/users/me/avatar", userHandler.UploadAvatar)
	api.GET("/users/me/email-lists", emailListHandler.GetEmailLists)
	api.POST("/users/me/email-lists", emailListHandler.CreateEmailList)
	api.DELETE("/users/me/email-lists/:id", emailListHandler.DeleteEmailList)
	api.POST("/users", userHandler.CreateUser, middleware.RequireRole("admin"))
	api.PUT("/users/:id", userHandler.UpdateUser, middleware.RequireRole("admin", "manager"))
	api.DELETE("/users/:id", userHandler.DeleteUser, middleware.RequireRole("admin"))
	api.PUT("/admin/users/:id/role", userHandler.UpdateRole, middleware.RequireRole("admin"))

	// Group Parts
	api.GET("/groups", groupHandler.ListGroups)
	api.GET("/groups/:parentGroup/parts", groupHandler.ListByParent)
	api.GET("/groups/part/:id", groupHandler.GetGroup)

	// Innovations & BP
	api.GET("/innovations", innovationHandler.List)
	api.GET("/innovations/stats", innovationHandler.GetStats)
	api.POST("/innovations/targets", innovationHandler.SaveTarget, middleware.RequireRole("admin", "manager"))
	api.POST("/innovations", innovationHandler.Create)
	api.POST("/innovations/bulk", innovationHandler.CreateBulk)
	api.GET("/innovations/:id", innovationHandler.Get)
	api.PUT("/innovations/:id", innovationHandler.Update)
	api.PATCH("/innovations/:id/status", innovationHandler.UpdateStatus, middleware.RequireRole("admin", "manager"))
	api.DELETE("/innovations/:id", innovationHandler.Delete)

	// Projects & GBA Tasks
	api.GET("/gba-tasks", projectHandler.GetGbaTasks)
	api.GET("/projects", projectHandler.List)
	api.POST("/projects", projectHandler.Create)
	api.GET("/projects/:id", projectHandler.Get)
	api.PUT("/projects/:id", projectHandler.Update)
	api.DELETE("/projects/:id", projectHandler.Delete)
	api.POST("/projects/:id/send-email", projectHandler.SendEmailNotification)
	api.GET("/projects/:id/preview-email", projectHandler.PreviewEmail)

	// Project Tasks
	api.GET("/projects/:id/tasks", projectHandler.ListTasks)
	api.POST("/projects/:id/tasks", projectHandler.CreateTask)
	api.PATCH("/projects/:id/tasks/:taskId/status", projectHandler.UpdateTaskStatus)

	// New Model Development
	api.GET("/models", modelHandler.List)
	api.GET("/models/schedule", modelHandler.ListSchedule)
	api.POST("/models", modelHandler.Create)
	api.GET("/models/:id", modelHandler.Get)
	api.PUT("/models/:id", modelHandler.Update)
	api.DELETE("/models/:id", modelHandler.Delete)
	api.GET("/models/:id/stages", modelHandler.ListStages)
	api.POST("/models/:id/stages", modelHandler.AdvanceStage)
	api.PUT("/models/:id/stages/:stageId", modelHandler.UpdateStage)
	api.GET("/models/:id/milestones", modelHandler.ListMilestones)
	api.PUT("/models/:id/milestones", modelHandler.BatchUpsertMilestones)
	api.POST("/models/:id/milestones/batch", modelHandler.BatchUpsertMilestones)
	api.PATCH("/models/:id/milestones", modelHandler.UpsertMilestone)

	// Sample Management
	api.GET("/samples", sampleHandler.List)
	api.GET("/samples/stats", sampleHandler.GetStats)
	api.GET("/samples/borrowers", sampleHandler.GetBorrowerGroups)
	api.GET("/samples/matrix", sampleHandler.GetModelMatrix)
	api.POST("/samples/scan", sampleHandler.ScanTransaction)
	api.POST("/samples/bulk-return", sampleHandler.BulkReturn)
	api.POST("/samples", sampleHandler.Create)
	api.POST("/samples/bulk", sampleHandler.CreateBulk)
	api.GET("/samples/:id", sampleHandler.Get)
	api.PUT("/samples/:id", sampleHandler.Update)
	api.DELETE("/samples/:id", sampleHandler.Delete, middleware.RequireRole("admin", "manager"))

	// Software MR (Software Maintenance Release) - View-Only
	api.GET("/software-mr", softwareMRHandler.List)
	api.GET("/software-mr/stats", softwareMRHandler.GetStats)
	api.GET("/software-mr/filters", softwareMRHandler.GetFilters)
	api.GET("/software-mr/trend", softwareMRHandler.GetDailyTrend)
	api.GET("/software-mr/:id", softwareMRHandler.Get)
	api.POST("/software-mr/sync", softwareMRHandler.SyncFromIntranet)

	// Articles (Engineering Notes & Technical Articles)
	api.GET("/articles", articleHandler.List)
	api.POST("/articles", articleHandler.Create)
	api.GET("/articles/:id", articleHandler.Get)
	api.PUT("/articles/:id", articleHandler.Update)
	api.DELETE("/articles/:id", articleHandler.Delete)

	// Legacy IMEI Articles alias for backward compatibility
	api.GET("/imei/articles", articleHandler.List)
	api.POST("/imei/articles", articleHandler.Create)
	api.GET("/imei/articles/:id", articleHandler.Get)
	api.PUT("/imei/articles/:id", articleHandler.Update)
	api.DELETE("/imei/articles/:id", articleHandler.Delete)

	// Documents / File Archive & Sharing
	api.GET("/documents", docHandler.List)
	api.POST("/documents/upload", docHandler.Upload)
	api.GET("/documents/:id", docHandler.Get)
	api.PUT("/documents/:id/category", docHandler.UpdateCategory)
	api.PUT("/documents/:id", docHandler.UpdateCategory)
	api.GET("/documents/:id/download", docHandler.Download)
	api.GET("/documents/:id/preview", docHandler.Preview)
	api.GET("/documents/:id/markdown", docHandler.GetMarkdown)
	api.POST("/documents/download-zip", docHandler.DownloadZip)
	api.GET("/documents/download-zip", docHandler.DownloadZip)
	api.DELETE("/documents/:id", docHandler.Delete)
	api.POST("/documents/:id/share", docHandler.CreateOrUpdateShare)
	api.GET("/documents/:id/share", docHandler.GetShare)
	api.DELETE("/documents/:id/share", docHandler.RevokeShare)
	api.POST("/documents/:id/datahub-sync", docHandler.SyncToDataHub)
	api.GET("/documents/:id/datahub-view", docHandler.GetDataHubView)

	// Comments & Reactions
	api.GET("/comments", commentHandler.List)
	api.POST("/comments", commentHandler.Create)
	api.POST("/comments/upload-attachment", commentHandler.UploadAttachment)
	api.POST("/comments/:id/reactions", commentHandler.ToggleReaction)
	api.DELETE("/comments/:id", commentHandler.Delete)
	e.GET("/api/v1/comments/attachments/:filename", commentHandler.ServeAttachment)

	// MCP Server Registry & Proxy
	api.GET("/mcp/servers", mcpHandler.List)
	api.POST("/mcp/servers", mcpHandler.Create, middleware.RequireRole("admin"))
	api.GET("/mcp/servers/:id", mcpHandler.Get)
	api.PUT("/mcp/servers/:id", mcpHandler.Update, middleware.RequireRole("admin"))
	api.DELETE("/mcp/servers/:id", mcpHandler.Delete, middleware.RequireRole("admin"))
	api.POST("/mcp/servers/:id/health", mcpHandler.HealthCheck)
	api.POST("/mcp/proxy/:id", mcpHandler.Proxy)

	// Settings & Dashboard
	api.GET("/settings/auth", settingsHandler.GetAuthConfig, middleware.RequireRole("admin"))
	api.PUT("/settings/auth", settingsHandler.UpdateAuthConfig, middleware.RequireRole("admin"))
	api.GET("/settings/datahub", settingsHandler.GetDataHubConfig)
	api.PUT("/settings/datahub", settingsHandler.UpdateDataHubConfig, middleware.RequireRole("admin"))
	api.POST("/settings/datahub/test", settingsHandler.TestDataHubConnection, middleware.RequireRole("admin"))
	api.POST("/settings/datahub/watch-scan", settingsHandler.TriggerDataHubWatchScan, middleware.RequireRole("admin"))
	api.GET("/settings/browse-directories", settingsHandler.BrowseDirectories, middleware.RequireRole("admin"))
	api.POST("/settings/create-directory", settingsHandler.CreateDirectory, middleware.RequireRole("admin"))
	api.GET("/admin/audit-logs", settingsHandler.ListAuditLogs, middleware.RequireRole("admin"))
	api.GET("/dashboard/stats", settingsHandler.DashboardStats)

	// Work Reports & Digital Notion-like Articles
	api.GET("/reports/templates", reportHandler.ListTemplates)
	api.POST("/reports/templates", reportHandler.CreateTemplate)
	api.GET("/reports/templates/:id", reportHandler.GetTemplate)
	api.PUT("/reports/templates/:id", reportHandler.UpdateTemplate)
	api.DELETE("/reports/templates/:id", reportHandler.DeleteTemplate)

	api.GET("/reports", reportHandler.ListReports)
	api.POST("/reports", reportHandler.CreateReport)
	api.GET("/reports/:id", reportHandler.GetReport)
	api.PUT("/reports/:id", reportHandler.UpdateReport)
	api.DELETE("/reports/:id", reportHandler.DeleteReport)
	api.POST("/reports/:id/send", reportHandler.SendReport)

	api.GET("/reports/schedules", reportHandler.ListSchedules)
	api.POST("/reports/schedules", reportHandler.CreateSchedule)
	api.PUT("/reports/schedules/:id", reportHandler.UpdateSchedule)
	api.DELETE("/reports/schedules/:id", reportHandler.DeleteSchedule)
	api.POST("/reports/schedules/:id/trigger", reportHandler.TriggerSchedule)

	api.GET("/reports/scrape/activities", reportHandler.ScrapeActivities)
	api.POST("/reports/ai-synthesize", reportHandler.SynthesizeReport)
	api.GET("/reports/logs", reportHandler.ListLogs)

	// SMTP Server Gateway Configuration
	api.GET("/settings/smtp", reportHandler.GetSMTPConfig)
	api.PUT("/settings/smtp", reportHandler.UpdateSMTPConfig, middleware.RequireRole("admin"))
	api.POST("/settings/smtp/test", reportHandler.TestSMTP)

	// AI Assistant & LLM Endpoint Configuration
	api.GET("/ai/config", aiHandler.GetConfig)
	api.PUT("/ai/config", aiHandler.UpdateConfig)
	api.DELETE("/ai/config/user", aiHandler.DeleteUserCustom)
	api.GET("/ai/models", aiHandler.ListModels)
	api.GET("/ai/mcp-connectors", aiHandler.GetMCPConnectors)
	api.POST("/ai/chat", aiHandler.Chat)

	// Utility Tools (Local PDF compress & Python Background Remover & PPTX Auto Summary)
	api.GET("/utility/status", utilityHandler.GetStatus)
	api.POST("/utility/remove-bg", utilityHandler.RemoveBackground)
	api.POST("/utility/compress-pdf", utilityHandler.CompressPDF)
	api.POST("/utility/merge-pdf", utilityHandler.MergePDF)
	api.POST("/utility/split-pdf", utilityHandler.SplitPDF)
	api.POST("/utility/compress-video", utilityHandler.CompressVideo)
	api.POST("/utility/pptx-summary", utilityHandler.SummarizePPTX)
	api.GET("/utility/pptx-summary/download/:filename", utilityHandler.DownloadPPTXSummary)
	e.GET("/api/v1/api/v1/utility/pptx-summary/download/:filename", utilityHandler.DownloadPPTXSummary)
	e.GET("/utility/pptx-summary/download/:filename", utilityHandler.DownloadPPTXSummary)
	api.POST("/utility/translate-wi-pdf", utilityHandler.TranslateWIPDF)
	api.GET("/utility/translate-wi-pdf/status/:jobId", utilityHandler.GetTranslateWIStatus)
	api.GET("/utility/translate-wi-pdf/download/:filename", utilityHandler.DownloadTranslatedWIPDF)
	api.POST("/utility/wi-translator/upload", utilityHandler.UploadWIJobs)
	api.GET("/utility/wi-translator/jobs", utilityHandler.ListWIJobs)
	api.POST("/utility/wi-translator/jobs/execute", utilityHandler.ExecuteWIJobs)
	api.DELETE("/utility/wi-translator/jobs/:id", utilityHandler.DeleteWIJob)
	api.POST("/utility/wi-translator/jobs/delete-batch", utilityHandler.DeleteBatchWIJobs)
	api.GET("/utility/wi-translator/jobs/:id/source", utilityHandler.DownloadWISourceFile)

	// ECN Monitoring Routes
	api.GET("/ecn", ecnHandler.List)
	api.GET("/ecn/stats", ecnHandler.GetStats)
	api.POST("/ecn", ecnHandler.Create)
	api.PUT("/ecn/:id", ecnHandler.Update)
	api.GET("/ecn/:id/logs", ecnHandler.GetLogs)
	api.DELETE("/ecn/:id", ecnHandler.Delete)
	api.POST("/ecn/bulk", ecnHandler.BulkImport)
	api.POST("/ecn/bulk-delete", ecnHandler.BulkDelete, middleware.RequireRole("admin", "manager"))
	api.POST("/ecn/parse-excel", ecnHandler.ParseExcel)

	// ECN PLM Workflow & Approval Actions
	api.POST("/ecn/:id/purchasing-shift", ecnHandler.PurchasingShiftBOM)
	api.POST("/ecn/:id/request-approval", ecnHandler.RequestApproval)
	api.POST("/ecn/:id/approve-plm", ecnHandler.ApprovePLM)
	api.POST("/ecn/:id/reject-plm", ecnHandler.RejectPLM)
	api.POST("/ecn/:id/confirm-plm-update", ecnHandler.ConfirmPLMUpdate)

	// ECN Running BOM Deadline Reminder settings, test send, and logs
	api.GET("/ecn/reminder/settings", ecnReminderHandler.GetSettings)
	api.PUT("/ecn/reminder/settings", ecnReminderHandler.SaveSettings)
	api.POST("/ecn/reminder/test", ecnReminderHandler.TestSend)
	api.POST("/ecn/reminder/test-bom-change", ecnReminderHandler.TestBOMChange)
	api.GET("/ecn/reminder/logs", ecnReminderHandler.GetLogs)

	// DHL Express Tracking Routes
	api.GET("/dhl/status", dhlHandler.CheckAPIStatus)
	api.GET("/dhl/track", dhlHandler.TrackDirect)
	api.GET("/dhl/shipments", dhlHandler.ListShipments)
	api.POST("/dhl/shipments", dhlHandler.CreateShipment)
	api.POST("/dhl/shipments/:id/refresh", dhlHandler.RefreshShipment)
	api.PUT("/dhl/shipments/:id", dhlHandler.UpdateShipment)
	api.DELETE("/dhl/shipments/:id", dhlHandler.DeleteShipment)
	api.POST("/dhl/shipments/:id/send-delivered-email", dhlHandler.SendDeliveredEmail)

	// GMES Production Line Monitoring Routes
	api.GET("/gmes/issues", gmesHandler.List)
	api.GET("/gmes/stats", gmesHandler.GetStats)
	api.GET("/gmes/measurements", gmesHandler.GetMeasurements)
	api.POST("/gmes/issues", gmesHandler.Create)
	api.PUT("/gmes/issues/:id", gmesHandler.Update)
	api.DELETE("/gmes/issues/:id", gmesHandler.Delete, middleware.RequireRole("admin", "manager"))

	// Online Employee Training & Locked Answer Keys Routes
	api.GET("/trainings", trainingHandler.List)
	api.GET("/trainings/:id", trainingHandler.Get)
	api.POST("/trainings/:id/unlock", trainingHandler.Unlock)
	api.POST("/trainings", trainingHandler.Create, middleware.RequireRole("admin", "manager"))
	api.PUT("/trainings/:id", trainingHandler.Update, middleware.RequireRole("admin", "manager"))
	api.DELETE("/trainings/:id", trainingHandler.Delete, middleware.RequireRole("admin", "manager"))
	api.POST("/trainings/upload-asset", trainingHandler.UploadAsset, middleware.RequireRole("admin", "manager"))
	e.GET("/api/v1/trainings/assets/:filename", trainingHandler.ServeAsset)

	// Navigation Side Menu Visibility & Role/Group Access Rules
	api.GET("/navigation/menu-permissions", navHandler.GetMenuPermissions)
	api.PUT("/navigation/menu-permissions/:key", navHandler.UpdateMenuPermission, middleware.RequireRole("admin"))
	api.PUT("/navigation/menu-permissions", navHandler.BatchUpdateMenuPermissions, middleware.RequireRole("admin"))

	// ponytail: serve frontend SPA if dist folder exists (bare metal / single-binary Windows deployment)
	distPath := os.Getenv("FRONTEND_DIST_PATH")
	if distPath == "" {
		distPath = "frontend/dist"
	}
	if info, err := os.Stat(distPath); err == nil && info.IsDir() {
		log.Printf("[Static] Serving frontend SPA from: %s", distPath)
		e.Use(echoMiddleware.StaticWithConfig(echoMiddleware.StaticConfig{
			Root:   distPath,
			Index:  "index.html",
			HTML5:  true,
			Browse: false,
		}))
	}

	// Graceful shutdown handling
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	go func() {
		if err := e.Start(serverAddr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[HTTP] Fatal: server shut down: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("[Server] Gracefully shutting down...")
	reportScheduler.Stop()
	dhlHandler.StopAutoUpdateWorker()
	ecnReminderWorker.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("[Server] Forced shutdown: %v", err)
	}
	log.Println("[Server] Exited cleanly.")
}
