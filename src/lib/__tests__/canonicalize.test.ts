import { describe, expect, it } from 'vitest'
import type { Point3 } from '../geometry'
import { LETTER_POSES } from '../../data/letterPoses'
import { extractHandFeatures } from '../handFeatures'
import { classifyHand } from '../pjmClassifier'

/**
 * Kanonizacja dłoni: rozpoznanie nie może zależeć od pochylenia dłoni
 * w kadrze ani od tego, którą ręką miga użytkownik (lustrzane odbicie).
 */

function rotate(lms: Point3[], deg: number): Point3[] {
  const wrist = lms[0]
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return lms.map((p) => {
    const dx = p.x - wrist.x
    const dy = p.y - wrist.y
    return { x: wrist.x + dx * cos - dy * sin, y: wrist.y + dx * sin + dy * cos, z: p.z }
  })
}

function mirror(lms: Point3[]): Point3[] {
  return lms.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }))
}

const TESTED = ['A', 'B', 'C', 'L', 'V', 'Y'] as const

describe('kanonizacja dłoni', () => {
  for (const letter of TESTED) {
    it(`litera ${letter} rozpoznawana przy pochyleniu dłoni ±25°`, () => {
      for (const deg of [-25, 25]) {
        const result = classifyHand(extractHandFeatures(rotate(LETTER_POSES[letter], deg)))
        expect(result?.letter, `obrót ${deg}°`).toBe(letter)
      }
    })

    it(`litera ${letter} rozpoznawana drugą ręką (lustrzane odbicie)`, () => {
      const result = classifyHand(extractHandFeatures(mirror(LETTER_POSES[letter])))
      expect(result?.letter).toBe(letter)
    })
  }

  it('lustrzane odbicie z pochyleniem także działa', () => {
    const result = classifyHand(extractHandFeatures(rotate(mirror(LETTER_POSES.L), 20)))
    expect(result?.letter).toBe('L')
  })
})
