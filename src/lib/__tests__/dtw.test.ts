import { describe, expect, it } from 'vitest'
import { dtwDistance, matchAgainstTemplate } from '../dtw'
import { resampleFrames, type SignFrame, type SignTemplate } from '../signTemplate'

/** Sekwencja: prawa dłoń przesuwa się między punktami, kształt parametryzowany. */
function seq(
  n: number,
  from: [number, number],
  to: [number, number],
  shapeVal = 0.5,
): SignFrame[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    return {
      left: null,
      right: {
        wrist: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as [number, number],
        shape: new Array(63).fill(shapeVal),
      },
    }
  })
}

function template(frames: SignFrame[]): SignTemplate {
  return {
    glossId: 1,
    word: 'test',
    frames,
    leftShare: 0,
    rightShare: 1,
    instructions: [],
    durationSec: 2,
  }
}

describe('dtwDistance', () => {
  it('identyczne sekwencje mają odległość ~0', () => {
    const a = seq(32, [0.3, 0.5], [0.7, 0.5])
    expect(dtwDistance(a, a)).toBeLessThan(1e-9)
  })

  it('jest odporne na różnice tempa (ta sama trasa, inna długość)', () => {
    const slow = resampleFrames(seq(60, [0.3, 0.5], [0.7, 0.5]), 32)
    const fast = resampleFrames(seq(15, [0.3, 0.5], [0.7, 0.5]), 32)
    expect(dtwDistance(slow, fast)).toBeLessThan(0.06)
  })

  it('inny kierunek ruchu daje wyraźnie większą odległość', () => {
    const right = seq(32, [0.3, 0.5], [0.7, 0.5])
    const down = seq(32, [0.5, 0.3], [0.5, 0.7])
    expect(dtwDistance(right, down)).toBeGreaterThan(0.25)
  })

  it('inny kształt dłoni daje większą odległość', () => {
    const a = seq(32, [0.3, 0.5], [0.7, 0.5], 0.2)
    const b = seq(32, [0.3, 0.5], [0.7, 0.5], 0.9)
    expect(dtwDistance(a, b)).toBeGreaterThan(0.3)
  })

  it('brak dłoni wymaganej przez szablon jest karany', () => {
    const withHand = seq(32, [0.3, 0.5], [0.7, 0.5])
    const noHands: SignFrame[] = Array.from({ length: 32 }, () => ({ left: null, right: null }))
    expect(dtwDistance(withHand, noHands)).toBeGreaterThan(0.5)
  })
})

describe('matchAgainstTemplate', () => {
  it('akceptuje wykonanie zbliżone do szablonu', () => {
    const tmpl = template(seq(32, [0.3, 0.5], [0.7, 0.5]))
    const attempt = seq(32, [0.32, 0.52], [0.68, 0.5]).map((f) => ({
      ...f,
      right: f.right && { ...f.right, shape: f.right.shape.map((v) => v + 0.05) },
    }))
    const result = matchAgainstTemplate(attempt, tmpl)
    expect(result.ok).toBe(true)
    expect(result.score).toBeGreaterThan(0.55)
  })

  it('odrzuca zupełnie inny ruch', () => {
    const tmpl = template(seq(32, [0.3, 0.5], [0.7, 0.5], 0.2))
    const attempt = seq(32, [0.5, 0.2], [0.5, 0.8], 0.9)
    const result = matchAgainstTemplate(attempt, tmpl)
    expect(result.ok).toBe(false)
  })

  it('wynik maleje monotonicznie z odległością', () => {
    const tmpl = template(seq(32, [0.3, 0.5], [0.7, 0.5]))
    const close = matchAgainstTemplate(seq(32, [0.31, 0.5], [0.69, 0.5]), tmpl)
    const far = matchAgainstTemplate(seq(32, [0.5, 0.2], [0.5, 0.8], 0.9), tmpl)
    expect(close.score).toBeGreaterThan(far.score)
  })
})
