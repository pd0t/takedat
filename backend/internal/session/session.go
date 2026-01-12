package session

import (
	"crypto/rand"
	"sync"
	"time"
)

type Status string

const (
	StatusCreated      Status = "created"
	StatusWaiting      Status = "waiting"
	StatusPaired       Status = "paired"
	StatusTransferring Status = "transferring"
	StatusCompleted    Status = "completed"
	StatusFailed       Status = "failed"
)

type Session struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	FileName  string    `json:"fileName"`
	FileSize  int64     `json:"fileSize"`
	MimeType  string    `json:"mimeType"`
	Status    Status    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
	mu        sync.RWMutex
}

func (s *Session) SetStatus(status Status) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = status
}

func (s *Session) GetStatus() Status {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status
}

func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// Code generation - excludes confusable characters (0, O, I, L, 1)
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

func GenerateCode() string {
	bytes := make([]byte, 6)
	rand.Read(bytes)

	code := make([]byte, 6)
	for i := 0; i < 6; i++ {
		code[i] = alphabet[int(bytes[i])%len(alphabet)]
	}

	// Format as XXX-XXX
	return string(code[:3]) + "-" + string(code[3:])
}

func GenerateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)

	const hexChars = "0123456789abcdef"
	id := make([]byte, 32)
	for i, b := range bytes {
		id[i*2] = hexChars[b>>4]
		id[i*2+1] = hexChars[b&0x0f]
	}
	return string(id)
}
