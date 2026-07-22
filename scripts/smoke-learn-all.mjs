/**
 * Test dymny sekcji „Wszystkie słowa ze słownika” w Nauce słów:
 * lista wszystkich haseł z szablonem, wyszukiwarka, wejście w ćwiczenie.
 *
 * Użycie: node scripts/smoke-learn-all.mjs [urlBazowy] [katalogZrzutów]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const base = process.argv[2] ?? 'http://localhost:4173'
const outDir = process.argv[3] ?? '/tmp/smoke'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(base, { waitUntil: 'networkidle' })

// Sekcja „Wszystkie słowa” z licznikiem.
const allWords = page.locator('.lesson.all-words')
await allWords.waitFor({ state: 'visible', timeout: 15000 })
const counter = (await allWords.locator('.lesson-progress .muted').textContent())?.trim()
console.log('Licznik postępu:', counter)
const total = Number(counter?.split('/')[1])
if (!Number.isFinite(total) || total < 200) {
  throw new Error(`Za mało słów do nauki w sekcji „Wszystkie słowa”: ${counter}`)
}
const chips = await allWords.locator('.word-chip').count()
console.log('Widocznych słów (pierwsza strona):', chips)
if (chips < 50) throw new Error(`Za mało widocznych słów: ${chips}`)
await page.screenshot({ path: join(outDir, 'learn-all-words.png') })

// „Pokaż więcej” dokłada kolejne.
await allWords.locator('button.show-more').click()
const chipsMore = await allWords.locator('.word-chip').count()
console.log('Po „Pokaż więcej”:', chipsMore)
if (chipsMore <= chips) throw new Error('„Pokaż więcej” nie dokłada słów')

// Wyszukiwarka zawęża.
await allWords.locator('input.dict-search').fill('czytać')
await page.waitForTimeout(300)
const found = await allWords.locator('.word-chip').allTextContents()
console.log('Wyniki dla „czytać”:', found.slice(0, 5).join(', '))
if (!found.some((w) => w.includes('czytać'))) throw new Error('Wyszukiwarka nie znalazła „czytać”')

// Wejście w ćwiczenie z listy.
await allWords.locator('.word-chip', { hasText: 'czytać' }).first().click()
await page.locator('button', { hasText: 'Umiem! Przechodzę do ćwiczenia' }).waitFor({ timeout: 15000 })
console.log('Ćwiczenie słowa otwiera się z listy „Wszystkie słowa”.')
await page.screenshot({ path: join(outDir, 'learn-practice-from-all.png') })

if (errors.length > 0) throw new Error('Błędy strony: ' + errors.join(' | '))
console.log('OK - sekcja „Wszystkie słowa” działa')
await browser.close()
