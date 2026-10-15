import { describe, expect, it } from 'vitest'
import { decodePart, encodePart, sign, split, verify } from './jwt'

describe('jwt', () => {
  it('verifies the well-known jwt.io example', async () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect((await verify(token, 'your-256-bit-secret')).valid).toBe(true)
  })

  it('round-trips and rejects an edited payload', async () => {
    const token = await sign({ sub: 'guest', role: 'user' }, 'secret')
    const [h, p, s] = split(token)
    expect(decodePart(p)).toEqual({ sub: 'guest', role: 'user' })
    expect((await verify(token, 'secret')).valid).toBe(true)
    const edited = `${h}.${encodePart({ sub: 'guest', role: 'admin' })}.${s}`
    expect((await verify(edited, 'secret')).valid).toBe(false)
    expect((await verify(token, 'other')).valid).toBe(false)
  })
})
