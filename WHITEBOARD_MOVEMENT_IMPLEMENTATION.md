# Whiteboard Object Movement Implementation

## Overview
Fully implemented object-based whiteboard system with **move/select tool** that allows users to click and drag any drawn object to a new position with real-time synchronization across all participants.

## Key Features Implemented

### 1. **Object-Based Drawing System**
- All drawing operations now store objects in state array instead of pixel-based canvas rendering
- Objects track: type (stroke/text/shape), position (x, y offsets), color, size, userId, timestamp
- Supports 4 object types:
  - **Stroke**: Continuous pen paths with point arrays
  - **Text**: Text labels at specific positions
  - **Shape**: Geometric shapes (rectangle, circle, line) with start/end coordinates
  - Each object has unique ID for tracking and synchronization

### 2. **Move/Select Tool**
**New Tool Button**: `Move` button (purple, with move icon) in toolbar

**Functionality**:
- Click to select any drawn object - shows red dashed selection box around it
- Drag selected object to move it to new position
- Visual feedback: 5-pixel dashed border highlights selected objects
- Works with: strokes, text, and shapes
- Movement tracked locally and broadcast via socket

**Hit Detection Algorithm**:
- For strokes: Distance check from point to path points (10px tolerance)
- For text: Bounding box check (150px x 30px around text)
- For shapes: Bounding box check with 5px padding
- Checks in reverse order (topmost object selected first)

### 3. **Object Positioning System**
- **Base Position** (x, y): Initial drawing location
- **Offset Position**: Applied via move tool
- **Rendering**: All objects drawn relative to base + offset: `posX = baseX + offsetX`
- Allows unlimited movement of objects while maintaining draw history

### 4. **Real-Time Synchronization**
All drawing operations emit socket events with structure:
```javascript
socket.emit('whiteboard-draw', {
  roomId,           // Which room to sync to
  event: {
    type,           // DRAW, TEXT, SHAPE, MOVE, ERASE, CLEAR
    objectId,       // Unique identifier
    x, y, endX, endY, // Coordinates
    color, size,    // Styling
    userId,         // Who drew it
    timestamp       // When
  }
})
```

### 5. **Drawing Tools (Existing + Enhanced)**
1. **Pen** (Blue) - Draw strokes with adjustable size
2. **Eraser** (Red) - Erase objects by clicking on them
3. **Move** (Purple) - **NEW** - Select and drag objects
4. **Text** (Yellow) - Add text with modal input
5. **Shape** (Green) - Draw rectangles, circles, or lines with live preview

### 6. **Canvas Redraw Architecture**
`redrawCanvas()` function:
- Clears canvas to white
- Iterates through all objects array
- Draws each object using `drawObject()`
- Adds selection highlight if object is selected and move tool active
- Called whenever objects change or selection changes

```
State Change → useEffect → redrawCanvas() → Draw All Objects → Draw Selection
```

## Technical Implementation

### Component State Variables
```typescript
const [objects, setObjects] = useState<DrawObject[]>([]);      // All drawn objects
const [tool, setTool] = useState<'pen' | 'eraser' | 'text' | 'shape' | 'move'>('pen');
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
const [isDrawing, setIsDrawing] = useState(false);
```

### Refs for Position Tracking
```typescript
const prevPointRef = useRef<{ x: number; y: number } | null>(null);           // Previous mouse pos
const draggedObjectRef = useRef<{ id, offsetX, offsetY } | null>(null);       // Dragged object info
const shapeEndRef = useRef<{ x: number; y: number } | null>(null);            // Shape end coordinates
```

### Key Functions

**`startDrawing(e)`**
- Determines which tool is active
- For move tool: calls `getObjectAtPoint()` to find clicked object
- For text tool: opens modal at mouse position
- For pen/shape: stores initial position
- For move: stores drag offset (click position - object position)

**`draw(e)`**
- Pen: Accumulates stroke points, emits for real-time sync
- Eraser: Finds object at click, removes it
- Shape: Live preview while dragging, updates canvas
- Move: Updates selected object x/y position in real-time

**`stopDrawing()`**
- Pen: Normal flow
- Move: Emits MOVE event with final coordinates to sync
- Shape: Finalizes shape with start/end points, emits SHAPE event

**`getObjectAtPoint(x, y)`**
- Returns ID of top-most object at coordinate
- Checks in reverse array order (last drawn = topmost)
- Uses type-specific collision detection

**`redrawCanvas(ctx)`**
- Clears canvas to white background
- Draws each object using `drawObject()`
- Adds selection box if move tool + object selected

**`drawObject(ctx, obj)`**
- Renders based on object type
- Uses offset coordinates: `obj.x + baseX`
- Handles styling: color, size, transparency

### Socket Event Handler
```typescript
socket.on('whiteboard-draw', (event: DrawEvent) => {
  setObjects(prev => {
    // DRAW: Add point to existing stroke or create new stroke
    // TEXT: Create new text object
    // SHAPE: Create new shape object
    // MOVE: Update x,y offset of existing object
    // ERASE: Remove object by ID
    // CLEAR: Empty all objects
  });
});
```

## User Experience

### Workflow
1. **Draw freely** with pen, eraser, text, or shapes
2. **Switch to Move tool** button (or press hotkey in future)
3. **Click any object** to select (see red dashed box)
4. **Drag selected object** to new position
5. **Changes sync automatically** to all participants
6. **Deselect** by clicking empty space or switching tools

### Visual Feedback
- Selection: Red dashed border (5px dash, 5px gap)
- Move cursor: Changes to `cursor-move`
- View-only mode: Semi-transparent overlay when no drawing access

## Socket Events

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `whiteboard-draw` | Emit & Receive | { type: DRAW\|TEXT\|SHAPE\|MOVE\|ERASE\|CLEAR, ... } | All drawing operations |
| `whiteboard-clear` | Emit & Receive | { roomId } | Admin clears entire canvas |
| `whiteboard-permissions-update` | Emit & Receive | { roomId, permissions } | Update drawing access |
| `whiteboard-permission-request` | Emit & Receive | { roomId, userId, username } | Request drawing access |

## Browser Compatibility
- Canvas 2D API: All modern browsers
- Socket.io: Real-time bidirectional communication
- React refs: State management for transient position data

## Performance Considerations
- **Redraw**: Called on each objects state change (efficient for <1000 objects)
- **Stroke optimization**: Points stored relative to stroke start (small coordinate values)
- **Drag performance**: No canvas redraw during drag - only state update
- **Sync frequency**: Emits on every mouse move (can optimize with throttling in future)

## Future Enhancements
1. **Undo/Redo**: Store operations in history
2. **Drag throttling**: Emit MOVE events every 50ms instead of per pixel
3. **Batch operations**: Group multiple draws into transactions
4. **Keyboard shortcuts**: Press 'M' for move tool
5. **Multi-select**: Hold Shift to select multiple objects
6. **Copy/Paste**: Clone selected objects
7. **Grouping**: Combine multiple objects into group
8. **Layers panel**: Show all objects with visibility toggle
9. **Object properties**: Edit color/size after creation
10. **Rotation**: Rotate objects (requires matrix transforms)

## Testing Checklist
- [ ] Draw with pen, switch to move, drag stroke
- [ ] Create text, select and move it
- [ ] Draw shape, move it to new position
- [ ] Erase an object by clicking it
- [ ] Multiple users draw, then move objects (check sync)
- [ ] Admin clears whiteboard (all objects removed)
- [ ] Move object to edge of canvas (stays visible)
- [ ] Draw many objects (100+), move them (performance)
- [ ] Switch tools while dragging (stops drag gracefully)
- [ ] Refresh page (objects persist if saved to DB)

## File Structure
- **Whiteboard.tsx** (858 lines)
  - Main component with all drawing logic
  - Object-based architecture
  - Socket sync and real-time updates
  - UI with toolbar, color picker, size controls
  - Permissions system with request/approval flow

- **server.js** (344 lines)
  - Socket.io event handlers
  - Forwards whiteboard-draw events to room participants
  - Handles permissions updates
  - Broadcasts clear/erase/move operations

## Object Interface
```typescript
interface DrawObject {
  id: string;                              // Unique identifier
  type: 'stroke' | 'text' | 'shape';       // Object type
  points?: Array<{ x: number; y: number }>;// For strokes: relative points
  text?: string;                           // For text: content
  shape?: 'circle' | 'rectangle' | 'line';// For shapes: type
  startX?: number;                         // For shapes: start coordinates
  startY?: number;
  endX?: number;                           // For shapes: end coordinates
  endY?: number;
  color: string;                           // Hex color (#RRGGBB)
  size: number;                            // Line width or text size
  x: number;                               // Position offset X (for move tool)
  y: number;                               // Position offset Y (for move tool)
  userId: string;                          // Who created it
  timestamp: number;                       // Creation time
}
```

---

**Status**: ✅ Implementation Complete  
**Last Updated**: 2024  
**Compatible with**: Frontend React + Backend Express.js + Socket.io
