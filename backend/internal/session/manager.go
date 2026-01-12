package session

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	ErrSessionNotFound = errors.New("session not found")
	ErrSessionExpired  = errors.New("session expired")
	ErrCodeTaken       = errors.New("code already in use")
)

type Manager struct {
	sessions map[string]*Session // code -> session
	byID     map[string]*Session // id -> session
	ttl      time.Duration
	mu       sync.RWMutex
}

func NewManager(ttl time.Duration) *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
		byID:     make(map[string]*Session),
		ttl:      ttl,
	}
}

type CreateParams struct {
	FileName string
	FileSize int64
	MimeType string
}

func (m *Manager) Create(params CreateParams) (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate unique code
	var code string
	for i := 0; i < 10; i++ {
		code = GenerateCode()
		if _, exists := m.sessions[code]; !exists {
			break
		}
		if i == 9 {
			return nil, ErrCodeTaken
		}
	}

	now := time.Now()
	session := &Session{
		ID:        GenerateID(),
		Code:      code,
		FileName:  params.FileName,
		FileSize:  params.FileSize,
		MimeType:  params.MimeType,
		Status:    StatusCreated,
		CreatedAt: now,
		ExpiresAt: now.Add(m.ttl),
	}

	m.sessions[code] = session
	m.byID[session.ID] = session

	return session, nil
}

func (m *Manager) GetByCode(code string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[code]
	if !exists {
		return nil, ErrSessionNotFound
	}

	if session.IsExpired() {
		return nil, ErrSessionExpired
	}

	return session, nil
}

func (m *Manager) GetByID(id string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.byID[id]
	if !exists {
		return nil, ErrSessionNotFound
	}

	if session.IsExpired() {
		return nil, ErrSessionExpired
	}

	return session, nil
}

func (m *Manager) Delete(code string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if session, exists := m.sessions[code]; exists {
		delete(m.byID, session.ID)
		delete(m.sessions, code)
	}
}

func (m *Manager) StartCleanup(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.cleanupExpired()
		}
	}
}

func (m *Manager) cleanupExpired() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for code, session := range m.sessions {
		if session.IsExpired() {
			delete(m.byID, session.ID)
			delete(m.sessions, code)
		}
	}
}
