// Guards stop the 40-hex slice matching inside a longer hex string (e.g. a tx
// hash). Kept in sync with the copy in ROADMAP/SPEC.
export const EVM_ADDRESS = /(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g

export function findAddress(text: string): string | null {
  // Fresh regex each call so the /g flag's lastIndex doesn't leak across calls.
  const match = new RegExp(EVM_ADDRESS).exec(text)
  return match ? match[0] : null
}

export function isAddress(text: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(text.trim())
}
