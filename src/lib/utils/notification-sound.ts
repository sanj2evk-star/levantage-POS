// Notification sounds using Web Audio API — no external files needed

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    return audioContext
  } catch {
    return null
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = 'sine',
) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gainNode.gain.setValueAtTime(volume, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

/** Two ascending notes — pleasant notification for new orders */
export function playNewOrderSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 523.25, now, 0.15, 0.25)       // C5
  playTone(ctx, 659.25, now + 0.15, 0.25, 0.25) // E5
}

/** Three quick ascending notes — attention-grabbing for food ready */
export function playFoodReadySound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 587.33, now, 0.12, 0.3)        // D5
  playTone(ctx, 739.99, now + 0.12, 0.12, 0.3)  // F#5
  playTone(ctx, 880.0, now + 0.24, 0.3, 0.3)    // A5
}

/** Distinct bar/cafe notification — lower tone to distinguish from kitchen */
export function playBarNewOrderSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 440.0, now, 0.15, 0.25)        // A4
  playTone(ctx, 554.37, now + 0.15, 0.25, 0.25) // C#5
}

/** Unlock AudioContext — must be called from a user interaction (click) */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume()
  }
}

/** Keep audio context alive on mobile browsers that suspend it */
export function startAudioKeepAlive(_interval?: number): () => void {
  const id = setInterval(() => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume()
    }
  }, _interval ?? 20000)
  return () => clearInterval(id)
}
