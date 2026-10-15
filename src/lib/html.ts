const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Turns markup characters into entities, so the browser shows them instead of obeying them. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => entities[c])

export interface ActiveContent {
  kind: 'script tag' | 'event handler' | 'javascript: link'
  where: string
  code: string
}

/**
 * Finds everything in `html` that a browser would execute. DOMParser builds an inert
 * document, so nothing found here ever runs.
 */
export function findActiveContent(html: string): ActiveContent[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const found: ActiveContent[] = []
  for (const el of doc.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'script') found.push({ kind: 'script tag', where: '<script>', code: el.textContent?.trim() ?? '' })
    for (const attr of el.attributes) {
      if (attr.name.startsWith('on')) {
        found.push({ kind: 'event handler', where: `<${tag} ${attr.name}>`, code: attr.value })
      } else if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) {
        found.push({ kind: 'javascript: link', where: `<${tag} ${attr.name}>`, code: attr.value })
      }
    }
  }
  return found
}
