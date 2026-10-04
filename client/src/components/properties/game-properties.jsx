import { useMemo, useState } from 'react'
import {
  CANONICAL_GAME_TYPES,
  GAME_CATALOG,
  normalizeGameConfig,
  validateGameConfig,
} from 'revealjs-shared'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'
import { QuestionList } from './game-authoring-fields'
import PickerAuthoring from './game-authoring-picker'
import JeopardyAuthoring from './game-authoring-jeopardy'
import TeamRoundsAuthoring from './game-authoring-team-rounds'
import ResponsesAuthoring from './game-authoring-responses'
import GameDisplayFields from './game-display-fields'
import QuizProperties from './quiz-properties'
import LuckyWheelProperties from './lucky-wheel-properties'
import CountdownProperties from './countdown-properties'
import ScoreboardProperties from './scoreboard-properties'
import MemoryProperties from './memory-properties'
import FlashcardsProperties from './flashcards-properties'
import SortingProperties from './sorting-properties'
import WordPuzzleProperties from './word-puzzle-properties'

export default function GameProperties({ element, onUpdate, onDelete, variables = [] }) {
  const [activeTab, setActiveTab] = useState('Content')
  const [editing, setEditing] = useState(null)
  const gameType = element.gameType || 'name-picker'
  const config = useMemo(() => normalizeGameConfig(element, gameType), [element, gameType])
  const change = (partial) => onUpdate({ [gameType]: { ...config, ...partial } })
  const editQuestion = (question, save) => setEditing({ question, save })
  const props = { config, onChange: change, onEditQuestion: editQuestion, gameType, variables }
  const validation = validateGameConfig(gameType, config)
  const tabs = ['Content', 'Display']
  return (
    <div className="mb-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted font-semibold">Game Settings</span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete game"
          className="text-[10px] text-red-400"
        >
          Delete
        </button>
      </div>
      <label className="block text-[11px] text-text-muted">
        Game Type
        <select
          aria-label="Game type"
          value={gameType}
          className="w-full min-h-8 rounded border border-border bg-card text-text-primary"
          onChange={(event) => {
            const next = event.target.value
            setActiveTab('Content')
            setEditing(null)
            onUpdate({ gameType: next, [next]: normalizeGameConfig(element, next) })
          }}
        >
          {CANONICAL_GAME_TYPES.map((type) => (
            <option key={type} value={type}>
              {GAME_CATALOG[type].label}
            </option>
          ))}
        </select>
      </label>
      <div
        role="tablist"
        aria-label="Game property sections"
        className="flex border-b border-border"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
              event.preventDefault()
              const next = tabs[(tabs.indexOf(tab) + 1) % tabs.length]
              setActiveTab(next)
              event.currentTarget.parentElement
                .querySelectorAll('[role="tab"]')
                [tabs.indexOf(next)]?.focus()
            }}
            className={`flex-1 px-2 py-1.5 text-[11px] ${activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-text-muted'}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={`${activeTab} game properties`}>
        {activeTab === 'Display' ? (
          <GameDisplayFields {...props} element={element} onUpdateElement={onUpdate} />
        ) : (
          <ContentFields {...props} />
        )}
      </div>
      {!validation.isValid && (
        <ul role="alert" className="text-xs text-red-400 space-y-1">
          {validation.errors.map((error, index) => (
            <li key={index}>
              {error.path.join('.')}: {error.message}
            </li>
          ))}
        </ul>
      )}
      <GamePropertiesQuestionEditor
        isOpen={Boolean(editing)}
        question={editing?.question}
        onCancel={() => setEditing(null)}
        onSave={(question) => {
          editing.save(question)
          setEditing(null)
        }}
      />
    </div>
  )
}

function ContentFields(props) {
  const { gameType, config, onChange, onEditQuestion } = props
  switch (gameType) {
    case 'name-picker':
      return <PickerAuthoring {...props} />
    case 'jeopardy':
      return <JeopardyAuthoring {...props} />
    case 'hot-potato':
      return (
        <div className="space-y-2">
          <QuestionList
            questions={config.questions}
            onChange={(questions) => onChange({ questions })}
            onEditQuestion={onEditQuestion}
          />
          {['shuffleQuestions', 'allowLate', 'showLeaderboard'].map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                aria-label={
                  key === 'shuffleQuestions'
                    ? 'Shuffle questions'
                    : key === 'allowLate'
                      ? 'Allow late answers'
                      : 'Show leaderboard'
                }
                checked={config[key] === true}
                onChange={(event) => onChange({ [key]: event.target.checked })}
              />
              {key === 'shuffleQuestions'
                ? 'Shuffle questions'
                : key === 'allowLate'
                  ? 'Allow late answers'
                  : 'Show leaderboard'}
            </label>
          ))}
        </div>
      )
    case 'four-corners':
    case 'relay-race':
    case 'trivia-champ':
    case 'scattergories':
      return <TeamRoundsAuthoring {...props} />
    case 'poll':
    case 'word-cloud':
    case 'matching':
      return <ResponsesAuthoring {...props} />
    case 'quiz':
      return <QuizProperties {...props} />
    case 'lucky-wheel':
      return <LuckyWheelProperties {...props} />
    case 'countdown':
      return <CountdownProperties {...props} />
    case 'scoreboard':
      return <ScoreboardProperties {...props} />
    case 'memory':
      return <MemoryProperties {...props} />
    case 'flashcards':
      return <FlashcardsProperties {...props} />
    case 'sorting':
      return <SortingProperties {...props} />
    case 'crossword':
    case 'word-search':
      return <WordPuzzleProperties {...props} />
    default:
      throw new Error(`Unknown game subtype: ${gameType}`)
  }
}
