/**
 * Game configuration fixtures (Part 2: Extended classroom games).
 * All schemas match production defaults and element renderers.
 */

export const TRIVIA_CHAMP_GAME_ELEMENT = {
  id: 'game-trivia-champ-1',
  type: 'game',
  gameType: 'trivia-champ',
  title: 'Trivia Championship',
  x: 80,
  y: 80,
  width: 640,
  height: 480,
  rounds: [
    {
      id: 'round-1',
      name: 'General Knowledge',
      questions: [
        {
          id: 'tc-q-1',
          question: 'What is the capital of France?',
          options: ['Paris', 'Rome', 'Berlin', 'Madrid'],
          correctIndex: 0,
          points: 10,
        },
      ],
    },
  ],
  lightningRound: { enabled: false, timePerQ: 10 },
  jackpotRound: { enabled: false, multiplier: 2 },
}

export const SCATTERGORIES_GAME_ELEMENT = {
  id: 'game-scattergories-1',
  type: 'game',
  gameType: 'scattergories',
  title: 'Quick Scattergories',
  x: 80,
  y: 80,
  width: 640,
  height: 480,
  timePerRound: 60,
  letterMode: 'random',
  categories: ['Countries', 'Animals', 'Fruits', 'Colors'],
  scoring: 'unique',
}

export const POLL_GAME_ELEMENT = {
  id: 'game-poll-1',
  type: 'game',
  gameType: 'poll',
  title: 'Classroom Opinion Poll',
  x: 80,
  y: 80,
  width: 440,
  height: 380,
  prompt: 'Which topic should we review first?',
  options: [
    { id: 'poll-opt-1', text: 'Mechanics' },
    { id: 'poll-opt-2', text: 'Thermodynamics' },
    { id: 'poll-opt-3', text: 'Electromagnetism' },
  ],
  showResults: true,
  allowVoteChange: true,
  timerDuration: 30,
}

export const WORD_CLOUD_GAME_ELEMENT = {
  id: 'game-word-cloud-1',
  type: 'game',
  gameType: 'word-cloud',
  title: 'Lesson Brainstorm',
  x: 540,
  y: 80,
  width: 440,
  height: 380,
  prompt: 'Share one key takeaway from today',
  maxPhraseLength: 40,
  maxSubmissionsPerPlayer: 3,
  displayLimit: 30,
  timerDuration: 30,
}

export const MATCHING_GAME_ELEMENT = {
  id: 'game-matching-1',
  type: 'game',
  gameType: 'matching',
  title: 'Vocabulary Matching',
  x: 80,
  y: 80,
  width: 640,
  height: 480,
  prompt: 'Match each term to its definition',
  pairs: [
    {
      promptId: 'p-1',
      prompt: 'Photosynthesis',
      targetId: 't-1',
      target: 'Process by which plants convert light into chemical energy',
    },
    {
      promptId: 'p-2',
      prompt: 'Respiration',
      targetId: 't-2',
      target: 'Process by which cells convert nutrients into ATP energy',
    },
  ],
  timerDuration: 60,
}
