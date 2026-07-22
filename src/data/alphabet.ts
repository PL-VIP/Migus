/**
 * Rejestr wszystkich 36 znaków polskiego alfabetu palcowego (daktylografia).
 *
 * Każdy znak ma: typ (statyczny / ruchomy / przejście), nazwę układu
 * bazowego w klasyfikatorze, rodzaj ruchu (dla grafik i silnika gestów)
 * oraz opis wykonania po polsku.
 */

export type LetterKind = 'static' | 'dynamic' | 'transition'

export type MotionKind =
  | 'down'
  | 'side'
  | 'hook'
  | 'zigzag'
  | 'circle'
  | 'forward'
  | 'stroke'
  | 'snap'
  | 'bend'

export interface AlphabetEntry {
  letter: string
  kind: LetterKind
  /** Nazwa układu dłoni w klasyfikatorze (litera statyczna lub baza ukryta). */
  baseShape: string
  /** Rodzaj ruchu (litery ruchome i przejścia). */
  motion?: MotionKind
  /** Jak wykonać znak. */
  description: string
}

export const ALPHABET: AlphabetEntry[] = [
  { letter: 'A', kind: 'static', baseShape: 'A', description: 'Zaciśnięta pięść, kciuk wyprostowany przylega z boku do palca wskazującego.' },
  { letter: 'Ą', kind: 'dynamic', baseShape: 'A', motion: 'hook', description: 'Układ litery A, dłonią rysujemy w powietrzu ogonek (w dół i w bok).' },
  { letter: 'B', kind: 'static', baseShape: 'B', description: 'Dłoń otwarta, palce wyprostowane i złączone, kciuk zgięty przylega do dłoni.' },
  { letter: 'C', kind: 'static', baseShape: 'C', description: 'Palce zaokrąglone w kształt litery C, jak przy trzymaniu kubka.' },
  { letter: 'Ć', kind: 'dynamic', baseShape: 'C', motion: 'down', description: 'Układ litery C, dłoń wykonuje krótki ruch w dół (kreska).' },
  { letter: 'CH', kind: 'dynamic', baseShape: '_SZPON', motion: 'down', description: 'Kciuk, wskazujący i środkowy zgięte w szpon (jak H z kciukiem), ruch dłonią w dół.' },
  { letter: 'CZ', kind: 'dynamic', baseShape: '_SZPON', motion: 'forward', description: 'Kciuk, wskazujący i środkowy zgięte w szpon, ruch dłonią do przodu, ku rozmówcy.' },
  { letter: 'D', kind: 'dynamic', baseShape: '_WSKAZUJACY', motion: 'circle', description: 'Palec wskazujący wyprostowany, pozostałe zgięte; wskazującym kręcimy kółko.' },
  { letter: 'E', kind: 'static', baseShape: 'E', description: 'Palce zgięte w „daszek”, kciuk dotyka ich opuszków.' },
  { letter: 'Ę', kind: 'dynamic', baseShape: 'E', motion: 'hook', description: 'Układ litery E, dłonią rysujemy ogonek (w dół i w bok).' },
  { letter: 'F', kind: 'static', baseShape: 'F', description: 'Opuszki kciuka i wskazującego złączone w kółeczko, pozostałe palce proste, luźno rozstawione.' },
  { letter: 'G', kind: 'transition', baseShape: 'P', motion: 'snap', description: 'Pstrykamy palcem wskazującym o kciuk (z dzióbka wskazujący wyskakuje do góry).' },
  { letter: 'H', kind: 'dynamic', baseShape: 'X', motion: 'down', description: 'Wskazujący i środkowy zgięte jak przy pokazywaniu cudzysłowu, pociągamy dłoń w dół.' },
  { letter: 'I', kind: 'static', baseShape: 'I', description: 'Mały palec wyprostowany, pozostałe zaciśnięte w pięść.' },
  { letter: 'J', kind: 'dynamic', baseShape: 'I', motion: 'hook', description: 'Układ litery I, małym palcem rysujemy w powietrzu literę J.' },
  { letter: 'K', kind: 'dynamic', baseShape: '_TRZY', motion: 'forward', description: 'Kciuk, wskazujący i środkowy wyprostowane, szybki ruch w stronę rozmówcy.' },
  { letter: 'L', kind: 'static', baseShape: 'L', description: 'Kciuk i wskazujący tworzą kąt prosty (kształt L), pozostałe palce zgięte.' },
  { letter: 'Ł', kind: 'dynamic', baseShape: 'L', motion: 'side', description: 'Układ litery L, przesuwamy dłoń w bok.' },
  { letter: 'M', kind: 'static', baseShape: 'M', description: 'Dłoń pozioma, palce wyprostowane, złączone, skierowane do rozmówcy, kciuk ku górze.' },
  { letter: 'N', kind: 'static', baseShape: 'N', description: '„Pistolet”: wskazujący i środkowy proste i złączone, dłoń pozioma, pozostałe palce zgięte.' },
  { letter: 'Ń', kind: 'dynamic', baseShape: 'N', motion: 'down', description: 'Układ litery N, krótki ruch w dół (kreska).' },
  { letter: 'O', kind: 'static', baseShape: 'O', description: 'Kciuk i wskazujący stykają się opuszkami w okrąg, pozostałe palce proste, złączone.' },
  { letter: 'Ó', kind: 'dynamic', baseShape: 'O', motion: 'down', description: 'Układ litery O, dłoń zjeżdża w dół.' },
  { letter: 'P', kind: 'static', baseShape: 'P', description: 'Pięść, kciuk i wskazujący stykają się wyprostowane opuszkami (dzióbek).' },
  { letter: 'R', kind: 'static', baseShape: 'R', description: 'Wskazujący i środkowy wyprostowane i skrzyżowane, pozostałe palce zaciśnięte.' },
  { letter: 'RZ', kind: 'dynamic', baseShape: 'R', motion: 'zigzag', description: 'Układ litery R (skrzyżowane palce), dłonią rysujemy w powietrzu literę Z.' },
  { letter: 'S', kind: 'static', baseShape: 'S', description: 'Jak O, ale opuszek wskazującego opiera się w połowie kciuka; palce zaokrąglone.' },
  { letter: 'Ś', kind: 'dynamic', baseShape: 'S', motion: 'down', description: 'Układ litery S, dłoń zjeżdża w dół.' },
  { letter: 'SZ', kind: 'dynamic', baseShape: 'B', motion: 'side', description: 'Dłoń otwarta, palce złączone (jak B), przesuwamy dłoń w bok.' },
  { letter: 'T', kind: 'static', baseShape: 'T', description: 'Pięść, kciuk wystaje między palcem wskazującym a środkowym.' },
  { letter: 'U', kind: 'transition', baseShape: 'V', motion: 'bend', description: 'Znak wiktorii, następnie zginamy oba palce w stronę rozmówcy.' },
  { letter: 'V', kind: 'static', baseShape: 'V', description: 'Wskazujący i środkowy wyprostowane i rozstawione (znak wiktorii), pozostałe zgięte.' },
  { letter: 'W', kind: 'static', baseShape: 'W', description: 'Środkowy, serdeczny i mały wyprostowane i rozsunięte; kciuk i wskazujący złączone w pętlę.' },
  { letter: 'X', kind: 'static', baseShape: 'X', description: 'Wskazujący i środkowy zgięte w haczyki („pazurki”), rozstawione, pozostałe zgięte.' },
  { letter: 'Y', kind: 'static', baseShape: 'Y', description: 'Wskazujący i mały wyprostowane, środkowy i serdeczny zgięte, kciuk na zgiętych palcach.' },
  { letter: 'Z', kind: 'dynamic', baseShape: '_WSKAZUJACY', motion: 'zigzag', description: 'Palec wskazujący wyprostowany rysuje w powietrzu literę Z.' },
  { letter: 'Ź', kind: 'dynamic', baseShape: '_WSKAZUJACY', motion: 'stroke', description: 'Jak Z, po czym wskazującym stawiamy ukośną kreskę.' },
  { letter: 'Ż', kind: 'dynamic', baseShape: '_WSKAZUJACY', motion: 'forward', description: 'Jak Z, po czym ruchem w przód stawiamy kropkę.' },
]

export const ALPHABET_BY_LETTER: Record<string, AlphabetEntry> = Object.fromEntries(
  ALPHABET.map((e) => [e.letter, e]),
)
