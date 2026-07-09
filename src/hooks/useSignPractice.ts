import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { lastMatchDebug, matchRecording, type MatchResult } from '../lib/dtw'
import {
  handFrameFromLandmarks,
  trimIdleFrames,
  type SignFrame,
  type SignTemplate,
} from '../lib/signTemplate'

/**
 * Ćwiczenie znaku PJM: kamera (2 dłonie) → odliczanie → nagranie próby →
 * porównanie z szablonem (DTW) → wynik. Ta sama ekstrakcja cech co przy
 * budowie szablonów z filmów słownika.
 */

export type PracticePhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'countdown'
  | 'recording'
  | 'scoring'
  | 'result'
  | 'error'

export interface PracticeState {
  phase: PracticePhase
  errorMessage: string | null
  handDetected: boolean
  /** 3, 2, 1 podczas odliczania. */
  countdown: number
  /** Postęp nagrywania 0..1. */
  recordProgress: number
  result: MatchResult | null
}

const INITIAL: PracticeState = {
  phase: 'idle',
  errorMessage: null,
  handDetected: false,
  countdown: 3,
  recordProgress: 0,
  result: null,
}

const SAMPLE_FPS = 15

/**
 * Długość okna nagrywania próby. Dzięki dopasowaniu podsekwencyjnemu
 * okno może być dłuższe niż sam znak - użytkownik nie musi trafić
 * idealnie w moment startu.
 */
export function recordWindowMs(durationSec: number | undefined): number {
  return Math.max(4500, (durationSec ?? 2) * 1800 + 2200)
}
const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export function useSignPractice(template: SignTemplate | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const phaseRef = useRef<PracticePhase>('idle')
  const phaseStartRef = useRef(0)
  const framesRef = useRef<SignFrame[]>([])
  const lastSampleRef = useRef(0)
  const templateRef = useRef(template)
  templateRef.current = template

  const [state, setState] = useState<PracticeState>(INITIAL)

  const setPhase = useCallback((phase: PracticePhase, extra: Partial<PracticeState> = {}) => {
    phaseRef.current = phase
    phaseStartRef.current = performance.now()
    setState((prev) => ({ ...prev, phase, ...extra }))
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    phaseRef.current = 'idle'
    if (videoRef.current) videoRef.current.srcObject = null
    setState(INITIAL)
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

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const recording = phaseRef.current === 'recording'
    ctx.lineWidth = 3
    ctx.strokeStyle = recording ? 'rgba(255, 107, 107, 0.9)' : 'rgba(56, 217, 169, 0.9)'
    ctx.fillStyle = '#ffffff'
    for (const lms of result.landmarks) {
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(lms[a].x * canvas.width, lms[a].y * canvas.height)
        ctx.lineTo(lms[b].x * canvas.width, lms[b].y * canvas.height)
        ctx.stroke()
      }
      for (const lm of lms) {
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const handDetected = result.landmarks.length > 0
    const phase = phaseRef.current
    const elapsed = now - phaseStartRef.current

    if (phase === 'countdown') {
      const left = 3 - Math.floor(elapsed / 1000)
      if (left <= 0) {
        framesRef.current = []
        lastSampleRef.current = 0
        setPhase('recording', { recordProgress: 0 })
      } else {
        setState((prev) =>
          prev.countdown === left && prev.handDetected === handDetected
            ? prev
            : { ...prev, countdown: left, handDetected },
        )
      }
    } else if (phase === 'recording') {
      const tmpl = templateRef.current
      const recordMs = recordWindowMs(tmpl?.durationSec)
      if (now - lastSampleRef.current >= 1000 / SAMPLE_FPS) {
        lastSampleRef.current = now
        const frame: SignFrame = { left: null, right: null }
        result.landmarks.forEach((lms, i) => {
          const label = result.handedness[i]?.[0]?.categoryName
          const hand = handFrameFromLandmarks(lms)
          if (label === 'Left') frame.left = hand
          else if (label === 'Right') frame.right = hand
        })
        framesRef.current.push(frame)
      }

      // Na wolnych urządzeniach pętla nie nadąża z 15 kl./s - wtedy
      // wydłużamy nagrywanie, aż zbierzemy dość próbek (z twardym limitem).
      const minFrames = Math.round((recordMs / 1000) * SAMPLE_FPS * 0.6)
      const hardCapMs = recordMs * 3
      const frameCount = framesRef.current.length
      const progress = Math.min(
        1,
        Math.min(elapsed / recordMs, frameCount / Math.max(1, minFrames)),
      )
      setState((prev) => ({ ...prev, recordProgress: progress, handDetected }))

      if (elapsed >= recordMs && (frameCount >= minFrames || elapsed >= hardCapMs)) {
        setPhase('scoring')
        const trimmed = trimIdleFrames(framesRef.current)
        if (!tmpl) {
          setPhase('result', {
            result: {
              distance: Infinity,
              score: 0,
              ok: false,
              feedback: 'Brak szablonu znaku - wróć do lekcji i spróbuj ponownie.',
            },
          })
        } else {
          // Rzeczywiste tempo próbkowania (nie nominalne) - istotne, gdy
          // urządzenie nie nadąża; okna dopasowania muszą mu odpowiadać.
          const effFps = Math.min(SAMPLE_FPS, (frameCount / Math.max(1, elapsed)) * 1000)
          const match = matchRecording(trimmed, tmpl, Math.max(4, effFps))
          // Telemetria do testów E2E (window.__practiceDebug).
          ;(window as unknown as Record<string, unknown>).__practiceDebug = {
            frames: frameCount,
            withHands: trimmed.filter((f) => f.left || f.right).length,
            elapsedMs: Math.round(elapsed),
            effFps: Number(effFps.toFixed(1)),
            distance: match.distance,
            match: lastMatchDebug,
            glossId: tmpl.glossId,
          }
          setPhase('result', { result: match })
        }
      }
    } else {
      setState((prev) => (prev.handDetected === handDetected ? prev : { ...prev, handDetected }))
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [setPhase])

  const start = useCallback(async () => {
    setPhase('loading')
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      let landmarker: HandLandmarker
      const options = {
        baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        // Nisko: lepiej złapać dłoń z mniejszą pewnością, niż nie widzieć
        // jej wcale - błędne dopasowania i tak odfiltruje DTW.
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      }
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, options)
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        })
      }
      landmarkerRef.current = landmarker

      // „GPU” bywa emulowane programowo (SwiftShader) i wtedy jest dużo
      // wolniejsze od czystego WASM (XNNPACK). Mierzymy pierwszą inferencję
      // i przy żółwim tempie przełączamy się na delegata CPU.
      try {
        const probe = document.createElement('canvas')
        probe.width = 256
        probe.height = 256
        probe.getContext('2d')!.fillRect(0, 0, 256, 256)
        landmarker.detectForVideo(probe, performance.now())
        const t0 = performance.now()
        landmarker.detectForVideo(probe, performance.now())
        const gpuMs = performance.now() - t0
        if (gpuMs > 120) {
          const cpu = await HandLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'CPU' },
          })
          const t1 = performance.now()
          cpu.detectForVideo(probe, performance.now())
          const cpuMs = performance.now() - t1
          if (cpuMs < gpuMs) {
            landmarker.close()
            landmarkerRef.current = cpu
          } else {
            cpu.close()
          }
        }
      } catch {
        // pomiar to tylko optymalizacja - zostajemy przy bieżącym delegacie
      }

      // 640x360 zamiast HD: MediaPipe i tak wewnętrznie zmniejsza obraz,
      // a mniejsze klatki znacząco przyspieszają detekcję na słabym sprzęcie
      // (więcej próbek na sekundę = lepsze dopasowanie ruchu).
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Brak elementu wideo')
      video.srcObject = stream
      await video.play()

      setPhase('ready')
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      stop()
      const message =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')
          ? 'Brak dostępu do kamery. Zezwól na użycie kamery w przeglądarce i spróbuj ponownie.'
          : `Nie udało się uruchomić kamery: ${err instanceof Error ? err.message : String(err)}`
      setState({ ...INITIAL, phase: 'error', errorMessage: message })
      phaseRef.current = 'error'
    }
  }, [loop, setPhase, stop])

  const beginAttempt = useCallback(() => {
    if (phaseRef.current === 'ready' || phaseRef.current === 'result') {
      setPhase('countdown', { countdown: 3, result: null, recordProgress: 0 })
    }
  }, [setPhase])

  useEffect(() => stop, [stop])

  return { videoRef, canvasRef, state, start, stop, beginAttempt }
}
