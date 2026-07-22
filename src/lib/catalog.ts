/** Katalog całego słownika KSPJM (generowany przez scripts/crawl-dictionary.mjs). */

export interface CatalogEntry {
  id: number
  words: string[]
  uses: string[]
  video: string
  poster: string | null
  handshape: string | null
  localization: string | null
}

const BASE = 'https://www.slownikpjm.uw.edu.pl'

export const kspjmVideoUrl = (e: CatalogEntry) => `${BASE}${e.video}`
export const kspjmPosterUrl = (e: CatalogEntry) => (e.poster ? `${BASE}${e.poster}` : undefined)
export const kspjmGlossUrl = (id: number) => `${BASE}/gloss/view/${id}`
export const KSPJM_URL = BASE

let catalogPromise: Promise<CatalogEntry[]> | null = null

export function loadCatalog(): Promise<CatalogEntry[]> {
  catalogPromise ??= fetch('/data/catalog.json').then((res) => {
    if (!res.ok) throw new Error(`Nie można wczytać katalogu słownika (HTTP ${res.status})`)
    return res.json() as Promise<CatalogEntry[]>
  })
  return catalogPromise
}

export function findEntry(catalog: CatalogEntry[], id: number): CatalogEntry | undefined {
  return catalog.find((e) => e.id === id)
}

/** Wyszukiwanie po odpowiednikach: dokładne → od początku słowa → zawiera. */
export function searchCatalog(catalog: CatalogEntry[], query: string, limit = 60): CatalogEntry[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const exact: CatalogEntry[] = []
  const starts: CatalogEntry[] = []
  const contains: CatalogEntry[] = []
  for (const e of catalog) {
    let matched: 'exact' | 'starts' | 'contains' | null = null
    for (const w of e.words) {
      const lw = w.toLowerCase()
      if (lw === q || lw.split(/[,;] ?/).includes(q)) {
        matched = 'exact'
        break
      }
      if (lw.startsWith(q)) matched = matched ?? 'starts'
      else if (lw.includes(q)) matched ??= 'contains'
    }
    if (matched === 'exact') exact.push(e)
    else if (matched === 'starts') starts.push(e)
    else if (matched === 'contains') contains.push(e)
    if (exact.length >= limit) break
  }
  return [...exact, ...starts, ...contains].slice(0, limit)
}
