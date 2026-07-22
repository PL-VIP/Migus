// Crawler Korpusowego Słownika PJM (https://www.slownikpjm.uw.edu.pl/).
//
// Przechodzi przez wszystkie hasła (gloss/view/1..MAX_ID) i buduje katalog
// całego słownika: polskie odpowiedniki, typ użycia, plik wideo znaku,
// plakat, kształt dłoni i lokalizację. Wyniki są cache'owane per hasło
// w .cache/gloss/, więc przerwany crawl można wznowić bez ponownych żądań.
//
// Użycie:
//   node scripts/crawl-dictionary.mjs            # pełny crawl (1..MAX_ID)
//   node scripts/crawl-dictionary.mjs 100 200    # zakres identyfikatorów
//
// Wynik: public/data/catalog.json
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://www.slownikpjm.uw.edu.pl'
const MAX_ID = 3520
const DELAY_MS = 250
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache', 'gloss')
const outFile = join(root, 'public', 'data', 'catalog.json')

const fromArg = Number(process.argv[2] ?? 1)
const toArg = Number(process.argv[3] ?? MAX_ID)

mkdirSync(cacheDir, { recursive: true })
mkdirSync(dirname(outFile), { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parsuje stronę hasła; zwraca null, gdy strona nie jest hasłem. */
export function parseGlossPage(id, html) {
  const videoBlock = html.match(
    /<video id="gloss_view_video"[\s\S]*?<\/video>/,
  )?.[0]
  if (!videoBlock) return null
  const video = videoBlock.match(/<source src="(\/media\/video\/[^"]+\.mp4)"/)?.[1] ?? null
  const poster = videoBlock.match(/poster="([^"]+)"/)?.[1] ?? null

  // Znaczenia: sekcja ol_znaczenia do PRZYKŁADY/POWIĄZANE.
  const meaningsBlock = html.match(/<ol class="ol_znaczenia"[\s\S]*?(?=<h3>|<\/div>\s*<div class="col-md-4)/)?.[0] ?? ''
  const uses = [...meaningsBlock.matchAll(/<li><em>w użyciu ([^:<]+):<\/em><\/li>/g)].map((m) =>
    decodeEntities(m[1]),
  )

  const words = []
  const senses = []
  for (const li of meaningsBlock.matchAll(/<li>\s*(?:&lt;&lt;([\s\S]*?)&gt;&gt;<br\s*\/?>)?\s*([^<]+?)\s*<\/li>/g)) {
    const def = li[1] ? decodeEntities(li[1]) : null
    const word = decodeEntities(li[2])
    if (!word || word.startsWith('w użyciu')) continue
    senses.push({ word, def })
    if (!words.includes(word)) words.push(word)
  }

  const handshape = html.match(/alt="([^"]*)"[^>]*data-id_handshape/)?.[1]
    ?? html.match(/data-id_handshape="\d+"[^>]*alt="([^"]*)"/)?.[1] ?? null
  const handshapeImg = html.match(/src="(\/img\/handshapes_new\/[^"]+)"[^>]*class="[^"]*img-handshapes-view/)?.[1] ?? null
  const localization = html.match(/src="\/img\/localizations_new\/[^"]+"[^>]*alt="([^"]*)"/)?.[1]
    ?? html.match(/alt="([^"]*)"[^>]*data-id_localization/)?.[1] ?? null

  if (words.length === 0 && !video) return null
  return { id, words, uses, senses, video, poster, handshape, handshapeImg, localization }
}

async function fetchGloss(id) {
  const cacheFile = join(cacheDir, `${id}.json`)
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'))
  }
  let entry = { id, missing: true }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/gloss/view/${id}`, {
        headers: { 'User-Agent': 'Migus-edu-crawler (projekt edukacyjny PJM; kontakt przez GitHub PL-VIP/Migus)' },
      })
      if (res.status === 404) break
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const parsed = parseGlossPage(id, html)
      entry = parsed ?? { id, missing: true }
      break
    } catch (err) {
      if (attempt === 2) {
        console.error(`  id=${id}: ${err.message} - pomijam`)
        entry = { id, error: String(err.message) }
      } else {
        await sleep(1500 * (attempt + 1))
      }
    }
  }
  writeFileSync(cacheFile, JSON.stringify(entry))
  return entry
}

function writeCatalog() {
  const entries = []
  for (const f of readdirSync(cacheDir)) {
    if (!f.endsWith('.json')) continue
    const e = JSON.parse(readFileSync(join(cacheDir, f), 'utf8'))
    if (!e.missing && !e.error && e.words?.length > 0 && e.video) entries.push(e)
  }
  entries.sort((a, b) => a.id - b.id)
  // Kompaktowy katalog do aplikacji (bez pełnych definicji - te zostają w cache).
  const catalog = entries.map((e) => ({
    id: e.id,
    words: e.words,
    uses: e.uses,
    video: e.video,
    poster: e.poster,
    handshape: e.handshape,
    localization: e.localization,
  }))
  writeFileSync(outFile, JSON.stringify(catalog))
  return catalog.length
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  console.log(`Crawl haseł ${fromArg}..${toArg} (cache: ${cacheDir})`)
  let done = 0
  for (let id = fromArg; id <= toArg; id++) {
    const cached = existsSync(join(cacheDir, `${id}.json`))
    await fetchGloss(id)
    done++
    if (!cached) await sleep(DELAY_MS)
    if (done % 100 === 0) {
      const n = writeCatalog()
      console.log(`  ${done}/${toArg - fromArg + 1} przetworzonych, ${n} haseł w katalogu`)
    }
  }
  const n = writeCatalog()
  console.log(`Gotowe: ${n} haseł w ${outFile}`)
}
