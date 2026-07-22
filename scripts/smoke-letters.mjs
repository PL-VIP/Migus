/**
 * Test dymny widoku liter: uruchamia zbudowaną aplikację w headless Chrome
 * ze sztuczną kamerą, sprawdza render wszystkich 36 znaków alfabetu,
 * uruchamia kamerę i robi zrzuty ekranu.
 *
 * Użycie: node scripts/smoke-letters.mjs [urlBazowy] [katalogZrzutów]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const base = process.argv[2] ?? 'http://localhost:4173'
const outDir = process.argv[3] ?? '/tmp/smoke'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--enable-unsafe-swiftshader',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})

await page.goto(base, { waitUntil: 'networkidle' })

// Przejście na zakładkę alfabetu palcowego.
await page.locator('nav.tabs button', { hasText: 'Alfabet palcowy' }).click()

// 1. Zakładka liter: pełny alfabet.
const headline = await page.textContent('.letters-panel h2')
console.log('Nagłówek panelu liter:', headline?.trim())
const count = await page.locator('.letters-grid li').count()
console.log('Liczba znaków w siatce:', count)
if (count !== 38) throw new Error(`Oczekiwano 38 znaków, jest ${count}`)

const badges = await page.locator('.letters-grid .letter-kind').count()
console.log('Znaki oznaczone jako ruchome:', badges)
const arrows = await page.locator('.letters-grid-diagram path[marker-end], .letters-grid-diagram path[stroke="#2f9e7d"]').count()
console.log('Diagramy ze strzałką ruchu:', arrows)

// Zrzut siatki liter.
await page.locator('.letters-panel').scrollIntoViewIfNeeded()
await page.screenshot({ path: join(outDir, 'letters-grid.png'), fullPage: true })

// 2. Uruchomienie kamery (sztuczny obraz - bez dłoni).
await page.locator('.camera-panel button.primary', { hasText: 'Włącz kamerę' }).first().click()
await page.waitForSelector('.video-hud', { timeout: 30000 })
await page.waitForTimeout(2500)
const hud = await page.textContent('.video-hud .hand-status')
console.log('Status HUD:', hud?.trim())
await page.locator('main.layout').scrollIntoViewIfNeeded()
await page.screenshot({ path: join(outDir, 'letters-camera.png') })

const relevantErrors = errors.filter(
  (e) => !e.includes('favicon') && !e.includes('GL version') && !e.includes('TensorFlow'),
)
if (relevantErrors.length > 0) {
  console.log('Błędy konsoli:', relevantErrors.slice(0, 5))
  process.exitCode = 1
} else {
  console.log('Brak błędów konsoli. OK')
}

await browser.close()
