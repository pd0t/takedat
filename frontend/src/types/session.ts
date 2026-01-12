export interface CreateSessionRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface CreateSessionResponse {
  code: string;
  sessionId: string;
  expiresAt: number;
}

export interface SessionInfo {
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
}

export interface ApiError {
  code: string;
  message: string;
}
