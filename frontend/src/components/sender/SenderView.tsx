import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Copy, Check, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/ProgressBar';
import { api } from '../../services/api';
import { FileChunker } from '../../services/chunker';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WSMessage, ChunkAckPayload } from '../../types/messages';

type SenderState = 'idle' | 'creating' | 'waiting' | 'transferring' | 'complete' | 'error';

export function SenderView() {
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState<string>('');
  const [state, setState] = useState<SenderState>('idle');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [peerConnected, setPeerConnected] = useState(false);

  const chunkerRef = useRef<FileChunker | null>(null);
  const currentChunkRef = useRef(0);
  const startTimeRef = useRef(0);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'register_ack':
        setState('waiting');
        break;

      case 'peer_joined':
        setPeerConnected(true);
        break;

      case 'peer_left':
        setPeerConnected(false);
        if (state === 'transferring') {
          setError('Receiver disconnected');
          setState('error');
        }
        break;

      case 'transfer_request':
        startTransfer();
        break;

      case 'chunk_ack': {
        const ack = message.payload as ChunkAckPayload;
        if (ack.success) {
          sendNextChunk();
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
      if (state === 'transferring') {
        setError('Connection lost');
        setState('error');
      }
    },
  });

  const startTransfer = useCallback(() => {
    if (!chunkerRef.current) return;

    setState('transferring');
    startTimeRef.current = Date.now();
    currentChunkRef.current = 0;

    // Send file metadata
    send('file_meta', chunkerRef.current.getFileMeta());

    // Send first chunk
    sendNextChunk();
  }, [send]);

  const sendNextChunk = useCallback(async () => {
    if (!chunkerRef.current) return;

    const index = currentChunkRef.current;
    if (index >= chunkerRef.current.totalChunks) {
      // Transfer complete
      const duration = Date.now() - startTimeRef.current;
      send('transfer_complete', {
        totalBytes: file?.size || 0,
        totalChunks: chunkerRef.current.totalChunks,
        duration,
      });
      setState('complete');
      return;
    }

    const chunk = await chunkerRef.current.getChunk(index);
    send('chunk', { index, data: chunk.data, size: chunk.size });

    currentChunkRef.current = index + 1;
    setProgress(currentChunkRef.current / chunkerRef.current.totalChunks);
  }, [file, send]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const handleShare = async () => {
    if (!file) return;

    try {
      setState('creating');
      setError('');

      // Create session
      const response = await api.createSession({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      setCode(response.code);
      chunkerRef.current = new FileChunker(file);

      // Connect WebSocket
      connect(response.code, 'sender');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
      setState('error');
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    disconnect();
    if (code) {
      api.deleteSession(code).catch(() => {});
    }
    setFile(null);
    setCode('');
    setState('idle');
    setProgress(0);
    setPeerConnected(false);
    chunkerRef.current = null;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Send a File</h2>

      {state === 'idle' && (
        <>
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : file
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600">Drag and drop a file here</p>
                <p className="text-sm text-gray-400 mt-1">or click to select</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleShare}
            disabled={!file}
            className="w-full mt-4"
            size="lg"
          >
            Get Share Code
          </Button>
        </>
      )}

      {state === 'creating' && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-gray-600">Creating session...</p>
        </div>
      )}

      {(state === 'waiting' || state === 'transferring') && (
        <div className="space-y-6">
          {/* File info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 truncate">{file?.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(file?.size || 0)}</p>
          </div>

          {/* Code display */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Share this code with the receiver:</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-mono font-bold tracking-wider text-gray-800">
                {code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-green-500" />
                ) : (
                  <Copy className="w-6 h-6 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            {state === 'waiting' && !peerConnected && (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Waiting for receiver...</span>
              </div>
            )}
            {state === 'waiting' && peerConnected && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span>Receiver connected! Waiting for them to accept...</span>
              </div>
            )}
            {state === 'transferring' && (
              <div className="space-y-2">
                <ProgressBar progress={progress} label="Sending..." />
                <p className="text-sm text-gray-500">
                  {Math.round(progress * 100)}% complete
                </p>
              </div>
            )}
          </div>

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
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Transfer Complete!</h3>
          <p className="text-gray-500 mb-6">Your file has been sent successfully.</p>
          <Button onClick={handleCancel} className="w-full">
            Send Another File
          </Button>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Transfer Failed</h3>
          <p className="text-red-500 mb-6">{error}</p>
          <Button onClick={handleCancel} className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
