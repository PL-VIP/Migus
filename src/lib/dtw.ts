import {
  densifyFrames,
  resampleFrames,
  type HandFrame,
  type SignFrame,
  type SignTemplate,
} from './signTemplate'

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

/**
 * Progi przeliczania odległości DTW na wynik procentowy - skalibrowane
 * na rozkładach z 211 prawdziwych szablonów KSPJM (testy detectionQuality):
 * własny znak z szumem/tempem/lukami detekcji ma d ≈ 0,10-0,45,
 * inny znak niemal zawsze d > 0,50.
 */
const DIST_PERFECT = 0.18
const DIST_ZERO = 0.95

/** Udział klatek okna z co najmniej jedną dłonią. */
function presenceShare(frames: SignFrame[]): number {
  if (frames.length === 0) return 0
  return frames.filter((f) => f.left || f.right).length / frames.length
}

function mirrorHand(h: HandFrame | null): HandFrame | null {
  if (!h) return null
  return {
    wrist: [1 - h.wrist[0], h.wrist[1]],
    shape: h.shape.map((v, i) => (i % 3 === 0 ? -v : v)),
  }
}

/**
 * Lustrzane odbicie wykonania (oś pionowa kadru): zamiana rąk lewa↔prawa
 * i odwrócenie osi X. Osoba leworęczna miga „w lustrze” względem lektora -
 * takie wykonanie też uznajemy.
 */
export function mirrorFrames(frames: SignFrame[]): SignFrame[] {
  return frames.map((f) => ({ left: mirrorHand(f.right), right: mirrorHand(f.left) }))
}

/**
 * Najlepsze dopasowanie szablonu do PODSEKWENCJI nagrania użytkownika.
 *
 * Użytkownik nie zaczyna znaku idealnie w chwili startu nagrania - przed
 * i po znaku bywa unoszenie/opuszczanie rąk. Zamiast dopasowywać całe
 * nagranie, przesuwamy po nim okno o długości ~0,6-1,5 długości znaku
 * i bierzemy najmniejszą odległość DTW.
 *
 * `userFrames` to surowe klatki (po przycięciu brzegów bez dłoni),
 * `sampleFps` - tempo próbkowania nagrania.
 */
export function bestWindowDistance(
  userFrames: SignFrame[],
  template: SignTemplate,
  sampleFps = 15,
): number {
  if (userFrames.length === 0) return Infinity
  // Krótkie dziury w detekcji (do ~0,4 s) uzupełniamy interpolacją,
  // a klatki nadal puste odrzucamy: brak detekcji to brak informacji,
  // nie dowód, że ręce zniknęły (słaby sprzęt gubi klatki przy ruchu).
  const frames = densifyFrames(userFrames, Math.max(2, Math.round(sampleFps * 0.4))).filter(
    (f) => f.left || f.right,
  )
  if (frames.length === 0) return Infinity
  const targetLen = Math.max(6, Math.round(template.durationSec * sampleFps))
  const scales = [0.6, 0.8, 1.0, 1.25, 1.5]
  let best = Infinity

  for (const scale of scales) {
    const len = Math.min(frames.length, Math.max(6, Math.round(targetLen * scale)))
    const stride = Math.max(1, Math.round(len * 0.2))
    for (let start = 0; start + len <= frames.length; start += stride) {
      const window = frames.slice(start, start + len)
      // Okna w większości puste (dłonie poza kadrem) nie są kandydatami.
      if (presenceShare(window) < 0.5) continue
      const d = dtwDistance(resampleFrames(window), template.frames)
      if (d < best) best = d
    }
    // Ostatnie okno dosunięte do końca nagrania.
    if (frames.length > len) {
      const window = frames.slice(frames.length - len)
      if (presenceShare(window) >= 0.5) {
        const d = dtwDistance(resampleFrames(window), template.frames)
        if (d < best) best = d
      }
    }
  }

  // Całe nagranie jako kandydat - zachowuje dotychczasowe zachowanie.
  const whole = dtwDistance(resampleFrames(frames), template.frames)
  return Math.min(best, whole)
}

function distanceToResult(distance: number): MatchResult {
  const score = Math.max(0, Math.min(1, (DIST_ZERO - distance) / (DIST_ZERO - DIST_PERFECT)))
  const ok = score >= 0.55
  let feedback: string
  if (score >= 0.8) feedback = 'Świetnie! Znak wygląda bardzo dobrze.'
  else if (ok) feedback = 'Dobrze! Jeszcze odrobinę dopracuj płynność ruchu.'
  else if (score >= 0.35) feedback = 'Prawie! Porównaj układ dłoni i kierunek ruchu z nagraniem.'
  else feedback = 'Spróbuj jeszcze raz - obejrzyj nagranie i naśladuj ruch lektora.'
  return { distance, score, ok, feedback }
}

export function matchAgainstTemplate(user: SignFrame[], template: SignTemplate): MatchResult {
  return distanceToResult(dtwDistance(user, template.frames))
}

/**
 * Ocena nagrania użytkownika (surowe klatki po przycięciu) względem
 * szablonu - z dopasowaniem podsekwencyjnym. Nagranie praktycznie bez
 * wykrytych dłoni nie może dostać punktów.
 */
export function matchRecording(
  userFrames: SignFrame[],
  template: SignTemplate,
  sampleFps = 15,
): MatchResult {
  // Udział dłoni liczymy po uzupełnieniu krótkich przerw w detekcji -
  // wolny sprzęt gubi klatki w trakcie ruchu, co nie jest winą użytkownika.
  const densified = densifyFrames(userFrames, Math.max(2, Math.round(sampleFps * 0.4)))
  const withHands = densified.filter((f) => f.left || f.right).length
  if (withHands < 5 || withHands / Math.max(1, densified.length) < 0.2) {
    return {
      distance: Infinity,
      score: 0,
      ok: false,
      feedback: 'Nie widziałem dłoni podczas nagrania. Ustaw ręce w kadrze i spróbuj ponownie.',
    }
  }
  const direct = bestWindowDistance(userFrames, template, sampleFps)
  const mirrored = bestWindowDistance(mirrorFrames(userFrames), template, sampleFps)
  return distanceToResult(Math.min(direct, mirrored))
}
