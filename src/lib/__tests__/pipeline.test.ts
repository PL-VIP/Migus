import { describe, expect, it } from 'vitest'
import type { Point3 } from '../geometry'
import { LETTER_POSES } from '../../data/letterPoses'
import { extractHandFeatures, LM } from '../handFeatures'
import { rankAllShapes } from '../pjmClassifier'
import { DynamicLetterDetector, type DynamicLetterEvent } from '../dynamicLetters'

/**
 * Test integracyjny pełnego potoku liter ruchomych: poza dłoni (21 punktów)
 * jest przesuwana po trajektorii jak przed kamerą, każda klatka przechodzi
 * przez ekstrakcję cech + ranking układów + detektor gestów - dokładnie
 * tak, jak w hooku useHandRecognition.
 */

const FPS = 30
const DT = 1000 / FPS

function translate(lms: Point3[], dx: number, dy: number): Point3[] {
  return lms.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z }))
}

function scaleAround(lms: Point3[], factor: number): Point3[] {
  const cx = lms[LM.WRIST].x
  const cy = lms[LM.WRIST].y
  return lms.map((p) => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
    z: p.z * factor,
  }))
}

interface PoseStep {
  ms: number
  pose: Point3[]
  from: { dx: number; dy: number }
  to: { dx: number; dy: number }
  scaleTo?: number
}

function runPipeline(steps: PoseStep[]): DynamicLetterEvent[] {
  const detector = new DynamicLetterDetector()
  const events: DynamicLetterEvent[] = []
  let t = 0
  let scale = 1
  for (const step of steps) {
    const frames = Math.max(1, Math.round(step.ms / DT))
    const scaleFrom = scale
    const scaleTo = step.scaleTo ?? scaleFrom
    for (let i = 1; i <= frames; i++) {
      const k = i / frames
      scale = scaleFrom + (scaleTo - scaleFrom) * k
      const dx = step.from.dx + (step.to.dx - step.from.dx) * k
      const dy = step.from.dy + (step.to.dy - step.from.dy) * k
      const lms = scaleAround(translate(step.pose, dx, dy), scale)
      const features = extractHandFeatures(lms)
      t += DT
      const event = detector.push({
        t,
        topShape: rankAllShapes(features)[0] ?? null,
        wrist: { x: lms[LM.WRIST].x, y: lms[LM.WRIST].y },
        indexTip: { x: lms[LM.INDEX_TIP].x, y: lms[LM.INDEX_TIP].y },
        pinkyTip: { x: lms[LM.PINKY_TIP].x, y: lms[LM.PINKY_TIP].y },
        palmSize: features.palmSize,
      })
      if (event) events.push(event)
    }
  }
  return events
}

const still = (pose: Point3[], at: { dx: number; dy: number }, ms = 600): PoseStep => ({
  ms,
  pose,
  from: at,
  to: at,
})

const glide = (
  pose: Point3[],
  from: { dx: number; dy: number },
  to: { dx: number; dy: number },
  ms = 400,
): PoseStep => ({ ms, pose, from, to })

describe('potok liter ruchomych na prawdziwych pozach', () => {
  it('Ą: poza A + ogonek w dół i w bok', () => {
    const A = LETTER_POSES.A
    const events = runPipeline([
      still(A, { dx: 0, dy: -0.15 }),
      glide(A, { dx: 0, dy: -0.15 }, { dx: 0.01, dy: -0.02 }, 250),
      glide(A, { dx: 0.01, dy: -0.02 }, { dx: 0.11, dy: 0 }, 250),
      still(A, { dx: 0.11, dy: 0 }),
    ])
    expect(events.map((e) => e.letter)).toContain('Ą')
  })

  it('Ł: poza L przesunięta w bok', () => {
    const L = LETTER_POSES.L
    const events = runPipeline([
      still(L, { dx: -0.12, dy: 0 }),
      glide(L, { dx: -0.12, dy: 0 }, { dx: 0.12, dy: 0.01 }),
      still(L, { dx: 0.12, dy: 0.01 }),
    ])
    expect(events.map((e) => e.letter)).toContain('Ł')
  })

  it('SZ: poza B przesunięta w bok', () => {
    const B = LETTER_POSES.B
    const events = runPipeline([
      still(B, { dx: 0.1, dy: 0 }),
      glide(B, { dx: 0.1, dy: 0 }, { dx: -0.12, dy: 0 }),
      still(B, { dx: -0.12, dy: 0 }),
    ])
    expect(events.map((e) => e.letter)).toContain('SZ')
  })

  it('Ó: poza O zjeżdża w dół', () => {
    const O = LETTER_POSES.O
    const events = runPipeline([
      still(O, { dx: 0, dy: -0.18 }),
      glide(O, { dx: 0, dy: -0.18 }, { dx: 0.01, dy: 0 }),
      still(O, { dx: 0.01, dy: 0 }),
    ])
    expect(events.map((e) => e.letter)).toContain('Ó')
  })

  it('Z: poza ze wskazującym rysuje zygzak', () => {
    const IDX = LETTER_POSES._WSKAZUJACY
    const events = runPipeline([
      still(IDX, { dx: -0.08, dy: -0.1 }),
      glide(IDX, { dx: -0.08, dy: -0.1 }, { dx: 0.08, dy: -0.09 }, 220),
      glide(IDX, { dx: 0.08, dy: -0.09 }, { dx: -0.08, dy: 0.01 }, 220),
      glide(IDX, { dx: -0.08, dy: 0.01 }, { dx: 0.08, dy: 0.02 }, 220),
      still(IDX, { dx: 0.08, dy: 0.02 }),
    ])
    expect(events.map((e) => e.letter)).toContain('Z')
  })

  it('K: poza trzech palców + ruch ku rozmówcy (dłoń rośnie w kadrze)', () => {
    const TRZY = LETTER_POSES._TRZY
    const events = runPipeline([
      still(TRZY, { dx: 0, dy: 0 }),
      { ms: 350, pose: TRZY, from: { dx: 0, dy: 0 }, to: { dx: 0.01, dy: 0.02 }, scaleTo: 1.35 },
      still(TRZY, { dx: 0.01, dy: 0.02 }),
    ])
    expect(events.map((e) => e.letter)).toContain('K')
  })

  it('J: poza I rysuje haczyk małym palcem', () => {
    const I = LETTER_POSES.I
    const events = runPipeline([
      still(I, { dx: 0, dy: -0.14 }),
      glide(I, { dx: 0, dy: -0.14 }, { dx: 0.005, dy: -0.01 }, 250),
      glide(I, { dx: 0.005, dy: -0.01 }, { dx: -0.09, dy: 0.01 }, 250),
      still(I, { dx: -0.09, dy: 0.01 }),
    ])
    expect(events.map((e) => e.letter)).toContain('J')
  })

  it('statyczne trzymanie pozy A nie wywołuje żadnej litery ruchomej', () => {
    const events = runPipeline([still(LETTER_POSES.A, { dx: 0, dy: 0 }, 2000)])
    expect(events).toHaveLength(0)
  })
})
