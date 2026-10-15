import { useEffect, useMemo, useState } from 'react'
import { Status } from '../Controls'
import { attack, commonPasswords, type AttackReport, type CrackResult, type StoredUser } from '../lib/crack'
import { digest, randomSalt, storageLabels, usesSalt, type Storage } from '../lib/hash'
import { Section } from '../Section'
import { useAsync } from '../useAsync'

/** The site's real users. Alice and Carol happen to share a password. */
const accounts = [
  { name: 'alice', password: 'sunshine' },
  { name: 'bob', password: 'password123' },
  { name: 'carol', password: 'sunshine' },
  { name: 'dave', password: 'correct horse battery staple' },
  { name: 'erin', password: 'dragon' },
]

const WORDLIST_SIZE = 10_000_000

function duration(ms: number): string {
  if (!Number.isFinite(ms)) return '…'
  const s = ms / 1000
  if (s < 1) return `${ms.toFixed(0)} ms`
  if (s < 120) return `${s.toFixed(1)} s`
  if (s < 7200) return `${(s / 60).toFixed(0)} min`
  if (s < 172_800) return `${(s / 3600).toFixed(0)} hours`
  if (s < 63_072_000) return `${(s / 86_400).toFixed(0)} days`
  return `${(s / 31_536_000).toFixed(1)} years`
}

export function LeakedDatabase({
  storage,
  iterations,
  onStorage,
}: {
  storage: Storage
  iterations: number
  onStorage: (storage: Storage) => void
}) {
  // One salt per user, created when the account is made, stored in plain sight.
  const salts = useMemo(() => accounts.map(() => randomSalt()), [])
  const table = useAsync<StoredUser[]>(
    () =>
      Promise.all(
        accounts.map(async (a, i) => ({
          name: a.name,
          salt: salts[i],
          stored: await digest(a.password, storage, salts[i], iterations),
        })),
      ),
    [storage, iterations, salts],
  )

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<CrackResult[]>([])
  const [report, setReport] = useState<AttackReport | null>(null)

  // A new storage scheme means a new leak; forget the old attack.
  useEffect(() => {
    setReport(null)
    setProgress([])
  }, [storage, iterations])

  const run = async () => {
    if (!table) return
    setRunning(true)
    setReport(null)
    setProgress([])
    setReport(await attack(table, storage, iterations, setProgress))
    setRunning(false)
  }

  const results = report?.results ?? progress
  const resultFor = (name: string) => results.find((r) => r.name === name)
  const twins = new Set(
    (table ?? []).filter((u, _, all) => all.some((o) => o !== u && o.stored === u.stored)).map((u) => u.name),
  )
  const cracked = results.filter((r) => r.password).length
  const salted = usesSalt(storage)
  const perHash = report && report.hashes ? report.ms / report.hashes : 0

  return (
    <Section
      step={2}
      title="The database leaks"
      intro={
        <>
          Assume the worst: an attacker has copied your users table. What they can do with it depends
          only on how you stored the passwords. Their weapon here is a list of {commonPasswords.length}{' '}
          common passwords; real lists hold millions.
        </>
      }
      aside={<Status safe={storage === 'pbkdf2'} />}
    >
      <div className="presets">
        {(Object.keys(storageLabels) as Storage[]).map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={s === storage}
            style={s === storage ? { background: 'var(--accent)', color: 'var(--accent-text)' } : undefined}
            onClick={() => onStorage(s)}
          >
            {storageLabels[s]}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>user</th>
              {salted && <th>salt</th>}
              <th>stored password column</th>
              <th>attacker got</th>
            </tr>
          </thead>
          <tbody>
            {(table ?? []).map((u) => {
              const r = resultFor(u.name)
              return (
                <tr key={u.name} className={twins.has(u.name) ? 'twin' : undefined}>
                  <td>{u.name}</td>
                  {salted && <td className="mono">{u.salt}</td>}
                  <td className="mono">{u.stored}</td>
                  <td>
                    {!r ? (
                      <span className="muted">{running ? '…' : ''}</span>
                    ) : r.password ? (
                      <span className="cracked">{r.password}</span>
                    ) : (
                      <span className="held">not cracked</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {twins.size > 0 && storage !== 'plain' && (
        <p className="callout broken">
          The orange rows have identical hashes, so the attacker knows {[...twins].join(' and ')} share a
          password without cracking anything. Crack one and you have both.
        </p>
      )}

      <div className="row">
        <button className="primary" onClick={run} disabled={running || !table}>
          {running ? 'Attacking…' : 'Run the attack'}
        </button>
        <span className="small muted">Runs right here in your browser.</span>
      </div>

      {report && (
        <>
          <dl className="stats">
            <div>
              <dt>Passwords recovered</dt>
              <dd className={cracked ? 'cracked' : 'held'}>
                {cracked} / {accounts.length}
              </dd>
            </div>
            <div>
              <dt>Hashes computed during the attack</dt>
              <dd>{report.hashes.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Time taken</dt>
              <dd>{duration(report.ms)}</dd>
            </div>
            {salted && perHash > 0 && (
              <div>
                <dt>A {WORDLIST_SIZE.toLocaleString()}-word list, per user</dt>
                <dd>{duration(perHash * WORDLIST_SIZE)}</dd>
              </div>
            )}
          </dl>
          <p className={`callout ${storage === 'pbkdf2' ? 'safe' : 'broken'}`}>
            {report.method}{' '}
            {storage === 'plain' && 'Every password is exposed, including ones reused on other sites.'}
            {storage === 'sha256' &&
              'Hashing alone hides nothing when people pick common passwords; the table was built before the leak.'}
            {storage === 'salted' &&
              'Better: no shared table and no twins. But SHA-256 is built to be fast, so guessing is still cheap.'}
            {storage === 'pbkdf2' &&
              `Each guess now costs ${iterations.toLocaleString()} rounds. Weak passwords still fall eventually, but every guess is slow and must be repeated per user. Dave's long passphrase isn't on any list.`}
          </p>
        </>
      )}
    </Section>
  )
}
