package websocket

import (
	"encoding/json"
	"time"
)

type MessageType string

const (
	TypeRegister         MessageType = "register"
	TypeRegisterAck      MessageType = "register_ack"
	TypePeerJoined       MessageType = "peer_joined"
	TypePeerLeft         MessageType = "peer_left"
	TypeTransferRequest  MessageType = "transfer_request"
	TypeTransferAccept   MessageType = "transfer_accept"
	TypeFileMeta         MessageType = "file_meta"
	TypeChunk            MessageType = "chunk"
	TypeChunkAck         MessageType = "chunk_ack"
	TypeTransferComplete MessageType = "transfer_complete"
	TypeError            MessageType = "error"
	TypePing             MessageType = "ping"
	TypePong             MessageType = "pong"
)

type Message struct {
	Type      MessageType     `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"timestamp"`
	MessageID string          `json:"messageId,omitempty"`
}

func NewMessage(msgType MessageType, payload interface{}) (*Message, error) {
	var payloadBytes json.RawMessage
	if payload != nil {
		bytes, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		payloadBytes = bytes
	}

	return &Message{
		Type:      msgType,
		Payload:   payloadBytes,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

func (m *Message) Bytes() ([]byte, error) {
	return json.Marshal(m)
}

// Payload types

type RegisterPayload struct {
	Role      string `json:"role"` // "sender" or "receiver"
	SessionID string `json:"sessionId"`
}

type RegisterAckPayload struct {
	Success       bool `json:"success"`
	PeerConnected bool `json:"peerConnected"`
}

type PeerJoinedPayload struct {
	Role string `json:"role"`
}

type PeerLeftPayload struct {
	Role string `json:"role"`
}

type FileMetaPayload struct {
	FileName    string `json:"fileName"`
	FileSize    int64  `json:"fileSize"`
	MimeType    string `json:"mimeType"`
	TotalChunks int    `json:"totalChunks"`
	ChunkSize   int    `json:"chunkSize"`
}

type ChunkPayload struct {
	Index int    `json:"index"`
	Data  string `json:"data"` // Base64 encoded
	Size  int    `json:"size"`
}

type ChunkAckPayload struct {
	Index   int  `json:"index"`
	Success bool `json:"success"`
}

type TransferCompletePayload struct {
	TotalBytes  int64 `json:"totalBytes"`
	TotalChunks int   `json:"totalChunks"`
	Duration    int64 `json:"duration"` // milliseconds
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Fatal   bool   `json:"fatal"`
}
