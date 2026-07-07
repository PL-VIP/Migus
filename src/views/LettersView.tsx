import { useCallback, useState } from 'react'
import { useHandRecognition, type LetterEvent } from '../hooks/useHandRecognition'
import { ALPHABET } from '../data/alphabet'
import { LETTER_POSES } from '../data/letterPoses'
import { HandDiagram } from '../components/HandDiagram'

const KIND_LABEL = {
  static: null,
  dynamic: 'ruch',
  transition: 'ruch',
} as const

/** Widok rozpoznawania liter alfabetu palcowego (daktylografia). */
export function LettersView() {
  const [history, setHistory] = useState<string[]>([])

  const handleLetter = useCallback((event: LetterEvent) => {
    setHistory((prev) => {
      // Litera ruchoma zastępuje swoją bazę, np. A → Ą, gdy ogonek
      // został dorysowany chwilę po rozpoznaniu A.
      if (event.replacePrev && prev.length > 0 && prev[prev.length - 1] === event.replacePrev) {
        return [...prev.slice(0, -1), event.letter]
      }
      return [...prev, event.letter]
    })
  }, [])

  const { videoRef, canvasRef, state, start, stop } = useHandRecognition(handleLetter)

  const running = state.status === 'running'
  const loading = state.status === 'loading'

  const displayLetter = state.dynamicLetter ?? state.stableLetter?.letter ?? null
  const displayConfidence = state.dynamicLetter ? 0.9 : state.stableLetter?.confidence ?? 0

  const liveHint = !state.handDetected
    ? 'Pokaż dłoń do kamery'
    : state.handMoving
      ? 'Widzę ruch – dokończ gest…'
      : state.stableLetter
        ? 'Dłoń wykryta'
        : state.topCandidates[0]
          ? `Prawie ${state.topCandidates[0].letter} – doprecyzuj układ palców`
          : 'Dłoń wykryta – ułóż literę'

  return (
    <>
      <main className="layout">
        <section className="camera-panel">
          <div className={`video-wrap ${running ? 'is-running' : ''}`}>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />

            {!running && !loading && (
              <div className="video-placeholder">
                <p>Kamera jest wyłączona</p>
                <button type="button" className="primary" onClick={start}>
                  Włącz kamerę
                </button>
              </div>
            )}

            {loading && (
              <div className="video-placeholder">
                <p>Ładowanie modelu i uruchamianie kamery…</p>
              </div>
            )}

            {running && (
              <div className="video-hud">
                <span className={`hand-status ${state.handDetected ? 'ok' : ''}`}>{liveHint}</span>
                <span className="fps">{state.fps} kl/s</span>
              </div>
            )}
          </div>

          {state.status === 'error' && <p className="error">{state.errorMessage}</p>}

          <div className="controls">
            {running ? (
              <button type="button" onClick={stop}>
                Zatrzymaj kamerę
              </button>
            ) : (
              <button type="button" className="primary" onClick={start} disabled={loading}>
                {loading ? 'Uruchamianie…' : 'Włącz kamerę'}
              </button>
            )}
            <button type="button" onClick={() => setHistory([])} disabled={history.length === 0}>
              Wyczyść historię
            </button>
          </div>
        </section>

        <section className="result-panel">
          <div className="current-letter">
            <span className="label">Rozpoznana litera</span>
            <span className={`letter ${displayLetter ? 'active' : ''} ${state.dynamicLetter ? 'dynamic' : ''}`}>
              {displayLetter ?? '–'}
            </span>
            <div className="confidence">
              <div
                className="confidence-bar"
                style={{ width: `${Math.round((displayLetter ? displayConfidence : 0) * 100)}%` }}
              />
            </div>
            <span className="confidence-value">
              {displayLetter
                ? state.dynamicLetter
                  ? 'litera ruchoma rozpoznana!'
                  : `pewność ${Math.round(displayConfidence * 100)}%`
                : running
                  ? 'czekam na stabilny układ dłoni…'
                  : 'włącz kamerę, aby zacząć'}
            </span>
          </div>

          {running && state.topCandidates.length > 0 && (
            <div className="candidates">
              <span className="label">Najbliższe dopasowania</span>
              <ul>
                {state.topCandidates.map((c) => (
                  <li key={c.letter}>
                    <span className="candidate-letter">{c.letter}</span>
                    <div className="candidate-bar-track">
                      <div
                        className="candidate-bar"
                        style={{ width: `${Math.round(c.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="candidate-value">{Math.round(c.confidence * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="history">
            <span className="label">Przeliterowane</span>
            <div className="history-letters">
              {history.length > 0 ? history.join(' ') : <span className="muted">jeszcze nic…</span>}
            </div>
          </div>
        </section>
      </main>

      <section className="letters-panel">
        <h2>Alfabet palcowy PJM - wszystkie znaki ({ALPHABET.length})</h2>
        <p className="muted">
          Litery statyczne rozpoznawane są z układu dłoni, litery ruchome (oznaczone strzałką)
          z układu bazowego i ruchu - np. Ą to A z dorysowanym ogonkiem, Ł to L przesunięte
          w bok, a Ż to Z z kropką „postawioną” ruchem w przód. Trzymaj dłoń nieruchomo,
          aż litera zostanie rozpoznana, a przy literach ruchomych wykonaj gest płynnie.
        </p>
        <ul className="letters-grid">
          {ALPHABET.map((l) => (
            <li key={l.letter}>
              <HandDiagram
                landmarks={LETTER_POSES[l.baseShape]}
                motion={l.kind === 'static' ? undefined : l.motion}
                size={92}
                className="letters-grid-diagram"
                title={`Układ dłoni dla litery ${l.letter}`}
              />
              <div>
                <span className="letters-grid-letter">
                  {l.letter}
                  {KIND_LABEL[l.kind] && <em className="letter-kind">{KIND_LABEL[l.kind]}</em>}
                </span>
                <span className="letters-grid-desc">{l.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
