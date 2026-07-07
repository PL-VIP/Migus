import { describe, expect, it } from 'vitest'
import { LETTER_POSES } from '../../data/letterPoses'
import { ALPHABET } from '../../data/alphabet'
import { extractHandFeatures } from '../handFeatures'
import {
  classifyHand,
  rankAllShapes,
  LETTER_RULES,
  MIN_CONFIDENCE,
} from '../pjmClassifier'

describe('pozy liter (grafiki) vs klasyfikator', () => {
  it('istnieje poza dla każdej reguły klasyfikatora', () => {
    for (const rule of LETTER_RULES) {
      expect(LETTER_POSES[rule.letter], `brak pozy dla układu ${rule.letter}`).toBeDefined()
    }
  })

  it('istnieje poza bazowa dla każdego znaku alfabetu', () => {
    for (const entry of ALPHABET) {
      expect(LETTER_POSES[entry.baseShape], `brak pozy dla znaku ${entry.letter}`).toBeDefined()
    }
  })

  for (const [shape, pose] of Object.entries(LETTER_POSES)) {
    if (shape.startsWith('_')) {
      // Ukryte układy bazowe: muszą wygrywać ranking wszystkich układów,
      // a klasyfikator liter statycznych nie może zgłosić dla nich litery.
      it(`poza bazowa ${shape} wygrywa ranking układów`, () => {
        const features = extractHandFeatures(pose)
        const ranked = rankAllShapes(features)
        const summary = ranked
          .slice(0, 3)
          .map((r) => `${r.letter}=${r.confidence.toFixed(2)}`)
          .join(', ')
        expect(ranked[0].letter, `ranking: ${summary}`).toBe(shape)
        expect(classifyHand(features), 'baza nie może być zgłaszana jako litera').toBeNull()
      })
    } else {
      it(`poza litery ${shape} jest rozpoznawana jako ${shape}`, () => {
        const features = extractHandFeatures(pose)
        const result = classifyHand(features)
        const summary = rankAllShapes(features)
          .slice(0, 3)
          .map((r) => `${r.letter}=${r.confidence.toFixed(2)}`)
          .join(', ')
        expect(result, `brak rozpoznania, ranking: ${summary}`).not.toBeNull()
        expect(result!.letter, `ranking: ${summary}`).toBe(shape)
        expect(result!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
      })
    }
  }
})
