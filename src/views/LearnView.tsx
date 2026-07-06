import { useEffect, useMemo, useState } from 'react'
import { LESSONS, type LessonWord } from '../data/lessons'
import { findEntry, loadCatalog, type CatalogEntry } from '../lib/catalog'
import { loadProgress, type Progress } from '../lib/progress'
import { PracticeView } from './PracticeView'

/** Lekcje słów PJM w stylu Duolingo: lista lekcji → słowo → obejrzyj → powtórz. */
export function LearnView() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [activeWord, setActiveWord] = useState<LessonWord | null>(null)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  const doneCount = useMemo(
    () => Object.values(progress.words).filter((w) => w.done).length,
    [progress],
  )

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
    </div>
  )
}
