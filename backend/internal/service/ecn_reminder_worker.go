package service

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

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

	cachedBOMSlots     []ScheduleSlot
	cachedBOMEnabled   bool
	dispatchedBOMSlots map[string]bool // key: "YYYY-MM-DD@HH:MM"
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
		repo:               repo,
		reportRepo:         reportRepo,
		smtpSvc:            smtpSvc,
		stopCh:             make(chan struct{}),
		cachedSlots:        []ScheduleSlot{{Hour: 8, Minute: 0}},
		dispatchedSlots:    make(map[string]bool),
		cachedBOMSlots:     []ScheduleSlot{{Hour: 8, Minute: 0}, {Hour: 13, Minute: 0}, {Hour: 16, Minute: 0}},
		dispatchedBOMSlots: make(map[string]bool),
		wibLocation:        wib,
	}
}

// Start initiates the background scheduler loop
func (w *ECNReminderWorker) Start(ctx context.Context) {
	log.Println("[ECN Reminder Worker] Starting background worker for Running BOM deadline & batch schedule changes...")
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

// parseScheduleSlots extracts valid Hour & Minute slots from a raw string
func parseScheduleSlots(rawTime string, defaultSlots []ScheduleSlot) []ScheduleSlot {
	var slots []ScheduleSlot
	rawTimes := strings.FieldsFunc(rawTime, func(r rune) bool {
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
		return defaultSlots
	}
	return slots
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
	w.cachedSlots = parseScheduleSlots(settings.SendTime, []ScheduleSlot{{Hour: 8, Minute: 0}})

	w.cachedBOMEnabled = settings.BOMChangeNotifyEnabled
	w.cachedBOMSlots = parseScheduleSlots(settings.BOMChangeSendTime, []ScheduleSlot{{Hour: 8, Minute: 0}, {Hour: 13, Minute: 0}, {Hour: 16, Minute: 0}})

	return nil
}

// tickCheck runs on every tick (ponytail: compares RAM integers only, 0 database queries)
func (w *ECNReminderWorker) tickCheck(ctx context.Context) {
	w.mu.Lock()
	enabled := w.cachedEnabled
	slots := append([]ScheduleSlot(nil), w.cachedSlots...)

	bomEnabled := w.cachedBOMEnabled
	bomSlots := append([]ScheduleSlot(nil), w.cachedBOMSlots...)
	w.mu.Unlock()

	now := time.Now().In(w.wibLocation)
	todayStr := now.Format("2006-01-02")
	h := now.Hour()
	m := now.Minute()
	slotKey := fmt.Sprintf("%s@%02d:%02d", todayStr, h, m)

	// 1. Check Deadline Reminder slots
	if enabled && len(slots) > 0 {
		w.mu.Lock()
		for k := range w.dispatchedSlots {
			if !strings.HasPrefix(k, todayStr) {
				delete(w.dispatchedSlots, k)
			}
		}
		alreadySent := w.dispatchedSlots[slotKey]
		matched := false
		if !alreadySent {
			for _, s := range slots {
				if s.Hour == h && s.Minute == m {
					matched = true
					break
				}
			}
		}
		if matched {
			w.dispatchedSlots[slotKey] = true
		}
		w.mu.Unlock()

		if matched {
			log.Printf("[ECN Reminder Worker] Scheduled deadline reminder slot %02d:%02d arrived. Triggering...\n", h, m)
			go func() {
				if _, err := w.ExecuteReminder(ctx, "SCHEDULE"); err != nil {
					log.Printf("[ECN Reminder Worker] Scheduled execution failed for slot %s: %v\n", slotKey, err)
				}
			}()
		}
	}

	// 2. Check BOM Change Batch Notification slots (ponytail: batch at scheduled hours)
	if bomEnabled && len(bomSlots) > 0 {
		w.mu.Lock()
		for k := range w.dispatchedBOMSlots {
			if !strings.HasPrefix(k, todayStr) {
				delete(w.dispatchedBOMSlots, k)
			}
		}
		alreadySentBOM := w.dispatchedBOMSlots[slotKey]
		matchedBOM := false
		if !alreadySentBOM {
			for _, s := range bomSlots {
				if s.Hour == h && s.Minute == m {
					matchedBOM = true
					break
				}
			}
		}
		if matchedBOM {
			w.dispatchedBOMSlots[slotKey] = true
		}
		w.mu.Unlock()

		if matchedBOM {
			log.Printf("[ECN Reminder Worker] Scheduled BOM change batch slot %02d:%02d arrived. Triggering...\n", h, m)
			go func() {
				if _, err := w.ExecuteBOMChangeBatch(ctx, "SCHEDULE"); err != nil {
					log.Printf("[ECN Reminder Worker] Scheduled BOM batch failed for slot %s: %v\n", slotKey, err)
				}
			}()
		}
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
// RenderBOMChangeBatchHTML produces a responsive amber-themed batch report of Running BOM schedule changes
func (w *ECNReminderWorker) RenderBOMChangeBatchHTML(items []model.ECNBOMChangeItem, triggerType string) string {
	nowStr := time.Now().In(w.wibLocation).Format("02/01/2006 15:04") + " WIB"

	var rowsHTML strings.Builder
	for idx, it := range items {
		bg := "#ffffff"
		if idx%2 == 1 {
			bg = "#fafafa"
		}

		oldDate := it.OldDate
		if strings.TrimSpace(oldDate) == "" {
			oldDate = "-"
		}
		newDate := it.NewDate
		if strings.TrimSpace(newDate) == "" {
			newDate = "-"
		}

		partHTML := `<span style="color: #94a3b8; font-size: 11.5px;">-</span>`
		if it.PartBefore != "" || it.PartAfter != "" {
			partHTML = fmt.Sprintf(`
				<div style="font-size: 11.5px; font-family: monospace;">
					<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 3px;">%s</span>
					<span style="color: #64748b;">➔</span>
					<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 3px; font-weight: 700;">%s</span>
				</div>
			`, it.PartBefore, it.PartAfter)
		}

		timeStr := it.CreatedAt.In(w.wibLocation).Format("15:04") + " WIB"
		remark := it.Remark
		if strings.TrimSpace(remark) == "" {
			remark = "-"
		}
		if len(remark) > 140 {
			remark = remark[:140] + "..."
		}

		rowsHTML.WriteString(fmt.Sprintf(`
			<tr style="background-color: %s; border-bottom: 1px solid #e2e8f0;">
				<td style="padding: 10px 12px; font-size: 12.5px; vertical-align: top;">
					<div style="font-weight: 700; color: #0d7377;">%s</div>
					<div style="font-size: 11.5px; color: #475569;">%s • %s</div>
				</td>
				<td style="padding: 10px 12px; font-size: 12.5px; vertical-align: top; white-space: nowrap;">
					<span style="color: #64748b; text-decoration: line-through;">%s</span>
					<span style="color: #b45309; font-weight: bold; margin: 0 4px;">➔</span>
					<span style="color: #dc2626; background: #fee2e2; border: 1px solid #fca5a5; padding: 2px 7px; border-radius: 4px; font-weight: 700;">%s</span>
				</td>
				<td style="padding: 10px 12px; vertical-align: top;">
					%s
				</td>
				<td style="padding: 10px 12px; font-size: 11.5px; color: #475569; vertical-align: top; white-space: nowrap;">
					<div style="font-weight: 600; color: #0f172a;">%s</div>
					<div style="color: #64748b;">%s</div>
				</td>
				<td style="padding: 10px 12px; font-size: 11.5px; color: #334155; vertical-align: top;">
					%s
				</td>
			</tr>
		`, bg, it.ECNNo, it.Model, it.Process, oldDate, newDate, partHTML, it.ChangedByName, timeStr, remark))
	}

	testBanner := ""
	if triggerType == "MANUAL_TEST" {
		testBanner = `
			<div style="background-color: #fef08a; color: #854d0e; padding: 8px 16px; font-size: 12px; font-weight: 700; text-align: center; border-bottom: 1px solid #facc15;">
				🧪 INI ADALAH EMAIL UJI COBA (TEST SEND) DARI MODAL PENGINGAT RUNNING BOM
			</div>
		`
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Ringkasan Batch Perubahan Jadwal Running BOM</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
	<div style="max-width: 840px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
		
		%s

		<!-- Header Banner -->
		<div style="background: linear-gradient(135deg, #d97706 0%%, #b45309 100%%); padding: 22px 26px; color: #ffffff;">
			<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #fef3c7; margin-bottom: 4px;">
				PT Samsung Electronics Indonesia • Production Engineering
			</div>
			<h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #ffffff;">
				Ringkasan Batch Perubahan Jadwal Running BOM
			</h1>
			<p style="margin: 4px 0 0; font-size: 12.5px; color: #fffbeb; opacity: 0.95;">
				Terdapat <strong>%d pembaruan jadwal</strong> yang tercatat pada batch pengiriman ini.
			</p>
		</div>

		<!-- Body -->
		<div style="padding: 24px 26px;">
			<!-- Summary Bar -->
			<div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
				<div style="font-size: 12.5px; color: #78350f;">
					Waktu Batch: <strong>%s</strong>
				</div>
				<div style="font-size: 12.5px; color: #78350f; font-weight: 700;">
					Total ECN Diperbarui: %d Dokumen
				</div>
			</div>

			<!-- Table -->
			<div style="overflow-x: auto;">
				<table style="width: 100%%; border-collapse: collapse; font-size: 12.5px;">
					<thead>
						<tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11.5px; color: #475569; text-transform: uppercase;">
							<th style="padding: 10px 12px;">ECN / Model</th>
							<th style="padding: 10px 12px;">Perubahan Jadwal</th>
							<th style="padding: 10px 12px;">Part Change</th>
							<th style="padding: 10px 12px;">Diubah Oleh</th>
							<th style="padding: 10px 12px;">Remark / Catatan</th>
						</tr>
					</thead>
					<tbody>
						%s
					</tbody>
				</table>
			</div>

			<!-- CTA Button -->
			<div style="text-align: center; margin: 26px 0 10px;">
				<a href="http://localhost:3025/ecn-monitoring" target="_blank" style="display: inline-block; background-color: #0d7377; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 6px;">
					Buka Data ECN di Portal PE &rarr;
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 26px; text-align: center; font-size: 11px; color: #64748b;">
			Email notifikasi batch ini dikirim otomatis sesuai jadwal batch yang ditentukan pada <strong>SEIN PE-Portal</strong>.
		</div>
	</div>
</body>
</html>
	`, testBanner, len(items), nowStr, len(items), rowsHTML.String())
}

// ExecuteBOMChangeBatch collects all unnotified Running BOM changes and dispatches them in a single batch email
func (w *ECNReminderWorker) ExecuteBOMChangeBatch(ctx context.Context, triggerType string) (int, error) {
	settings, err := w.repo.GetSettings(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch reminder settings: %w", err)
	}

	if triggerType == "SCHEDULE" && !settings.BOMChangeNotifyEnabled {
		return 0, nil
	}

	records, err := w.repo.GetPendingBOMChangeRecords(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to get pending bom change records: %w", err)
	}

	// If no records and this is a schedule trigger, skip silently without spamming
	if len(records) == 0 {
		if triggerType == "SCHEDULE" {
			log.Println("[ECN Reminder Worker] No pending Running BOM changes for batch. Skipping email.")
			_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
				Recipients:   settings.BOMChangeRecipients,
				CCRecipients: settings.BOMChangeCCRecipients,
				ItemCount:    0,
				ECNNumbers:   "",
				Status:       "SKIPPED",
				TriggeredBy:  "SCHEDULE_BOM_CHANGE",
			})
			return 0, nil
		}
		// In MANUAL_TEST mode, generate a mock record so user can inspect the layout
		records = []model.ECNBOMChangeItem{
			{
				ECNNo:         "GHW202626A8",
				Model:         "SM-F976B",
				Process:       "Mainline",
				Status:        "Pending",
				ECTitle:       "[ECN-BOM] [Q8] SM-F976B Main win paper change in all regions",
				OldDate:       "2026-06-20",
				NewDate:       "2026-06-25",
				ChangedByName: "System Administrator (Test)",
				PartBefore:    "GH63-23138A",
				PartAfter:     "GH63-23137A",
				Remark:        "Test sample batch schedule change for preview",
				CreatedAt:     time.Now(),
			},
		}
	}

	rawRecipients := settings.BOMChangeRecipients
	if strings.TrimSpace(rawRecipients) == "" {
		rawRecipients = settings.Recipients
	}
	recipients := parseEmailList(rawRecipients)
	if len(recipients) == 0 {
		return 0, fmt.Errorf("daftar penerima email perubahan Running BOM masih kosong")
	}

	rawCC := settings.BOMChangeCCRecipients
	if strings.TrimSpace(rawCC) == "" {
		rawCC = settings.CCRecipients
	}
	ccRecipients := parseEmailList(rawCC)

	subject := settings.BOMChangeEmailSubject
	if strings.TrimSpace(subject) == "" {
		subject = "[UPDATE] Perubahan Jadwal Running BOM ({count} ECN)"
	}
	subject = strings.ReplaceAll(subject, "{count}", strconv.Itoa(len(records)))
	if len(records) > 0 {
		subject = strings.ReplaceAll(subject, "{ecn_no}", records[0].ECNNo)
		subject = strings.ReplaceAll(subject, "{model}", records[0].Model)
		subject = strings.ReplaceAll(subject, "{old_date}", records[0].OldDate)
		subject = strings.ReplaceAll(subject, "{new_date}", records[0].NewDate)
	}
	if triggerType == "MANUAL_TEST" && !strings.HasPrefix(subject, "[TEST]") {
		subject = "[TEST] " + subject
	}

	smtpCfg, err := w.reportRepo.GetDefaultSMTP(ctx)
	if err != nil {
		return 0, fmt.Errorf("gagal mendapatkan gateway SMTP: %w", err)
	}

	htmlBody := w.RenderBOMChangeBatchHTML(records, triggerType)
	sendErr := w.smtpSvc.SendEmail(smtpCfg, recipients, ccRecipients, subject, htmlBody)

	var logIDs []uuid.UUID
	var ecnNumbers []string
	for _, it := range records {
		if it.LogID != uuid.Nil {
			logIDs = append(logIDs, it.LogID)
		}
		if it.ECNNo != "" {
			ecnNumbers = append(ecnNumbers, it.ECNNo)
		}
	}

	status := "SUCCESS"
	var errText string
	if sendErr != nil {
		status = "FAILED"
		errText = sendErr.Error()
		log.Printf("[ECN Reminder Worker] Failed to send BOM change batch email: %v\n", sendErr)
	} else {
		log.Printf("[ECN Reminder Worker] Dispatched BOM change batch email (%d items) to %v\n", len(records), recipients)
		if len(logIDs) > 0 {
			// Mark notified so they are not included in subsequent batches
			_ = w.repo.MarkBOMChangesNotified(ctx, logIDs)
		}
	}

	_ = w.repo.RecordLog(ctx, &model.ECNReminderLog{
		Recipients:   strings.Join(recipients, ", "),
		CCRecipients: strings.Join(ccRecipients, ", "),
		ItemCount:    len(records),
		ECNNumbers:   strings.Join(ecnNumbers, ", "),
		Status:       status,
		ErrorMessage: errText,
		TriggeredBy:  triggerType + "_BOM_CHANGE",
	})

	if sendErr != nil {
		return len(records), fmt.Errorf("gagal mengirim email melalui SMTP: %w", sendErr)
	}
	return len(records), nil
}
