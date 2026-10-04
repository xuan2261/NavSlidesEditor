import React from 'react'
import { createCanonicalQuestion } from 'revealjs-shared'
import TriviaRounds from './game-authoring-rounds'
import {
  newId,
  NumberField,
  OrderedList,
  QuestionList,
  SelectField,
  TeamFields,
  TextField,
  ToggleField,
} from './game-authoring-fields'

export default function TeamRoundsAuthoring({ config, onChange, onEditQuestion, gameType }) {
  const questions = config.questions || []
  const hasQuestions = ['hot-potato', 'four-corners', 'relay-race', 'trivia-champ'].includes(
    gameType
  )
  const hasTeams = ['relay-race', 'trivia-champ', 'scattergories'].includes(gameType)
  const corners = gameType === 'four-corners'
  const editQuestion = (question, save) => {
    if (question || !corners) return onEditQuestion(question, save)
    const options = Array.from({ length: config.cornerCount }, (_, index) => ({
      id: newId(),
      text: `Corner ${index + 1}`,
    }))
    onEditQuestion(
      createCanonicalQuestion({ id: newId(), options, answerKey: { optionId: options[0].id } }),
      save
    )
  }
  return (
    <div className="space-y-2.5">
      {hasQuestions && (
        <QuestionList
          questions={questions}
          onChange={(questions) => onChange({ questions })}
          onEditQuestion={editQuestion}
        />
      )}
      {hasTeams && <TeamFields teams={config.teams} onChange={(teams) => onChange({ teams })} />}
      {gameType === 'hot-potato' && (
        <>
          <ToggleField
            label="Shuffle questions"
            value={config.shuffleQuestions}
            onChange={(shuffleQuestions) => onChange({ shuffleQuestions })}
          />
          <ToggleField
            label="Allow late join"
            value={config.allowLateJoin}
            onChange={(allowLateJoin) => onChange({ allowLateJoin })}
          />
          <ToggleField
            label="Show leaderboard"
            value={config.showLeaderboard}
            onChange={(showLeaderboard) => onChange({ showLeaderboard })}
          />
        </>
      )}
      {corners && (
        <>
          <NumberField
            label="Corner count"
            value={config.cornerCount}
            min={2}
            max={4}
            integer
            onChange={(cornerCount) => onChange({ cornerCount })}
          />
          <SelectField
            label="Elimination mode"
            value={config.eliminateMode}
            options={['wrong', 'none']}
            onChange={(eliminateMode) => onChange({ eliminateMode })}
          />
          {questions.map((question, index) => {
            const options = Array.isArray(question.options) ? question.options : []
            const validKey = options.some((option) => option.id === question.answerKey?.optionId)
            const invalid =
              question.kind !== 'single-choice' ||
              options.length !== config.cornerCount ||
              !validKey
            return (
              <div key={question.id} className="space-y-1">
                <SelectField
                  label={`Question ${index + 1} correct corner`}
                  value={question.answerKey?.optionId}
                  options={[
                    ...(!validKey
                      ? [
                          [
                            question.answerKey?.optionId || '',
                            'Missing correct corner — choose a corner',
                          ],
                        ]
                      : []),
                    ...options.map((option) => [option.id, option.text]),
                  ]}
                  onChange={(optionId) =>
                    onChange({
                      questions: questions.map((current) =>
                        current.id === question.id
                          ? { ...current, answerKey: { optionId } }
                          : current
                      ),
                    })
                  }
                />
                {invalid && (
                  <p role="alert" className="text-xs text-red-400">
                    Question {index + 1} must be single-choice with exactly {config.cornerCount}{' '}
                    corner options and a known correct corner ID. Edit this question to adjust
                    options and choose the correct corner before saving; the answer is not
                    reassigned automatically.
                  </p>
                )}
              </div>
            )
          })}
          <ToggleField
            label="Show timer"
            value={config.showTimer}
            onChange={(showTimer) => onChange({ showTimer })}
          />
        </>
      )}
      {gameType === 'relay-race' && (
        <>
          <NumberField
            label="Questions per round"
            value={config.questionsPerRound}
            min={1}
            max={1000}
            integer
            onChange={(questionsPerRound) => onChange({ questionsPerRound })}
          />
          <ToggleField
            label="Shuffle teams"
            value={config.shuffleTeams}
            onChange={(shuffleTeams) => onChange({ shuffleTeams })}
          />
          <ToggleField
            label="Pass on wrong answer"
            value={config.passOnWrong}
            onChange={(passOnWrong) => onChange({ passOnWrong })}
          />
        </>
      )}
      {['four-corners', 'relay-race'].includes(gameType) && (
        <NumberField
          label="Timer duration in seconds"
          value={config.timerDuration}
          min={1}
          max={86400}
          integer
          onChange={(timerDuration) => onChange({ timerDuration })}
        />
      )}
      {gameType === 'trivia-champ' && <TriviaRounds config={config} onChange={onChange} />}
      {gameType === 'scattergories' && (
        <>
          <OrderedList
            items={config.categories || []}
            onChange={(categories) => onChange({ categories })}
            itemName="Category"
            addLabel="Add category"
            createItem={() => ({
              id: newId(),
              label: `Category ${(config.categories || []).length + 1}`,
            })}
          >
            {(category, index, patch) => (
              <TextField
                label={`Category ${index + 1} label`}
                value={category.label}
                onChange={(label) => patch({ label })}
              />
            )}
          </OrderedList>
          {!config.categories?.length && (
            <p role="alert" className="text-xs text-red-400">
              Add at least one category before saving.
            </p>
          )}
          <NumberField
            label="Time per round in seconds"
            value={config.timePerRound}
            min={1}
            max={86400}
            integer
            onChange={(timePerRound) => onChange({ timePerRound })}
          />
          <SelectField
            label="Letter mode"
            value={config.letterMode}
            options={['random', 'manual']}
            onChange={(letterMode) => onChange({ letterMode })}
          />
          <TextField
            label="Manual letter"
            value={config.letter}
            maxLength={1}
            onChange={(letter) => onChange({ letter })}
          />
          <SelectField
            label="Scoring"
            value={config.scoring}
            options={['unique', 'all']}
            onChange={(scoring) => onChange({ scoring })}
          />
        </>
      )}
    </div>
  )
}
