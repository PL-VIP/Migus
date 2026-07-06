import { useCallback, useState } from 'react'
import { useHandRecognition } from '../hooks/useHandRecognition'
import { SUPPORTED_LETTERS } from '../lib/pjmClassifier'
import { LETTER_POSES } from '../data/letterPoses'
import { HandDiagram } from '../components/HandDiagram'

/** Widok rozpoznawania liter alfabetu palcowego (daktylografia). */
export function LettersView() {
  const [history, setHistory] = useState<string[]>([])

  const handleStableLetter = useCallback((letter: string) => {
    setHistory((prev) => [...prev, letter])
  }, [])

  const { videoRef, canvasRef, state, start, stop } = useHandRecognition(handleStableLetter)

  const running = state.status === 'running'
  const loading = state.status === 'loading'

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
                <span className={`hand-status ${state.handDetected ? 'ok' : ''}`}>
                  {state.handDetected ? 'Dłoń wykryta' : 'Pokaż dłoń do kamery'}
                </span>
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
            <span className={`letter ${state.stableLetter ? 'active' : ''}`}>
              {state.stableLetter?.letter ?? '–'}
            </span>
            <div className="confidence">
              <div
                className="confidence-bar"
                style={{ width: `${Math.round((state.stableLetter?.confidence ?? 0) * 100)}%` }}
              />
            </div>
            <span className="confidence-value">
              {state.stableLetter
                ? `pewność ${Math.round(state.stableLetter.confidence * 100)}%`
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
        <h2>Obsługiwane litery ({SUPPORTED_LETTERS.length})</h2>
        <p className="muted">
          Wersja pierwsza rozpoznaje statyczne litery alfabetu palcowego PJM. Litery wymagające
          ruchu dłoni (np. Ą, Ę, J, Ł) pojawią się w kolejnych wersjach.
        </p>
        <ul className="letters-grid">
          {SUPPORTED_LETTERS.map((l) => (
            <li key={l.letter}>
              <HandDiagram
                landmarks={LETTER_POSES[l.letter]}
                size={92}
                className="letters-grid-diagram"
                title={`Układ dłoni dla litery ${l.letter}`}
              />
              <div>
                <span className="letters-grid-letter">{l.letter}</span>
                <span className="letters-grid-desc">{l.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
