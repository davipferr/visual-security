# Visual Security

An interactive page about five classic web defenses (hashing, salting, JWT signatures,
output escaping and parameterized queries). Each one has a **Protected / Unprotected**
switch, so you can turn it off and watch what breaks.

Same stack as `mini-framer-motion`: React 19, TypeScript, Vite and Vitest. There is **no
backend and no database**. The "server", the "users table" and the "attacker" are plain
JavaScript running in the tab, and the crypto is the browser's own Web Crypto API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | The interactive page |
| `npm test` | Vitest: hashing test vectors, the cracking attack, JWT signing, the SQL engine |
| `npm run build` | Typecheck plus a static build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` |

## The page

The sidebar holds every defense. Each switch is also repeated next to its own section, and
**Protect everything** / **Break everything** flip them all at once.

1. **What a hash is**: two inputs and their SHA-256 hashes, with differing characters in red and
   a bar counting how many of the 256 bits changed. Then the same password with a random salt.
2. **The database leaks**: five users stored as plain text, SHA-256, salted SHA-256 or PBKDF2.
   *Run the attack* tries 16 common passwords against the stolen table:
   - plain text: nothing to crack;
   - unsalted: a table of hashes built in advance cracks everyone instantly, and two users with
     the same password show up as identical rows;
   - salted: every guess has to be hashed again for every user;
   - PBKDF2: every guess costs N iterations (slider). The page measures the real time and
     extrapolates to a 10-million-word list.
3. **JSON Web Tokens**: log in as `guest`, see the token split into header, payload and
   signature, edit the payload to `"role": "admin"` and call `GET /admin`. With the check off, the
   server believes the edited token. With it on, the recomputed signature doesn't match and the
   request gets a 401.
4. **Cross-site scripting**: a guestbook. With escaping on, comments are text. With it off, they
   are inserted as HTML, so you can fake page content, and a list shows which scripts or event
   handlers would run for every visitor. Unescaped comments render in a `sandbox=""` iframe and are
   scanned with an inert `DOMParser`, so nothing in them ever runs.
5. **SQL injection**: a login form against an in-memory table. The query is highlighted token by
   token: input that stays inside its quotes is green, input that turned into SQL is red, and
   anything commented out is struck through. Parameterized mode keeps the SQL fixed and passes the
   values separately.

## How it works

| File | |
| --- | --- |
| [`src/lib/hash.ts`](src/lib/hash.ts) | `sha256`, `pbkdf2`, `randomSalt`, and `digest`, which says what each storage scheme writes to the column |
| [`src/lib/crack.ts`](src/lib/crack.ts) | The attacker: precomputed lookup for unsalted hashes, one guess per salt otherwise |
| [`src/lib/jwt.ts`](src/lib/jwt.ts) | HS256 `sign` / `verify` with HMAC-SHA-256 and base64url |
| [`src/lib/html.ts`](src/lib/html.ts) | `escapeHtml`, and `findActiveContent` for spotting scripts, `on*` handlers and `javascript:` URLs |
| [`src/lib/toysql.ts`](src/lib/toysql.ts) | A tiny SQL engine (`SELECT * FROM t WHERE …` with `AND`/`OR`/`NOT`, `=`, `!=`, strings, numbers, `--` comments and `?` placeholders) over arrays |
| [`src/sections/`](src/sections) | One component per section |

The SQL engine is the core of the injection demo. It only ever receives one string, so it
can't know which characters the developer wrote and which the user typed. When the query is
built by concatenation, `concatenate` records where each value landed. The highlighter then
checks whether those characters ended up inside a string literal opened and closed by the
template (data) or anywhere else (code).

## Known limitations

These are deliberate, to keep the project small:

- The secret, the salts and the "server" all live in the page so you can see them. A real app
  keeps the secret and the hashes on the server.
- The wordlist has 16 entries. Real attacks use lists with millions of passwords and GPUs that
  compute billions of fast hashes per second.
- PBKDF2 is shown because the browser has it built in. For new projects, Argon2id or bcrypt are
  the usual recommendations.
- The SQL dialect covers only what the login query needs.
