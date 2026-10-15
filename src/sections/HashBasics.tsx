import { useState } from 'react'
import { bitDistance } from '../lib/encoding'
import { randomSalt, sha256 } from '../lib/hash'
import { Section } from '../Section'
import { useAsync } from '../useAsync'

function Hex({ value, against }: { value?: string; against?: string }) {
  if (!value) return <div className="hex">…</div>
  return (
    <div className="hex">
      {[...value].map((c, i) => (
        <span key={i} className={against && against[i] !== c ? 'diff' : undefined}>
          {c}
        </span>
      ))}
    </div>
  )
}

export function HashBasics() {
  const [a, setA] = useState('sunshine')
  const [b, setB] = useState('sunshinf')
  const [salt, setSalt] = useState(() => randomSalt())

  const hashes = useAsync(() => Promise.all([sha256(a), sha256(b), sha256(salt + a)]), [a, b, salt])
  const [ha, hb, hs] = hashes ?? []
  const bits = ha && hb ? bitDistance(ha, hb) : 0

  return (
    <Section
      step={1}
      title="What a hash is"
      intro={
        <>
          A hash turns any text into a fixed-size fingerprint. You can't run it backwards, and changing
          one letter changes about half of the 256 output bits. Servers store the fingerprint and compare
          fingerprints at login, so they never need to keep the password itself.
        </>
      }
    >
      <div className="split">
        <div className="panel">
          <label className="field">
            Password A
            <input type="text" value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <span className="small muted">SHA-256(A)</span>
          <Hex value={ha} />
        </div>
        <div className="panel">
          <label className="field">
            Password B (try changing one letter)
            <input type="text" value={b} onChange={(e) => setB(e.target.value)} />
          </label>
          <span className="small muted">SHA-256(B): characters that differ from A are red</span>
          <Hex value={hb} against={ha} />
        </div>
      </div>

      <div className="panel">
        <div className="row small">
          <span>
            <b>{bits}</b> of 256 bits differ ({((bits / 256) * 100).toFixed(0)}%)
            {a === b && '. Same input, same hash, every time.'}
          </span>
        </div>
        <div className="bitbar" aria-hidden>
          <i style={{ width: `${(bits / 256) * 100}%` }} />
        </div>
      </div>

      <div className="panel">
        <h3>Adding a salt</h3>
        <p className="small muted">
          A salt is random text stored next to the hash and mixed in before hashing. The same password
          now gives a different fingerprint for every user, so one precomputed table can't cover them all.
        </p>
        <div className="row">
          <code>salt = {salt}</code>
          <button className="chip" onClick={() => setSalt(randomSalt())}>
            New salt
          </button>
        </div>
        <span className="small muted">SHA-256(salt + A): red where it differs from the unsalted hash</span>
        <Hex value={hs} against={ha} />
      </div>
    </Section>
  )
}
