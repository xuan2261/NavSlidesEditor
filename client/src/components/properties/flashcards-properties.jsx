import React from 'react'
import { newId, OrderedList, ToggleField } from './game-authoring-fields'
import CardContentFields from './card-content-fields'

export default function FlashcardsProperties({ config, onChange }) {
  return (
    <div className="space-y-2">
      <ToggleField
        label="Shuffle on start"
        value={config.shuffleOnStart}
        onChange={(shuffleOnStart) => onChange({ shuffleOnStart })}
      />
      <p className="text-xs text-text-muted">
        Use 1–100 cards. Image faces require descriptive alt text.
      </p>
      <OrderedList
        items={config.cards}
        onChange={(cards) => onChange({ cards })}
        itemName="Card"
        addLabel="Add card"
        max={100}
        createItem={() => ({
          id: newId(),
          front: { type: 'text', text: 'Question' },
          back: { type: 'text', text: 'Answer' },
        })}
      >
        {(card, index, patch) => (
          <>
            <CardContentFields
              label={`Card ${index + 1} front`}
              value={card.front}
              onChange={(front) => patch({ front })}
            />
            <CardContentFields
              label={`Card ${index + 1} back`}
              value={card.back}
              onChange={(back) => patch({ back })}
            />
          </>
        )}
      </OrderedList>
    </div>
  )
}
