/**
 * Analiza trajektorii nadgarstka dla liter ruchomych alfabetu palcowego.
 *
 * Wejściem jest lista próbek pozycji (w jednostkach „rozmiaru dłoni”,
 * czyli niezależnie od odległości od kamery), wyjściem - podsumowanie ruchu
 * z rozpoznanym wzorcem: zjazd w dół (Ó, Ś, Ć, Ń, H, CH), ruch w bok (Ł, SZ),
 * „ogonek”/hak (Ą, Ę, J), zygzak litery Z (Z, RZ), kółko (D), ruch do przodu
 * (K, CZ, Ż) albo krótka kreska (Ź).
 */

export interface MotionSample {
  /** Czas w ms. */
  t: number
  /** Pozycja nadgarstka w jednostkach rozmiaru dłoni. */
  x: number
  y: number
  /** Rozmiar dłoni w ułamku szerokości obrazu (do wykrywania ruchu „w przód”). */
  palm: number
}

export type MotionPattern =
  | 'circle'
  | 'zigzag'
  | 'hook'
  | 'side'
  | 'down'
  | 'forward'
  | 'stroke'

export interface MotionInfo {
  /** Rozpoznany wzorzec ruchu lub null, gdy ruch nie pasuje do żadnego. */
  pattern: MotionPattern | null
  /** Przemieszczenie netto (jednostki dłoni). */
  netX: number
  netY: number
  /** Długość przemieszczenia netto. */
  net: number
  /** Długość całej ścieżki. */
  path: number
  /** Stosunek rozmiaru dłoni koniec/początek (ruch w przód > 1). */
  palmRatio: number
}

/** Monotoniczne przebiegi współrzędnej x o amplitudzie ≥ minAmp. */
export function xRuns(samples: MotionSample[], minAmp: number): number[] {
  const runs: number[] = []
  let runStart = samples[0]?.x ?? 0
  let extreme = runStart
  let dir = 0
  for (const s of samples) {
    if (dir === 0) {
      if (Math.abs(s.x - runStart) >= minAmp) {
        dir = Math.sign(s.x - runStart)
        extreme = s.x
      }
      continue
    }
    if ((s.x - extreme) * dir >= 0) {
      extreme = s.x
    } else if (Math.abs(s.x - extreme) >= minAmp) {
      runs.push(extreme - runStart)
      runStart = extreme
      dir = Math.sign(s.x - extreme)
      extreme = s.x
    }
  }
  if (dir !== 0) runs.push(extreme - runStart)
  return runs
}

/** Suma kątów skrętu kierunku ruchu (stopnie, ze znakiem). */
export function totalTurningDeg(samples: MotionSample[], minStep: number): number {
  let total = 0
  let prevAngle: number | null = null
  let px = samples[0]?.x ?? 0
  let py = samples[0]?.y ?? 0
  for (const s of samples) {
    const dx = s.x - px
    const dy = s.y - py
    if (Math.hypot(dx, dy) < minStep) continue
    const angle = Math.atan2(dy, dx)
    if (prevAngle !== null) {
      let diff = angle - prevAngle
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      total += diff
    }
    prevAngle = angle
    px = s.x
    py = s.y
  }
  return (total * 180) / Math.PI
}

/** Średni kierunek ruchu wycinka próbek: kąt w stopniach (0° = w prawo, 90° = w dół). */
function meanDirectionDeg(samples: MotionSample[]): number | null {
  if (samples.length < 2) return null
  const dx = samples[samples.length - 1].x - samples[0].x
  const dy = samples[samples.length - 1].y - samples[0].y
  if (Math.hypot(dx, dy) < 1e-6) return null
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/** Odchylenie kąta a od b w zakresie 0-180. */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function pathLength(samples: MotionSample[]): number {
  let path = 0
  for (let i = 1; i < samples.length; i++) {
    path += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y)
  }
  return path
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

function sumAbs(values: number[]): number {
  return values.reduce((a, b) => a + Math.abs(b), 0)
}

/**
 * Podsumowuje segment ruchu i klasyfikuje jego wzorzec.
 * `pattern` jest null, gdy ruch nie przypomina żadnego wzorca liter.
 */
export function summarizeMotion(samples: MotionSample[]): MotionInfo {
  const first = samples[0]
  const last = samples[samples.length - 1]
  const netX = (last?.x ?? 0) - (first?.x ?? 0)
  const netY = (last?.y ?? 0) - (first?.y ?? 0)
  const net = Math.hypot(netX, netY)
  const path = pathLength(samples)
  const palmStart = average(samples.slice(0, 3).map((s) => s.palm))
  const palmEnd = average(samples.slice(-3).map((s) => s.palm))
  const palmRatio = palmStart > 0 ? palmEnd / palmStart : 1

  const base: Omit<MotionInfo, 'pattern'> = { netX, netY, net, path, palmRatio }
  if (samples.length < 4) return { pattern: null, ...base }

  const runs = xRuns(samples, 0.3)
  const turning = totalTurningDeg(samples, 0.08)

  // Kółko (litera D): duży skręt sumaryczny, ścieżka prawie się domyka.
  if (Math.abs(turning) >= 290 && path >= 1.1 && net / Math.max(path, 1e-6) <= 0.45) {
    return { pattern: 'circle', ...base }
  }

  // Zygzak litery Z: co najmniej 3 naprzemienne przebiegi poziome.
  if (runs.length >= 3 && sumAbs(runs) >= 1.1 && netY > -0.3) {
    return { pattern: 'zigzag', ...base }
  }

  const third = Math.max(2, Math.floor(samples.length / 3))
  const startDir = meanDirectionDeg(samples.slice(0, third + 1))
  const endDir = meanDirectionDeg(samples.slice(-third - 1))

  // „Ogonek” / litera J: start w dół, koniec w bok (zakręt).
  if (
    net >= 0.45 &&
    netY >= 0.3 &&
    startDir !== null &&
    endDir !== null &&
    angleDiff(startDir, 90) <= 50 &&
    Math.min(angleDiff(endDir, 0), angleDiff(endDir, 180)) <= 50 &&
    Math.abs(netX) >= 0.2
  ) {
    return { pattern: 'hook', ...base }
  }

  // Prosty ruch w bok (Ł, SZ).
  if (Math.abs(netX) >= 0.7 && Math.abs(netY) <= 0.6 * Math.abs(netX) && runs.length <= 1) {
    return { pattern: 'side', ...base }
  }

  // Prosty zjazd w dół (Ó, Ś, Ć, Ń, H, CH).
  if (netY >= 0.5 && Math.abs(netX) <= 0.6 * netY && path / Math.max(net, 1e-6) <= 1.7) {
    return { pattern: 'down', ...base }
  }

  // Ruch w przód, ku rozmówcy (K, CZ, Ż): dłoń wyraźnie się przybliża.
  if (palmRatio >= 1.14 && net <= 1.4) {
    return { pattern: 'forward', ...base }
  }

  // Krótka prosta kreska (np. Ź).
  if (net >= 0.25 && net <= 1.3 && path / Math.max(net, 1e-6) <= 1.5) {
    return { pattern: 'stroke', ...base }
  }

  return { pattern: null, ...base }
}
