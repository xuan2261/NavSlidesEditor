import { expect } from '@playwright/test'
import { acceptedAt, sameRoom, stateAt } from './education-release-authority.js'
const normalize = (text) => text.trim().normalize('NFC').toLowerCase().normalize('NFC')
export function scatterReveal(authority, envelope) {
  const records = acceptedAt(authority, envelope),
    answers = {},
    validity = {}
  const submissions = records
    .filter((row) => row.event === 'game-scatter-submit')
    .map((row) => {
      const recipient = authority.recipients[row.recipient]
      const assignment = authority.hostCommands.find(
        (record) =>
          record.event === 'game-team-assign' &&
          record.receipt.accepted &&
          sameRoom(record.receipt, envelope) &&
          record.receipt.stateVersion <= row.receipt.stateVersion &&
          record.command.playerId === recipient.playerId
      )
      expect(assignment, 'Scatter submission has independent team authority').toBeDefined()
      const teamId = assignment.command.teamId,
        seen = new Set()
      expect(authority.config.teams.some((team) => team.id === teamId)).toBe(true)
      const entries = row.command.entries.map(({ categoryId, text }) => {
        expect(
          authority.config.categories.some((category) => category.id === categoryId) &&
            !seen.has(categoryId)
        ).toBe(true)
        expect(typeof text).toBe('string')
        seen.add(categoryId)
        return { categoryId, text: text.trim().normalize('NFC') }
      })
      expect(typeof row.receipt.result?.submissionId).toBe('string')
      for (const entry of entries) {
        if (!Object.hasOwn(answers, entry.categoryId))
          Object.defineProperty(answers, entry.categoryId, { value: {}, enumerable: true })
        Object.defineProperty(answers[entry.categoryId], teamId, {
          value: entry.text,
          enumerable: true,
        })
      }
      return { submissionId: row.receipt.result.submissionId, entries, teamId }
    })
  expect(new Set(submissions.map((row) => row.teamId)).size).toBe(submissions.length)
  for (const row of records.filter((record) => record.event === 'game-scatter-adjudicate')) {
    const { submissionId, categoryId, valid } = row.command
    const submission = submissions.find((record) => record.submissionId === submissionId)
    expect(submission?.entries.some((entry) => entry.categoryId === categoryId)).toBe(true)
    expect(typeof valid).toBe('boolean')
    if (!Object.hasOwn(validity, categoryId))
      Object.defineProperty(validity, categoryId, { value: {}, enumerable: true })
    Object.defineProperty(validity[categoryId], submission.teamId, {
      value: valid,
      enumerable: true,
      configurable: true,
    })
  }
  const letter = stateAt(authority, envelope)?.letter
  expect(typeof letter, 'Host-selected scatter letter evidence').toBe('string')
  const results = Object.fromEntries(
    authority.config.categories.map((category) => {
      const counts = new Map()
      for (const team of authority.config.teams) {
        const answer = normalize(answers[category.id]?.[team.id] || '')
        if (answer) counts.set(answer, (counts.get(answer) || 0) + 1)
      }
      return [
        category.id,
        Object.fromEntries(
          authority.config.teams.map((team) => {
            const answer = normalize(answers[category.id]?.[team.id] || '')
            const eligible =
              answer &&
              answer.startsWith(normalize(letter)) &&
              validity[category.id]?.[team.id] !== false
            return [
              team.id,
              eligible && (authority.config.scoring === 'all' || counts.get(answer) === 1) ? 10 : 0,
            ]
          })
        ),
      ]
    })
  )
  const rows = submissions.flatMap((submission) =>
    submission.entries.map((entry) => ({
      submissionId: submission.submissionId,
      teamId: submission.teamId,
      categoryId: entry.categoryId,
      text: entry.text,
      valid: validity[entry.categoryId]?.[submission.teamId] !== false,
      unique:
        Object.values(answers[entry.categoryId]).filter(
          (answer) => normalize(answer) === normalize(entry.text)
        ).length === 1,
      points: results[entry.categoryId][submission.teamId],
    }))
  )
  return { answers, results, submissions, validity, rows }
}
