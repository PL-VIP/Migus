import { useEffect, useMemo, useState } from 'react'
import {
  KSPJM_URL,
  kspjmGlossUrl,
  kspjmPosterUrl,
  kspjmVideoUrl,
  loadCatalog,
  searchCatalog,
  type CatalogEntry,
} from '../lib/catalog'
import signIndex from '../data/generated/signIndex.json'
import { PracticeView } from './PracticeView'

const TEMPLATE_IDS = new Set((signIndex as Array<{ glossId: number }>).map((e) => e.glossId))

/** Przeszukiwarka całego katalogu KSPJM (crawl: scripts/crawl-dictionary.mjs). */
export function DictionaryView() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState<number | null>(null)
  const [practiced, setPracticed] = useState<CatalogEntry | null>(null)

  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  const results = useMemo(
    () => (catalog ? searchCatalog(catalog, query) : []),
    [catalog, query],
  )

  if (practiced) {
    return (
      <PracticeView
        word={{ glossId: practiced.id, word: practiced.words[0] }}
        entry={practiced}
        onClose={() => setPracticed(null)}
      />
    )
  }

  return (
    <div className="dictionary">
      <h2>Słownik znaków PJM</h2>
      <p className="muted">
        Cały katalog Korpusowego Słownika PJM: {catalog ? catalog.length : '…'} haseł zebranych
        automatycznie. Wpisz polskie słowo, aby zobaczyć nagranie znaku. Dla {TEMPLATE_IDS.size}{' '}
        znaków dostępne jest też ćwiczenie przed kamerą z oceną wykonania
        (<code>npm run templates:all</code> generuje kolejne szablony).
      </p>

      <input
        type="search"
        className="dict-search"
        placeholder="np. mama, dziękować, szkoła…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPlaying(null)
        }}
      />

      {error && <p className="error">Nie udało się wczytać katalogu: {error}</p>}
      {catalog && query.trim().length >= 2 && results.length === 0 && (
        <p className="muted">Brak znaków dla „{query}”.</p>
      )}

      <div className="dict-results">
        {results.map((e) => (
          <div key={e.id} className="dict-card">
            <div className="word-video">
              {playing === e.id ? (
                <video src={kspjmVideoUrl(e)} poster={kspjmPosterUrl(e)} controls autoPlay loop playsInline />
              ) : (
                <button type="button" className="word-video-placeholder" onClick={() => setPlaying(e.id)}>
                  <span className="play-icon" aria-hidden="true">▶</span>
                  <span>Pokaż znak</span>
                </button>
              )}
            </div>
            <div className="dict-meta">
              <span className="word-title">{e.words[0]}</span>
              {e.words.length > 1 && (
                <span className="muted small">{e.words.slice(1).join(' · ')}</span>
              )}
              <div className="dict-actions">
                {TEMPLATE_IDS.has(e.id) && (
                  <button type="button" className="primary slim" onClick={() => setPracticed(e)}>
                    Ćwicz przed kamerą
                  </button>
                )}
                <a className="word-source" href={kspjmGlossUrl(e.id)} target="_blank" rel="noreferrer">
                  hasło w KSPJM ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="attribution">
        Katalog i nagrania:{' '}
        <a href={KSPJM_URL} target="_blank" rel="noreferrer">
          Korpusowy Słownik Polskiego Języka Migowego
        </a>{' '}
        (Łacheta, Czajkowska-Kisil, Linde-Usiekniewicz, Rutkowski, red., 2016, Wydział Polonistyki
        UW, ISBN 978-83-64111-49-5). Filmy odtwarzane bezpośrednio ze strony słownika.
      </p>
    </div>
  )
}
