/**
 * A very small SQL engine over an in-memory array. It understands just enough:
 *
 *   SELECT * FROM <table> [WHERE <expr>] [;] [-- comment]
 *   expr: OR / AND / NOT, `=` and `!=`, 'strings' ('' escapes a quote), numbers,
 *         column names, parentheses and `?` placeholders.
 *
 * The point is not SQL; it's that the engine sees one string and cannot tell which
 * characters came from the developer and which came from the user.
 */

export type Value = string | number
export type Row = Record<string, Value>

export type TokenKind = 'keyword' | 'ident' | 'string' | 'number' | 'op' | 'param' | 'comment'

export interface Token {
  kind: TokenKind
  text: string
  start: number
  end: number
  value?: Value
}

export class SqlError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message)
  }
}

const KEYWORDS = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT'])

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (kind: TokenKind, start: number, value?: Value) =>
    tokens.push({ kind, text: sql.slice(start, i), start, end: i, value })

  while (i < sql.length) {
    const c = sql[i]
    const start = i
    if (/\s/.test(c)) {
      i++
    } else if (c === '-' && sql[i + 1] === '-') {
      i = sql.length
      push('comment', start)
    } else if (c === "'") {
      let value = ''
      i++
      for (;;) {
        if (i >= sql.length) throw new SqlError('unterminated string literal', start)
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            value += "'"
            i += 2
            continue
          }
          i++
          break
        }
        value += sql[i++]
      }
      push('string', start, value)
    } else if (/[0-9]/.test(c)) {
      while (i < sql.length && /[0-9]/.test(sql[i])) i++
      push('number', start, Number(sql.slice(start, i)))
    } else if (/[A-Za-z_]/.test(c)) {
      while (i < sql.length && /[A-Za-z0-9_]/.test(sql[i])) i++
      push(KEYWORDS.has(sql.slice(start, i).toUpperCase()) ? 'keyword' : 'ident', start)
    } else if (c === '!' && sql[i + 1] === '=') {
      i += 2
      push('op', start)
    } else if ('=(),*;'.includes(c)) {
      i++
      push('op', start)
    } else if (c === '?') {
      i++
      push('param', start)
    } else {
      throw new SqlError(`unexpected character "${c}"`, start)
    }
  }
  return tokens
}

type Expr =
  | { type: 'or' | 'and'; left: Expr; right: Expr }
  | { type: 'not'; expr: Expr }
  | { type: 'cmp'; op: '=' | '!='; left: Expr; right: Expr }
  | { type: 'literal'; value: Value }
  | { type: 'column'; name: string }
  | { type: 'param'; index: number }

interface Select {
  table: string
  where: Expr | null
}

function parse(all: Token[], sqlLength: number): Select {
  const tokens = all.filter((t) => t.kind !== 'comment')
  let pos = 0
  let params = 0
  const peek = () => tokens[pos]
  const at = () => peek()?.start ?? sqlLength
  const isWord = (word: string) => peek()?.kind === 'keyword' && peek().text.toUpperCase() === word
  const isOp = (op: string) => peek()?.kind === 'op' && peek().text === op
  const expectWord = (word: string) => {
    if (!isWord(word)) throw new SqlError(`expected ${word}`, at())
    pos++
  }

  const primary = (): Expr => {
    const t = peek()
    if (!t) throw new SqlError('unexpected end of query', sqlLength)
    pos++
    if (t.kind === 'string' || t.kind === 'number') return { type: 'literal', value: t.value! }
    if (t.kind === 'ident') return { type: 'column', name: t.text }
    if (t.kind === 'param') return { type: 'param', index: params++ }
    if (t.kind === 'op' && t.text === '(') {
      const inner = or()
      if (!isOp(')')) throw new SqlError('expected )', at())
      pos++
      return inner
    }
    throw new SqlError(`syntax error near "${t.text}"`, t.start)
  }
  const comparison = (): Expr => {
    const left = primary()
    if (isOp('=') || isOp('!=')) {
      const op = tokens[pos++].text as '=' | '!='
      return { type: 'cmp', op, left, right: primary() }
    }
    return left
  }
  const not = (): Expr => {
    if (isWord('NOT')) {
      pos++
      return { type: 'not', expr: not() }
    }
    return comparison()
  }
  const and = (): Expr => {
    let left = not()
    while (isWord('AND')) {
      pos++
      left = { type: 'and', left, right: not() }
    }
    return left
  }
  const or = (): Expr => {
    let left = and()
    while (isWord('OR')) {
      pos++
      left = { type: 'or', left, right: and() }
    }
    return left
  }

  expectWord('SELECT')
  if (!isOp('*')) throw new SqlError('only SELECT * is supported', at())
  pos++
  expectWord('FROM')
  const table = peek()
  if (table?.kind !== 'ident') throw new SqlError('expected a table name', at())
  pos++
  let where: Expr | null = null
  if (isWord('WHERE')) {
    pos++
    where = or()
  }
  if (isOp(';')) pos++
  if (pos < tokens.length) throw new SqlError(`syntax error near "${peek().text}"`, at())
  return { table: table.text, where }
}

const truthy = (v: Value) => Number(v) !== 0 && !Number.isNaN(Number(v))

function evaluate(expr: Expr, row: Row, params: Value[]): Value {
  switch (expr.type) {
    case 'literal':
      return expr.value
    case 'column':
      if (!(expr.name in row)) throw new SqlError(`no such column: ${expr.name}`, -1)
      return row[expr.name]
    case 'param':
      if (expr.index >= params.length) throw new SqlError(`missing value for parameter ${expr.index + 1}`, -1)
      return params[expr.index]
    case 'cmp': {
      const equal = String(evaluate(expr.left, row, params)) === String(evaluate(expr.right, row, params))
      return Number(expr.op === '=' ? equal : !equal)
    }
    case 'not':
      return Number(!truthy(evaluate(expr.expr, row, params)))
    case 'and':
      return Number(truthy(evaluate(expr.left, row, params)) && truthy(evaluate(expr.right, row, params)))
    case 'or':
      return Number(truthy(evaluate(expr.left, row, params)) || truthy(evaluate(expr.right, row, params)))
  }
}

/** Runs `sql` against the named in-memory tables. `params` fill the `?` placeholders in order. */
export function query(sql: string, tables: Record<string, Row[]>, params: Value[] = []): Row[] {
  const { table, where } = parse(tokenize(sql), sql.length)
  const rows = tables[table]
  if (!rows) throw new SqlError(`no such table: ${table}`, -1)
  return where ? rows.filter((row) => truthy(evaluate(where, row, params))) : [...rows]
}

/** Builds a query by pasting values between fixed pieces, remembering where each value landed. */
export function concatenate(pieces: string[], values: string[]) {
  let sql = ''
  const spans: { start: number; end: number }[] = []
  pieces.forEach((piece, i) => {
    sql += piece
    if (i < values.length) {
      spans.push({ start: sql.length, end: sql.length + values[i].length })
      sql += values[i]
    }
  })
  return { sql, spans }
}
