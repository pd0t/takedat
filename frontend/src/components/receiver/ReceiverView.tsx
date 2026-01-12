import { useState, useCallback, useRef } from 'react';
import { Download, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/ProgressBar';
import { api } from '../../services/api';
import { FileAssembler } from '../../services/chunker';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WSMessage, FileMetaPayload, ChunkPayload } from '../../types/messages';
import type { SessionInfo } from '../../types/session';

type ReceiverState = 'idle' | 'validating' | 'ready' | 'waiting' | 'transferring' | 'complete' | 'error';

export function ReceiverView() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<ReceiverState>('idle');
  const [error, setError] = useState('');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [peerConnected, setPeerConnected] = useState(false);

  const assemblerRef = useRef<FileAssembler | null>(null);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'register_ack': {
        const payload = message.payload as { peerConnected: boolean };
        setPeerConnected(payload.peerConnected);
        setState('ready');
        break;
      }

      case 'peer_joined':
        setPeerConnected(true);
        break;

      case 'peer_left':
        setPeerConnected(false);
        if (state === 'transferring' || state === 'waiting') {
          setError('Sender disconnected');
          setState('error');
        }
        break;

      case 'file_meta': {
        const meta = message.payload as FileMetaPayload;
        assemblerRef.current = new FileAssembler(meta);
        setState('transferring');
        break;
      }

      case 'chunk': {
        const chunk = message.payload as ChunkPayload;
        if (assemblerRef.current) {
          assemblerRef.current.addChunk(chunk.index, chunk.data);
          setProgress(assemblerRef.current.getProgress());
          send('chunk_ack', { index: chunk.index, success: true });
        }
        break;
      }

      case 'transfer_complete': {
        if (assemblerRef.current) {
          assemblerRef.current.download();
          setState('complete');
        }
        break;
      }

      case 'error': {
        const err = message.payload as { message: string };
        setError(err.message);
        setState('error');
        break;
      }
    }
  }, [state]);

  const { connect, disconnect, send } = useWebSocket({
    onMessage: handleMessage,
    onClose: () => {
      if (state === 'transferring' || state === 'waiting') {
        setError('Connection lost');
        setState('error');
      }
    },
  });

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 3 && !value.includes('-')) {
      value = value.slice(0, 3) + '-' + value.slice(3);
    }
    if (value.length > 7) {
      value = value.slice(0, 7);
    }
    setCode(value);
    setError('');
  };

  const handleValidate = async () => {
    if (code.length !== 7) {
      setError('Please enter a complete code');
      return;
    }

    try {
      setState('validating');
      setError('');

      const info = await api.getSession(code);
      setSessionInfo(info);

      // Connect WebSocket
      connect(code, 'receiver');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code');
      setState('error');
    }
  };

  const handleReceive = () => {
    setState('waiting');
    send('transfer_request', {});
  };

  const handleCancel = () => {
    disconnect();
    setCode('');
    setState('idle');
    setProgress(0);
    setSessionInfo(null);
    setPeerConnected(false);
    assemblerRef.current = null;
    setError('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Receive a File</h2>

      {state === 'idle' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter the share code:
            </label>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="ABC-DEF"
              className="w-full text-center text-3xl font-mono tracking-widest p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none uppercase"
              maxLength={7}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <Button
            onClick={handleValidate}
            disabled={code.length !== 7}
            className="w-full"
            size="lg"
          >
            <span className="flex items-center justify-center gap-2">
              Continue
              <ArrowRight className="w-5 h-5" />
            </span>
          </Button>
        </div>
      )}

      {state === 'validating' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-gray-600">Validating code...</p>
        </div>
      )}

      {state === 'ready' && sessionInfo && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <Download className="w-12 h-12 mx-auto mb-4 text-blue-500" />
            <p className="font-medium text-gray-800 text-lg truncate">{sessionInfo.fileName}</p>
            <p className="text-gray-500">{formatFileSize(sessionInfo.fileSize)}</p>
          </div>

          {!peerConnected && (
            <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Waiting for sender to connect...</span>
            </div>
          )}

          {peerConnected && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
              <Check className="w-4 h-4" />
              <span>Sender is ready</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleCancel} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={!peerConnected}
              className="flex-1"
            >
              Receive File
            </Button>
          </div>
        </div>
      )}

      {(state === 'waiting' || state === 'transferring') && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 truncate">{sessionInfo?.fileName}</p>
            <p className="text-sm text-gray-500">{formatFileSize(sessionInfo?.fileSize || 0)}</p>
          </div>

          {state === 'waiting' && (
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
              <p className="text-gray-600">Waiting for sender to start transfer...</p>
            </div>
          )}

          {state === 'transferring' && (
            <div className="space-y-2">
              <ProgressBar progress={progress} label="Receiving..." />
              <p className="text-sm text-gray-500 text-center">
                {Math.round(progress * 100)}% complete
              </p>
            </div>
          )}

          <Button onClick={handleCancel} variant="secondary" className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {state === 'complete' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Download Complete!</h3>
          <p className="text-gray-500 mb-6">Your file has been downloaded.</p>
          <Button onClick={handleCancel} className="w-full">
            Receive Another File
          </Button>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error</h3>
          <p className="text-red-500 mb-6">{error}</p>
          <Button onClick={handleCancel} className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
