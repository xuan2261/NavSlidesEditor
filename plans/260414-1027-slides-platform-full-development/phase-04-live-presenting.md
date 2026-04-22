# Phase 4 — Live Presenting & Remote Control

## Overview

- **Priority**: P2
- **Status**: ⬜ Pending
- **Effort**: 3-4 tuần
- **Dependencies**: Phase 0 (Foundation), Phase 2 (Editor features)
- **Mục tiêu**: Real-time presentation broadcasting + remote control + laser pointer

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Presenter   │         │    Server    │         │   Viewer(s)  │
│  (Desktop)   │ ──ws──→ │  Socket.IO   │ ──ws──→ │  (Browser)   │
│              │         │  Hub         │         │              │
│  Controls:   │         │  Rooms:      │         │  Display:    │
│  - Navigate  │         │  - per-pres  │         │  - Slides    │
│  - Annotate  │         │  - state     │         │  - Cursor    │
│  - Cursor    │         │  - sync      │         │  - Drawings  │
└──────────────┘         └──────────────┘         └──────────────┘
        │                                                │
        ▼                                                ▼
┌──────────────┐                              ┌──────────────┐
│ Remote Ctrl  │                              │ Optional:    │
│ (Phone/Tab)  │                              │ Speaker View │
│ via /remote  │                              │ /speaker     │
└──────────────┘                              └──────────────┘
```

## Implementation

### 4.1 Socket.IO Server Setup

**Install**: `npm install socket.io` (server) + `socket.io-client` (client)

```javascript
// server/index.js — add Socket.IO
const { Server } = require('socket.io')
const http = require('http')

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' },
  path: '/ws',
})

// Room = presentationId
// Roles: presenter (1 per room), viewer (many)
const rooms = new Map() // roomId → { presenterId, state }

io.on('connection', (socket) => {
  // Join presentation room
  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId)
    socket.data.roomId = roomId
    socket.data.role = role

    if (role === 'presenter') {
      rooms.set(roomId, { presenterId: socket.id, state: { slideIndex: 0 } })
    } else {
      // Send current state to new viewer
      const room = rooms.get(roomId)
      if (room) socket.emit('sync-state', room.state)
    }
  })

  // Presenter navigates
  socket.on('navigate', ({ slideIndex, fragmentIndex }) => {
    const room = rooms.get(socket.data.roomId)
    if (!room || room.presenterId !== socket.id) return
    room.state = { ...room.state, slideIndex, fragmentIndex }
    socket.to(socket.data.roomId).emit('navigate', { slideIndex, fragmentIndex })
  })

  // Presenter moves cursor
  socket.on('cursor-move', ({ x, y }) => {
    socket.to(socket.data.roomId).emit('cursor-move', { x, y })
  })

  // Presenter draws annotation
  socket.on('annotation', ({ type, data }) => {
    socket.to(socket.data.roomId).emit('annotation', { type, data })
  })

  // Presenter sends laser pointer
  socket.on('laser', ({ x, y, active }) => {
    socket.to(socket.data.roomId).emit('laser', { x, y, active })
  })

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomId)
    if (room?.presenterId === socket.id) {
      rooms.delete(socket.data.roomId)
      io.to(socket.data.roomId).emit('presenter-left')
    }
  })
})

server.listen(PORT) // Replace app.listen
```

### 4.2 Live Streaming (Presenter → Viewers)

**Presenter Side:**

- Button "Present Live" in toolbar → opens present mode + starts Socket.IO room
- Room code = short 6-char alphanumeric (for easy sharing)
- QR code display for room URL
- Viewer count indicator

**Viewer Side:**

- URL: `/live/:roomCode`
- Auto-connects to Socket.IO
- Receives slide changes in real-time
- Read-only reveal.js instance

```javascript
// Client: presenter hook
function useLivePresentation(presentationId) {
  const socket = io({ path: '/ws' })
  const roomCode = generateRoomCode() // 6-char

  useEffect(() => {
    socket.emit('join-room', { roomId: roomCode, role: 'presenter' })
    return () => socket.disconnect()
  }, [])

  const navigate = (slideIndex, fragmentIndex) => {
    socket.emit('navigate', { slideIndex, fragmentIndex })
  }

  return { roomCode, navigate, socket }
}
```

**Files**:

- MODIFY `server/index.js` — add Socket.IO
- NEW `server/routes/live.js` — room management API
- NEW `client/src/hooks/use-live-presentation.js`
- NEW `client/src/pages/LiveViewPage.jsx`

### 4.3 Remote Control (Phone as Controller)

**Mô tả**: Điều khiển slides từ phone/tablet.

**Implementation**:

- URL: `/remote/:roomCode`
- Mobile-optimized UI: large Next/Prev buttons, speaker notes display
- QR code shown by presenter with remote URL
- Connects to same Socket.IO room as presenter role

```
┌──────────────────────┐
│    Speaker Notes     │
│    Lorem ipsum...    │
│                      │
├──────────────────────┤
│     Slide 3 / 12     │
├──────────────────────┤
│  [← Prev]  [Next →]  │
│                      │
│  [⬤ Laser]  [✏ Draw] │
│                      │
│  Timer: 05:23        │
└──────────────────────┘
```

**Files**: NEW `client/src/pages/RemoteControlPage.jsx`

### 4.4 Live Cursor (Digital Laser Pointer)

**Mô tả**: Cursor của presenter hiện trên màn hình viewer như laser pointer.

**Implementation**:

- Presenter: mouse move → throttle 60fps → emit cursor position (% of slide)
- Viewer: render colored dot at received position
- Toggle on/off
- Cursor color customizable

```javascript
// Presenter: track cursor
const throttledCursor = throttle((e) => {
  const rect = slideElement.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  socket.emit('cursor-move', { x, y })
}, 16) // ~60fps

// Viewer: render cursor
socket.on('cursor-move', ({ x, y }) => {
  cursorDot.style.left = `${x * 100}%`
  cursorDot.style.top = `${y * 100}%`
})
```

**Files**: Present mode overlay component

### 4.5 Live Annotation (Draw + Broadcast)

**Mô tả**: Presenter vẽ trên slide, viewer thấy real-time.

**Implementation**:

- Canvas overlay trong present mode
- Drawing mode toggle (toolbar button)
- Mouse/touch → SVG path (same logic as Phase 2 freehand)
- Broadcast path data via Socket.IO
- Clear annotations button
- Color/size picker for pen

```javascript
socket.emit('annotation', {
  type: 'path',
  data: { d: 'M10,10 C20,30...', stroke: '#ff0000', strokeWidth: 3 },
})

socket.emit('annotation', { type: 'clear' })
```

**Files**: Present mode annotation overlay

### 4.6 Enhanced Speaker View

**Mô tả**: Cải tiến speaker view hiện tại.

**Implementation**:

- Current slide (large)
- Next slide preview
- Speaker notes (large, scrollable)
- Timer (elapsed + clock)
- Audience count (live viewers)
- Slide progress bar
- Quick navigation thumbnails

**Layout**:

```
┌───────────────────────────────────────────────┐
│ Slide 5/12  │  Timer: 12:34  │  Viewers: 15  │
├─────────────┼────────────────┼───────────────┤
│             │  Next Slide:   │               │
│  Current    │  [Preview]     │  Speaker      │
│  Slide      │                │  Notes        │
│  (Large)    │                │  (Scrollable) │
│             │                │               │
├─────────────┴────────────────┴───────────────┤
│ [1][2][3][4][■5][6][7][8][9][10][11][12]     │
└───────────────────────────────────────────────┘
```

**Files**: NEW `client/src/pages/SpeakerViewPage.jsx`

## Server Changes Summary

```
server/
├── index.js           ← ADD: Socket.IO setup, http.createServer
├── routes/
│   └── live.js        ← NEW: room CRUD, room code generation
├── services/
│   └── live-rooms.js  ← NEW: in-memory room state management
└── ...
```

**Dependencies to add**: `socket.io`, `socket.io-client`

## Todo List

- [ ] Install socket.io + socket.io-client
- [ ] Socket.IO server setup with room management
- [ ] Room code generation (6-char alphanumeric)
- [ ] Presenter: "Present Live" flow
- [ ] Viewer: LiveViewPage with auto-sync
- [ ] QR code display for room URL
- [ ] Remote Control mobile UI
- [ ] Cursor broadcast (throttled 60fps)
- [ ] Laser pointer toggle + rendering
- [ ] Live annotation canvas overlay
- [ ] Annotation broadcast via Socket.IO
- [ ] Enhanced speaker view layout
- [ ] Timer + viewer count
- [ ] Slide navigation thumbnails in speaker view
- [ ] Disconnect handling + presenter-left message

## Success Criteria

- [ ] Presenter starts live session, viewers join via code/QR
- [ ] Slide navigation syncs to all viewers < 100ms latency
- [ ] Remote control works on mobile browsers
- [ ] Cursor/laser pointer visible to viewers
- [ ] Annotations draw in real-time across all viewers
- [ ] Speaker view shows notes + next slide + timer
- [ ] Graceful handling when presenter disconnects
