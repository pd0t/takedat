import type { CreateSessionRequest, CreateSessionResponse, SessionInfo, ApiError } from '../types/session';

const API_BASE = '/api';

class ApiService {
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  async getSession(code: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/sessions/${code}`);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  async deleteSession(code: string): Promise<void> {
    await fetch(`${API_BASE}/sessions/${code}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
