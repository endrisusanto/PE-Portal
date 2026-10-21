package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
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
	imeiRepo := repository.NewImeiRepository(pgPool.Pool)
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
	projectHandler := handler.NewProjectHandler(projectRepo)
	modelHandler := handler.NewNewModelHandler(modelRepo)
	imeiHandler := handler.NewImeiHandler(imeiRepo)
	docHandler := handler.NewDocumentHandler(docRepo, cfg.FileStoragePath)
	commentHandler := handler.NewCommentHandler(commentRepo)
	mcpHandler := handler.NewMCPHandler(mcpRepo)
	settingsHandler := handler.NewSettingsHandler(settingsRepo, pgPool.Pool)
	reportHandler := handler.NewReportHandler(reportRepo, smtpService, reportScheduler)
	aiHandler := handler.NewAIHandler(llmRepo, llmService)
	emailListHandler := handler.NewEmailListHandler(emailListRepo)
	sampleHandler := handler.NewSampleHandler(sampleRepo)
	softwareMRHandler := handler.NewSoftwareMRHandler(softwareMRRepo)

	// Echo App
	e := echo.New()
	e.HideBanner = true

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
	api.DELETE("/projects/:id", projectHandler.Delete, middleware.RequireRole("admin", "manager"))

	// Project Tasks
	api.GET("/projects/:id/tasks", projectHandler.ListTasks)
	api.POST("/projects/:id/tasks", projectHandler.CreateTask)
	api.PATCH("/projects/:id/tasks/:taskId/status", projectHandler.UpdateTaskStatus)

	// New Model Development
	api.GET("/models", modelHandler.List)
	api.POST("/models", modelHandler.Create)
	api.GET("/models/:id", modelHandler.Get)
	api.PUT("/models/:id", modelHandler.Update)
	api.GET("/models/:id/stages", modelHandler.ListStages)
	api.POST("/models/:id/stages", modelHandler.AdvanceStage, middleware.RequireRole("admin", "manager"))

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

	// IMEI Articles
	api.GET("/imei/articles", imeiHandler.List)
	api.POST("/imei/articles", imeiHandler.Create)
	api.GET("/imei/articles/:id", imeiHandler.Get)
	api.PUT("/imei/articles/:id", imeiHandler.Update)
	api.DELETE("/imei/articles/:id", imeiHandler.Delete)

	// Documents / File Archive
	api.GET("/documents", docHandler.List)
	api.POST("/documents/upload", docHandler.Upload)
	api.GET("/documents/:id", docHandler.Get)
	api.GET("/documents/:id/download", docHandler.Download)
	api.GET("/documents/:id/preview", docHandler.Preview)
	api.DELETE("/documents/:id", docHandler.Delete)

	// Comments & Reactions
	api.GET("/comments", commentHandler.List)
	api.POST("/comments", commentHandler.Create)
	api.POST("/comments/:id/reactions", commentHandler.ToggleReaction)
	api.DELETE("/comments/:id", commentHandler.Delete)

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
	api.POST("/ai/chat", aiHandler.Chat)

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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("[Server] Forced shutdown: %v", err)
	}
	log.Println("[Server] Exited cleanly.")
}
