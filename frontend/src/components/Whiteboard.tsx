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
  x: number; // offset position for move tool
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
  tool?: 'pen' | 'eraser' | 'text' | 'shape' | 'move';
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
  const dragStateRef = useRef<{
    type: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null;
    objectId: string | null;
    startX: number;
    startY: number;
    startObjX: number;
    startObjY: number;
    startObjWidth: number;
    startObjHeight: number;
  } | null>(null);
  const shapeEndRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeIdRef = useRef<string | null>(null);

  const [objects, setObjects] = useState<DrawObject[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text' | 'shape' | 'move'>('pen');
  const [shape, setShape] = useState<'line' | 'rectangle' | 'circle'>('rectangle');
  const [color, setColor] = useState('#3B82F6');
  const [size, setSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(20);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('crosshair');

  const [permissions, setPermissions] = useState<WhiteboardPermissions>({
    adminOnly: true,
    allowedUsers: []
  });
  const [canDraw, setCanDraw] = useState(isAdmin || isPersonalChat);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [hasRequested, setHasRequested] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize canvas size on mount and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      // Set canvas internal dimensions to match display size
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Redraw after resize
      const ctx = canvas.getContext('2d');
      if (ctx) redrawCanvas(ctx);
    };

    // Initial size
    resizeCanvas();

    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas whenever objects change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCanvas(ctx);
  }, [objects, selectedObjectId]);

  const redrawCanvas = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all objects
    objects.forEach(obj => {
      drawObject(ctx, obj);

      // Draw selection outline
      if (obj.id === selectedObjectId && tool === 'move') {
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

    if (obj.type === 'stroke' && obj.points && obj.points.length > 0) {
      // Start at object's base position
      ctx.beginPath();
      ctx.moveTo(obj.x + obj.points[0].x, obj.y + obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.x + obj.points[i].x, obj.y + obj.points[i].y);
      }
      ctx.stroke();
    } else if (obj.type === 'text') {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text || '', obj.x, obj.y);
    } else if (obj.type === 'shape') {
      const x = (obj.startX || 0) + obj.x;
      const y = (obj.startY || 0) + obj.y;
      const endX = (obj.endX || 0) + obj.x;
      const endY = (obj.endY || 0) + obj.y;
      const w = endX - x;
      const h = endY - y;

      if (obj.shape === 'rectangle') {
        ctx.fillStyle = obj.color + '20';
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else if (obj.shape === 'circle') {
        const radius = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2));
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = obj.color + '20';
        ctx.fill();
        ctx.stroke();
      } else if (obj.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }
  };

  const drawSelectionBox = (ctx: CanvasRenderingContext2D, obj: DrawObject) => {
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const HANDLE_SIZE = 8;
    let x, y, w, h;

    if (obj.type === 'stroke' && obj.points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      obj.points.forEach(p => {
        minX = Math.min(minX, p.x + obj.x);
        minY = Math.min(minY, p.y + obj.y);
        maxX = Math.max(maxX, p.x + obj.x);
        maxY = Math.max(maxY, p.y + obj.y);
      });
      const padding = 5;
      x = minX - padding;
      y = minY - padding;
      w = maxX - minX + padding * 2;
      h = maxY - minY + padding * 2;
    } else if (obj.type === 'text') {
      x = obj.x - 5;
      y = obj.y - 20;
      w = 150;
      h = 30;
    } else if (obj.type === 'shape') {
      const minX = Math.min((obj.startX || 0) + obj.x, (obj.endX || 0) + obj.x);
      const maxX = Math.max((obj.startX || 0) + obj.x, (obj.endX || 0) + obj.x);
      const minY = Math.min((obj.startY || 0) + obj.y, (obj.endY || 0) + obj.y);
      const maxY = Math.max((obj.startY || 0) + obj.y, (obj.endY || 0) + obj.y);
      x = minX - 5;
      y = minY - 5;
      w = maxX - minX + 10;
      h = maxY - minY + 10;
    }

    // Draw selection box
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Draw resize handles at corners
      const corners = [
        { x: x, y: y, cursor: 'nwse-resize', id: 'tl' },           // Top-left
        { x: x + w, y: y, cursor: 'nesw-resize', id: 'tr' },       // Top-right
        { x: x, y: y + h, cursor: 'nesw-resize', id: 'bl' },       // Bottom-left
        { x: x + w, y: y + h, cursor: 'nwse-resize', id: 'br' }    // Bottom-right
      ];

      corners.forEach(corner => {
        // Draw handle circle
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, HANDLE_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();

        // Draw handle border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
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
        const x_base = obj.x;
        const y_base = obj.y;

        if (obj.shape === 'circle') {
          const startX = (obj.startX || 0) + x_base;
          const startY = (obj.startY || 0) + y_base;
          const endX = (obj.endX || 0) + x_base;
          const endY = (obj.endY || 0) + y_base;
          const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          if (dist <= radius + 5) return obj.id;
        } else {
          const minX = Math.min((obj.startX || 0) + x_base, (obj.endX || 0) + x_base);
          const maxX = Math.max((obj.startX || 0) + x_base, (obj.endX || 0) + x_base);
          const minY = Math.min((obj.startY || 0) + y_base, (obj.endY || 0) + y_base);
          const maxY = Math.max((obj.startY || 0) + y_base, (obj.endY || 0) + y_base);
          if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
            return obj.id;
          }
        }
      }
    }
    return null;
  };

  const getHandleAtPoint = (objId: string, x: number, y: number): 'tl' | 'tr' | 'bl' | 'br' | null => {
    if (!objId) return null;

    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;

    const HANDLE_SIZE = 8;
    let bx, by, bw, bh;

    if (obj.type === 'stroke' && obj.points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      obj.points.forEach(p => {
        minX = Math.min(minX, p.x + obj.x);
        minY = Math.min(minY, p.y + obj.y);
        maxX = Math.max(maxX, p.x + obj.x);
        maxY = Math.max(maxY, p.y + obj.y);
      });
      const padding = 5;
      bx = minX - padding;
      by = minY - padding;
      bw = maxX - minX + padding * 2;
      bh = maxY - minY + padding * 2;
    } else if (obj.type === 'text') {
      bx = obj.x - 5;
      by = obj.y - 20;
      bw = 150;
      bh = 30;
    } else if (obj.type === 'shape') {
      const x_base = obj.x;
      const y_base = obj.y;

      if (obj.shape === 'circle') {
        const startX = (obj.startX || 0) + x_base;
        const startY = (obj.startY || 0) + y_base;
        const endX = (obj.endX || 0) + x_base;
        const endY = (obj.endY || 0) + y_base;
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        bx = startX - radius;
        by = startY - radius;
        bw = radius * 2;
        bh = radius * 2;
      } else {
        const minX = Math.min((obj.startX || 0) + x_base, (obj.endX || 0) + x_base);
        const maxX = Math.max((obj.startX || 0) + x_base, (obj.endX || 0) + x_base);
        const minY = Math.min((obj.startY || 0) + y_base, (obj.endY || 0) + y_base);
        const maxY = Math.max((obj.startY || 0) + y_base, (obj.endY || 0) + y_base);
        bx = minX - 5;
        by = minY - 5;
        bw = maxX - minX + 10;
        bh = maxY - minY + 10;
      }
    }

    if (bx === undefined) return null;

    // Check corners
    const tlDist = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - by, 2));
    const trDist = Math.sqrt(Math.pow(x - (bx + bw), 2) + Math.pow(y - by, 2));
    const blDist = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - (by + bh), 2));
    const brDist = Math.sqrt(Math.pow(x - (bx + bw), 2) + Math.pow(y - (by + bh), 2));

    const threshold = HANDLE_SIZE;
    const minDist = Math.min(tlDist, trDist, blDist, brDist);

    if (minDist < threshold) {
      if (minDist === tlDist) return 'tl';
      if (minDist === trDist) return 'tr';
      if (minDist === blDist) return 'bl';
      if (minDist === brDist) return 'br';
    }

    return null;
  };

  // Socket event listeners
  useEffect(() => {
    socket.on('whiteboard-draw', (event: DrawEvent) => {
      setObjects(prev => {
        const existingIdx = prev.findIndex(o => o.id === event.objectId);

        if (event.type === 'DRAW') {
          if (existingIdx >= 0) {
            const updated = [...prev];
            const obj = { ...updated[existingIdx] };
            obj.points = [...(obj.points || []), { x: event.x || 0, y: event.y || 0 }];

            // Handle shape resizing via DRAW event (from old implementation)
            if (event.startX !== undefined) obj.startX = event.startX;
            if (event.startY !== undefined) obj.startY = event.startY;
            if (event.endX !== undefined) obj.endX = event.endX;
            if (event.endY !== undefined) obj.endY = event.endY;

            updated[existingIdx] = obj;
            return updated;
          } else {
            return [...prev, {
              id: event.objectId || `${event.userId}-${Date.now()}`,
              type: 'stroke',
              points: [{ x: event.x || 0, y: event.y || 0 }],
              color: event.color || '#3B82F6',
              size: event.size || 3,
              x: 0,
              y: 0,
              userId: event.userId,
              timestamp: event.timestamp
            }];
          }
        } else if (event.type === 'TEXT') {
          if (existingIdx >= 0) return prev; // Avoid duplicates
          return [...prev, {
            id: event.objectId || `${event.userId}-${Date.now()}`,
            type: 'text',
            text: event.text,
            color: event.color || '#3B82F6',
            size: event.size || 3,
            x: event.x || 0,
            y: event.y || 0,
            userId: event.userId,
            timestamp: event.timestamp
          }];
        } else if (event.type === 'SHAPE') {
          if (existingIdx >= 0) return prev; // Avoid duplicates
          return [...prev, {
            id: event.objectId || `${event.userId}-${Date.now()}`,
            type: 'shape',
            shape: event.shape as 'circle' | 'rectangle' | 'line',
            startX: event.x,
            startY: event.y,
            endX: event.endX,
            endY: event.endY,
            color: event.color || '#3B82F6',
            size: event.size || 3,
            x: 0,
            y: 0,
            userId: event.userId,
            timestamp: event.timestamp
          }];
        } else if (event.type === 'MOVE') {
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              x: event.x || 0,
              y: event.y || 0
            };
            return updated;
          }
        } else if (event.type === 'ERASE') {
          return prev.filter(o => o.id !== event.objectId);
        } else if (event.type === 'CLEAR') {
          return [];
        }

        return prev;
      });
    });

    socket.on('whiteboard-clear', () => {
      setObjects([]);
    });

    socket.on('whiteboard-permissions', (newPermissions: WhiteboardPermissions) => {
      setPermissions(newPermissions);
      if (!isAdmin && newPermissions.allowedUsers.includes(userId)) {
        setCanDraw(true);
        setHasRequested(false);
      } else if (!isAdmin && !newPermissions.allowedUsers.includes(userId)) {
        setCanDraw(false);
      }
    });

    socket.on('whiteboard-permission-approved', (data: { userId: string }) => {
      if (data.userId === userId) {
        setCanDraw(true);
        setHasRequested(false);
        alert('Drawing permission granted! ✏️');
      }
    });

    socket.on('whiteboard-permission-rejected', (data: { userId: string }) => {
      if (data.userId === userId) {
        setHasRequested(false);
        alert('Drawing permission request rejected. 🔒');
      }
    });

    socket.on('whiteboard-permission-request', (request: PermissionRequest) => {
      if (isAdmin) {
        setPermissionRequests(prev => {
          const exists = prev.some(r => r.userId === request.userId);
          return exists ? prev : [...prev, request];
        });
      }
    });

    return () => {
      socket.off('whiteboard-draw');
      socket.off('whiteboard-clear');
      socket.off('whiteboard-permissions-update');
      socket.off('whiteboard-permission-request');
    };
  }, [socket, isAdmin, userId]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw && tool !== 'move') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'text') {
      setTextPos({ x, y });
      setShowTextInput(true);
      return;
    }

    if (tool === 'move') {
      // First check if clicking on a resize handle
      if (selectedObjectId) {
        const handle = getHandleAtPoint(selectedObjectId, x, y);
        if (handle) {
          const obj = objects.find(o => o.id === selectedObjectId);
          if (obj) {
            dragStateRef.current = {
              type: `resize-${handle}` as any,
              objectId: selectedObjectId,
              startX: x,
              startY: y,
              startObjX: obj.x,
              startObjY: obj.y,
              startObjWidth: 0,
              startObjHeight: 0
            };
          }
          setIsDrawing(true);
          return;
        }
      }

      // Otherwise check if clicking on an object to select it
      const objId = getObjectAtPoint(x, y);
      if (objId) {
        setSelectedObjectId(objId);
        const obj = objects.find(o => o.id === objId);
        if (obj) {
          dragStateRef.current = {
            type: 'move',
            objectId: objId,
            startX: x,
            startY: y,
            startObjX: obj.x,
            startObjY: obj.y,
            startObjWidth: 0,
            startObjHeight: 0
          };
        }
        setIsDrawing(true);
      } else {
        setSelectedObjectId(null);
      }
      return;
    }

    if (tool === 'shape') {
      shapeStartRef.current = { x, y };
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    prevPointRef.current = { x, y };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (!canDraw && tool !== 'move') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle move/resize operations
    if (tool === 'move' && dragStateRef.current && dragStateRef.current.objectId) {
      const dragState = dragStateRef.current;
      const deltaX = x - dragState.startX;
      const deltaY = y - dragState.startY;

      setObjects(prev => prev.map(obj => {
        if (obj.id !== dragState.objectId) return obj;

        if (dragState.type === 'move') {
          // Simple move
          return {
            ...obj,
            x: dragState.startObjX + deltaX,
            y: dragState.startObjY + deltaY
          };
        } else if (dragState.type?.startsWith('resize-')) {
          // Resize based on handle
          const handle = dragState.type.replace('resize-', '');
          const newObj = { ...obj };

          if (obj.type === 'shape') {
            // For shapes, adjust start/end points
            const sx = obj.startX || 0;
            const sy = obj.startY || 0;
            const ex = obj.endX || 0;
            const ey = obj.endY || 0;

            if (handle === 'tl') {
              newObj.startX = sx + deltaX;
              newObj.startY = sy + deltaY;
            } else if (handle === 'tr') {
              newObj.endX = ex + deltaX;
              newObj.startY = sy + deltaY;
            } else if (handle === 'bl') {
              newObj.startX = sx + deltaX;
              newObj.endY = ey + deltaY;
            } else if (handle === 'br') {
              newObj.endX = ex + deltaX;
              newObj.endY = ey + deltaY;
            }
          } else if (obj.type === 'text') {
            // For text, adjust size
            if (handle === 'br') {
              newObj.size = Math.max(8, (obj.size || 16) + deltaX / 10);
            }
          }
          return newObj;
        }
        return obj;
      }));
      return;
    }

    const prevX = prevPointRef.current?.x ?? x;
    const prevY = prevPointRef.current?.y ?? y;

    if (tool === 'pen') {
      if (!currentStrokeIdRef.current) {
        currentStrokeIdRef.current = `stroke-${userId}-${Date.now()}`;
      }
      const objectIdKey = currentStrokeIdRef.current;

      setObjects(prev => {
        const existingIdx = prev.findIndex(o => o.id === objectIdKey);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const obj = { ...updated[existingIdx] };
          obj.points = [...(obj.points || []), { x: x - obj.x, y: y - obj.y }];
          updated[existingIdx] = obj;
          return updated;
        }
        return [...prev, {
          id: objectIdKey,
          type: 'stroke',
          points: [{ x: 0, y: 0 }],
          color,
          size,
          x,
          y,
          userId,
          timestamp: Date.now()
        }];
      });

      socket.emit('whiteboard-draw', {
        roomId,
        event: {
          type: 'DRAW',
          objectId: objectIdKey,
          x: x - prevX,
          y: y - prevY,
          color,
          size,
          userId,
          timestamp: Date.now()
        }
      });
    } else if (tool === 'eraser') {
      const objId = getObjectAtPoint(x, y);
      if (objId) {
        socket.emit('whiteboard-draw', {
          roomId,
          event: {
            type: 'ERASE',
            objectId: objId,
            userId,
            timestamp: Date.now()
          }
        });
      }
    } else if (tool === 'shape') {
      // Update live preview and store shape end coordinates
      shapeEndRef.current = { x, y };
      const ctx = canvas.getContext('2d');
      if (ctx) {
        redrawCanvas(ctx);
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '20';
        ctx.lineWidth = size;

        const startX = shapeStartRef.current?.x || x;
        const startY = shapeStartRef.current?.y || y;

        if (shape === 'rectangle') {
          ctx.fillRect(startX, startY, x - startX, y - startY);
          ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (shape === 'circle') {
          const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        } else if (shape === 'line') {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }

    prevPointRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (tool === 'shape') {
      shapeStartRef.current = null;
    }
    if (tool === 'move') {
      if (dragStateRef.current && selectedObjectId) {
        const dragState = dragStateRef.current;
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) {
          if (dragState.type === 'move') {
            socket.emit('whiteboard-draw', {
              roomId,
              event: {
                type: 'MOVE',
                objectId: selectedObjectId,
                x: obj.x,
                y: obj.y,
                userId,
                timestamp: Date.now()
              }
            });
          } else if (dragState.type?.startsWith('resize-')) {
            // Emit DRAW event with shape properties to update others
            socket.emit('whiteboard-draw', {
              roomId,
              event: {
                type: 'DRAW',
                objectId: selectedObjectId,
                x: obj.x,
                y: obj.y,
                startX: obj.startX,
                startY: obj.startY,
                endX: obj.endX,
                endY: obj.endY,
                color: obj.color,
                size: obj.size,
                userId,
                timestamp: Date.now()
              }
            });
          }
        }
      }
      dragStateRef.current = null;
    } else if (tool === 'shape' && isDrawing && shapeStartRef.current && shapeEndRef.current) {
      const startPos = shapeStartRef.current;
      const endPos = shapeEndRef.current;
      const shapeId = `${userId}-shape-${Date.now()}`;

      setObjects(prev => [...prev, {
        id: shapeId,
        type: 'shape',
        shape: shape as 'circle' | 'rectangle' | 'line',
        startX: startPos.x,
        startY: startPos.y,
        endX: endPos.x,
        endY: endPos.y,
        color,
        size,
        x: 0,
        y: 0,
        userId,
        timestamp: Date.now()
      }]);

      socket.emit('whiteboard-draw', {
        roomId,
        event: {
          type: 'SHAPE',
          objectId: shapeId,
          x: startPos.x,
          y: startPos.y,
          endX: endPos.x,
          endY: endPos.y,
          shape,
          color,
          size,
          userId,
          timestamp: Date.now()
        }
      });

      shapeEndRef.current = null;
    }

    if (tool === 'pen') {
      currentStrokeIdRef.current = null;
    }

    setIsDrawing(false);
    prevPointRef.current = null;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'move') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if hovering over resize handle
      if (selectedObjectId) {
        const handle = getHandleAtPoint(selectedObjectId, x, y);
        if (handle === 'tl' || handle === 'br') {
          setHoverCursor('nwse-resize');
        } else if (handle === 'tr' || handle === 'bl') {
          setHoverCursor('nesw-resize');
        } else {
          setHoverCursor('move');
        }
      } else {
        setHoverCursor('crosshair');
      }
    } else {
      setHoverCursor('crosshair');
    }
    draw(e);
  };

  const handleAddText = () => {
    if (textInput && textPos) {
      socket.emit('whiteboard-draw', {
        roomId,
        event: {
          type: 'TEXT',
          x: textPos.x,
          y: textPos.y,
          text: textInput,
          color,
          userId,
          timestamp: Date.now()
        }
      });

      setObjects(prev => [...prev, {
        id: `${userId}-${Date.now()}`,
        type: 'text',
        text: textInput,
        color,
        size: 3,
        x: textPos.x,
        y: textPos.y,
        userId,
        timestamp: Date.now()
      }]);

      setTextInput('');
      setShowTextInput(false);
      setTextPos(null);
    }
  };

  const handleClear = () => {
    if (isAdmin) {
      socket.emit('whiteboard-clear', { roomId });
      setObjects([]);
    }
  };

  const handleRequestPermission = () => {
    socket.emit('whiteboard-permission-request', {
      roomId,
      userId,
      username: userId,
      timestamp: Date.now()
    });
    setHasRequested(true);
  };

  const handleApproveRequest = (requestUserId: string) => {
    const newPermissions: WhiteboardPermissions = {
      ...permissions,
      allowedUsers: [...new Set([...permissions.allowedUsers, requestUserId])]
    };
    setPermissions(newPermissions);
    socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
    setPermissionRequests(prev => prev.filter(r => r.userId !== requestUserId));
  };

  const handleRejectRequest = (requestUserId: string) => {
    setPermissionRequests(prev => prev.filter(r => r.userId !== requestUserId));
  };

  const handleRevokeAccess = (userId: string) => {
    const newPermissions: WhiteboardPermissions = {
      ...permissions,
      allowedUsers: permissions.allowedUsers.filter(id => id !== userId)
    };
    setPermissions(newPermissions);
    socket.emit('whiteboard-permissions-update', { roomId, permissions: newPermissions });
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-700">
      {/* Toolbar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-3 md:p-4 border-b border-slate-600 flex gap-2 md:gap-3 overflow-x-auto flex-wrap">
        {/* Drawing Tools */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTool('pen'); setSelectedObjectId(null); }}
            className={`p-2 rounded transition ${tool === 'pen' ? 'bg-blue-600 shadow-lg' : 'bg-slate-600 hover:bg-slate-500'}`}
            title="Pen"
          >
            <div className="w-4 h-4 border-2 border-white rounded-full" />
          </button>

          <button
            onClick={() => { setTool('eraser'); setSelectedObjectId(null); }}
            className={`p-2 rounded transition ${tool === 'eraser' ? 'bg-red-600 shadow-lg' : 'bg-slate-600 hover:bg-slate-500'}`}
            title="Eraser"
          >
            <div className="w-4 h-4 bg-white rounded" />
          </button>

          <button
            onClick={() => { setTool('move'); }}
            className={`p-2 rounded transition ${tool === 'move' ? 'bg-purple-600 shadow-lg' : 'bg-slate-600 hover:bg-slate-500'}`}
            title="Move Objects"
          >
            <Move size={16} className="text-white" />
          </button>

          <button
            onClick={() => { setTool('text'); setSelectedObjectId(null); }}
            className={`p-2 rounded transition ${tool === 'text' ? 'bg-yellow-600 shadow-lg' : 'bg-slate-600 hover:bg-slate-500'}`}
            title="Text"
          >
            <Type size={16} className="text-white" />
          </button>

          <button
            onClick={() => { setTool('shape'); setSelectedObjectId(null); }}
            className={`p-2 rounded transition ${tool === 'shape' ? 'bg-green-600 shadow-lg' : 'bg-slate-600 hover:bg-slate-500'}`}
            title="Shapes"
          >
            <div className="w-4 h-4 border-2 border-white" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-500" />

        {/* Color & Size Controls */}
        {(tool === 'pen' || tool === 'text' || tool === 'shape') && (
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-slate-500"
              title="Color"
            />
            <input
              type="range"
              min="1"
              max="50"
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-20"
              title="Brush Size"
            />
            <span className="text-xs text-slate-300">{size}px</span>
          </div>
        )}

        {tool === 'eraser' && (
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min="10"
              max="100"
              value={eraserSize}
              onChange={(e) => setEraserSize(parseInt(e.target.value))}
              className="w-20"
              title="Eraser Size"
            />
            <span className="text-xs text-slate-300">{eraserSize}px</span>
          </div>
        )}

        {tool === 'shape' && (
          <div className="flex gap-2">
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as any)}
              className="bg-slate-600 text-white text-xs px-2 py-1 rounded border border-slate-500"
            >
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="line">Line</option>
            </select>
          </div>
        )}

        {/* Admin Controls */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded bg-slate-600 hover:bg-slate-500 transition"
            title="Settings"
          >
            <Settings size={16} className="text-white" />
          </button>

          {isAdmin && (
            <button
              onClick={handleClear}
              className="p-2 rounded bg-red-600 hover:bg-red-700 transition"
              title="Clear All"
            >
              <Trash2 size={16} className="text-white" />
            </button>
          )}

          {!canDraw && !hasRequested && (
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition"
            >
              Request Access
            </button>
          )}

          {hasRequested && (
            <span className="px-3 py-1 text-xs text-amber-400">Awaiting approval...</span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ cursor: hoverCursor }}
          className="w-full h-full"
        />
      </div>

      {/* Text Input Modal */}
      {showTextInput && textPos && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 shadow-2xl">
            <h3 className="text-white font-bold mb-3">Enter Text</h3>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddText()}
              autoFocus
              placeholder="Type your text..."
              className="w-64 px-3 py-2 rounded border border-slate-600 bg-slate-700 text-white mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddText}
                className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
              >
                Add
              </button>
              <button
                onClick={() => { setShowTextInput(false); setTextInput(''); setTextPos(null); }}
                className="flex-1 px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Panel */}
      {showSettings && isAdmin && (
        <div className="absolute bottom-0 right-0 bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-2xl max-h-80 overflow-y-auto w-80 z-40 m-4">
          <h3 className="text-white font-bold mb-3">Drawing Permissions</h3>

          {permissionRequests.length > 0 && (
            <div className="mb-4">
              <h4 className="text-slate-300 text-sm font-semibold mb-2">Pending Requests:</h4>
              {permissionRequests.map(req => (
                <div key={req.userId} className="flex justify-between items-center bg-slate-700 p-2 rounded mb-2 text-sm">
                  <span className="text-slate-200">{req.username}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveRequest(req.userId)}
                      className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.userId)}
                      className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {permissions.allowedUsers.length > 0 && (
            <div>
              <h4 className="text-slate-300 text-sm font-semibold mb-2">Allowed Users:</h4>
              {permissions.allowedUsers.map(uid => (
                <div key={uid} className="flex justify-between items-center bg-slate-700 p-2 rounded mb-2 text-sm">
                  <span className="text-slate-200">{uid === userId ? 'You' : uid}</span>
                  <button
                    onClick={() => handleRevokeAccess(uid)}
                    className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View-Only Overlay */}
      {!canDraw && tool !== 'move' && (
        <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-[2px] flex items-center justify-center z-30">
          <div className="bg-slate-800 bg-opacity-95 p-8 rounded-2xl border border-slate-600 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-2">
              <span className="text-3xl">🔒</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-1">View-Only Mode</h3>
              <p className="text-slate-400 text-sm">You need permission from the admin to draw on this whiteboard.</p>
            </div>

            {!hasRequested ? (
              <button
                onClick={handleRequestPermission}
                className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
              >
                Request Drawing Access
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-full text-amber-400 text-sm font-medium">
                <span className="animate-pulse">⏳</span> Request Sent...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
