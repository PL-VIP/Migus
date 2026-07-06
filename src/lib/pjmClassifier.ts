import type { HandFeatures } from './handFeatures'

/**
 * Klasyfikator statycznych liter alfabetu palcowego PJM (daktylografia).
 *
 * Rozpoznajemy litery, których znak jest nieruchomym układem dłoni.
 * Litery wymagające ruchu (np. Ą, Ę, J, Ł, RZ, SZ) nie są obsługiwane w tej wersji.
 *
 * Każda litera opisana jest zestawem kryteriów rozmytych (wartości 0–1).
 * Pewność rozpoznania to średnia ważona kryteriów.
 */

export interface LetterRule {
  letter: string
  /** Opis układu dłoni po polsku (wyświetlany w UI). */
  description: string
  criteria: Array<{
    name: string
    weight: number
    score: (f: HandFeatures) => number
  }>
}

export interface ClassificationResult {
  letter: string
  confidence: number
}

/**
 * Funkcja trapezowa: 1 w przedziale [lo, hi], liniowo opada do 0
 * na odcinkach [lo − margin, lo] oraz [hi, hi + margin].
 */
export function trapezoid(value: number, lo: number, hi: number, margin: number): number {
  if (value >= lo && value <= hi) return 1
  if (value < lo) return Math.max(0, 1 - (lo - value) / margin)
  return Math.max(0, 1 - (value - hi) / margin)
}

// Progi zgięcia palca (suma kątów w stawach, stopnie)
const straight = (curl: number) => trapezoid(curl, 0, 55, 35)
const halfBent = (curl: number) => trapezoid(curl, 45, 130, 35)
const curled = (curl: number) => trapezoid(curl, 110, 360, 45)
const notStraight = (curl: number) => trapezoid(curl, 75, 360, 40)

export const LETTER_RULES: LetterRule[] = [
  {
    letter: 'A',
    description: 'Zaciśnięta pięść, kciuk wyprostowany i przylega z boku do palca wskazującego.',
    criteria: [
      { name: 'wskazujący zgięty', weight: 1, score: (f) => curled(f.fingers.index.curlDeg) },
      { name: 'środkowy zgięty', weight: 1, score: (f) => curled(f.fingers.middle.curlDeg) },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => curled(f.fingers.ring.curlDeg) },
      { name: 'mały zgięty', weight: 1, score: (f) => curled(f.fingers.pinky.curlDeg) },
      { name: 'kciuk prosty', weight: 1, score: (f) => trapezoid(f.fingers.thumb.curlDeg, 0, 70, 40) },
      {
        name: 'kciuk wzdłuż dłoni',
        weight: 1,
        score: (f) => trapezoid(f.thumbPalmAngleDeg, 0, 45, 30),
      },
      {
        name: 'kciuk nie owinięty na palcach',
        weight: 0.5,
        score: (f) => trapezoid(f.thumbToMiddleMcp, 0.45, 3, 0.2),
      },
    ],
  },
  {
    letter: 'B',
    description: 'Dłoń otwarta, palce wyprostowane i złączone, kciuk przylega do dłoni.',
    criteria: [
      { name: 'wskazujący prosty', weight: 1, score: (f) => straight(f.fingers.index.curlDeg) },
      { name: 'środkowy prosty', weight: 1, score: (f) => straight(f.fingers.middle.curlDeg) },
      { name: 'serdeczny prosty', weight: 1, score: (f) => straight(f.fingers.ring.curlDeg) },
      { name: 'mały prosty', weight: 1, score: (f) => straight(f.fingers.pinky.curlDeg) },
      {
        name: 'palce złączone',
        weight: 1.5,
        score: (f) =>
          (trapezoid(f.indexMiddleSpreadDeg, 0, 12, 10) +
            trapezoid(f.middleRingSpreadDeg, 0, 10, 8) +
            trapezoid(f.ringPinkySpreadDeg, 0, 14, 10)) /
          3,
      },
      {
        name: 'kciuk schowany przy dłoni',
        weight: 1.5,
        score: (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.55, 0.35),
      },
    ],
  },
  {
    letter: 'C',
    description: 'Palce zaokrąglone, dłoń w kształcie litery C (jak przy trzymaniu kubka).',
    criteria: [
      { name: 'wskazujący półzgięty', weight: 1, score: (f) => halfBent(f.fingers.index.curlDeg) },
      { name: 'środkowy półzgięty', weight: 1, score: (f) => halfBent(f.fingers.middle.curlDeg) },
      { name: 'serdeczny półzgięty', weight: 1, score: (f) => halfBent(f.fingers.ring.curlDeg) },
      { name: 'mały półzgięty', weight: 0.7, score: (f) => halfBent(f.fingers.pinky.curlDeg) },
      {
        name: 'otwarcie między kciukiem a wskazującym',
        weight: 1.5,
        score: (f) => trapezoid(f.thumbIndexPinch, 0.45, 1.2, 0.25),
      },
      {
        name: 'kciuk odsunięty od dłoni',
        weight: 0.7,
        score: (f) => trapezoid(f.thumbToMiddleMcp, 0.55, 3, 0.25),
      },
    ],
  },
  {
    letter: 'E',
    description: 'Dłoń złożona w „daszek”: kciuk dotyka opuszków złączonych, zgiętych palców.',
    criteria: [
      { name: 'wskazujący zgięty', weight: 1, score: (f) => notStraight(f.fingers.index.curlDeg) },
      { name: 'środkowy zgięty', weight: 1, score: (f) => notStraight(f.fingers.middle.curlDeg) },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => notStraight(f.fingers.ring.curlDeg) },
      { name: 'mały zgięty', weight: 0.7, score: (f) => notStraight(f.fingers.pinky.curlDeg) },
      {
        name: 'kciuk dotyka opuszków palców',
        weight: 2,
        score: (f) => trapezoid(f.thumbToFingertipsMean, 0, 0.4, 0.25),
      },
    ],
  },
  {
    letter: 'I',
    description: 'Mały palec wyprostowany, pozostałe palce zaciśnięte w pięść.',
    criteria: [
      { name: 'mały prosty', weight: 2, score: (f) => straight(f.fingers.pinky.curlDeg) },
      { name: 'wskazujący zgięty', weight: 1, score: (f) => curled(f.fingers.index.curlDeg) },
      { name: 'środkowy zgięty', weight: 1, score: (f) => curled(f.fingers.middle.curlDeg) },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => curled(f.fingers.ring.curlDeg) },
      {
        name: 'kciuk przy dłoni',
        weight: 1,
        score: (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.75, 0.35),
      },
    ],
  },
  {
    letter: 'L',
    description: 'Kciuk i palec wskazujący tworzą kąt prosty (kształt litery L), reszta zgięta.',
    criteria: [
      { name: 'wskazujący prosty', weight: 1.5, score: (f) => straight(f.fingers.index.curlDeg) },
      { name: 'kciuk prosty', weight: 1, score: (f) => trapezoid(f.fingers.thumb.curlDeg, 0, 70, 40) },
      {
        name: 'kąt prosty kciuk–wskazujący',
        weight: 1.5,
        score: (f) => trapezoid(f.thumbIndexAngleDeg, 55, 115, 30),
      },
      { name: 'środkowy zgięty', weight: 1, score: (f) => curled(f.fingers.middle.curlDeg) },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => curled(f.fingers.ring.curlDeg) },
      { name: 'mały zgięty', weight: 1, score: (f) => curled(f.fingers.pinky.curlDeg) },
    ],
  },
  {
    letter: 'O',
    description: 'Kciuk i palec wskazujący stykają się opuszkami tworząc okrąg, pozostałe palce proste lub lekko zgięte.',
    criteria: [
      {
        name: 'kciuk styka się ze wskazującym',
        weight: 2,
        score: (f) => trapezoid(f.thumbIndexPinch, 0, 0.3, 0.2),
      },
      { name: 'wskazujący zaokrąglony', weight: 1, score: (f) => trapezoid(f.fingers.index.curlDeg, 40, 160, 35) },
      {
        name: 'środkowy niezgięty w pięść',
        weight: 1,
        score: (f) => trapezoid(f.fingers.middle.curlDeg, 0, 110, 45),
      },
      {
        name: 'serdeczny niezgięty w pięść',
        weight: 1,
        score: (f) => trapezoid(f.fingers.ring.curlDeg, 0, 110, 45),
      },
      {
        name: 'mały niezgięty w pięść',
        weight: 1,
        score: (f) => trapezoid(f.fingers.pinky.curlDeg, 0, 110, 45),
      },
      {
        name: 'środkowy nie skleja się z okręgiem',
        weight: 0.7,
        score: (f) => trapezoid(f.fingers.middle.tipDist, 1.05, 3, 0.3),
      },
    ],
  },
  {
    letter: 'R',
    description: 'Palec wskazujący i środkowy skrzyżowane, pozostałe palce zaciśnięte.',
    criteria: [
      { name: 'wskazujący prosty', weight: 1, score: (f) => trapezoid(f.fingers.index.curlDeg, 0, 75, 35) },
      { name: 'środkowy prosty', weight: 1, score: (f) => trapezoid(f.fingers.middle.curlDeg, 0, 75, 35) },
      {
        name: 'palce skrzyżowane',
        weight: 2.5,
        score: (f) =>
          f.indexMiddleCrossed ? 1 : trapezoid(f.indexMiddleTipGap, 0, 0.12, 0.1) * 0.6,
      },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => curled(f.fingers.ring.curlDeg) },
      { name: 'mały zgięty', weight: 1, score: (f) => curled(f.fingers.pinky.curlDeg) },
    ],
  },
  {
    letter: 'W',
    description: 'Środkowy, serdeczny i mały wyprostowane i rozsunięte; kciuk i wskazujący złączone w pętlę.',
    criteria: [
      { name: 'środkowy prosty', weight: 1, score: (f) => straight(f.fingers.middle.curlDeg) },
      { name: 'serdeczny prosty', weight: 1, score: (f) => straight(f.fingers.ring.curlDeg) },
      { name: 'mały prosty', weight: 1, score: (f) => straight(f.fingers.pinky.curlDeg) },
      {
        name: 'kciuk i wskazujący w pętli',
        weight: 2,
        score: (f) => trapezoid(f.thumbIndexPinch, 0, 0.35, 0.25),
      },
      { name: 'wskazujący zaokrąglony', weight: 1, score: (f) => notStraight(f.fingers.index.curlDeg) },
      {
        name: 'palce rozsunięte',
        weight: 0.7,
        score: (f) =>
          (trapezoid(f.middleRingSpreadDeg, 8, 90, 6) + trapezoid(f.ringPinkySpreadDeg, 8, 90, 6)) / 2,
      },
    ],
  },
  {
    letter: 'Y',
    description: 'Wskazujący i mały palec wyprostowane, środkowy i serdeczny zgięte, kciuk nałożony na zgięte palce.',
    criteria: [
      { name: 'wskazujący prosty', weight: 1.5, score: (f) => straight(f.fingers.index.curlDeg) },
      { name: 'mały prosty', weight: 1.5, score: (f) => straight(f.fingers.pinky.curlDeg) },
      { name: 'środkowy zgięty', weight: 1, score: (f) => curled(f.fingers.middle.curlDeg) },
      { name: 'serdeczny zgięty', weight: 1, score: (f) => curled(f.fingers.ring.curlDeg) },
      {
        name: 'kciuk na zgiętych palcach',
        weight: 1,
        score: (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.8, 0.4),
      },
    ],
  },
]

export const SUPPORTED_LETTERS = LETTER_RULES.map((r) => ({
  letter: r.letter,
  description: r.description,
}))

/** Minimalna pewność, poniżej której nie zgłaszamy rozpoznania. */
export const MIN_CONFIDENCE = 0.72

function scoreRule(rule: LetterRule, f: HandFeatures): number {
  let sum = 0
  let weightSum = 0
  for (const c of rule.criteria) {
    sum += c.weight * c.score(f)
    weightSum += c.weight
  }
  return weightSum > 0 ? sum / weightSum : 0
}

/** Zwraca wszystkie litery posortowane malejąco wg pewności. */
export function rankLetters(f: HandFeatures): ClassificationResult[] {
  return LETTER_RULES.map((rule) => ({
    letter: rule.letter,
    confidence: scoreRule(rule, f),
  })).sort((a, b) => b.confidence - a.confidence)
}

/**
 * Najlepsze dopasowanie lub null, gdy żadna litera nie osiąga progu pewności
 * albo dwie najlepsze litery są zbyt blisko siebie (niejednoznaczność).
 */
export function classifyHand(f: HandFeatures): ClassificationResult | null {
  const ranked = rankLetters(f)
  const best = ranked[0]
  if (!best || best.confidence < MIN_CONFIDENCE) return null
  const second = ranked[1]
  if (second && best.confidence - second.confidence < 0.03) return null
  return best
}
