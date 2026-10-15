import { digest, sha256, usesSalt, type Storage } from './hash'

/** A tiny stand-in for the published lists of common passwords. */
export const commonPasswords = [
  '123456', 'password', '123456789', 'qwerty', '12345678', '111111', 'iloveyou', 'abc123',
  'sunshine', 'princess', 'dragon', 'football', 'monkey', 'letmein', 'welcome', 'password123',
]

export interface StoredUser {
  name: string
  salt: string
  stored: string
}

export interface CrackResult {
  name: string
  password: string | null
  hashes: number
}

export interface AttackReport {
  results: CrackResult[]
  hashes: number
  ms: number
  method: string
}

let lookupTable: Promise<Map<string, string>> | null = null

/** hash → password, built once in advance. Only useful because unsalted hashes never change. */
export function precomputedTable() {
  lookupTable ??= Promise.all(commonPasswords.map(async (p) => [await sha256(p), p] as const)).then(
    (pairs) => new Map(pairs),
  )
  return lookupTable
}

/**
 * Plays the attacker who copied the users table. Plain text needs no work, unsalted
 * hashes fall to a precomputed lookup, and salted hashes force fresh guesses per user.
 */
export async function attack(
  users: StoredUser[],
  mode: Storage,
  iterations: number,
  onProgress?: (done: CrackResult[]) => void,
): Promise<AttackReport> {
  const started = performance.now()
  const results: CrackResult[] = []

  if (mode === 'plain') {
    for (const u of users) results.push({ name: u.name, password: u.stored, hashes: 0 })
    onProgress?.(results)
    return { results, hashes: 0, ms: performance.now() - started, method: 'Just read the column.' }
  }

  if (!usesSalt(mode)) {
    const table = await precomputedTable()
    for (const u of users) results.push({ name: u.name, password: table.get(u.stored) ?? null, hashes: 0 })
    onProgress?.(results)
    return {
      results,
      hashes: 0,
      ms: performance.now() - started,
      method: `Looked each hash up in a table of ${table.size} hashes computed in advance. One table covers every user.`,
    }
  }

  let hashes = 0
  for (const u of users) {
    const result: CrackResult = { name: u.name, password: null, hashes: 0 }
    for (const guess of commonPasswords) {
      result.hashes++
      if ((await digest(guess, mode, u.salt, iterations)) === u.stored) {
        result.password = guess
        break
      }
    }
    hashes += result.hashes
    results.push(result)
    onProgress?.([...results])
  }
  return {
    results,
    hashes,
    ms: performance.now() - started,
    method: 'Every user has a different salt, so each guess had to be hashed again for every user.',
  }
}
