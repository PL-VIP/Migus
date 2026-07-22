// Pobiera z wyprzedzeniem filmy słownika do .cache/videos, aby workery
// ekstrakcji (extract-templates.mjs) nie czekały na sieć.
//
// Idzie od KOŃCA katalogu (ekstrakcja idzie od początku), a plik zapisuje
// najpierw do *.part i przenosi po całości - nigdy nie zostawia częściowego
// pliku pod docelową nazwą.
//
// Użycie: node scripts/prefetch-videos.mjs
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://www.slownikpjm.uw.edu.pl'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const videoCache = join(root, '.cache', 'videos')
mkdirSync(videoCache, { recursive: true })

const catalog = JSON.parse(readFileSync(join(root, 'public', 'data', 'catalog.json'), 'utf8'))
const targets = [...catalog].reverse()

let downloaded = 0
let skipped = 0
let failed = 0
for (const entry of targets) {
  const file = join(videoCache, `${entry.id}.mp4`)
  if (existsSync(file)) {
    skipped++
    continue
  }
  try {
    const res = await fetch(`${BASE}${entry.video}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const tmp = `${file}.part`
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
    renameSync(tmp, file)
    downloaded++
    if (downloaded % 50 === 0) console.log(`pobrano ${downloaded} (pominięto ${skipped})`)
    await new Promise((r) => setTimeout(r, 200))
  } catch (err) {
    failed++
    console.error(`BŁĄD ${entry.id}: ${err.message}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}
console.log(`Gotowe: pobrano ${downloaded}, pominięto ${skipped}, błędów ${failed}`)
