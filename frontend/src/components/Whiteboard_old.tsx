import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Type, RotateCcw, Trash2, Settings, Move } from 'lucide-react';

interface WhiteboardProps {
  roomId: string;
  userId: string;
  isAdmin: boolean;
  socket: Socket;
  participants: string[];
  isPersonalChat?: boolean;
}

interface DrawObject {
  id: string;
  type: 'stroke' | 'text' | 'shape';
  points?: Array<{ x: number; y: number }>;
  text?: string;
  shape?: 'circle' | 'rectangle' | 'line';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  color: string;
  size: number;
  x: number;
  y: number;
  userId: string;
  timestamp: number;
}

interface DrawEvent {
  type: 'DRAW' | 'TEXT' | 'ERASE' | 'CLEAR' | 'SHAPE' | 'MOVE';
  objectId?: string;
  x?: number;
  y?: number;
  prevX?: number;
  prevY?: number;
  endX?: number;
  endY?: number;
  tool?: 'pen' | 'eraser' | 'text' | 'shape';
  shape?: 'circle' | 'rectangle' | 'line';
  color?: string;
  size?: number;
  text?: string;
  userId: string;
  timestamp: number;
}

interface WhiteboardPermissions {
  adminOnly: boolean;
  allowedUsers: string[];
}

interface PermissionRequest {
  userId: string;
  username: string;
  timestamp: number;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userId, isAdmin, socket, participants, isPersonalChat = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const draggedObjectRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  
  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text' | 'shape' | 'move'>('pen');
  const [shape, setShape] = useState<'line' | 'rectangle' | 'circle'>('rectangle');
  const [color, setColor] = useState('#3B82F6');
  const [size, setSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(20);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  
  const [permissions, setPermissions] = useState<WhiteboardPermissions>({
    adminOnly: true,
    allowedUsers: []
  });
  const [canDraw, setCanDraw] = useState(isAdmin || isPersonalChat);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [hasRequested, setHasRequested] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Redraw canvas whenever objects change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    redrawCanvas(ctx, objects, selectedObjectId);
  }, [objects, selectedObjectId]);

  const redrawCanvas = (ctx: CanvasRenderingContext2D, objs: DrawObject[], selectedId: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all objects
    objs.forEach(obj => {
      drawObject(ctx, obj);
      
      // Draw selection outline
      if (obj.id === selectedId && tool === 'move') {
        drawSelectionBox(ctx, obj);
      }
    });
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: DrawObject) => {
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (obj.type === 'stroke' && obj.points) {
      if (obj.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(obj.points[0].x + obj.x, obj.points[0].y + obj.y);
      for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x + obj.x, obj.points[i].y + obj.y);
      }
      ctx.stroke();
    } else if (obj.type === 'text') {
      ctx.font = 'bold 20px Arial';
      ctx.fillText(obj.text || '', obj.x, obj.y);
    } else if (obj.type === 'shape') {
      const x = obj.startX || 0;
      const y = obj.startY || 0;
      const endX = obj.endX || x;
      const endY = obj.endY || y;

      if (obj.shape === 'rectangle') {
        ctx.fillStyle = obj.color + '20';
        ctx.fillRect(x + obj.x, y + obj.y, endX - x, endY - y);
        ctx.strokeRect(x + obj.x, y + obj.y, endX - x, endY - y);
      } else if (obj.shape === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - x, 2) + Math.pow(endY - y, 2));
        ctx.beginPath();
        ctx.arc(x + obj.x, y + obj.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = obj.color + '20';
        ctx.fill();
        ctx.stroke();
      } else if (obj.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(x + obj.x, y + obj.y);
        ctx.lineTo(endX + obj.x, endY + obj.y);
        ctx.stroke();
      }
    }
  };

  const drawSelectionBox = (ctx: CanvasRenderingContext2D, obj: DrawObject) => {
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    if (obj.type === 'stroke' && obj.points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      obj.points.forEach(p => {
        minX = Math.min(minX, p.x + obj.x);
        minY = Math.min(minY, p.y + obj.y);
        maxX = Math.max(maxX, p.x + obj.x);
        maxY = Math.max(maxY, p.y + obj.y);
      });
      const padding = 5;
      ctx.strokeRect(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
    } else if (obj.type === 'text') {
      ctx.strokeRect(obj.x - 5, obj.y - 20, 150, 30);
    } else if (obj.type === 'shape') {
      const x = Math.min(obj.startX || 0, obj.endX || 0);
      const y = Math.min(obj.startY || 0, obj.endY || 0);
      const w = Math.abs((obj.endX || 0) - (obj.startX || 0));
      const h = Math.abs((obj.endY || 0) - (obj.startY || 0));
      ctx.strokeRect(x + obj.x - 5, y + obj.y - 5, w + 10, h + 10);
    }
    
    ctx.setLineDash([]);
  };

  const getObjectAtPoint = (x: number, y: number): string | null => {
    // Check in reverse order (topmost object first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      
      if (obj.type === 'stroke' && obj.points) {
        for (const p of obj.points) {
          const dist = Math.sqrt(Math.pow(p.x + obj.x - x, 2) + Math.pow(p.y + obj.y - y, 2));
          if (dist < 10) return obj.id;
        }
      } else if (obj.type === 'text') {
        if (x >= obj.x - 5 && x <= obj.x + 150 && y >= obj.y - 20 && y <= obj.y + 15) {
          return obj.id;
        }
      } else if (obj.type === 'shape') {
        const minX = Math.min(obj.startX || 0, obj.endX || 0) + obj.x;
        const maxX = Math.max(obj.startX || 0, obj.endX || 0) + obj.x;
        const minY = Math.min(obj.startY || 0, obj.endY || 0) + obj.y;
        const maxY = Math.max(obj.startY || 0, obj.endY || 0) + obj.y;
        if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
          return obj.id;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Setup socket listeners
    socket.on('whiteboard-draw', (event: DrawEvent) => {
      handleRemoteDraw(event, ctx);
    });

    socket.on('whiteboard-clear', () => {
      clearCanvas(ctx);
    });

    socket.on('whiteboard-permissions', (perms: WhiteboardPermissions) => {
      setPermissions(perms);
      setCanDraw(isAdmin || perms.allowedUsers.includes(userId));
    });

    socket.on('whiteboard-permission-request', (request: PermissionRequest) => {
      setPermissionRequests(prev => {
        const exists = prev.some(r => r.userId === request.userId);
        return exists ? prev : [...prev, request];
      });
    });

    socket.on('whiteboard-permission-approved', (data: { userId: string; approvedBy: string }) => {
      if (data.userId === userId) {
        setCanDraw(true);
        setHasRequested(false);
      }
      setPermissionRequests(prev => prev.filter(r => r.userId !== data.userId));
    });

    socket.on('whiteboard-permission-rejected', (data: { userId: string }) => {
      if (data.userId === userId) {
        setHasRequested(false);
      }
      setPermissionRequests(prev => prev.filter(r => r.userId !== data.userId));
    });

    return () => {
      socket.off('whiteboard-draw');
      socket.off('whiteboard-clear');
      socket.off('whiteboard-permissions');
      socket.off('whiteboard-permission-request');
      socket.off('whiteboard-permission-approved');
      socket.off('whiteboard-permission-rejected');
    };
  }, [socket, userId, isAdmin]);

  const handleRemoteDraw = (event: DrawEvent, ctx: CanvasRenderingContext2D) => {
    if (event.type === 'CLEAR') {
      const canvas = canvasRef.current;
      if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (event.type === 'DRAW' && event.x !== undefined && event.y !== undefined) {
      ctx.strokeStyle = event.color || '#3B82F6';
      ctx.lineWidth = event.size || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (event.prevX !== undefined && event.prevY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(event.prevX, event.prevY);
        ctx.lineTo(event.x, event.y);
        ctx.stroke();
      }
    }

    if (event.type === 'TEXT' && event.x !== undefined && event.y !== undefined && event.text) {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = event.color || '#3B82F6';
      ctx.fillText(event.text, event.x, event.y);
    }

    if (event.type === 'SHAPE' && event.shape) {
      ctx.strokeStyle = event.color || '#3B82F6';
      ctx.lineWidth = event.size || 2;
      ctx.fillStyle = event.color ? event.color + '20' : '#3B82F620';

      if (event.shape === 'rectangle' && event.x !== undefined && event.y !== undefined && event.endX !== undefined && event.endY !== undefined) {
        const w = event.endX - event.x;
        const h = event.endY - event.y;
        ctx.fillRect(event.x, event.y, w, h);
        ctx.strokeRect(event.x, event.y, w, h);
      } else if (event.shape === 'circle' && event.x !== undefined && event.y !== undefined && event.endX !== undefined && event.endY !== undefined) {
        const radius = Math.sqrt(Math.pow(event.endX - event.x, 2) + Math.pow(event.endY - event.y, 2));
        ctx.beginPath();
        ctx.arc(event.x, event.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (event.shape === 'line' && event.x !== undefined && event.y !== undefined && event.endX !== undefined && event.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(event.x, event.y);
        ctx.lineTo(event.endX, event.endY);
        ctx.stroke();
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (tool === 'text') {
      setTextPos({ x, y });
      setShowTextInput(true);
      setIsDrawing(false);
    } else if (tool === 'shape') {
      shapeStartRef.current = { x, y };
      // Save image data for preview
      const ctx = canvas.getContext('2d');
      if (ctx) {
        imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    } else {
      prevPointRef.current = { x, y };
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'shape' && shapeStartRef.current) {
      // Preview shape
      if (imageDataRef.current) {
        ctx.putImageData(imageDataRef.current, 0, 0);
      }
      drawShape(ctx, shapeStartRef.current.x, shapeStartRef.current.y, x, y);
      return;
    }

    const prevX = prevPointRef.current?.x ?? x;
    const prevY = prevPointRef.current?.y ?? y;

    if (tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = eraserSize;
      ctx.globalCompositeOperation = 'destination-out';
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    prevPointRef.current = { x, y };

    const drawEvent: DrawEvent = {
      type: 'DRAW',
      x,
      y,
      prevX,
      prevY,
      tool,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size: tool === 'eraser' ? eraserSize : size,
      userId,
      timestamp: Date.now()
    };

    socket.emit('whiteboard-draw', { roomId, event: drawEvent });
  };

  const drawShape = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.fillStyle = color + '20';

    if (shape === 'rectangle') {
      const w = endX - startX;
      const h = endY - startY;
      ctx.fillRect(startX, startY, w, h);
      ctx.strokeRect(startX, startY, w, h);
    } else if (shape === 'circle') {
      const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (shape === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    prevPointRef.current = null;

    if (tool === 'shape' && shapeStartRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const rect = canvas.getBoundingClientRect();
        // Get current mouse position to finalize shape
        // The shape was already drawn in preview
      }
      shapeStartRef.current = null;
      imageDataRef.current = null;
    }
  };

  const handleAddText = (text: string) => {
    if (!text || !textPos) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = color;
    ctx.fillText(text, textPos.x, textPos.y);

    const drawEvent: DrawEvent = {
      type: 'TEXT',
      x: textPos.x,
      y: textPos.y,
      text,
      color,
      userId,
      timestamp: Date.now()
    };

    socket.emit('whiteboard-draw', { roomId, event: drawEvent });
    setTextInput('');
    setShowTextInput(false);
    setTextPos(null);
  };

  const toggleUserPermission = (targetUserId: string) => {
    if (!isAdmin) return;

    const newAllowedUsers = permissions.allowedUsers.includes(targetUserId)
      ? permissions.allowedUsers.filter(id => id !== targetUserId)
      : [...permissions.allowedUsers, targetUserId];

    const newPermissions = {
      ...permissions,
      allowedUsers: newAllowedUsers
    };

    setPermissions(newPermissions);
    socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
  };

  const handleRequestPermission = () => {
    if (hasRequested || canDraw) return;

    setHasRequested(true);
    socket.emit('whiteboard-request-permission', {
      roomId,
      userId,
      username: `User-${userId.slice(0, 8)}`
    });
  };

  const approvePermissionRequest = (requestUserId: string) => {
    if (!isAdmin) return;

    const newAllowedUsers = [...permissions.allowedUsers, requestUserId];
    const newPermissions = {
      ...permissions,
      allowedUsers: newAllowedUsers
    };

    setPermissions(newPermissions);
    socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
    socket.emit('whiteboard-permission-approve', {
      roomId,
      userId: requestUserId,
      approvedBy: userId
    });
    setPermissionRequests(prev => prev.filter(r => r.userId !== requestUserId));
  };

  const rejectPermissionRequest = (requestUserId: string) => {
    if (!isAdmin) return;

    socket.emit('whiteboard-permission-reject', {
      roomId,
      userId: requestUserId
    });
    setPermissionRequests(prev => prev.filter(r => r.userId !== requestUserId));
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-white rounded-lg shadow-xl overflow-hidden">
      {/* Toolbar - Enhanced Design */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 space-y-3">
        {/* Tools Row 1 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pen Tool */}
          <button
            onClick={() => setTool('pen')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              tool === 'pen' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
            }`}
            disabled={!canDraw}
            title="Draw with pen"
          >
            ✏️ Pen
          </button>

          {/* Eraser Tool */}
          <button
            onClick={() => setTool('eraser')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              tool === 'eraser' 
                ? 'bg-red-500 text-white shadow-lg' 
                : 'bg-white text-gray-700 border border-gray-300 hover:border-red-400'
            }`}
            disabled={!canDraw}
            title="Erase"
          >
            🧹 Eraser
          </button>

          {/* Text Tool */}
          <button
            onClick={() => setTool('text')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1 ${
              tool === 'text' 
                ? 'bg-green-600 text-white shadow-lg' 
                : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500'
            }`}
            disabled={!canDraw}
            title="Add text"
          >
            <Type size={18} />
            Text
          </button>

          {/* Shape Tool */}
          <button
            onClick={() => setTool('shape')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              tool === 'shape' 
                ? 'bg-purple-600 text-white shadow-lg' 
                : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-500'
            }`}
            disabled={!canDraw}
            title="Draw shapes"
          >
            ⬜ Shape
          </button>

          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300 hover:border-blue-500"
              disabled={!canDraw || tool === 'eraser'}
              title="Pick color"
            />
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-300"></div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 transition-all"
            title="Settings"
          >
            <Settings size={20} className="text-gray-600" />
          </button>

          {/* Clear Button */}
          {isAdmin && (
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    socket.emit('whiteboard-clear', { roomId });
                  }
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all shadow-lg flex items-center gap-1"
              title="Clear canvas"
            >
              <Trash2 size={18} />
              Clear
            </button>
          )}

          {/* Undo Button */}
          <button
            onClick={() => {
              // Undo functionality - reload from previous state
              socket.emit('whiteboard-undo', { roomId });
            }}
            className="px-4 py-2 rounded-lg bg-gray-300 text-gray-700 font-medium hover:bg-gray-400 transition-all flex items-center gap-1"
            disabled={!canDraw}
            title="Undo"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Tools Row 2 - Size Controls */}
        {showSettings && (
          <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
            {tool === 'pen' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 min-w-fit">Pen Size:</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-32 h-2 bg-blue-200 rounded-lg cursor-pointer"
                  disabled={!canDraw}
                />
                <span className="text-sm font-semibold text-gray-700 min-w-fit">{size}px</span>
              </div>
            )}

            {tool === 'eraser' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 min-w-fit">Eraser Size:</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(Number(e.target.value))}
                  className="w-32 h-2 bg-red-200 rounded-lg cursor-pointer"
                  disabled={!canDraw}
                />
                <span className="text-sm font-semibold text-gray-700 min-w-fit">{eraserSize}px</span>
              </div>
            )}

            {tool === 'shape' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Shape:</label>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value as 'line' | 'rectangle' | 'circle')}
                  className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-sm"
                  disabled={!canDraw}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                  <option value="line">Line</option>
                </select>

                <label className="text-sm font-medium text-gray-700 min-w-fit">Thickness:</label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-32 h-2 bg-purple-200 rounded-lg cursor-pointer"
                  disabled={!canDraw}
                />
                <span className="text-sm font-semibold text-gray-700 min-w-fit">{size}px</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full bg-white cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        
        {/* Text Input Modal */}
        {showTextInput && textPos && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Text</h3>
              <input
                type="text"
                autoFocus
                placeholder="Type your text..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddText(textInput);
                  } else if (e.key === 'Escape') {
                    setShowTextInput(false);
                    setTextPos(null);
                  }
                }}
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-600 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddText(textInput)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all"
                >
                  Add Text
                </button>
                <button
                  onClick={() => {
                    setShowTextInput(false);
                    setTextPos(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {!canDraw && !isPersonalChat && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 bg-white rounded-xl p-8 shadow-2xl">
              <p className="text-2xl">👁️</p>
              <p className="text-lg font-bold text-gray-900">View Only Mode</p>
              <p className="text-gray-600 text-center">Admin hasn't granted drawing permission</p>
              {!hasRequested && (
                <button
                  onClick={handleRequestPermission}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  📝 Request Permission
                </button>
              )}
              {hasRequested && (
                <p className="text-yellow-600 text-sm font-medium">⏳ Request sent...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Permissions Panel (Admin Only) */}
      {isAdmin && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4 max-h-40 overflow-y-auto">
          {permissionRequests.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-2">🔔 Permission Requests ({permissionRequests.length})</h4>
              <div className="space-y-2">
                {permissionRequests.map(request => (
                  <div key={request.userId} className="flex items-center justify-between bg-orange-100 p-3 rounded-lg border border-orange-200">
                    <span className="text-sm font-medium text-gray-800">{request.username}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const newAllowedUsers = [...permissions.allowedUsers, request.userId];
                          const newPermissions = { ...permissions, allowedUsers: newAllowedUsers };
                          setPermissions(newPermissions);
                          socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
                          socket.emit('whiteboard-permission-approve', { roomId, userId: request.userId, approvedBy: userId });
                          setPermissionRequests(prev => prev.filter(r => r.userId !== request.userId));
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-medium transition-all"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => {
                          socket.emit('whiteboard-permission-reject', { roomId, userId: request.userId });
                          setPermissionRequests(prev => prev.filter(r => r.userId !== request.userId));
                        }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-medium transition-all"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {participants.filter(id => id !== userId).length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">✏️ Drawing Access</h4>
              <div className="flex flex-wrap gap-2">
                {participants.filter(id => id !== userId).map(participantId => (
                  <button
                    key={participantId}
                    onClick={() => {
                      const newAllowedUsers = permissions.allowedUsers.includes(participantId)
                        ? permissions.allowedUsers.filter(id => id !== participantId)
                        : [...permissions.allowedUsers, participantId];
                      const newPermissions = { ...permissions, allowedUsers: newAllowedUsers };
                      setPermissions(newPermissions);
                      socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
                    }}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                      permissions.allowedUsers.includes(participantId)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {participantId.slice(0, 6)}... {permissions.allowedUsers.includes(participantId) ? '✅' : '🔒'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
