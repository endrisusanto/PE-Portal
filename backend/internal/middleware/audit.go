package middleware

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// CleanIP normalizes IPv4, IPv6, strips ports, brackets, and ::ffff: prefixes
func CleanIP(raw string) string {
	raw = strings.TrimSpace(raw)
	if host, _, err := net.SplitHostPort(raw); err == nil {
		raw = host
	}
	raw = strings.TrimPrefix(raw, "[")
	raw = strings.TrimSuffix(raw, "]")
	raw = strings.TrimPrefix(raw, "::ffff:")
	return raw
}

// ExtractClientIP extracts real client IP inspecting X-Real-IP, X-Forwarded-For, and c.RealIP()
func ExtractClientIP(c echo.Context) string {
	req := c.Request()
	if realIP := req.Header.Get("X-Real-IP"); realIP != "" {
		if cleaned := CleanIP(realIP); cleaned != "" && cleaned != "127.0.0.1" && cleaned != "::1" {
			return cleaned
		}
	}

	if xff := req.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for _, p := range parts {
			if cleaned := CleanIP(p); cleaned != "" && cleaned != "127.0.0.1" && cleaned != "::1" {
				return cleaned
			}
		}
	}

	return CleanIP(c.RealIP())
}

// AuditMiddleware records modifying HTTP requests (POST, PUT, PATCH, DELETE) to audit_logs
// ponytail: records asynchronously without adding latency to requests
func AuditMiddleware(pool *pgxpool.Pool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)

			method := c.Request().Method
			if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete {
				status := c.Response().Status
				if status >= 200 && status < 300 {
					var userID *uuid.UUID
					if uidVal := c.Get(ContextKeyUserID); uidVal != nil {
						if uid, ok := uidVal.(uuid.UUID); ok {
							userID = &uid
						}
					}

					path := c.Request().URL.Path
					ip := ExtractClientIP(c)
					action := strings.ToLower(method) + ":" + path

					go func() {
						detailsMap := map[string]interface{}{
							"path":   path,
							"method": method,
							"status": status,
						}
						detailsBytes, _ := json.Marshal(detailsMap)

						query := `
							INSERT INTO audit_logs (id, user_id, action, details, ip_address, created_at)
							VALUES (gen_random_uuid(), $1, $2, $3, NULLIF($4, '')::inet, $5)
						`
						ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
						defer cancel()
						_, _ = pool.Exec(ctx, query, userID, action, detailsBytes, ip, time.Now())
					}()
				}
			}

			return err
		}
	}
}
