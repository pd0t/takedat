package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port           string
	Host           string
	SessionTTL     time.Duration
	ChunkSize      int
	MaxFileSize    int64
	AllowedOrigins []string
	StaticDir      string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8080"),
		Host:           getEnv("HOST", "0.0.0.0"),
		SessionTTL:     getDuration("SESSION_TTL", 10*time.Minute),
		ChunkSize:      getInt("CHUNK_SIZE", 64*1024),
		MaxFileSize:    getInt64("MAX_FILE_SIZE", 5*1024*1024*1024), // 5GB
		AllowedOrigins: []string{"http://localhost:5173", "http://localhost:3000", "*"},
		StaticDir:      getEnv("STATIC_DIR", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}

func getInt64(key string, fallback int64) int64 {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.ParseInt(value, 10, 64); err == nil {
			return i
		}
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return fallback
}
