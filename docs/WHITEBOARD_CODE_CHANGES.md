# 💻 Code Changes - Whiteboard Permission System

## Frontend: Whiteboard.tsx

### New Interfaces
```typescript
interface PermissionRequest {
  userId: string;
  username: string;
  timestamp: number;
}
```

### New State Variables
```typescript
const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
const [hasRequested, setHasRequested] = useState(false);
```

### New Socket Event Listeners
```typescript
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
```

### New Functions

#### Request Permission (User-initiated)
```typescript
const handleRequestPermission = () => {
  if (hasRequested || canDraw) return;

  setHasRequested(true);
  socket.emit('whiteboard-request-permission', {
    roomId,
    userId,
    username: `User-${userId.slice(0, 8)}`
  });
};
```

#### Approve Request (Admin)
```typescript
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
```

#### Reject Request (Admin)
```typescript
const rejectPermissionRequest = (requestUserId: string) => {
  if (!isAdmin) return;

  socket.emit('whiteboard-permission-reject', {
    roomId,
    userId: requestUserId
  });
  setPermissionRequests(prev => prev.filter(r => r.userId !== requestUserId));
};
```

### Updated Non-Admin View-Only Overlay
```typescript
{!canDraw && (
  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
    <div className="flex flex-col items-center gap-3">
      <p className="text-white text-lg">👁️ View Only</p>
      <p className="text-white text-sm">Admin hasn't granted you permission to draw</p>
      {!hasRequested && (
        <button
          onClick={handleRequestPermission}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          📝 Request Drawing Permission
        </button>
      )}
      {hasRequested && (
        <p className="text-yellow-300 text-sm">⏳ Permission request sent...</p>
      )}
    </div>
  </div>
)}
```

### Updated Admin Permissions Panel
```typescript
{isAdmin && (
  <div className="border-t p-3 bg-gray-50 max-h-48 overflow-y-auto">
    {/* Permission Requests Section */}
    {permissionRequests.length > 0 && (
      <div className="mb-4 pb-3 border-b">
        <h4 className="text-sm font-semibold mb-2 text-orange-700">
          🔔 Drawing Requests ({permissionRequests.length})
        </h4>
        <div className="space-y-2">
          {permissionRequests.map(request => (
            <div key={request.userId} className="flex items-center justify-between bg-orange-50 p-2 rounded">
              <span className="text-sm">{request.username}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => approvePermissionRequest(request.userId)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => rejectPermissionRequest(request.userId)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Current Permissions Section */}
    <div>
      <h4 className="text-sm font-semibold mb-2">✏️ Has Drawing Permission</h4>
      <div className="flex flex-wrap gap-2">
        {participants.filter(id => id !== userId).map(participantId => (
          <button
            key={participantId}
            onClick={() => toggleUserPermission(participantId)}
            className={`px-3 py-1 text-sm rounded transition ${
              permissions.allowedUsers.includes(participantId)
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
            title={permissions.allowedUsers.includes(participantId) ? 'Click to revoke' : 'Click to grant'}
          >
            {participantId.slice(0, 8)}... {permissions.allowedUsers.includes(participantId) ? '✅' : '🔒'}
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

---

## Backend: server.js

### New Socket Event Handlers

```javascript
// === Whiteboard Permission Request/Approval ===
socket.on('whiteboard-request-permission', ({ roomId, userId, username }) => {
  console.log(`[Whiteboard] ${username} (${userId}) requesting drawing permission in ${roomId}`);
  // Broadcast request to all admins in the room
  io.to(roomId).emit('whiteboard-permission-request', {
    userId,
    username,
    timestamp: Date.now()
  });
});

socket.on('whiteboard-permission-approve', ({ roomId, userId, approvedBy }) => {
  console.log(`[Whiteboard] Admin ${approvedBy} approved drawing for ${userId} in ${roomId}`);
  // Notify the user their request was approved
  io.to(roomId).emit('whiteboard-permission-approved', {
    userId,
    approvedBy
  });
});

socket.on('whiteboard-permission-reject', ({ roomId, userId }) => {
  console.log(`[Whiteboard] Admin rejected drawing permission for ${userId} in ${roomId}`);
  // Notify the user their request was rejected
  io.to(roomId).emit('whiteboard-permission-rejected', {
    userId
  });
});
```

---

## Data Flow Diagram

### Request Permission Flow
```
┌─────────────────────────────────────────────────────────┐
│ Student clicks "Request Drawing Permission"             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend (Whiteboard.tsx)                               │
│ handleRequestPermission()                               │
│ • setHasRequested(true)                                 │
│ • socket.emit('whiteboard-request-permission', ...)     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼ Socket.io
┌─────────────────────────────────────────────────────────┐
│ Backend (server.js)                                     │
│ socket.on('whiteboard-request-permission')              │
│ • Log request                                           │
│ • io.to(roomId).emit(...)                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼ Broadcast to room
┌─────────────────────────────────────────────────────────┐
│ All clients in room receive:                            │
│ socket.on('whiteboard-permission-request', request)     │
│                                                         │
│ Admin:                                                  │
│ • setPermissionRequests([...prev, request])             │
│ • Shows "🔔 Drawing Requests (1)" section               │
│ • [✅ Approve] [❌ Reject] buttons appear               │
│                                                         │
│ Student (requester):                                    │
│ • No action                                             │
│ • Shows "⏳ Permission request sent..."                 │
└─────────────────────────────────────────────────────────┘
```

### Approval Flow
```
┌─────────────────────────────────────────────────────────┐
│ Admin clicks ✅ Approve button                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend (Whiteboard.tsx)                               │
│ approvePermissionRequest(requestUserId)                 │
│ • Add user to allowedUsers array                        │
│ • setPermissions(newPermissions)                        │
│ • socket.emit('whiteboard-permissions-update', ...)     │
│ • socket.emit('whiteboard-permission-approve', ...)     │
│ • Remove from permissionRequests list                   │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼ Socket.io     ▼ Socket.io
    ┌─────────────┐  ┌────────────────┐
    │ permissions │  │ permission     │
    │ -update     │  │ -approve       │
    └──────┬──────┘  └────────┬───────┘
           │                  │
           ▼                  ▼
    Backend routes both to: io.to(roomId).emit()
           │                  │
           └──────┬───────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ All clients receive notifications:                      │
│ 1. 'whiteboard-permissions' - Updated permission list   │
│ 2. 'whiteboard-permission-approved' - Approval notice   │
│                                                         │
│ Student (approved):                                     │
│ • setCanDraw(true)                                      │
│ • setHasRequested(false)                                │
│ • Overlay disappears ✨                                 │
│ • Can now draw                                          │
│                                                         │
│ Admin:                                                  │
│ • Permission updated in UI                              │
│ • Request removed from pending list                     │
└─────────────────────────────────────────────────────────┘
```

---

## Type Definitions

```typescript
// Permission model
interface WhiteboardPermissions {
  adminOnly: boolean;           // Always true
  allowedUsers: string[];       // User IDs with drawing permission
}

// Permission request tracking
interface PermissionRequest {
  userId: string;               // User requesting
  username: string;             // Display name
  timestamp: number;            // When requested
}

// Draw event (unchanged)
interface DrawEvent {
  type: 'DRAW' | 'TEXT' | 'ERASE' | 'CLEAR' | 'SHAPE';
  x?: number;
  y?: number;
  prevX?: number;
  prevY?: number;
  tool?: 'pen' | 'eraser';
  color?: string;
  size?: number;
  text?: string;
  shape?: 'circle' | 'rectangle' | 'line';
  userId: string;
  timestamp: number;
}
```

---

## State Transitions

### User State Machine
```
START
  │
  ├─→ [No Request Sent] ─────────→ User clicks button
  │        │                              │
  │        │                              ▼
  │        │                       [Request Pending]
  │        │                              │
  │        │         ┌────────────────────┼────────────────────┐
  │        │         │                    │                    │
  │        │         ▼                    ▼                    ▼
  │        │     [Approved]           [Rejected]      [Timeout - retry]
  │        │         │                    │                    │
  │        └─────────┼────────────────────┼────────────────────┘
  │                  │                    │
  │                  ▼                    ▼
  ├──→ [Can Draw] ◄────► [Request Again] ────→ [Request Pending]
  │
  └──→ [Call Ended]
```

### Permission Array Updates
```
Initial:
  allowedUsers = []

After First Approval:
  allowedUsers = ["user-123"]

After Multiple Approvals:
  allowedUsers = ["user-123", "user-456", "user-789"]

After Revoking Access:
  allowedUsers = ["user-123", "user-789"]  (user-456 removed)

After Rejecting Request:
  allowedUsers = ["user-123", "user-789"]  (no change - request was pending)
```

---

## Error Handling

### Client-Side Safeguards
```typescript
// Prevent duplicate requests
const handleRequestPermission = () => {
  if (hasRequested || canDraw) return;  // Exit early
  // ...
};

// Prevent non-admins from approving
const approvePermissionRequest = (requestUserId: string) => {
  if (!isAdmin) return;  // Exit early
  // ...
};

// Defensive array filtering
socket.on('whiteboard-permission-request', (request) => {
  setPermissionRequests(prev => {
    const exists = prev.some(r => r.userId === request.userId);
    return exists ? prev : [...prev, request];  // No duplicates
  });
});
```

### Server-Side Logging
```javascript
console.log(`[Whiteboard] ${username} (${userId}) requesting in ${roomId}`);
console.log(`[Whiteboard] Admin ${approvedBy} approved ${userId} in ${roomId}`);
console.log(`[Whiteboard] Admin rejected ${userId} in ${roomId}`);
```

---

## Component Integration

### Props Passed to Whiteboard
```typescript
<Whiteboard
  roomId={roomId}           // Current call/group ID
  userId={userId}           // Current user's ID
  isAdmin={isAdmin}         // Is current user admin?
  socket={socket}           // Socket.io instance
  participants={participants}  // List of all participant IDs
/>
```

### Socket Instance Requirements
- Must be connected and authenticated
- Must be joined to the room
- Must have proper CORS configuration

---

## Testing Points

| Test | Expected | Actual |
|------|----------|--------|
| Request button appears for non-admin | ✓ | |
| Request button disabled for admin | ✓ | |
| Request button disabled when pending | ✓ | |
| Admin sees request in list | ✓ | |
| Badge count correct | ✓ | |
| Approve button works | ✓ | |
| Reject button works | ✓ | |
| User notified on approval | ✓ | |
| User notified on rejection | ✓ | |
| Drawing enabled after approval | ✓ | |
| Revoke button works | ✓ | |
| Multiple requests handled | ✓ | |
| Request removed after response | ✓ | |

---

## Performance Considerations

- ✅ **Socket.io events**: No DB queries, instant broadcasting
- ✅ **Array operations**: Small arrays (few requests, few participants)
- ✅ **Re-renders**: Minimal, only affected component updates
- ✅ **Memory**: Requests cleared after approval/rejection
- ✅ **Scalability**: Works with 5-100+ participants

---

## Future Enhancements

### Phase 2: Timeout
```typescript
// Auto-expire requests after 5 minutes
const REQUEST_TIMEOUT = 5 * 60 * 1000;

useEffect(() => {
  const timeout = setTimeout(() => {
    setPermissionRequests(prev =>
      prev.filter(r => Date.now() - r.timestamp < REQUEST_TIMEOUT)
    );
  }, REQUEST_TIMEOUT);
  
  return () => clearTimeout(timeout);
}, [permissionRequests]);
```

### Phase 3: Notifications
```typescript
// Toast notifications for events
socket.on('whiteboard-permission-approved', (data) => {
  showToast(`✅ Drawing permission approved by ${data.approvedBy}`);
});
```

### Phase 4: Persistence
```typescript
// Save requests to DB
POST /api/whiteboard-requests
{
  roomId, userId, username, timestamp
}
```

