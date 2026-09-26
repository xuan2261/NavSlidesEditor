import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8').replace(/\r\n/g, '\n')
const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8').replace(/\r\n/g, '\n')

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

  it('runs as the fixed non-root runtime identity and probes readiness', () => {
    expect(dockerfile).toMatch(/USER\s+10001:10001/)
    expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*\/health\/ready/)
    expect(compose).toContain("user: '10001:10001'")
    expect(compose).toMatch(/healthcheck:[\s\S]*\/health\/ready/)
    expect(compose).toContain('revealjs-data:/app/server/data')
    expect(compose).toContain('revealjs-uploads:/app/server/uploads')
  })
})
