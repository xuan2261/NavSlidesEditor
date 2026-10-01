#!/usr/bin/env node
import { startMcp } from './mcp-server.mjs'

startMcp().catch((error) => {
  process.stderr.write(`NavSlides MCP failed: ${error.code || error.name}. ${error.hint || 'Check arguments, run npm ci, and inspect docs/agent-integration.md.'}\n`)
  process.exitCode = 1
})
