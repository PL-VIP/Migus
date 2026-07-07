import type { HandFeatures } from './handFeatures'

/**
 * Klasyfikator układów dłoni polskiego alfabetu palcowego (daktylografia PJM).
 *
 * Rozpoznaje WSZYSTKIE litery statyczne oraz układy bazowe liter ruchomych
 * (np. „wskazujący” dla D/Z/Ź/Ż, „trójpalczasty” dla K). Litery ruchome
 * (Ą, Ę, J, Ł, SZ...) wykrywa silnik ruchu w `dynamicLetters.ts`, któremu
 * ten moduł dostarcza stabilny układ bazowy.
 *
 * Cechy wejściowe są kanonizowane (obrót dłoni + odbicie ręki lewej),
 * więc reguły działają dla obu rąk i przy pochylonej dłoni. Litery, w których
 * orientacja dłoni ma znaczenie (M, N - dłoń pozioma), używają cechy
 * `palmAngleDeg` sprzed kanonizacji.
 *
 * Opisy układów na podstawie publicznych materiałów o polskim alfabecie
 * palcowym (m.in. pomigam.pl, Babbel, KSPJM); część liter rzadkich (X)
 * jest przybliżona.
 */

export interface LetterRule {
  letter: string
  /** Opis układu dłoni po polsku (wyświetlany w UI). */
  description: string
  /** Układy bazowe liter ruchomych - niewyświetlane jako wynik. */
  hidden?: boolean
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

// ---------- pomocnicze oceny palców ----------

const straight = (curl: number) => trapezoid(curl, 0, 55, 35)
const halfBent = (curl: number) => trapezoid(curl, 45, 130, 35)
const curled = (curl: number) => trapezoid(curl, 110, 360, 45)
const notStraight = (curl: number) => trapezoid(curl, 75, 360, 40)

type Crit = LetterRule['criteria'][number]

const c = (name: string, weight: number, score: Crit['score']): Crit => ({ name, weight, score })

/** Wszystkie 4 palce (bez kciuka) zgięte w pięść. */
const fingersFist = (w = 1): Crit[] => [
  c('wskazujący zgięty', w, (f) => curled(f.fingers.index.curlDeg)),
  c('środkowy zgięty', w, (f) => curled(f.fingers.middle.curlDeg)),
  c('serdeczny zgięty', w, (f) => curled(f.fingers.ring.curlDeg)),
  c('mały zgięty', w, (f) => curled(f.fingers.pinky.curlDeg)),
]

/** Dłoń pionowa (palce ku górze) - domyślna orientacja większości liter. */
const palmUpright = (w = 0.6): Crit =>
  c('dłoń pionowa', w, (f) => trapezoid(Math.abs(f.palmAngleDeg), 0, 50, 30))

/** Dłoń pozioma (palce w bok) lub skierowana do rozmówcy - litery M, N. */
const palmHorizontal = (w = 1.2): Crit =>
  c('dłoń pozioma lub do rozmówcy', w, (f) =>
    Math.max(
      trapezoid(Math.abs(f.palmAngleDeg), 60, 150, 25),
      trapezoid(f.foreshortening, 0, 0.6, 0.25),
    ),
  )

export const LETTER_RULES: LetterRule[] = [
  {
    letter: 'A',
    description: 'Zaciśnięta pięść, kciuk wyprostowany przylega z boku do palca wskazującego.',
    criteria: [
      ...fingersFist(),
      c('kciuk prosty', 1, (f) => trapezoid(f.fingers.thumb.curlDeg, 0, 70, 40)),
      c('kciuk wzdłuż dłoni', 1, (f) => trapezoid(f.thumbSideAngleDeg, -25, 40, 25)),
      c('kciuk nie owinięty na palcach', 0.5, (f) => trapezoid(f.thumbToMiddleMcp, 0.45, 3, 0.2)),
    ],
  },
  {
    letter: 'B',
    description: 'Dłoń otwarta, palce wyprostowane i złączone, kciuk zgięty przylega do dłoni.',
    criteria: [
      c('wskazujący prosty', 1, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy prosty', 1, (f) => straight(f.fingers.middle.curlDeg)),
      c('serdeczny prosty', 1, (f) => straight(f.fingers.ring.curlDeg)),
      c('mały prosty', 1, (f) => straight(f.fingers.pinky.curlDeg)),
      c('palce złączone', 1.5, (f) =>
        (trapezoid(f.indexMiddleSpreadDeg, 0, 12, 10) +
          trapezoid(f.middleRingSpreadDeg, 0, 10, 8) +
          trapezoid(f.ringPinkySpreadDeg, 0, 14, 10)) /
        3,
      ),
      c('kciuk schowany przy dłoni', 1.5, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.55, 0.35)),
      palmUpright(),
    ],
  },
  {
    letter: 'C',
    description: 'Palce zaokrąglone, dłoń w kształcie litery C (jak przy trzymaniu kubka).',
    criteria: [
      c('wskazujący półzgięty', 1, (f) => halfBent(f.fingers.index.curlDeg)),
      c('środkowy półzgięty', 1, (f) => halfBent(f.fingers.middle.curlDeg)),
      c('serdeczny półzgięty', 1, (f) => halfBent(f.fingers.ring.curlDeg)),
      c('mały półzgięty', 0.7, (f) => halfBent(f.fingers.pinky.curlDeg)),
      c('otwarcie między kciukiem a wskazującym', 1.5, (f) => trapezoid(f.thumbIndexPinch, 0.45, 1.2, 0.25)),
      c('kciuk odsunięty od dłoni', 0.7, (f) => trapezoid(f.thumbToMiddleMcp, 0.55, 3, 0.25)),
    ],
  },
  {
    letter: 'E',
    description: 'Dłoń złożona w „daszek”: kciuk dotyka opuszków złączonych, zgiętych palców.',
    criteria: [
      c('wskazujący w daszek (nie pięść)', 1, (f) => trapezoid(f.fingers.index.curlDeg, 60, 120, 25)),
      c('środkowy w daszek (nie pięść)', 1, (f) => trapezoid(f.fingers.middle.curlDeg, 60, 120, 25)),
      c('serdeczny w daszek (nie pięść)', 1, (f) => trapezoid(f.fingers.ring.curlDeg, 60, 120, 25)),
      c('mały zgięty', 0.6, (f) => notStraight(f.fingers.pinky.curlDeg)),
      c('kciuk dotyka opuszków palców', 1.6, (f) => trapezoid(f.thumbToFingertipsMean, 0, 0.4, 0.25)),
      c('kciuk dotyka środkowego', 1.2, (f) => trapezoid(f.thumbMiddlePinch, 0, 0.35, 0.2)),
    ],
  },
  {
    letter: 'F',
    description: 'Opuszki kciuka i palca wskazującego złączone w kółeczko, pozostałe palce luźno ugięte i rozstawione.',
    criteria: [
      c('kciuk styka się ze wskazującym', 2, (f) => trapezoid(f.thumbIndexPinch, 0, 0.28, 0.16)),
      c('wskazujący zaokrąglony', 0.8, (f) => trapezoid(f.fingers.index.curlDeg, 40, 160, 35)),
      c('środkowy luźno ugięty', 1, (f) => trapezoid(f.fingers.middle.curlDeg, 25, 95, 22)),
      c('serdeczny luźno ugięty', 1, (f) => trapezoid(f.fingers.ring.curlDeg, 25, 95, 22)),
      c('mały luźno ugięty', 0.8, (f) => trapezoid(f.fingers.pinky.curlDeg, 15, 95, 22)),
      c('palce rozstawione', 1.2, (f) =>
        (trapezoid(f.middleRingSpreadDeg, 8, 90, 6) + trapezoid(f.ringPinkySpreadDeg, 8, 90, 6)) / 2,
      ),
    ],
  },
  {
    letter: 'I',
    description: 'Mały palec wyprostowany, pozostałe palce zaciśnięte w pięść.',
    criteria: [
      c('mały prosty', 2, (f) => straight(f.fingers.pinky.curlDeg)),
      c('wskazujący zgięty', 1, (f) => curled(f.fingers.index.curlDeg)),
      c('środkowy zgięty', 1, (f) => curled(f.fingers.middle.curlDeg)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('kciuk przy dłoni', 1, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.75, 0.35)),
    ],
  },
  {
    letter: 'L',
    description: 'Kciuk i palec wskazujący tworzą kąt prosty (kształt litery L), pozostałe palce zgięte.',
    criteria: [
      c('wskazujący prosty', 1.5, (f) => straight(f.fingers.index.curlDeg)),
      c('kciuk prosty', 1, (f) => trapezoid(f.fingers.thumb.curlDeg, 0, 70, 40)),
      c('kąt prosty kciuk-wskazujący', 1.5, (f) => trapezoid(f.thumbIndexAngleDeg, 55, 115, 30)),
      c('kciuk w bok', 0.8, (f) => trapezoid(f.thumbSideAngleDeg, 45, 115, 30)),
      c('środkowy zgięty', 1, (f) => curled(f.fingers.middle.curlDeg)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
    ],
  },
  {
    letter: 'M',
    description: 'Dłoń pozioma, skierowana palcami do rozmówcy, wszystkie palce wyprostowane i złączone, kciuk ku górze.',
    criteria: [
      c('wskazujący prosty', 1, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy prosty', 1, (f) => straight(f.fingers.middle.curlDeg)),
      c('serdeczny prosty', 1, (f) => straight(f.fingers.ring.curlDeg)),
      c('mały prosty', 1, (f) => straight(f.fingers.pinky.curlDeg)),
      c('palce złączone', 1.2, (f) =>
        (trapezoid(f.indexMiddleSpreadDeg, 0, 13, 10) +
          trapezoid(f.middleRingSpreadDeg, 0, 11, 8) +
          trapezoid(f.ringPinkySpreadDeg, 0, 15, 10)) /
        3,
      ),
      palmHorizontal(1.6),
    ],
  },
  {
    letter: 'N',
    description: 'Dłoń pozioma („pistolet”): wskazujący i środkowy wyprostowane i złączone, pozostałe zgięte.',
    criteria: [
      c('wskazujący prosty', 1.2, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy prosty', 1.2, (f) => straight(f.fingers.middle.curlDeg)),
      c('palce złączone', 1, (f) => trapezoid(f.indexMiddleSpreadDeg, 0, 13, 10)),
      c('serdeczny zgięty', 1, (f) => notStraight(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => notStraight(f.fingers.pinky.curlDeg)),
      palmHorizontal(),
    ],
  },
  {
    letter: 'O',
    description: 'Kciuk i palec wskazujący stykają się opuszkami w okrąg, pozostałe palce proste i złączone.',
    criteria: [
      c('kciuk styka się ze wskazującym', 2, (f) => trapezoid(f.thumbIndexPinch, 0, 0.18, 0.12)),
      c('wskazujący zaokrąglony', 1, (f) => trapezoid(f.fingers.index.curlDeg, 40, 160, 35)),
      c('środkowy prosty lub lekko zgięty', 1, (f) => trapezoid(f.fingers.middle.curlDeg, 0, 70, 45)),
      c('serdeczny prosty lub lekko zgięty', 1, (f) => trapezoid(f.fingers.ring.curlDeg, 0, 70, 45)),
      c('mały prosty lub lekko zgięty', 1, (f) => trapezoid(f.fingers.pinky.curlDeg, 0, 70, 45)),
      c('środkowy nie skleja się z okręgiem', 0.7, (f) => trapezoid(f.fingers.middle.tipDist, 1.05, 3, 0.3)),
      c('palce złączone (odróżnia od F i W)', 1, (f) =>
        (trapezoid(f.middleRingSpreadDeg, 0, 8, 6) + trapezoid(f.ringPinkySpreadDeg, 0, 10, 8)) / 2,
      ),
    ],
  },
  {
    letter: 'P',
    description: 'Pięść, kciuk i palec wskazujący stykają się opuszkami (dzióbek), pozostałe palce zgięte.',
    criteria: [
      c('kciuk styka się ze wskazującym', 2, (f) => trapezoid(f.thumbIndexPinch, 0, 0.3, 0.2)),
      c('środkowy zgięty', 1.1, (f) => curled(f.fingers.middle.curlDeg)),
      c('serdeczny zgięty', 1.1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1.1, (f) => curled(f.fingers.pinky.curlDeg)),
      c('wskazujący zaokrąglony', 0.8, (f) => trapezoid(f.fingers.index.curlDeg, 30, 150, 35)),
      c('kciuk nie dotyka środkowego', 0.8, (f) => trapezoid(f.thumbMiddlePinch, 0.35, 3, 0.15)),
    ],
  },
  {
    letter: 'R',
    description: 'Palec wskazujący i środkowy wyprostowane i skrzyżowane, pozostałe palce zaciśnięte.',
    criteria: [
      c('wskazujący prosty', 1, (f) => trapezoid(f.fingers.index.curlDeg, 0, 75, 35)),
      c('środkowy prosty', 1, (f) => trapezoid(f.fingers.middle.curlDeg, 0, 75, 35)),
      c('palce skrzyżowane', 2.5, (f) =>
        f.indexMiddleCrossed ? 1 : trapezoid(f.indexMiddleTipGap, 0, 0.12, 0.1) * 0.6,
      ),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
    ],
  },
  {
    letter: 'S',
    description: 'Jak O, ale głębszy chwyt: opuszek wskazującego opiera się w połowie kciuka, pozostałe palce lekko ugięte i złączone.',
    criteria: [
      c('wskazujący mocno zaokrąglony', 1.5, (f) => trapezoid(f.fingers.index.curlDeg, 95, 210, 35)),
      c('wskazujący oparty w połowie kciuka', 1.5, (f) => trapezoid(f.thumbIndexPinch, 0.16, 0.5, 0.14)),
      c('środkowy lekko ugięty', 1, (f) => trapezoid(f.fingers.middle.curlDeg, 10, 95, 35)),
      c('serdeczny lekko ugięty', 1, (f) => trapezoid(f.fingers.ring.curlDeg, 10, 95, 35)),
      c('mały lekko ugięty', 0.8, (f) => trapezoid(f.fingers.pinky.curlDeg, 5, 95, 35)),
      c('palce złączone', 0.8, (f) =>
        (trapezoid(f.middleRingSpreadDeg, 0, 9, 7) + trapezoid(f.ringPinkySpreadDeg, 0, 11, 8)) / 2,
      ),
    ],
  },
  {
    letter: 'T',
    description: 'Pięść, kciuk wystaje między palcem wskazującym a środkowym.',
    criteria: [
      ...fingersFist(0.9),
      c('kciuk między wskazującym a środkowym', 2.4, (f) => (f.thumbBetweenIndexMiddle ? 1 : 0)),
      c('kciuk zgięty na dłoni', 0.8, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.6, 0.3)),
    ],
  },
  {
    letter: 'V',
    description: 'Palec wskazujący i środkowy wyprostowane i rozstawione (znak wiktorii), pozostałe zgięte.',
    criteria: [
      c('wskazujący prosty', 1.3, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy prosty', 1.3, (f) => straight(f.fingers.middle.curlDeg)),
      c('palce rozstawione', 1.5, (f) => trapezoid(f.indexMiddleSpreadDeg, 14, 60, 8)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
      c('kciuk przy dłoni', 1.2, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.55, 0.25)),
      palmUpright(),
    ],
  },
  {
    letter: 'W',
    description: 'Środkowy, serdeczny i mały wyprostowane i rozsunięte; kciuk i wskazujący złączone w pętlę.',
    criteria: [
      c('środkowy prosty', 1, (f) => straight(f.fingers.middle.curlDeg)),
      c('serdeczny prosty', 1, (f) => straight(f.fingers.ring.curlDeg)),
      c('mały prosty', 1, (f) => straight(f.fingers.pinky.curlDeg)),
      c('kciuk i wskazujący w pętli', 2, (f) => trapezoid(f.thumbIndexPinch, 0, 0.35, 0.25)),
      c('wskazujący zaokrąglony', 1, (f) => notStraight(f.fingers.index.curlDeg)),
      c('palce rozsunięte', 0.9, (f) =>
        (trapezoid(f.middleRingSpreadDeg, 8, 90, 6) + trapezoid(f.ringPinkySpreadDeg, 8, 90, 6)) / 2,
      ),
    ],
  },
  {
    letter: 'X',
    description: 'Palec wskazujący i środkowy zgięte w haczyki („pazurki”) i rozstawione, pozostałe zgięte.',
    criteria: [
      c('wskazujący w haczyk', 1.4, (f) => halfBent(f.fingers.index.curlDeg)),
      c('środkowy w haczyk', 1.4, (f) => halfBent(f.fingers.middle.curlDeg)),
      c('palce rozstawione', 1, (f) => trapezoid(f.indexMiddleSpreadDeg, 12, 60, 8)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
      c('czubki daleko od kciuka', 0.8, (f) => trapezoid(f.thumbIndexPinch, 0.45, 3, 0.2)),
      c('kciuk przy dłoni (odróżnia od CH)', 0.9, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.6, 0.3)),
    ],
  },
  {
    letter: 'Y',
    description: 'Wskazujący i mały palec wyprostowane, środkowy i serdeczny zgięte, kciuk nałożony na zgięte palce.',
    criteria: [
      c('wskazujący prosty', 1.5, (f) => straight(f.fingers.index.curlDeg)),
      c('mały prosty', 1.5, (f) => straight(f.fingers.pinky.curlDeg)),
      c('środkowy zgięty', 1, (f) => curled(f.fingers.middle.curlDeg)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('kciuk na zgiętych palcach', 1, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.8, 0.4)),
    ],
  },

  // ---------- układy bazowe liter ruchomych (ukryte) ----------
  {
    letter: '_WSKAZUJACY',
    hidden: true,
    description: 'Palec wskazujący wyprostowany, pozostałe zgięte (baza liter D, Z, Ź, Ż).',
    criteria: [
      c('wskazujący prosty', 2, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy zgięty', 1, (f) => curled(f.fingers.middle.curlDeg)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
      c('kciuk przy dłoni', 0.8, (f) => trapezoid(f.thumbToMiddleMcp, 0, 0.8, 0.4)),
    ],
  },
  {
    letter: '_TRZY',
    hidden: true,
    description: 'Kciuk, wskazujący i środkowy wyprostowane (baza litery K).',
    criteria: [
      c('wskazujący prosty', 1.2, (f) => straight(f.fingers.index.curlDeg)),
      c('środkowy prosty', 1.2, (f) => straight(f.fingers.middle.curlDeg)),
      c('kciuk prosty', 1.2, (f) => trapezoid(f.fingers.thumb.curlDeg, 0, 75, 40)),
      c('kciuk odstaje', 1, (f) => trapezoid(f.thumbToMiddleMcp, 0.6, 3, 0.25)),
      c('palce rozstawione', 0.8, (f) => trapezoid(f.indexMiddleSpreadDeg, 10, 60, 8)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
    ],
  },
  {
    letter: '_SZPON',
    hidden: true,
    description: 'Kciuk, wskazujący i środkowy zgięte w szpon (baza litery CZ).',
    criteria: [
      c('wskazujący półzgięty', 1.3, (f) => halfBent(f.fingers.index.curlDeg)),
      c('środkowy półzgięty', 1.3, (f) => halfBent(f.fingers.middle.curlDeg)),
      c('palce rozstawione', 1, (f) => trapezoid(f.indexMiddleSpreadDeg, 10, 60, 8)),
      c('serdeczny zgięty', 1, (f) => curled(f.fingers.ring.curlDeg)),
      c('mały zgięty', 1, (f) => curled(f.fingers.pinky.curlDeg)),
      c('kciuk odsunięty', 0.8, (f) => trapezoid(f.thumbToMiddleMcp, 0.5, 3, 0.25)),
      c('otwarcie kciuk-wskazujący', 0.8, (f) => trapezoid(f.thumbIndexPinch, 0.35, 1.1, 0.2)),
    ],
  },
]

/** Litery pokazywane użytkownikowi (bez ukrytych baz). */
export const SUPPORTED_LETTERS = LETTER_RULES.filter((r) => !r.hidden).map((r) => ({
  letter: r.letter,
  description: r.description,
}))

/** Minimalna pewność najlepszej litery. */
export const MIN_CONFIDENCE = 0.62
/** Wymagany zapas nad drugą literą (chyba że pewność jest bardzo wysoka). */
const MIN_MARGIN = 0.05
const HIGH_CONFIDENCE = 0.8

function scoreRule(rule: LetterRule, f: HandFeatures): number {
  let sum = 0
  let weightSum = 0
  for (const crit of rule.criteria) {
    sum += crit.weight * crit.score(f)
    weightSum += crit.weight
  }
  return weightSum > 0 ? sum / weightSum : 0
}

/** Ranking wszystkich reguł (łącznie z ukrytymi bazami) malejąco wg pewności. */
export function rankAllShapes(f: HandFeatures): ClassificationResult[] {
  return LETTER_RULES.map((rule) => ({
    letter: rule.letter,
    confidence: scoreRule(rule, f),
  })).sort((a, b) => b.confidence - a.confidence)
}

/** Ranking wyłącznie liter widocznych dla użytkownika. */
export function rankLetters(f: HandFeatures): ClassificationResult[] {
  const hidden = new Set(LETTER_RULES.filter((r) => r.hidden).map((r) => r.letter))
  return rankAllShapes(f).filter((r) => !hidden.has(r.letter))
}

const HIDDEN_SHAPES = new Set(LETTER_RULES.filter((r) => r.hidden).map((r) => r.letter))

/**
 * Najlepsza litera statyczna lub null. Akceptujemy, gdy pewność przekracza
 * próg i jest wyraźnie lepsza od drugiej kandydatki (albo bardzo wysoka).
 * Jeśli najlepiej pasuje ukryty układ bazowy (np. sam palec wskazujący,
 * który jest bazą liter D/Z/Ź/Ż), nie zgłaszamy żadnej litery statycznej.
 */
export function classifyHand(f: HandFeatures): ClassificationResult | null {
  const ranked = rankAllShapes(f)
  const best = ranked[0]
  if (!best || best.confidence < MIN_CONFIDENCE) return null
  if (HIDDEN_SHAPES.has(best.letter)) return null
  const second = ranked[1]
  const margin = second ? best.confidence - second.confidence : 1
  if (margin < MIN_MARGIN && best.confidence < HIGH_CONFIDENCE) return null
  return best
}
