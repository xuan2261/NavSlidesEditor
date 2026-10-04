import React from 'react'
import {
  TextField,
  NumberField,
  ToggleField,
  SelectField,
  QuestionList,
} from './game-authoring-fields.jsx'

export default function QuizProperties({ config, onChange, onEditQuestion }) {
  return (
    <div className="space-y-2">
      <TextField
        label="Quiz title"
        value={config.title}
        onChange={(title) => onChange({ title })}
      />
      <NumberField
        label="Attempt limit"
        value={config.attemptLimit ?? 1}
        min={1}
        max={10}
        integer
        onChange={(attemptLimit) => onChange({ attemptLimit })}
      />
      <ToggleField
        label="Shuffle questions"
        value={config.shuffleQuestions}
        onChange={(shuffleQuestions) => onChange({ shuffleQuestions })}
      />
      <SelectField
        label="Feedback mode"
        value={config.feedbackMode ?? 'immediate'}
        options={[
          ['immediate', 'After each attempt'],
          ['after-question', 'After the question ends'],
        ]}
        onChange={(feedbackMode) => onChange({ feedbackMode })}
      />
      <ToggleField
        label="Show score"
        value={config.showScore ?? true}
        onChange={(showScore) => onChange({ showScore })}
      />
      <p className="text-xs text-text-muted">
        Edit each question to set its points, time limit, image and feedback. Local exported quizzes
        include readable answer keys; they are not secure assessments.
      </p>
      <QuestionList
        questions={config.questions}
        onChange={(questions) => onChange({ questions })}
        onEditQuestion={onEditQuestion}
      />
    </div>
  )
}
