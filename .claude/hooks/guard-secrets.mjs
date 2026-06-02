#!/usr/bin/env node
/**
 * PreToolUse guard (Write|Edit|MultiEdit). Enforces the CLAUDE.md hard rule
 * "never inline anything that could be a secret". Exits 2 to BLOCK the write and
 * feeds the reason back to Claude when the incoming content hard-codes the
 * CoinStats key or a secret-shaped literal. Best-effort and conservative — it
 * errs toward letting writes through rather than false-blocking.
 *
 * Stdin: the Claude Code hook payload ({ tool_name, tool_input, cwd, ... }).
 */
import { readFileSync } from 'node:fs'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

let payload
try {
  payload = JSON.parse(readStdin())
} catch {
  process.exit(0) // No/garbled payload — don't interfere.
}

const input = payload?.tool_input ?? {}
const filePath = String(input.file_path ?? '')

// Files where real secrets legitimately live (all gitignored) or are sampled.
// Scanning these would block correct work, so skip them.
const EXEMPT = /(^|\/)(\.env|\.dev\.vars)([.\w-]*)?$|\.example$|settings\.local\.json$/i
if (EXEMPT.test(filePath)) process.exit(0)

// Gather the text being written across Write / Edit / MultiEdit shapes.
const parts = []
if (typeof input.content === 'string') parts.push(input.content)
if (typeof input.new_string === 'string') parts.push(input.new_string)
if (Array.isArray(input.edits)) {
  for (const e of input.edits) {
    if (e && typeof e.new_string === 'string') parts.push(e.new_string)
  }
}
const text = parts.join('\n')
if (!text) process.exit(0)

// Values that are obviously placeholders, env lookups, or interpolations — fine.
const PLACEHOLDER =
  /^(REPLACE_ME|YOUR[_-]|<|\$\{|process\.env|import\.meta|xxx|changeme|todo|example)/i

const findings = new Set()

// 1) The project's named secret assigned a concrete value.
const namedRe = /COINSTATS_API_KEY\s*[:=]\s*['"`]?([^'"`\s]{6,})/gi
for (const m of text.matchAll(namedRe)) {
  if (!PLACEHOLDER.test(m[1])) findings.add('COINSTATS_API_KEY assigned a literal value')
}

// 2) A secret-shaped literal (>=24 chars) assigned to a secret-named identifier.
const genericRe =
  /\b(api[_-]?key|apikey|secret|token|password|x-api-key)\b\s*[:=]\s*['"`]([A-Za-z0-9_\-./+=]{24,})['"`]/gi
for (const m of text.matchAll(genericRe)) {
  if (!PLACEHOLDER.test(m[2])) findings.add(`hard-coded secret assigned to "${m[1]}"`)
}

if (findings.size > 0) {
  const what = [...findings].join('; ')
  const reason = `AlphaPeek secret guard blocked this write to ${filePath || 'a file'}: ${what}. Per CLAUDE.md, secrets must go through Wrangler secrets or env vars (import.meta.env / process.env) — never inlined into source.`
  process.stderr.write(`${reason}\n`)
  process.exit(2) // Block the tool call; stderr is shown to Claude.
}

process.exit(0)
