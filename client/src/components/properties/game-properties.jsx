import React, { useState } from 'react'
import { ColorPicker } from '../ui'
import { GAME_TYPES } from '../../constants/game-element-types-constants'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

const TABS = ['Content', 'Display', 'Scoring']

export default function GameProperties({ element, onUpdate, onDelete }) {
  const [activeTab, setActiveTab] = useState('Content')
  const [editingQuestion, setEditingQuestion] = useState(null) // null = add mode, obj = edit mode
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)

  const gt = element.gameType || 'name-picker'
  const gameConfig = element[gt] || {}

  const handleUpdate = (changes) => onUpdate(changes)

  const handleGameTypeChange = (e) => {
    const newType = e.target.value
    const typeDefaults = getGameTypeDefaults(newType)
    handleUpdate({ gameType: newType, ...typeDefaults })
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
  const handleSoundToggle = (e) => handleUpdate({ showSoundEffects: e.target.checked })
  const handleTimerToggle = (e) => handleUpdate({ showTimer: e.target.checked })
  const handleLeaderboardToggle = (e) => handleUpdate({ showLeaderboard: e.target.checked })

  const handlePointsChange = (e) => handleUpdate({ pointsPerCorrect: parseInt(e.target.value, 10) || 10 })
  const handleBonusChange = (e) => handleUpdate({ bonusMultiplier: parseFloat(e.target.value) || 1 })
  const handleLeaderboardTopNChange = (e) => handleUpdate({ leaderboardTopN: parseInt(e.target.value, 10) || 5 })

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-text-muted font-semibold">Game Settings</div>
        <button
          onClick={onDelete}
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
          className="prop-input px-1.5 py-1 w-full"
        >
          {GAME_TYPES.all.map(type => (
            <option key={type} value={type}>{GAME_TYPES[type] || type}</option>
          ))}
        </select>
      </div>

      <div className="flex border-b border-border mb-2">
        {TABS.map(tab => (
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
            onUpdate={handleUpdate} onItemsChange={handleItemsChange}
            onPickerModeChange={handlePickerModeChange} onTimerChange={handleTimerChange}
            onOpenQuestionEditor={(question) => { setEditingQuestion(question); setShowQuestionEditor(true) }}
          />
        )}
        {activeTab === 'Display' && (
          <DisplayTab
            element={element} onColorChange={handleColorChange}
            onConfettiToggle={handleConfettiToggle} onSoundToggle={handleSoundToggle}
            onTimerToggle={handleTimerToggle}
          />
        )}
        {activeTab === 'Scoring' && (
          <ScoringTab
            element={element} onPointsChange={handlePointsChange}
            onBonusChange={handleBonusChange} onLeaderboardToggle={handleLeaderboardToggle}
            onLeaderboardTopNChange={handleLeaderboardTopNChange}
          />
        )}
      </div>

      <GamePropertiesQuestionEditor
        isOpen={showQuestionEditor}
        question={editingQuestion}
        onSave={(saved) => {
          const questions = [...(gameConfig.questions || [])]
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

function ContentTab({ gt, element, gameConfig, onUpdate, onItemsChange, onPickerModeChange, onTimerChange, onOpenQuestionEditor }) {
  const hasTeams = gt === 'jeopardy'
  const hasQuestions = ['hot-potato', 'jeopardy', 'relay-race', 'trivia-champ'].includes(gt)
  const hasNameList = gt === 'name-picker'

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
                  className="shrink-0 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                >
                  Edit
                </button>
                <button
                  onClick={() => onUpdate({ [gt]: { ...gameConfig, questions: gameConfig.questions.filter(x => (x.id || i) !== (q.id || i)) } })}
                  className="shrink-0 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
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
      </div>
    </div>
  )
}

function DisplayTab({ element, onColorChange, onConfettiToggle, onSoundToggle, onTimerToggle }) {
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
      <div className="space-y-1">
        {[
          ['showSoundEffects', element.showSoundEffects !== false, onSoundToggle, 'Sound effects'],
          ['showConfetti', !!element.showConfetti, onConfettiToggle, 'Confetti animation'],
          ['showTimer', element.showTimer !== false, onTimerToggle, 'Show timer'],
        ].map(([key, checked, onChange, label]) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox" checked={checked} onChange={onChange}
              className="w-3.5 h-3.5 accent-accent rounded"
            />
            <span className="text-[11px] text-text-primary">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function ScoringTab({ element, onPointsChange, onBonusChange, onLeaderboardToggle, onLeaderboardTopNChange }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Points per correct</div>
          <input
            type="number" min="1" max="100"
            value={element.pointsPerCorrect || 10}
            onChange={onPointsChange}
            className="prop-input w-full px-1.5 py-1 text-[11px]"
          />
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Bonus multiplier</div>
          <input
            type="number" min="1" max="5" step="0.5"
            value={element.bonusMultiplier || 1}
            onChange={onBonusChange}
            className="prop-input w-full px-1.5 py-1 text-[11px]"
          />
        </div>
      </div>
      <div>
        <div className="text-[11px] text-text-muted mb-0.5">
          Leaderboard: Top{' '}
          <input
            type="number" min="1" max="20"
            value={element.leaderboardTopN || 5}
            onChange={onLeaderboardTopNChange}
            className="prop-input w-10 px-1 py-0.5 text-[11px] text-center"
          />
        </div>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox" checked={element.showLeaderboard !== false}
          onChange={onLeaderboardToggle}
          className="w-3.5 h-3.5 accent-accent rounded"
        />
        <span className="text-[11px] text-text-primary">Show leaderboard</span>
      </label>
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
  }
  return d[type] || d['name-picker']
}
