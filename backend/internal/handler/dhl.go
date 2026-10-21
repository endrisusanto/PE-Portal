package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/repository"
)

const (
	DHLAPIKey = "mLG4tKn8BRN9NAdRHtFOCqgIqEzUsaOb"
	DHLAPIURL = "https://api-eu.dhl.com/track/shipments"
)

type DHLHandler struct {
	repo *repository.DHLRepository
}

func NewDHLHandler(repo *repository.DHLRepository) *DHLHandler {
	return &DHLHandler{repo: repo}
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

// CreateShipment tracks a new shipment from DHL API and persists it to the database
func (h *DHLHandler) CreateShipment(c echo.Context) error {
	var payload struct {
		TrackingNumber string `json:"tracking_number"`
		PIC            string `json:"pic"`
		Notes          string `json:"notes"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid request payload"})
	}

	payload.TrackingNumber = strings.TrimSpace(payload.TrackingNumber)
	if payload.TrackingNumber == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Tracking number / AWB is required"})
	}

	// Fetch from DHL API
	dhlData, err := fetchDHLTracking(payload.TrackingNumber)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"message": fmt.Sprintf("Failed to fetch DHL shipment: %v", err),
		})
	}

	shipmentsArr, ok := dhlData["shipments"].([]interface{})
	if !ok || len(shipmentsArr) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "No shipment data found in DHL response"})
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

	record := &repository.DHLShipmentRecord{
		ID:                payload.TrackingNumber,
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
		PIC:               payload.PIC,
		Notes:             payload.Notes,
		ShipmentData:      rawJSON,
	}

	if err := h.repo.Upsert(c.Request().Context(), record); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": fmt.Sprintf("Failed to save shipment to database: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, record)
}

// RefreshShipment fetches live status for a saved shipment and updates database
func (h *DHLHandler) RefreshShipment(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "ID required"})
	}

	dhlData, err := fetchDHLTracking(id)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"message": err.Error()})
	}

	shipmentsArr, ok := dhlData["shipments"].([]interface{})
	if !ok || len(shipmentsArr) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "No shipment data found"})
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

	record := &repository.DHLShipmentRecord{
		ID:                id,
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
		ShipmentData:      rawJSON,
	}

	if err := h.repo.Upsert(c.Request().Context(), record); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}

	return c.JSON(http.StatusOK, record)
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
