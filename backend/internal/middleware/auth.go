package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"pe-portal/internal/auth"
)

const (
	ContextKeyUserClaims = "user_claims"
	ContextKeyUserID     = "user_id"
	ContextKeyUserRole   = "user_role"
)

// AuthMiddleware creates an Echo middleware to validate JWT Bearer tokens
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

			if tokenStr == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			claims, err := jwtService.ValidateToken(tokenStr)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			c.Set(ContextKeyUserClaims, claims)
			c.Set(ContextKeyUserID, claims.UserID)
			c.Set(ContextKeyUserRole, claims.Role)

			return next(c)
		}
	}
}
