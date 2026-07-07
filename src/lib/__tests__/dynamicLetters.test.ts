import { describe, expect, it } from 'vitest'
import {
  DynamicLetterDetector,
  type DetectorFrame,
  type DynamicLetterEvent,
} from '../dynamicLetters'

/**
 * Syntetyczne trajektorie liter ruchomych: trzymamy układ bazowy,
 * wykonujemy ruch, zatrzymujemy dłoń - detektor powinien zgłosić literę.
 */

const PALM = 0.2 // rozmiar dłoni w ułamku szerokości obrazu
const FPS = 30
const DT = 1000 / FPS

interface Step {
  /** Czas trwania kroku w ms. */
  ms: number
  /** Pozycja startowa i końcowa (interpolacja liniowa). */
  from: { x: number; y: number }
  to: { x: number; y: number }
  /** Rozmiar dłoni na końcu kroku (domyślnie PALM). */
  palmTo?: number
  /** Układ bazowy zgłaszany w tym kroku (null = brak pewnego rozpoznania). */
  shape: string | null
}

function runSteps(steps: Step[], tracked: 'wrist' | 'indexTip' | 'pinkyTip' = 'wrist'): DynamicLetterEvent[] {
  const detector = new DynamicLetterDetector()
  const events: DynamicLetterEvent[] = []
  let t = 0
  let palm = PALM
  for (const step of steps) {
    const frames = Math.max(1, Math.round(step.ms / DT))
    const palmFrom = palm
    const palmTo = step.palmTo ?? palmFrom
    for (let i = 1; i <= frames; i++) {
      const k = i / frames
      const x = step.from.x + (step.to.x - step.from.x) * k
      const y = step.from.y + (step.to.y - step.from.y) * k
      palm = palmFrom + (palmTo - palmFrom) * k
      t += DT
      const pos = { x, y }
      const still = { x: 0.5, y: 0.9 }
      const frame: DetectorFrame = {
        t,
        topShape: step.shape ? { letter: step.shape, confidence: 0.9 } : null,
        wrist: tracked === 'wrist' ? pos : still,
        indexTip: tracked === 'indexTip' ? pos : still,
        pinkyTip: tracked === 'pinkyTip' ? pos : still,
        palmSize: palm,
      }
      const event = detector.push(frame)
      if (event) events.push(event)
    }
  }
  return events
}

const hold = (at: { x: number; y: number }, shape: string | null, ms = 600): Step => ({
  ms,
  from: at,
  to: at,
  shape,
})

const move = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  shape: string | null,
  ms = 400,
): Step => ({ ms, from, to, shape })

describe('DynamicLetterDetector - litery ruchome', () => {
  it('Ą: układ A + ogonek (w dół i w bok)', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, 'A'),
      move({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.63 }, null, 250),
      move({ x: 0.5, y: 0.63 }, { x: 0.6, y: 0.65 }, null, 250),
      hold({ x: 0.6, y: 0.65 }, 'A'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ą')
  })

  it('Ę: układ E + ogonek', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, 'E'),
      move({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.63 }, null, 250),
      move({ x: 0.5, y: 0.63 }, { x: 0.6, y: 0.65 }, null, 250),
      hold({ x: 0.6, y: 0.65 }, 'E'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ę')
  })

  it('Ó: układ O + zjazd w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.42 }, 'O'),
      move({ x: 0.5, y: 0.42 }, { x: 0.51, y: 0.62 }, null),
      hold({ x: 0.51, y: 0.62 }, 'O'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ó')
  })

  it('Ś: układ S + zjazd w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.42 }, 'S'),
      move({ x: 0.5, y: 0.42 }, { x: 0.5, y: 0.6 }, null),
      hold({ x: 0.5, y: 0.6 }, 'S'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ś')
  })

  it('Ć: układ C + kreska w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.45 }, 'C'),
      move({ x: 0.5, y: 0.45 }, { x: 0.5, y: 0.58 }, null, 300),
      hold({ x: 0.5, y: 0.58 }, 'C'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ć')
  })

  it('Ń: układ N + kreska w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.45 }, 'N'),
      move({ x: 0.5, y: 0.45 }, { x: 0.5, y: 0.58 }, null, 300),
      hold({ x: 0.5, y: 0.58 }, 'N'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ń')
  })

  it('H: układ X (zgięte V) + ruch w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.42 }, 'X'),
      move({ x: 0.5, y: 0.42 }, { x: 0.5, y: 0.6 }, null),
      hold({ x: 0.5, y: 0.6 }, 'X'),
    ])
    expect(events.map((e) => e.letter)).toContain('H')
  })

  it('CH: szpon + ruch w dół', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.42 }, '_SZPON'),
      move({ x: 0.5, y: 0.42 }, { x: 0.5, y: 0.6 }, null),
      hold({ x: 0.5, y: 0.6 }, '_SZPON'),
    ])
    expect(events.map((e) => e.letter)).toContain('CH')
  })

  it('Ł: układ L + ruch w bok', () => {
    const events = runSteps([
      hold({ x: 0.42, y: 0.5 }, 'L'),
      move({ x: 0.42, y: 0.5 }, { x: 0.64, y: 0.52 }, null),
      hold({ x: 0.64, y: 0.52 }, 'L'),
    ])
    expect(events.map((e) => e.letter)).toContain('Ł')
  })

  it('SZ: układ B + ruch w bok', () => {
    const events = runSteps([
      hold({ x: 0.6, y: 0.5 }, 'B'),
      move({ x: 0.6, y: 0.5 }, { x: 0.38, y: 0.5 }, null),
      hold({ x: 0.38, y: 0.5 }, 'B'),
    ])
    expect(events.map((e) => e.letter)).toContain('SZ')
  })

  it('J: układ I + haczyk małym palcem', () => {
    const events = runSteps(
      [
        hold({ x: 0.55, y: 0.4 }, 'I'),
        move({ x: 0.55, y: 0.4 }, { x: 0.55, y: 0.55 }, null, 250),
        move({ x: 0.55, y: 0.55 }, { x: 0.46, y: 0.57 }, null, 250),
        hold({ x: 0.46, y: 0.57 }, 'I'),
      ],
      'pinkyTip',
    )
    expect(events.map((e) => e.letter)).toContain('J')
  })

  it('D: wskazujący kręci kółko', () => {
    const cx = 0.5
    const cy = 0.5
    const r = 0.07
    const steps: Step[] = [hold({ x: cx + r, y: cy }, '_WSKAZUJACY')]
    const segments = 12
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2
      const a1 = ((i + 1) / segments) * Math.PI * 2
      steps.push(
        move(
          { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) },
          { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) },
          null,
          70,
        ),
      )
    }
    steps.push(hold({ x: cx + r, y: cy }, '_WSKAZUJACY'))
    const events = runSteps(steps, 'indexTip')
    expect(events.map((e) => e.letter)).toContain('D')
  })

  it('Z: wskazujący rysuje zygzak', () => {
    const events = runSteps(
      [
        hold({ x: 0.42, y: 0.42 }, '_WSKAZUJACY'),
        move({ x: 0.42, y: 0.42 }, { x: 0.58, y: 0.43 }, null, 220),
        move({ x: 0.58, y: 0.43 }, { x: 0.42, y: 0.55 }, null, 220),
        move({ x: 0.42, y: 0.55 }, { x: 0.58, y: 0.56 }, null, 220),
        hold({ x: 0.58, y: 0.56 }, '_WSKAZUJACY'),
      ],
      'indexTip',
    )
    expect(events.map((e) => e.letter)).toContain('Z')
  })

  it('RZ: układ R + zygzak', () => {
    const events = runSteps([
      hold({ x: 0.42, y: 0.42 }, 'R'),
      move({ x: 0.42, y: 0.42 }, { x: 0.58, y: 0.43 }, null, 220),
      move({ x: 0.58, y: 0.43 }, { x: 0.42, y: 0.55 }, null, 220),
      move({ x: 0.42, y: 0.55 }, { x: 0.58, y: 0.56 }, null, 220),
      hold({ x: 0.58, y: 0.56 }, 'R'),
    ])
    expect(events.map((e) => e.letter)).toContain('RZ')
  })

  it('Ź: wskazujący stawia ukośną kreskę', () => {
    const events = runSteps(
      [
        hold({ x: 0.5, y: 0.52 }, '_WSKAZUJACY'),
        move({ x: 0.5, y: 0.52 }, { x: 0.57, y: 0.44 }, null, 260),
        hold({ x: 0.57, y: 0.44 }, '_WSKAZUJACY'),
      ],
      'indexTip',
    )
    expect(events.map((e) => e.letter)).toContain('Ź')
  })

  it('Ż: wskazujący stawia kropkę ruchem w przód', () => {
    const events = runSteps(
      [
        hold({ x: 0.5, y: 0.5 }, '_WSKAZUJACY'),
        { ms: 350, from: { x: 0.5, y: 0.5 }, to: { x: 0.51, y: 0.52 }, palmTo: PALM * 1.35, shape: null },
        { ms: 600, from: { x: 0.51, y: 0.52 }, to: { x: 0.51, y: 0.52 }, shape: '_WSKAZUJACY' },
      ],
      'indexTip',
    )
    expect(events.map((e) => e.letter)).toContain('Ż')
  })

  it('K: trzy palce + szybki ruch ku rozmówcy', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, '_TRZY'),
      { ms: 350, from: { x: 0.5, y: 0.5 }, to: { x: 0.51, y: 0.53 }, palmTo: PALM * 1.35, shape: null },
      { ms: 600, from: { x: 0.51, y: 0.53 }, to: { x: 0.51, y: 0.53 }, shape: '_TRZY' },
    ])
    expect(events.map((e) => e.letter)).toContain('K')
  })

  it('CZ: szpon + ruch ku rozmówcy', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, '_SZPON'),
      { ms: 350, from: { x: 0.5, y: 0.5 }, to: { x: 0.51, y: 0.53 }, palmTo: PALM * 1.35, shape: null },
      { ms: 600, from: { x: 0.51, y: 0.53 }, to: { x: 0.51, y: 0.53 }, shape: '_SZPON' },
    ])
    expect(events.map((e) => e.letter)).toContain('CZ')
  })

  it('G: pstryknięcie - przejście z dzióbka do wskazującego', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, 'P', 500),
      hold({ x: 0.5, y: 0.5 }, '_WSKAZUJACY', 400),
    ])
    expect(events.map((e) => e.letter)).toContain('G')
  })

  it('U: wiktoria zginana w stronę rozmówcy', () => {
    const events = runSteps([
      hold({ x: 0.5, y: 0.5 }, 'V', 500),
      hold({ x: 0.5, y: 0.5 }, 'X', 400),
    ])
    expect(events.map((e) => e.letter)).toContain('U')
  })

  it('nie zgłasza litery dla ruchu bez zdefiniowanego wzorca (A w bok)', () => {
    const events = runSteps([
      hold({ x: 0.42, y: 0.5 }, 'A'),
      move({ x: 0.42, y: 0.5 }, { x: 0.64, y: 0.5 }, null),
      hold({ x: 0.64, y: 0.5 }, 'A'),
    ])
    expect(events).toHaveLength(0)
  })

  it('nie zgłasza litery, gdy dłoń tylko drży w miejscu', () => {
    const steps: Step[] = [hold({ x: 0.5, y: 0.5 }, 'B', 400)]
    for (let i = 0; i < 20; i++) {
      steps.push(
        move(
          { x: 0.5 + (i % 2 === 0 ? 0.004 : -0.004), y: 0.5 },
          { x: 0.5 + (i % 2 === 0 ? -0.004 : 0.004), y: 0.5 },
          'B',
          33,
        ),
      )
    }
    const events = runSteps(steps)
    expect(events).toHaveLength(0)
  })
})
