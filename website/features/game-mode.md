# Game Mode

Turn any deck into an audience-interaction quiz. Game Mode reuses the slide engine to render questions while a separate Socket.IO room collects player answers.

## Roles

- **Host**: runs the deck and sees live answer counts
- **Player**: joins from `/game/join` with a room code and a nickname

## Question types

Game Mode is intentionally simple at v1:

- Multiple choice
- True / false
- Short answer

Question metadata is stored alongside the slide it's attached to, so an existing presentation can be promoted to a game without authoring a separate file.

## When to use it

- Lectures and workshops where you want quick comprehension checks
- Conference sessions where you want to surface audience opinion
- Classroom quizzes that don't need a heavyweight LMS

For richer flows (branching, scoreboards, cross-session leaderboards) reach for a hosted product. Game Mode is for the lightweight case that fits inside the same deck you're already presenting.
