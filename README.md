# Migus

Platforma do nauki PJM (polskiego języka migowego). Wszystko działa w przeglądarce — obraz z kamery nie jest nigdzie wysyłany.

Trzy moduły:

1. **Nauka słów** (jak Duolingo): obejrzyj nagranie znaku PJM + automatyczną instrukcję → powtórz znak przed kamerą → aplikacja oceni wykonanie i przyzna XP.
2. **Alfabet palcowy**: rozpoznawanie na żywo statycznych liter PJM z kamery.
3. **Słownik**: przeszukiwarka całego Korpusowego Słownika PJM (~2900 haseł zebranych automatycznie) z nagraniami znaków.

## Zautomatyzowany słownik (cały KSPJM)

Dane słownika nie są ręcznie spisywane — generują je dwa skrypty:

```bash
npm run crawl           # katalog całego słownika → public/data/catalog.json (~2900 haseł)
npm run templates       # szablony ruchu dla słów lekcji → public/signs/*.json
npm run templates:all   # szablony dla całego katalogu (długo; pobiera wszystkie filmy)
```

- `scripts/crawl-dictionary.mjs` przechodzi przez wszystkie hasła KSPJM (grzecznie: opóźnienia, cache w `.cache/gloss/`, wznawialny) i zapisuje katalog: polskie odpowiedniki, typy użycia, adresy nagrań.
- `scripts/extract-templates.mjs` pobiera film znaku, uruchamia w headless Chrome harness `tools/extract.html` (Vite + Playwright), który przepuszcza klatki przez **ten sam** MediaPipe Hand Landmarker, którego aplikacja używa dla kamery użytkownika, i zapisuje **szablon ruchu**: 32 klatki × (pozycja nadgarstka + znormalizowany kształt 21 punktów dłoni × 2 ręce) + automatycznie wygenerowaną instrukcję po polsku. Dzięki wspólnemu kodowi (`src/lib/signTemplate.ts`) nagranie lektora i wykonanie użytkownika przechodzą przez identyczną ekstrakcję cech.

## Jak działa ocena wykonania znaku (nauka słów)

1. Po odliczeniu 3-2-1 aplikacja nagrywa sekwencję punktów dłoni (2 ręce, MediaPipe, 15 kl/s).
2. Sekwencja jest przycinana, próbkowana do 32 klatek i porównywana z szablonem znaku algorytmem **DTW** (Dynamic Time Warping, pasmo Sakoe-Chiba) — odpornym na różnice tempa migania (`src/lib/dtw.ts`).
3. Koszt dopasowania łączy kształt dłoni i trajektorię nadgarstka; brak wymaganej ręki jest karany. Wynik przeliczany jest na procenty i gwiazdki, a postęp (XP, opanowane słowa) zapisywany w localStorage (`src/lib/progress.ts`).

## Jak działa rozpoznawanie liter

1. [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) wykrywa na obrazie z kamery 21 punktów charakterystycznych dłoni (WebAssembly, lokalnie w przeglądarce).
2. Z punktów wyliczane są cechy geometryczne niezależne od odległości od kamery: kąty zgięcia palców, rozstaw palców, odległości opuszków, skrzyżowanie palców itd. (`src/lib/handFeatures.ts`).
3. Klasyfikator regułowy porównuje cechy z opisami układów dłoni liter PJM i wyznacza pewność dopasowania każdej litery (`src/lib/pjmClassifier.ts`).
4. Wynik jest wygładzany w czasie — litera jest zgłaszana dopiero, gdy dominuje w oknie ostatnich klatek (`src/lib/stabilizer.ts`). Rozpoznane litery trafiają do historii „przeliterowanych” znaków.

## Obsługiwane litery

Wersja pierwsza rozpoznaje statyczne litery: **A, B, C, E, I, L, O, R, W, Y**.

Każda litera ma w aplikacji **grafikę układu dłoni** rysowaną z tych samych 21 punktów, które rozpoznaje klasyfikator (`src/data/letterPoses.ts` + `src/components/HandDiagram.tsx`) - testy gwarantują, że pokazywany układ jest rozpoznawany jako właściwa litera.

Litery wymagające ruchu dłoni (np. Ą, Ę, J, Ł, RZ, SZ) oraz pozostałe litery statyczne będą dodawane w kolejnych wersjach. Planowany jest także tryb nauki: aplikacja pokaże literę, a użytkownik będzie musiał zamigać ją poprawnie.

## Źródło nagrań i atrybucja

Całych wyrazów w PJM zwykle się nie literuje - mają one własne znaki ideograficzne. Katalog haseł i nagrania znaków pochodzą z [Korpusowego Słownika Polskiego Języka Migowego](https://www.slownikpjm.uw.edu.pl/) (Łacheta, Czajkowska-Kisil, Linde-Usiekniewicz, Rutkowski, red., 2016, Wydział Polonistyki UW, ISBN 978-83-64111-49-5). Filmy są odtwarzane bezpośrednio ze strony słownika (wczytują się dopiero po kliknięciu), a każda karta linkuje do pełnego hasła źródłowego. Szablony ruchu w `public/signs/` to dane pochodne (współrzędne punktów dłoni) wygenerowane z tych nagrań na potrzeby oceny wykonania.

## Uruchomienie

Wymagany Node.js 20+.

```bash
npm install
npm run dev
```

Przy pierwszym uruchomieniu skrypt `prepare-assets` skopiuje pliki WASM MediaPipe z `node_modules` i pobierze model `hand_landmarker.task` (~7,5 MB) do katalogu `public/` (wymaga dostępu do internetu tylko za pierwszym razem).

Następnie otwórz adres wyświetlony przez Vite (domyślnie `http://localhost:5173`) i zezwól na dostęp do kamery. Do działania kamery wymagany jest `localhost` lub HTTPS.

## Pozostałe polecenia

```bash
npm test          # testy jednostkowe (vitest)
npm run lint      # lint (oxlint)
npm run build     # build produkcyjny do dist/
npm run preview   # podgląd builda produkcyjnego
```

## Struktura projektu

```
src/
  lib/
    geometry.ts        # operacje na wektorach 3D, kąty
    handFeatures.ts    # ekstrakcja cech z 21 punktów dłoni MediaPipe
    pjmClassifier.ts   # reguły liter PJM + klasyfikacja z pewnością
    stabilizer.ts      # wygładzanie rozpoznań liter w czasie
    handPose.ts        # proceduralny model pozy dłoni (grafiki liter)
    signTemplate.ts    # format szablonu znaku + cechy klatek + auto-instrukcje
    dtw.ts             # DTW: porównanie wykonania z szablonem znaku
    catalog.ts         # katalog KSPJM: wczytywanie + wyszukiwanie
    progress.ts        # postęp nauki (XP, opanowane słowa) w localStorage
    __tests__/         # testy jednostkowe
  data/
    letterPoses.ts     # pozy dłoni liter PJM (grafiki zgodne z klasyfikatorem)
    lessons.ts         # lekcje nauki słów (odwołania do haseł KSPJM)
    generated/         # signIndex.json - indeks wygenerowanych szablonów
  components/
    HandDiagram.tsx    # grafika SVG dłoni z 21 punktów
  hooks/
    useHandRecognition.ts  # kamera + rozpoznawanie liter na żywo
    useSignPractice.ts     # kamera + nagranie próby + ocena DTW
  views/
    LearnView.tsx      # lekcje słów (styl Duolingo)
    PracticeView.tsx   # obejrzyj → powtórz przed kamerą → wynik
    DictionaryView.tsx # przeszukiwarka całego katalogu KSPJM
    LettersView.tsx    # rozpoznawanie alfabetu palcowego
  App.tsx              # zakładki aplikacji
scripts/
  prepare-assets.mjs        # kopiowanie WASM i pobieranie modelu do public/
  crawl-dictionary.mjs      # crawl całego KSPJM → public/data/catalog.json
  extract-templates.mjs     # filmy → szablony ruchu (public/signs/*.json)
tools/
  extract.html, extract-main.ts  # harness ekstrakcji (Vite + Playwright)
public/
  data/catalog.json    # katalog całego słownika (generowany, commitowany)
  signs/<id>.json      # szablony ruchu znaków (generowane, commitowane)
```

## Wskazówki dotyczące rozpoznawania

- Ustaw dłoń na wysokości klatki piersiowej, dobrze oświetloną, skierowaną wnętrzem do kamery.
- Trzymaj układ dłoni nieruchomo przez chwilę — litera zostanie zgłoszona po ustabilizowaniu.
- Panel „Najbliższe dopasowania” pokazuje na żywo trzy najlepiej pasujące litery, co pomaga skorygować układ dłoni.
