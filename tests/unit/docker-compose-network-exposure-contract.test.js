import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8').replace(/\r\n/g, '\n')

describe('Docker network exposure contract', () => {
  it('keeps container binding separate from host publication', () => {
    expect(compose).toContain('NAVSLIDES_LISTEN_HOST: 0.0.0.0')
    expect(compose).toContain('NAVSLIDES_PUBLISH_HOST: ${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}')
    expect(compose).toContain("'${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}:3002:3002'")
  })

  it('does not publish all interfaces by default', () => {
    expect(compose).not.toContain("'0.0.0.0:3002:3002'")
    expect(compose).not.toContain("'3002:3002'")
  })
})
