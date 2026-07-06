import type { HandFrame, SignFrame, SignTemplate } from './signTemplate'

/**
 * Dopasowanie wykonania użytkownika do szablonu znaku metodą
 * DTW (Dynamic Time Warping) - odporne na różnice tempa migania.
 */

/** Odległość kształtów dłoni (znormalizowane 63-wymiarowe wektory). */
function shapeDist(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum / a.length)
}

/** Kara za brak dłoni, gdy szablon jej wymaga (i odwrotnie). */
const MISSING_HAND_COST = 1.1

/** Waga trajektorii (pozycji nadgarstka w kadrze) względem kształtu dłoni. */
const TRAJECTORY_WEIGHT = 2.2

function handDist(a: HandFrame | null, b: HandFrame | null): number {
  if (!a && !b) return 0
  if (!a || !b) return MISSING_HAND_COST
  const shape = shapeDist(a.shape, b.shape)
  const traj = Math.hypot(a.wrist[0] - b.wrist[0], a.wrist[1] - b.wrist[1])
  return shape + TRAJECTORY_WEIGHT * traj
}

/**
 * Odległość między klatkami: średnia po dłoniach, które występują
 * w którejkolwiek z klatek (pary pustych dłoni nie rozmywają kosztu).
 */
export function frameDist(a: SignFrame, b: SignFrame): number {
  let sum = 0
  let active = 0
  if (a.left || b.left) {
    sum += handDist(a.left, b.left)
    active++
  }
  if (a.right || b.right) {
    sum += handDist(a.right, b.right)
    active++
  }
  return active > 0 ? sum / active : 0
}

/**
 * DTW z pasmem Sakoe-Chiba i symetryczną normalizacją: krok po przekątnej
 * kosztuje 2·d, kroki poziome/pionowe 1·d, wynik dzielony przez n+m.
 * Ta normalizacja karze „przesiadywanie” w jednym punkcie sekwencji.
 */
export function dtwDistance(
  seqA: SignFrame[],
  seqB: SignFrame[],
  bandRatio = 0.35,
): number {
  const n = seqA.length
  const m = seqB.length
  if (n === 0 || m === 0) return Infinity
  const band = Math.max(3, Math.floor(Math.max(n, m) * bandRatio))

  const INF = Number.POSITIVE_INFINITY
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF))
  cost[0][0] = 0

  for (let i = 1; i <= n; i++) {
    const jLo = Math.max(1, i - band)
    const jHi = Math.min(m, i + band)
    for (let j = jLo; j <= jHi; j++) {
      const d = frameDist(seqA[i - 1], seqB[j - 1])
      const best = Math.min(
        cost[i - 1][j - 1] + 2 * d,
        cost[i - 1][j] + d,
        cost[i][j - 1] + d,
      )
      if (best !== INF) cost[i][j] = best
    }
  }

  if (cost[n][m] === INF) return Infinity
  return cost[n][m] / (n + m)
}

export interface MatchResult {
  /** Średni koszt DTW (mniej = lepiej). */
  distance: number
  /** Wynik 0..1 (1 = idealnie). */
  score: number
  /** Czy uznajemy wykonanie za poprawne. */
  ok: boolean
  /** Ocena opisowa po polsku. */
  feedback: string
}

/** Progi przeliczania odległości DTW na wynik procentowy. */
const DIST_PERFECT = 0.35
const DIST_ZERO = 1.25

export function matchAgainstTemplate(user: SignFrame[], template: SignTemplate): MatchResult {
  const distance = dtwDistance(user, template.frames)
  const score = Math.max(0, Math.min(1, (DIST_ZERO - distance) / (DIST_ZERO - DIST_PERFECT)))
  const ok = score >= 0.55
  let feedback: string
  if (score >= 0.8) feedback = 'Świetnie! Znak wygląda bardzo dobrze.'
  else if (ok) feedback = 'Dobrze! Jeszcze odrobinę dopracuj płynność ruchu.'
  else if (score >= 0.35) feedback = 'Prawie! Porównaj układ dłoni i kierunek ruchu z nagraniem.'
  else feedback = 'Spróbuj jeszcze raz - obejrzyj nagranie i naśladuj ruch lektora.'
  return { distance, score, ok, feedback }
}
