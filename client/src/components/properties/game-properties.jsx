import React, { useState } from 'react'
import { ColorPicker } from '../ui'
import {
  GAME_TYPES,
  GAME_TYPE_DEFAULTS,
} from '../../constants/game-element-types-constants'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

export const GAME_PROPERTY_CAPABILITIES = {
  'name-picker': { confetti: true },
  'hot-potato': { questions: true },
  jeopardy: { teams: true, timer: true, timerVisibility: true },
  'four-corners': { timer: true, timerVisibility: true },
  'relay-race': { timer: true },
  'trivia-champ': {},
  scattergories: {},
  poll: {},
  'word-cloud': {},
  matching: {},
}

const CONTROL_INPUT_CLASS =
  'w-full min-h-8 rounded-md border border-border bg-card px-2 py-1 text-xs text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25'

export function resolveGameConfig(element, gameType) {
  const defaults = GAME_TYPE_DEFAULTS[gameType] || {}
  const flat = Object.fromEntries(
    Object.keys(defaults)
      .filter((key) => element[key] !== undefined)
      .map((key) => [key, element[key]])
  )
  return { ...defaults, ...flat, ...(element[gameType] || {}) }
}

export default function GameProperties({ element, onUpdate, onDelete }) {
  const [activeTab, setActiveTab] = useState('Content')
  const [editingQuestion, setEditingQuestion] = useState(null) // null = add mode, obj = edit mode
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)

  const gt = element.gameType || 'name-picker'
  const gameConfig = resolveGameConfig(element, gt)
  const capabilities = GAME_PROPERTY_CAPABILITIES[gt] || {}
  const tabs = ['Content', 'Display']

  const handleUpdate = (changes) => {
    const subtypeChanges = changes?.[gt]
    if (subtypeChanges && typeof subtypeChanges === 'object') {
      onUpdate({ ...subtypeChanges, [gt]: subtypeChanges })
      return
    }
    onUpdate(changes)
  }

  const handleGameTypeChange = (e) => {
    const newType = e.target.value
    const typeDefaults = getGameTypeDefaults(newType)
    const persistedConfig =
      element[newType] && typeof element[newType] === 'object' ? element[newType] : {}
    const nextConfig = { ...typeDefaults, ...persistedConfig }
    setActiveTab('Content')
    onUpdate({ gameType: newType, ...nextConfig, [newType]: nextConfig })
  }

  const handleItemsChange = (e) => {
    const text = e.target.value
    const items = text.split(',').map(s => s.trim()).filter(Boolean)
    handleUpdate({ [gt]: { ...gameConfig, items } })
  }

  const handlePickerModeChange = (mode) => {
    handleUpdate({ [gt]: { ...gameConfig, pickerMode: mode } })
  }

  const handleTimerChange = (e) => {
    handleUpdate({ [gt]: { ...gameConfig, timerDuration: parseInt(e.target.value, 10) || 30 } })
  }

  const handleColorChange = (key) => (e) => handleUpdate({ [key]: e.target.value })

  const handleConfettiToggle = (e) => handleUpdate({ showConfetti: e.target.checked })
  const handleTimerToggle = (e) => handleUpdate({ showTimer: e.target.checked })
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-text-muted font-semibold">Game Settings</div>
        <button
          onClick={onDelete}
          aria-label="Delete game"
          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-400/30 hover:border-red-400 transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="mb-2">
        <div className="text-[11px] text-text-muted mb-0.5">Game Type</div>
        <select
          value={gt}
          onChange={handleGameTypeChange}
          className={`${CONTROL_INPUT_CLASS} px-1.5 py-1`}
        >
          {GAME_TYPES.all.map(type => (
            <option key={type} value={type}>{GAME_TYPES[type] || type}</option>
          ))}
        </select>
      </div>

      <div className="flex border-b border-border mb-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[11px] px-2 py-1.5 text-center transition-colors ${
              activeTab === tab
                ? 'text-accent border-b-2 border-accent font-semibold'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'Content' && (
          <ContentTab
            gt={gt} element={element} gameConfig={gameConfig}
            capabilities={capabilities}
            onUpdate={handleUpdate} onItemsChange={handleItemsChange}
            onPickerModeChange={handlePickerModeChange} onTimerChange={handleTimerChange}
            onOpenQuestionEditor={(question) => { setEditingQuestion(question); setShowQuestionEditor(true) }}
          />
        )}
        {activeTab === 'Display' && (
          <DisplayTab
            element={element} onColorChange={handleColorChange}
            capabilities={capabilities}
            onConfettiToggle={handleConfettiToggle}
            onTimerToggle={handleTimerToggle}
          />
        )}
      </div>

      <GamePropertiesQuestionEditor
        isOpen={showQuestionEditor}
        question={editingQuestion}
        onSave={(saved) => {
          const questions = Array.isArray(gameConfig.questions) ? [...gameConfig.questions] : []
          const idx = questions.findIndex(q => q.id === saved.id)
          if (idx >= 0) {
            questions[idx] = saved
          } else {
            questions.push(saved)
          }
          handleUpdate({ [gt]: { ...gameConfig, questions } })
          setShowQuestionEditor(false)
          setEditingQuestion(null)
        }}
        onCancel={() => { setShowQuestionEditor(false); setEditingQuestion(null) }}
      />
    </div>
  )
}

function ContentTab({ gt, _element, gameConfig, capabilities, onUpdate, onItemsChange, onPickerModeChange, onTimerChange, onOpenQuestionEditor }) {
  const hasTeams = capabilities.teams
  const hasQuestions = capabilities.questions
  const hasNameList = gt === 'name-picker'
  const isPoll = gt === 'poll'
  const isWordCloud = gt === 'word-cloud'
  const isMatching = gt === 'matching'

  return (
    <div className="space-y-2.5">
      {hasNameList && (
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Items (comma-separated)</div>
          <textarea
            className="w-full min-h-[60px] bg-hover border border-border text-text-primary px-2 py-1.5 rounded text-[11px] resize-y box-border"
            value={(gameConfig.items || []).join(', ')}
            onChange={onItemsChange}
            placeholder="Alice, Bob, Charlie..."
          />
        </div>
      )}

      {gt === 'name-picker' && (
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Picker Mode</div>
          <div className="flex gap-1">
            {['wheel', 'dice', 'button'].map(mode => (
              <button
                key={mode}
                onClick={() => onPickerModeChange(mode)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  (gameConfig.pickerMode || 'wheel') === mode
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-muted hover:border-border/60'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasTeams && (
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Teams</div>
          <div className="space-y-1">
            {(gameConfig.teams || []).map((team, i) => (
              <div key={team.id || i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: team.color }} />
                <span className="text-[11px] text-text-primary flex-1 truncate">{team.name}</span>
                <span className="text-[10px] text-text-muted">{team.score ?? 0} pts</span>
              </div>
            ))}
            <button
              onClick={() => {
                const newTeam = {
                  id: `team-${Date.now()}`,
                  name: `Team ${(gameConfig.teams || []).length + 1}`,
                  color: '#888888',
                  score: 0,
                }
                onUpdate({ [gt]: { ...gameConfig, teams: [...(gameConfig.teams || []), newTeam] } })
              }}
              className="text-[10px] text-accent hover:text-accent/80 px-1 py-0.5"
            >
              + Add Team
            </button>
          </div>
        </div>
      )}

      {hasQuestions && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-[11px] text-text-muted">
              Questions ({Array.isArray(gameConfig.questions) ? gameConfig.questions.length : 0})
            </div>
            <button
              onClick={() => onOpenQuestionEditor(null)}
              className="text-[10px] text-accent hover:text-accent/80 px-1.5 py-0.5 border border-accent/40 rounded hover:border-accent transition-colors"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {(Array.isArray(gameConfig.questions) ? gameConfig.questions : []).map((q, i) => (
              <div key={q.id || i} className="flex items-center gap-1.5 text-[10px] text-text-secondary bg-hover rounded px-2 py-1.5 group">
                <span className="shrink-0 text-text-muted">Q{i + 1}:</span>
                <span className="flex-1 truncate">{q.question || 'Untitled'}</span>
                <span className="shrink-0 text-text-muted">{q.points ?? 10}pt</span>
                <button
                  onClick={() => onOpenQuestionEditor(q)}
                  aria-label={`Edit question ${i + 1}`}
                  className="shrink-0 text-text-muted hover:text-accent transition-colors text-[10px]"
                >
                  Edit
                </button>
                <button
                  onClick={() => onUpdate({ [gt]: { ...gameConfig, questions: gameConfig.questions.filter(x => (x.id || i) !== (q.id || i)) } })}
                  aria-label={`Delete question ${i + 1}`}
                  className="shrink-0 text-text-muted hover:text-red-400 transition-colors text-[10px]"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPoll && (
        <div className="space-y-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Prompt</div>
            <textarea
              className="w-full min-h-[56px] bg-hover border border-border text-text-primary px-2 py-1.5 rounded text-[11px] resize-y box-border"
              value={gameConfig.prompt || ''}
              onChange={(e) => onUpdate({ [gt]: { ...gameConfig, prompt: e.target.value } })}
              placeholder="Ask a quick class poll..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-[11px] text-text-muted">Options</div>
              <button
                onClick={() => {
                  const options = Array.isArray(gameConfig.options) ? gameConfig.options : []
                  if (options.length >= 6) return
                  onUpdate({
                    [gt]: {
                      ...gameConfig,
                      options: [
                        ...options,
                        { id: `option-${Date.now()}`, text: `Option ${options.length + 1}` },
                      ],
                    },
                  })
                }}
                disabled={(gameConfig.options || []).length >= 6}
                className="text-[10px] text-accent hover:text-accent/80 disabled:text-text-muted px-1.5 py-0.5 border border-accent/40 rounded disabled:border-border"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1">
              {(gameConfig.options || []).map((option, i) => (
                <div key={option.id || i} className="flex gap-1">
                  <input
                    className={`${CONTROL_INPUT_CLASS} flex-1 px-1.5 py-1 text-[11px]`}
                    value={option.text || ''}
                    onChange={(e) => {
                      const options = [...(gameConfig.options || [])]
                      options[i] = { ...option, text: e.target.value }
                      onUpdate({ [gt]: { ...gameConfig, options } })
                    }}
                    placeholder={`Option ${i + 1}`}
                  />
                  <button
                    onClick={() => {
                      const options = (gameConfig.options || []).filter((_, idx) => idx !== i)
                      if (options.length < 2) return
                      onUpdate({ [gt]: { ...gameConfig, options } })
                    }}
                    disabled={(gameConfig.options || []).length <= 2}
                    className="text-[10px] text-text-muted hover:text-red-400 disabled:opacity-40 px-1"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-text-muted mt-1">Use 2–6 options. Votes are live aggregates only.</div>
          </div>
        </div>
      )}

      {isWordCloud && (
        <div className="space-y-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Prompt</div>
            <textarea
              className="w-full min-h-[56px] bg-hover border border-border text-text-primary px-2 py-1.5 rounded text-[11px] resize-y box-border"
              value={gameConfig.prompt || ''}
              onChange={(e) => onUpdate({ [gt]: { ...gameConfig, prompt: e.target.value } })}
              placeholder="Ask for words or short phrases..."
            />
          </div>
          <div className="rounded border border-border bg-hover px-2 py-1.5 text-[10px] text-text-muted">
            Submissions are limited to {gameConfig.maxPhraseLength || 40} characters and{' '}
            {gameConfig.maxSubmissionsPerPlayer || 5} entries per player.
          </div>
        </div>
      )}

      {isMatching && (
        <div className="space-y-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Prompt</div>
            <textarea
              className="w-full min-h-[56px] bg-hover border border-border text-text-primary px-2 py-1.5 rounded text-[11px] resize-y box-border"
              value={gameConfig.prompt || ''}
              onChange={(e) => onUpdate({ [gt]: { ...gameConfig, prompt: e.target.value } })}
              placeholder="Ask learners to match items..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-[11px] text-text-muted">Pairs</div>
              <button
                onClick={() => {
                  const pairs = Array.isArray(gameConfig.pairs) ? gameConfig.pairs : []
                  if (pairs.length >= 8) return
                  const n = pairs.length + 1
                  onUpdate({
                    [gt]: {
                      ...gameConfig,
                      pairs: [
                        ...pairs,
                        {
                          promptId: `prompt-${Date.now()}`,
                          prompt: `Term ${n}`,
                          targetId: `target-${Date.now()}`,
                          target: `Definition ${n}`,
                        },
                      ],
                    },
                  })
                }}
                disabled={(gameConfig.pairs || []).length >= 8}
                className="text-[10px] text-accent hover:text-accent/80 disabled:text-text-muted px-1.5 py-0.5 border border-accent/40 rounded disabled:border-border"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1">
              {(gameConfig.pairs || []).map((pair, i) => (
                <div key={pair.promptId || i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                  <input
                    aria-label={`Pair ${i + 1} prompt`}
                    className={`${CONTROL_INPUT_CLASS} px-1.5 py-1 text-[11px]`}
                    value={pair.prompt || ''}
                    onChange={(e) => {
                      const pairs = [...(gameConfig.pairs || [])]
                      pairs[i] = { ...pair, prompt: e.target.value }
                      onUpdate({ [gt]: { ...gameConfig, pairs } })
                    }}
                    placeholder={`Term ${i + 1}`}
                  />
                  <input
                    aria-label={`Pair ${i + 1} target`}
                    className={`${CONTROL_INPUT_CLASS} px-1.5 py-1 text-[11px]`}
                    value={pair.target || ''}
                    onChange={(e) => {
                      const pairs = [...(gameConfig.pairs || [])]
                      pairs[i] = { ...pair, target: e.target.value }
                      onUpdate({ [gt]: { ...gameConfig, pairs } })
                    }}
                    placeholder={`Definition ${i + 1}`}
                  />
                  <button
                    onClick={() => {
                      const pairs = (gameConfig.pairs || []).filter((_, idx) => idx !== i)
                      if (pairs.length < 2) return
                      onUpdate({ [gt]: { ...gameConfig, pairs } })
                    }}
                    disabled={(gameConfig.pairs || []).length <= 2}
                    className="text-[10px] text-text-muted hover:text-red-400 disabled:opacity-40 px-1"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-text-muted mt-1">Use 2–8 pairs. Players submit IDs only.</div>
          </div>
        </div>
      )}

      {capabilities.timer && <div>
        <div className="text-[11px] text-text-muted mb-0.5">
          Timer: <span className="text-text-primary font-medium">{gameConfig.timerDuration || 30}s</span>
        </div>
        <input
          type="range" min="5" max="120" step="5"
          value={gameConfig.timerDuration || 30}
          onChange={onTimerChange}
          className="w-full h-1.5 bg-border rounded appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
          <span>5s</span><span>120s</span>
        </div>
      </div>}
    </div>
  )
}

function DisplayTab({ element, capabilities, onColorChange, onConfettiToggle, onTimerToggle }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Background</div>
          <ColorPicker
            value={element.backgroundColor || '#1a1a2e'}
            onChange={onColorChange('backgroundColor')}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Accent</div>
          <ColorPicker
            value={element.accentColor || '#6366f1'}
            onChange={onColorChange('accentColor')}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
      </div>
      {(capabilities.confetti || capabilities.timerVisibility) && <div className="space-y-1">
        {[
          capabilities.confetti && ['showConfetti', element.showConfetti !== false, onConfettiToggle, 'Confetti animation'],
          capabilities.timerVisibility && ['showTimer', element.showTimer !== false, onTimerToggle, 'Show timer'],
        ].filter(Boolean).map(([key, checked, onChange, label]) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox" checked={checked} onChange={onChange}
              className="w-3.5 h-3.5 accent-accent rounded"
            />
            <span className="text-[11px] text-text-primary">{label}</span>
          </label>
        ))}
      </div>}
    </div>
  )
}

function getGameTypeDefaults(type) {
  const d = {
    'name-picker': { pickerMode: 'wheel', items: ['Học sinh 1','Học sinh 2','Học sinh 3','Học sinh 4','Học sinh 5','Học sinh 6','Học sinh 7','Học sinh 8'], wheelSegments: 8, excludeAfterPick: true, animationDuration: 2500, timerDuration: 30 },
    'hot-potato': { title: 'Hot Potato Quiz', questions: [], currentQuestion: 0, allowLate: false, showLeaderboard: true, shuffleQuestions: false, timerDuration: 30 },
    'jeopardy': { title: 'Jeopardy', teams: [], categories: [], questions: {}, dailyDouble: [], timerDuration: 30 },
    'four-corners': { cornerCount: 4, eliminateMode: 'wrong', showTimer: true, timerDuration: 30 },
    'relay-race': { questionsPerRound: 4, shuffleTeams: true, passOnWrong: true, timerDuration: 30 },
    'trivia-champ': { rounds: [], lightningRound: { enabled: false, timePerQ: 10 }, jackpotRound: { enabled: false, multiplier: 2 }, timerDuration: 30 },
    'scattergories': { timePerRound: 60, letterMode: 'random', categories: [], scoring: 'unique', timerDuration: 30 },
    'poll': {
      title: 'Live Poll',
      prompt: 'What do you think?',
      options: [
        { id: 'option-a', text: 'Option A' },
        { id: 'option-b', text: 'Option B' },
      ],
      showResults: true,
      allowVoteChange: true,
      timerDuration: 30,
    },
    'word-cloud': {
      title: 'Word Cloud',
      prompt: 'Share one word or short phrase',
      maxPhraseLength: 40,
      maxSubmissionsPerPlayer: 5,
      displayLimit: 50,
      timerDuration: 30,
    },
    'matching': {
      title: 'Matching',
      prompt: 'Match each item to its answer',
      pairs: [
        { promptId: 'prompt-1', prompt: 'Term 1', targetId: 'target-1', target: 'Definition 1' },
        { promptId: 'prompt-2', prompt: 'Term 2', targetId: 'target-2', target: 'Definition 2' },
      ],
      timerDuration: 60,
    },
  }
  return d[type] || d['name-picker']
}
