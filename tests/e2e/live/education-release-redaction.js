import { expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { packetPermissions, permissionKey } from './education-release-permissions.js'

const normalize = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '')
const privateField = (key) =>
  /answer|correct|accept|solution|rubric|feedback|^(casesensitive|regions|reveal.*|explanation)$/.test(
    normalize(key)
  )
const authorityField = (key) =>
  /authority|capabilit|token|secret|privatekey|(host|presenter|speaker|remote|session).*key/.test(
    normalize(key)
  )
function inspect(
  value,
  path,
  name,
  permissions,
  secrets,
  sessionToken,
  expected,
  authorized = false
) {
  if (typeof value === 'string') {
    for (const secret of secrets) {
      const ownSession =
        name === 'game-session' &&
        path.length === 1 &&
        path[0] === 'sessionToken' &&
        value === sessionToken &&
        secret === sessionToken
      if (!ownSession)
        assert.ok(!value.includes(secret), `${name}:${path.join('.')} leaks a session/host secret`)
    }
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    for (const secret of secrets)
      assert.ok(!key.includes(secret), `${name} hides a secret in a property name`)
    const nextPath = [...path, key],
      id = permissionKey(nextPath)
    const exactPermission = permissions.has(id)
    const withinShape = authorized && Object.hasOwn(expected, key)
    const permitted = exactPermission || withinShape
    const nextExpected = exactPermission
      ? permissions.get(id)
      : withinShape
        ? expected[key]
        : undefined
    const ownSession =
      name === 'game-session' && nextPath.length === 1 && key === 'sessionToken' && exactPermission
    assert.ok(
      !authorityField(key) || ownSession,
      `Private authority at ${name}:${nextPath.join('.')}`
    )
    const feedbackMessage =
      key === 'message' && (path.at(-1) === 'result' || name === 'game-answer-result')
    const emptyReveal = child === null && ['revealed', 'reveal'].includes(key)
    if (!emptyReveal && (privateField(key) || feedbackMessage))
      assert.ok(permitted, `Private answer data at ${name}:${nextPath.join('.')}`)
    if (exactPermission)
      assert.ok(
        isDeepStrictEqual(child, nextExpected),
        `Independent authority at ${name}:${nextPath.join('.')}`
      )
    inspect(child, nextPath, name, permissions, secrets, sessionToken, nextExpected, permitted)
  }
}
export function assertPublicPackets(journey, authority) {
  expect(
    authority,
    'Privacy inspection requires independent authored/command authority'
  ).toBeDefined()
  const secrets = [
    ...new Set(
      [
        ...authority.hostSecrets,
        ...authority.recipients.flatMap((recipient) =>
          recipient.sessions.map((session) => session.sessionToken)
        ),
      ].filter(Boolean)
    ),
  ]
  for (const [index, wire] of journey.wires.entries()) {
    const recipient = authority.recipients[index]
    expect(recipient, 'Every inspected wire has a bound recipient').toBeDefined()
    for (const { name, data } of wire.incoming) {
      expect(data && typeof data === 'object').toBeTruthy()
      const permissions = packetPermissions(authority, recipient, name, data)
      const sessionToken =
        name === 'game-session' ? permissions.get(permissionKey(['sessionToken'])) : null
      inspect(data, [], name, permissions, secrets, sessionToken)
    }
  }
}
