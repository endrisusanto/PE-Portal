package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
)

const (
	DHLAPIKey = "mLG4tKn8BRN9NAdRHtFOCqgIqEzUsaOb"
	DHLAPIURL = "https://api-eu.dhl.com/track/shipments"
)

type DHLHandler struct {
	repo       *repository.DHLRepository
	userRepo   *repository.UserRepository
	reportRepo *repository.ReportRepository
	smtpSvc    *service.SMTPService
}

func NewDHLHandler(
	repo *repository.DHLRepository,
	userRepo *repository.UserRepository,
	reportRepo *repository.ReportRepository,
	smtpSvc *service.SMTPService,
) *DHLHandler {
	return &DHLHandler{
		repo:       repo,
		userRepo:   userRepo,
		reportRepo: reportRepo,
		smtpSvc:    smtpSvc,
	}
}

// Fetch live shipment JSON from DHL Unified Tracking API
func fetchDHLTracking(trackingNumber string) (map[string]interface{}, error) {
	trackingNumber = strings.TrimSpace(trackingNumber)
	if trackingNumber == "" {
		return nil, fmt.Errorf("tracking number is required")
	}

	client := &http.Client{Timeout: 15 * time.Second}
	reqURL := fmt.Sprintf("%s?trackingNumber=%s", DHLAPIURL, trackingNumber)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("DHL-API-Key", DHLAPIKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error calling DHL API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read DHL response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errData map[string]interface{}
		_ = json.Unmarshal(body, &errData)
		detail := string(body)
		if msg, ok := errData["detail"].(string); ok {
			detail = msg
		} else if title, ok := errData["title"].(string); ok {
			detail = title
		}
		return nil, fmt.Errorf("DHL API returned status %d: %s", resp.StatusCode, detail)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse DHL JSON: %w", err)
	}

	return result, nil
}

// CheckAPIStatus verifies if DHL API key and endpoint are valid and responding
func (h *DHLHandler) CheckAPIStatus(c echo.Context) error {
	client := &http.Client{Timeout: 8 * time.Second}
	reqURL := fmt.Sprintf("%s?trackingNumber=1234567890", DHLAPIURL)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"valid":   false,
			"status":  "error",
			"message": err.Error(),
		})
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("DHL-API-Key", DHLAPIKey)

	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"valid":   false,
			"status":  "offline",
			"message": "Connection to DHL API failed",
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"valid":   false,
			"status":  "invalid_key",
			"code":    resp.StatusCode,
			"message": "DHL API Key is invalid or expired",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":   true,
		"status":  "active",
		"code":    resp.StatusCode,
		"message": "DHL API Connected",
	})
}

// TrackDirect proxies the live DHL API for direct searches without requiring saved state
func (h *DHLHandler) TrackDirect(c echo.Context) error {
	awb := c.QueryParam("trackingNumber")
	if awb == "" {
		awb = c.QueryParam("awb")
	}
	if awb == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "trackingNumber parameter is required"})
	}

	data, err := fetchDHLTracking(awb)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"message": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, data)
}

// ListShipments returns all saved tracked shipments
func (h *DHLHandler) ListShipments(c echo.Context) error {
	search := c.QueryParam("search")
	status := c.QueryParam("status")
	collected := c.QueryParam("collected")

	items, err := h.repo.List(c.Request().Context(), search, status, collected)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	return c.JSON(http.StatusOK, items)
}

// extractShipmentRecord parses first shipment from DHL API response JSON into DHLShipmentRecord
func extractShipmentRecord(awb string, pic string, notes string, dhlData map[string]interface{}) (*repository.DHLShipmentRecord, error) {
	shipmentsArr, ok := dhlData["shipments"].([]interface{})
	if !ok || len(shipmentsArr) == 0 {
		return nil, fmt.Errorf("no shipment data found in DHL response for AWB %s", awb)
	}

	firstShipment, _ := shipmentsArr[0].(map[string]interface{})
	serviceName, _ := firstShipment["service"].(string)

	var origCountry, origCity, destCountry, destCity string
	if orig, ok := firstShipment["origin"].(map[string]interface{}); ok {
		if addr, ok := orig["address"].(map[string]interface{}); ok {
			origCountry, _ = addr["countryCode"].(string)
			origCity, _ = addr["addressLocality"].(string)
		}
	}
	if dest, ok := firstShipment["destination"].(map[string]interface{}); ok {
		if addr, ok := dest["address"].(map[string]interface{}); ok {
			destCountry, _ = addr["countryCode"].(string)
			destCity, _ = addr["addressLocality"].(string)
		}
	}

	var statusCode, statusLabel, statusDesc, lastLoc string
	var lastEventTime *time.Time

	if st, ok := firstShipment["status"].(map[string]interface{}); ok {
		statusCode, _ = st["statusCode"].(string)
		statusLabel, _ = st["status"].(string)
		statusDesc, _ = st["description"].(string)
		if tsStr, ok := st["timestamp"].(string); ok && tsStr != "" {
			if tVal, err := time.Parse(time.RFC3339, tsStr); err == nil {
				lastEventTime = &tVal
			}
		}
		if loc, ok := st["location"].(map[string]interface{}); ok {
			if addr, ok := loc["address"].(map[string]interface{}); ok {
				lastLoc, _ = addr["addressLocality"].(string)
			}
		}
	}

	rawJSON, _ := json.Marshal(firstShipment)

	return &repository.DHLShipmentRecord{
		ID:                awb,
		ServiceName:       serviceName,
		OriginCountry:     origCountry,
		OriginCity:        origCity,
		DestCountry:       destCountry,
		DestCity:          destCity,
		StatusCode:        statusCode,
		StatusLabel:       statusLabel,
		StatusDescription: statusDesc,
		LastEventTime:     lastEventTime,
		LastLocation:      lastLoc,
		PIC:               pic,
		Notes:             notes,
		ShipmentData:      rawJSON,
	}, nil
}

// sendDeliveredEmailNotification sends an alert to the PIC and engineering team when package arrives
func (h *DHLHandler) sendDeliveredEmailNotification(ctx context.Context, s *repository.DHLShipmentRecord) ([]string, error) {
	if h.smtpSvc == nil || h.reportRepo == nil {
		return nil, fmt.Errorf("SMTP service is not configured")
	}

	smtpCfg, err := h.reportRepo.GetDefaultSMTP(ctx)
	if err != nil || smtpCfg == nil || smtpCfg.Host == "" {
		return nil, fmt.Errorf("default SMTP configuration not found or disabled")
	}

	var toEmails []string
	cleanPic := strings.TrimSpace(s.PIC)

	// Check if PIC is registered user or email address
	if strings.Contains(cleanPic, "@") {
		toEmails = append(toEmails, cleanPic)
	} else if cleanPic != "" && h.userRepo != nil {
		allUsers, _ := h.userRepo.ListUsers(ctx, nil, "")
		for _, u := range allUsers {
			if strings.EqualFold(u.FullName, cleanPic) || strings.EqualFold(u.Username, cleanPic) {
				if u.Email != "" {
					toEmails = append(toEmails, u.Email)
				}
				break
			}
		}
	}

	// Fallback to active admin or managers if no recipient resolved
	if len(toEmails) == 0 && h.userRepo != nil {
		allUsers, _ := h.userRepo.ListUsers(ctx, nil, "")
		for _, u := range allUsers {
			if u.Email != "" && (u.Role == "admin" || u.Role == "manager") {
				toEmails = append(toEmails, u.Email)
			}
		}
	}

	if len(toEmails) == 0 {
		return nil, fmt.Errorf("no recipient email address found for PIC %s", cleanPic)
	}

	lastTimeStr := "Sekarang"
	if s.LastEventTime != nil {
		lastTimeStr = s.LastEventTime.Format("02 Jan 2006, 15:04 MST")
	}
	routeStr := fmt.Sprintf("%s, %s → %s, %s", s.OriginCity, s.OriginCountry, s.DestCity, s.DestCountry)
	notesHTML := ""
	if s.Notes != "" {
		notesHTML = fmt.Sprintf(`<div style="margin: 16px 0; padding: 12px 14px; background: #fefce8; border-left: 4px solid #eab308; border-radius: 4px; font-size: 13px; color: #713f12;"><strong>Catatan Sample / Identitas:</strong><br/><span style="white-space: pre-wrap;">%s</span></div>`, s.Notes)
	}

	subject := fmt.Sprintf("[DHL Express] Sample Tiba (Delivered) - AWB #%s", s.ID)
	htmlBody := fmt.Sprintf(`
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1e293b; padding: 20px 24px; border-bottom: 3px solid #10b981;">
    <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">SEIN Production Engineer Portal</h2>
    <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Notifikasi Kedatangan Sample / Paket Hardware DHL Express</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Halo <strong>%s</strong>,</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.5;">Kiriman sample / hardware dengan nomor AWB <strong>%s</strong> telah berstatus <span style="display: inline-block; padding: 2px 8px; background: #dcfce7; color: #15803d; border-radius: 4px; font-weight: 700;">DELIVERED</span>.</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;">
      <table style="width: 100%%; border-collapse: collapse; font-size: 13.5px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Nomor Resi / AWB:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Layanan:</td>
          <td style="padding: 6px 0; color: #0f172a;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Rute Perjalanan:</td>
          <td style="padding: 6px 0; color: #0f172a;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Waktu Tiba:</td>
          <td style="padding: 6px 0; color: #0f172a;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Lokasi Terakhir:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">%s</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 600;">PIC Penerima:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">%s</td>
        </tr>
      </table>
    </div>

    %s

    <div style="margin: 20px 0; text-align: center;">
      <a href="https://www.dhl.com/en/express/tracking.html?AWB=%s" target="_blank" style="display: inline-block; padding: 10px 20px; background: #d40511; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Lihat Pelacakan di Situs DHL</a>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.4;">
      <p style="margin: 0;">Harap segera mengambil fisik sample di bagian Security / Reception dan perbarui status di <strong>PE-Portal</strong>.</p>
      <p style="margin: 4px 0 0; color: #94a3b8;">Email ini dikirim otomatis oleh SEIN PE Portal DHL Notification Gateway.</p>
    </div>
  </div>
</div>`,
		cleanPic,
		s.ID,
		s.ID,
		s.ServiceName,
		routeStr,
		lastTimeStr,
		s.LastLocation,
		cleanPic,
		notesHTML,
		s.ID,
	)

	if err := h.smtpSvc.SendEmail(smtpCfg, toEmails, nil, subject, htmlBody); err != nil {
		return nil, fmt.Errorf("failed to send email via SMTP: %w", err)
	}

	_ = h.repo.MarkDeliveredNotified(ctx, s.ID)
	return toEmails, nil
}

// CreateShipment tracks one or multiple shipments from DHL API and persists them
func (h *DHLHandler) CreateShipment(c echo.Context) error {
	var payload struct {
		TrackingNumber  string   `json:"tracking_number"`
		TrackingNumbers []string `json:"tracking_numbers"`
		PIC             string   `json:"pic"`
		Notes           string   `json:"notes"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
	}

	// ponytail: normalize single tracking number or multi-line/comma inputs
	var awbList []string
	if len(payload.TrackingNumbers) > 0 {
		for _, num := range payload.TrackingNumbers {
			if trimmed := strings.TrimSpace(num); trimmed != "" {
				awbList = append(awbList, trimmed)
			}
		}
	}
	if payload.TrackingNumber != "" {
		split := strings.FieldsFunc(payload.TrackingNumber, func(r rune) bool {
			return r == ',' || r == '\n' || r == '\r' || r == ';' || r == ' '
		})
		for _, num := range split {
			if trimmed := strings.TrimSpace(num); trimmed != "" {
				awbList = append(awbList, trimmed)
			}
		}
	}

	// De-duplicate
	uniqueAWBs := make([]string, 0, len(awbList))
	seen := make(map[string]bool)
	for _, a := range awbList {
		if !seen[a] {
			seen[a] = true
			uniqueAWBs = append(uniqueAWBs, a)
		}
	}

	if len(uniqueAWBs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Nomor resi / AWB DHL wajib diisi"})
	}

	type TrackResult struct {
		AWB     string                     `json:"awb"`
		Success bool                       `json:"success"`
		Record  *repository.DHLShipmentRecord `json:"record,omitempty"`
		Error   string                     `json:"error,omitempty"`
	}

	results := make([]TrackResult, 0, len(uniqueAWBs))
	for _, awb := range uniqueAWBs {
		dhlData, err := fetchDHLTracking(awb)
		if err != nil {
			results = append(results, TrackResult{AWB: awb, Success: false, Error: err.Error()})
			continue
		}

		record, err := extractShipmentRecord(awb, payload.PIC, payload.Notes, dhlData)
		if err != nil {
			results = append(results, TrackResult{AWB: awb, Success: false, Error: err.Error()})
			continue
		}

		if err := h.repo.Upsert(c.Request().Context(), record); err != nil {
			results = append(results, TrackResult{AWB: awb, Success: false, Error: fmt.Sprintf("Gagal menyimpan: %v", err)})
			continue
		}

		// Auto email notification if already delivered
		if strings.EqualFold(record.StatusCode, "delivered") {
			go func(rec *repository.DHLShipmentRecord) {
				_, _ = h.sendDeliveredEmailNotification(context.Background(), rec)
			}(record)
		}

		results = append(results, TrackResult{AWB: awb, Success: true, Record: record})
	}

	// Return single object if only 1 AWB was submitted for backward compatibility
	if len(uniqueAWBs) == 1 {
		if !results[0].Success {
			return c.JSON(http.StatusBadGateway, map[string]string{"message": results[0].Error})
		}
		return c.JSON(http.StatusCreated, results[0].Record)
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"total":   len(uniqueAWBs),
		"results": results,
	})
}

// RefreshShipment fetches live status for a saved shipment and updates database
func (h *DHLHandler) RefreshShipment(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "ID required"})
	}

	existing, _ := h.repo.GetByID(c.Request().Context(), id)

	dhlData, err := fetchDHLTracking(id)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"message": err.Error()})
	}

	var pic, notes string
	if existing != nil {
		pic = existing.PIC
		notes = existing.Notes
	}

	record, err := extractShipmentRecord(id, pic, notes, dhlData)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"message": err.Error()})
	}

	if err := h.repo.Upsert(c.Request().Context(), record); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	// Trigger email automatically if state transitioned to delivered and not yet notified
	if strings.EqualFold(record.StatusCode, "delivered") && (existing == nil || existing.DeliveredNotifiedAt == nil) {
		go func(rec *repository.DHLShipmentRecord) {
			_, err := h.sendDeliveredEmailNotification(context.Background(), rec)
			if err != nil {
				log.Printf("[DHL Auto-Email] Failed to send delivered email for %s: %v", rec.ID, err)
			}
		}(record)
	}

	return c.JSON(http.StatusOK, record)
}

// SendDeliveredEmail manually triggers the delivered notification email
func (h *DHLHandler) SendDeliveredEmail(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "ID required"})
	}

	record, err := h.repo.GetByID(c.Request().Context(), id)
	if err != nil || record == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "Data pengiriman tidak ditemukan"})
	}

	recipients, err := h.sendDeliveredEmailNotification(c.Request().Context(), record)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Gagal mengirim email: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"message":    fmt.Sprintf("Email notifikasi delivered berhasil dikirim ke %d penerima (%s)", len(recipients), recipients[0]),
		"recipients": recipients,
	})
}

// UpdateShipment updates PIC, is_collected status, and notes
func (h *DHLHandler) UpdateShipment(c echo.Context) error {
	id := c.Param("id")
	var payload struct {
		PIC         string `json:"pic"`
		IsCollected bool   `json:"is_collected"`
		Notes       string `json:"notes"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
	}

	if err := h.repo.UpdateDetails(c.Request().Context(), id, payload.PIC, payload.IsCollected, payload.Notes); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteShipment deletes a tracked shipment
func (h *DHLHandler) DeleteShipment(c echo.Context) error {
	id := c.Param("id")
	if err := h.repo.Delete(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

