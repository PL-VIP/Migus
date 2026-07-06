import { useState } from 'react'
import { glossUrl, videoUrl, type PjmWord } from '../data/pjmWords'

/**
 * Karta wyrazu z nagraniem znaku PJM. Film jest ładowany dopiero po
 * kliknięciu (oszczędza transfer i nie obciąża serwera słownika).
 */
export function WordVideoCard({ word }: { word: PjmWord }) {
  const [started, setStarted] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="word-card">
      <div className="word-video">
        {started ? (
          failed ? (
            <div className="word-video-fallback">
              <p>Nie udało się wczytać nagrania.</p>
              <a href={glossUrl(word)} target="_blank" rel="noreferrer">
                Zobacz w słowniku PJM
              </a>
            </div>
          ) : (
            <video
              src={videoUrl(word)}
              controls
              autoPlay
              loop
              playsInline
              onError={() => setFailed(true)}
            />
          )
        ) : (
          <button type="button" className="word-video-placeholder" onClick={() => setStarted(true)}>
            <span className="play-icon" aria-hidden="true">
              ▶
            </span>
            <span>Pokaż znak</span>
          </button>
        )}
      </div>
      <div className="word-meta">
        <span className="word-title">{word.word}</span>
        {word.note && word.note !== word.word && <span className="word-note">{word.note}</span>}
        <a className="word-source" href={glossUrl(word)} target="_blank" rel="noreferrer">
          hasło w KSPJM ↗
        </a>
      </div>
    </div>
  )
}
