import { describe, expect, it } from 'vitest'
import { LETTER_POSES } from '../../data/letterPoses'
import { extractHandFeatures } from '../handFeatures'
import { classifyHand, rankLetters, LETTER_RULES, MIN_CONFIDENCE } from '../pjmClassifier'

describe('pozy liter (grafiki) vs klasyfikator', () => {
  it('istnieje poza dla każdej obsługiwanej litery', () => {
    for (const rule of LETTER_RULES) {
      expect(LETTER_POSES[rule.letter], `brak pozy dla litery ${rule.letter}`).toBeDefined()
    }
  })

  for (const [letter, pose] of Object.entries(LETTER_POSES)) {
    it(`poza litery ${letter} jest rozpoznawana jako ${letter}`, () => {
      const features = extractHandFeatures(pose)
      const result = classifyHand(features)
      const ranked = rankLetters(features)
        .slice(0, 3)
        .map((r) => `${r.letter}=${r.confidence.toFixed(2)}`)
        .join(', ')
      expect(result, `brak rozpoznania, ranking: ${ranked}`).not.toBeNull()
      expect(result!.letter, `ranking: ${ranked}`).toBe(letter)
      expect(result!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE)
    })
  }
})
