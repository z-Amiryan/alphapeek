#!/usr/bin/env node
/**
 * PostToolUse formatter (Write|Edit|MultiEdit). Runs Biome's safe fixes +
 * formatting on the file that was just written, so the CLAUDE.md "always run
 * biome" rule happens automatically instead of being remembered. Best-effort:
 * it never blocks the workflow (always exits 0), it just tidies the file.
 *
 * Stdin: the Claude Code hook payload ({ tool_input.file_path, cwd, ... }).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const filePath = String(payload?.tool_input?.file_path ?? '')
if (!filePath || !existsSync(filePath)) process.exit(0)
// Only files Biome handles in this repo.
if (!/\.(tsx?|jsx?|mjs|cjs|json|jsonc|css)$/i.test(filePath)) process.exit(0)

const projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()

// `biome check --write` applies safe lint fixes and formats. --no-errors-on-
// unmatched keeps it quiet for paths outside biome.json's scope.
spawnSync('pnpm', ['exec', 'biome', 'check', '--write', '--no-errors-on-unmatched', filePath], {
  cwd: projectDir,
  stdio: 'ignore',
})

process.exit(0) // Formatting must never interrupt the edit flow.
