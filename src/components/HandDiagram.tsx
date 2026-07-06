import type { Point3 } from '../lib/geometry'
import { LM } from '../lib/handFeatures'

/**
 * Grafika dłoni rysowana z 21 punktów (konwencja MediaPipe) jako SVG.
 * Rzut ortograficzny na płaszczyznę obrazu - te same punkty, których
 * używa klasyfikator, więc grafika wiernie oddaje rozpoznawany układ.
 */

const VIEW = 100

const px = (p: Point3) => (p.x * VIEW).toFixed(1)
const py = (p: Point3) => (p.y * VIEW).toFixed(1)

function fingerPath(lms: Point3[], mcp: number, pip: number, dip: number, tip: number): string {
  return `M ${px(lms[mcp])} ${py(lms[mcp])} L ${px(lms[pip])} ${py(lms[pip])} L ${px(lms[dip])} ${py(lms[dip])} L ${px(lms[tip])} ${py(lms[tip])}`
}

const SKIN = '#e8b98a'
const SKIN_EDGE = '#c9955f'

interface HandDiagramProps {
  landmarks: Point3[]
  /** Rozmiar w pikselach (kwadrat). */
  size?: number
  className?: string
  title?: string
}

export function HandDiagram({ landmarks, size = 120, className, title }: HandDiagramProps) {
  const lms = landmarks

  // Obrys dłoni: nadgarstek → kłąb kciuka → nasady palców → bok dłoni.
  const palm = [
    { x: 0.455, y: 0.86, z: 0 },
    lms[LM.THUMB_CMC],
    lms[LM.THUMB_MCP],
    lms[LM.INDEX_MCP],
    lms[LM.MIDDLE_MCP],
    lms[LM.RING_MCP],
    lms[LM.PINKY_MCP],
    { x: 0.615, y: 0.79, z: 0 },
    { x: 0.575, y: 0.86, z: 0 },
  ]
  const palmPath =
    palm.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p)} ${py(p)}`).join(' ') + ' Z'

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

  return (
    <svg
      viewBox={`18 28 64 66`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
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
      {/* Nadgarstek */}
      <path
        d={`M 45.5 86 L 57.5 86 L 57 94 L 46 94 Z`}
        fill={SKIN}
        stroke={SKIN_EDGE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
