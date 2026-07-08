// Przygotowuje zasoby wymagane w runtime (katalog public/):
//  1. kopiuje pliki WASM MediaPipe z node_modules do public/mediapipe/wasm,
//  2. pobiera model hand_landmarker.task, jeśli nie jest jeszcze pobrany,
//  3. odświeża listę id szablonów (src/data/generated/templateIds.json).
// Uruchamiany automatycznie przed `npm run dev` i `npm run build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// 1. Pliki WASM MediaPipe
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDst = join(root, 'public', 'mediapipe', 'wasm')
mkdirSync(wasmDst, { recursive: true })
let copied = 0
for (const file of readdirSync(wasmSrc)) {
  const src = join(wasmSrc, file)
  const dst = join(wasmDst, file)
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) {
    copyFileSync(src, dst)
    copied += 1
  }
}
console.log(copied > 0 ? `Skopiowano ${copied} plików WASM MediaPipe.` : 'Pliki WASM MediaPipe aktualne.')

// 2. Model Hand Landmarker
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const modelDst = join(root, 'public', 'models', 'hand_landmarker.task')

if (existsSync(modelDst) && statSync(modelDst).size > 1_000_000) {
  console.log('Model hand_landmarker.task już pobrany - pomijam.')
} else {
  console.log('Pobieram model hand_landmarker.task (~7,5 MB)...')
  const res = await fetch(MODEL_URL)
  if (!res.ok) {
    console.error(`Nie udało się pobrać modelu: HTTP ${res.status}`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(modelDst), { recursive: true })
  writeFileSync(modelDst, buf)
  console.log(`Zapisano ${modelDst} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
}

// 3. Lista id dostępnych szablonów - lekki plik trafiający do bundla
// (pełne metadane siedzą w signIndex.json, którego aplikacja nie importuje).
const signsDir = join(root, 'public', 'signs')
const idsDst = join(root, 'src', 'data', 'generated', 'templateIds.json')
mkdirSync(dirname(idsDst), { recursive: true })
const ids = existsSync(signsDir)
  ? readdirSync(signsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number(f.replace('.json', '')))
      .sort((a, b) => a - b)
  : []
writeFileSync(idsDst, JSON.stringify(ids))
console.log(`Lista szablonów: ${ids.length} znaków (templateIds.json).`)
