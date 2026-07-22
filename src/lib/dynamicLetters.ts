import type { ClassificationResult } from './pjmClassifier'
import { type MotionPattern, type MotionSample, summarizeMotion } from './motion'

/**
 * Silnik liter ruchomych alfabetu palcowego (Ą, Ę, J, Ł, SZ, RZ, Z...).
 *
 * Litera ruchoma = układ bazowy dłoni + ruch (np. Ł to L przesunięte w bok,
 * RZ to R rysujące zygzak litery Z). Detektor śledzi prędkość dłoni,
 * segmentuje gest (bezruch → ruch → bezruch), klasyfikuje wzorzec
 * trajektorii i łączy go z układem bazowym trzymanym przed ruchem.
 *
 * Osobno wykrywane są litery „przejścia” bez ruchu całej dłoni:
 * G (pstryknięcie: dzióbek P → wyprostowany wskazujący)
 * i U (wiktoria → zgięcie palców w stronę rozmówcy).
 */

export interface DynamicLetterDef {
  letter: string
  /** Akceptowane układy bazowe (nazwy reguł klasyfikatora, także ukryte). */
  baseShapes: string[]
  /** Akceptowane wzorce ruchu. */
  patterns: MotionPattern[]
  /** Dodatkowy warunek na podsumowaniu ruchu (np. kierunek w bok). */
  extra?: (info: ReturnType<typeof summarizeMotion>) => boolean
}

export interface TransitionLetterDef {
  letter: string
  /** Układ początkowy. */
  from: string[]
  /** Układ końcowy. */
  to: string[]
  /** Maksymalny czas przejścia w ms. */
  maxMs: number
}

/** Kreska diakrytyczna nie może być poziomym machnięciem. */
const diacriticStroke = (m: MotionInfoLike) => Math.abs(m.netY) >= 0.35 * Math.abs(m.netX)

type MotionInfoLike = ReturnType<typeof summarizeMotion>

export const DYNAMIC_LETTERS: DynamicLetterDef[] = [
  { letter: 'Ą', baseShapes: ['A'], patterns: ['hook', 'down', 'stroke'], extra: diacriticStroke },
  { letter: 'Ę', baseShapes: ['E'], patterns: ['hook', 'down', 'stroke'], extra: diacriticStroke },
  { letter: 'Ć', baseShapes: ['C'], patterns: ['down', 'stroke'], extra: diacriticStroke },
  { letter: 'Ń', baseShapes: ['N'], patterns: ['down', 'stroke'], extra: diacriticStroke },
  { letter: 'Ó', baseShapes: ['O'], patterns: ['down', 'stroke'], extra: diacriticStroke },
  { letter: 'Ś', baseShapes: ['S'], patterns: ['down', 'stroke'], extra: diacriticStroke },
  { letter: 'H', baseShapes: ['X'], patterns: ['down'] },
  { letter: 'CH', baseShapes: ['_SZPON'], patterns: ['down'] },
  { letter: 'CZ', baseShapes: ['_SZPON'], patterns: ['forward'] },
  { letter: 'K', baseShapes: ['_TRZY'], patterns: ['forward'] },
  { letter: 'Ł', baseShapes: ['L'], patterns: ['side'] },
  { letter: 'SZ', baseShapes: ['B'], patterns: ['side'] },
  { letter: 'J', baseShapes: ['I'], patterns: ['hook'] },
  { letter: 'D', baseShapes: ['_WSKAZUJACY'], patterns: ['circle'] },
  { letter: 'Z', baseShapes: ['_WSKAZUJACY'], patterns: ['zigzag'] },
  { letter: 'RZ', baseShapes: ['R'], patterns: ['zigzag'] },
  {
    letter: 'Ź',
    baseShapes: ['_WSKAZUJACY'],
    patterns: ['stroke'],
    // Kreska: krótki ukośny ruch (nie pionowy zjazd i nie poziome machnięcie).
    extra: (m) => Math.abs(m.netX) >= 0.18 && Math.abs(m.netY) >= 0.18,
  },
  { letter: 'Ż', baseShapes: ['_WSKAZUJACY'], patterns: ['forward'] },
]

export const TRANSITION_LETTERS: TransitionLetterDef[] = [
  { letter: 'G', from: ['P', 'S'], to: ['_WSKAZUJACY', 'L'], maxMs: 700 },
  { letter: 'U', from: ['V'], to: ['X', '_SZPON'], maxMs: 900 },
]

/** Litera ruchoma → litera statyczna, którą zastępuje w historii literowania. */
export const DYNAMIC_REPLACES_STATIC: Record<string, string> = {
  Ą: 'A',
  Ę: 'E',
  Ć: 'C',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  H: 'X',
  Ł: 'L',
  SZ: 'B',
  J: 'I',
  RZ: 'R',
  Ź: 'Z',
  Ż: 'Z',
  G: 'P',
  U: 'V',
}

export interface DetectorFrame {
  /** Czas w ms. */
  t: number
  /** Najlepszy układ dłoni z klasyfikatora (łącznie z ukrytymi bazami). */
  topShape: ClassificationResult | null
  /** Pozycje śledzone (znormalizowane współrzędne obrazu). */
  wrist: { x: number; y: number }
  indexTip: { x: number; y: number }
  pinkyTip: { x: number; y: number }
  /** Rozmiar dłoni (ułamek szerokości obrazu). */
  palmSize: number
}

export interface DynamicLetterEvent {
  letter: string
  confidence: number
  /** Wzorzec ruchu / rodzaj przejścia. */
  via: MotionPattern | 'transition'
  /**
   * Układy, w których dłoń kończy gest - te litery statyczne należy
   * wyciszyć, dopóki użytkownik nie zmieni układu (inaczej po Ą
   * natychmiast dopisałoby się kolejne A).
   */
  endShapes: string[]
}

interface BufferedFrame extends DetectorFrame {
  speed: number
}

const START_SPEED = 1.5 // jednostki dłoni / s
const STOP_SPEED = 0.6
const MIN_SHAPE_CONF = 0.5
const HOLD_LOOKBACK_MS = 600
const MAX_SEGMENT_MS = 2600
const MIN_SEGMENT_MS = 150

/** Bazy rysujące ruch czubkiem palca zamiast całą dłonią. */
const TRACKED_POINT: Record<string, 'indexTip' | 'pinkyTip'> = {
  _WSKAZUJACY: 'indexTip',
  I: 'pinkyTip',
}

export class DynamicLetterDetector {
  private frames: BufferedFrame[] = []
  private moving = false
  private segmentStartT = 0
  private slowFrames = 0
  private fastFrames = 0
  /** Historia ostatnich stabilnych układów do wykrywania przejść (G, U). */
  private shapeHistory: Array<{ t: number; shape: string }> = []

  reset(): void {
    this.frames = []
    this.moving = false
    this.slowFrames = 0
    this.fastFrames = 0
    this.shapeHistory = []
  }

  /** Czy trwa ruch (używane do wstrzymania zgłaszania liter statycznych). */
  get isMoving(): boolean {
    return this.moving
  }

  push(frame: DetectorFrame): DynamicLetterEvent | null {
    const prev = this.frames[this.frames.length - 1]
    const palm = Math.max(frame.palmSize, 1e-4)
    let speed = 0
    if (prev && frame.t > prev.t) {
      const dtSec = (frame.t - prev.t) / 1000
      const v = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(a.x - b.x, a.y - b.y) / palm / dtSec
      // Zbliżanie dłoni do kamery (ruch „w przód”) widać jako wzrost jej
      // rozmiaru - traktujemy tempo zmiany rozmiaru jak dodatkową prędkość.
      const palmRate = (Math.abs(frame.palmSize - prev.palmSize) / palm / dtSec) * 3
      speed = Math.max(
        v(frame.wrist, prev.wrist),
        v(frame.indexTip, prev.indexTip),
        v(frame.pinkyTip, prev.pinkyTip),
        palmRate,
      )
    }
    this.frames.push({ ...frame, speed })
    const cutoff = frame.t - Math.max(MAX_SEGMENT_MS + HOLD_LOOKBACK_MS, 4000)
    while (this.frames.length > 0 && this.frames[0].t < cutoff) this.frames.shift()

    // Historia układów (do liter-przejść), tylko pewne rozpoznania.
    if (frame.topShape && frame.topShape.confidence >= MIN_SHAPE_CONF) {
      this.shapeHistory.push({ t: frame.t, shape: frame.topShape.letter })
      while (this.shapeHistory.length > 0 && this.shapeHistory[0].t < frame.t - 2500) {
        this.shapeHistory.shift()
      }
      const transition = this.detectTransition(frame.t)
      if (transition) return transition
    }

    if (!this.moving) {
      // Start segmentu dopiero po 2 kolejnych szybkich klatkach,
      // żeby pojedynczy skok szumu nie wstrzymywał liter statycznych.
      this.fastFrames = speed >= START_SPEED ? this.fastFrames + 1 : 0
      if (this.fastFrames >= 2) {
        this.moving = true
        this.segmentStartT = this.frames[Math.max(0, this.frames.length - 3)].t
        this.slowFrames = 0
        this.fastFrames = 0
      }
      return null
    }

    // Trwa ruch: czekamy na zatrzymanie albo przekroczenie limitu czasu.
    if (speed < STOP_SPEED) {
      this.slowFrames += 1
    } else {
      this.slowFrames = 0
    }
    const segmentMs = frame.t - this.segmentStartT
    if (this.slowFrames >= 3 || segmentMs >= MAX_SEGMENT_MS) {
      this.moving = false
      if (segmentMs >= MIN_SEGMENT_MS) {
        const event = this.classifySegment(frame.t)
        this.frames = this.frames.slice(-2)
        this.shapeHistory = []
        return event
      }
    }
    return null
  }

  /** Dominujący układ dłoni w przedziale czasu [t0, t1]. */
  private majorityShape(t0: number, t1: number): string | null {
    const counts = new Map<string, number>()
    for (const f of this.frames) {
      if (f.t < t0 || f.t > t1) continue
      if (!f.topShape || f.topShape.confidence < MIN_SHAPE_CONF) continue
      counts.set(f.topShape.letter, (counts.get(f.topShape.letter) ?? 0) + 1)
    }
    let best: string | null = null
    let bestCount = 0
    let total = 0
    for (const [shape, count] of counts) {
      total += count
      if (count > bestCount) {
        best = shape
        bestCount = count
      }
    }
    return total >= 2 && bestCount / total >= 0.5 ? best : null
  }

  private classifySegment(endT: number): DynamicLetterEvent | null {
    const startT = this.segmentStartT
    // Układ bazowy: trzymany tuż przed ruchem, awaryjnie - w trakcie ruchu.
    const base =
      this.majorityShape(startT - HOLD_LOOKBACK_MS, startT + 80) ??
      this.majorityShape(startT, endT)
    if (!base) return null

    const candidates = DYNAMIC_LETTERS.filter((d) => d.baseShapes.includes(base))
    if (candidates.length === 0) return null

    const tracked = TRACKED_POINT[base] ?? 'wrist'
    const segment = this.frames.filter((f) => f.t >= startT && f.t <= endT)
    if (segment.length < 4) return null
    const medianPalm = median(segment.map((f) => f.palmSize))
    const samples: MotionSample[] = segment.map((f) => ({
      t: f.t,
      x: f[tracked].x / medianPalm,
      y: f[tracked].y / medianPalm,
      palm: f.palmSize,
    }))
    const info = summarizeMotion(samples)
    if (!info.pattern) return null

    for (const cand of candidates) {
      if (!cand.patterns.includes(info.pattern)) continue
      if (cand.extra && !cand.extra(info)) continue
      return { letter: cand.letter, confidence: 0.9, via: info.pattern, endShapes: [base] }
    }
    return null
  }

  /** Litery-przejścia (G, U): zmiana układu dłoni bez ruchu całej ręki. */
  private detectTransition(now: number): DynamicLetterEvent | null {
    const current = this.shapeHistory[this.shapeHistory.length - 1]
    if (!current) return null
    for (const def of TRANSITION_LETTERS) {
      if (!def.to.includes(current.shape)) continue
      // Wymagamy ≥3 klatek nowego układu, by nie reagować na pojedynczy błąd.
      const recent = this.shapeHistory.filter((s) => s.t >= now - 250)
      if (recent.length < 3 || !recent.every((s) => def.to.includes(s.shape))) continue
      // Szukamy układu startowego trzymanego chwilę wcześniej.
      const before = this.shapeHistory.filter(
        (s) => s.t < recent[0].t && s.t >= recent[0].t - def.maxMs,
      )
      const fromFrames = before.filter((s) => def.from.includes(s.shape))
      if (fromFrames.length >= 3) {
        this.shapeHistory = []
        return { letter: def.letter, confidence: 0.85, via: 'transition', endShapes: def.to }
      }
    }
    return null
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
}
