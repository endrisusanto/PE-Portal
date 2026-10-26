package middleware

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"pe-portal/internal/auth"
)

const (
	ContextKeyUserClaims = "user_claims"
	ContextKeyUserID     = "user_id"
	ContextKeyUserRole   = "user_role"
)

// AuthMiddleware creates an Echo middleware to validate JWT Bearer tokens or allow guest view-only access
func AuthMiddleware(jwtService *auth.JWTService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			var tokenStr string
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
					tokenStr = parts[1]
				}
			}

			// Also allow token via query parameter for iframe previews and direct download links
			if tokenStr == "" {
				tokenStr = c.QueryParam("token")
			}

			method := c.Request().Method
			isReadMethod := method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions

			if tokenStr == "" {
				if isReadMethod {
					c.Set(ContextKeyUserID, uuid.Nil)
					c.Set(ContextKeyUserRole, "guest")
					return next(c)
				}
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"message": "Wajib login dengan ADCorp untuk melakukan aksi write atau update",
					"code":    "GUEST_WRITE_BLOCKED",
				})
			}

			claims, err := jwtService.ValidateToken(tokenStr)
			if err != nil {
				if isReadMethod {
					c.Set(ContextKeyUserID, uuid.Nil)
					c.Set(ContextKeyUserRole, "guest")
					return next(c)
				}
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			if claims.Role == "guest" && !isReadMethod {
				return c.JSON(http.StatusForbidden, map[string]interface{}{
					"message": "Wajib login dengan ADCorp untuk melakukan aksi write atau update",
					"code":    "GUEST_WRITE_BLOCKED",
				})
			}

			c.Set(ContextKeyUserClaims, claims)
			c.Set(ContextKeyUserID, claims.UserID)
			c.Set(ContextKeyUserRole, claims.Role)

			return next(c)
		}
	}
}
