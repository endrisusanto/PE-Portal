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
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header format")
			}

			tokenStr := parts[1]
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
