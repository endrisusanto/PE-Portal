-- Migration 009: DHL Express Tracker for PE Samples and Hardware
CREATE TABLE IF NOT EXISTS dhl_shipments (
    id VARCHAR(100) PRIMARY KEY,
    service_name VARCHAR(150) DEFAULT 'DHL Express',
    origin_country VARCHAR(50) DEFAULT '',
    origin_city VARCHAR(100) DEFAULT '',
    dest_country VARCHAR(50) DEFAULT '',
    dest_city VARCHAR(100) DEFAULT '',
    status_code VARCHAR(50) DEFAULT 'transit',
    status_label VARCHAR(100) DEFAULT 'TRANSIT',
    status_description TEXT DEFAULT '',
    last_event_time TIMESTAMPTZ,
    last_location VARCHAR(150) DEFAULT '',
    pic VARCHAR(150) DEFAULT '',
    is_collected BOOLEAN DEFAULT FALSE,
    collected_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    shipment_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dhl_shipments_status ON dhl_shipments(status_code);
CREATE INDEX IF NOT EXISTS idx_dhl_shipments_pic ON dhl_shipments(pic);
CREATE INDEX IF NOT EXISTS idx_dhl_shipments_created ON dhl_shipments(created_at);

-- Sample Initial Seed for Testing
INSERT INTO dhl_shipments (id, service_name, origin_country, origin_city, dest_country, dest_city, status_code, status_label, status_description, last_event_time, last_location, pic, is_collected, notes)
VALUES 
('1234567890', 'DHL Road Freight Standard', 'DE', 'FRICKENHAUSEN', 'DE', 'FRICKENHAUSEN', 'delivered', 'DELIVERED', 'Delivered - Sample Tooling Package Received', NOW() - INTERVAL '1 day', 'FRICKENHAUSEN, Germany', 'Endri Susanto', false, 'JIG Prototype Tooling S26 Paradigm')
ON CONFLICT (id) DO NOTHING;
