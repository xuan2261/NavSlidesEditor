import { describe, expect, it } from 'vitest'
import { parseReleaseTag, verifyReleaseSubject } from './release-subject.mjs'

const sha = (character) => character.repeat(40)

describe('release subject policy', () => {
  it('accepts only the governed final tag or a positive canonical RC', () => {
    expect(parseReleaseTag('v1.17.0', '1.17.0')).toEqual({
      kind: 'final',
      coreVersion: '1.17.0',
    })
    expect(parseReleaseTag('v1.17.0-rc.12', '1.17.0')).toEqual({
      kind: 'rc',
      coreVersion: '1.17.0',
      rcNumber: 12,
    })

    for (const tag of [
      'vv1.17.0',
      '1.17.0',
      'v1.17',
      'v01.17.0',
      'v1.017.0',
      'v1.17.0-rc.0',
      'v1.17.0-rc.01',
      'v1.17.0-dev.20260925',
      'master',
    ]) {
      expect(parseReleaseTag(tag, '1.17.0'), tag).toBeNull()
    }
  })

  it('binds the peeled tag, checkout, green CI, artifacts, and receipts', () => {
    const subjectSha = sha('a')
    expect(
      verifyReleaseSubject({
        tag: 'v1.17.0-rc.2',
        packageVersion: '1.17.0',
        subjectSha,
        tagCommitSha: subjectSha,
        checkoutSha: subjectSha,
        successfulCiHeadSha: subjectSha,
        artifactSubjects: [subjectSha, subjectSha],
        receiptSubjects: [subjectSha],
      })
    ).toMatchObject({ subjectSha, releaseKind: 'rc' })
  })

  it.each([
    ['tag commit', { tagCommitSha: sha('b') }],
    ['checkout', { checkoutSha: sha('b') }],
    ['main CI', { successfulCiHeadSha: sha('b') }],
    ['artifact', { artifactSubjects: [sha('b')] }],
    ['receipt', { receiptSubjects: [sha('b')] }],
  ])('rejects a mismatched %s subject', (_label, change) => {
    const subjectSha = sha('a')
    expect(() =>
      verifyReleaseSubject({
        tag: 'v1.17.0',
        packageVersion: '1.17.0',
        subjectSha,
        tagCommitSha: subjectSha,
        checkoutSha: subjectSha,
        successfulCiHeadSha: subjectSha,
        artifactSubjects: [subjectSha],
        receiptSubjects: [subjectSha],
        ...change,
      })
    ).toThrow(/subject|sha/i)
  })
})
