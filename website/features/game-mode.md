# Game Mode

Turn any deck into an audience-interaction activity. Game Mode reuses the slide engine to render the game while a separate Socket.IO room collects player input, tracks scoring, and shows a leaderboard.

## Game types

NavSlides ships **10 interactive game element types**:

| Game | What it does |
|---|---|
| Name picker | Wheel- or dice-style random picker (great for cold-calling) |
| Hot potato | Timed question relay with an optional leaderboard |
| Jeopardy | Team-based category board with point values |
| Four corners | Players commit to one of four answers/corners |
| Relay race | Round-based team race through a question set |
| Trivia champ | Multi-round trivia with optional lightning and jackpot rounds |
| Scattergories | Timed category brainstorm scored on unique answers |
| Live poll | Presenter-driven polls with public aggregate results |
| Word cloud | Audience responses summarized into a word cloud |
| Matching | Drag-and-drop pair matching activity |

A game is just another **element type** you insert on a slide, so an existing presentation can be promoted to a game without authoring a separate file.

## Roles

- **Host / presenter**: runs the deck and drives the game with presenter shortcuts (HUD, timer, reveal, leaderboard, pause, team select)
- **Player**: joins from a dedicated player join page with a game code and a nickname, then answers from their own device

## When to use it

- Lectures and workshops where you want quick comprehension checks
- Conference sessions where you want to surface audience opinion
- Classroom activities that don't need a heavyweight LMS

Game state and scoring are handled by a dedicated socket handler (`server/services/game-socket-handler.js`) separate from the live-presentation rooms.
