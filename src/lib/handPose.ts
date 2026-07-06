import type { Point3 } from './geometry'

/**
 * Proceduralny model pozy dłoni: z opisu zgięć palców buduje 21 punktów
 * w konwencji MediaPipe. Te same punkty służą do rysowania grafik dłoni
 * (rzut na płaszczyznę XY) i do klasyfikacji liter - dzięki temu pokazywane
 * grafiki są dokładnie tym, co rozpoznaje kamera.
 *
 * Układ współrzędnych jak w MediaPipe: x w prawo, y w dół,
 * z ujemne w stronę kamery. Dłoń wnętrzem do widza, palce ku górze,
 * kciuk po lewej stronie obrazu.
 */

export interface FingerPose {
  /** Odchylenie palca od pionu w płaszczyźnie obrazu (stopnie, + w prawo). */
  splayDeg: number
  /** Zgięcia w stawach [MCP, PIP, DIP] w stopniach; 0 = palec prosty. */
  bendsDeg: [number, number, number]
}

export interface HandPoseSpec {
  index: FingerPose
  middle: FingerPose
  ring: FingerPose
  pinky: FingerPose
  /** Punkty kciuka [MCP, IP, TIP] podawane wprost (CMC jest stały). */
  thumb: [Point3, Point3, Point3]
}

export const WRIST: Point3 = { x: 0.5, y: 0.84, z: 0 }
export const THUMB_CMC: Point3 = { x: 0.415, y: 0.78, z: 0 }

export const MCP: Record<'index' | 'middle' | 'ring' | 'pinky', Point3> = {
  index: { x: 0.42, y: 0.58, z: 0 },
  middle: { x: 0.475, y: 0.565, z: 0 },
  ring: { x: 0.53, y: 0.575, z: 0 },
  pinky: { x: 0.585, y: 0.6, z: 0 },
}

/** Długości segmentów palców [paliczek bliższy, środkowy, dalszy]. */
const LENGTHS: Record<'index' | 'middle' | 'ring' | 'pinky', [number, number, number]> = {
  index: [0.075, 0.045, 0.035],
  middle: [0.085, 0.05, 0.038],
  ring: [0.078, 0.047, 0.036],
  pinky: [0.06, 0.037, 0.03],
}

const DEG = Math.PI / 180

/**
 * Wyznacza stawy palca [PIP, DIP, TIP]. Palec wychodzi z nasady ku górze
 * (odchylony o splay) i zgina się w stronę kamery/dłoni; kolejne zgięcia
 * kumulują się, więc kąt między segmentami w stawie równa się zadanemu zgięciu.
 */
export function fingerJoints(
  mcp: Point3,
  lengths: [number, number, number],
  pose: FingerPose,
): [Point3, Point3, Point3] {
  const splay = pose.splayDeg * DEG
  const joints: Point3[] = []
  let cum = 0
  let prev = mcp
  for (let i = 0; i < 3; i++) {
    cum += pose.bendsDeg[i] * DEG
    const next: Point3 = {
      x: prev.x + lengths[i] * Math.sin(splay) * Math.cos(cum),
      y: prev.y - lengths[i] * Math.cos(splay) * Math.cos(cum),
      z: prev.z - lengths[i] * Math.sin(cum),
    }
    joints.push(next)
    prev = next
  }
  return joints as [Point3, Point3, Point3]
}

/** Buduje pełną listę 21 punktów dłoni z opisu pozy. */
export function buildHandPose(spec: HandPoseSpec): Point3[] {
  return [
    WRIST,
    THUMB_CMC,
    ...spec.thumb,
    MCP.index,
    ...fingerJoints(MCP.index, LENGTHS.index, spec.index),
    MCP.middle,
    ...fingerJoints(MCP.middle, LENGTHS.middle, spec.middle),
    MCP.ring,
    ...fingerJoints(MCP.ring, LENGTHS.ring, spec.ring),
    MCP.pinky,
    ...fingerJoints(MCP.pinky, LENGTHS.pinky, spec.pinky),
  ]
}

