import { describe, expect, it } from 'vitest'
import { extractHandFeatures } from '../handFeatures'
import { classifyHand, rankLetters, trapezoid, MIN_CONFIDENCE } from '../pjmClassifier'
import {
  HAND_A,
  HAND_B,
  HAND_C,
  HAND_I,
  HAND_L,
  HAND_O,
  HAND_OPEN_SPREAD,
  HAND_R,
  HAND_W,
  HAND_Y,
} from './testHands'
import type { Point3 } from '../geometry'

function expectLetter(hand: Point3[], letter: string) {
  const features = extractHandFeatures(hand)
  const result = classifyHand(features)
  const ranked = rankLetters(features)
    .slice(0, 3)
    .map((r) => `${r.letter}=${r.confidence.toFixed(2)}`)
    .join(', ')
  expect(result, `oczekiwano ${letter}, ranking: ${ranked}`).not.toBeNull()
  expect(result!.letter, `ranking: ${ranked}`).toBe(letter)
  expect(result!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
}

describe('trapezoid', () => {
  it('zwraca 1 wewnątrz przedziału', () => {
    expect(trapezoid(5, 0, 10, 2)).toBe(1)
    expect(trapezoid(0, 0, 10, 2)).toBe(1)
    expect(trapezoid(10, 0, 10, 2)).toBe(1)
  })

  it('opada liniowo na marginesach', () => {
    expect(trapezoid(-1, 0, 10, 2)).toBeCloseTo(0.5)
    expect(trapezoid(11, 0, 10, 2)).toBeCloseTo(0.5)
  })

  it('zwraca 0 poza marginesami', () => {
    expect(trapezoid(-3, 0, 10, 2)).toBe(0)
    expect(trapezoid(13, 0, 10, 2)).toBe(0)
  })
})

describe('extractHandFeatures', () => {
  it('odrzuca zbyt krótką listę punktów', () => {
    expect(() => extractHandFeatures([{ x: 0, y: 0, z: 0 }])).toThrow()
  })

  it('normalizuje cechy rozmiarem dłoni (niezależność od skali)', () => {
    const small = extractHandFeatures(HAND_B)
    const large = extractHandFeatures(
      HAND_B.map((pt) => ({ x: pt.x * 3, y: pt.y * 3, z: pt.z * 3 })),
    )
    expect(large.thumbIndexPinch).toBeCloseTo(small.thumbIndexPinch, 5)
    expect(large.fingers.index.curlDeg).toBeCloseTo(small.fingers.index.curlDeg, 5)
    expect(large.fingers.index.tipDist).toBeCloseTo(small.fingers.index.tipDist, 5)
  })

  it('wykrywa skrzyżowane palce dla układu litery R', () => {
    expect(extractHandFeatures(HAND_R).indexMiddleCrossed).toBe(true)
    expect(extractHandFeatures(HAND_B).indexMiddleCrossed).toBe(false)
  })
})

describe('classifyHand - litery PJM', () => {
  it('rozpoznaje literę A (pięść z kciukiem wzdłuż dłoni)', () => expectLetter(HAND_A, 'A'))
  it('rozpoznaje literę B (otwarta dłoń, palce złączone)', () => expectLetter(HAND_B, 'B'))
  it('rozpoznaje literę C (dłoń w kształcie C)', () => expectLetter(HAND_C, 'C'))
  it('rozpoznaje literę I (mały palec prosty)', () => expectLetter(HAND_I, 'I'))
  it('rozpoznaje literę L (kciuk i wskazujący pod kątem prostym)', () => expectLetter(HAND_L, 'L'))
  it('rozpoznaje literę O (kciuk i wskazujący w okręgu)', () => expectLetter(HAND_O, 'O'))
  it('rozpoznaje literę R (skrzyżowane palce)', () => expectLetter(HAND_R, 'R'))
  it('rozpoznaje literę W (trzy palce proste, pętla kciuk-wskazujący)', () => expectLetter(HAND_W, 'W'))
  it('rozpoznaje literę Y (wskazujący i mały proste)', () => expectLetter(HAND_Y, 'Y'))

  it('nie zgłasza litery B dla dłoni z rozstawionymi palcami', () => {
    const result = classifyHand(extractHandFeatures(HAND_OPEN_SPREAD))
    expect(result?.letter).not.toBe('B')
  })
})
