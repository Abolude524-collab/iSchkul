# 🔐 Whiteboard Permission Request Workflow

## Overview

**Whiteboard access control** now uses a **request-approval model** to ensure orderly collaborative sessions:

1. **Call Initiator** (Admin/Teacher) starts with drawing access by default
2. **Other Participants** (Students) join as view-only
3. **Students Request** drawing permission with a single button click
4. **Teacher Reviews** all pending requests in one place
5. **Teacher Approves** or **Rejects** each request
6. **Approved Students** can immediately start drawing

---

## 📋 Permission States

### Non-Admin Users (Default: View-Only)

```
┌─────────────────────────────────────┐
│     Whiteboard Canvas (View-Only)   │
│                                     │
│  [Drawing happens here...]          │
│                                     │
│  👁️ View Only Overlay:              │
│  "Admin hasn't granted permission"  │
│                                     │
│  [📝 Request Drawing Permission] ← Button to request
│                                     │
└─────────────────────────────────────┘
```

#### States:
- **No Request Sent**: Shows blue "📝 Request Drawing Permission" button
- **Request Pending**: Shows yellow "⏳ Permission request sent..." message
- **Approved**: Overlay disappears, user can draw (full access)
- **Rejected**: Shows overlay again, can click button to retry

### Admin Users (Default: Can Draw)

```
┌─────────────────────────────────────┐
│   Whiteboard Canvas (Admin Drawing) │
│                                     │
│  Tools: ✏️ Pen | 🧹 Eraser          │
│  Color: [██] Size: 2px              │
│  [🗑️ Clear Board]                   │
│                                     │
├─────────────────────────────────────┤
│ 🔔 Drawing Requests (3)             │ ← Badge shows count
├─────────────────────────────────────┤
│ • Jane Smith                         │
│   [✅ Approve] [❌ Reject]           │
│                                     │
│ • John Lee                          │
│   [✅ Approve] [❌ Reject]           │
│                                     │
│ • Maria Garcia                      │
│   [✅ Approve] [❌ Reject]           │
│                                     │
├─────────────────────────────────────┤
│ ✏️ Has Drawing Permission           │
│ • Jane...  ✅  [Click to revoke]    │
│ • John...  🔒  [Click to grant]     │
│ • Maria... ✅  [Click to revoke]    │
│                                     │
└─────────────────────────────────────┘
```

#### Controls:
- **Drawing Tools**: Full pen/eraser/color/size controls
- **Requests Section**: Lists pending approval requests
  - ✅ Approve: Grants access immediately (updates permissions + notifies user)
  - ❌ Reject: Denies access (user can request again)
- **Permissions Section**: Shows all users with current access
  - Green buttons (✅): Has access - click to revoke
  - Gray buttons (🔒): No access - click to grant

---

## 🔄 Workflow Sequence

### User Requests Permission

```
Step 1: Student sees whiteboard in view-only mode
        ↓
        Clicks "📝 Request Drawing Permission"
        ↓
Step 2: Button changes to "⏳ Permission request sent..."
        ↓
        Event emitted: whiteboard-request-permission
        ├─ Socket emit with: { roomId, userId, username }
        ├─ Sent to server
        └─ Broadcast to all admins in room
        ↓
Step 3: Student waits for approval (can't request again until answered)
```

### Admin Reviews & Approves

```
Step 1: Admin sees 🔔 badge with pending requests count
        ↓
        Red/orange section appears: "🔔 Drawing Requests (N)"
        ↓
Step 2: Admin reviews request with user info
        ↓
        Clicks ✅ Approve OR ❌ Reject
        ↓
Step 3: If Approve:
        ├─ Event: whiteboard-permissions-update
        ├─ Event: whiteboard-permission-approve
        ├─ Request removed from admin's list
        ├─ User added to allowedUsers array
        └─ Student notified: overlay disappears, can draw
        
        If Reject:
        ├─ Event: whiteboard-permission-reject
        ├─ Request removed from admin's list
        └─ Student notified: can request again
```

### Student Approved - Can Draw

```
After approval:

Before:
┌─────────────────────────────────────┐
│   [View-Only Overlay]               │
│   "Admin hasn't granted permission" │
└─────────────────────────────────────┘

After:
┌─────────────────────────────────────┐
│  ✏️ Pen | 🧹 Eraser                 │
│  [Color Picker] Size: 2px           │
│                                     │
│  Drawing surface (fully interactive)│
│  [Any drawing syncs to all]         │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔌 Socket Events

### Student Initiates Request

```javascript
// Client-side (Whiteboard.tsx)
socket.emit('whiteboard-request-permission', {
  roomId: "room123",
  userId: "user-abc123",
  username: "Student Name"
});
```

### Server Broadcasts Request

```javascript
// Backend (server.js)
socket.on('whiteboard-request-permission', ({ roomId, userId, username }) => {
  // Log for debugging
  console.log(`[Whiteboard] ${username} requesting in ${roomId}`);
  
  // Broadcast to ALL users in room
  io.to(roomId).emit('whiteboard-permission-request', {
    userId,
    username,
    timestamp: Date.now()
  });
});
```

### Admin Approves

```javascript
// Client-side (Whiteboard.tsx)
socket.emit('whiteboard-permission-approve', {
  roomId: "room123",
  userId: "user-abc123",      // Who to approve
  approvedBy: "teacher-xyz"   // Who approved
});
```

### Server Notifies All

```javascript
// Backend (server.js)
socket.on('whiteboard-permission-approve', ({ roomId, userId, approvedBy }) => {
  console.log(`Admin ${approvedBy} approved ${userId}`);
  
  // Notify approved student AND all participants
  io.to(roomId).emit('whiteboard-permission-approved', {
    userId,
    approvedBy
  });
});
```

### Student Receives Approval

```javascript
// Client-side (Whiteboard.tsx)
socket.on('whiteboard-permission-approved', (data: { userId: string; approvedBy: string }) => {
  if (data.userId === userId) {
    // This is me!
    setCanDraw(true);        // Enable drawing
    setHasRequested(false);   // Clear request flag
    // Overlay automatically disappears ✨
  }
  setPermissionRequests(prev => prev.filter(r => r.userId !== data.userId));
});
```

---

## 🎯 Key Features

### For Students
✅ **Request with one click** - Simple "📝 Request Drawing Permission" button  
✅ **See request status** - "⏳ Permission request sent..." message  
✅ **Immediate access** - Overlay disappears instantly after approval  
✅ **Try again** - Can request again if rejected  

### For Teachers/Admins
✅ **Centralized requests** - All requests in one orange section  
✅ **Quick approval** - One-click ✅ or ❌ buttons  
✅ **Visibility badge** - 🔔 shows count of pending requests  
✅ **Fine-grained control** - Approve/revoke access anytime  
✅ **No spam** - Users can't request while one is pending  

### For the System
✅ **Real-time sync** - All participants see updated permissions  
✅ **Stateless requests** - No DB needed (Socket.io only)  
✅ **Graceful rejection** - Rejected users can retry  
✅ **Audit trail** - Console logs all permission changes  

---

## 🧪 Testing the Workflow

### Test Scenario 1: Approval
```
1. Open group chat with 2+ people
2. Start video call
3. Open whiteboard
4. As teacher: See student in "Requests" section
5. As student: See "Request Drawing Permission" button
6. Student clicks button
7. Teacher sees request appear with ✅ button
8. Teacher clicks ✅ Approve
9. Student's overlay disappears → can draw
10. Both see live drawing sync
✅ PASS
```

### Test Scenario 2: Rejection
```
1. Student requests permission
2. Teacher sees request
3. Teacher clicks ❌ Reject
4. Student still sees view-only overlay
5. Student can click button again to retry
✅ PASS
```

### Test Scenario 3: Revoke Access
```
1. Grant permission to student (approve request)
2. Student is drawing
3. Teacher clicks green button in "Has Drawing Permission"
4. Access revoked
5. Student's next draw attempt has no effect
6. Student sees view-only overlay again
✅ PASS
```

### Test Scenario 4: Multiple Requests
```
1. Have 3+ students all request at same time
2. Teacher sees all in "Drawing Requests" section
3. Count badge shows "🔔 Drawing Requests (3)"
4. Teacher can approve/reject each independently
✅ PASS
```

---

## 📊 State Management

### Frontend State (Whiteboard.tsx)

```typescript
// Permission system state
const [permissions, setPermissions] = useState<WhiteboardPermissions>({
  adminOnly: true,              // Start in admin-only mode
  allowedUsers: []              // Empty list initially
});

// Request tracking
const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
const [hasRequested, setHasRequested] = useState(false);

// Drawing ability
const [canDraw, setCanDraw] = useState(isAdmin);  // Admin can draw by default
```

### Socket Event Handlers

```typescript
// When receiving updated permissions
socket.on('whiteboard-permissions', (perms: WhiteboardPermissions) => {
  setPermissions(perms);
  setCanDraw(isAdmin || perms.allowedUsers.includes(userId));
});

// When user request arrives
socket.on('whiteboard-permission-request', (request: PermissionRequest) => {
  setPermissionRequests(prev => [...prev, request]); // Add to list
});

// When user approved
socket.on('whiteboard-permission-approved', (data) => {
  if (data.userId === userId) {
    setCanDraw(true);      // Enable drawing
    setHasRequested(false); // Clear flag
  }
  setPermissionRequests(prev => prev.filter(r => r.userId !== data.userId));
});

// When user rejected
socket.on('whiteboard-permission-rejected', (data) => {
  if (data.userId === userId) {
    setHasRequested(false); // Allow retry
  }
  setPermissionRequests(prev => prev.filter(r => r.userId !== data.userId));
});
```

---

## 🚀 How It Was Implemented

### Frontend Changes (Whiteboard.tsx)

1. **Added permission request state**:
   - `permissionRequests[]` - Tracks pending requests
   - `hasRequested` - Prevents duplicate requests

2. **Added request function**:
   ```typescript
   const handleRequestPermission = () => {
     if (hasRequested || canDraw) return; // Can't spam
     setHasRequested(true);
     socket.emit('whiteboard-request-permission', { roomId, userId, username });
   };
   ```

3. **Enhanced view-only overlay**:
   - Shows "📝 Request Drawing Permission" button for non-admins
   - Shows "⏳ Permission request sent..." while waiting
   - Automatically updates when approved

4. **Enhanced admin panel**:
   - Added "🔔 Drawing Requests" section at top with count badge
   - Shows pending requests with username and ✅/❌ buttons
   - Existing "✏️ Has Drawing Permission" section below

5. **Added approval/rejection functions**:
   ```typescript
   const approvePermissionRequest = (requestUserId: string) => { ... };
   const rejectPermissionRequest = (requestUserId: string) => { ... };
   ```

### Backend Changes (server.js)

Added 4 new Socket.io handlers:

```javascript
// Student sends request
socket.on('whiteboard-request-permission', ({ roomId, userId, username }) => {
  io.to(roomId).emit('whiteboard-permission-request', { userId, username, timestamp });
});

// Admin approves
socket.on('whiteboard-permission-approve', ({ roomId, userId, approvedBy }) => {
  io.to(roomId).emit('whiteboard-permission-approved', { userId, approvedBy });
});

// Admin rejects  
socket.on('whiteboard-permission-reject', ({ roomId, userId }) => {
  io.to(roomId).emit('whiteboard-permission-rejected', { userId });
});
```

---

## 🎓 Example Teaching Scenario

**Math Class - Interactive Problem Solving**

```
1. Teacher (Admin) starts group video call
2. Students join the call
3. Teacher opens whiteboard
4. Students see whiteboard in view-only mode
5. Teacher explains problem step-by-step, drawing on board

6. Teacher says: "Now you solve it!"
7. Multiple students see "Request Drawing Permission" buttons
8. Students click button to opt-in

9. Teacher sees:
   🔔 Drawing Requests (3)
   • Alice Smith    [✅] [❌]
   • Bob Johnson    [✅] [❌]
   • Carol Davis    [✅] [❌]

10. Teacher reviews each student's work capability
11. Teacher approves all three students
12. Overlay disappears for each → they can draw
13. All three collaborate on the whiteboard simultaneously
14. Teacher can revoke access if someone gets off-task

Result: Controlled, orderly collaboration with teacher oversight ✨
```

---

## 🔧 Configuration Options (Future)

Could add these settings:

```typescript
// Whiteboard permission model
enum PermissionModel {
  ADMIN_ONLY = "admin-only",              // Current: Only admin draws
  REQUEST_APPROVE = "request-approval",   // Current: Request + approve
  OPEN = "open",                           // Future: Everyone can draw by default
  RAISE_HAND = "raise-hand",              // Future: Request by hand raise
  TIMED_ACCESS = "timed-access"           // Future: Auto-revoke after time
}
```

---

## ✅ Summary

The whiteboard now supports:

- **View-Only by Default** - Safe, controlled collaboration
- **Request-Based Access** - Students opt-in to contribute
- **Admin Approval** - Teacher reviews each request
- **Real-Time Updates** - Instant access when approved
- **Easy Revocation** - Teacher can disable access anytime
- **Multiple Requests** - Handle many students at once
- **Visual Feedback** - Request status always clear

This creates a **safe, structured collaboration environment** perfect for educational settings where the instructor needs to maintain control while enabling student participation.

