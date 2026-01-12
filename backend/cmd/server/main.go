package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"takedat/internal/api"
	"takedat/internal/config"
	"takedat/internal/session"
	"takedat/internal/websocket"
)

func main() {
	cfg := config.Load()

	// Initialize session manager
	sessions := session.NewManager(cfg.SessionTTL)

	// Initialize WebSocket hub
	hub := websocket.NewHub(sessions)
	go hub.Run()

	// Start session cleanup
	ctx, cancel := context.WithCancel(context.Background())
	go sessions.StartCleanup(ctx)

	// Create router
	router := api.NewRouter(cfg, sessions, hub)

	// Create server
	addr := cfg.Host + ":" + cfg.Port
	server := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server starting on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	cancel()

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}
