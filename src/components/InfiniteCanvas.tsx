import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CursorPosition } from '../services/cursorService';

// CursorTracker interface for TypeScript
interface CursorTracker {
  updatePosition: (position: { x: number; y: number }) => void;
  // Add other methods as needed
}

interface InfiniteCanvasProps {
  roomId: string;
  userId: string;
  children?: React.ReactNode;
  onMouseMove?: (screenCoords: { x: number; y: number }, canvasCoords: { x: number; y: number }) => void;
  cursorTracker?: CursorTracker | null;
  otherCursors?: CursorPosition[];
  onCursorUpdate?: (cursors: CursorPosition[]) => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function InfiniteCanvas({ roomId, userId, children, onMouseMove, cursorTracker }: InfiniteCanvasProps) {
  console.log('🚀 InfiniteCanvas rendering');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
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
    if (cursorTracker) {
      const canvasX = (e.clientX - transform.x) / transform.scale;
      const canvasY = (e.clientY - transform.y) / transform.scale;
      cursorTracker.updatePosition({ x: canvasX, y: canvasY });
    }
  };
  
  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-100 overflow-hidden"
      style={{ 
        cursor: isPanning ? 'grabbing' : 'default',
        touchAction: 'none'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* DEBUG INFO */}
      <div className="absolute top-4 left-4 bg-black text-white p-2 rounded text-sm font-mono z-50">
        <div>🔍 Zoom: {(transform.scale * 100).toFixed(1)}%</div>
        <div>📍 Pan: ({Math.round(transform.x)}, {Math.round(transform.y)})</div>
        <div>🖱️ Panning: {isPanning ? 'YES' : 'NO'}</div>
        <div className="mt-2 text-yellow-300">
          <div>🔍 Scroll: Zoom</div>
          <div>📍 Shift+Drag: Pan</div>
        </div>
      </div>
      
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
        
        {children}
      </div>
    </div>
  );
} 