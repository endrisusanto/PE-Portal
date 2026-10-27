package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type ReportScheduler struct {
	repo    *repository.ReportRepository
	smtpSvc *SMTPService
	mu      sync.Mutex
	stopCh  chan struct{}
}

func NewReportScheduler(repo *repository.ReportRepository, smtpSvc *SMTPService) *ReportScheduler {
	return &ReportScheduler{
		repo:    repo,
		smtpSvc: smtpSvc,
		stopCh:  make(chan struct{}),
	}
}

// Start initiates the cron ticker loop
func (s *ReportScheduler) Start(ctx context.Context) {
	log.Println("[Scheduler] Starting automated email report background worker...")
	ticker := time.NewTicker(1 * time.Minute)

	go func() {
		// Run initial check after 5 seconds on startup
		time.Sleep(5 * time.Second)
		s.checkAndRunDueSchedules(ctx)

		for {
			select {
			case <-ticker.C:
				s.checkAndRunDueSchedules(ctx)
			case <-s.stopCh:
				ticker.Stop()
				log.Println("[Scheduler] Stopped automated report worker.")
				return
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// Stop cleanly terminates the background loop
func (s *ReportScheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}

func (s *ReportScheduler) checkAndRunDueSchedules(ctx context.Context) {
	schedules, err := s.repo.GetActiveSchedules(ctx)
	if err != nil {
		log.Printf("[Scheduler] Error fetching active schedules: %v\n", err)
		return
	}

	now := time.Now()
	for _, sch := range schedules {
		isDue := false
		if sch.NextRunAt == nil {
			// If not yet scheduled, calculate and set next run time
			next := s.calculateNextRun(sch.CronExpression, now)
			_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "initialized", nil, &next)
			continue
		}

		if now.After(*sch.NextRunAt) {
			isDue = true
		}

		if isDue {
			go s.executeSchedule(context.Background(), sch)
		}
	}
}

func (s *ReportScheduler) executeSchedule(ctx context.Context, sch model.ReportSchedule) {
	log.Printf("[Scheduler] Executing scheduled report '%s' (User: %s)...\n", sch.Title, sch.UserID)
	now := time.Now()
	nextRun := s.calculateNextRun(sch.CronExpression, now)

	// 1. Get SMTP config
	smtpCfg, err := s.repo.GetDefaultSMTP(ctx)
	if err != nil || smtpCfg == nil {
		errMsg := "no active SMTP configuration found"
		_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "failed", &errMsg, &nextRun)
		s.recordLog(ctx, sch, nil, "failed", errMsg)
		return
	}

	// 2. Parse recipients
	type RecipientList struct {
		To []string `json:"to"`
		Cc []string `json:"cc"`
	}
	var recList RecipientList
	if len(sch.Recipients) > 0 {
		_ = json.Unmarshal(sch.Recipients, &recList)
	}

	if len(recList.To) == 0 {
		errMsg := "no recipient email configured in schedule"
		_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "failed", &errMsg, &nextRun)
		s.recordLog(ctx, sch, nil, "failed", errMsg)
		return
	}

	// 3. Scrape current activities
	activities, err := s.repo.ScrapeMemberActivities(ctx, sch.UserID)
	if err != nil {
		errMsg := fmt.Sprintf("failed to scrape activities: %v", err)
		_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "failed", &errMsg, &nextRun)
		s.recordLog(ctx, sch, recList.To, "failed", errMsg)
		return
	}

	// 4. Render HTML
	htmlBody := s.RenderAutomatedReportHTML(sch.Title, activities)
	subject := fmt.Sprintf("[%s] Work Report - %s (%s)", sch.Title, activities.User.FullName, now.Format("2006-01-02"))

	// 5. Send Email
	sendErr := s.smtpSvc.SendEmail(smtpCfg, recList.To, recList.Cc, subject, htmlBody)
	if sendErr != nil {
		errMsg := sendErr.Error()
		log.Printf("[Scheduler] Failed sending email for schedule %s: %v\n", sch.ID, sendErr)
		_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "failed", &errMsg, &nextRun)
		s.recordLog(ctx, sch, recList.To, "failed", errMsg)
		return
	}

	log.Printf("[Scheduler] Successfully sent scheduled report to %v\n", recList.To)
	_ = s.repo.UpdateScheduleExecution(ctx, sch.ID, "success", nil, &nextRun)
	s.recordLog(ctx, sch, recList.To, "success", "")
}

// TriggerScheduleNow executes a schedule on-demand
func (s *ReportScheduler) TriggerScheduleNow(ctx context.Context, scheduleID uuid.UUID) error {
	schedules, err := s.repo.GetActiveSchedules(ctx)
	if err != nil {
		return err
	}
	for _, sch := range schedules {
		if sch.ID == scheduleID {
			go s.executeSchedule(context.Background(), sch)
			return nil
		}
	}
	return fmt.Errorf("active schedule not found")
}

func (s *ReportScheduler) recordLog(ctx context.Context, sch model.ReportSchedule, recipients []string, status, errMsg string) {
	recBytes, _ := json.Marshal(recipients)
	var errPtr *string
	if errMsg != "" {
		errPtr = &errMsg
	}
	_ = s.repo.CreateLog(ctx, &model.ReportSendLog{
		ScheduleID:   &sch.ID,
		UserID:       &sch.UserID,
		Recipients:   recBytes,
		Subject:      sch.Title,
		Status:       status,
		ErrorMessage: errPtr,
		SentAt:       time.Now(),
	})
}

// calculateNextRun computes next execution based on expression or default 24h
func (s *ReportScheduler) calculateNextRun(cronExpr string, from time.Time) time.Time {
	// Simple robust evaluation for standard patterns without heavyweight libraries
	cronExpr = strings.TrimSpace(cronExpr)
	if strings.Contains(cronExpr, "17 * * 1-5") || cronExpr == "daily" {
		// Next weekday at 17:00
		next := time.Date(from.Year(), from.Month(), from.Day(), 17, 0, 0, 0, from.Location())
		if from.After(next) {
			next = next.AddDate(0, 0, 1)
		}
		for next.Weekday() == time.Saturday || next.Weekday() == time.Sunday {
			next = next.AddDate(0, 0, 1)
		}
		return next
	}

	if cronExpr == "weekly" || strings.Contains(cronExpr, "* * 5") {
		// Next Friday at 16:30
		daysUntilFriday := (int(time.Friday) - int(from.Weekday()) + 7) % 7
		if daysUntilFriday == 0 && from.Hour() >= 16 {
			daysUntilFriday = 7
		}
		nextDate := from.AddDate(0, 0, daysUntilFriday)
		return time.Date(nextDate.Year(), nextDate.Month(), nextDate.Day(), 16, 30, 0, 0, from.Location())
	}

	// Default fallback: next day at 17:00
	return from.Add(24 * time.Hour)
}

// RenderAutomatedReportHTML formats scraped activities into clean, responsive HTML
func (s *ReportScheduler) RenderAutomatedReportHTML(title string, act *repository.ScrapedActivities) string {
	var taskRows strings.Builder
	for _, t := range act.Tasks {
		statusColor := "#6b7280"
		if t.Status == "done" {
			statusColor = "#10b981"
		} else if t.Status == "in_progress" {
			statusColor = "#3b82f6"
		}
		taskRows.WriteString(fmt.Sprintf(`
			<tr>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">%s</td>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
					<span style="background: %s; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase;">%s</span>
				</td>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">%s</td>
			</tr>
		`, t.Title, statusColor, t.Status, t.UpdatedAt.Format("Jan 02, 15:04")))
	}
	if len(act.Tasks) == 0 {
		taskRows.WriteString(`<tr><td colspan="3" style="padding: 12px; text-align: center; color: #9ca3af;">No specific tasks logged today</td></tr>`)
	}

	var modelRows strings.Builder
	for _, m := range act.Models {
		codename := "-"
		if m.Codename != nil {
			codename = *m.Codename
		}
		modelRows.WriteString(fmt.Sprintf(`
			<tr>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0d7377;">%s (%s)</td>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
					<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">%s</span>
				</td>
				<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 12px;">%s</td>
			</tr>
		`, m.ModelName, codename, m.Stage, m.UpdatedAt.Format("Jan 02, 2006")))
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>%s</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table width="100%%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0d7377; padding: 24px; color: #ffffff;">
              <table width="100%%" border="0">
                <tr>
                  <td>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">SEIN PE REPORT</span>
                    <h1 style="margin: 8px 0 4px 0; font-size: 20px; font-weight: 700;">%s</h1>
                    <p style="margin: 0; font-size: 13px; opacity: 0.9;">Author: %s (%s) | %s</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 24px;">
              <!-- Section 1 -->
              <h3 style="font-size: 15px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0;">
                📋 Live Task & Operations Summary
              </h3>
              <table width="100%%" cellspacing="0" cellpadding="0" style="font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 10px;">Task Title</th>
                    <th style="padding: 8px 10px;">Status</th>
                    <th style="padding: 8px 10px;">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  %s
                </tbody>
              </table>

              <!-- Section 2 -->
              <h3 style="font-size: 15px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
                🚀 New Model Development Milestone
              </h3>
              <table width="100%%" cellspacing="0" cellpadding="0" style="font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 8px 10px;">Model & Codename</th>
                    <th style="padding: 8px 10px;">Current Stage</th>
                    <th style="padding: 8px 10px;">Date</th>
                  </tr>
                </thead>
                <tbody>
                  %s
                </tbody>
              </table>

              <!-- Footer note -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 12px; color: #64748b; margin-top: 16px;">
                <strong>SEIN PE Automated Reporting:</strong> Generated directly from PE-Portal database logs and MCP tools.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              Production Engineer Team Portal • PT. Samsung Electronics Indonesia
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`, title, title, act.User.FullName, act.User.Role, time.Now().Format("Monday, 02 Jan 2006"), taskRows.String(), modelRows.String())
}
