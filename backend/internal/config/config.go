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

	isContainer := false
	if _, err := os.Stat("/.dockerenv"); err == nil {
		isContainer = true
	}

	dbURL := getEnv("DATABASE_URL", "")
	if !isContainer && (strings.Contains(dbURL, "@postgres:") || strings.Contains(dbURL, "@postgres/")) {
		if localDB := getEnv("LOCAL_DATABASE_URL", ""); localDB != "" {
			dbURL = localDB
		} else {
			dbURL = strings.Replace(dbURL, "@postgres:", "@127.0.0.1:", 1)
		}
	} else if dbURL == "" {
		dbURL = getEnv("LOCAL_DATABASE_URL", "postgres://pe_portal:sein_pe_portal_secret_2026@127.0.0.1:5432/pe_portal?sslmode=disable")
	}

	redisURL := getEnv("REDIS_URL", "")
	if !isContainer && strings.Contains(redisURL, "redis://redis:") {
		if localRedis := getEnv("LOCAL_REDIS_URL", ""); localRedis != "" {
			redisURL = localRedis
		} else {
			redisURL = strings.Replace(redisURL, "redis://redis:", "redis://127.0.0.1:", 1)
		}
	} else if redisURL == "" {
		redisURL = getEnv("LOCAL_REDIS_URL", "redis://127.0.0.1:6379")
	}

	jwtSecret := getEnv("JWT_SECRET", "pe_portal_jwt_secret_super_secure_key_2026_sein_pe_group_random_64")
	storagePath := getEnv("FILE_STORAGE_PATH", "./data/files")
	authProvider := getEnv("AUTH_PROVIDER", "local")

	ldapPortStr := getEnv("LDAP_PORT", "389")
	ldapPort, err := strconv.Atoi(ldapPortStr)
	if err != nil || ldapPort <= 0 {
		ldapPort = 389
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
