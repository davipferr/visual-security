import { useEffect, useState } from 'react'
import { Guard } from '../Controls'
import { decodePart, encodePart, sign, split, verify, type Claims, type Verification } from '../lib/jwt'
import { Section } from '../Section'

/** Lives on the server. It is shown on the page only so you can see what the server does. */
const SERVER_SECRET = 'k3ep-th1s-0n-the-server'

interface Response {
  status: 200 | 401 | 403 | 400
  body: string
  check: Verification | null
  trusted: boolean
}

/** The in-page "server" route `GET /admin`. */
async function getAdmin(token: string, checkSignature: boolean): Promise<Response> {
  let check: Verification | null = null
  try {
    split(token)
    if (checkSignature) {
      check = await verify(token, SERVER_SECRET)
      if (!check.valid) return { status: 401, body: 'Invalid signature. This token was not issued by us.', check, trusted: false }
    }
    const claims = decodePart(split(token)[1])
    if (claims.role !== 'admin') return { status: 403, body: `Sorry ${String(claims.sub)}, admins only.`, check, trusted: true }
    return {
      status: 200,
      body: `Welcome, admin ${String(claims.sub)}. Here are all 5 user records, the billing settings and the delete button.`,
      check,
      trusted: true,
    }
  } catch {
    return { status: 400, body: 'That is not a readable token.', check, trusted: false }
  }
}

function Token({ token }: { token: string }) {
  const [h, p, s] = token.split('.')
  return (
    <div className="token" aria-label="JWT">
      <span className="jwt-header">{h}</span>.<span className="jwt-payload">{p}</span>.
      <span className="jwt-signature">{s}</span>
    </div>
  )
}

const pretty = (claims: Claims) => JSON.stringify(claims, null, 2)

export function JwtForgery({ verify: checkSignature, onVerify }: { verify: boolean; onVerify: (v: boolean) => void }) {
  const [issued, setIssued] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [response, setResponse] = useState<Response | null>(null)

  const login = async () => {
    const payload = { sub: 'guest', role: 'user', iat: Math.floor(Date.now() / 1000) }
    setIssued(await sign(payload, SERVER_SECRET))
    setDraft(pretty(payload))
    setResponse(null)
  }

  useEffect(() => {
    login()
  }, [])

  useEffect(() => setResponse(null), [checkSignature, draft])

  // The attacker can rewrite the payload, but has no secret, so the old signature rides along.
  let edited: string | null = null
  let draftError = ''
  if (issued) {
    try {
      const [h, , s] = split(issued)
      edited = `${h}.${encodePart(JSON.parse(draft))}.${s}`
    } catch {
      draftError = 'Not valid JSON yet.'
    }
  }
  const tampered = edited !== null && edited !== issued
  const send = async () => edited && setResponse(await getAdmin(edited, checkSignature))

  const header = issued ? decodePart(split(issued)[0]) : null

  return (
    <Section
      step={3}
      title="JSON Web Tokens"
      intro={
        <>
          After login the server hands you a token saying who you are. The browser sends it back with every
          request. Its middle part is only base64, so anyone can read and edit it. The signature at the end
          is what stops you from lying, but only if the server checks it.
        </>
      }
      aside={<Guard label="JWT signature check" value={checkSignature} onChange={onVerify} />}
    >
      {issued && header && (
        <>
          <Token token={edited ?? issued} />
          <div className="split">
            <div className="panel">
              <span className="part-title jwt-header">Header (base64, readable)</span>
              <pre className="json">{pretty(header)}</pre>
              <span className="part-title jwt-signature">Signature</span>
              <p className="small muted">
                HMAC-SHA256(header + "." + payload, secret). Only someone with the secret can make one that
                matches. Server secret: <code>{SERVER_SECRET}</code>
              </p>
            </div>
            <div className="panel">
              <span className="part-title jwt-payload">Payload (base64, editable): try role "admin"</span>
              <textarea rows={6} value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
              {draftError && <span className="small cracked">{draftError}</span>}
            </div>
          </div>
        </>
      )}

      <div className="row">
        <button className="primary" onClick={send} disabled={!edited}>
          Send GET /admin
        </button>
        <button onClick={login}>Log in again as guest</button>
        <span className="small muted">{tampered ? 'Payload edited; signature unchanged.' : 'Untouched token.'}</span>
      </div>

      {response && (
        <div className={`response ${response.status === 200 && tampered ? 'danger' : response.status === 200 ? 'ok' : 'denied'}`}>
          <span className="code">
            {response.status}{' '}
            {{ 200: 'OK', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden' }[response.status]}
          </span>
          <span>{response.body}</span>
          {response.check ? (
            <span className="small mono">
              expected signature <span className="jwt-signature">{response.check.expected}</span>
              <br />
              token's signature&nbsp; <span className="jwt-signature">{response.check.actual}</span>{' '}
              {response.check.valid ? '✓ match' : '✗ mismatch'}
            </span>
          ) : (
            <span className="small">The server decoded the payload and believed it without checking the signature.</span>
          )}
        </div>
      )}

      {response?.status === 200 && tampered && (
        <p className="callout broken">
          You just made yourself an admin by editing some JSON. Turn on the signature check: the server
          recomputes the signature with its secret, sees it doesn't match, and rejects the token.
        </p>
      )}
      {response?.status === 401 && (
        <p className="callout safe">
          Rejected. Changing even one character of the payload changes the signature it needs, and without
          the secret you can't compute the new one. Keep secrets out of the payload too: it is readable, not
          encrypted.
        </p>
      )}
    </Section>
  )
}
