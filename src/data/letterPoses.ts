import type { Point3 } from '../lib/geometry'
import { buildHandPose, type FingerPose, type HandPoseSpec } from '../lib/handPose'

/**
 * Pozy dłoni (21 punktów MediaPipe) dla statycznych liter alfabetu
 * palcowego PJM. Służą do rysowania grafik układów palców w UI,
 * a testy jednostkowe gwarantują, że każda poza jest rozpoznawana
 * przez klasyfikator jako właściwa litera.
 */

const straight = (splayDeg = 0): FingerPose => ({ splayDeg, bendsDeg: [0, 4, 4] })
const fist = (splayDeg = 0): FingerPose => ({ splayDeg, bendsDeg: [70, 100, 40] })
const half = (splayDeg = 0): FingerPose => ({ splayDeg, bendsDeg: [25, 40, 25] })
const roundO = (splayDeg = 0): FingerPose => ({ splayDeg, bendsDeg: [45, 50, 30] })
const eBent = (splayDeg = 0): FingerPose => ({ splayDeg, bendsDeg: [45, 55, 35] })

type Thumb = HandPoseSpec['thumb']

/** Kciuk wyprostowany ku górze, wzdłuż boku dłoni (litera A). */
const thumbUp: Thumb = [
  { x: 0.375, y: 0.72, z: 0 },
  { x: 0.358, y: 0.66, z: 0 },
  { x: 0.348, y: 0.605, z: 0 },
]

/** Kciuk zgięty w poprzek dłoni (litery B, I, R, Y). */
const thumbAcross: Thumb = [
  { x: 0.4, y: 0.7, z: -0.02 },
  { x: 0.443, y: 0.668, z: -0.035 },
  { x: 0.487, y: 0.645, z: -0.045 },
]

/** Kciuk wyprostowany w bok (litera L). */
const thumbSide: Thumb = [
  { x: 0.36, y: 0.71, z: 0 },
  { x: 0.29, y: 0.7, z: 0 },
  { x: 0.225, y: 0.693, z: 0 },
]

/** Kciuk sięgający opuszkiem do opuszka palca wskazującego (litery O, W). */
const thumbCircle: Thumb = [
  { x: 0.39, y: 0.7, z: -0.04 },
  { x: 0.395, y: 0.625, z: -0.09 },
  { x: 0.415, y: 0.552, z: -0.122 },
]

/** Kciuk zaokrąglony, odsunięty od dłoni - dolna część litery C. */
const thumbCup: Thumb = [
  { x: 0.372, y: 0.72, z: 0 },
  { x: 0.353, y: 0.655, z: -0.01 },
  { x: 0.35, y: 0.59, z: -0.02 },
]

/** Kciuk dotykający opuszków zgiętych palców - „daszek” litery E. */
const thumbTouch: Thumb = [
  { x: 0.4, y: 0.7, z: -0.03 },
  { x: 0.43, y: 0.63, z: -0.08 },
  { x: 0.46, y: 0.565, z: -0.105 },
]

const SPECS: Record<string, HandPoseSpec> = {
  A: {
    index: fist(-2),
    middle: fist(),
    ring: fist(3),
    pinky: fist(7),
    thumb: thumbUp,
  },
  B: {
    index: straight(-3),
    middle: straight(),
    ring: straight(4),
    pinky: straight(9),
    thumb: thumbAcross,
  },
  C: {
    index: half(-3),
    middle: half(),
    ring: half(4),
    pinky: half(8),
    thumb: thumbCup,
  },
  E: {
    index: eBent(-2),
    middle: eBent(),
    ring: eBent(3),
    pinky: { splayDeg: 6, bendsDeg: [40, 50, 30] },
    thumb: thumbTouch,
  },
  I: {
    index: fist(-2),
    middle: fist(),
    ring: fist(3),
    pinky: straight(12),
    thumb: thumbAcross,
  },
  L: {
    index: straight(),
    middle: fist(),
    ring: fist(3),
    pinky: fist(7),
    thumb: thumbSide,
  },
  O: {
    index: roundO(),
    middle: straight(),
    ring: straight(4),
    pinky: straight(9),
    thumb: thumbCircle,
  },
  R: {
    index: { splayDeg: 18, bendsDeg: [8, 4, 4] },
    middle: { splayDeg: -10, bendsDeg: [10, 5, 5] },
    ring: fist(3),
    pinky: fist(7),
    thumb: thumbAcross,
  },
  W: {
    index: roundO(),
    middle: straight(-4),
    ring: straight(10),
    pinky: straight(24),
    thumb: thumbCircle,
  },
  Y: {
    index: straight(-6),
    middle: fist(),
    ring: fist(3),
    pinky: straight(18),
    thumb: thumbAcross,
  },
}

export const LETTER_POSES: Record<string, Point3[]> = Object.fromEntries(
  Object.entries(SPECS).map(([letter, spec]) => [letter, buildHandPose(spec)]),
)
