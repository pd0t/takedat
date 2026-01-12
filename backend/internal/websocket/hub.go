package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"takedat/internal/session"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

type SessionClients struct {
	sender   *Client
	receiver *Client
	mu       sync.RWMutex
}

type Hub struct {
	sessions   *session.Manager
	clients    map[string]*SessionClients // code -> clients
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub(sessions *session.Manager) *Hub {
	return &Hub{
		sessions:   sessions,
		clients:    make(map[string]*SessionClients),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.addClient(client)

		case client := <-h.unregister:
			h.removeClient(client)
		}
	}
}

func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	role := r.URL.Query().Get("role")

	if code == "" {
		http.Error(w, "Missing code", http.StatusBadRequest)
		return
	}

	if role != "sender" && role != "receiver" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	// Validate session exists
	sess, err := h.sessions.GetByCode(code)
	if err != nil {
		if err == session.ErrSessionNotFound {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		if err == session.ErrSessionExpired {
			http.Error(w, "Session expired", http.StatusGone)
			return
		}
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := NewClient(h, conn, code)
	client.role = role
	client.session = sess.ID

	h.register <- client

	go client.WritePump()
	go client.ReadPump()
}

func (h *Hub) addClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	sc, exists := h.clients[client.code]
	if !exists {
		sc = &SessionClients{}
		h.clients[client.code] = sc
	}

	sc.mu.Lock()
	defer sc.mu.Unlock()

	var peerConnected bool

	if client.role == "sender" {
		if sc.sender != nil {
			// Already has a sender, reject
			client.sendError("SESSION_FULL", "Session already has a sender", true)
			client.conn.Close()
			return
		}
		sc.sender = client
		peerConnected = sc.receiver != nil
	} else {
		if sc.receiver != nil {
			// Already has a receiver, reject
			client.sendError("SESSION_FULL", "Session already has a receiver", true)
			client.conn.Close()
			return
		}
		sc.receiver = client
		peerConnected = sc.sender != nil
	}

	// Send registration acknowledgment
	ack, _ := NewMessage(TypeRegisterAck, RegisterAckPayload{
		Success:       true,
		PeerConnected: peerConnected,
	})
	client.Send(ack)

	// Notify peer if connected
	if peerConnected {
		peerMsg, _ := NewMessage(TypePeerJoined, PeerJoinedPayload{Role: client.role})
		if client.role == "sender" && sc.receiver != nil {
			sc.receiver.Send(peerMsg)
		} else if client.role == "receiver" && sc.sender != nil {
			sc.sender.Send(peerMsg)
		}

		// Update session status
		if sess, err := h.sessions.GetByCode(client.code); err == nil {
			sess.SetStatus(session.StatusPaired)
		}
	} else {
		// Update session status to waiting
		if sess, err := h.sessions.GetByCode(client.code); err == nil {
			sess.SetStatus(session.StatusWaiting)
		}
	}

	log.Printf("Client connected: code=%s role=%s peerConnected=%v", client.code, client.role, peerConnected)
}

func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	sc, exists := h.clients[client.code]
	if !exists {
		return
	}

	sc.mu.Lock()
	defer sc.mu.Unlock()

	var peer *Client

	if client.role == "sender" && sc.sender == client {
		sc.sender = nil
		peer = sc.receiver
	} else if client.role == "receiver" && sc.receiver == client {
		sc.receiver = nil
		peer = sc.sender
	}

	// Notify peer
	if peer != nil {
		leftMsg, _ := NewMessage(TypePeerLeft, PeerLeftPayload{Role: client.role})
		peer.Send(leftMsg)
	}

	// Cleanup if both disconnected
	if sc.sender == nil && sc.receiver == nil {
		delete(h.clients, client.code)
	}

	close(client.send)
	log.Printf("Client disconnected: code=%s role=%s", client.code, client.role)
}

func (h *Hub) handleMessage(client *Client, msg *Message) {
	h.mu.RLock()
	sc, exists := h.clients[client.code]
	h.mu.RUnlock()

	if !exists {
		return
	}

	sc.mu.RLock()
	defer sc.mu.RUnlock()

	switch msg.Type {
	case TypePing:
		pong, _ := NewMessage(TypePong, nil)
		client.Send(pong)

	case TypeTransferRequest, TypeTransferAccept, TypeFileMeta, TypeChunk, TypeChunkAck, TypeTransferComplete:
		// Relay to peer
		h.relayToPeer(client, sc, msg)

	default:
		client.sendError("UNKNOWN_MESSAGE", "Unknown message type", false)
	}
}

func (h *Hub) relayToPeer(client *Client, sc *SessionClients, msg *Message) {
	var peer *Client

	if client.role == "sender" {
		peer = sc.receiver
	} else {
		peer = sc.sender
	}

	if peer == nil {
		client.sendError("PEER_DISCONNECTED", "Peer is not connected", false)
		return
	}

	// Re-encode and forward
	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}

	select {
	case peer.send <- bytes:
	default:
		// Buffer full, drop message
		log.Printf("Dropping message, peer buffer full")
	}
}

func (h *Hub) GetSessionClients(code string) (*SessionClients, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	sc, exists := h.clients[code]
	return sc, exists
}
