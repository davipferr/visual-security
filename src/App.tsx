import { useState } from 'react'
import { allProtected, Controls, type Defenses } from './Controls'
import { HashBasics } from './sections/HashBasics'
import { JwtForgery } from './sections/JwtForgery'
import { LeakedDatabase } from './sections/LeakedDatabase'
import { SqlInjection } from './sections/SqlInjection'
import { XssComments } from './sections/XssComments'

export function App() {
  const [defenses, setDefenses] = useState<Defenses>(allProtected)
  const set = (patch: Partial<Defenses>) => setDefenses((d) => ({ ...d, ...patch }))

  return (
    <div className="page">
      <header className="page-header">
        <h1>Web security, visually</h1>
        <p>
          Five classic defenses, each with a switch. Everything runs in this tab: the "server", the
          "database" and the "attacker" are plain JavaScript, so you can break things safely.
        </p>
      </header>

      <div className="layout">
        <Controls defenses={defenses} onChange={setDefenses} />
        <main className="sections">
          <HashBasics />
          <LeakedDatabase
            storage={defenses.storage}
            iterations={defenses.iterations}
            onStorage={(storage) => set({ storage })}
          />
          <JwtForgery verify={defenses.verifyJwt} onVerify={(verifyJwt) => set({ verifyJwt })} />
          <XssComments escape={defenses.escapeHtml} onEscape={(escapeHtml) => set({ escapeHtml })} />
          <SqlInjection
            parameterize={defenses.parameterize}
            onParameterize={(parameterize) => set({ parameterize })}
          />
        </main>
      </div>
    </div>
  )
}
