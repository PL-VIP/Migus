import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { dtwDistance, matchAgainstTemplate } from '../dtw'
import type { SignFrame, SignTemplate } from '../signTemplate'

/**
 * Testy na prawdziwych szablonach wygenerowanych z filmów KSPJM
 * (public/signs/*.json). Sprawdzają własności całego łańcucha:
 * szablon musi pasować do siebie (nawet z szumem) lepiej niż do
 * większości innych znaków.
 */

const here = dirname(fileURLToPath(import.meta.url))
const signsDir = join(here, '..', '..', '..', 'public', 'signs')

function loadTemplates(): SignTemplate[] {
  return readdirSync(signsDir)
    .filter((f: string) => f.endsWith('.json'))
    .map(
      (f: string) => JSON.parse(readFileSync(join(signsDir, f), 'utf8')) as SignTemplate,
    )
}

/** Deterministyczny pseudolosowy szum (bez zależności od Math.random). */
function noisy(frames: SignFrame[], amp: number): SignFrame[] {
  let seed = 42
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return (seed / 2147483648) * 2 - 1
  }
  return frames.map((f) => ({
    left: f.left && {
      wrist: [f.left.wrist[0] + rnd() * amp, f.left.wrist[1] + rnd() * amp],
      shape: f.left.shape.map((v) => v + rnd() * amp * 2),
    },
    right: f.right && {
      wrist: [f.right.wrist[0] + rnd() * amp, f.right.wrist[1] + rnd() * amp],
      shape: f.right.shape.map((v) => v + rnd() * amp * 2),
    },
  }))
}

const templates = loadTemplates()

describe('dopasowanie do prawdziwych szablonów z KSPJM', () => {
  it('wczytano szablony lekcji', () => {
    expect(templates.length).toBeGreaterThanOrEqual(20)
    for (const t of templates) {
      expect(t.frames).toHaveLength(32)
      expect(t.instructions.length).toBeGreaterThan(0)
    }
  })

  it('szablon dopasowany do samego siebie daje wynik pozytywny', () => {
    for (const t of templates) {
      const result = matchAgainstTemplate(t.frames, t)
      expect(result.ok, `szablon ${t.word} nie pasuje do siebie`).toBe(true)
      expect(result.score).toBeGreaterThan(0.9)
    }
  })

  it('szablon z realistycznym szumem pomiaru nadal pasuje', () => {
    for (const t of templates) {
      const result = matchAgainstTemplate(noisy(t.frames, 0.02), t)
      expect(result.ok, `szablon ${t.word} z szumem nie pasuje (score=${result.score.toFixed(2)})`).toBe(true)
    }
  })

  it('własny szablon jest bliżej niż zdecydowana większość innych znaków', () => {
    // Próbka ~60 szablonów × ~40 konkurentów - pełny iloczyn byłby O(n²).
    const strideT = Math.max(1, Math.floor(templates.length / 60))
    const strideO = Math.max(1, Math.floor(templates.length / 40))
    let better = 0
    let total = 0
    for (let i = 0; i < templates.length; i += strideT) {
      const t = templates[i]
      const self = dtwDistance(noisy(t.frames, 0.015), t.frames)
      for (let j = 0; j < templates.length; j += strideO) {
        const other = templates[j]
        if (other.glossId === t.glossId) continue
        total++
        if (self < dtwDistance(noisy(t.frames, 0.015), other.frames)) better++
      }
    }
    // Rozróżnialność: własny znak wygrywa w >=85% porównań par.
    expect(better / total).toBeGreaterThanOrEqual(0.85)
  })
})
