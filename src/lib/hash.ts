import { toHex, utf8 } from './encoding'

export type Storage = 'plain' | 'sha256' | 'salted' | 'pbkdf2'

export const storageLabels: Record<Storage, string> = {
  plain: 'Plain text',
  sha256: 'SHA-256 hash',
  salted: 'SHA-256 + salt',
  pbkdf2: 'PBKDF2 + salt (slow)',
}

export async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', utf8(text)))
}

export function randomSalt(bytes = 8): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** A deliberately slow key-derivation function: `iterations` rounds of HMAC-SHA-256. */
export async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: utf8(salt), iterations },
    key,
    256,
  )
  return toHex(bits)
}

/** What ends up in the database column for `password` under each storage scheme. */
export async function digest(password: string, mode: Storage, salt: string, iterations: number): Promise<string> {
  switch (mode) {
    case 'plain':
      return password
    case 'sha256':
      return sha256(password)
    case 'salted':
      return sha256(salt + password)
    case 'pbkdf2':
      return pbkdf2(password, salt, iterations)
  }
}

export const usesSalt = (mode: Storage) => mode === 'salted' || mode === 'pbkdf2'
