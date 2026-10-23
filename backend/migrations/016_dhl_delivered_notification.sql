-- Migration 016: Add delivered notification tracking to dhl_shipments
ALTER TABLE dhl_shipments 
ADD COLUMN IF NOT EXISTS delivered_notified_at TIMESTAMPTZ;
