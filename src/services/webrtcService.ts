const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface WebRTCSession {
  id: string;
  roomId: string;
  sessionType: 'screen_share' | 'voice' | 'recording';
  hostUserId: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
  metadata: any;
}



export interface RecordingSession {
  id: string;
  roomId: string;
  startedBy: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  fileUrl?: string;
  fileSize?: number;
  status: 'recording' | 'processing' | 'completed' | 'failed' | 'pending_permission' | 'cancelled';
  twitterOptimized: boolean;
  downloadCount: number;
  metadata: any;
}

export interface SignalData {
  roomId: string;
  fromUserId: string;
  toUserId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  signalData: any;
}

export class WebRTCService {
  // Screen Sharing with Permission System
  static async requestScreenSharePermission(roomId: string, userId: string): Promise<{ sessionId: string; participants: any[] }> {
    const response = await fetch(`${API_BASE}/request-screen-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ roomId, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request screen share permission');
    }

    return response.json();
  }

  static async grantScreenSharePermission(sessionId: string, userId: string, granted: boolean): Promise<any> {
    const response = await fetch(`${API_BASE}/screen-share-permission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ sessionId, userId, granted }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to grant screen share permission');
    }

    return response.json();
  }

  static async startScreenShare(roomId: string, userId: string, metadata?: any): Promise<{ sessionId: string; message: string }> {
    const response = await fetch(`${API_BASE}/start-screen-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ roomId, userId, metadata }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start screen share');
    }

    return response.json();
  }

  static async stopScreenShare(roomId: string, userId: string, sessionId?: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/stop-screen-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ roomId, userId, sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop screen share');
    }

    return response.json();
  }

  // WebRTC Signaling
  static async sendSignal(signalData: SignalData): Promise<void> {
    const response = await fetch(`${API_BASE}/webrtc-signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(signalData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send signal');
    }
  }

  static async getSignals(roomId: string, userId: string): Promise<any[]> {
    const response = await fetch(`${API_BASE}/webrtc-signal?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get signals');
    }

    const data = await response.json();
    return data.signals;
  }



  // Recording
  static async requestRecording(roomId: string, userId: string): Promise<{ recordingSessionId: string; participants: any[] }> {
    const response = await fetch(`${API_BASE}/request-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ roomId, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request recording');
    }

    return response.json();
  }

  static async grantRecordingPermission(recordingSessionId: string, userId: string, granted: boolean): Promise<any> {
    const response = await fetch(`${API_BASE}/recording-permission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ recordingSessionId, userId, granted }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to grant recording permission');
    }

    return response.json();
  }

  static async stopRecording(
    recordingSessionId: string, 
    userId: string, 
    fileUrl?: string, 
    fileSize?: number, 
    durationSeconds?: number
  ): Promise<any> {
    const response = await fetch(`${API_BASE}/stop-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ recordingSessionId, userId, fileUrl, fileSize, durationSeconds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop recording');
    }

    return response.json();
  }

  // Utility methods
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}