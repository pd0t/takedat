import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSMessage, MessageType } from '../types/messages';

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback((code: string, role: 'sender' | 'receiver') => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/${code}?role=${role}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      optionsRef.current.onOpen?.();
    };

    ws.onclose = () => {
      setStatus('disconnected');
      optionsRef.current.onClose?.();
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      setStatus('error');
      optionsRef.current.onError?.(error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        optionsRef.current.onMessage?.(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((type: MessageType, payload?: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload: payload as WSMessage['payload'],
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { status, connect, disconnect, send };
}
