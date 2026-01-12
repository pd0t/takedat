export type MessageType =
  | 'register'
  | 'register_ack'
  | 'peer_joined'
  | 'peer_left'
  | 'transfer_request'
  | 'transfer_accept'
  | 'file_meta'
  | 'chunk'
  | 'chunk_ack'
  | 'transfer_complete'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  timestamp: number;
  messageId?: string;
}

export interface RegisterPayload {
  role: 'sender' | 'receiver';
  sessionId: string;
}

export interface RegisterAckPayload {
  success: boolean;
  peerConnected: boolean;
}

export interface PeerJoinedPayload {
  role: string;
}

export interface PeerLeftPayload {
  role: string;
}

export interface FileMetaPayload {
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
}

export interface ChunkPayload {
  index: number;
  data: string; // Base64 encoded
  size: number;
}

export interface ChunkAckPayload {
  index: number;
  success: boolean;
}

export interface TransferCompletePayload {
  totalBytes: number;
  totalChunks: number;
  duration: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  fatal: boolean;
}
