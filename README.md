# Migus

Platforma do nauki PJM (polskiego języka migowego).

Ta wersja zawiera **rozpoznawanie na żywo statycznych liter alfabetu palcowego PJM** z obrazu kamery, w całości w przeglądarce (bez wysyłania obrazu na serwer).

## Jak to działa

1. [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) wykrywa na obrazie z kamery 21 punktów charakterystycznych dłoni (WebAssembly, lokalnie w przeglądarce).
2. Z punktów wyliczane są cechy geometryczne niezależne od odległości od kamery: kąty zgięcia palców, rozstaw palców, odległości opuszków, skrzyżowanie palców itd. (`src/lib/handFeatures.ts`).
3. Klasyfikator regułowy porównuje cechy z opisami układów dłoni liter PJM i wyznacza pewność dopasowania każdej litery (`src/lib/pjmClassifier.ts`).
4. Wynik jest wygładzany w czasie — litera jest zgłaszana dopiero, gdy dominuje w oknie ostatnich klatek (`src/lib/stabilizer.ts`). Rozpoznane litery trafiają do historii „przeliterowanych” znaków.

## Obsługiwane litery

Wersja pierwsza rozpoznaje statyczne litery: **A, B, C, E, I, L, O, R, W, Y**.

Litery wymagające ruchu dłoni (np. Ą, Ę, J, Ł, RZ, SZ) oraz pozostałe litery statyczne będą dodawane w kolejnych wersjach. Planowany jest także tryb nauki: aplikacja pokaże literę, a użytkownik będzie musiał zamigać ją poprawnie.

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
    stabilizer.ts      # wygładzanie rozpoznań w czasie
    __tests__/         # testy jednostkowe + syntetyczne układy dłoni
  hooks/
    useHandRecognition.ts  # kamera + MediaPipe + pętla rozpoznawania
  App.tsx              # interfejs użytkownika (po polsku)
scripts/
  prepare-assets.mjs   # kopiowanie WASM i pobieranie modelu do public/
```

## Wskazówki dotyczące rozpoznawania

- Ustaw dłoń na wysokości klatki piersiowej, dobrze oświetloną, skierowaną wnętrzem do kamery.
- Trzymaj układ dłoni nieruchomo przez chwilę — litera zostanie zgłoszona po ustabilizowaniu.
- Panel „Najbliższe dopasowania” pokazuje na żywo trzy najlepiej pasujące litery, co pomaga skorygować układ dłoni.
