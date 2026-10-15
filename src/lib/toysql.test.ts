import { describe, expect, it } from 'vitest'
import { concatenate, query, SqlError, type Row } from './toysql'

const users: Row[] = [
  { id: 1, name: 'alice', password: 'sunshine', role: 'admin' },
  { id: 2, name: 'bob', password: 'hunter2', role: 'user' },
  { id: 3, name: "o'brien", password: 'shamrock', role: 'user' },
]
const tables = { users }

const unsafeLogin = (name: string, password: string) =>
  query(
    concatenate(["SELECT * FROM users WHERE name = '", "' AND password = '", "'"], [name, password]).sql,
    tables,
  )
const safeLogin = (name: string, password: string) =>
  query('SELECT * FROM users WHERE name = ? AND password = ?', tables, [name, password])

describe('toy sql', () => {
  it('logs in with the right password only', () => {
    expect(unsafeLogin('alice', 'sunshine').map((r) => r.id)).toEqual([1])
    expect(unsafeLogin('alice', 'nope')).toEqual([])
  })

  it('breaks on a name containing a quote when values are pasted in', () => {
    expect(() => unsafeLogin("o'brien", 'shamrock')).toThrow(SqlError)
    expect(safeLogin("o'brien", 'shamrock').map((r) => r.id)).toEqual([3])
  })

  it('lets pasted input rewrite the query', () => {
    expect(unsafeLogin("alice' --", '').map((r) => r.id)).toEqual([1])
    expect(unsafeLogin("' OR 1=1 --", '')).toHaveLength(3)
  })

  it('treats placeholder values as plain data', () => {
    expect(safeLogin("alice' --", '')).toEqual([])
    expect(safeLogin("' OR 1=1 --", '')).toEqual([])
  })

  it('handles precedence, NOT and escaped quotes', () => {
    expect(query("SELECT * FROM users WHERE NOT role = 'admin' AND (id = 2 OR id = 3)", tables)).toHaveLength(2)
    expect(query("SELECT * FROM users WHERE name = 'o''brien'", tables)).toHaveLength(1)
  })
})
