import { describe, expect, it } from 'vitest'
import {
  generateInstructions,
  handFrameFromLandmarks,
  handShare,
  resampleFrames,
  trimIdleFrames,
  type SignFrame,
} from '../signTemplate'
import { HAND_B } from './testHands'

const emptyFrame = (): SignFrame => ({ left: null, right: null })

function movingFrames(n: number, from: [number, number], to: [number, number]): SignFrame[] {
  const shape = new Array(63).fill(0)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return {
      left: null,
      right: {
        wrist: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as [number, number],
        shape,
      },
    }
  })
}

describe('handFrameFromLandmarks', () => {
  it('normalizuje kształt względem nadgarstka i rozmiaru dłoni', () => {
    const frame = handFrameFromLandmarks(HAND_B)
    expect(frame.shape).toHaveLength(63)
    // Nadgarstek po normalizacji w zerze.
    expect(frame.shape[0]).toBeCloseTo(0)
    expect(frame.shape[1]).toBeCloseTo(0)
    expect(frame.shape[2]).toBeCloseTo(0)

    // Przesunięcie i przeskalowanie całej dłoni nie zmienia kształtu.
    const moved = HAND_B.map((p) => ({ x: p.x * 2 + 0.3, y: p.y * 2 - 0.1, z: p.z * 2 }))
    const frame2 = handFrameFromLandmarks(moved)
    for (let i = 0; i < 63; i++) {
      expect(frame2.shape[i]).toBeCloseTo(frame.shape[i], 5)
    }
    // Ale pozycja nadgarstka w kadrze się zmienia (trajektoria).
    expect(frame2.wrist[0]).not.toBeCloseTo(frame.wrist[0])
  })
})

describe('resampleFrames / trimIdleFrames / handShare', () => {
  it('resample zwraca dokładnie zadaną liczbę klatek', () => {
    const frames = movingFrames(50, [0.2, 0.5], [0.8, 0.5])
    expect(resampleFrames(frames, 32)).toHaveLength(32)
    expect(resampleFrames(frames.slice(0, 5), 32)).toHaveLength(32)
  })

  it('trim usuwa puste klatki z początku i końca', () => {
    const frames = [emptyFrame(), emptyFrame(), ...movingFrames(10, [0.4, 0.4], [0.6, 0.6]), emptyFrame()]
    const trimmed = trimIdleFrames(frames)
    expect(trimmed).toHaveLength(10)
    expect(trimmed[0].right).not.toBeNull()
  })

  it('handShare liczy udział klatek z dłonią', () => {
    const frames = [...movingFrames(8, [0.4, 0.4], [0.6, 0.6]), emptyFrame(), emptyFrame()]
    expect(handShare(frames, 'right')).toBeCloseTo(0.8)
    expect(handShare(frames, 'left')).toBe(0)
  })
})

describe('generateInstructions', () => {
  it('opisuje znak jednoręczny z ruchem w dół', () => {
    const frames = movingFrames(20, [0.5, 0.3], [0.5, 0.65])
    const instr = generateInstructions(frames).join(' ')
    expect(instr).toContain('jedną ręką')
    expect(instr).toContain('ruch w dół')
    expect(instr).toContain('twarzy')
  })

  it('opisuje znak dwuręczny', () => {
    const shape = new Array(63).fill(0)
    const frames: SignFrame[] = Array.from({ length: 20 }, (_, i) => ({
      left: { wrist: [0.4 - i * 0.01, 0.5], shape },
      right: { wrist: [0.6 + i * 0.01, 0.5], shape },
    }))
    const instr = generateInstructions(frames).join(' ')
    expect(instr).toContain('dwiema rękami')
    expect(instr).toContain('przeciwnych kierunkach')
  })

  it('odwraca kierunek poziomy do perspektywy osoby migającej', () => {
    // W kadrze ruch w prawo (+x) = z perspektywy migającego ruch w lewo.
    const frames = movingFrames(20, [0.3, 0.5], [0.75, 0.5])
    const instr = generateInstructions(frames).join(' ')
    expect(instr).toContain('ruch w lewo')
  })
})
