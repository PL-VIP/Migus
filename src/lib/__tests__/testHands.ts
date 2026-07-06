import type { Point3 } from '../geometry'

/**
 * Syntetyczne układy 21 punktów dłoni (konwencja MediaPipe) do testów.
 *
 * Współrzędne w znormalizowanym układzie obrazu: x rośnie w prawo,
 * y rośnie w dół. Dłoń „skierowana palcami do góry", nadgarstek na dole.
 * Rozmiar dłoni (nadgarstek → nasada palca środkowego) ≈ 0,2.
 */

const p = (x: number, y: number, z = 0): Point3 => ({ x, y, z })

const WRIST = p(0.5, 0.8)

// Nasady palców (MCP) rozmieszczone wachlarzowo nad nadgarstkiem.
const INDEX_MCP = p(0.44, 0.62)
const MIDDLE_MCP = p(0.5, 0.6)
const RING_MCP = p(0.56, 0.62)
const PINKY_MCP = p(0.62, 0.65)
const THUMB_CMC = p(0.4, 0.75)
const THUMB_MCP = p(0.36, 0.7)

/** Palec wyprostowany pionowo w górę od nasady. */
function straightFinger(mcp: Point3, dx = 0): [Point3, Point3, Point3] {
  return [
    p(mcp.x + dx * 0.33, mcp.y - 0.07),
    p(mcp.x + dx * 0.66, mcp.y - 0.12),
    p(mcp.x + dx, mcp.y - 0.17),
  ]
}

/** Palec zaciśnięty w pięść: czubek wraca w stronę dłoni. */
function curledFinger(mcp: Point3): [Point3, Point3, Point3] {
  return [
    p(mcp.x + 0.01, mcp.y - 0.05, -0.03),
    p(mcp.x + 0.02, mcp.y, -0.05),
    p(mcp.x + 0.01, mcp.y + 0.04, -0.04),
  ]
}

/** Palec półzgięty (łuk jak przy literze C). */
function halfBentFinger(mcp: Point3): [Point3, Point3, Point3] {
  return [
    p(mcp.x + 0.02, mcp.y - 0.06, -0.01),
    p(mcp.x + 0.05, mcp.y - 0.09, -0.03),
    p(mcp.x + 0.09, mcp.y - 0.1, -0.05),
  ]
}

interface HandSpec {
  thumb: [Point3, Point3, Point3] // IP jest wliczone w [1]; [MCP, IP, TIP] po THUMB_CMC
  index: [Point3, Point3, Point3]
  middle: [Point3, Point3, Point3]
  ring: [Point3, Point3, Point3]
  pinky: [Point3, Point3, Point3]
}

function buildHand(spec: HandSpec): Point3[] {
  return [
    WRIST,
    THUMB_CMC,
    ...spec.thumb,
    INDEX_MCP,
    ...spec.index,
    MIDDLE_MCP,
    ...spec.middle,
    RING_MCP,
    ...spec.ring,
    PINKY_MCP,
    ...spec.pinky,
  ]
}

/** A: pięść, kciuk prosty wzdłuż boku dłoni (skierowany ku górze). */
export const HAND_A = buildHand({
  thumb: [THUMB_MCP, p(0.35, 0.62), p(0.36, 0.55)],
  index: curledFinger(INDEX_MCP),
  middle: curledFinger(MIDDLE_MCP),
  ring: curledFinger(RING_MCP),
  pinky: curledFinger(PINKY_MCP),
})

/** B: wszystkie palce proste i złączone, kciuk zgięty w poprzek dłoni. */
export const HAND_B = buildHand({
  thumb: [THUMB_MCP, p(0.42, 0.66, -0.02), p(0.49, 0.63, -0.03)],
  index: straightFinger(INDEX_MCP, 0.005),
  middle: straightFinger(MIDDLE_MCP, 0.005),
  ring: straightFinger(RING_MCP, 0.005),
  pinky: straightFinger(PINKY_MCP, 0.005),
})

/** C: palce półzgięte w łuk, kciuk odsunięty, otwarcie między kciukiem a wskazującym. */
export const HAND_C = buildHand({
  thumb: [THUMB_MCP, p(0.35, 0.64), p(0.37, 0.58)],
  index: halfBentFinger(INDEX_MCP),
  middle: halfBentFinger(MIDDLE_MCP),
  ring: halfBentFinger(RING_MCP),
  pinky: halfBentFinger(PINKY_MCP),
})

/** I: mały palec prosty, reszta w pięści, kciuk przy dłoni. */
export const HAND_I = buildHand({
  thumb: [THUMB_MCP, p(0.42, 0.64, -0.02), p(0.47, 0.6, -0.03)],
  index: curledFinger(INDEX_MCP),
  middle: curledFinger(MIDDLE_MCP),
  ring: curledFinger(RING_MCP),
  pinky: straightFinger(PINKY_MCP, 0.01),
})

/** L: wskazujący prosty w górę, kciuk prosty w bok, reszta w pięści. */
export const HAND_L = buildHand({
  thumb: [THUMB_MCP, p(0.29, 0.68), p(0.22, 0.67)],
  index: straightFinger(INDEX_MCP),
  middle: curledFinger(MIDDLE_MCP),
  ring: curledFinger(RING_MCP),
  pinky: curledFinger(PINKY_MCP),
})

/** O: kciuk i wskazujący stykają się opuszkami, reszta lekko zgięta ale daleko od nadgarstka. */
export const HAND_O = buildHand({
  thumb: [THUMB_MCP, p(0.38, 0.6), p(0.43, 0.53)],
  index: [p(0.43, 0.56), p(0.43, 0.52, -0.01), p(0.435, 0.535, -0.02)],
  middle: [p(0.5, 0.53), p(0.51, 0.48, -0.02), p(0.515, 0.45, -0.04)],
  ring: [p(0.57, 0.55), p(0.58, 0.5, -0.02), p(0.585, 0.47, -0.04)],
  pinky: [p(0.63, 0.58), p(0.64, 0.54, -0.02), p(0.645, 0.51, -0.04)],
})

/** R: wskazujący i środkowy proste i skrzyżowane, reszta w pięści. */
export const HAND_R = buildHand({
  thumb: [THUMB_MCP, p(0.42, 0.64, -0.02), p(0.47, 0.6, -0.03)],
  // wskazujący pochylony w prawo, środkowy w lewo - krzyżują się
  index: [p(0.46, 0.55), p(0.485, 0.49), p(0.51, 0.44)],
  middle: [p(0.49, 0.53), p(0.47, 0.47), p(0.45, 0.42)],
  ring: curledFinger(RING_MCP),
  pinky: curledFinger(PINKY_MCP),
})

/** W: środkowy, serdeczny i mały proste i rozsunięte, kciuk i wskazujący w pętli. */
export const HAND_W = buildHand({
  thumb: [THUMB_MCP, p(0.38, 0.62), p(0.42, 0.57)],
  index: [p(0.42, 0.56), p(0.42, 0.52, -0.01), p(0.425, 0.555, -0.02)],
  middle: straightFinger(MIDDLE_MCP, -0.02),
  ring: straightFinger(RING_MCP, 0.02),
  pinky: straightFinger(PINKY_MCP, 0.06),
})

/** Y: wskazujący i mały proste, środkowy i serdeczny w pięści, kciuk na zgiętych palcach. */
export const HAND_Y = buildHand({
  thumb: [THUMB_MCP, p(0.44, 0.63, -0.03), p(0.5, 0.6, -0.05)],
  index: straightFinger(INDEX_MCP, -0.01),
  middle: curledFinger(MIDDLE_MCP),
  ring: curledFinger(RING_MCP),
  pinky: straightFinger(PINKY_MCP, 0.02),
})

/** Otwarta dłoń z szeroko rozstawionymi palcami („piątka”) - nie powinna być literą B. */
export const HAND_OPEN_SPREAD = buildHand({
  thumb: [THUMB_MCP, p(0.29, 0.68), p(0.22, 0.67)],
  index: straightFinger(INDEX_MCP, -0.09),
  middle: straightFinger(MIDDLE_MCP, -0.02),
  ring: straightFinger(RING_MCP, 0.05),
  pinky: straightFinger(PINKY_MCP, 0.12),
})
