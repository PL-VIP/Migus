import { describe, expect, it } from 'vitest'
import { LetterStabilizer } from '../stabilizer'

const r = (letter: string, confidence = 0.9) => ({ letter, confidence })

describe('LetterStabilizer', () => {
  it('nie zgłasza litery, dopóki okno nie jest wystarczająco wypełnione', () => {
    const s = new LetterStabilizer({ windowSize: 10, minShare: 0.6 })
    for (let i = 0; i < 4; i++) {
      expect(s.push(r('A'))).toBeNull()
    }
  })

  it('zgłasza literę dominującą w oknie', () => {
    const s = new LetterStabilizer({ windowSize: 10, minShare: 0.6 })
    let last = null
    for (let i = 0; i < 10; i++) last = s.push(r('A'))
    expect(last?.letter).toBe('A')
  })

  it('ignoruje pojedyncze przekłamania między klatkami', () => {
    const s = new LetterStabilizer({ windowSize: 10, minShare: 0.6 })
    for (let i = 0; i < 9; i++) s.push(r('A'))
    const result = s.push(r('B'))
    expect(result?.letter).toBe('A')
  })

  it('nie zgłasza litery przy braku dominacji', () => {
    const s = new LetterStabilizer({ windowSize: 10, minShare: 0.6 })
    let last = null
    for (let i = 0; i < 10; i++) {
      last = s.push(i % 2 === 0 ? r('A') : r('B'))
    }
    expect(last).toBeNull()
  })

  it('uśrednia pewność zgłaszanej litery', () => {
    const s = new LetterStabilizer({ windowSize: 4, minShare: 0.5 })
    s.push(r('A', 0.8))
    s.push(r('A', 0.8))
    s.push(r('A', 0.9))
    const result = s.push(r('A', 0.9))
    expect(result?.confidence).toBeCloseTo(0.85)
  })

  it('reset czyści okno', () => {
    const s = new LetterStabilizer({ windowSize: 6, minShare: 0.5 })
    for (let i = 0; i < 6; i++) s.push(r('A'))
    s.reset()
    expect(s.push(r('B'))).toBeNull()
  })
})
