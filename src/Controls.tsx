import type { ReactNode } from 'react'
import { storageLabels, type Storage } from './lib/hash'

export interface Defenses {
  storage: Storage
  iterations: number
  verifyJwt: boolean
  escapeHtml: boolean
  parameterize: boolean
}

export const allProtected: Defenses = {
  storage: 'pbkdf2',
  iterations: 100_000,
  verifyJwt: true,
  escapeHtml: true,
  parameterize: true,
}

export const allBroken: Defenses = {
  storage: 'plain',
  iterations: 100_000,
  verifyJwt: false,
  escapeHtml: false,
  parameterize: false,
}

/** The protected / unprotected switch used in the sidebar and in each section. */
export function Guard({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <div className="guard" role="group" aria-label={label}>
      <button className={value ? '' : 'on broken'} aria-pressed={!value} onClick={() => onChange(false)}>
        Unprotected
      </button>
      <button className={value ? 'on safe' : ''} aria-pressed={value} onClick={() => onChange(true)}>
        Protected
      </button>
    </div>
  )
}

export function Status({ safe }: { safe: boolean }) {
  return <span className={`status ${safe ? 'safe' : 'broken'}`}>{safe ? 'Protected' : 'Unprotected'}</span>
}

function Item({ title, hint, children }: { title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <div className="defense">
      <div>
        <strong>{title}</strong>
        <p className="muted small">{hint}</p>
      </div>
      {children}
    </div>
  )
}

export function Controls({ defenses, onChange }: { defenses: Defenses; onChange: (d: Defenses) => void }) {
  const set = (patch: Partial<Defenses>) => onChange({ ...defenses, ...patch })
  const score = [
    defenses.storage === 'pbkdf2',
    defenses.verifyJwt,
    defenses.escapeHtml,
    defenses.parameterize,
  ].filter(Boolean).length

  return (
    <aside className="card controls">
      <div>
        <h2>Your site's defenses</h2>
        <p className="muted small">Each switch also appears next to its section. Turn them off and watch it break.</p>
      </div>

      <div className="presets">
        <button className="chip safe" onClick={() => onChange({ ...allProtected, iterations: defenses.iterations })}>
          Protect everything
        </button>
        <button className="chip broken" onClick={() => onChange({ ...allBroken, iterations: defenses.iterations })}>
          Break everything
        </button>
      </div>

      <div className="meter" aria-label={`${score} of 4 defenses on`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < score ? 'lit' : ''} />
        ))}
        <span className="small muted">{score} / 4 on</span>
      </div>

      <Item title="Password storage" hint="How the users table keeps passwords.">
        <label className="select">
          <select value={defenses.storage} onChange={(e) => set({ storage: e.target.value as Storage })}>
            {Object.entries(storageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {defenses.storage === 'pbkdf2' && (
          <label className="slider">
            <span className="slider-label">
              <span>PBKDF2 iterations</span>
              <output>{defenses.iterations.toLocaleString()}</output>
            </span>
            <input
              type="range"
              min={1000}
              max={600_000}
              step={1000}
              value={defenses.iterations}
              onChange={(e) => set({ iterations: Number(e.target.value) })}
            />
          </label>
        )}
      </Item>

      <Item title="JWT signature check" hint="Does the server verify tokens before trusting them?">
        <Guard label="JWT signature check" value={defenses.verifyJwt} onChange={(verifyJwt) => set({ verifyJwt })} />
      </Item>

      <Item title="Output escaping" hint="Is user text escaped before it goes into the HTML?">
        <Guard label="Output escaping" value={defenses.escapeHtml} onChange={(escapeHtml) => set({ escapeHtml })} />
      </Item>

      <Item title="Parameterized queries" hint="Are user values kept apart from the SQL text?">
        <Guard
          label="Parameterized queries"
          value={defenses.parameterize}
          onChange={(parameterize) => set({ parameterize })}
        />
      </Item>
    </aside>
  )
}
