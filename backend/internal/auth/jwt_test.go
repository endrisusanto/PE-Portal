package auth_test

import (
	"testing"

	"github.com/google/uuid"

	"pe-portal/internal/auth"
	"pe-portal/internal/model"
)

func TestJWTGenerationAndValidation(t *testing.T) {
	secret := "test_secret_key_12345678901234567890"
	jwtService := auth.NewJWTService(secret)

	userID := uuid.New()
	user := &model.User{
		ID:            userID,
		Username:      "johndoe",
		Role:          "member",
		PreferredLang: "id",
	}

	accessToken, refreshToken, err := jwtService.GenerateTokens(user)
	if err != nil {
		t.Fatalf("Failed to generate tokens: %v", err)
	}

	if accessToken == "" || refreshToken == "" {
		t.Fatalf("Expected non-empty access and refresh tokens")
	}

	claims, err := jwtService.ValidateToken(accessToken)
	if err != nil {
		t.Fatalf("Failed to validate access token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected UserID %v, got %v", userID, claims.UserID)
	}
	if claims.Username != "johndoe" {
		t.Errorf("Expected username johndoe, got %s", claims.Username)
	}
	if claims.Role != "member" {
		t.Errorf("Expected role member, got %s", claims.Role)
	}
	if claims.PreferredLang != "id" {
		t.Errorf("Expected preferred lang id, got %s", claims.PreferredLang)
	}
}
