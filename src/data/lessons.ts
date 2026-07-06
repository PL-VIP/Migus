/**
 * Lekcje nauki słów PJM (tryb „obejrzyj → powtórz przed kamerą”).
 *
 * Każde słowo wskazuje hasło w katalogu KSPJM (public/data/catalog.json,
 * generowany przez scripts/crawl-dictionary.mjs). Szablony ruchu do
 * rozpoznawania wykonania użytkownika generuje scripts/extract-templates.mjs
 * (public/signs/<glossId>.json) - „--lessons” przetwarza wszystkie hasła
 * wymienione w tym pliku.
 */

export interface LessonWord {
  glossId: number
  /** Wyświetlana forma słowa (pierwszy odpowiednik z KSPJM bywa dłuższy). */
  word: string
  note?: string
}

export interface Lesson {
  id: string
  title: string
  icon: string
  words: LessonWord[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'rodzina',
    title: 'Rodzina',
    icon: '⌂',
    words: [
      { glossId: 13, word: 'mama', note: 'matka' },
      { glossId: 275, word: 'tata', note: 'ojciec' },
      { glossId: 666, word: 'rodzina' },
      { glossId: 792, word: 'kochać' },
    ],
  },
  {
    id: 'grzecznosc',
    title: 'Grzeczność i rozmowa',
    icon: '☺',
    words: [
      { glossId: 385, word: 'dziękuję', note: 'dziękować' },
      { glossId: 169, word: 'proszę', note: 'prosić' },
      { glossId: 66, word: 'przepraszam', note: 'przepraszać' },
      { glossId: 83, word: 'tak' },
      { glossId: 50, word: 'nie' },
      { glossId: 36, word: 'dobrze', note: 'dobry' },
    ],
  },
  {
    id: 'jedzenie',
    title: 'Jedzenie i picie',
    icon: '☕',
    words: [
      { glossId: 306, word: 'jeść' },
      { glossId: 513, word: 'pić' },
      { glossId: 106, word: 'woda' },
      { glossId: 476, word: 'chleb' },
      { glossId: 856, word: 'mleko' },
    ],
  },
  {
    id: 'codziennosc',
    title: 'Życie codzienne',
    icon: '★',
    words: [
      { glossId: 229, word: 'dom' },
      { glossId: 276, word: 'szkoła', note: 'także: klasa' },
      { glossId: 68, word: 'praca' },
      { glossId: 284, word: 'kot' },
      { glossId: 261, word: 'pies' },
    ],
  },
]

export const ALL_LESSON_WORDS: LessonWord[] = LESSONS.flatMap((l) => l.words)
