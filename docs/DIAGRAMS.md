# 🎨 Visual Diagrams - Whiteboard Permission System

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHITEBOARD PERMISSION SYSTEM                             │
│                     (Request → Approve → Draw)                              │
└─────────────────────────────────────────────────────────────────────────────┘


SCENARIO: Group Video Call with Teacher (Admin) and Students

Step 1: Video Call Started
═════════════════════════════════════════════════════════════════════════════
┌────────────────────────────────┐  ┌────────────────────────────────────────┐
│ Teacher's Screen               │  │ Student's Screen                       │
├────────────────────────────────┤  ├────────────────────────────────────────┤
│ 📹 Video Grid                  │  │ 📹 Video Grid                         │
│ (Teacher + 3 students)         │  │ (All participants)                    │
│                                │  │                                        │
│ [📝 Whiteboard Button]         │  │ [📝 Whiteboard Button]                │
│                                │  │                                        │
└────────────────────────────────┘  └────────────────────────────────────────┘


Step 2: Whiteboard Opened
═════════════════════════════════════════════════════════════════════════════

TEACHER'S WHITEBOARD (Can Draw)          STUDENT'S WHITEBOARD (View Only)
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ Tools:                              │  │ Canvas (View Only)                  │
│ ✏️ Pen | 🧹 Eraser                  │  │                                     │
│ [Color] Size: 2px                   │  │ [Teacher's drawing appears here]    │
│ [🗑️ Clear]                          │  │                                     │
├─────────────────────────────────────┤  ├─────────────────────────────────────┤
│                                     │  │ ┌─────────────────────────────────┐ │
│ [Teacher drawing board]             │  │ │ 👁️ View Only                   │ │
│                                     │  │ │                                 │ │
│                                     │  │ │ Admin hasn't granted you        │ │
│ 🔔 Drawing Requests (0) - EMPTY     │  │ │ permission to draw              │ │
│                                     │  │ │                                 │ │
│ ✏️ Has Drawing Permission           │  │ │ [📝 Request Drawing Permission] │ │
│ • (no one has access yet)           │  │ │         ↑                       │ │
│                                     │  │ │    Student clicks               │ │
│                                     │  │ └─────────────────────────────────┘ │
└─────────────────────────────────────┘  └─────────────────────────────────────┘


Step 3: Student Requests Permission
═════════════════════════════════════════════════════════════════════════════

TIMELINE OF EVENTS

Time 0:
┌──────────────────┐
│ Student clicks:  │
│ "Request Button" │
└──────┬───────────┘
       │
       └─→ Frontend: handleRequestPermission()
           │
           ├─→ setHasRequested(true)
           │
           └─→ socket.emit('whiteboard-request-permission', {
                 roomId: 'room-123',
                 userId: 'student-456',
                 username: 'John Smith'
               })

Time 0.1ms (Socket transmit):
┌──────────────────────────────────────┐
│ Backend receives request              │
│ server.js socket handler              │
│                                       │
│ socket.on('whiteboard-request-...')   │
│ └─→ console.log('John Smith...')      │
│ └─→ io.to('room-123').emit(...)       │
└──────────────────────────────────────┘

Time 0.2ms (Broadcast):
┌──────────────────────┐  ┌──────────────────────┐
│ TEACHER receives:    │  │ STUDENT receives:    │
│                      │  │                      │
│ 'whiteboard-        │  │ 'whiteboard-        │
│  permission-request'│  │  permission-request' │
│                      │  │                      │
│ → setPermission     │  │ → No action         │
│   Requests(...)     │  │                      │
│                      │  │                      │
│ → Shows 🔔 badge    │  │ → Already waiting   │
│   with request      │  │                      │
└──────────────────────┘  └──────────────────────┘

RESULT:
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ TEACHER sees NEW:                   │  │ STUDENT sees:                       │
│                                     │  │                                     │
│ 🔔 Drawing Requests (1)             │  │ ┌───────────────────────────────┐   │
│ ┌─────────────────────────────────┐ │  │ │ ⏳ Permission request sent... │   │
│ │ • John Smith                    │ │  │ │                               │   │
│ │   [✅ Approve] [❌ Reject]      │ │  │ │ (Button disabled, waiting)    │   │
│ └─────────────────────────────────┘ │  │ └───────────────────────────────┘   │
│                                     │  │                                     │
│ ✏️ Has Drawing Permission           │  │ (Can still see teacher's drawing)  │
│ • (no one approved yet)             │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘


Step 4: Teacher Approves Request
═════════════════════════════════════════════════════════════════════════════

TEACHER ACTION: Click ✅ Approve button

┌──────────────────┐
│ Teacher clicks:  │
│ ✅ Approve       │
└──────┬───────────┘
       │
       └─→ Frontend: approvePermissionRequest('student-456')
           │
           ├─→ Add to allowedUsers: ['student-456']
           │
           ├─→ socket.emit('whiteboard-permissions-update', {
           │     roomId: 'room-123',
           │     permissions: { adminOnly: true, allowedUsers: ['student-456'] }
           │   })
           │
           ├─→ socket.emit('whiteboard-permission-approve', {
           │     roomId: 'room-123',
           │     userId: 'student-456',
           │     approvedBy: 'teacher-123'
           │   })
           │
           └─→ Remove from permissionRequests list

Backend Broadcasts (io.to('room-123')):
┌─────────────────────────────────────────────┐
│ Event 1: 'whiteboard-permissions'           │
│ {adminOnly: true, allowedUsers: [...]}      │
│                                             │
│ Event 2: 'whiteboard-permission-approved'   │
│ {userId: 'student-456', approvedBy: '...'}  │
└─────────────────────────────────────────────┘

Time 0.2ms (Students receive):
┌─────────────────────────────────────┐
│ TEACHER's update:                   │
│                                     │
│ ✏️ Has Drawing Permission           │
│ • John Smith ✅ [revoke]            │
│                                     │
│ 🔔 Drawing Requests (0) - GONE!     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ JOHN SMITH (Student) update:        │
│                                     │
│ socket.on('whiteboard-permissions'  │
│   if (userId in allowedUsers)       │
│     setCanDraw(true)                │
│                                     │
│ socket.on('whiteboard-permission-   │
│             approved')              │
│   if (data.userId === userId)       │
│     setCanDraw(true) ✨             │
│     Overlay DISAPPEARS              │
└─────────────────────────────────────┘

RESULT:
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ TEACHER's Whiteboard:               │  │ JOHN SMITH's Whiteboard:            │
│                                     │  │                                     │
│ ✏️ Pen | 🧹 Eraser | [Color]       │  │ ✏️ Pen | 🧹 Eraser | [Color]       │
│ Size: 2px | [🗑️ Clear]             │  │ Size: 2px                           │
│                                     │  │                                     │
│ [Teacher drawing]                   │  │ [Teacher's drawing + John can now   │
│                                     │  │  draw on top! Drawing syncs real-   │
│ 🔔 (No pending requests)            │  │  time to all participants]          │
│                                     │  │                                     │
│ ✏️ Has Drawing Permission           │  │ ✅ CAN NOW DRAW! No overlay!       │
│ • John Smith ✅ [revoke]            │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘


Step 5: Both Draw Together (Real-Time Sync)
═════════════════════════════════════════════════════════════════════════════

COLLABORATIVE DRAWING

┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ TEACHER:                            │  │ JOHN SMITH:                         │
│                                     │  │                                     │
│ Drawing a triangle                  │  │ Drawing a square                    │
│                                     │  │                                     │
│     /\                              │  │     /\     ┌──┐                    │
│    /  \                             │  │    /  \    │  │                    │
│   /____\                            │  │   /____\   └──┘                    │
│                                     │  │                                     │
│ (via Socket.io: 'whiteboard-draw')  │  │ (via Socket.io: 'whiteboard-draw')  │
│                                     │  │                                     │
└──────────┬───────────────────┬──────┘  └──────────┬──────────┬──────────────┘
           │                   │                   │          │
           └─────→ Backend ←───┴───────────────────┴──────────┘
                   (server.js)
                        │
            ┌───────────┴────────────┐
            │                        │
      broadcasts to all             broadcasts to all
            │                        │
    ┌──────┴──────┐          ┌──────┴──────┐
    │ Teacher     │          │ John        │
    │ receives    │          │ receives    │
    │ John's      │          │ Teacher's   │
    │ square ✅   │          │ triangle ✅ │
    │             │          │             │
    │ Sees both   │          │ Sees both   │
    │ drawings    │          │ drawings    │
    └─────────────┘          └─────────────┘


Step 6: Other Student Can Also Request
═════════════════════════════════════════════════════════════════════════════

Meanwhile, another student (Jane) sees the same workflow:

JANE'S VIEW:
┌─────────────────────────────────────┐
│ 👁️ View Only                        │
│                                     │
│ Can see Teacher and John drawing    │
│ (real-time sync of their work)      │
│                                     │
│ [📝 Request Drawing Permission]     │
│      (Jane clicks)                  │
│                        ↓            │
│ ⏳ Permission request sent...       │
│      (Waiting for approval)         │
│                                     │
└─────────────────────────────────────┘

TEACHER sees:
🔔 Drawing Requests (1)
• Jane Smith  [✅] [❌]

Can approve, reject, or ignore...


Step 7: Reject Request (Example)
═════════════════════════════════════════════════════════════════════════════

If Teacher clicks ❌ Reject for Jane:

JANE sees:
┌─────────────────────────────────────┐
│ 👁️ View Only                        │
│                                     │
│ Admin hasn't granted you permission │
│                                     │
│ [📝 Request Drawing Permission]     │
│ (Button re-enabled for retry)       │
│                                     │
└─────────────────────────────────────┘

Jane can click the button again if she wants to request again.


Step 8: Teacher Revokes Access (Example)
═════════════════════════════════════════════════════════════════════════════

If Teacher clicks green "John Smith ✅" button to revoke:

JOHN sees:
┌─────────────────────────────────────┐
│ 👁️ View Only                        │
│                                     │
│ Admin hasn't granted you permission │
│                                     │
│ [📝 Request Drawing Permission]     │
│ (Can request again)                 │
│                                     │
└─────────────────────────────────────┘

John's next drawing attempt has no effect on canvas.

```

---

## State Machine Diagrams

### User Permission States

```
START
  │
  └──→ [NO_ACCESS] ◄──────────┐
       │ (View-only)            │
       │                        │
       │ Click Request Button   │ Reject Request
       │                        │
       ▼                        │
  [PENDING] ───────────┐        │
  (⏳ request sent)    │        │
       │               │        │
       │      Timeout  │ (future)
       │      expires  │
       │               ▼
       │            [TIMEOUT]
       │               │
       └─→ Approve ───→ [CAN_DRAW] ──────────────┐
           (✅)        (Full access)              │
                            │                    │
                            │ Revoke Button      │
                            │ (or call ends)     │
                            └────→ [NO_ACCESS] ──→ Click Request...
                                   (back to start)
```

### Admin Request List States

```
NO_REQUESTS
  │
  │ User sends request
  ▼
[1_REQUEST]  ───→ Approve/Reject ───→ [0_REQUESTS]
  │
  │ Second user requests
  ▼
[2_REQUESTS] ───→ Approve first ───→ [1_REQUEST]
  │
  │ Approve second
  ▼
[0_REQUESTS]
```

### Real-Time Sync Flow

```
┌─────────────┐  Draw Event  ┌──────────────┐  Broadcast  ┌─────────────┐
│ User A      │ ────────────→│   Backend    │ ────────────→│ User B      │
│ Draws line  │ (Socket.io)  │  server.js   │ (io.to())    │ Sees line   │
│             │              │              │              │ appear      │
└─────────────┘              └──────────────┘              └─────────────┘
      │                             │                            │
      │                             │                            │
      ▼                             ▼                            ▼
  Canvas.draw()           socket.on('draw')              canvas.draw()
  (local render)          console.log()                  (remote render)
                          io.to().emit()
                          (all in room)
```

---

## Event Sequence Diagram

```
User              Frontend             Backend             Other Users
  │                 │                    │                      │
  │ Clicks Request  │                    │                      │
  ├────────────────→│                    │                      │
  │                 │ emit('request')    │                      │
  │                 ├───────────────────→│                      │
  │                 │                    │ broadcast            │
  │                 │                    ├─────────────────────→│ Teacher
  │                 │                    │ 'permission-request' │ sees request
  │                 │ (waiting...)       │                      │
  │                 │                    │                      │
  │                 │                    │ Click Approve        │
  │                 │ ◄────────────────────────────────────────│
  │                 │ emit('approve')    │                      │
  │                 ├───────────────────→│                      │
  │                 │                    │ broadcast            │
  │                 │ 'permission-       ├─────────────────────→│ All users
  │                 │  approved'         │ 'approved'           │ get event
  │ ◄───────────────┤                    │ + 'permissions'      │
  │ Can draw now!   │                    │                      │
  │ Overlay gone    │                    │                      │
  │                 │                    │                      │
  ▼                 ▼                    ▼                      ▼
```

---

## Component Hierarchy

```
VideoCall
  │
  └─→ Whiteboard
      │
      ├─→ Canvas Element
      │   ├─ Drawing tools (pen/eraser)
      │   ├─ Color picker
      │   └─ Size control
      │
      ├─→ Non-Admin View-Only Overlay (if !canDraw)
      │   ├─ Text message
      │   ├─ Request Button (if !hasRequested)
      │   └─ Pending message (if hasRequested)
      │
      └─→ Admin Control Panel (if isAdmin)
          │
          ├─→ Permissions Request List
          │   └─ For each request:
          │       ├─ Username
          │       ├─ Approve Button
          │       └─ Reject Button
          │
          └─→ Current Permissions List
              └─ For each participant:
                  ├─ Username
                  ├─ Status (Has/Denied)
                  └─ Toggle Button (grant/revoke)
```

---

## Permission Model

```
┌──────────────────────────────────┐
│ WhiteboardPermissions            │
├──────────────────────────────────┤
│ {                                │
│   adminOnly: true,               │
│   allowedUsers: [                │
│     "user-123",  ← Can draw      │
│     "user-456",  ← Can draw      │
│   ]                              │
│ }                                │
└──────────────────────────────────┘

Check if User Can Draw:
  canDraw = isAdmin || allowedUsers.includes(userId)

View Logic:
  • Admin: Always shows canvas (canDraw = true)
  • User in allowedUsers: Shows canvas (canDraw = true)
  • Other users: Shows overlay (canDraw = false)
```

---

## Socket Event Reference

```
CLIENT → SERVER → BROADCAST TO ROOM

[REQUEST PERMISSION]
  Client:   socket.emit('whiteboard-request-permission', {...})
  Server:   io.to(roomId).emit('whiteboard-permission-request', {...})
  Broadcast: All users see request appear

[APPROVE REQUEST]
  Client:   socket.emit('whiteboard-permission-approve', {...})
  Server:   io.to(roomId).emit('whiteboard-permission-approved', {...})
  Server:   io.to(roomId).emit('whiteboard-permissions', {...})
  Broadcast: User can draw + permissions updated

[REJECT REQUEST]
  Client:   socket.emit('whiteboard-permission-reject', {...})
  Server:   io.to(roomId).emit('whiteboard-permission-rejected', {...})
  Broadcast: Requester gets rejected, can request again

[PERMISSIONS UPDATE]
  Client:   socket.emit('whiteboard-permissions-update', {...})
  Server:   io.to(roomId).emit('whiteboard-permissions', {...})
  Broadcast: All get updated permission list
```

---

## Decision Tree

```
User joins whiteboard in call:
│
├─→ Is admin? 
│   │
│   YES → Can draw immediately
│         See permissions panel
│         See request list (when available)
│
│   NO  → View only
│         Can see request button?
│         │
│         YES, hasRequested = false → Show "Request" button
│         │
│         YES, hasRequested = true  → Show "⏳ Sent..." message
│         │
│         Approved by admin → canDraw = true, overlay gone ✨
```

---

**All diagrams © 2026 ischkul-azure Project**

