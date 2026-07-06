import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import {
  generateInstructions,
  handFrameFromLandmarks,
  handShare,
  resampleFrames,
  trimIdleFrames,
  type SignFrame,
  type SignTemplate,
} from '../src/lib/signTemplate'

/**
 * Harness uruchamiany w Chrome przez scripts/extract-templates.mjs.
 * Wystawia na window funkcję extractTemplate(videoUrl, glossId, word),
 * która dekoduje film, przepuszcza klatki przez MediaPipe Hand Landmarker
 * (2 dłonie) i buduje SignTemplate - tym samym kodem, którego aplikacja
 * używa dla obrazu z kamery użytkownika.
 */

const SAMPLE_FPS = 15

/** detectForVideo wymaga znaczników czasu rosnących globalnie (jeden graf na sesję). */
let globalTs = 0

let landmarkerPromise: Promise<HandLandmarker> | null = null

function getLandmarker(): Promise<HandLandmarker> {
  landmarkerPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  })()
  return landmarkerPromise
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onseeked = () => resolve()
    video.onerror = () => reject(new Error('Błąd dekodowania wideo'))
    video.currentTime = t
  })
}

async function extractTemplate(
  videoUrl: string,
  glossId: number,
  word: string,
): Promise<SignTemplate> {
  const landmarker = await getLandmarker()

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = videoUrl
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error(`Nie można wczytać wideo: ${videoUrl}`))
  })

  const duration = video.duration
  const rawFrames: SignFrame[] = []

  for (let t = 0; t < duration; t += 1 / SAMPLE_FPS) {
    await seek(video, t)
    globalTs += 1000 / SAMPLE_FPS
    const res = landmarker.detectForVideo(video, globalTs)
    const frame: SignFrame = { left: null, right: null }
    res.landmarks.forEach((lms, i) => {
      const label = res.handedness[i]?.[0]?.categoryName
      const hand = handFrameFromLandmarks(lms)
      if (label === 'Left') frame.left = hand
      else if (label === 'Right') frame.right = hand
    })
    rawFrames.push(frame)
  }

  const trimmed = trimIdleFrames(rawFrames)
  if (trimmed.length < 4) {
    throw new Error(`Za mało klatek z dłońmi (${trimmed.length}) dla ${videoUrl}`)
  }
  const frames = resampleFrames(trimmed)

  // Zaokrąglenie do 3 miejsc - mniejsze pliki JSON.
  for (const f of frames) {
    for (const side of ['left', 'right'] as const) {
      const h = f[side]
      if (!h) continue
      h.wrist = [Number(h.wrist[0].toFixed(3)), Number(h.wrist[1].toFixed(3))]
      h.shape = h.shape.map((v) => Number(v.toFixed(3)))
    }
  }

  return {
    glossId,
    word,
    frames,
    leftShare: Number(handShare(frames, 'left').toFixed(2)),
    rightShare: Number(handShare(frames, 'right').toFixed(2)),
    instructions: generateInstructions(frames),
    durationSec: Number((trimmed.length / SAMPLE_FPS).toFixed(2)),
  }
}

declare global {
  interface Window {
    extractTemplate: typeof extractTemplate
    harnessReady: boolean
  }
}

window.extractTemplate = extractTemplate
window.harnessReady = true
