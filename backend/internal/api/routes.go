package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"takedat/internal/config"
	"takedat/internal/session"
	"takedat/internal/websocket"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(cfg *config.Config, sessions *session.Manager, hub *websocket.Hub) *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	handler := NewHandler(sessions)

	// REST API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.Health)
		r.Post("/sessions", handler.CreateSession)
		r.Get("/sessions/{code}", handler.GetSession)
		r.Delete("/sessions/{code}", handler.DeleteSession)
	})

	// WebSocket route
	r.Get("/ws/{code}", hub.HandleWebSocket)

	// Serve static files if STATIC_DIR is set
	if staticDir := cfg.StaticDir; staticDir != "" {
		fileServer(r, staticDir)
	}

	return r
}

// fileServer serves static files and falls back to index.html for SPA routing
func fileServer(r chi.Router, staticDir string) {
	fs := http.Dir(staticDir)

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Try to serve the file directly
		filePath := filepath.Join(staticDir, path)
		if _, err := os.Stat(filePath); err == nil {
			// Check if it's a file (not directory)
			if info, _ := os.Stat(filePath); !info.IsDir() {
				http.FileServer(fs).ServeHTTP(w, r)
				return
			}
		}

		// For paths that look like assets, return 404
		if strings.HasPrefix(path, "/assets/") {
			http.NotFound(w, r)
			return
		}

		// Otherwise serve index.html for SPA routing
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}
