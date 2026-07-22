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

/**
 * Kanonizacja dłoni: lustrzane odbicie (gdy dłoń ma odwrotną chiralność niż
 * kanon) oraz obrót w płaszczyźnie obrazu tak, by oś dłoni (nadgarstek →
 * nasada palca środkowego) wskazywała w górę. Dzięki temu reguły liter
 * działają dla obu rąk i przy dowolnym pochyleniu dłoni.
 *
 * Chiralność wykrywamy geometrycznie (iloczyn wektorowy wskazujący × mały
 * względem nadgarstka), a nie z etykiety MediaPipe - etykieta zależy od
 * tego, czy obraz jest odbity lustrzanie, a geometria nie.
 *
 * Zwraca też bezwzględny kąt osi dłoni (0° = palce w górę, 90° = w bok,
 * ±180° = w dół) oraz skrót perspektywiczny (mały, gdy palce celują
 * w kamerę) - używane przez litery, w których orientacja ma znaczenie.
 */
export function canonicalizeHand(lms: Point3[]): {
  landmarks: Point3[]
  palmAngleDeg: number
  foreshortening: number
} {
  const wrist = lms[LM.WRIST]
  const ix = sub(lms[LM.INDEX_MCP], wrist)
  const px = sub(lms[LM.PINKY_MCP], wrist)
  // Kanon (jak w pozach syntetycznych): kciuk po lewej → crossZ > 0.
  const crossZ = ix.x * px.y - ix.y * px.x
  const mirrored =
    crossZ < 0 ? lms.map((p) => ({ x: 2 * wrist.x - p.x, y: p.y, z: p.z })) : lms

  const axis = sub(mirrored[LM.MIDDLE_MCP], wrist)
  const axisXyLen = Math.hypot(axis.x, axis.y)
  const palmSize3d = Math.max(1e-6, dist(lms[LM.WRIST], lms[LM.MIDDLE_MCP]))
  // Kąt osi dłoni względem "w górę" (obraz: y rośnie w dół).
  const palmAngleDeg = (Math.atan2(axis.x, -axis.y) * 180) / Math.PI
  const rot = (-palmAngleDeg * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const landmarks = mirrored.map((p) => {
    const dx = p.x - wrist.x
    const dy = p.y - wrist.y
    return {
      x: wrist.x + dx * cos - dy * sin,
      y: wrist.y + dx * sin + dy * cos,
      z: p.z,
    }
  })
  return { landmarks, palmAngleDeg, foreshortening: axisXyLen / palmSize3d }
}

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
  /** Odległość czubka kciuka od czubka palca środkowego / rozmiar dłoni. */
  thumbMiddlePinch: number
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
  /**
   * Kierunek kciuka w płaszczyźnie obrazu po kanonizacji:
   * 0° = wzdłuż dłoni w górę, 90° = w bok od dłoni,
   * ujemny = w poprzek dłoni (w stronę małego palca).
   */
  thumbSideAngleDeg: number
  /** Bezwzględny kąt osi dłoni w obrazie (0° = palce w górę, ±180° = w dół). */
  palmAngleDeg: number
  /** Skrót perspektywiczny osi dłoni: ~1 dłoń w płaszczyźnie obrazu, mały = palce celują w kamerę. */
  foreshortening: number
  /** Czy czubek kciuka leży między palcem wskazującym a środkowym (litera T). */
  thumbBetweenIndexMiddle: boolean
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
 * Cechy są znormalizowane rozmiarem dłoni (niezależne od odległości od kamery),
 * a po kanonizacji (`canonicalizeHand`) także od obrotu dłoni i ręki L/P.
 */
export function extractHandFeatures(rawLms: Point3[]): HandFeatures {
  if (rawLms.length < 21) {
    throw new Error(`Oczekiwano 21 punktów dłoni, otrzymano ${rawLms.length}`)
  }

  const { landmarks: lms, palmAngleDeg, foreshortening } = canonicalizeHand(rawLms)

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

  // Po kanonizacji oś dłoni ≈ (0,-1): kąt kciuka w płaszczyźnie obrazu.
  // Dodatni = kciuk odchodzi w bok od dłoni (kanon: w lewo od osi),
  // ujemny = kciuk pochyla się nad dłonią w stronę małego palca.
  const thumbDir = thumb.direction
  const thumbSideAngleDeg = (Math.atan2(-thumbDir.x, -thumbDir.y) * 180) / Math.PI

  // Litera T: czubek kciuka wystaje między wskazującym a środkowym
  // (blisko obu stawów PIP, w pasie między palcami, powyżej nasady palców).
  const idxPip = lms[LM.INDEX_PIP]
  const midPip = lms[LM.MIDDLE_PIP]
  const thumbBetweenIndexMiddle =
    dist(thumbTip, idxPip) / palmSize < 0.42 &&
    dist(thumbTip, midPip) / palmSize < 0.42 &&
    thumbTip.x >= Math.min(idxPip.x, midPip.x) - 0.08 * palmSize &&
    thumbTip.x <= Math.max(idxPip.x, midPip.x) + 0.08 * palmSize &&
    thumbTip.y < lms[LM.INDEX_MCP].y + 0.15 * palmSize

  return {
    palmSize,
    fingers,
    thumbIndexPinch: dist(thumbTip, lms[LM.INDEX_TIP]) / palmSize,
    thumbMiddlePinch: dist(thumbTip, lms[LM.MIDDLE_TIP]) / palmSize,
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
    thumbSideAngleDeg,
    palmAngleDeg,
    foreshortening,
    thumbBetweenIndexMiddle,
  }
}
