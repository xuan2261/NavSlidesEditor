# Live Presentations

NavSlides Editor ships with a built-in **live presentation mode** powered by Socket.IO. Present from one machine and let viewers follow along in their own browsers — no external service required. The presenter holds a **server-issued presenter token** so only the host can drive the deck.

## Modes

- **Live View** (`/live/:roomCode`): a read-only viewer that mirrors slide changes in real time
- **Speaker View** (`/speaker/:roomCode`): the presenter's console with notes, a next-slide preview, and a timer
- **Remote Control** (`/remote/:roomCode`): drive the deck from a phone or tablet
- **Annotations**: pen, laser pointer, highlighter, and eraser tools that sync to all viewers in real time and **persist per slide** when a viewer rejoins

## Presenter controls

- **PowerPoint-style navigation**: `F5`, `Home`, `End`, and arrow keys
- **Black / white screen overlays**: press `B` or `W` to blank the audience view
- **Shared live timer** synced between the speaker view and viewers

## Starting a session

1. Open a presentation in the editor
2. Click **Present → Live**
3. Share the generated room code or the URL with viewers

The room state lives in memory on the server (`server/services/live-rooms.js`); rooms expire when the presenter disconnects.

## Implementation notes

- Real-time transport: Socket.IO over the `/ws` namespace
- Slide-change events are broadcast to every viewer in the room
- Annotation strokes use the same socket to keep latency under one frame
