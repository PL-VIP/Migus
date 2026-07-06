import { useEffect, useMemo, useState } from 'react'
import { useSignPractice } from '../hooks/useSignPractice'
import type { SignTemplate } from '../lib/signTemplate'
import { kspjmGlossUrl, kspjmVideoUrl, kspjmPosterUrl, type CatalogEntry } from '../lib/catalog'
import { saveAttempt, starsForScore } from '../lib/progress'
import type { LessonWord } from '../data/lessons'

interface PracticeViewProps {
  word: LessonWord
  entry: CatalogEntry | undefined
  onClose: (completed: boolean) => void
}

type Step = 'watch' | 'practice'

/**
 * Ćwiczenie jednego słowa w stylu Duolingo:
 *  krok 1 - obejrzyj nagranie znaku + przeczytaj instrukcje,
 *  krok 2 - powtórz przed kamerą; DTW ocenia wykonanie.
 */
export function PracticeView({ word, entry, onClose }: PracticeViewProps) {
  const [step, setStep] = useState<Step>('watch')
  const [template, setTemplate] = useState<SignTemplate | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [savedScore, setSavedScore] = useState<number | null>(null)

  const { videoRef, canvasRef, state, start, stop, beginAttempt } = useSignPractice(template)

  useEffect(() => {
    let cancelled = false
    fetch(`/signs/${word.glossId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SignTemplate>
      })
      .then((t) => {
        if (!cancelled) setTemplate(t)
      })
      .catch(() => {
        if (!cancelled)
          setTemplateError(
            'Brak szablonu ruchu dla tego słowa. Uruchom: node scripts/extract-templates.mjs --lessons',
          )
      })
    return () => {
      cancelled = true
    }
  }, [word.glossId])

  // Zapis wyniku po zakończonej próbie.
  useEffect(() => {
    if (state.phase === 'result' && state.result && state.result.score !== savedScore) {
      saveAttempt(word.glossId, state.result.score, state.result.ok)
      setSavedScore(state.result.score)
      if (state.result.ok) setCompleted(true)
    }
  }, [state.phase, state.result, savedScore, word.glossId])

  const stars = state.result ? starsForScore(state.result.score) : 0
  const videoUrl = useMemo(() => (entry ? kspjmVideoUrl(entry) : null), [entry])

  return (
    <div className="practice">
      <div className="practice-head">
        <button type="button" className="back" onClick={() => onClose(completed)}>
          ← Wróć do lekcji
        </button>
        <h2 className="practice-word">{word.word}</h2>
        {word.note && word.note !== word.word && <span className="muted">({word.note})</span>}
      </div>

      <div className="practice-steps">
        <button
          type="button"
          className={`step-tab ${step === 'watch' ? 'active' : ''}`}
          onClick={() => {
            stop()
            setStep('watch')
          }}
        >
          1. Obejrzyj
        </button>
        <button
          type="button"
          className={`step-tab ${step === 'practice' ? 'active' : ''}`}
          onClick={() => setStep('practice')}
          disabled={!template}
        >
          2. Powtórz przed kamerą
        </button>
      </div>

      {step === 'watch' && (
        <div className="practice-watch">
          <div className="watch-video">
            {videoUrl ? (
              <video src={videoUrl} poster={entry ? kspjmPosterUrl(entry) : undefined} controls autoPlay loop playsInline />
            ) : (
              <p className="error">Brak nagrania w katalogu słownika.</p>
            )}
          </div>
          <div className="watch-instructions">
            <h3>Jak wykonać ten znak</h3>
            {template ? (
              <ol>
                {template.instructions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            ) : templateError ? (
              <p className="muted">{templateError}</p>
            ) : (
              <p className="muted">Wczytywanie instrukcji…</p>
            )}
            {template && (
              <p className="muted small">
                Znak trwa około {template.durationSec.toFixed(1)} s ·{' '}
                {template.leftShare > 0.35 && template.rightShare > 0.35
                  ? 'dwie ręce'
                  : 'jedna ręka'}{' '}
                ·{' '}
                <a href={kspjmGlossUrl(word.glossId)} target="_blank" rel="noreferrer">
                  hasło w KSPJM ↗
                </a>
              </p>
            )}
            <button
              type="button"
              className="primary big"
              disabled={!template}
              onClick={() => setStep('practice')}
            >
              Umiem! Przechodzę do ćwiczenia →
            </button>
          </div>
        </div>
      )}

      {step === 'practice' && (
        <div className="practice-camera">
          <div className={`video-wrap ${state.phase !== 'idle' && state.phase !== 'loading' && state.phase !== 'error' ? 'is-running' : ''}`}>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />

            {state.phase === 'idle' && (
              <div className="video-placeholder">
                <p>Powtórz znak „{word.word}” przed kamerą</p>
                <button type="button" className="primary" onClick={start}>
                  Włącz kamerę
                </button>
              </div>
            )}
            {state.phase === 'loading' && (
              <div className="video-placeholder">
                <p>Uruchamianie kamery…</p>
              </div>
            )}
            {state.phase === 'countdown' && (
              <div className="overlay-big countdown">{state.countdown}</div>
            )}
            {state.phase === 'recording' && (
              <>
                <div className="overlay-badge rec">● Migaj teraz!</div>
                <div className="record-progress">
                  <div style={{ width: `${state.recordProgress * 100}%` }} />
                </div>
              </>
            )}
            {state.phase === 'scoring' && <div className="overlay-big">…</div>}
            {state.phase === 'result' && state.result && (
              <div className={`overlay-result ${state.result.ok ? 'ok' : 'nope'}`}>
                <div className="overlay-stars" aria-label={`${stars} na 3 gwiazdki`}>
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </div>
                <div className="overlay-score">{Math.round(state.result.score * 100)}%</div>
                <p>{state.result.feedback}</p>
                <div className="overlay-actions">
                  <button type="button" className="primary" onClick={beginAttempt}>
                    Spróbuj jeszcze raz
                  </button>
                  {state.result.ok && (
                    <button type="button" onClick={() => onClose(true)}>
                      Dalej →
                    </button>
                  )}
                </div>
              </div>
            )}
            {(state.phase === 'ready' || state.phase === 'result') && state.phase === 'ready' && (
              <div className="video-hud">
                <span className={`hand-status ${state.handDetected ? 'ok' : ''}`}>
                  {state.handDetected ? 'Dłonie widoczne' : 'Ustaw się w kadrze'}
                </span>
              </div>
            )}
          </div>

          {state.phase === 'error' && <p className="error">{state.errorMessage}</p>}

          <div className="controls">
            {state.phase === 'ready' && (
              <button type="button" className="primary big" onClick={beginAttempt}>
                Start! (3… 2… 1… migaj)
              </button>
            )}
            {(state.phase === 'ready' || state.phase === 'result') && (
              <button type="button" onClick={stop}>
                Zatrzymaj kamerę
              </button>
            )}
          </div>

          <p className="muted small">
            Po odliczeniu 3-2-1 wykonaj znak w swoim tempie. Nagranie trwa{' '}
            {template ? Math.max(2.5, template.durationSec * 1.6).toFixed(1) : '2,5'} s, a wykonanie
            jest porównywane z nagraniem lektora (algorytm DTW, w pełni lokalnie).
          </p>
        </div>
      )}
    </div>
  )
}
