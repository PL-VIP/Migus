import { useEffect, useMemo, useState } from 'react'
import { LESSONS, type LessonWord } from '../data/lessons'
import { findEntry, loadCatalog, searchCatalog, type CatalogEntry } from '../lib/catalog'
import { loadProgress, type Progress } from '../lib/progress'
import templateIds from '../data/generated/templateIds.json'
import { PracticeView } from './PracticeView'

const TEMPLATE_IDS = new Set(templateIds as number[])
const PAGE = 60

/**
 * Nauka słów PJM w stylu Duolingo: lekcje na start + WSZYSTKIE słowa
 * słownika z gotowym szablonem (obejrzyj → powtórz przed kamerą → ocena).
 */
export function LearnView() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [activeWord, setActiveWord] = useState<LessonWord | null>(null)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE)

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  const doneCount = useMemo(
    () => Object.values(progress.words).filter((w) => w.done).length,
    [progress],
  )

  /** Wszystkie hasła z szablonem ruchu (można ćwiczyć przed kamerą). */
  const practicable = useMemo(
    () => (catalog ? catalog.filter((e) => TEMPLATE_IDS.has(e.id)) : []),
    [catalog],
  )

  const filtered = useMemo(() => {
    if (query.trim().length >= 2) {
      return searchCatalog(practicable, query, 200)
    }
    return practicable
  }, [practicable, query])

  if (activeWord) {
    return (
      <PracticeView
        word={activeWord}
        entry={catalog ? findEntry(catalog, activeWord.glossId) : undefined}
        onClose={() => {
          setProgress(loadProgress())
          setActiveWord(null)
        }}
      />
    )
  }

  return (
    <div className="learn">
      <div className="learn-header">
        <div>
          <h2>Nauka słów PJM</h2>
          <p className="muted">
            Wybierz słowo: najpierw obejrzysz nagranie znaku i instrukcję, potem powtórzysz znak
            przed kamerą, a aplikacja oceni Twoje wykonanie.
          </p>
        </div>
        <div className="learn-stats">
          <div className="stat">
            <span className="stat-value">{progress.xp}</span>
            <span className="stat-label">XP</span>
          </div>
          <div className="stat">
            <span className="stat-value">{doneCount}</span>
            <span className="stat-label">opanowane</span>
          </div>
        </div>
      </div>

      {LESSONS.map((lesson) => {
        const wordsDone = lesson.words.filter((w) => progress.words[w.glossId]?.done).length
        return (
          <div key={lesson.id} className="lesson">
            <div className="lesson-head">
              <span className="lesson-icon" aria-hidden="true">
                {lesson.icon}
              </span>
              <h3>{lesson.title}</h3>
              <div className="lesson-progress">
                <div className="lesson-progress-track">
                  <div
                    className="lesson-progress-bar"
                    style={{ width: `${(wordsDone / lesson.words.length) * 100}%` }}
                  />
                </div>
                <span className="muted small">
                  {wordsDone}/{lesson.words.length}
                </span>
              </div>
            </div>
            <div className="lesson-words">
              {lesson.words.map((w) => {
                const wp = progress.words[w.glossId]
                const cls = wp?.done ? 'done' : wp?.attempts ? 'tried' : ''
                return (
                  <button
                    key={w.glossId}
                    type="button"
                    className={`word-chip ${cls}`}
                    onClick={() => setActiveWord(w)}
                  >
                    {wp?.done && <span aria-hidden="true">✓ </span>}
                    {w.word}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="lesson all-words">
        <div className="lesson-head">
          <span className="lesson-icon" aria-hidden="true">
            ≡
          </span>
          <h3>Wszystkie słowa ze słownika</h3>
          <div className="lesson-progress">
            <div className="lesson-progress-track">
              <div
                className="lesson-progress-bar"
                style={{
                  width: `${practicable.length > 0 ? Math.min(100, (doneCount / practicable.length) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="muted small">
              {doneCount}/{practicable.length || '…'}
            </span>
          </div>
        </div>
        <p className="muted small">
          Każde z {practicable.length || '…'} słów ma nagranie lektora, instrukcję i ocenę
          wykonania przed kamerą. Szukaj albo przeglądaj po kolei.
        </p>
        <input
          type="search"
          className="dict-search"
          placeholder="szukaj słowa do nauki, np. kawa, niedziela…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setVisible(PAGE)
          }}
        />
        {catalog === null && <p className="muted">Wczytywanie katalogu…</p>}
        {catalog !== null && filtered.length === 0 && (
          <p className="muted">Brak słów dla „{query}”.</p>
        )}
        <div className="lesson-words">
          {filtered.slice(0, visible).map((e) => {
            const wp = progress.words[e.id]
            const cls = wp?.done ? 'done' : wp?.attempts ? 'tried' : ''
            return (
              <button
                key={e.id}
                type="button"
                className={`word-chip ${cls}`}
                onClick={() => setActiveWord({ glossId: e.id, word: e.words[0] })}
              >
                {wp?.done && <span aria-hidden="true">✓ </span>}
                {e.words[0]}
              </button>
            )
          })}
        </div>
        {filtered.length > visible && (
          <button type="button" className="show-more" onClick={() => setVisible((v) => v + PAGE * 4)}>
            Pokaż więcej ({filtered.length - visible} pozostałych)
          </button>
        )}
      </div>
    </div>
  )
}
