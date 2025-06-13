import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CursorPosition } from '../services/cursorService';

// HybridCursorTracker interface for TypeScript
interface HybridCursorTracker {
  updatePosition: (position: { x: number; y: number }) => void;
  isUsingWebRTC: () => boolean;
  getConnectionStatus: () => {
    webrtcConnected: boolean;
    usingFallback: boolean;
    activeChannels: number;
    averageLatency: number;
  };
}

interface CurrentUser {
  userId: string;
  displayName: string;
  userColor: string;
  avatarEmoji?: string;
}

interface InfiniteCanvasProps {
  roomId: string;
  userId: string;
  currentUser?: CurrentUser;
  children?: React.ReactNode;
  onMouseMove?: (screenCoords: { x: number; y: number }, canvasCoords: { x: number; y: number }) => void;
  cursorTracker?: HybridCursorTracker | null;
  otherCursors?: CursorPosition[];
  onCursorUpdate?: (cursors: CursorPosition[]) => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function InfiniteCanvas({ roomId, userId, currentUser, children, onMouseMove, cursorTracker, otherCursors = [] }: InfiniteCanvasProps) {
  console.log('🚀 InfiniteCanvas rendering');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [currentCursorPos, setCurrentCursorPos] = useState<{ x: number; y: number } | null>(null);
  
  // Get connection status for debug display
  const connectionStatus = cursorTracker?.getConnectionStatus() || {
    webrtcConnected: false,
    usingFallback: true,
    activeChannels: 0,
    averageLatency: 0
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1 - e.deltaY * 0.0003; // Much more reduced sensitivity
    setTransform(prev => {
      const newScale = Math.max(0.8, Math.min(5, prev.scale * zoomFactor)); // Min zoom 0.8 - no grey area
      const scaleChange = newScale / prev.scale;
      const newX = e.clientX - (e.clientX - prev.x) * scaleChange;
      const newY = e.clientY - (e.clientY - prev.y) * scaleChange;
      return { x: newX, y: newY, scale: newScale };
    });
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey && e.button === 0) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setTransform(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
    
    // Calculate canvas coordinates for database storage
    const canvasX = (e.clientX - transform.x) / transform.scale + 12500; // Add center offset
    const canvasY = (e.clientY - transform.y) / transform.scale + 12500; // Add center offset
    
    // Use screen coordinates for cursor display (where the mouse actually is)
    const rect = containerRef.current?.getBoundingClientRect();
    const screenX = rect ? e.clientX - rect.left : e.clientX;
    const screenY = rect ? e.clientY - rect.top : e.clientY;
    
    // Update current user's cursor position for display (use screen coordinates)
    setCurrentCursorPos({ x: screenX, y: screenY });
    
    // Send canvas coordinates to hybrid cursor tracker
    if (cursorTracker) {
      cursorTracker.updatePosition({ x: canvasX, y: canvasY });
    }
  };
  
  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
  };

  const handleMouseLeave = () => {
    if (isPanning) setIsPanning(false);
    // Hide current user's cursor when mouse leaves canvas
    setCurrentCursorPos(null);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-100 overflow-hidden infinite-canvas-container"
      style={{ 
        cursor: isPanning ? 'grabbing' : 'none', // Hide system cursor
        touchAction: 'none'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* DEBUG INFO */}
      <div className="absolute top-4 left-4 bg-black text-white p-2 rounded text-sm font-mono z-50">
        <div>🔍 Zoom: {(transform.scale * 100).toFixed(1)}%</div>
        <div>📍 Pan: ({Math.round(transform.x)}, {Math.round(transform.y)})</div>
        <div>🖱️ Panning: {isPanning ? 'YES' : 'NO'}</div>
        <div>👥 Other Cursors: {otherCursors.length}</div>
        <div>📍 Your Cursor: {currentCursorPos ? `(${Math.round(currentCursorPos.x)}, ${Math.round(currentCursorPos.y)})` : 'None'}</div>
        <div className="mt-2 text-yellow-300">
          <div>🔍 Scroll: Zoom</div>
          <div>📍 Shift+Drag: Pan</div>
        </div>
        <div className="mt-2 text-green-300">
          <div>🔗 Connection: {connectionStatus.webrtcConnected ? 'WebRTC' : 'Supabase'}</div>
          <div>📡 Channels: {connectionStatus.activeChannels}</div>
          <div>⚡ Latency: {Math.round(connectionStatus.averageLatency)}ms</div>
        </div>
      </div>
      
      {/* CURRENT USER'S CURSOR - Fixed position relative to viewport */}
      {currentUser && currentCursorPos && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: `${currentCursorPos.x}px`,
            top: `${currentCursorPos.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 2000 // Higher than everything
          }}
        >
          {/* Cursor Circle with pulse animation */}
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse"
            style={{ backgroundColor: currentUser.userColor }}
          />
          
          {/* Cursor Label */}
          <div
            className="absolute top-6 left-2 px-2 py-1 rounded text-xs whitespace-nowrap shadow-lg font-medium"
            style={{ 
              backgroundColor: currentUser.userColor,
              color: 'white'
            }}
          >
            {currentUser.avatarEmoji} {currentUser.displayName} (You)
          </div>
        </div>
      )}
      
      {/* INFINITE CANVAS CONTENT */}
      <div 
        className="absolute bg-white"
        style={{
          width: '25000px',
          height: '25000px',
          left: '50%',
          top: '50%',
          marginLeft: '-12500px',
          marginTop: '-12500px',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* CENTER MARKER */}
        <div 
          className="absolute bg-blue-500 text-white p-4 rounded-lg font-bold"
          style={{
            left: '12500px',
            top: '12500px',
            transform: 'translate(-50%, -50%)'
          }}
        >
          ∞ CANVAS CENTER ∞
        </div>
        
        {/* OTHER USERS' CURSORS - Canvas coordinates */}
        {otherCursors.map((cursor) => (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none"
            style={{
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 1000
            }}
          >
            {/* Cursor Circle */}
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: cursor.userColor }}
            />
            
            {/* Cursor Label */}
            <div
              className="absolute top-6 left-2 px-2 py-1 rounded text-xs whitespace-nowrap shadow-lg"
              style={{ 
                backgroundColor: cursor.userColor,
                color: 'white'
              }}
            >
              {cursor.avatarEmoji} {cursor.displayName}
            </div>
          </div>
        ))}
        
        {children}
      </div>
    </div>
  );
} 