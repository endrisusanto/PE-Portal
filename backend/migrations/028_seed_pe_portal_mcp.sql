-- Migration 028: Register SEIN PE-Portal MCP Server
INSERT INTO mcp_servers (name, url, description, auth_type, is_active, health_status)
SELECT
    'SEIN PE Portal MCP',
    'http://127.0.0.1:8080/api/v1/mcp',
    'Official MCP Server for SEIN PE-Portal. Enables AI Assistant and external agents to access new models, schedules, milestones, projects, tasks, innovations, samples, DHL shipments, and safe database queries.',
    'none',
    true,
    'healthy'
WHERE NOT EXISTS (
    SELECT 1 FROM mcp_servers WHERE name = 'SEIN PE Portal MCP' OR url LIKE '%/api/v1/mcp%'
);
