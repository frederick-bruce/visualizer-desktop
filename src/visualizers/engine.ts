/*
  Visualizer Engine (spec-compliant)
  - Renders either Canvas2D bars or WebGL particles inside a target container (#viz-container by default)
  - Single controller API with persistence and fullscreen helpers
*/

import { init as barsInit, render as barsRender, resize as barsResize, dispose as barsDispose } from './canvas2d/bars'
import { createThreeContext, ThreeContext } from './three/engine'
import { createParticlesScene, ParticlesScene } from './three/particles'

// ---------- Types (public) ----------
export interface BeatFrame {
  time: number
  dt: number
  bpm: number
  progressMs: number
  isBeat: boolean
  energyLow: number
  energyMid: number
  energyHigh: number
}

export interface VizSettings {
  sensitivity: number
  renderMode: 'canvas2d' | 'webgl'
  particleCount: number
  colorMode: 'spotify' | 'neon' | 'pastel'
  lowPowerMode: boolean
}

export interface VisualizerController {
  mount(container?: HTMLElement): void
  unmount(): void
  update(frame: BeatFrame): void
  setSettings(next: Partial<VizSettings>): void
  getSettings(): VizSettings
  enterFullscreen(): Promise<void>
  exitFullscreen(): Promise<void>
}

// ---------- Internals ----------

const LS_KEY = 'vd:viz-settings'
const DEFAULT_SETTINGS: VizSettings = {
  sensitivity: 0.5,
  renderMode: 'canvas2d',
  particleCount: 5000,
  colorMode: 'spotify',
  lowPowerMode: false
}

function loadSettings(initial?: Partial<VizSettings>): VizSettings {
  let stored: Partial<VizSettings> = {}
  try { const raw = localStorage.getItem(LS_KEY); if (raw) stored = JSON.parse(raw) } catch {}
  return { ...DEFAULT_SETTINGS, ...stored, ...initial }
}
function persistSettings(s: VizSettings) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {} }

interface Canvas2DState { canvas: HTMLCanvasElement | null }
interface WebGLState { three: ThreeContext | null; particles: ParticlesScene | null }

export function createVisualizerController(initial?: Partial<VizSettings>): VisualizerController {
  let settings = loadSettings(initial)
  let container: HTMLElement | null = null
  let mounted = false
  let rafId: number | null = null
  let lastTime = performance.now() / 1000
  let frameSkip = false
  const resizeObserver = new ResizeObserver(() => handleResize())

  // Mode states
  const c2d: Canvas2DState = { canvas: null }
  const gl: WebGLState = { three: null, particles: null }

  // ---------- Setup & Mode Switching ----------
  function getContainer(): HTMLElement | null {
    if (container) return container
    const el = document.getElementById('viz-container') || document.querySelector('[data-viz-container]') as HTMLElement | null
    return el
  }

  function ensureCanvas2D() {
    if (!container) return
    disposeWebGL()
    if (!c2d.canvas) {
      c2d.canvas = document.createElement('canvas')
      c2d.canvas.className = 'viz-canvas2d'
      container.appendChild(c2d.canvas)
      barsInit(c2d.canvas)
    }
    handleResize()
  }

  function ensureWebGL() {
    if (!container) return
    disposeCanvas2D()
    // WebGL availability check
    if (!isWebGLAvailable()) {
      console.warn('[viz] WebGL not available – falling back to canvas2d')
      settings.renderMode = 'canvas2d'
      persistSettings(settings)
      ensureCanvas2D()
      return
    }
    gl.three = createThreeContext()
    container.appendChild(gl.three.canvas)
    gl.particles = createParticlesScene(gl.three.scene, settings.particleCount)
    handleResize()
  }

  function isWebGLAvailable(): boolean {
    try {
      const test = document.createElement('canvas')
      const ctx = test.getContext('webgl') || test.getContext('experimental-webgl')
      return !!ctx
    } catch { return false }
  }

  function switchMode(next: 'canvas2d' | 'webgl') {
    if (settings.renderMode === next) return
    settings.renderMode = next
    persistSettings(settings)
    if (next === 'canvas2d') ensureCanvas2D(); else ensureWebGL()
  }

  // ---------- Resize ----------
  function handleResize() {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (settings.renderMode === 'canvas2d' && c2d.canvas) {
      barsResize(rect.width, rect.height, dpr, c2d.canvas)
    } else if (settings.renderMode === 'webgl' && gl.three) {
      gl.three.resize(rect.width, rect.height, dpr)
    }
  }

  // ---------- Render Loop Owner (time smoothing & optional frame skip) ----------
  function loop() {
    if (!mounted) return
    const now = performance.now() / 1000
    const dt = Math.min(0.1, now - lastTime)
    lastTime = now
    // Frame skipping for low power mode
    if (settings.lowPowerMode) frameSkip = !frameSkip; else frameSkip = false
    if (!frameSkip) currentExternalFrame && drawCurrent(currentExternalFrame, dt)
    rafId = requestAnimationFrame(loop)
  }

  // The app feeds BeatFrames via update(); we retain the latest & augment with internal dt smoothing.
  let currentExternalFrame: BeatFrame | null = null
  function drawCurrent(frame: BeatFrame, internalDt: number) {
    if (settings.renderMode === 'canvas2d' && c2d.canvas) {
      barsRender(frame, settings, internalDt)
    } else if (settings.renderMode === 'webgl' && gl.three && gl.particles) {
      gl.particles.update(frame, settings, internalDt)
      gl.three.render()
    }
  }

  // ---------- Public API ----------
  function mount(target?: HTMLElement) {
    if (mounted) return
    container = target || getContainer()
    if (!container) { console.warn('[viz] mount failed – container not found'); return }
    // Ensure relative positioning for fullscreen fallback styling
    if (!container.style.position) container.style.position = 'relative'
    if (settings.renderMode === 'canvas2d') ensureCanvas2D(); else ensureWebGL()
    resizeObserver.observe(container)
    attachFullscreenHandler()
    mounted = true
    rafId = requestAnimationFrame(loop)
  }

  function unmount() {
    mounted = false
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
    resizeObserver.disconnect()
    detachFullscreenHandler()
    disposeCanvas2D(); disposeWebGL()
    container = null
  }

  function update(frame: BeatFrame) { currentExternalFrame = frame }

  function setSettings(next: Partial<VizSettings>) {
    const prevMode = settings.renderMode
    settings = { ...settings, ...next }
    persistSettings(settings)
    if (next.renderMode && next.renderMode !== prevMode) switchMode(next.renderMode)
    if (settings.renderMode === 'webgl' && gl.particles && typeof next.particleCount === 'number' && next.particleCount !== gl.particles.count) {
      // Recreate particle scene for new count
      gl.particles.dispose(); gl.particles = createParticlesScene(gl.three!.scene, settings.particleCount)
    }
  }

  function getSettings(): VizSettings { return settings }

  // ---------- Fullscreen ----------
  async function enterFullscreen(): Promise<void> { if (container && container.requestFullscreen) await container.requestFullscreen() }
  async function exitFullscreen(): Promise<void> { if (document.fullscreenElement) await document.exitFullscreen() }

  let fsBtn: HTMLElement | null = null
  function attachFullscreenHandler() {
    if (!container) return
    fsBtn = container.querySelector('[data-action="fullscreen"], #viz-fullscreen') as HTMLElement | null
    if (fsBtn) fsBtn.addEventListener('click', onFsClick)
  }
  function detachFullscreenHandler() { if (fsBtn) fsBtn.removeEventListener('click', onFsClick); fsBtn = null }
  function onFsClick() { if (!document.fullscreenElement) enterFullscreen(); else exitFullscreen() }

  // ---------- Disposal Helpers ----------
  function disposeCanvas2D() { if (c2d.canvas) { barsDispose(); c2d.canvas.remove(); c2d.canvas = null } }
  function disposeWebGL() {
    if (gl.particles) { gl.particles.dispose(); gl.particles = null }
    if (gl.three) { gl.three.dispose(); gl.three = null }
  }

  return { mount, unmount, update, setSettings, getSettings, enterFullscreen, exitFullscreen }
}
