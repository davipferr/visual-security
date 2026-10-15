import { describe, expect, it } from 'vitest'
import { attack } from './crack'
import { digest, pbkdf2, sha256 } from './hash'

describe('hashing', () => {
  it('matches the SHA-256 test vector', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is deterministic without salt and different with it', async () => {
    expect(await digest('sunshine', 'sha256', 'a', 1)).toBe(await digest('sunshine', 'sha256', 'b', 1))
    expect(await digest('sunshine', 'salted', 'a', 1)).not.toBe(await digest('sunshine', 'salted', 'b', 1))
  })

  it('matches the PBKDF2-HMAC-SHA256 test vector', async () => {
    expect(await pbkdf2('password', 'salt', 1)).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b')
  })
})

describe('attack', () => {
  const accounts = [
    { name: 'alice', password: 'sunshine', salt: 's1' },
    { name: 'dave', password: 'correct horse battery staple', salt: 's2' },
  ]
  const store = (mode: 'sha256' | 'salted') =>
    Promise.all(
      accounts.map(async (a) => ({ name: a.name, salt: a.salt, stored: await digest(a.password, mode, a.salt, 1) })),
    )

  it('cracks unsalted hashes with no hashing at attack time', async () => {
    const report = await attack(await store('sha256'), 'sha256', 1)
    expect(report.results.map((r) => r.password)).toEqual(['sunshine', null])
    expect(report.hashes).toBe(0)
  })

  it('has to hash every guess per user once salted', async () => {
    const report = await attack(await store('salted'), 'salted', 1)
    expect(report.results.map((r) => r.password)).toEqual(['sunshine', null])
    expect(report.hashes).toBeGreaterThan(16)
  })
})
