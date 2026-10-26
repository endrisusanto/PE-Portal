package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DHLShipmentRecord struct {
	ID                string          `json:"id"`
	ServiceName       string          `json:"service_name"`
	OriginCountry     string          `json:"origin_country"`
	OriginCity        string          `json:"origin_city"`
	DestCountry       string          `json:"dest_country"`
	DestCity          string          `json:"dest_city"`
	StatusCode        string          `json:"status_code"`
	StatusLabel       string          `json:"status_label"`
	StatusDescription string          `json:"status_description"`
	LastEventTime     *time.Time      `json:"last_event_time"`
	LastLocation      string          `json:"last_location"`
	PIC               string          `json:"pic"`
	IsCollected       bool            `json:"is_collected"`
	CollectedAt       *time.Time      `json:"collected_at"`
	Notes             string          `json:"notes"`
	ShipmentData      json.RawMessage `json:"shipment_data"`
	DeliveredNotifiedAt *time.Time      `json:"delivered_notified_at"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

type DHLRepository struct {
	pool *pgxpool.Pool
}

func NewDHLRepository(pool *pgxpool.Pool) *DHLRepository {
	return &DHLRepository{pool: pool}
}

// List returns tracked shipments matching optional filters
func (r *DHLRepository) List(ctx context.Context, search string, statusCode string, collectedFilter string) ([]DHLShipmentRecord, error) {
	query := `
		SELECT id, service_name, origin_country, origin_city, dest_country, dest_city,
		       status_code, status_label, status_description, last_event_time, last_location,
		       pic, is_collected, collected_at, notes, shipment_data, delivered_notified_at, created_at, updated_at
		FROM dhl_shipments
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(" AND (id ILIKE $%d OR pic ILIKE $%d OR notes ILIKE $%d OR status_description ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if statusCode != "" && statusCode != "all" {
		if statusCode == "transit" {
			query += fmt.Sprintf(" AND status_code IN ($%d, 'failure')", argIdx)
			args = append(args, "transit")
			argIdx++
		} else {
			query += fmt.Sprintf(" AND status_code = $%d", argIdx)
			args = append(args, statusCode)
			argIdx++
		}
	}

	if collectedFilter == "collected" {
		query += " AND is_collected = true"
	} else if collectedFilter == "uncollected" {
		query += " AND is_collected = false"
	}

	query += " ORDER BY updated_at DESC, created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query dhl shipments: %w", err)
	}
	defer rows.Close()

	var results []DHLShipmentRecord
	for rows.Next() {
		var s DHLShipmentRecord
		var rawData []byte
		err := rows.Scan(
			&s.ID, &s.ServiceName, &s.OriginCountry, &s.OriginCity, &s.DestCountry, &s.DestCity,
			&s.StatusCode, &s.StatusLabel, &s.StatusDescription, &s.LastEventTime, &s.LastLocation,
			&s.PIC, &s.IsCollected, &s.CollectedAt, &s.Notes, &rawData, &s.DeliveredNotifiedAt, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dhl shipment row: %w", err)
		}
		if len(rawData) > 0 {
			s.ShipmentData = json.RawMessage(rawData)
		}
		results = append(results, s)
	}

	return results, nil
}

// GetByID finds a shipment by tracking number
func (r *DHLRepository) GetByID(ctx context.Context, id string) (*DHLShipmentRecord, error) {
	query := `
		SELECT id, service_name, origin_country, origin_city, dest_country, dest_city,
		       status_code, status_label, status_description, last_event_time, last_location,
		       pic, is_collected, collected_at, notes, shipment_data, delivered_notified_at, created_at, updated_at
		FROM dhl_shipments
		WHERE id = $1
	`
	var s DHLShipmentRecord
	var rawData []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.ServiceName, &s.OriginCountry, &s.OriginCity, &s.DestCountry, &s.DestCity,
		&s.StatusCode, &s.StatusLabel, &s.StatusDescription, &s.LastEventTime, &s.LastLocation,
		&s.PIC, &s.IsCollected, &s.CollectedAt, &s.Notes, &rawData, &s.DeliveredNotifiedAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(rawData) > 0 {
		s.ShipmentData = json.RawMessage(rawData)
	}
	return &s, nil
}

// Upsert creates or updates a shipment record
func (r *DHLRepository) Upsert(ctx context.Context, s *DHLShipmentRecord) error {
	query := `
		INSERT INTO dhl_shipments (
			id, service_name, origin_country, origin_city, dest_country, dest_city,
			status_code, status_label, status_description, last_event_time, last_location,
			pic, is_collected, collected_at, notes, shipment_data, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
		)
		ON CONFLICT (id) DO UPDATE SET
			service_name = EXCLUDED.service_name,
			origin_country = EXCLUDED.origin_country,
			origin_city = EXCLUDED.origin_city,
			dest_country = EXCLUDED.dest_country,
			dest_city = EXCLUDED.dest_city,
			status_code = EXCLUDED.status_code,
			status_label = EXCLUDED.status_label,
			status_description = EXCLUDED.status_description,
			last_event_time = EXCLUDED.last_event_time,
			last_location = EXCLUDED.last_location,
			pic = CASE WHEN EXCLUDED.pic != '' THEN EXCLUDED.pic ELSE dhl_shipments.pic END,
			notes = CASE WHEN EXCLUDED.notes != '' THEN EXCLUDED.notes ELSE dhl_shipments.notes END,
			shipment_data = EXCLUDED.shipment_data,
			updated_at = NOW()
	`
	_, err := r.pool.Exec(ctx, query,
		s.ID, s.ServiceName, s.OriginCountry, s.OriginCity, s.DestCountry, s.DestCity,
		s.StatusCode, s.StatusLabel, s.StatusDescription, s.LastEventTime, s.LastLocation,
		s.PIC, s.IsCollected, s.CollectedAt, s.Notes, []byte(s.ShipmentData),
	)
	return err
}

// MarkDeliveredNotified records the timestamp when delivered email was sent
func (r *DHLRepository) MarkDeliveredNotified(ctx context.Context, id string) error {
	query := `
		UPDATE dhl_shipments
		SET delivered_notified_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// UpdateDetails updates user metadata (pic, is_collected, notes)
func (r *DHLRepository) UpdateDetails(ctx context.Context, id string, pic string, isCollected bool, notes string) error {
	query := `
		UPDATE dhl_shipments
		SET pic = $2,
		    is_collected = $3,
		    collected_at = CASE WHEN $3 = true AND is_collected = false THEN NOW() WHEN $3 = false THEN NULL ELSE collected_at END,
		    notes = $4,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id, pic, isCollected, notes)
	return err
}

// Delete removes a shipment by ID
func (r *DHLRepository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM dhl_shipments WHERE id = $1", id)
	return err
}
