import React from 'react'
import { normalizeInteractionVariables, validateGameConfig } from 'revealjs-shared'
import {
  newId,
  NumberField,
  OrderedList,
  SelectField,
  TextField,
  ToggleField,
  ValidationErrors,
} from './game-authoring-fields'

export default function ScoreboardProperties({ config, onChange, variables = [] }) {
  const normalized = normalizeInteractionVariables(variables)
  const declarations = normalized.variables || [],
    teams = config.teams || []
  const errors = validateGameConfig('scoreboard', config).errors
  if (normalized.error) errors.push({ path: ['variables'], message: normalized.error })
  const unknownIds = [
    ...new Set(
      teams
        .map((team) => team.variableId)
        .filter((id) => id !== undefined && !declarations.some((variable) => variable.id === id))
    ),
  ]
  for (const id of unknownIds)
    errors.push({
      path: ['teams', 'variableId'],
      message: `Unknown deck variable: ${id}. Choose a declared variable or local score.`,
    })
  const options = [
    ['', 'Local score'],
    ...declarations.map((variable) => [variable.id, variable.name]),
    ...unknownIds.map((id) => [id, `Unavailable: ${id}`]),
  ]
  const updateBinding = (team, variableId) => {
    const identity = { ...team }
    delete identity.initialScore
    delete identity.variableId
    const next = variableId
      ? { ...identity, variableId }
      : { ...identity, initialScore: Math.min(config.maxScore, Math.max(config.minScore, 0)) }
    onChange({ teams: teams.map((item) => (item.id === team.id ? next : item)) })
  }
  return (
    <div className="space-y-2.5">
      <TextField
        label="Scoreboard title"
        value={config.title}
        onChange={(title) => onChange({ title })}
      />
      <NumberField
        label="Score step"
        value={config.step}
        min={Number.MIN_VALUE}
        max={1e9}
        onChange={(step) => onChange({ step })}
      />
      <NumberField
        label="Minimum score"
        value={config.minScore}
        min={-1e9}
        max={1e9}
        onChange={(minScore) => onChange({ minScore })}
      />
      <NumberField
        label="Maximum score"
        value={config.maxScore}
        min={-1e9}
        max={1e9}
        onChange={(maxScore) => onChange({ maxScore })}
      />
      <OrderedList
        items={teams}
        onChange={(teams) => onChange({ teams })}
        itemName="Team"
        addLabel="Add team"
        max={100}
        createItem={() => ({
          id: newId(),
          name: `Team ${teams.length + 1}`,
          color: '#6366f1',
          initialScore: Math.min(config.maxScore, Math.max(config.minScore, 0)),
        })}
      >
        {(team, index, patch) => {
          const variable = declarations.find((item) => item.id === team.variableId)
          return (
            <>
              <TextField
                label={`Team ${index + 1} name`}
                value={team.name}
                onChange={(name) => patch({ name })}
              />
              <TextField
                label={`Team ${index + 1} color`}
                type="color"
                value={team.color}
                onChange={(color) => patch({ color })}
              />
              <SelectField
                label={`Team ${index + 1} variable`}
                value={team.variableId || ''}
                options={options}
                onChange={(id) => updateBinding(team, id)}
              />
              {team.variableId === undefined ? (
                <NumberField
                  label={`Team ${index + 1} initial score`}
                  value={team.initialScore}
                  min={config.minScore}
                  max={config.maxScore}
                  onChange={(initialScore) => patch({ initialScore })}
                />
              ) : (
                variable && (
                  <p className="text-xs text-text-muted">
                    Deck variable initial value: {variable.initialValue}; bounds: {variable.min} to{' '}
                    {variable.max}. Edit its initial value in deck variables, not here.
                  </p>
                )
              )}
            </>
          )
        }}
      </OrderedList>
      <ToggleField
        label="Reset only variables bound to this scoreboard"
        value={config.resetBoundVariables}
        onChange={(resetBoundVariables) => onChange({ resetBoundVariables })}
      />
      <p className="text-xs text-text-muted">
        Reset always restores local team initial scores.{' '}
        {config.resetBoundVariables
          ? `It also restores only bound variables: ${[...new Set(teams.map((team) => team.variableId).filter(Boolean))].join(', ') || 'none'}. Other deck variables are preserved.`
          : 'Bound deck variables are preserved.'}
      </p>
      <ValidationErrors errors={errors} />
    </div>
  )
}
