import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface AIResponseObjectProps {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onClose: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

export function AIResponseObject({
  id,
  content,
  x,
  y,
  width,
  height,
  onMove,
  onResize,
  onClose,
  isExpanded,
  onToggleExpand
}: AIResponseObjectProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });

  // Convert screen coordinates to canvas coordinates
  const canvasX = x + 12500; // Add center offset
  const canvasY = y + 12500; // Add center offset

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on the header or content area
    const target = e.target as HTMLElement;
    const isHeader = target.closest('.ai-response-header');
    const isContent = target.closest('.ai-response-content');
    const isButton = target.closest('button');
    
    if ((isHeader || isContent) && !isButton) {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // Store the initial mouse position and offset
        dragInfo.current = {
          startX: e.clientX,
          startY: e.clientY,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top
        };
        setIsDragging(true);
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: 0,
      offsetY: 0
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      const canvasContainer = document.querySelector('.infinite-canvas-container');
      const canvasRect = canvasContainer?.getBoundingClientRect();
      
      if (canvasRect) {
        // Calculate new position keeping the cursor at the same relative position
        const newX = e.clientX - dragInfo.current.offsetX - canvasRect.left + (width / 2);
        const newY = e.clientY - dragInfo.current.offsetY - canvasRect.top + (height / 2);
        
        // Update position immediately
        containerRef.current.style.left = `${newX + 12500 - (width / 2)}px`;
        containerRef.current.style.top = `${newY + 12500 - (height / 2)}px`;
      }
    } else if (isResizing) {
      const deltaX = e.clientX - dragInfo.current.startX;
      const deltaY = e.clientY - dragInfo.current.startY;
      const newWidth = Math.max(300, width + deltaX);
      const newHeight = Math.max(200, height + deltaY);
      onResize(id, newWidth, newHeight);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && containerRef.current) {
      const canvasContainer = document.querySelector('.infinite-canvas-container');
      const canvasRect = canvasContainer?.getBoundingClientRect();
      
      if (canvasRect) {
        // Calculate final position
        const rect = containerRef.current.getBoundingClientRect();
        const finalX = rect.left - canvasRect.left - (width / 2);
        const finalY = rect.top - canvasRect.top - (height / 2);
        onMove(id, finalX, finalY);
      }
    }
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing]);

  return (
    <div
      ref={containerRef}
      className="absolute bg-white rounded-lg shadow-2xl border-2 border-blue-200 overflow-hidden"
      style={{
        left: canvasX - (width / 2),
        top: canvasY - (height / 2),
        width: isExpanded ? '80vw' : width,
        height: isExpanded ? '80vh' : height,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 1000,
        background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(59, 130, 246, 0.1)',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Now with a gradient background */}
      <div 
        className="ai-response-header flex items-center justify-between p-3 border-b border-blue-100 cursor-grab active:cursor-grabbing"
        style={{
          background: 'linear-gradient(to right, #f0f9ff, #e0f2fe)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-blue-700">AI Response</span>
          <span className="text-xs text-blue-500">(Drag to move)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleExpand(id)}
            className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onClose(id)}
            className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content - With a subtle background */}
      <div 
        className="ai-response-content p-4 overflow-auto cursor-grab active:cursor-grabbing" 
        style={{ 
          height: 'calc(100% - 40px)',
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)'
        }}
      >
        <div className="prose prose-sm max-w-none prose-blue">
          {content}
        </div>
      </div>

      {/* Resize Handle - More visible */}
      {!isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <div className="w-4 h-4 border-b-2 border-r-2 border-blue-300" />
        </div>
      )}

      {/* Movement Hint - Shows briefly on hover */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-200"
        style={{
          background: 'linear-gradient(45deg, rgba(59, 130, 246, 0.05) 25%, transparent 25%, transparent 50%, rgba(59, 130, 246, 0.05) 50%, rgba(59, 130, 246, 0.05) 75%, transparent 75%, transparent)',
          backgroundSize: '20px 20px'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
            Drag to move • Resize from corner
          </div>
        </div>
      </div>
    </div>
  );
} 