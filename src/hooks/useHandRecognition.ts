import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { extractHandFeatures, LM } from '../lib/handFeatures'
import {
  type ClassificationResult,
  classifyHand,
  rankAllShapes,
  rankLetters,
} from '../lib/pjmClassifier'
import { LetterStabilizer } from '../lib/stabilizer'
import {
  DYNAMIC_REPLACES_STATIC,
  DynamicLetterDetector,
} from '../lib/dynamicLetters'

export type RecognitionStatus = 'idle' | 'loading' | 'running' | 'error'

/** Zdarzenie literowe: litera + ewentualna korekta poprzedniej (A → Ą). */
export interface LetterEvent {
  letter: string
  /** Jeśli ostatnia litera historii jest równa tej wartości, zastąp ją. */
  replacePrev?: string
}

export interface RecognitionState {
  status: RecognitionStatus
  errorMessage: string | null
  handDetected: boolean
  /** Dłoń się porusza (litery statyczne są wtedy wstrzymane). */
  handMoving: boolean
  /** Ustabilizowana litera (wygładzona w czasie) lub null. */
  stableLetter: ClassificationResult | null
  /** Ostatnio wykryta litera ruchoma (znika po chwili). */
  dynamicLetter: string | null
  /** Trzy najlepsze dopasowania z bieżącej klatki. */
  topCandidates: ClassificationResult[]
  fps: number
}

const INITIAL_STATE: RecognitionState = {
  status: 'idle',
  errorMessage: null,
  handDetected: false,
  handMoving: false,
  stableLetter: null,
  dynamicLetter: null,
  topCandidates: [],
  fps: 0,
}

/** Połączenia między punktami dłoni MediaPipe (do rysowania szkieletu). */
const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const DYNAMIC_FLASH_MS = 1600

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  moving: boolean,
): void {
  ctx.lineWidth = 3
  ctx.strokeStyle = moving ? 'rgba(255, 196, 87, 0.95)' : 'rgba(56, 217, 169, 0.9)'
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(landmarks[a].x * width, landmarks[a].y * height)
    ctx.lineTo(landmarks[b].x * width, landmarks[b].y * height)
    ctx.stroke()
  }
  ctx.fillStyle = '#ffffff'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Obsługa kamery + MediaPipe Hand Landmarker + rozpoznawanie liter PJM:
 * statycznych (klasyfikator + stabilizator) i ruchomych (detektor gestów).
 *
 * `onLetter` dostaje każdą rozpoznaną literę; dla liter ruchomych
 * z `replacePrev` (np. Ą zastępuje świeżo dopisane A).
 */
export function useHandRecognition(onLetter?: (event: LetterEvent) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const stabilizerRef = useRef(new LetterStabilizer())
  const detectorRef = useRef(new DynamicLetterDetector())
  const lastStableRef = useRef<string | null>(null)
  const dynamicFlashRef = useRef<{ letter: string; at: number } | null>(null)
  const lastUiUpdateRef = useRef(0)
  const frameTimesRef = useRef<number[]>([])
  const onLetterRef = useRef(onLetter)
  onLetterRef.current = onLetter

  const [state, setState] = useState<RecognitionState>(INITIAL_STATE)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    stabilizerRef.current.reset()
    detectorRef.current.reset()
    lastStableRef.current = null
    dynamicFlashRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState(INITIAL_STATE)
  }, [])

  const loop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    const now = performance.now()
    const result = landmarker.detectForVideo(video, now)

    const times = frameTimesRef.current
    times.push(now)
    while (times.length > 0 && now - times[0] > 1000) times.shift()

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = result.landmarks[0]
    let frameResult: ClassificationResult | null = null
    let topCandidates: ClassificationResult[] = []
    const detector = detectorRef.current

    if (landmarks) {
      const features = extractHandFeatures(landmarks)
      frameResult = classifyHand(features)
      topCandidates = rankLetters(features).slice(0, 3)

      const dynamicEvent = detector.push({
        t: now,
        topShape: rankAllShapes(features)[0] ?? null,
        wrist: { x: landmarks[LM.WRIST].x, y: landmarks[LM.WRIST].y },
        indexTip: { x: landmarks[LM.INDEX_TIP].x, y: landmarks[LM.INDEX_TIP].y },
        pinkyTip: { x: landmarks[LM.PINKY_TIP].x, y: landmarks[LM.PINKY_TIP].y },
        palmSize: features.palmSize,
      })

      if (dynamicEvent) {
        dynamicFlashRef.current = { letter: dynamicEvent.letter, at: now }
        const replacePrev = DYNAMIC_REPLACES_STATIC[dynamicEvent.letter]
        onLetterRef.current?.({ letter: dynamicEvent.letter, replacePrev })
        stabilizerRef.current.reset()
        lastStableRef.current = null
      }

      drawHand(ctx, landmarks, canvas.width, canvas.height, detector.isMoving)
    } else {
      detector.reset()
    }

    // Podczas ruchu dłoni nie zgłaszamy liter statycznych - układ przejściowy
    // między literami nie powinien trafiać do historii.
    const stable = detector.isMoving
      ? null
      : stabilizerRef.current.push(frameResult)

    if (stable && stable.letter !== lastStableRef.current) {
      onLetterRef.current?.({ letter: stable.letter })
    }
    if (!detector.isMoving) {
      lastStableRef.current = stable?.letter ?? null
    }

    const flash = dynamicFlashRef.current
    const dynamicLetter = flash && now - flash.at < DYNAMIC_FLASH_MS ? flash.letter : null

    // Aktualizacja stanu Reacta co ~100 ms (rysowanie działa co klatkę).
    if (now - lastUiUpdateRef.current > 100) {
      lastUiUpdateRef.current = now
      setState((prev) => ({
        ...prev,
        status: 'running',
        handDetected: Boolean(landmarks),
        handMoving: detector.isMoving,
        stableLetter: stable,
        dynamicLetter,
        topCandidates,
        fps: times.length,
      }))
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const start = useCallback(async () => {
    setState({ ...INITIAL_STATE, status: 'loading' })
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      let landmarker: HandLandmarker
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
      } catch {
        // Brak WebGL/GPU - użyj CPU.
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
      }
      landmarkerRef.current = landmarker

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) throw new Error('Brak elementu wideo')
      video.srcObject = stream
      await video.play()

      setState((prev) => ({ ...prev, status: 'running' }))
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      stop()
      const message =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')
          ? 'Brak dostępu do kamery. Zezwól na użycie kamery w przeglądarce i spróbuj ponownie.'
          : `Nie udało się uruchomić rozpoznawania: ${err instanceof Error ? err.message : String(err)}`
      setState({ ...INITIAL_STATE, status: 'error', errorMessage: message })
    }
  }, [loop, stop])

  useEffect(() => stop, [stop])

  return { videoRef, canvasRef, state, start, stop }
}
