const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const utf8 = (text: string) => encoder.encode(text)
export const fromUtf8 = (bytes: Uint8Array) => decoder.decode(bytes)

export function toHex(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Base64 with the URL-safe alphabet and no padding, as used by JWT. */
export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Number of differing bits between two equal-length hex strings. */
export function bitDistance(a: string, b: string): number {
  let bits = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      bits += x & 1
      x >>= 1
    }
  }
  return bits
}
