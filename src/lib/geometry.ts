export interface Point3 {
  x: number
  y: number
  z: number
}

export function sub(a: Point3, b: Point3): Point3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function length(v: Point3): number {
  return Math.hypot(v.x, v.y, v.z)
}

export function dist(a: Point3, b: Point3): number {
  return length(sub(a, b))
}

export function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Kąt (w stopniach) pomiędzy dwoma wektorami, w zakresie [0, 180]. */
export function angleBetweenDeg(a: Point3, b: Point3): number {
  const la = length(a)
  const lb = length(b)
  if (la === 0 || lb === 0) return 0
  const cos = Math.min(1, Math.max(-1, dot(a, b) / (la * lb)))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Kąt zgięcia w stawie `b` łańcucha a→b→c, tj. kąt między wektorami
 * (b−a) i (c−b). 0° = segmenty idealnie współliniowe (palec prosty).
 */
export function bendAtJointDeg(a: Point3, b: Point3, c: Point3): number {
  return angleBetweenDeg(sub(b, a), sub(c, b))
}
