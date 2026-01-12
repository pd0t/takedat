package api

import (
	"encoding/json"
	"net/http"
	"takedat/internal/session"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	sessions *session.Manager
}

func NewHandler(sessions *session.Manager) *Handler {
	return &Handler{sessions: sessions}
}

type CreateSessionRequest struct {
	FileName string `json:"fileName"`
	FileSize int64  `json:"fileSize"`
	MimeType string `json:"mimeType"`
}

type CreateSessionResponse struct {
	Code      string `json:"code"`
	SessionID string `json:"sessionId"`
	ExpiresAt int64  `json:"expiresAt"`
}

type SessionInfoResponse struct {
	SessionID string `json:"sessionId"`
	FileName  string `json:"fileName"`
	FileSize  int64  `json:"fileSize"`
	MimeType  string `json:"mimeType"`
	Status    string `json:"status"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	if req.FileName == "" {
		writeError(w, http.StatusBadRequest, "MISSING_FIELD", "fileName is required")
		return
	}

	if req.FileSize <= 0 {
		writeError(w, http.StatusBadRequest, "INVALID_FIELD", "fileSize must be positive")
		return
	}

	sess, err := h.sessions.Create(session.CreateParams{
		FileName: req.FileName,
		FileSize: req.FileSize,
		MimeType: req.MimeType,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CREATE_FAILED", "Failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, CreateSessionResponse{
		Code:      sess.Code,
		SessionID: sess.ID,
		ExpiresAt: sess.ExpiresAt.UnixMilli(),
	})
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "MISSING_CODE", "Code is required")
		return
	}

	sess, err := h.sessions.GetByCode(code)
	if err != nil {
		if err == session.ErrSessionNotFound {
			writeError(w, http.StatusNotFound, "SESSION_NOT_FOUND", "Session not found")
			return
		}
		if err == session.ErrSessionExpired {
			writeError(w, http.StatusGone, "SESSION_EXPIRED", "Session has expired")
			return
		}
		writeError(w, http.StatusInternalServerError, "GET_FAILED", "Failed to get session")
		return
	}

	writeJSON(w, http.StatusOK, SessionInfoResponse{
		SessionID: sess.ID,
		FileName:  sess.FileName,
		FileSize:  sess.FileSize,
		MimeType:  sess.MimeType,
		Status:    string(sess.Status),
	})
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "MISSING_CODE", "Code is required")
		return
	}

	h.sessions.Delete(code)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorResponse{Code: code, Message: message})
}
