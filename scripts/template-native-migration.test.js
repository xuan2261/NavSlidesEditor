import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { evaluateAnswer } from '../shared/src/education/answer-evaluator.js'
const root = path.resolve(import.meta.dirname, '..')
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'shared/tests/fixtures/education-legacy-templates.json'), 'utf8')
)
const temporary = []
afterEach(() => {
  for (const directory of temporary.splice(0))
    fs.rmSync(directory, { recursive: true, force: true })
})
function fixture(records = baseline) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'education-templates-'))
  temporary.push(directory)
  const target = path.join(directory, 'templates.json')
  fs.writeFileSync(target, JSON.stringify(records, null, 2))
  return { directory, target }
}
function run(script, input, output = input) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts', script), '--input', input, '--output', output],
    { encoding: 'utf8', cwd: root }
  )
}
const read = (target) => JSON.parse(fs.readFileSync(target, 'utf8'))
const find = (records, id) => records.find((record) => record.id === id)
const questions = (records, id) =>
  find(records, id).slides.flatMap((slide) =>
    slide.elements
      .filter((element) => element.type === 'game')
      .flatMap((element) => element.quiz.questions)
  )
const check = (question, correct, wrong) => {
  expect(evaluateAnswer(question, correct)).toMatchObject({ valid: true, correct: true })
  expect(evaluateAnswer(question, wrong)).toMatchObject({ valid: true, correct: false })
}
describe('exact builtin template migrations through actual CLI', () => {
  it('preserves all five authored answer meanings and non-game lesson content', () => {
    const { target } = fixture()
    const result = run('add-quizzes.js', target)
    expect(result.status, result.stderr).toBe(0)
    const records = read(target)
    const [ohm, binary] = questions(records, 'quiz-multiple-choice')
    for (const [q, right, wrong] of [
      [ohm, 'B. U = I × R', 'A. P = U × I'],
      [binary, 'A. 1010', 'B. 1100'],
    ]) {
      check(
        q,
        { optionId: q.options.find((option) => option.text === right).id },
        { optionId: q.options.find((option) => option.text === wrong).id }
      )
      expect(q.feedback.explanation).toContain(q === ohm ? 'Ohm' : '1010')
    }
    questions(records, 'quiz-true-false').forEach((q, index) =>
      check(
        q,
        { value: [true, false, true, false][index] },
        { value: ![true, false, true, false][index] }
      )
    )
    const fill = questions(records, 'quiz-fill-blank')
    check(fill[0], { text: ' TCP IP ' }, { text: 'UDP' })
    for (const answer of ['không dây', 'khong day', 'wireless'])
      check(fill[1], { text: answer }, { text: 'cáp' })
    const order = questions(records, 'quiz-ordering')[0]
    const labels = [
      'Phân tích yêu cầu (Requirement Analysis)',
      'Thiết kế (Design)',
      'Lập trình (Implementation)',
      'Kiểm thử (Testing)',
      'Bảo trì (Maintenance)',
    ]
    const itemIds = labels.map((label) => order.options.find((option) => option.text === label).id)
    check(order, { itemIds }, { itemIds: [...itemIds].reverse() })
    const matching = questions(records, 'quiz-matching')[0]
    const pairs = [
      ['Python', 'Cú pháp dễ đọc, phổ biến trong AI'],
      ['JavaScript', 'Chạy trên trình duyệt web'],
      ['C++', 'Hiệu năng cao, dùng làm game engine'],
      ['SQL', 'Truy vấn và thao tác cơ sở dữ liệu'],
    ].map(([left, right]) => ({
      leftId: matching.options.left.find((option) => option.text === left).id,
      rightId: matching.options.right.find((option) => option.text === right).id,
    }))
    check(
      matching,
      { pairs },
      { pairs: pairs.map((pair, index) => ({ ...pair, rightId: pairs[(index + 1) % 4].rightId })) }
    )
    for (const before of baseline.filter(
      (record) => record.id.startsWith('quiz-') && record.id !== 'quiz-sentinel'
    )) {
      const after = find(records, before.id)
      expect(after.slides.map((slide) => [slide.id, slide.title])).toEqual(
        before.slides.map((slide) => [slide.id, slide.title])
      )
      expect(
        after.slides.flatMap((slide) => slide.elements.filter((element) => element.type !== 'game'))
      ).toEqual(
        before.slides.flatMap((slide) =>
          slide.elements.filter((element) => element.type !== 'html')
        )
      )
    }
    expect(
      records.filter(
        (record) =>
          ![
            'quiz-multiple-choice',
            'quiz-true-false',
            'quiz-fill-blank',
            'quiz-ordering',
            'quiz-matching',
          ].includes(record.id)
      )
    ).toEqual(
      baseline.filter(
        (record) =>
          ![
            'quiz-multiple-choice',
            'quiz-true-false',
            'quiz-fill-blank',
            'quiz-ordering',
            'quiz-matching',
          ].includes(record.id)
      )
    )
  })
  it.each(['add-quizzes.js', 'upgrade-interactive-templates.js'])(
    '%s is repeatable and keeps uniquely restorable backups',
    (script) => {
      const { directory, target } = fixture()
      const before = fs.readFileSync(target, 'utf8')
      const first = run(script, target)
      expect(first.status, first.stderr).toBe(0)
      const once = fs.readFileSync(target, 'utf8')
      const second = run(script, target)
      expect(second.status, second.stderr).toBe(0)
      expect(fs.readFileSync(target, 'utf8')).toBe(once)
      const backups = fs
        .readdirSync(directory)
        .filter((name) => name.startsWith('templates.json.backup-'))
      expect(backups).toHaveLength(2)
      expect(
        backups.map((name) => fs.readFileSync(path.join(directory, name), 'utf8')).sort()
      ).toEqual([before, once].sort())
      const originalBackup = backups.find(
        (name) => fs.readFileSync(path.join(directory, name), 'utf8') === before
      )
      fs.copyFileSync(path.join(directory, originalBackup), target)
      expect(fs.readFileSync(target, 'utf8')).toBe(before)
      const restoredRun = run(script, target)
      expect(restoredRun.status, restoredRun.stderr).toBe(0)
      expect(fs.readFileSync(target, 'utf8')).toBe(once)
    }
  )
  it('preserves every existing simulation physics source and extra lesson while annotating only the six IDs', () => {
    const { target } = fixture()
    const result = run('upgrade-interactive-templates.js', target)
    expect(result.status, result.stderr).toBe(0)
    const records = read(target)
    for (const before of baseline) {
      const after = find(records, before.id)
      if (
        ![
          'sim-logic-gates',
          'sim-rlc-response',
          'sim-pid-tuning',
          'sim-bode-plot',
          'sim-3phase',
          'sim-gear-train',
        ].includes(before.id)
      ) {
        expect(after).toEqual(before)
      } else {
        expect(
          after.slides.flatMap((slide) => slide.elements.map((element) => element.content))
        ).toEqual(
          before.slides.flatMap((slide) => slide.elements.map((element) => element.content))
        )
        const embeds = after.slides.flatMap((slide) =>
          slide.elements.filter((element) => element.type === 'html')
        )
        for (const embed of embeds)
          expect(embed.htmlDependencies).toEqual({
            network: false,
            offlineCapable: true,
            resources: [],
            dynamicResources: [],
          })
      }
    }
  })
  it.each(['add-quizzes.js', 'upgrade-interactive-templates.js'])(
    '%s rejects missing, duplicated and incompatible targets before publication',
    (script) => {
      const id = script === 'add-quizzes.js' ? 'quiz-matching' : 'sim-bode-plot'
      for (const records of [
        baseline.filter((record) => record.id !== id),
        [...baseline, find(baseline, id)],
        baseline.map((record) => (record.id === id ? { ...record, slides: [] } : record)),
      ]) {
        const { directory, target } = fixture(records)
        const before = fs.readFileSync(target, 'utf8')
        const result = run(script, target)
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain(id)
        expect(fs.readFileSync(target, 'utf8')).toBe(before)
        expect(fs.readdirSync(directory)).toEqual(['templates.json'])
      }
    }
  )
  it.each(['add-quizzes.js', 'upgrade-interactive-templates.js'])(
    '%s refuses changed audited HTML and leaves output untouched',
    (script) => {
      const records = structuredClone(baseline)
      const id = script === 'add-quizzes.js' ? 'quiz-matching' : 'sim-bode-plot'
      const embed = find(records, id)
        .slides.flatMap((slide) => slide.elements)
        .find((element) => element.type === 'html')
      embed.content = '<p>An unrelated user-authored lesson with different semantics.</p>'
      const { directory, target } = fixture(records)
      const before = fs.readFileSync(target, 'utf8')
      const result = run(script, target)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(id)
      expect(result.stderr).toContain('audited')
      expect(fs.readFileSync(target, 'utf8')).toBe(before)
      expect(fs.readdirSync(directory)).toEqual(['templates.json'])
    }
  )
  it('validates already-native answers before publishing instead of accepting corrupt current configs', () => {
    const { directory, target } = fixture()
    const first = run('add-quizzes.js', target)
    expect(first.status, first.stderr).toBe(0)
    const records = read(target)
    questions(records, 'quiz-multiple-choice')[0].answerKey.optionId = 'missing-option'
    fs.writeFileSync(target, JSON.stringify(records))
    const before = fs.readFileSync(target, 'utf8')
    const backupsBefore = fs.readdirSync(directory).sort()
    const result = run('add-quizzes.js', target)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('quiz-multiple-choice')
    expect(fs.readFileSync(target, 'utf8')).toBe(before)
    expect(fs.readdirSync(directory).sort()).toEqual(backupsBefore)
  })
  it.each(['missing', 'null'])(
    'simulation publication rejects %s native quiz content without default repair',
    (malformed) => {
      const { directory, target } = fixture()
      const first = run('add-quizzes.js', target)
      expect(first.status, first.stderr).toBe(0)
      const records = read(target)
      const quiz = find(records, 'quiz-multiple-choice')
        .slides.flatMap((slide) => slide.elements)
        .find((element) => element.type === 'game')
      if (malformed === 'null') quiz.quiz = null
      else delete quiz.quiz.questions
      fs.writeFileSync(target, JSON.stringify(records))
      const before = fs.readFileSync(target, 'utf8')
      const filesBefore = fs.readdirSync(directory).sort()
      const result = run('upgrade-interactive-templates.js', target)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('quiz-multiple-choice')
      expect(fs.readFileSync(target, 'utf8')).toBe(before)
      expect(fs.readdirSync(directory).sort()).toEqual(filesBefore)
    }
  )
  it('rejects an incomplete resource declaration before creating backups or replacing output', () => {
    const records = structuredClone(baseline)
    find(records, 'user-owned').slides[0].elements[0].htmlDependencies = {
      network: false,
      offlineCapable: true,
      resources: null,
      dynamicResources: [],
    }
    const { directory, target } = fixture(records)
    const before = fs.readFileSync(target, 'utf8')
    const result = run('add-quizzes.js', target)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('user-owned')
    expect(result.stderr).toContain('resources')
    expect(fs.readFileSync(target, 'utf8')).toBe(before)
    expect(fs.readdirSync(directory)).toEqual(['templates.json'])
  })
  it('uses an isolated output without modifying input or overwriting preexisting backup bytes', () => {
    const { directory, target } = fixture()
    const output = path.join(directory, 'result.json')
    fs.writeFileSync(output, '[{"id":"previous-output"}]')
    const before = fs.readFileSync(target, 'utf8')
    const result = run('add-quizzes.js', target, output)
    expect(result.status, result.stderr).toBe(0)
    expect(fs.readFileSync(target, 'utf8')).toBe(before)
    const backup = fs.readdirSync(directory).find((name) => name.startsWith('result.json.backup-'))
    expect(read(path.join(directory, backup))).toEqual([{ id: 'previous-output' }])
  })
})
