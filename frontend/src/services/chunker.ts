const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB

export class FileChunker {
  private file: File;
  private chunkSize: number;
  readonly totalChunks: number;

  constructor(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE) {
    this.file = file;
    this.chunkSize = chunkSize;
    this.totalChunks = Math.ceil(file.size / chunkSize);
  }

  async getChunk(index: number): Promise<{ data: string; size: number }> {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.file.size);
    const blob = this.file.slice(start, end);
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    return { data: base64, size: end - start };
  }

  getFileMeta() {
    return {
      fileName: this.file.name,
      fileSize: this.file.size,
      mimeType: this.file.type || 'application/octet-stream',
      totalChunks: this.totalChunks,
      chunkSize: this.chunkSize,
    };
  }
}

export class FileAssembler {
  private chunks: Map<number, ArrayBuffer> = new Map();
  private totalChunks: number;
  private fileName: string;
  private mimeType: string;

  constructor(meta: { fileName: string; fileSize: number; mimeType: string; totalChunks: number }) {
    this.fileName = meta.fileName;
    this.mimeType = meta.mimeType;
    this.totalChunks = meta.totalChunks;
  }

  addChunk(index: number, base64Data: string): boolean {
    const buffer = base64ToArrayBuffer(base64Data);
    this.chunks.set(index, buffer);
    return this.isComplete();
  }

  isComplete(): boolean {
    return this.chunks.size === this.totalChunks;
  }

  getProgress(): number {
    return this.chunks.size / this.totalChunks;
  }

  getReceivedBytes(): number {
    let total = 0;
    this.chunks.forEach((chunk) => {
      total += chunk.byteLength;
    });
    return total;
  }

  assemble(): Blob {
    const sortedChunks: ArrayBuffer[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) throw new Error(`Missing chunk ${i}`);
      sortedChunks.push(chunk);
    }
    return new Blob(sortedChunks, { type: this.mimeType });
  }

  download(): void {
    const blob = this.assemble();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
