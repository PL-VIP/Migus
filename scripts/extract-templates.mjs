// Ekstrakcja szablonów znaków PJM z filmów słownika KSPJM.
//
// Dla każdego wybranego hasła: pobiera film (cache w .cache/videos/),
// uruchamia w headless Chrome harness tools/extract.html (Vite dev server),
// który przepuszcza klatki przez MediaPipe Hand Landmarker i buduje
// szablon ruchu (SignTemplate). Szablony trafiają do public/signs/<id>.json,
// a indeks do src/data/generated/signIndex.json.
//
// Użycie:
//   node scripts/extract-templates.mjs --ids 13,275,229      # wybrane hasła
//   node scripts/extract-templates.mjs --lessons             # hasła z src/data/lessons.ts
//   node scripts/extract-templates.mjs --all                 # cały katalog (długo!)
//   node scripts/extract-templates.mjs --all --limit 100     # pierwsze 100 haseł katalogu
//   node scripts/extract-templates.mjs --all --workers 4     # liczba równoległych kart
//
// Wymaga: zainstalowanego google-chrome i playwright (npm i -D playwright).
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://www.slownikpjm.uw.edu.pl'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const videoCache = join(root, '.cache', 'videos')
const signsDir = join(root, 'public', 'signs')
const indexFile = join(root, 'src', 'data', 'generated', 'signIndex.json')
const catalogFile = join(root, 'public', 'data', 'catalog.json')

mkdirSync(videoCache, { recursive: true })
mkdirSync(signsDir, { recursive: true })
mkdirSync(dirname(indexFile), { recursive: true })

const args = process.argv.slice(2)
const getFlag = (name) => args.includes(`--${name}`)
const getOpt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
const byId = new Map(catalog.map((e) => [e.id, e]))

let targets = []
if (getOpt('ids')) {
  targets = getOpt('ids')
    .split(',')
    .map((s) => Number(s.trim()))
    .map((id) => {
      const e = byId.get(id)
      if (!e) console.error(`Hasło ${id} nie występuje w katalogu - pomijam`)
      return e
    })
    .filter(Boolean)
} else if (getFlag('lessons')) {
  const lessonsSrc = readFileSync(join(root, 'src', 'data', 'lessons.ts'), 'utf8')
  const ids = [...lessonsSrc.matchAll(/glossId:\s*(\d+)/g)].map((m) => Number(m[1]))
  targets = [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean)
} else if (getFlag('all')) {
  targets = catalog
} else {
  console.error('Podaj --ids 1,2,3 albo --lessons albo --all')
  process.exit(1)
}

const limit = Number(getOpt('limit') ?? Infinity)
const force = getFlag('force')
targets = targets.slice(0, limit)
console.log(`Do przetworzenia: ${targets.length} haseł`)

async function downloadVideo(entry) {
  const file = join(videoCache, `${entry.id}.mp4`)
  if (existsSync(file)) return file
  const url = `${BASE}${entry.video}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  await new Promise((r) => setTimeout(r, 300))
  return file
}

// Vite dev server serwuje harness + zasoby MediaPipe + pliki z .cache przez /@fs/.
const server = await createServer({
  root,
  server: { port: 5199, strictPort: true, fs: { allow: [root] } },
  logLevel: 'error',
})
await server.listen()

const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : []
const indexById = new Map(index.map((e) => [e.glossId, e]))

const queue = targets.filter((entry) => force || !existsSync(join(signsDir, `${entry.id}.json`)))
const skipped = targets.length - queue.length
console.log(`Istniejące szablony: ${skipped}, do ekstrakcji: ${queue.length}`)

// Uzupełnij indeks o szablony, które istnieją na dysku, ale wypadły
// z indeksu (np. przerwana poprzednia sesja między zapisami indeksu).
for (const entry of targets) {
  if (indexById.has(entry.id)) continue
  const outFile = join(signsDir, `${entry.id}.json`)
  if (!existsSync(outFile)) continue
  const template = JSON.parse(readFileSync(outFile, 'utf8'))
  indexById.set(entry.id, {
    glossId: entry.id,
    word: entry.words[0],
    words: entry.words,
    durationSec: template.durationSec,
    twoHanded: template.leftShare > 0.35 && template.rightShare > 0.35,
  })
}

let done = skipped
let failed = 0
const failures = []
let cursor = 0

function flushIndex() {
  writeFileSync(
    indexFile,
    JSON.stringify([...indexById.values()].sort((a, b) => a.glossId - b.glossId)),
  )
}

/**
 * Świeża karta co PAGE_RECYCLE filmów: długa sesja MediaPipe w jednej karcie
 * stopniowo zwalnia (tempo spada z ~11/min do ~4/min po godzinie), a recykling
 * karty przywraca pełne tempo.
 */
const PAGE_RECYCLE = 60

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--no-sandbox'],
})

async function openHarness(wid) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error(`  [strona w${wid}]`, e.message))
  await page.goto('http://localhost:5199/tools/extract.html')
  await page.waitForFunction(() => window.harnessReady === true, undefined, { timeout: 120000 })
  return page
}

async function worker(wid) {
  let page = await openHarness(wid)
  let processed = 0

  while (cursor < queue.length) {
    const entry = queue[cursor++]
    const word = entry.words[0]
    if (processed > 0 && processed % PAGE_RECYCLE === 0) {
      await page.close()
      page = await openHarness(wid)
    }
    try {
      const videoFile = await downloadVideo(entry)
      const template = await page.evaluate(
        ({ url, glossId, word }) => window.extractTemplate(url, glossId, word),
        { url: `/@fs${videoFile}`, glossId: entry.id, word },
      )
      writeFileSync(join(signsDir, `${entry.id}.json`), JSON.stringify(template))
      indexById.set(entry.id, {
        glossId: entry.id,
        word,
        words: entry.words,
        durationSec: template.durationSec,
        twoHanded: template.leftShare > 0.35 && template.rightShare > 0.35,
      })
      done++
      console.log(`  [${done}/${targets.length}] ${entry.id} ${word} (${template.durationSec}s)`)
      if (done % 20 === 0) flushIndex()
    } catch (err) {
      failed++
      failures.push({ id: entry.id, word, error: err.message })
      console.error(`  BŁĄD ${entry.id} ${word}: ${err.message}`)
      // Po błędzie infrastruktury (padła karta) - odtwórz kartę.
      if (/Target|crashed|closed/i.test(err.message)) {
        try {
          await page.close()
        } catch {
          // karta już nie żyje
        }
        page = await openHarness(wid)
      }
    }
    processed++
  }
  await page.close()
}

const workers = Math.max(1, Number(getOpt('workers') ?? 3))
await Promise.all(Array.from({ length: workers }, (_, i) => worker(i + 1)))

flushIndex()
if (failures.length > 0) {
  writeFileSync(join(root, '.cache', 'extract-failures.json'), JSON.stringify(failures, null, 2))
}
console.log(`Gotowe: ${done} szablonów, ${failed} błędów. Indeks: ${indexFile}`)

await browser.close()
await server.close()
