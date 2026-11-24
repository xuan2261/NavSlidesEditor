const { contentItem, independentItems, questionContent } = require('./static-question-content.js')
const { validateCrosswordLayout } = require('./crossword-layout.js')
const { generateWordSearch } = require('./word-search-generator.js')

function buildStaticGameContent(gameType, config, { teacherReveal = false } = {}) {
  const reveal = teacherReveal === true
  const sections = []
  let board
  const add = (label, items, solution = false) =>
    sections.push({ label, items: items.map(contentItem), ...(solution ? { solution: true } : {}) })
  const questions = (source) =>
    source.forEach((question) => sections.push(...questionContent(question, reveal)))
  switch (gameType) {
    case 'name-picker':
    case 'lucky-wheel':
      add(
        'Items',
        config.items.map((item) => item.label)
      )
      break
    case 'hot-potato':
    case 'four-corners':
    case 'relay-race':
    case 'quiz':
      questions(config.questions)
      break
    case 'trivia-champ':
      config.rounds.forEach((round) => {
        add(round.name, [])
        questions(
          round.questionIds.map((id) => config.questions.find((question) => question.id === id))
        )
      })
      break
    case 'jeopardy':
      board = {
        rows: [
          config.categories.map((category) => ({ text: category.title })),
          ...Array.from(
            { length: Math.max(...config.categories.map((category) => category.questions.length)) },
            (_, row) =>
              config.categories.map((category) => {
                const question = category.questions[row]
                return question
                  ? { text: `${question.points} points\n${question.prompt}` }
                  : { text: '', blocked: true }
              })
          ),
        ],
      }
      config.categories.forEach((category) => {
        add(
          category.title,
          category.questions.map((question) => `${question.points} points`)
        )
        questions(category.questions)
      })
      break
    case 'scattergories':
      add(
        `Letter: ${config.letter}`,
        config.categories.map((category) => category.label)
      )
      break
    case 'poll':
      add(config.prompt, config.options)
      break
    case 'word-cloud':
      add(config.prompt, ['________________'])
      break
    case 'matching':
      add(config.prompt, [])
      add(
        'Prompts',
        (config.pairs || []).map((pair) => pair.prompt)
      )
      add('Targets', independentItems((config.pairs || []).map((pair) => pair.target)))
      if (reveal)
        add(
          'Matches',
          config.pairs.map((pair) => `${pair.prompt} → ${pair.target}`),
          true
        )
      break
    case 'countdown':
      add('Duration', [`${config.durationSeconds} seconds`, config.expiryMessage])
      break
    case 'scoreboard':
      add(
        'Teams',
        config.teams.map((team) => `${team.name}: ${team.initialScore}`)
      )
      break
    case 'memory':
      board = {
        cards: Array.from({ length: config.pairs.length * 2 }, (_, i) => ({ text: String(i + 1) })),
      }
      if (reveal)
        config.pairs.forEach((pair) => {
          if (pair.first.type === 'text' && pair.second.type === 'text')
            add('Match', [`${pair.first.text} → ${pair.second.text}`], true)
          else add('Match', [pair.first, pair.second], true)
        })
      break
    case 'flashcards':
      config.cards.forEach((card) => {
        add('Front', [card.front])
        if (reveal) add('Back', [card.back], true)
      })
      break
    case 'sorting':
      add('Items', independentItems(config.items))
      add(
        'Buckets',
        config.buckets.map((bucket) => bucket.label)
      )
      if (reveal)
        add(
          'Assignments',
          config.answerKey.assignments.map(
            (assignment) =>
              `${config.items.find((item) => item.id === assignment.itemId).text} → ${config.buckets.find((bucket) => bucket.id === assignment.bucketId).label}`
          ),
          true
        )
      break
    case 'crossword': {
      const puzzle = validateCrosswordLayout(config)
      const starts = new Map(
        puzzle.placements.map((entry) => [`${entry.row}:${entry.column}`, entry.number])
      )
      board = {
        rows: puzzle.grid.map((row, r) =>
          row.map((letter, c) => ({
            text: reveal ? letter || '' : '',
            blocked: letter === null,
            number: starts.get(`${r}:${c}`),
            ...(reveal && letter ? { solution: true } : {}),
          }))
        ),
      }
      for (const direction of ['across', 'down'])
        add(
          direction,
          puzzle.placements
            .filter((entry) => entry.direction === direction)
            .map((entry) => `${entry.number}. ${entry.clue}${reveal ? ` → ${entry.answer}` : ''}`),
          reveal
        )
      break
    }
    case 'word-search': {
      const puzzle = generateWordSearch(config)
      const solved = reveal
        ? new Set(
            puzzle.placements.flatMap((entry) =>
              entry.path.map((cell) => `${cell.row}:${cell.column}`)
            )
          )
        : null
      board = {
        rows: puzzle.grid.map((row, r) =>
          row.map((text, c) => ({ text, ...(solved?.has(`${r}:${c}`) ? { solution: true } : {}) }))
        ),
      }
      add(
        'Words',
        config.words.map((word) => word.text)
      )
      break
    }
    default:
      throw new Error(`Unsupported static game subtype: ${gameType}`)
  }
  return { sections, ...(board ? { board } : {}) }
}

// Compact public authored rows also serve the inert editor preview.
function staticGameContent(gameType, config) {
  // Audience projections omit private mappings; never fill them from defaults.
  if (gameType === 'memory' && !config.pairs)
    return [{ text: config.title }, { text: `${(config.cards || []).length * 2} covered cards` }]
  if (gameType === 'crossword' && config.entries?.some((entry) => entry.answer === undefined))
    return config.entries.map((entry) => ({ text: entry.clue }))
  const content = buildStaticGameContent(gameType, config)
  return content.sections.flatMap((section) => [{ text: section.label }, ...section.items])
}
module.exports = { staticGameContent, buildStaticGameContent }
