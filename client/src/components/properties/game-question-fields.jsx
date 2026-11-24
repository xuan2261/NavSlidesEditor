import { createCanonicalQuestion, validateCanonicalQuestion } from 'revealjs-shared'
import {
  BooleanFields,
  ChoiceFields,
  FillBlankFields,
  OrderingFields,
} from './game-question-answer-fields'
import MatchingQuestionFields from './game-question-matching-fields'
import HotspotQuestionFields from './game-question-hotspot-fields'
import {
  MediaFields,
  NumericField,
  QuestionErrors,
  SelectField,
  TextField,
} from './game-question-controls'

const kinds = [
  ['single-choice', 'Single choice'],
  ['multi-choice', 'Multiple choice'],
  ['true-false', 'True or false'],
  ['fill-blank', 'Fill in the blank'],
  ['ordering', 'Ordering'],
  ['matching', 'Matching'],
  ['image-hotspot', 'Image hotspot'],
]

const editors = {
  'single-choice': ChoiceFields,
  'multi-choice': ChoiceFields,
  'true-false': BooleanFields,
  'fill-blank': FillBlankFields,
  ordering: OrderingFields,
  matching: MatchingQuestionFields,
  'image-hotspot': HotspotQuestionFields,
}

/** Controlled canonical question form. onChange receives a complete immutable question. */
export function QuestionFields({ value, onChange, errors = [], initialFocusRef }) {
  const validation = validateCanonicalQuestion(value)
  const fieldErrors = [
    ...new Map(
      [...validation.errors, ...errors].map((error) => [
        JSON.stringify([error.path, error.message]),
        error,
      ])
    ).values(),
  ]
  const Editor = editors[value.kind]
  const patch = (changes) => onChange({ ...value, ...changes })
  const updateMedia = (media) => {
    const next = { ...value }
    if (media) next.media = media
    else delete next.media
    onChange(next)
  }
  const changeKind = (kind) =>
    onChange(
      createCanonicalQuestion({
        kind,
        id: value.id,
        prompt: value.prompt,
        media: value.media,
        points: value.points,
        timeLimit: value.timeLimit,
        feedback: value.feedback,
      })
    )
  return (
    <QuestionErrors.Provider value={fieldErrors}>
      <div className="space-y-3">
        <SelectField label="Question kind" path={['kind']} value={value.kind} onChange={changeKind}>
          {kinds.map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Question text"
          path={['prompt']}
          multiline
          rows={3}
          value={value.prompt}
          inputRef={initialFocusRef}
          onChange={(prompt) => patch({ prompt })}
          placeholder="Enter your question…"
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-primary">
            Question image{value.kind === 'image-hotspot' ? ' (required)' : ' (optional)'}
          </legend>
          <MediaFields
            label="Question"
            path={['media']}
            media={value.media}
            onChange={updateMedia}
          />
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            label="Question points"
            path={['points']}
            min={0}
            value={value.points}
            onChange={(points) => patch({ points })}
          />
          <div className="space-y-1">
            <NumericField
              label="Question time limit in seconds"
              path={['timeLimit']}
              min={5}
              max={300}
              nullable
              value={value.timeLimit}
              onChange={(timeLimit) => patch({ timeLimit })}
            />
            <p className="text-xs text-text-muted">5–300 seconds. Leave blank for no time limit.</p>
          </div>
        </div>
        {Editor && <Editor value={value} onChange={onChange} />}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-primary">Feedback (private)</legend>
          {['correct', 'incorrect', 'explanation'].map((key) => (
            <TextField
              key={key}
              multiline
              rows={2}
              label={`${key[0].toUpperCase()}${key.slice(1)} feedback`}
              path={['feedback', key]}
              value={value.feedback?.[key]}
              onChange={(text) => patch({ feedback: { ...value.feedback, [key]: text } })}
            />
          ))}
        </fieldset>
        {fieldErrors.length > 0 && (
          <div role="alert" className="rounded border border-red-500/40 p-2 text-xs text-red-500">
            <p className="font-medium">
              Fix these fields before saving. Deleted answers must be repaired explicitly.
            </p>
            <ul className="list-disc pl-4">
              {fieldErrors.map((error, index) => (
                <li key={index}>
                  <strong>{error.path.join('.') || 'question'}</strong>: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </QuestionErrors.Provider>
  )
}

export default QuestionFields
