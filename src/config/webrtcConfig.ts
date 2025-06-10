/**
 * WebRTC Configuration
 * 
 * Centralized configuration for WebRTC connections including:
 * - STUN/TURN servers
 * - Connection parameters
 * - Browser compatibility settings
 * - Environment-specific configurations
 */

// Default STUN servers (free, public)
const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302'
];

// Environment-based configuration
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Get ICE servers configuration based on environment
 */
export function getICEServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [];
  
  // Add STUN servers
  const stunServer = import.meta.env.VITE_STUN_SERVER;
  if (stunServer) {
    iceServers.push({ urls: stunServer });
  } else {
    // Use default Google STUN servers
    iceServers.push({ urls: DEFAULT_STUN_SERVERS });
  }
  
  // Add TURN servers if configured
  const turnServer = import.meta.env.VITE_TURN_SERVER;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  
  if (turnServer && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnServer,
      username: turnUsername,
      credential: turnCredential
    });
  }
  
  return iceServers;
}

/**
 * WebRTC Peer Connection Configuration
 */
export const webrtcConfig: RTCConfiguration = {
  iceServers: getICEServers(),
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all' as RTCIceTransportPolicy
};

/**
 * Media constraints for getUserMedia
 */
export const mediaConstraints: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2
  }
};

/**
 * Display media constraints for screen sharing
 */
export const displayMediaConstraints: MediaStreamConstraints = {
  video: {
    width: { ideal: 1920, max: 3840 },
    height: { ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: 60 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

/**
 * Connection timeout settings
 */
export const connectionTimeouts = {
  ice: parseInt(import.meta.env.VITE_ICE_TIMEOUT || '30000'),
  connection: parseInt(import.meta.env.VITE_CONNECTION_TIMEOUT || '30000'),
  gathering: parseInt(import.meta.env.VITE_GATHERING_TIMEOUT || '15000'),
  offer: parseInt(import.meta.env.VITE_OFFER_TIMEOUT || '10000'),
  answer: parseInt(import.meta.env.VITE_ANSWER_TIMEOUT || '10000')
};

/**
 * Retry configuration
 */
export const retryConfig = {
  maxAttempts: parseInt(import.meta.env.VITE_MAX_RETRY_ATTEMPTS || '3'),
  initialDelay: parseInt(import.meta.env.VITE_INITIAL_RETRY_DELAY || '1000'),
  maxDelay: parseInt(import.meta.env.VITE_MAX_RETRY_DELAY || '8000'),
  backoffMultiplier: parseFloat(import.meta.env.VITE_RETRY_BACKOFF_MULTIPLIER || '2')
};

/**
 * Performance settings
 */
export const performanceConfig = {
  maxParticipants: parseInt(import.meta.env.VITE_MAX_PARTICIPANTS || '50'),
  adaptiveBitrate: import.meta.env.VITE_ADAPTIVE_BITRATE !== 'false',
  simulcast: import.meta.env.VITE_SIMULCAST !== 'false',
  degradationPreference: import.meta.env.VITE_DEGRADATION_PREFERENCE || 'maintain-framerate'
};

/**
 * Debug configuration
 */
export const debugConfig = {
  enabled: isDevelopment || import.meta.env.VITE_DEBUG_WEBRTC === 'true',
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  statsInterval: parseInt(import.meta.env.VITE_STATS_INTERVAL || '5000'),
  logSignaling: import.meta.env.VITE_LOG_SIGNALING === 'true'
};

/**
 * Browser compatibility checks
 */
export const browserSupport = {
  hasWebRTC: typeof RTCPeerConnection !== 'undefined',
  hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  hasGetDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
  hasWebSockets: typeof WebSocket !== 'undefined',
  supportsInsertableStreams: typeof RTCRtpSender !== 'undefined' && 'createEncodedStreams' in RTCRtpSender.prototype
};

/**
 * Check if WebRTC is supported in current browser
 */
export function isWebRTCSupported(): boolean {
  return browserSupport.hasWebRTC && 
         browserSupport.hasGetUserMedia && 
         browserSupport.hasWebSockets;
}

/**
 * Check if screen sharing is supported
 */
export function isScreenSharingSupported(): boolean {
  return browserSupport.hasGetDisplayMedia;
}

/**
 * Get recommended configuration based on network conditions
 */
export function getAdaptiveConfig(networkInfo?: {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}): Partial<RTCConfiguration> {
  if (!networkInfo) return webrtcConfig;
  
  const config: Partial<RTCConfiguration> = { ...webrtcConfig };
  
  // Adjust based on network quality
  if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
    config.iceCandidatePoolSize = 5;
  } else if (networkInfo.effectiveType === '3g') {
    config.iceCandidatePoolSize = 8;
  } else if (networkInfo.effectiveType === '4g') {
    config.iceCandidatePoolSize = 15;
  }
  
  return config;
}

/**
 * Validate environment configuration
 */
export function validateWebRTCEnvironment(): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check browser support
  if (!isWebRTCSupported()) {
    issues.push('WebRTC is not supported in this browser');
  }
  
  if (!isScreenSharingSupported()) {
    warnings.push('Screen sharing is not supported in this browser');
  }
  
  // Check STUN/TURN configuration
  const iceServers = getICEServers();
  if (iceServers.length === 0) {
    issues.push('No ICE servers configured');
  }
  
  const hasTurnServer = iceServers.some(server => 
    Array.isArray(server.urls) 
      ? server.urls.some(url => url.startsWith('turn:'))
      : server.urls.startsWith('turn:')
  );
  
  if (!hasTurnServer && isProduction) {
    warnings.push('No TURN servers configured - may cause connection issues behind NAT/firewalls');
  }
  
  // Check environment variables
  if (!import.meta.env.VITE_SUPABASE_URL) {
    issues.push('VITE_SUPABASE_URL environment variable not set');
  }
  
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    issues.push('VITE_SUPABASE_ANON_KEY environment variable not set');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Log WebRTC configuration for debugging
 */
export function logWebRTCConfig(): void {
  if (!debugConfig.enabled) return;
  
  console.group('🔧 WebRTC Configuration');
  console.log('Environment:', isDevelopment ? 'Development' : 'Production');
  console.log('ICE Servers:', getICEServers());
  console.log('Browser Support:', browserSupport);
  console.log('Connection Timeouts:', connectionTimeouts);
  console.log('Performance Config:', performanceConfig);
  console.log('Debug Config:', debugConfig);
  
  const validation = validateWebRTCEnvironment();
  if (validation.issues.length > 0) {
    console.warn('❌ Configuration Issues:', validation.issues);
  }
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Configuration Warnings:', validation.warnings);
  }
  if (validation.valid) {
    console.log('✅ Configuration is valid');
  }
  
  console.groupEnd();
} 