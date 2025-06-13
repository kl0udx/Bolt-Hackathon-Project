import React, { useState, useRef, useEffect } from 'react';
import { Participant } from '../services/participantService';
import { ParticipantService } from '../services/participantService';

interface AIResponseObjectProps {
  id: string;
  content: string;
  position: { x: number; y: number };
  rotation: number;
  zIndex: number;
  fromUserId: string;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onClose: (id: string) => void;
}

const AIResponseObject: React.FC<AIResponseObjectProps> = ({
  id,
  content,
  position,
  rotation,
  zIndex,
  fromUserId,
  onMove,
  onResize,
  onClose
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 300, height: 200 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [participant, setParticipant] = useState<Participant | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchParticipant = async () => {
      const participantData = await ParticipantService.getParticipant(fromUserId);
      if (participantData) {
        setParticipant(participantData);
      }
    };
    fetchParticipant();
  }, [fromUserId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.resize-handle')) {
      handleResizeStart(e);
    } else {
      handleDragStart(e);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left mouse button
    setIsDragging(true);
    const rect = elementRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging || !elementRef.current) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    onMove(id, { x: newX, y: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsResizing(true);
    const rect = elementRef.current?.getBoundingClientRect();
    if (rect) {
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height
      });
    }
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    const newWidth = Math.max(200, resizeStart.width + deltaX);
    const newHeight = Math.max(150, resizeStart.height + deltaY);
    setSize({ width: newWidth, height: newHeight });
    onResize(id, { width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const handleClose = () => {
    onClose(id);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  return (
    <div
      ref={elementRef}
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        transform: `rotate(${isHovered ? 0 : rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: isHovered ? 1000 : zIndex,
        transition: isDragging || isResizing ? 'none' : 'all 0.2s ease-in-out',
        boxShadow: isHovered 
          ? '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)'
          : '0 4px 16px rgba(0, 0, 0, 0.1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: participant?.userColor || '#ffffff'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
    >
      <div 
        className="h-8 flex items-center justify-between px-3 rounded-t-lg"
        style={{
          backgroundColor: participant?.userColor 
            ? `${participant.userColor}dd` // Add transparency
            : 'rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: participant?.userColor || '#000000' }} />
          <span className="text-sm font-medium text-white">
            {participant?.displayName || 'Unknown User'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div 
        className="p-4 overflow-auto"
        style={{ 
          height: `calc(100% - 2rem)`,
          backgroundColor: participant?.userColor 
            ? `${participant.userColor}22` // Very light color
            : '#ffffff'
        }}
      >
        <div className="prose prose-sm max-w-none">
          {content}
        </div>
      </div>
      <div 
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l8-8M8 8h8v8" />
        </svg>
      </div>
    </div>
  );
};

export default AIResponseObject; 