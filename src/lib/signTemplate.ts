import type { Point3 } from './geometry'
import { dist } from './geometry'
import { LM } from './handFeatures'

/**
 * Wspólny format „szablonu znaku” PJM używany przez:
 *  - pipeline ekstrakcji (tools/extract) - buduje szablony z filmów słownika,
 *  - aplikację - porównuje wykonanie użytkownika z szablonem (DTW).
 *
 * Dzięki temu nagrania referencyjne i wykonanie użytkownika przechodzą
 * przez identyczną ekstrakcję cech (ten sam model MediaPipe i ten sam kod).
 */

/** Liczba klatek, do której downsamplujemy każdą sekwencję. */
export const TEMPLATE_FRAMES = 32

/** Cechy jednej dłoni w jednej klatce. */
export interface HandFrame {
  /** Pozycja nadgarstka w kadrze (0..1) - trajektoria ruchu. */
  wrist: [number, number]
  /**
   * Kształt dłoni: 21 punktów po normalizacji (nadgarstek w zerze,
   * skala = rozmiar dłoni), spłaszczone [x0,y0,z0,x1,...].
   */
  shape: number[]
}

/** Klatka: lewa i/lub prawa dłoń (null = dłoń niewykryta). */
export interface SignFrame {
  left: HandFrame | null
  right: HandFrame | null
}

export interface SignTemplate {
  glossId: number
  word: string
  /** Sekwencja TEMPLATE_FRAMES klatek. */
  frames: SignFrame[]
  /** Ile procent klatek ma wykrytą lewą/prawą dłoń (0..1). */
  leftShare: number
  rightShare: number
  /** Automatycznie wygenerowana instrukcja po polsku. */
  instructions: string[]
  /** Czas trwania znaku w sekundach (do kalibracji okna nagrywania). */
  durationSec: number
}

/** Punkty MediaPipe jednej dłoni → cechy HandFrame. */
export function handFrameFromLandmarks(landmarks: Point3[]): HandFrame {
  const wrist = landmarks[LM.WRIST]
  const palm = Math.max(1e-6, dist(wrist, landmarks[LM.MIDDLE_MCP]))
  const shape: number[] = []
  for (const p of landmarks) {
    shape.push((p.x - wrist.x) / palm, (p.y - wrist.y) / palm, (p.z - wrist.z) / palm)
  }
  return { wrist: [wrist.x, wrist.y], shape }
}

/** Downsampling sekwencji do dokładnie `n` klatek (najbliższy sąsiad). */
export function resampleFrames(frames: SignFrame[], n = TEMPLATE_FRAMES): SignFrame[] {
  if (frames.length === 0) return []
  const out: SignFrame[] = []
  for (let i = 0; i < n; i++) {
    const src = Math.min(frames.length - 1, Math.round((i * (frames.length - 1)) / (n - 1)))
    out.push(frames[src])
  }
  return out
}

/** Udział klatek z wykrytą dłonią. */
export function handShare(frames: SignFrame[], side: 'left' | 'right'): number {
  if (frames.length === 0) return 0
  return frames.filter((f) => f[side]).length / frames.length
}

/**
 * Przycina sekwencję do fragmentu, w którym cokolwiek się dzieje:
 * odrzuca klatki bez dłoni na początku i końcu nagrania.
 */
export function trimIdleFrames(frames: SignFrame[]): SignFrame[] {
  const first = frames.findIndex((f) => f.left || f.right)
  if (first === -1) return []
  let last = frames.length - 1
  while (last > first && !frames[last].left && !frames[last].right) last--
  return frames.slice(first, last + 1)
}

// ---------- Automatyczne instrukcje po polsku ----------

function netMovement(frames: SignFrame[], side: 'left' | 'right'): [number, number] | null {
  const present = frames.map((f) => f[side]).filter((h): h is HandFrame => h !== null)
  if (present.length < 2) return null
  const a = present[0].wrist
  const b = present[present.length - 1].wrist
  return [b[0] - a[0], b[1] - a[1]]
}

function pathLength(frames: SignFrame[], side: 'left' | 'right'): number {
  let sum = 0
  let prev: [number, number] | null = null
  for (const f of frames) {
    const h = f[side]
    if (!h) continue
    if (prev) sum += Math.hypot(h.wrist[0] - prev[0], h.wrist[1] - prev[1])
    prev = h.wrist
  }
  return sum
}

function movementDesc(net: [number, number] | null, path: number): string | null {
  if (!net) return null
  const [dx, dy] = net
  const netLen = Math.hypot(dx, dy)
  if (path < 0.06) return 'dłoń pozostaje niemal w miejscu'
  if (netLen < 0.05 && path > 0.15) return 'wykonaj ruch w miejscu (np. okrężny lub wahadłowy)'
  const horiz = dx > 0 ? 'w prawo' : 'w lewo'
  const vert = dy > 0 ? 'w dół' : 'w górę'
  if (Math.abs(dx) > 2 * Math.abs(dy)) return `wykonaj ruch ${horiz}`
  if (Math.abs(dy) > 2 * Math.abs(dx)) return `wykonaj ruch ${vert}`
  return `wykonaj ruch ${vert} i ${horiz}`
}

function locationDesc(y: number): string {
  if (y < 0.34) return 'na wysokości twarzy'
  if (y < 0.6) return 'na wysokości klatki piersiowej'
  return 'na wysokości pasa'
}

/**
 * Generuje krótkie instrukcje słowne z sekwencji klatek.
 * Uwaga: opisy kierunków są z perspektywy osoby migającej
 * (kadr filmu: lustrzane odbicie), dlatego odwracamy oś X.
 */
export function generateInstructions(frames: SignFrame[]): string[] {
  const out: string[] = []
  const leftShare = handShare(frames, 'left')
  const rightShare = handShare(frames, 'right')

  const twoHanded = leftShare > 0.35 && rightShare > 0.35
  out.push(twoHanded ? 'Znak wykonuje się dwiema rękami.' : 'Znak wykonuje się jedną ręką (dominującą).')

  const mainSide: 'left' | 'right' = rightShare >= leftShare ? 'right' : 'left'
  const firstWithHand = frames.find((f) => f[mainSide])?.[mainSide]
  if (firstWithHand) {
    out.push(`Zacznij ${locationDesc(firstWithHand.wrist[1])}.`)
  }

  const net = netMovement(frames, mainSide)
  const desc = movementDesc(net ? [-net[0], net[1]] : null, pathLength(frames, mainSide))
  if (desc) out.push(desc[0].toUpperCase() + desc.slice(1) + '.')

  if (twoHanded) {
    const netL = netMovement(frames, mainSide === 'right' ? 'left' : 'right')
    if (net && netL && Math.sign(netL[0]) !== Math.sign(net[0]) && Math.abs(netL[0]) > 0.04) {
      out.push('Ręce poruszają się w przeciwnych kierunkach (symetrycznie).')
    }
  }

  out.push('Obejrzyj nagranie kilka razy i naśladuj tempo oraz mimikę lektora.')
  return out
}
