import type { Point3 } from '../lib/geometry'
import { LM } from '../lib/handFeatures'
import type { MotionKind } from '../data/alphabet'

/**
 * Grafika dłoni rysowana z 21 punktów (konwencja MediaPipe) jako SVG.
 * Rzut ortograficzny na płaszczyznę obrazu - te same punkty, których
 * używa klasyfikator, więc grafika wiernie oddaje rozpoznawany układ.
 * Dla liter ruchomych rysowana jest dodatkowo strzałka ruchu.
 */

const VIEW = 100

const px = (p: Point3) => (p.x * VIEW).toFixed(1)
const py = (p: Point3) => (p.y * VIEW).toFixed(1)

function fingerPath(lms: Point3[], mcp: number, pip: number, dip: number, tip: number): string {
  return `M ${px(lms[mcp])} ${py(lms[mcp])} L ${px(lms[pip])} ${py(lms[pip])} L ${px(lms[dip])} ${py(lms[dip])} L ${px(lms[tip])} ${py(lms[tip])}`
}

const SKIN = '#e8b98a'
const SKIN_EDGE = '#c9955f'
const ARROW = '#2f9e7d'

interface HandDiagramProps {
  landmarks: Point3[]
  /** Rozmiar w pikselach (kwadrat). */
  size?: number
  /** Strzałka ruchu dla liter ruchomych. */
  motion?: MotionKind
  className?: string
  title?: string
}

/** Ścieżki strzałek ruchu rysowane w prawym dolnym rogu kadru. */
function motionGlyph(kind: MotionKind, x: number, y: number): { d: string; head?: boolean } {
  switch (kind) {
    case 'down':
      return { d: `M ${x} ${y - 16} L ${x} ${y + 2}`, head: true }
    case 'side':
      return { d: `M ${x - 16} ${y - 6} L ${x + 3} ${y - 6}`, head: true }
    case 'hook':
      return { d: `M ${x - 6} ${y - 18} C ${x - 6} ${y - 6} ${x - 4} ${y - 2} ${x + 4} ${y - 4}`, head: true }
    case 'zigzag':
      return { d: `M ${x - 14} ${y - 16} L ${x + 1} ${y - 16} L ${x - 14} ${y - 3} L ${x + 2} ${y - 3}`, head: true }
    case 'circle':
      return { d: `M ${x + 7} ${y - 9} A 8 8 0 1 1 ${x + 3} ${y - 15.5}`, head: true }
    case 'forward':
      return {
        d: `M ${x - 4} ${y - 9} m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 M ${x - 4} ${y - 9} m -8.5 0 a 8.5 8.5 0 1 0 17 0`,
      }
    case 'stroke':
      return { d: `M ${x - 10} ${y - 2} L ${x + 2} ${y - 16}`, head: true }
    case 'snap':
      return {
        d: `M ${x - 4} ${y - 9} l 6 -6 M ${x - 4} ${y - 9} l 8 0 M ${x - 4} ${y - 9} l 6 6`,
      }
    case 'bend':
      return { d: `M ${x - 12} ${y - 16} C ${x - 2} ${y - 16} ${x + 2} ${y - 12} ${x + 2} ${y - 2}`, head: true }
  }
}

export function HandDiagram({ landmarks, size = 120, motion, className, title }: HandDiagramProps) {
  const lms = landmarks

  // Kadr dopasowany do dłoni (pozy mogą być obrócone, np. M i N).
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of lms) {
    minX = Math.min(minX, p.x * VIEW)
    minY = Math.min(minY, p.y * VIEW)
    maxX = Math.max(maxX, p.x * VIEW)
    maxY = Math.max(maxY, p.y * VIEW)
  }
  const pad = 7
  const extra = motion ? 20 : 0
  const vbX = minX - pad
  const vbY = minY - pad - (motion ? 4 : 0)
  const vbW = maxX - minX + pad * 2 + extra
  const vbH = maxY - minY + pad * 2 + (motion ? 8 : 0)
  const side = Math.max(vbW, vbH)

  // Obrys dłoni: kłąb kciuka → nasady palców → bok dłoni.
  const wrist = lms[LM.WRIST]
  const mid = lms[LM.MIDDLE_MCP]
  const axis = { x: mid.x - wrist.x, y: mid.y - wrist.y }
  const axisLen = Math.hypot(axis.x, axis.y) || 1
  const ux = axis.x / axisLen
  const uy = axis.y / axisLen
  // Punkty „u podstawy dłoni” po obu stronach nadgarstka.
  const sideVec = { x: -uy, y: ux }
  const heelThumb = {
    x: wrist.x + sideVec.x * -0.045,
    y: wrist.y + sideVec.y * -0.045,
    z: 0,
  }
  const heelPinky = {
    x: wrist.x + sideVec.x * 0.075,
    y: wrist.y + sideVec.y * 0.075,
    z: 0,
  }
  const palm = [
    heelThumb,
    lms[LM.THUMB_CMC],
    lms[LM.THUMB_MCP],
    lms[LM.INDEX_MCP],
    lms[LM.MIDDLE_MCP],
    lms[LM.RING_MCP],
    lms[LM.PINKY_MCP],
    heelPinky,
  ]
  const palmPath =
    palm.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p)} ${py(p)}`).join(' ') + ' Z'

  // Nadgarstek: krótki prostokąt wzdłuż osi dłoni w dół.
  const wristPath = `M ${(wrist.x - sideVec.x * 0.04) * VIEW} ${(wrist.y - sideVec.y * 0.04) * VIEW}
    L ${(wrist.x + sideVec.x * 0.07) * VIEW} ${(wrist.y + sideVec.y * 0.07) * VIEW}
    L ${(wrist.x + sideVec.x * 0.065 - ux * 0.09) * VIEW} ${(wrist.y + sideVec.y * 0.065 - uy * 0.09) * VIEW}
    L ${(wrist.x - sideVec.x * 0.035 - ux * 0.09) * VIEW} ${(wrist.y - sideVec.y * 0.035 - uy * 0.09) * VIEW} Z`

  const fingers: Array<{ d: string; width: number }> = [
    { d: fingerPath(lms, LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP), width: 5.6 },
    { d: fingerPath(lms, LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP), width: 6.4 },
    { d: fingerPath(lms, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP), width: 6.6 },
    { d: fingerPath(lms, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP), width: 6.4 },
    {
      d: `M ${px(lms[LM.THUMB_CMC])} ${py(lms[LM.THUMB_CMC])} L ${px(lms[LM.THUMB_MCP])} ${py(lms[LM.THUMB_MCP])} L ${px(lms[LM.THUMB_IP])} ${py(lms[LM.THUMB_IP])} L ${px(lms[LM.THUMB_TIP])} ${py(lms[LM.THUMB_TIP])}`,
      width: 7.4,
    },
  ]

  const glyph = motion ? motionGlyph(motion, vbX + vbW - 8, vbY + vbH - 8) : null

  return (
    <svg
      viewBox={`${(vbX - (side - vbW) / 2).toFixed(1)} ${(vbY - (side - vbH) / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={wristPath} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={palmPath} fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.6" strokeLinejoin="round" />
      {fingers.map((f, i) => (
        <g key={i}>
          <path
            d={f.d}
            fill="none"
            stroke={SKIN_EDGE}
            strokeWidth={f.width + 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={f.d}
            fill="none"
            stroke={SKIN}
            strokeWidth={f.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {glyph && (
        <g>
          <defs>
            <marker
              id={`arrowhead-${motion}`}
              markerWidth="6"
              markerHeight="6"
              refX="4.2"
              refY="3"
              orient="auto"
            >
              <path d="M 0.6 0.6 L 4.8 3 L 0.6 5.4 Z" fill={ARROW} />
            </marker>
          </defs>
          <path
            d={glyph.d}
            fill="none"
            stroke={ARROW}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={glyph.head ? `url(#arrowhead-${motion})` : undefined}
          />
        </g>
      )}
    </svg>
  )
}
