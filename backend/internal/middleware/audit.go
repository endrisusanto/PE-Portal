package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

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
					ip := c.RealIP()
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
