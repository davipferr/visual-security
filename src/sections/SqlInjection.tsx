import { useState } from 'react'
import { Guard } from '../Controls'
import { concatenate, query, SqlError, tokenize, type Row, type Token } from '../lib/toysql'
import { Section } from '../Section'

/** The whole "database": an array in memory. Passwords are plain only to keep this demo short (see section 2). */
const users: Row[] = [
  { id: 1, name: 'alice', password: 'sunshine', role: 'admin' },
  { id: 2, name: 'bob', password: 'hunter2', role: 'user' },
  { id: 3, name: "o'brien", password: 'shamrock', role: 'user' },
  { id: 4, name: 'carol', password: 'tulips', role: 'user' },
]

const pieces = ["SELECT * FROM users WHERE name = '", "' AND password = '", "'"]
const template = 'SELECT * FROM users WHERE name = ? AND password = ?'

const presets = [
  { label: 'Correct login', name: 'alice', password: 'sunshine' },
  { label: 'Wrong password', name: 'alice', password: 'guess' },
  { label: 'A name with a quote', name: "o'brien", password: 'shamrock' },
  { label: 'Comment out the check', name: "alice' --", password: '' },
  { label: 'Match every row', name: "' OR 1=1 --", password: '' },
]

type Span = { start: number; end: number }

const overlaps = (t: Token, s: Span) => t.start < s.end && t.end > s.start
const inside = (i: number, s: Span) => i >= s.start && i < s.end

/** Input stayed data only if every token it touched is a string literal opened and closed by the template. */
function verdicts(sql: string, tokens: Token[] | null, spans: Span[]): ('data' | 'code')[] {
  return spans.map((span) => {
    if (!tokens) return 'code'
    if (span.start === span.end) return 'data'
    const touched = tokens.filter((t) => overlaps(t, span))
    return touched.every((t) => t.kind === 'string' && !inside(t.start, span) && !inside(t.end - 1, span) && sql[t.start] === "'")
      ? 'data'
      : 'code'
  })
}

function Highlighted({ sql, tokens, spans }: { sql: string; tokens: Token[] | null; spans: Span[] }) {
  const verdict = verdicts(sql, tokens, spans)
  const classOf = (i: number) => {
    const token = tokens?.find((t) => i >= t.start && i < t.end)
    const span = spans.findIndex((s) => inside(i, s))
    return [token ? `tok-${token.kind}` : '', span >= 0 ? `in-${verdict[span]}` : ''].join(' ').trim()
  }
  const runs: { text: string; cls: string }[] = []
  for (let i = 0; i < sql.length; i++) {
    const cls = classOf(i)
    const last = runs[runs.length - 1]
    if (last && last.cls === cls) last.text += sql[i]
    else runs.push({ text: sql[i], cls })
  }
  return (
    <div className="sql">
      {runs.map((r, i) => (
        <span key={i} className={r.cls || undefined}>
          {r.text}
        </span>
      ))}
    </div>
  )
}

interface Outcome {
  rows: Row[]
  error: string | null
}

export function SqlInjection({
  parameterize,
  onParameterize,
}: {
  parameterize: boolean
  onParameterize: (v: boolean) => void
}) {
  const [name, setName] = useState('alice')
  const [password, setPassword] = useState('sunshine')

  const { sql, spans } = concatenate(pieces, [name, password])
  let tokens: Token[] | null = null
  try {
    tokens = tokenize(parameterize ? template : sql)
  } catch {
    tokens = null
  }

  let outcome: Outcome
  try {
    outcome = {
      rows: parameterize ? query(template, { users }, [name, password]) : query(sql, { users }),
      error: null,
    }
  } catch (e) {
    outcome = { rows: [], error: e instanceof SqlError ? e.message : String(e) }
  }

  const injected = !parameterize && verdicts(sql, tokens, spans).includes('code')
  const user = outcome.rows[0]
  const honest = users.find((u) => u.name === name && u.password === password)
  const bypassed = user && !honest

  return (
    <Section
      step={5}
      title="SQL injection"
      intro={
        <>
          A login form looks the user up with a SQL query. If the code builds that query by pasting the
          typed text between quotes, a quote in the input ends the string early, and everything after it
          is read as SQL instead of as a name.
        </>
      }
      aside={<Guard label="Parameterized queries" value={parameterize} onChange={onParameterize} />}
    >
      <div className="presets">
        {presets.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => {
              setName(p.name)
              setPassword(p.password)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="split">
        <label className="field">
          Username
          <input type="text" value={name} spellCheck={false} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input type="text" value={password} spellCheck={false} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>

      <div className="panel">
        <span className="small muted">{parameterize ? 'Query sent to the database, with values sent separately' : 'Query sent to the database'}</span>
        {parameterize ? (
          <>
            <Highlighted sql={template} tokens={tokens} spans={[]} />
            <div className="param-list">
              <span className="param">?₁ = {JSON.stringify(name)}</span>
              <span className="param">?₂ = {JSON.stringify(password)}</span>
            </div>
          </>
        ) : (
          <Highlighted sql={sql} tokens={tokens} spans={spans} />
        )}
        {!parameterize && (
          <div className="legend">
            <span>
              <i className="swatch in-data" /> your input, still inside a string
            </span>
            <span>
              <i className="swatch in-code" /> your input, now running as SQL
            </span>
            <span className="tok-comment">commented out</span>
          </div>
        )}
      </div>

      <div className={`response ${outcome.error ? 'denied' : bypassed ? 'danger' : user ? 'ok' : 'denied'}`}>
        {outcome.error ? (
          <>
            <span className="code">500 Database error</span>
            <span className="mono small">{outcome.error}</span>
            <span className="small">
              Real names with a quote, like o'brien, can't log in, and the error tells an attacker that their
              quote reached the SQL.
            </span>
          </>
        ) : user ? (
          <>
            <span className="code">
              Logged in as {String(user.name)} ({String(user.role)})
            </span>
            <span className="small">
              The query returned {outcome.rows.length} row{outcome.rows.length === 1 ? '' : 's'}
              {outcome.rows.length > 1 ? '; the app took the first one.' : '.'}
              {bypassed && ' No correct password was given.'}
            </span>
          </>
        ) : (
          <span className="code">Invalid username or password</span>
        )}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th>password</th>
              <th>role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const hit = outcome.rows.includes(u)
              return (
                <tr key={u.id} style={hit ? { background: bypassed ? 'var(--broken-bg)' : 'var(--safe-bg)' } : undefined}>
                  <td>{u.id}</td>
                  <td className="mono">{u.name}</td>
                  <td className="mono">{u.password}</td>
                  <td>{u.role}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className={`callout ${parameterize ? 'safe' : injected || bypassed ? 'broken' : ''}`}>
        {parameterize
          ? 'Parameterized: the SQL text is fixed and the values travel separately, so the database never parses them as SQL. Quotes, dashes and OR are just characters in a name.'
          : injected
            ? 'Your input escaped its quotes and changed the query itself. Escaping quotes by hand is easy to get wrong; placeholders remove the problem.'
            : 'Looks fine with ordinary input. Try a name with a quote in it.'}
      </p>
    </Section>
  )
}
