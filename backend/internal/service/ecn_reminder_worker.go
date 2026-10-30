package service

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
)

type ScheduleSlot struct {
	Hour   int
	Minute int
}

type ECNReminderWorker struct {
	repo       *repository.ECNReminderRepository
	reportRepo *repository.ReportRepository
	smtpSvc    *SMTPService
	mu         sync.Mutex
	stopCh     chan struct{}

	// In-memory clock cache (ponytail: 0% CPU, 0 useless DB queries)
	cachedSlots        []ScheduleSlot
	cachedEnabled      bool
	cachedLastSentDate string
	dispatchedSlots    map[string]bool // key: "YYYY-MM-DD@HH:MM"
	wibLocation        *time.Location
}

func NewECNReminderWorker(
	repo *repository.ECNReminderRepository,
	reportRepo *repository.ReportRepository,
	smtpSvc *SMTPService,
) *ECNReminderWorker {
	// Fixed UTC+7 (WIB) timezone for SEIN Jakarta/Cikarang operation
	wib := time.FixedZone("WIB", 7*3600)
	return &ECNReminderWorker{
		repo:            repo,
		reportRepo:      reportRepo,
		smtpSvc:         smtpSvc,
		stopCh:          make(chan struct{}),
		cachedSlots:     []ScheduleSlot{{Hour: 8, Minute: 0}},
		dispatchedSlots: make(map[string]bool),
		wibLocation:     wib,
	}
}

// Start initiates the background scheduler loop
func (w *ECNReminderWorker) Start(ctx context.Context) {
	log.Println("[ECN Reminder Worker] Starting background worker for Running BOM deadline...")
	ticker := time.NewTicker(1 * time.Minute)

	go func() {
		// Initial sync settings after 5 seconds on startup
		time.Sleep(5 * time.Second)
		_ = w.ReloadSettingsCache(ctx)

		for {
			select {
			case <-ticker.C:
				w.tickCheck(ctx)
			case <-w.stopCh:
				ticker.Stop()
				log.Println("[ECN Reminder Worker] Stopped background worker.")
				return
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// Stop cleanly terminates the worker
func (w *ECNReminderWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	select {
	case <-w.stopCh:
	default:
		close(w.stopCh)
	}
}

// ReloadSettingsCache refreshes in-memory schedule clock from DB
func (w *ECNReminderWorker) ReloadSettingsCache(ctx context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	settings, err := w.repo.GetSettings(ctx)
	if err != nil {
		return err
	}

	w.cachedEnabled = settings.IsEnabled

	// Parse comma-separated "HH:MM, HH:MM" e.g. "07:00, 08:00, 13:00, 16:00"
	var slots []ScheduleSlot
	rawTimes := strings.FieldsFunc(settings.SendTime, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\n'
	})
	seen := make(map[string]bool)
	for _, raw := range rawTimes {
		raw = strings.TrimSpace(raw)
		if raw == "" || seen[raw] {
			continue
		}
		parts := strings.Split(raw, ":")
		if len(parts) == 2 {
			h, errH := strconv.Atoi(parts[0])
			m, errM := strconv.Atoi(parts[1])
			if errH == nil && errM == nil && h >= 0 && h < 24 && m >= 0 && m < 60 {
				seen[raw] = true
				slots = append(slots, ScheduleSlot{Hour: h, Minute: m})
			}
		}
	}
	if len(slots) == 0 {
		slots = []ScheduleSlot{{Hour: 8, Minute: 0}}
	}
	w.cachedSlots = slots
	return nil
}

// tickCheck runs on every tick (ponytail: compares RAM integers only, 0 database queries)
func (w *ECNReminderWorker) tickCheck(ctx context.Context) {
	w.mu.Lock()
	enabled := w.cachedEnabled
	slots := append([]ScheduleSlot(nil), w.cachedSlots...)
	w.mu.Unlock()

	if !enabled || len(slots) == 0 {
		return
	}

	now := time.Now().In(w.wibLocation)
	todayStr := now.Format("2006-01-02")
	h := now.Hour()
	m := now.Minute()
	slotKey := fmt.Sprintf("%s@%02d:%02d", todayStr, h, m)

	w.mu.Lock()
	// Clean up previous days from dispatchedSlots
	for k := range w.dispatchedSlots {
		if !strings.HasPrefix(k, todayStr) {
			delete(w.dispatchedSlots, k)
		}
	}

	if w.dispatchedSlots[slotKey] {
		w.mu.Unlock()
		return
	}

	matched := false
	for _, s := range slots {
		if s.Hour == h && s.Minute == m {
			matched = true
			break
		}
	}
	if !matched {
		w.mu.Unlock()
		return
	}

	// Mark dispatched in memory so we don't re-dispatch during the same minute
	w.dispatchedSlots[slotKey] = true
	w.mu.Unlock()

	log.Printf("[ECN Reminder Worker] Scheduled slot %02d:%02d arrived. Triggering reminder...\n", h, m)
	if _, err := w.ExecuteReminder(ctx, "SCHEDULE"); err != nil {
		log.Printf("[ECN Reminder Worker] Scheduled execution failed for slot %s: %v\n", slotKey, err)
	}
}

// ExecuteReminder performs ECN Running BOM check and sends email
func (w *ECNReminderWorker) ExecuteReminder(ctx context.Context, triggerType string) (int, error) {
	settings, err := w.repo.GetSettings(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch reminder settings: %w", err)
	}

	if triggerType == "SCHEDULE" && !settings.IsEnabled {
		return 0, nil
	}

	now := time.Now().In(w.wibLocation)
	todayStr := now.Format("2006-01-02")

	// Target date = today + days_before (e.g. tomorrow if days_before = 1)
	daysBefore := settings.DaysBefore
	if daysBefore <= 0 {
		daysBefore = 1
	}
	targetDate := now.AddDate(0, 0, daysBefore)
	targetDateStr := targetDate.Format("2006-01-02")

	// Query active ECNs due for Running BOM
	dueRecords, err := w.repo.GetDueRunningBOMRecords(ctx, targetDate, settings.IncludeOverdue)
	if err != nil {
		return 0, fmt.Errorf("failed to get due ecn records: %w", err)
	}

	// If no records and this is a schedule trigger, don't spam empty emails
	if len(dueRecords) == 0 && triggerType == "SCHEDULE" {
		log.Printf("[ECN Reminder Worker] No active ECN records due for Running BOM on %s (H-%d). Skipping email.\n", targetDateStr, daysBefore)
		_ = w.repo.UpdateLastSentDate(ctx, settings.ID, todayStr)
		_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
			Recipients:   settings.Recipients,
			CCRecipients: settings.CCRecipients,
			ItemCount:    0,
			ECNNumbers:   "",
			Status:       "SKIPPED",
			ErrorMessage: "Semua jadwal ECN terpantau aman. Pengiriman dilewati.",
			TriggeredBy:  triggerType,
		})
		w.mu.Lock()
		w.cachedLastSentDate = todayStr
		w.mu.Unlock()
		return 0, nil
	}

	// Parse recipients
	recipients := parseEmailList(settings.Recipients)
	ccRecipients := parseEmailList(settings.CCRecipients)

	if len(recipients) == 0 {
		errNoRec := fmt.Errorf("no recipients configured in ECN reminder settings")
		_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
			Recipients:   settings.Recipients,
			CCRecipients: settings.CCRecipients,
			ItemCount:    len(dueRecords),
			Status:       "FAILED",
			ErrorMessage: errNoRec.Error(),
			TriggeredBy:  triggerType,
		})
		return 0, errNoRec
	}

	// Fetch default SMTP gateway
	smtpCfg, err := w.reportRepo.GetDefaultSMTP(ctx)
	if err != nil {
		errSMTP := fmt.Errorf("failed to get default SMTP gateway: %w", err)
		_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
			Recipients:   settings.Recipients,
			CCRecipients: settings.CCRecipients,
			ItemCount:    len(dueRecords),
			Status:       "FAILED",
			ErrorMessage: errSMTP.Error(),
			TriggeredBy:  triggerType,
		})
		return 0, errSMTP
	}

	// Render Email HTML Body
	subject := settings.EmailSubject
	if strings.TrimSpace(subject) == "" {
		subject = fmt.Sprintf("[REMINDER] ECN Running BOM Deadline Alert (%d Item) - SEIN PE", len(dueRecords))
	} else if len(dueRecords) > 0 {
		subject = fmt.Sprintf("%s (%d Dokumen Jatuh Tempo)", subject, len(dueRecords))
	}

	htmlBody := w.RenderReminderEmailHTML(dueRecords, targetDateStr, daysBefore, triggerType)

	// Send Email via SMTP
	sendErr := w.smtpSvc.SendEmail(smtpCfg, recipients, ccRecipients, subject, htmlBody)

	// Gather list of ECN numbers for logging
	var ecnNumbers []string
	for _, r := range dueRecords {
		if strings.TrimSpace(r.ECNNo) != "" {
			ecnNumbers = append(ecnNumbers, r.ECNNo)
		}
	}

	status := "SUCCESS"
	var errText string
	if sendErr != nil {
		status = "FAILED"
		errText = sendErr.Error()
	}

	// Record in audit log
	_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
		Recipients:   strings.Join(recipients, ", "),
		CCRecipients: strings.Join(ccRecipients, ", "),
		ItemCount:    len(dueRecords),
		ECNNumbers:   strings.Join(ecnNumbers, ", "),
		Status:       status,
		ErrorMessage: errText,
		TriggeredBy:  triggerType,
	})

	if sendErr != nil {
		return 0, fmt.Errorf("failed sending email via SMTP: %w", sendErr)
	}

	// Update last_sent_date on success for schedule
	if triggerType == "SCHEDULE" {
		_ = w.repo.UpdateLastSentDate(ctx, settings.ID, todayStr)
		w.mu.Lock()
		w.cachedLastSentDate = todayStr
		w.mu.Unlock()
	}

	log.Printf("[ECN Reminder Worker] Successfully dispatched reminder email (%d ECN items) to %v (CC: %v)\n", len(dueRecords), recipients, ccRecipients)
	return len(dueRecords), nil
}

// parseEmailList splits comma/semicolon/newline separated string into clean unique email slice
func parseEmailList(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == ' '
	})
	var result []string
	seen := make(map[string]bool)
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && strings.Contains(trimmed, "@") && !seen[trimmed] {
			seen[trimmed] = true
			result = append(result, trimmed)
		}
	}
	return result
}

// RenderReminderEmailHTML builds executive, responsive HTML email table for ECN Running BOM reminder
func (w *ECNReminderWorker) RenderReminderEmailHTML(items []model.ECNRecord, targetDateStr string, daysBefore int, triggerType string) string {
	var rowsHTML strings.Builder

	if len(items) == 0 {
		rowsHTML.WriteString(`
			<tr>
				<td colspan="9" style="text-align: center; padding: 24px; color: #64748b; font-style: italic;">
					Tidak ada data ECN aktif yang jatuh tempo untuk tanggal Running BOM ini.
				</td>
			</tr>
		`)
	} else {
		for i, it := range items {
			bg := "#ffffff"
			if i%2 == 1 {
				bg = "#f8fafc"
			}

			statusBadgeColor := "#f59e0b" // Pending (Amber)
			if strings.Contains(strings.ToLower(it.Status), "progress") {
				statusBadgeColor = "#3b82f6" // Blue
			}

			cleanRemark := it.Remark
			if len(cleanRemark) > 160 {
				cleanRemark = cleanRemark[:157] + "..."
			}
			if cleanRemark == "" {
				cleanRemark = "-"
			}

			partBeforeDisplay := it.PartBefore
			if strings.TrimSpace(partBeforeDisplay) == "" {
				partBeforeDisplay = "-"
			}
			partAfterDisplay := it.PartAfter
			if strings.TrimSpace(partAfterDisplay) == "" {
				partAfterDisplay = "-"
			}

			rowsHTML.WriteString(fmt.Sprintf(`
				<tr style="background-color: %s; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
					<td style="padding: 10px 8px; text-align: center; color: #64748b;">%d</td>
					<td style="padding: 10px 8px; font-weight: 700; color: #0d7377; white-space: nowrap;">%s</td>
					<td style="padding: 10px 8px; font-weight: 600; color: #1e293b;">%s</td>
					<td style="padding: 10px 8px;">
						<span style="display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 700;">%s</span>
					</td>
					<td style="padding: 10px 8px;">
						<span style="display: inline-block; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 700;">%s</span>
					</td>
					<td style="padding: 10px 8px; font-weight: 700; color: #dc2626; white-space: nowrap;">%s</td>
					<td style="padding: 10px 8px; text-align: center;">
						<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 700; color: #ffffff; background-color: %s;">
							%s
						</span>
					</td>
					<td style="padding: 10px 8px; color: #475569; font-size: 11px;">
						<div>%s</div>
						<div style="margin-top: 4px; font-weight: 600; color: #0284c7;">Konfirmasi: Berubah / Tetap?</div>
					</td>
				</tr>
			`, bg, i+1, it.ECNNo, it.Model, partBeforeDisplay, partAfterDisplay, it.RunningDateBOM, statusBadgeColor, it.Status, cleanRemark))
		}
	}

	testBanner := ""
	if triggerType == "MANUAL_TEST" {
		testBanner = `
			<div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 10px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 600; margin-bottom: 16px; text-align: center;">
				⚡ [UJI COBA SISTEM] Ini adalah email tes yang dipicu secara manual dari Modal Pengaturan ECN Monitoring.
			</div>
		`
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ECN Running BOM Deadline Reminder</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
	<div style="max-width: 960px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
		
		<!-- Header Banner -->
		<div style="background: linear-gradient(135deg, #0d7377 0%%, #14ffec 100%%); padding: 24px 28px; color: #ffffff;">
			<div style="display: flex; align-items: center; justify-content: space-between;">
				<div>
					<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #e0f2fe; margin-bottom: 4px;">
						PT Samsung Electronics Indonesia • Production Engineering
					</div>
					<h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
						ECN Running BOM Deadline Alert
					</h1>
					<p style="margin: 4px 0 0; font-size: 13px; color: #f0fdfa; opacity: 0.95;">
						Pemberitahuan verifikasi Running BOM untuk PIC & Tim Engineering terkait
					</p>
				</div>
			</div>
		</div>

		<!-- Main Container -->
		<div style="padding: 24px 28px;">
			%s

			<!-- Summary Cards -->
			<div style="display: table; width: 100%%; margin-bottom: 22px;">
				<div style="display: table-cell; width: 32%%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px;">
					<div style="font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total ECN Jatuh Tempo</div>
					<div style="font-size: 24px; font-weight: 800; color: #dc2626; margin-top: 2px;">%d <span style="font-size: 13px; font-weight: 500; color: #64748b;">Dokumen</span></div>
				</div>
				<div style="display: table-cell; width: 2%%;"></div>
				<div style="display: table-cell; width: 32%%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px;">
					<div style="font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Target Running BOM</div>
					<div style="font-size: 18px; font-weight: 800; color: #0d7377; margin-top: 5px;">%s</div>
				</div>
				<div style="display: table-cell; width: 2%%;"></div>
				<div style="display: table-cell; width: 32%%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px;">
					<div style="font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Ambang Peringatan</div>
					<div style="font-size: 18px; font-weight: 800; color: #2563eb; margin-top: 5px;">H-%d <span style="font-size: 12.5px; font-weight: 500; color: #64748b;">Sebelum Deadline</span></div>
				</div>
			</div>

			<!-- Notice Banner -->
			<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 12.5px; color: #1e3a8a;">
				<strong>Instruksi Verifikasi BOM:</strong> Dokumen ECN di atas memiliki jadwal Running BOM yang mendekati deadline. Mohon konfirmasi PIC terkait: <em>Apakah part ini akan berubah sesuai jadwal atau tetap menggunakan part lama?</em>
			</div>

			<!-- ECN Table -->
			<div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 24px;">
				<table style="width: 100%%; border-collapse: collapse; text-align: left;">
					<thead>
						<tr style="background-color: #0f172a; color: #ffffff; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">
							<th style="padding: 10px 8px; width: 32px; text-align: center;">#</th>
							<th style="padding: 10px 8px;">ECN NO</th>
							<th style="padding: 10px 8px;">Model</th>
							<th style="padding: 10px 8px;">Part Lama (Before)</th>
							<th style="padding: 10px 8px;">Part Baru (After)</th>
							<th style="padding: 10px 8px;">Running BOM</th>
							<th style="padding: 10px 8px; text-align: center;">Status</th>
							<th style="padding: 10px 8px;">Remark & Konfirmasi</th>
						</tr>
					</thead>
					<tbody>
						%s
					</tbody>
				</table>
			</div>

			<!-- Action CTA -->
			<div style="text-align: center; margin: 28px 0 16px;">
				<a href="http://localhost:3025/ecn-monitoring" target="_blank" style="display: inline-block; background-color: #0d7377; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13.5px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 2px 4px rgba(13, 115, 119, 0.3);">
					Buka Halaman ECN Monitoring Portal &rarr;
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11.5px; color: #64748b;">
			Email notifikasi otomatis ini dihasilkan oleh <strong>SEIN PE-Portal v2</strong>. Harap tidak membalas langsung ke alamat email ini.
		</div>
	</div>
</body>
</html>
	`, testBanner, len(items), targetDateStr, daysBefore, rowsHTML.String())
}

// RenderBOMChangeNotificationHTML generates an alert email when an ECN's Running BOM date is updated
func (w *ECNReminderWorker) RenderBOMChangeNotificationHTML(oldRec, newRec *model.ECNRecord, updaterName string) string {
	nowStr := time.Now().In(w.wibLocation).Format("02/01/2006 15:04") + " WIB"

	oldDate := oldRec.RunningDateBOM
	if strings.TrimSpace(oldDate) == "" {
		oldDate = "(Belum Ditentukan)"
	}
	newDate := newRec.RunningDateBOM
	if strings.TrimSpace(newDate) == "" {
		newDate = "(Dikosongkan)"
	}

	partChangeHTML := ""
	if newRec.PartBefore != "" || newRec.PartAfter != "" {
		partChangeHTML = fmt.Sprintf(`
			<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px;">
				<div style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Detail Perubahan Part Number (BOM Change)</div>
				<div style="font-size: 13px;">
					<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-weight: 700;">OLD: %s</span>
					<span style="color: #64748b; margin: 0 8px;">➔</span>
					<span style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-weight: 700;">NEW: %s</span>
				</div>
			</div>
		`, newRec.PartBefore, newRec.PartAfter)
	}

	remarkHTML := newRec.Remark
	if strings.TrimSpace(remarkHTML) == "" {
		remarkHTML = "-"
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Update Jadwal Running BOM - %s</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
	<div style="max-width: 720px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
		
		<!-- Header Banner (Amber tone for schedule change) -->
		<div style="background: linear-gradient(135deg, #d97706 0%%, #b45309 100%%); padding: 22px 26px; color: #ffffff;">
			<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #fef3c7; margin-bottom: 4px;">
				PT Samsung Electronics Indonesia • Production Engineering
			</div>
			<h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #ffffff;">
				Pemberitahuan Perubahan Jadwal Running BOM
			</h1>
			<p style="margin: 4px 0 0; font-size: 12.5px; color: #fffbeb; opacity: 0.95;">
				Terdeteksi pembaruan tanggal Running Date BOM pada dokumen ECN di bawah ini.
			</p>
		</div>

		<!-- Body -->
		<div style="padding: 24px 26px;">
			<!-- Running BOM Delta Box -->
			<div style="background-color: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; text-align: center;">
				<div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
					Perubahan Jadwal Running BOM
				</div>
				<div style="font-size: 18px; font-weight: 800;">
					<span style="color: #64748b; text-decoration: line-through; margin-right: 12px;">%s</span>
					<span style="color: #b45309; margin-right: 12px;">➔</span>
					<span style="color: #dc2626; background: #fee2e2; border: 1px solid #fca5a5; padding: 3px 10px; border-radius: 6px;">%s</span>
				</div>
				<div style="font-size: 11.5px; color: #78350f; margin-top: 8px;">
					Diperbarui oleh: <strong>%s</strong> • Waktu: %s
				</div>
			</div>

			<!-- ECN Details Table -->
			<table style="width: 100%%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
				<tr style="border-bottom: 1px solid #f1f5f9;">
					<td style="padding: 8px 0; color: #64748b; width: 140px; font-weight: 600;">Nomor ECN:</td>
					<td style="padding: 8px 0; font-weight: 700; color: #0d7377;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #f1f5f9;">
					<td style="padding: 8px 0; color: #64748b; font-weight: 600;">Model:</td>
					<td style="padding: 8px 0; font-weight: 600; color: #0f172a;">%s</td>
				</tr>
				<tr style="border-bottom: 1px solid #f1f5f9;">
					<td style="padding: 8px 0; color: #64748b; font-weight: 600;">Proses & Status:</td>
					<td style="padding: 8px 0; color: #0f172a;">%s • <span style="font-weight: 600; color: #d97706;">%s</span></td>
				</tr>
				<tr style="border-bottom: 1px solid #f1f5f9;">
					<td style="padding: 8px 0; color: #64748b; font-weight: 600;">Judul ECN:</td>
					<td style="padding: 8px 0; color: #334155;">%s</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Catatan / Remark:</td>
					<td style="padding: 8px 0; color: #334155; white-space: pre-wrap; font-size: 12.5px;">%s</td>
				</tr>
			</table>

			%s

			<!-- Action CTA -->
			<div style="text-align: center; margin: 24px 0 12px;">
				<a href="http://localhost:3025/ecn-monitoring" target="_blank" style="display: inline-block; background-color: #0d7377; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 6px;">
					Buka Data ECN di Portal PE &rarr;
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 26px; text-align: center; font-size: 11px; color: #64748b;">
			Email notifikasi realtime ini dihasilkan otomatis saat ada pembaruan tanggal Running BOM pada <strong>SEIN PE-Portal</strong>.
		</div>
	</div>
</body>
</html>
	`, newRec.ECNNo, oldDate, newDate, updaterName, nowStr, newRec.ECNNo, newRec.Model, newRec.Process, newRec.Status, newRec.ECTitle, remarkHTML, partChangeHTML)
}

// NotifyBOMDateChange sends immediate email notification when an ECN's Running BOM date is changed
func (w *ECNReminderWorker) NotifyBOMDateChange(ctx context.Context, oldRec, newRec *model.ECNRecord, updaterName string) {
	if oldRec == nil || newRec == nil {
		return
	}
	// Only notify if running_date_bom actually changed
	if strings.TrimSpace(oldRec.RunningDateBOM) == strings.TrimSpace(newRec.RunningDateBOM) {
		return
	}

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		settings, err := w.repo.GetSettings(bgCtx)
		if err != nil {
			log.Printf("[ECN Reminder Worker] Failed to fetch settings for BOM change alert: %v\n", err)
			return
		}

		if !settings.BOMChangeNotifyEnabled {
			return
		}

		rawRecipients := settings.BOMChangeRecipients
		if strings.TrimSpace(rawRecipients) == "" {
			rawRecipients = settings.Recipients
		}
		recipients := parseEmailList(rawRecipients)
		if len(recipients) == 0 {
			log.Println("[ECN Reminder Worker] No recipients configured for BOM change alert. Skipping.")
			return
		}

		rawCC := settings.BOMChangeCCRecipients
		if strings.TrimSpace(rawCC) == "" {
			rawCC = settings.CCRecipients
		}
		ccRecipients := parseEmailList(rawCC)

		subject := settings.BOMChangeEmailSubject
		if strings.TrimSpace(subject) == "" {
			subject = "[UPDATE] Perubahan Jadwal Running BOM - {ecn_no} ({model})"
		}
		subject = strings.ReplaceAll(subject, "{ecn_no}", newRec.ECNNo)
		subject = strings.ReplaceAll(subject, "{model}", newRec.Model)
		subject = strings.ReplaceAll(subject, "{old_date}", oldRec.RunningDateBOM)
		subject = strings.ReplaceAll(subject, "{new_date}", newRec.RunningDateBOM)

		smtpCfg, err := w.reportRepo.GetDefaultSMTP(bgCtx)
		if err != nil {
			log.Printf("[ECN Reminder Worker] Failed to get default SMTP gateway: %v\n", err)
			_ = w.repo.RecordLog(bgCtx, &model.ECNReminderLog{
				Recipients:   strings.Join(recipients, ", "),
				CCRecipients: strings.Join(ccRecipients, ", "),
				ItemCount:    1,
				ECNNumbers:   newRec.ECNNo,
				Status:       "FAILED",
				ErrorMessage: fmt.Sprintf("SMTP gateway error: %v", err),
				TriggeredBy:  "BOM_DATE_CHANGE",
			})
			return
		}

		htmlBody := w.RenderBOMChangeNotificationHTML(oldRec, newRec, updaterName)
		sendErr := w.smtpSvc.SendEmail(smtpCfg, recipients, ccRecipients, subject, htmlBody)

		status := "SUCCESS"
		var errText string
		if sendErr != nil {
			status = "FAILED"
			errText = sendErr.Error()
			log.Printf("[ECN Reminder Worker] Failed to send BOM date change email: %v\n", sendErr)
		} else {
			log.Printf("[ECN Reminder Worker] Dispatched BOM date change email for %s to %v\n", newRec.ECNNo, recipients)
		}

		_ = w.repo.RecordLog(bgCtx, &model.ECNReminderLog{
			Recipients:   strings.Join(recipients, ", "),
			CCRecipients: strings.Join(ccRecipients, ", "),
			ItemCount:    1,
			ECNNumbers:   newRec.ECNNo,
			Status:       status,
			ErrorMessage: errText,
			TriggeredBy:  "BOM_DATE_CHANGE",
		})
	}()
}

// SendTestBOMChangeEmail dispatches a test notification for BOM date change
func (w *ECNReminderWorker) SendTestBOMChangeEmail(ctx context.Context) error {
	settings, err := w.repo.GetSettings(ctx)
	if err != nil {
		return err
	}

	rawRecipients := settings.BOMChangeRecipients
	if strings.TrimSpace(rawRecipients) == "" {
		rawRecipients = settings.Recipients
	}
	recipients := parseEmailList(rawRecipients)
	if len(recipients) == 0 {
		return fmt.Errorf("daftar penerima email perubahan Running BOM masih kosong")
	}

	rawCC := settings.BOMChangeCCRecipients
	if strings.TrimSpace(rawCC) == "" {
		rawCC = settings.CCRecipients
	}
	ccRecipients := parseEmailList(rawCC)

	subject := settings.BOMChangeEmailSubject
	if strings.TrimSpace(subject) == "" {
		subject = "[TEST] Perubahan Jadwal Running BOM - GHW202626A8 (SM-F976B)"
	} else {
		subject = "[TEST] " + subject
		subject = strings.ReplaceAll(subject, "{ecn_no}", "GHW202626A8")
		subject = strings.ReplaceAll(subject, "{model}", "SM-F976B")
		subject = strings.ReplaceAll(subject, "{old_date}", "2026-06-20")
		subject = strings.ReplaceAll(subject, "{new_date}", "2026-06-25")
	}

	smtpCfg, err := w.reportRepo.GetDefaultSMTP(ctx)
	if err != nil {
		return fmt.Errorf("gagal mendapatkan gateway SMTP: %w", err)
	}

	mockOld := &model.ECNRecord{
		ECNNo:          "GHW202626A8",
		Model:          "SM-F976B",
		Process:        "Mainline",
		Status:         "Progress",
		ECTitle:        "[ECN-BOM] [Q8] SM-F976B Main win paper change in all regions",
		RunningDateBOM: "2026-06-20",
		PartBefore:     "GH63-23138A",
		PartAfter:      "GH63-23137A",
		Remark:         "Sample test notification for Running BOM date change",
	}
	mockNew := &model.ECNRecord{
		ECNNo:          "GHW202626A8",
		Model:          "SM-F976B",
		Process:        "Mainline",
		Status:         "Progress",
		ECTitle:        "[ECN-BOM] [Q8] SM-F976B Main win paper change in all regions",
		RunningDateBOM: "2026-06-25",
		PartBefore:     "GH63-23138A",
		PartAfter:      "GH63-23137A",
		Remark:         "Sample test notification for Running BOM date change",
	}

	htmlBody := w.RenderBOMChangeNotificationHTML(mockOld, mockNew, "System Administrator (Test)")
	sendErr := w.smtpSvc.SendEmail(smtpCfg, recipients, ccRecipients, subject, htmlBody)

	status := "SUCCESS"
	var errText string
	if sendErr != nil {
		status = "FAILED"
		errText = sendErr.Error()
	}

	_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
		Recipients:   strings.Join(recipients, ", "),
		CCRecipients: strings.Join(ccRecipients, ", "),
		ItemCount:    1,
		ECNNumbers:   "GHW202626A8 (TEST)",
		Status:       status,
		ErrorMessage: errText,
		TriggeredBy:  "MANUAL_TEST_BOM_CHANGE",
	})

	if sendErr != nil {
		return fmt.Errorf("gagal mengirim email melalui SMTP: %w", sendErr)
	}
	return nil
}
