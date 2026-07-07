import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { matchRecording, mirrorFrames } from '../dtw'
import type { SignFrame, SignTemplate } from '../signTemplate'

/**
 * Test jakości wykrycia na PRAWDZIWYCH szablonach z KSPJM: z każdego
 * szablonu budujemy realistyczną symulację nagrania użytkownika
 * (rozbieg bez dłoni, inne tempo, szum pomiaru, przesunięcie w kadrze,
 * ogon po znaku) i sprawdzamy, że:
 *  - wykonanie właściwego znaku jest akceptowane (czułość),
 *  - wykonanie INNEGO znaku przeważnie nie przechodzi (swoistość).
 */

const here = dirname(fileURLToPath(import.meta.url))
const signsDir = join(here, '..', '..', '..', 'public', 'signs')

const templates: SignTemplate[] = readdirSync(signsDir)
  .filter((f) => f.endsWith('.json'))
  .sort((a, b) => Number(a.replace('.json', '')) - Number(b.replace('.json', '')))
  .map((f) => JSON.parse(readFileSync(join(signsDir, f), 'utf8')) as SignTemplate)

/** Deterministyczny generator pseudolosowy. */
function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return (s / 2147483648) * 2 - 1
  }
}

const SAMPLE_FPS = 15

/**
 * Symulacja nagrania z kamery na bazie szablonu:
 * puste klatki na początku/końcu + znak w tempie `speed` + szum + offset.
 */
function simulateRecording(
  t: SignTemplate,
  opts: { speed?: number; noise?: number; offsetX?: number; offsetY?: number; seed?: number } = {},
): SignFrame[] {
  const { speed = 1, noise = 0.02, offsetX = 0.02, offsetY = -0.015, seed = 7 } = opts
  const rnd = makeRng(seed)
  const signFrames = Math.max(6, Math.round((t.durationSec * SAMPLE_FPS) / speed))
  const out: SignFrame[] = []

  const mapHand = (h: SignFrame['left']): SignFrame['left'] =>
    h && {
      wrist: [h.wrist[0] + offsetX + rnd() * noise, h.wrist[1] + offsetY + rnd() * noise],
      shape: h.shape.map((v) => v + rnd() * noise * 2),
    }

  // Rozbieg: 0,5 s dłoni w pozycji startowej (użytkownik czeka po odliczaniu).
  const first = t.frames[0]
  for (let i = 0; i < Math.round(SAMPLE_FPS * 0.5); i++) {
    out.push({ left: mapHand(first.left), right: mapHand(first.right) })
  }
  // Właściwy znak przepróbkowany do tempa użytkownika.
  for (let i = 0; i < signFrames; i++) {
    const src = t.frames[Math.min(t.frames.length - 1, Math.round((i * (t.frames.length - 1)) / (signFrames - 1)))]
    out.push({ left: mapHand(src.left), right: mapHand(src.right) })
  }
  // Ogon: 0,4 s w pozycji końcowej.
  const last = t.frames[t.frames.length - 1]
  for (let i = 0; i < Math.round(SAMPLE_FPS * 0.4); i++) {
    out.push({ left: mapHand(last.left), right: mapHand(last.right) })
  }
  return out
}

/** Pary szablonów o rozłącznych znaczeniach (unikamy wariantów tego samego słowa). */
function crossPairs(limit: number): Array<[SignTemplate, SignTemplate]> {
  const pairs: Array<[SignTemplate, SignTemplate]> = []
  const step = 7
  outer: for (let i = 0; i < templates.length; i++) {
    const a = templates[i]
    const b = templates[(i * step + 13) % templates.length]
    if (a.glossId === b.glossId) continue
    const wordsA = new Set([a.word])
    if (wordsA.has(b.word)) continue
    pairs.push([a, b])
    if (pairs.length >= limit) break outer
  }
  return pairs
}

describe('jakość wykrycia znaków (symulacja nagrań na prawdziwych szablonach)', () => {
  it('wczytano pełny zestaw szablonów', () => {
    expect(templates.length).toBeGreaterThanOrEqual(200)
  })

  it('czułość: poprawne wykonanie przechodzi (różne tempa, szum, offset)', () => {
    const failures: string[] = []
    let total = 0
    for (const t of templates.filter((_, i) => i % 4 === 0)) {
      for (const speed of [0.8, 1, 1.3]) {
        total++
        const rec = simulateRecording(t, { speed, seed: 7 + total })
        const result = matchRecording(rec, t, SAMPLE_FPS)
        if (!result.ok) {
          failures.push(`${t.glossId} ${t.word} (tempo ${speed}): score=${result.score.toFixed(2)}`)
        }
      }
    }
    const passRate = 1 - failures.length / total
    expect(
      passRate,
      `czułość ${(passRate * 100).toFixed(0)}% (${failures.length}/${total} porażek):\n${failures.slice(0, 10).join('\n')}`,
    ).toBeGreaterThanOrEqual(0.9)
  })

  it('swoistość: wykonanie innego znaku przeważnie odrzucane', () => {
    const pairs = crossPairs(80)
    expect(pairs.length).toBeGreaterThanOrEqual(60)
    const accepted: string[] = []
    for (const [a, b] of pairs) {
      const rec = simulateRecording(a, { seed: a.glossId })
      const result = matchRecording(rec, b, SAMPLE_FPS)
      if (result.ok) accepted.push(`${a.word} uznane za ${b.word} (score=${result.score.toFixed(2)})`)
    }
    const falseAcceptRate = accepted.length / pairs.length
    expect(
      falseAcceptRate,
      `fałszywe akceptacje ${(falseAcceptRate * 100).toFixed(0)}%:\n${accepted.slice(0, 10).join('\n')}`,
    ).toBeLessThanOrEqual(0.2)
  })

  it('właściwy znak dostaje wyraźnie wyższy wynik niż niewłaściwy', () => {
    const pairs = crossPairs(40)
    let selfSum = 0
    let crossSum = 0
    for (const [a, b] of pairs) {
      const rec = simulateRecording(a, { seed: 100 + a.glossId })
      selfSum += matchRecording(rec, a, SAMPLE_FPS).score
      crossSum += matchRecording(rec, b, SAMPLE_FPS).score
    }
    const selfMean = selfSum / pairs.length
    const crossMean = crossSum / pairs.length
    expect(selfMean, `średnia self=${selfMean.toFixed(2)}, cross=${crossMean.toFixed(2)}`).toBeGreaterThan(
      crossMean + 0.25,
    )
  })

  it('nagranie bez dłoni nie jest akceptowane', () => {
    const empty: SignFrame[] = Array.from({ length: 40 }, () => ({ left: null, right: null }))
    const result = matchRecording(empty, templates[0], SAMPLE_FPS)
    expect(result.ok).toBe(false)
    expect(result.score).toBe(0)
  })

  it('wolny sprzęt: rzadkie próbkowanie (~3 kl./s) z lukami detekcji przechodzi', () => {
    const fps = 3.1
    const failures: string[] = []
    let total = 0
    for (const t of templates.filter((_, i) => i % 8 === 0)) {
      total++
      const rnd = makeRng(900 + t.glossId)
      const rnd01 = () => (rnd() + 1) / 2
      const loopSec = t.durationSec + 1.7
      const rec: SignFrame[] = []
      const noisyHand = (h: SignFrame['left']): SignFrame['left'] =>
        h && {
          wrist: [h.wrist[0] + rnd() * 0.02, h.wrist[1] + rnd() * 0.02],
          shape: h.shape.map((v) => v + rnd() * 0.04),
        }
      // 14 s zapętlonego znaku, 25% klatek zgubionych przez detektor.
      for (let time = 0; time < 14; time += 1 / fps) {
        const tin = (time + 0.9) % loopSec
        if (tin < t.durationSec && rnd01() > 0.25) {
          const src = t.frames[Math.min(31, Math.round((tin / t.durationSec) * 31))]
          rec.push({ left: noisyHand(src.left), right: noisyHand(src.right) })
        } else {
          rec.push({ left: null, right: null })
        }
      }
      const result = matchRecording(rec, t, fps)
      if (!result.ok) failures.push(`${t.glossId} ${t.word}: score=${result.score.toFixed(2)}`)
    }
    const passRate = 1 - failures.length / total
    expect(
      passRate,
      `czułość przy 3 kl./s ${(passRate * 100).toFixed(0)}%:\n${failures.slice(0, 10).join('\n')}`,
    ).toBeGreaterThanOrEqual(0.85)
  })

  it('leworęczne (lustrzane) wykonanie właściwego znaku przechodzi', () => {
    const failures: string[] = []
    let total = 0
    for (const t of templates.filter((_, i) => i % 8 === 0)) {
      total++
      const rec = mirrorFrames(simulateRecording(t, { seed: 500 + t.glossId }))
      const result = matchRecording(rec, t, SAMPLE_FPS)
      if (!result.ok) failures.push(`${t.glossId} ${t.word}: score=${result.score.toFixed(2)}`)
    }
    const passRate = 1 - failures.length / total
    expect(
      passRate,
      `czułość lustrzana ${(passRate * 100).toFixed(0)}%:\n${failures.slice(0, 10).join('\n')}`,
    ).toBeGreaterThanOrEqual(0.9)
  })
})
