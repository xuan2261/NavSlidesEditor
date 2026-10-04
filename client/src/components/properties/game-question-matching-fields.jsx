import QuestionOptionList from './game-question-option-list'
import { buttonClass, ItemSelect, moveItem, RowActions } from './game-question-controls'

export default function MatchingQuestionFields({ value, onChange }) {
  const options = value.options || { left: [], right: [] }
  const pairs = value.answerKey.pairs || []
  const setPairs = (next) => onChange({ ...value, answerKey: { pairs: next } })
  const patchPair = (index, patch) =>
    setPairs(pairs.map((pair, position) => (position === index ? { ...pair, ...patch } : pair)))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['left', 'right'].map((side) => (
          <fieldset key={side} className="space-y-2 min-w-0">
            <legend className="text-sm font-medium text-text-primary">
              {side === 'left' ? 'Left items' : 'Right items'}
            </legend>
            <QuestionOptionList
              noun={`${side} item`}
              path={['options', side]}
              options={options[side] || []}
              onChange={(items) => onChange({ ...value, options: { ...options, [side]: items } })}
            />
          </fieldset>
        ))}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Correct matching pairs (private)
        </legend>
        <p className="text-xs text-text-muted">
          Map every left item to one distinct right item. Deleting an item does not change the
          answer key; replace or remove the affected pair here.
        </p>
        {pairs.map((pair, index) => (
          <div key={index} className="rounded border border-border p-2 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ItemSelect
                label={`Pair ${index + 1} left item`}
                path={['answerKey', 'pairs', index, 'leftId']}
                value={pair.leftId}
                options={options.left || []}
                onChange={(leftId) => patchPair(index, { leftId })}
              />
              <ItemSelect
                label={`Pair ${index + 1} right item`}
                path={['answerKey', 'pairs', index, 'rightId']}
                value={pair.rightId}
                options={options.right || []}
                onChange={(rightId) => patchPair(index, { rightId })}
              />
            </div>
            <RowActions
              label={`pair ${index + 1}`}
              index={index}
              count={pairs.length}
              onMove={(offset) => setPairs(moveItem(pairs, index, offset))}
              onDelete={() => setPairs(pairs.filter((_, position) => position !== index))}
            />
          </div>
        ))}
        <button
          type="button"
          className={buttonClass}
          onClick={() => setPairs([...pairs, { leftId: '', rightId: '' }])}
        >
          Add correct pair
        </button>
      </fieldset>
    </div>
  )
}
