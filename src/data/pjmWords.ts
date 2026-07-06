/**
 * Wyrazy do nauki: znaki ideograficzne PJM z nagraniami wideo.
 *
 * W PJM całych wyrazów zwykle się nie literuje - mają one własne znaki
 * (alfabet palcowy służy głównie do literowania nazw własnych). Dlatego
 * do nauki wyrazów pokazujemy nagrania rodzimych znaków PJM.
 *
 * Źródło nagrań: Korpusowy Słownik Polskiego Języka Migowego,
 * J. Łacheta, M. Czajkowska-Kisil, J. Linde-Usiekniewicz, P. Rutkowski (red.),
 * 2016, Warszawa: Wydział Polonistyki UW (publikacja online),
 * ISBN 978-83-64111-49-5, https://www.slownikpjm.uw.edu.pl/
 */

export interface PjmWord {
  /** Polski odpowiednik znaku (wyświetlany użytkownikowi). */
  word: string
  /** Dodatkowe odpowiedniki/uwagi. */
  note?: string
  /** Identyfikator hasła w KSPJM. */
  glossId: number
  /** Nazwa pliku wideo w KSPJM. */
  videoFile: string
}

export interface PjmWordCategory {
  category: string
  words: PjmWord[]
}

const BASE = 'https://www.slownikpjm.uw.edu.pl'

export function videoUrl(w: PjmWord): string {
  return `${BASE}/media/video/${w.glossId}/${w.videoFile}`
}

export function glossUrl(w: PjmWord): string {
  return `${BASE}/gloss/view/${w.glossId}`
}

export const DICTIONARY_URL = BASE

export const WORD_CATEGORIES: PjmWordCategory[] = [
  {
    category: 'Rodzina',
    words: [
      { word: 'mama', note: 'matka', glossId: 13, videoFile: '13_matka_1_.mp4' },
      { word: 'tata', note: 'ojciec', glossId: 275, videoFile: '275_ojciec_1_.mp4' },
      { word: 'rodzina', glossId: 666, videoFile: '666_rodzina_1_.mp4' },
      { word: 'kochać', glossId: 792, videoFile: '792_kochac_1_.mp4' },
    ],
  },
  {
    category: 'Grzeczność i rozmowa',
    words: [
      { word: 'dziękuję', note: 'dziękować', glossId: 385, videoFile: '385_dziekowac_1_.mp4' },
      { word: 'proszę', note: 'prosić', glossId: 169, videoFile: '169_prosic_1_.mp4' },
      { word: 'przepraszam', note: 'przepraszać', glossId: 66, videoFile: '66_przepraszac_1_.mp4' },
      { word: 'tak', glossId: 83, videoFile: '83_tak_2_1_.mp4' },
      { word: 'nie', glossId: 50, videoFile: '50_nie_1_.mp4' },
      { word: 'dobrze', note: 'dobry', glossId: 36, videoFile: '36_dobrydobrze_1_.mp4' },
    ],
  },
  {
    category: 'Jedzenie i picie',
    words: [
      { word: 'jeść', glossId: 306, videoFile: '306_jesc_1_.mp4' },
      { word: 'pić', glossId: 513, videoFile: '513_pic_1_.mp4' },
      { word: 'woda', glossId: 106, videoFile: '106_woda_1_.mp4' },
      { word: 'chleb', glossId: 476, videoFile: '476_chleb_1_.mp4' },
      { word: 'mleko', glossId: 856, videoFile: '856_mleko_1_.mp4' },
    ],
  },
  {
    category: 'Życie codzienne',
    words: [
      { word: 'dom', glossId: 229, videoFile: '229_dom_1_.mp4' },
      { word: 'szkoła', note: 'także: klasa', glossId: 276, videoFile: '276_szkolaklasa_1_.mp4' },
      { word: 'praca', glossId: 68, videoFile: '68_praca_1_.mp4' },
      { word: 'kot', glossId: 284, videoFile: '284_kot_1_.mp4' },
      { word: 'pies', glossId: 261, videoFile: '261_pies_1_.mp4' },
    ],
  },
]
