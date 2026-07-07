/**
 * Test dymny wykrywania z PRAWDZIWĄ dłonią: jako obraz kamery podstawiane
 * jest nagranie lektora KSPJM (plik Y4M). Sprawdzamy, że pętla rozpoznawania
 * widzi dłoń (HUD ≠ „Pokaż dłoń”) i wyświetla kandydatów na żywo.
 *
 * Użycie: node scripts/smoke-letters-hand.mjs <plik.y4m> [urlBazowy] [katalogZrzutów]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const feed = process.argv[2]
const base = process.argv[3] ?? 'http://localhost:4173'
const outDir = process.argv[4] ?? '/tmp/smoke'
if (!feed) {
  console.error('Podaj ścieżkę do pliku .y4m')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${feed}`,
    '--enable-unsafe-swiftshader',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('pageerror', (err) => console.log('[pageerror]', String(err)))

await page.goto(base, { waitUntil: 'networkidle' })
await page.locator('nav.tabs button', { hasText: 'Alfabet palcowy' }).click()
await page.locator('.camera-panel button.primary', { hasText: 'Włącz kamerę' }).first().click()
await page.waitForSelector('.video-hud', { timeout: 60000 })

// Czekamy aż dłoń z nagrania zostanie wykryta.
let detected = false
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500)
  const hud = (await page.textContent('.video-hud .hand-status'))?.trim() ?? ''
  if (hud && !hud.startsWith('Pokaż dłoń')) {
    detected = true
    console.log('Dłoń wykryta, HUD:', hud)
    break
  }
}
if (!detected) throw new Error('Dłoń z nagrania nie została wykryta w 20 s')

// Kandydaci na żywo.
await page.waitForTimeout(1500)
const candidates = await page.locator('.candidates li .candidate-letter').allTextContents()
const values = await page.locator('.candidates li .candidate-value').allTextContents()
console.log(
  'Kandydaci na żywo:',
  candidates.map((c, i) => `${c}=${values[i] ?? '?'}`).join(', ') || '(brak w tej klatce)',
)

await page.screenshot({ path: join(outDir, 'letters-real-hand.png') })
console.log('OK - wykrywanie widzi prawdziwą dłoń')
await browser.close()
