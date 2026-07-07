/**
 * Test E2E wykrywania w ćwiczeniu słowa: jako obraz kamery podstawiamy
 * zapętlone nagranie lektora KSPJM (plik Y4M). Sprawdzamy dwie strony:
 *  - POZYTYW: ćwiczenie tego samego słowa, które „miga” kamera → wynik OK,
 *  - NEGATYW: ćwiczenie innego słowa → wynik wyraźnie niższy, nie OK.
 *
 * Użycie: node scripts/smoke-practice.mjs <plik.y4m> <słowoPozytyw> <słowoNegatyw> [urlBazowy] [katalogZrzutów]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const [feed, positiveWord, negativeWord] = process.argv.slice(2)
const base = process.argv[5] ?? 'http://localhost:4173'
const outDir = process.argv[6] ?? '/tmp/smoke'
if (!feed || !positiveWord || !negativeWord) {
  console.error('Użycie: smoke-practice.mjs <plik.y4m> <słowoPozytyw> <słowoNegatyw>')
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

/** Otwiera ćwiczenie słowa ze słownika i zwraca najlepszy wynik z `attempts` prób. */
async function practiceWord(word, attempts, shot) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('nav.tabs button', { hasText: 'Słownik' }).click()
  await page.fill('input.dict-search', word)
  const card = page.locator('.dict-card', { has: page.locator('.word-title', { hasText: word }) }).first()
  await card.locator('button', { hasText: 'Ćwicz przed kamerą' }).click()

  // Krok 1 → 2 (przycisk aktywny po wczytaniu szablonu).
  const goPractice = page.locator('button', { hasText: 'Umiem! Przechodzę do ćwiczenia' })
  await goPractice.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForFunction(
    () => !document.querySelector('.practice-watch button.primary.big')?.disabled,
    { timeout: 15000 },
  )
  await goPractice.click()

  await page.locator('.video-placeholder button.primary', { hasText: 'Włącz kamerę' }).click()
  const startBtn = page.locator('.controls button.primary.big', { hasText: 'Start!' })
  await startBtn.waitFor({ state: 'visible', timeout: 60000 })

  let best = -1
  for (let i = 0; i < attempts; i++) {
    if (i === 0) await startBtn.click()
    else await page.locator('.overlay-actions button.primary', { hasText: 'Spróbuj jeszcze raz' }).click()
    await page.waitForSelector('.overlay-score', { timeout: 45000 })
    const text = (await page.textContent('.overlay-score'))?.trim() ?? ''
    const score = Number(text.replace('%', ''))
    const feedback = (await page.textContent('.overlay-result p'))?.trim() ?? ''
    const debug = await page.evaluate(() => JSON.stringify(window.__practiceDebug ?? null))
    console.log(`  próba ${i + 1}: ${text} - ${feedback} ${debug}`)
    if (score > best) {
      best = score
      await page.screenshot({ path: join(outDir, shot) })
    }
  }
  return best
}

console.log(`POZYTYW: kamera miga „${positiveWord}”, ćwiczymy „${positiveWord}”`)
const positive = await practiceWord(positiveWord, 3, 'practice-positive.png')
console.log(`  najlepszy wynik: ${positive}%`)

console.log(`NEGATYW: kamera miga „${positiveWord}”, ćwiczymy „${negativeWord}”`)
const negative = await practiceWord(negativeWord, 3, 'practice-negative.png')
console.log(`  najlepszy wynik: ${negative}%`)

await browser.close()

if (positive < 55) {
  throw new Error(`POZYTYW nie przeszedł: najlepszy wynik ${positive}% < 55%`)
}
if (negative >= positive) {
  throw new Error(`NEGATYW (${negative}%) nie jest niższy od POZYTYWU (${positive}%)`)
}
console.log(`OK - właściwy znak: ${positive}%, inny znak: ${negative}%`)
