import { base64url, fromBase64url, fromUtf8, utf8 } from './encoding'

export type Claims = Record<string, unknown>

const header = { alg: 'HS256', typ: 'JWT' }

export const encodePart = (value: unknown) => base64url(utf8(JSON.stringify(value)))
export const decodePart = (part: string): Claims => JSON.parse(fromUtf8(fromBase64url(part)))

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(data))))
}

/** HS256 signature over `header.payload`. */
export const signature = (headerPart: string, payloadPart: string, secret: string) =>
  hmac(`${headerPart}.${payloadPart}`, secret)

export async function sign(payload: Claims, secret: string): Promise<string> {
  const h = encodePart(header)
  const p = encodePart(payload)
  return `${h}.${p}.${await signature(h, p, secret)}`
}

export function split(token: string): [string, string, string] {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('A JWT has exactly three parts separated by dots.')
  return parts as [string, string, string]
}

export interface Verification {
  valid: boolean
  expected: string
  actual: string
}

export async function verify(token: string, secret: string): Promise<Verification> {
  const [h, p, actual] = split(token)
  const expected = await signature(h, p, secret)
  return { valid: expected === actual, expected, actual }
}
