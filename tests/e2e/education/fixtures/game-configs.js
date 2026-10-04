/**
 * Game configuration fixtures (Part 1: Core classroom games).
 * All schemas match production defaults and element renderers.
 */

export const NAME_PICKER_GAME_ELEMENT = {
  id: 'game-name-picker-1',
  type: 'game',
  gameType: 'name-picker',
  title: 'Lucky Student Picker',
  x: 100,
  y: 100,
  width: 600,
  height: 400,
  accentColor: '#6366f1',
  backgroundColor: '#1a1a2e',
  items: ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan'],
  weights: [1, 2, 1, 1, 1],
  removePicked: false,
}

export const HOT_POTATO_TWO_QUESTIONS_ELEMENT = {
  id: 'game-hot-potato-1',
  type: 'game',
  gameType: 'hot-potato',
  title: 'Fast Science Trivia',
  x: 100,
  y: 100,
  width: 650,
  height: 450,
  accentColor: '#ef4444',
  backgroundColor: '#1e1b4b',
  timeLimit: 15,
  allowLate: false,
  questions: [
    {
      id: 'q-hp-1',
      question: 'What is the chemical symbol for Gold?',
      options: ['Au', 'Ag', 'Fe', 'Cu'],
      correctIndex: 0,
      points: 100,
    },
    {
      id: 'q-hp-2',
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctIndex: 1,
      points: 150,
    },
  ],
}

export const JEOPARDY_STANDARD_ELEMENT = {
  id: 'game-jeopardy-1',
  type: 'game',
  gameType: 'jeopardy',
  title: 'Classroom Jeopardy',
  x: 50,
  y: 50,
  width: 860,
  height: 520,
  accentColor: '#f59e0b',
  backgroundColor: '#0f172a',
  negativePoints: true,
  teams: [
    { id: 'team-a', name: 'Team Alpha', color: '#3b82f6', score: 0 },
    { id: 'team-b', name: 'Team Beta', color: '#10b981', score: 0 },
  ],
  categories: [
    {
      id: 'cat-history',
      name: 'World History',
      questions: [
        {
          id: 'jq-hist-100',
          points: 100,
          question: 'In which year did World War II end?',
          correctIndex: 1,
          options: ['1944', '1945', '1946', '1950'],
        },
        {
          id: 'jq-hist-200',
          points: 200,
          question: 'Who was the first President of the United States?',
          correctIndex: 1,
          options: ['Thomas Jefferson', 'George Washington', 'John Adams', 'Benjamin Franklin'],
        },
      ],
    },
    {
      id: 'cat-science',
      name: 'Physics',
      questions: [
        {
          id: 'jq-sci-100',
          points: 100,
          question: 'What particle has a negative electric charge?',
          correctIndex: 2,
          options: ['Proton', 'Neutron', 'Electron', 'Photon'],
        },
        {
          id: 'jq-sci-200',
          points: 200,
          question: 'What is the speed of light in vacuum?',
          correctIndex: 1,
          options: ['150,000 km/s', '300,000 km/s', '450,000 km/s', '3,000 km/s'],
        },
      ],
    },
  ],
}

export const FOUR_CORNERS_GAME_ELEMENT = {
  id: 'game-four-corners-1',
  type: 'game',
  gameType: 'four-corners',
  title: 'Four Corners Challenge',
  x: 80,
  y: 80,
  width: 640,
  height: 480,
  cornerCount: 4,
  eliminateMode: 'wrong',
  showTimer: true,
  timerDuration: 20,
  questions: [
    {
      id: 'q-fc-1',
      question: 'Which quadrant represents renewable solar energy?',
      correctIndex: 0,
      options: ['Corner 1: Solar', 'Corner 2: Coal', 'Corner 3: Gas', 'Corner 4: Oil'],
    },
  ],
}

export const RELAY_RACE_GAME_ELEMENT = {
  id: 'game-relay-race-1',
  type: 'game',
  gameType: 'relay-race',
  title: 'Science Relay Race',
  x: 80,
  y: 80,
  width: 640,
  height: 480,
  questionsPerRound: 2,
  shuffleTeams: true,
  passOnWrong: true,
  teams: [
    { id: 'rr-team-1', name: 'Cheetahs', color: '#f59e0b', score: 0 },
    { id: 'rr-team-2', name: 'Falcons', color: '#3b82f6', score: 0 },
  ],
  questions: [
    {
      id: 'rr-q-1',
      question: 'Water freezes at 0 degrees Celsius.',
      options: ['True', 'False'],
      correctIndex: 0,
      points: 10,
    },
    {
      id: 'rr-q-2',
      question: 'Light travels slower than sound in air.',
      options: ['True', 'False'],
      correctIndex: 1,
      points: 10,
    },
  ],
}
