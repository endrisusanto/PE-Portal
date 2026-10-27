-- Migration 024: Normalize MCP server default URLs to 127.0.0.1 for seamless Baremetal & Docker interoperability
UPDATE mcp_servers
SET url = 'http://127.0.0.1:3800/mcp'
WHERE url LIKE '%172.17.0.1:3800%' OR url LIKE '%localhost:3800%';
