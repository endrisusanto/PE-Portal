package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds runtime configuration loaded from environment or .env
type Config struct {
	Port            string
	DatabaseURL     string
	RedisURL        string
	JWTSecret       string
	FileStoragePath string
	AuthProvider    string // "local" or "ldap"

	// LDAP (optional)
	LDAPHost         string
	LDAPPort         int
	LDAPBaseDN       string
	LDAPBindDN       string
	LDAPBindPassword string
}

// Load loads configuration from environment variables with sensible defaults
func Load() *Config {
	// Try loading root .env, then backend .env if present
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	// ponytail: support both PORT and BACKEND_PORT with 8085 default for bare-metal
	port := getEnv("PORT", getEnv("BACKEND_PORT", "8085"))
	dbURL := getEnv("DATABASE_URL", "")
	// ponytail: if DATABASE_URL points to docker container 'postgres' on bare metal, auto-fallback to localhost
	if strings.Contains(dbURL, "@postgres:") {
		if _, err := os.Stat("/.dockerenv"); err != nil {
			dbURL = strings.Replace(dbURL, "@postgres:", "@localhost:", 1)
		}
	}
	if dbURL == "" {
		dbURL = getEnv("LOCAL_DATABASE_URL", "postgres://pe_portal:sein_pe_portal_secret_2026@localhost:5432/pe_portal?sslmode=disable")
	}

	redisURL := getEnv("REDIS_URL", "")
	// ponytail: if REDIS_URL points to docker container 'redis' on bare metal, auto-fallback to localhost
	if strings.Contains(redisURL, "redis://redis:") {
		if _, err := os.Stat("/.dockerenv"); err != nil {
			redisURL = strings.Replace(redisURL, "redis://redis:", "redis://localhost:", 1)
		}
	}
	if redisURL == "" {
		redisURL = getEnv("LOCAL_REDIS_URL", "redis://localhost:6379")
	}

	jwtSecret := getEnv("JWT_SECRET", "pe_portal_jwt_secret_super_secure_key_2026_sein_pe_group_random_64")
	storagePath := getEnv("FILE_STORAGE_PATH", "./data/files")
	authProvider := getEnv("AUTH_PROVIDER", "local")

	ldapPort := 389
	if p := getEnv("LDAP_PORT", ""); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			ldapPort = val
		}
	}

	return &Config{
		Port:            port,
		DatabaseURL:     dbURL,
		RedisURL:        redisURL,
		JWTSecret:       jwtSecret,
		FileStoragePath: storagePath,
		AuthProvider:    authProvider,
		LDAPHost:        getEnv("LDAP_HOST", ""),
		LDAPPort:        ldapPort,
		LDAPBaseDN:      getEnv("LDAP_BASE_DN", ""),
		LDAPBindDN:      getEnv("LDAP_BIND_DN", ""),
		LDAPBindPassword: getEnv("LDAP_BIND_PASSWORD", ""),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
