import React from 'react'
import {
  TextField,
  NumberField,
  SelectField,
  OrderedList,
  ValidationErrors,
  newId,
} from './game-authoring-fields'
import AuthoringMedia from './game-authoring-media'
import { validateGameConfig } from 'revealjs-shared'

export default function SortingProperties({ config, onChange }) {
  const assignments = config.answerKey?.assignments || []
  const patch = (changes) => onChange(changes)
  const changeItems = (items) => {
    const ids = new Set(items.map((item) => item.id))
    const next = assignments.filter((row) => ids.has(row.itemId))
    for (const item of items) {
      if (!next.some((row) => row.itemId === item.id))
        next.push({ itemId: item.id, bucketId: config.buckets[0]?.id || '' })
    }
    patch({ items, answerKey: { assignments: next } })
  }
  const changeBuckets = (buckets) => {
    // Removing a referenced bucket leaves an explicit empty choice, never silently regrades an item.
    const ids = new Set(buckets.map((bucket) => bucket.id))
    patch({
      buckets,
      answerKey: {
        assignments: assignments.map((row) =>
          ids.has(row.bucketId) ? row : { ...row, bucketId: '' }
        ),
      },
    })
  }
  const changeAnswer = (itemId, bucketId) =>
    patch({
      answerKey: {
        assignments: config.items.map((item) => ({
          itemId: item.id,
          bucketId:
            item.id === itemId
              ? bucketId
              : assignments.find((row) => row.itemId === item.id)?.bucketId || '',
        })),
      },
    })
  return (
    <div className="space-y-3">
      <TextField
        label="Sorting title"
        value={config.title}
        onChange={(title) => patch({ title })}
      />
      <NumberField
        label="Sorting attempt limit"
        value={config.attemptLimit}
        min={1}
        max={100}
        integer
        onChange={(attemptLimit) => patch({ attemptLimit })}
      />
      <NumberField
        label="Sorting points"
        value={config.points}
        min={0}
        max={1e9}
        onChange={(points) => patch({ points })}
      />
      <OrderedList
        items={config.buckets}
        onChange={changeBuckets}
        itemName="Bucket"
        addLabel="Add bucket"
        max={100}
        createItem={() => ({ id: newId(), label: `Bucket ${config.buckets.length + 1}` })}
      >
        {(bucket, index, update) => (
          <TextField
            label={`Bucket ${index + 1} label`}
            value={bucket.label}
            onChange={(label) => update({ label })}
          />
        )}
      </OrderedList>
      <OrderedList
        items={config.items}
        onChange={changeItems}
        itemName="Sorting item"
        addLabel="Add sorting item"
        max={1000}
        createItem={() => ({ id: newId(), text: `Item ${config.items.length + 1}` })}
      >
        {(item, index, update) => (
          <>
            <TextField
              label={`Sorting item ${index + 1} text`}
              value={item.text}
              onChange={(text) => update({ text })}
            />
            <AuthoringMedia
              label={`Sorting item ${index + 1}`}
              value={item.media}
              onChange={(media) => update({ media })}
            />
            <SelectField
              label={`Sorting item ${index + 1} correct bucket`}
              value={assignments.find((row) => row.itemId === item.id)?.bucketId || ''}
              options={[
                ['', 'Choose a bucket'],
                ...config.buckets.map((bucket) => [bucket.id, bucket.label]),
              ]}
              onChange={(bucketId) => changeAnswer(item.id, bucketId)}
            />
          </>
        )}
      </OrderedList>
      <ValidationErrors errors={validateGameConfig('sorting', config).errors} />
    </div>
  )
}
