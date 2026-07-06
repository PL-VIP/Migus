/** Postęp nauki zapisywany lokalnie w przeglądarce (localStorage). */

export interface WordProgress {
  bestScore: number
  attempts: number
  /** Słowo zaliczone (przynajmniej jedno poprawne wykonanie). */
  done: boolean
}

export interface Progress {
  words: Record<number, WordProgress>
  xp: number
}

const KEY = 'migus-progress-v1'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Progress
  } catch {
    // uszkodzony zapis - zaczynamy od zera
  }
  return { words: {}, xp: 0 }
}

export function saveAttempt(glossId: number, score: number, ok: boolean): Progress {
  const progress = loadProgress()
  const prev = progress.words[glossId] ?? { bestScore: 0, attempts: 0, done: false }
  const firstTimeDone = ok && !prev.done
  progress.words[glossId] = {
    bestScore: Math.max(prev.bestScore, score),
    attempts: prev.attempts + 1,
    done: prev.done || ok,
  }
  progress.xp += firstTimeDone ? 10 : ok ? 2 : 0
  localStorage.setItem(KEY, JSON.stringify(progress))
  return progress
}

export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 0.8) return 3
  if (score >= 0.55) return 2
  if (score >= 0.35) return 1
  return 0
}
