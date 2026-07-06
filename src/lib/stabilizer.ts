import type { ClassificationResult } from './pjmClassifier'

export interface StabilizerOptions {
  /** Rozmiar okna (liczba ostatnich klatek branych pod uwagę). */
  windowSize: number
  /** Minimalny udział klatek z tą samą literą w oknie, by uznać ją za stabilną. */
  minShare: number
}

const DEFAULTS: StabilizerOptions = { windowSize: 12, minShare: 0.6 }

/**
 * Wygładzanie rozpoznań w czasie: litera jest zgłaszana dopiero wtedy,
 * gdy dominuje w oknie ostatnich klatek. Eliminuje migotanie wyników
 * przy przejściach między układami dłoni.
 */
export class LetterStabilizer {
  private readonly opts: StabilizerOptions
  private window: Array<ClassificationResult | null> = []

  constructor(opts: Partial<StabilizerOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts }
  }

  reset(): void {
    this.window = []
  }

  /**
   * Dodaje wynik z bieżącej klatki (null = brak rozpoznania) i zwraca
   * ustabilizowaną literę albo null.
   */
  push(result: ClassificationResult | null): ClassificationResult | null {
    this.window.push(result)
    if (this.window.length > this.opts.windowSize) this.window.shift()
    if (this.window.length < Math.ceil(this.opts.windowSize / 2)) return null

    const counts = new Map<string, { count: number; confidenceSum: number }>()
    for (const r of this.window) {
      if (!r) continue
      const entry = counts.get(r.letter) ?? { count: 0, confidenceSum: 0 }
      entry.count += 1
      entry.confidenceSum += r.confidence
      counts.set(r.letter, entry)
    }

    let bestLetter: string | null = null
    let bestCount = 0
    let bestConfidenceSum = 0
    for (const [letter, { count, confidenceSum }] of counts) {
      if (count > bestCount) {
        bestLetter = letter
        bestCount = count
        bestConfidenceSum = confidenceSum
      }
    }

    if (!bestLetter || bestCount / this.window.length < this.opts.minShare) return null
    return { letter: bestLetter, confidence: bestConfidenceSum / bestCount }
  }
}
