package database

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps go-redis Client
type RedisClient struct {
	Client *redis.Client
}

// ConnectRedis connects to Redis cache server
// ponytail: non-blocking connection check; logs warning if Redis isn't up yet
func ConnectRedis(redisURL string) *RedisClient {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[Redis] Warning: Failed to parse redis URL %s: %v", redisURL, err)
		return &RedisClient{Client: nil}
	}

	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[Redis] Warning: Cannot connect to Redis at %s (%v). Running without cache.", redisURL, err)
		return &RedisClient{Client: client}
	}

	log.Println("[Redis] Connected to Redis successfully")
	return &RedisClient{Client: client}
}

// Close closes the Redis connection
func (r *RedisClient) Close() {
	if r.Client != nil {
		_ = r.Client.Close()
	}
}
