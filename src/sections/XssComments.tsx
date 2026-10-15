import { useState } from 'react'
import { Guard } from '../Controls'
import { escapeHtml, findActiveContent } from '../lib/html'
import { Section } from '../Section'

interface Comment {
  id: number
  author: string
  text: string
}

const presets = [
  { label: 'Normal comment', text: 'Great post, thanks!' },
  { label: 'Bold text', text: 'I <b>loved</b> this' },
  { label: 'Fake page content', text: '<h2 style="color:#e03131;margin:0">This site has been hacked</h2>' },
  { label: 'Image handler', text: `<img src="missing.png" onerror="alert('XSS')">` },
  { label: 'Script tag', text: `<script>alert('XSS')</script>` },
]

const seed: Comment[] = [
  { id: 1, author: 'alice', text: 'Nice article about security.' },
  { id: 2, author: 'bob', text: 'Does this work with React?' },
]

/** A stand-in page for an unescaped comment. `sandbox=""` blocks all scripts, so nothing in it runs. */
const frame = (html: string) =>
  `<!doctype html><meta charset="utf-8"><style>body{margin:8px 10px;font:15px/1.5 system-ui,sans-serif;color:#16181d}</style>${html}`

function Source({ html, escaped }: { html: string; escaped: boolean }) {
  const parts = html.split(escaped ? /(&(?:amp|lt|gt|quot|#39);)/ : /(<[^>]*>)/)
  return (
    <div className="source">
      {'<div class="comment">'}
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className={escaped ? 'entity' : 'tag'}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
      {'</div>'}
    </div>
  )
}

export function XssComments({ escape, onEscape }: { escape: boolean; onEscape: (v: boolean) => void }) {
  const [comments, setComments] = useState(seed)
  const [draft, setDraft] = useState(presets[3].text)

  const post = () => {
    if (!draft.trim()) return
    setComments((c) => [...c, { id: Date.now(), author: 'you', text: draft }])
  }

  const outgoing = escape ? escapeHtml(draft) : draft
  const active = escape ? [] : comments.flatMap((c) => findActiveContent(c.text).map((a) => ({ ...a, author: c.author })))
  const draftActive = findActiveContent(draft)

  return (
    <Section
      step={4}
      title="Cross-site scripting (XSS)"
      intro={
        <>
          A guestbook stores comments and shows them to every visitor. If the server pastes comment text
          straight into its HTML, the browser can't tell your markup from the commenter's, and treats
          their tags as part of your page, scripts included.
        </>
      }
      aside={<Guard label="Output escaping" value={escape} onChange={onEscape} />}
    >
      <div className="split">
        <div className="panel">
          <h3>Write a comment</h3>
          <div className="presets">
            {presets.map((p) => (
              <button key={p.label} className="chip" onClick={() => setDraft(p.text)}>
                {p.label}
              </button>
            ))}
          </div>
          <textarea rows={3} value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
          <div className="row">
            <button className="primary" onClick={post}>
              Post comment
            </button>
            <button onClick={() => setComments(seed)}>Reset guestbook</button>
          </div>
          <span className="small muted">What the server puts in the page for this comment</span>
          <Source html={outgoing} escaped={escape} />
          <p className="small muted">
            {escape
              ? 'Escaped: < becomes &lt; and so on. The browser shows those characters as text.'
              : draftActive.length
                ? 'Raw: the red parts are real tags. The browser will obey them.'
                : 'Raw: any tags in the text become real tags on the page.'}
          </p>
        </div>

        <div className="panel">
          <h3>What every visitor sees</h3>
          <div className="comments">
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-meta">{c.author}</div>
                {escape ? (
                  <div className="comment-body">{c.text}</div>
                ) : (
                  <iframe title={`Comment by ${c.author}`} sandbox="" srcDoc={frame(c.text)} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {active.length > 0 && (
        <div className="alarm" role="alert">
          <strong>On a real unprotected site, this code would now run in every visitor's browser:</strong>
          <ul>
            {active.map((a, i) => (
              <li key={i}>
                <code>{a.code || '(empty)'}</code> <span className="muted small">from {a.where}, posted by {a.author}</span>
              </li>
            ))}
          </ul>
          <span className="small">
            Here it's only <code>alert</code>, but it would run as your site, with the visitor's session.
            It could read whatever the page shows, change it, or make requests that the server believes
            came from the visitor. (In this demo each comment sits in a sandboxed frame with scripts
            disabled, so nothing actually ran.)
          </span>
        </div>
      )}

      <p className={`callout ${escape ? 'safe' : 'broken'}`}>
        {escape
          ? "Escaping turns every comment into plain text. React does this for you whenever you write {text}; the danger comes back with dangerouslySetInnerHTML, innerHTML or building HTML strings. Add a Content-Security-Policy header as a second layer, and HttpOnly cookies so scripts can't read the session."
          : 'Unprotected: comment text goes straight into the HTML. Even without scripts, anyone can restyle or fake your page.'}
      </p>
    </Section>
  )
}
