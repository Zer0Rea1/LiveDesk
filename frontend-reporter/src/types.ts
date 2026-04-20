export interface TokenSettings {
  reporterName: string;
  resolution: string;
  bitrate: number;
  fps: number;
}

export interface StreamStats {
  elapsed: number;
  bytesSent: number;
}

export type StatusType = 'error' | 'success' | 'info';

export interface StatusMessage {
  text: string;
  type: StatusType;
}
