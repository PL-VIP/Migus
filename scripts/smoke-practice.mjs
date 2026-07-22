/**
 * Test E2E wykrywania w ćwiczeniu słowa: jako obraz kamery podstawiamy
 * zapętlone nagranie lektora KSPJM (plik Y4M). Sprawdzamy dwie strony:
 *  - POZYTYW: ćwiczenie tego samego znaku, który „miga” kamera → wynik OK,
 *  - NEGATYW: ćwiczenie innego znaku → wynik wyraźnie niższy, nie OK.
 *
 * Znaki wskazujemy jako słowo:idHasła (wiele haseł ma to samo słowo,
 * ale INNY znak - np. „szpieg” to 1210 i 3310).
 *
 * Użycie: node scripts/smoke-practice.mjs <plik.y4m> <słowo:id> <słowo:id> [urlBazowy] [katalogZrzutów]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const [feed, positiveArg, negativeArg] = process.argv.slice(2)
const base = process.argv[5] ?? 'http://localhost:4173'
const outDir = process.argv[6] ?? '/tmp/smoke'
if (!feed || !positiveArg || !negativeArg) {
  console.error('Użycie: smoke-practice.mjs <plik.y4m> <słowoPozytyw:id> <słowoNegatyw:id>')
  process.exit(1)
}
const parseTarget = (arg) => {
  const [word, id] = arg.split(':')
  return { word, glossId: id ? Number(id) : null }
}
const positive = parseTarget(positiveArg)
const negative = parseTarget(negativeArg)
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

/** Otwiera ćwiczenie znaku ze słownika i zwraca najlepszy wynik z `attempts` prób. */
async function practiceWord(target, attempts, shot) {
  const { word, glossId } = target
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('nav.tabs button', { hasText: 'Słownik' }).click()
  await page.fill('input.dict-search', word)
  // Konkretny wariant znaku: karta linkująca do hasła o danym id.
  const card = glossId
    ? page.locator('.dict-card', { has: page.locator(`a[href$="/gloss/view/${glossId}"]`) }).first()
    : page.locator('.dict-card', { has: page.locator('.word-title', { hasText: word }) }).first()
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

console.log(`POZYTYW: kamera miga „${positive.word}” (${positive.glossId}), ćwiczymy ten znak`)
const positiveScore = await practiceWord(positive, 3, 'practice-positive.png')
console.log(`  najlepszy wynik: ${positiveScore}%`)

console.log(`NEGATYW: kamera miga „${positive.word}”, ćwiczymy „${negative.word}” (${negative.glossId})`)
const negativeScore = await practiceWord(negative, 3, 'practice-negative.png')
console.log(`  najlepszy wynik: ${negativeScore}%`)

await browser.close()

if (positiveScore < 55) {
  throw new Error(`POZYTYW nie przeszedł: najlepszy wynik ${positiveScore}% < 55%`)
}
if (negativeScore >= positiveScore) {
  throw new Error(`NEGATYW (${negativeScore}%) nie jest niższy od POZYTYWU (${positiveScore}%)`)
}
console.log(`OK - właściwy znak: ${positiveScore}%, inny znak: ${negativeScore}%`)
