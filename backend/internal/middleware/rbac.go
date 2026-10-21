package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// RequireRole ensures the authenticated user has one of the required roles
func RequireRole(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			roleVal := c.Get(ContextKeyUserRole)
			if roleVal == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "unauthenticated user")
			}

			userRole, ok := roleVal.(string)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid role claims")
			}

			// Admin has full access to all endpoints
			if userRole == "admin" {
				return next(c)
			}

			for _, allowed := range allowedRoles {
				if userRole == allowed {
					return next(c)
				}
			}

			return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions for this action")
		}
	}
}
