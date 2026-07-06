import {
  type Point3,
  angleBetweenDeg,
  bendAtJointDeg,
  dist,
  sub,
} from './geometry'

/** Indeksy punktów charakterystycznych dłoni wg MediaPipe Hand Landmarker. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'

export interface FingerFeatures {
  /** Suma zgięć w stawach PIP i DIP (kciuk: MCP i IP). 0° = palec prosty. */
  curlDeg: number
  /** Odległość czubka palca od nadgarstka, znormalizowana rozmiarem dłoni. */
  tipDist: number
  /** Kierunek palca: wektor od MCP do czubka. */
  direction: Point3
}

export interface HandFeatures {
  /** Rozmiar dłoni: odległość nadgarstek → nasada palca środkowego. */
  palmSize: number
  fingers: Record<FingerName, FingerFeatures>
  /** Odległość czubka kciuka od czubka palca wskazującego / rozmiar dłoni. */
  thumbIndexPinch: number
  /** Średnia odległość czubka kciuka od czubków palców wskazującego, środkowego i serdecznego. */
  thumbToFingertipsMean: number
  /** Odległość czubka kciuka od nasady palca środkowego (kciuk „schowany” w dłoni). */
  thumbToMiddleMcp: number
  /** Kąt rozstawu między palcem wskazującym a środkowym (stopnie). */
  indexMiddleSpreadDeg: number
  /** Kąt rozstawu między palcem środkowym a serdecznym (stopnie). */
  middleRingSpreadDeg: number
  /** Kąt rozstawu między palcem serdecznym a małym (stopnie). */
  ringPinkySpreadDeg: number
  /** Czy odcinki PIP→TIP palców wskazującego i środkowego przecinają się (rzut XY). */
  indexMiddleCrossed: boolean
  /** Odległość czubków palca wskazującego i środkowego / rozmiar dłoni. */
  indexMiddleTipGap: number
  /** Kąt między kierunkiem kciuka a kierunkiem palca wskazującego (stopnie). */
  thumbIndexAngleDeg: number
  /** Kąt między kierunkiem kciuka a osią dłoni (nadgarstek → nasada palca środkowego). */
  thumbPalmAngleDeg: number
}

function fingerFeatures(
  lms: Point3[],
  palmSize: number,
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
): FingerFeatures {
  const curlDeg =
    bendAtJointDeg(lms[mcp], lms[pip], lms[dip]) +
    bendAtJointDeg(lms[pip], lms[dip], lms[tip])
  return {
    curlDeg,
    tipDist: dist(lms[tip], lms[LM.WRIST]) / palmSize,
    direction: sub(lms[tip], lms[mcp]),
  }
}

/** Przecięcie odcinków p1–p2 i p3–p4 w rzucie na płaszczyznę XY. */
export function segmentsIntersect2d(
  p1: Point3,
  p2: Point3,
  p3: Point3,
  p4: Point3,
): boolean {
  const d = (a: Point3, b: Point3, c: Point3) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = d(p3, p4, p1)
  const d2 = d(p3, p4, p2)
  const d3 = d(p1, p2, p3)
  const d4 = d(p1, p2, p4)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/**
 * Wylicza cechy geometryczne z 21 punktów dłoni MediaPipe.
 * Cechy są znormalizowane rozmiarem dłoni, więc nie zależą od odległości od kamery.
 */
export function extractHandFeatures(lms: Point3[]): HandFeatures {
  if (lms.length < 21) {
    throw new Error(`Oczekiwano 21 punktów dłoni, otrzymano ${lms.length}`)
  }

  const palmSize = Math.max(1e-6, dist(lms[LM.WRIST], lms[LM.MIDDLE_MCP]))

  const thumb: FingerFeatures = {
    curlDeg:
      bendAtJointDeg(lms[LM.THUMB_CMC], lms[LM.THUMB_MCP], lms[LM.THUMB_IP]) +
      bendAtJointDeg(lms[LM.THUMB_MCP], lms[LM.THUMB_IP], lms[LM.THUMB_TIP]),
    tipDist: dist(lms[LM.THUMB_TIP], lms[LM.WRIST]) / palmSize,
    direction: sub(lms[LM.THUMB_TIP], lms[LM.THUMB_MCP]),
  }

  const fingers: Record<FingerName, FingerFeatures> = {
    thumb,
    index: fingerFeatures(lms, palmSize, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP),
    middle: fingerFeatures(lms, palmSize, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP),
    ring: fingerFeatures(lms, palmSize, LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP),
    pinky: fingerFeatures(lms, palmSize, LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP),
  }

  const thumbTip = lms[LM.THUMB_TIP]
  const thumbToFingertipsMean =
    (dist(thumbTip, lms[LM.INDEX_TIP]) +
      dist(thumbTip, lms[LM.MIDDLE_TIP]) +
      dist(thumbTip, lms[LM.RING_TIP])) /
    3 /
    palmSize

  const palmAxis = sub(lms[LM.MIDDLE_MCP], lms[LM.WRIST])

  return {
    palmSize,
    fingers,
    thumbIndexPinch: dist(thumbTip, lms[LM.INDEX_TIP]) / palmSize,
    thumbToFingertipsMean,
    thumbToMiddleMcp: dist(thumbTip, lms[LM.MIDDLE_MCP]) / palmSize,
    indexMiddleSpreadDeg: angleBetweenDeg(fingers.index.direction, fingers.middle.direction),
    middleRingSpreadDeg: angleBetweenDeg(fingers.middle.direction, fingers.ring.direction),
    ringPinkySpreadDeg: angleBetweenDeg(fingers.ring.direction, fingers.pinky.direction),
    indexMiddleCrossed: segmentsIntersect2d(
      lms[LM.INDEX_PIP],
      lms[LM.INDEX_TIP],
      lms[LM.MIDDLE_PIP],
      lms[LM.MIDDLE_TIP],
    ),
    indexMiddleTipGap: dist(lms[LM.INDEX_TIP], lms[LM.MIDDLE_TIP]) / palmSize,
    thumbIndexAngleDeg: angleBetweenDeg(thumb.direction, fingers.index.direction),
    thumbPalmAngleDeg: angleBetweenDeg(thumb.direction, palmAxis),
  }
}
