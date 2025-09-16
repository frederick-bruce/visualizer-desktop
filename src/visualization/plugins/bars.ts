import * as THREE from 'three'
import { VisualizationPlugin } from './types'

// Windows Media Player-style bars with log-spaced bands, fast attack/slow release, and falling peak caps.
const barsPlugin: VisualizationPlugin = (() => {
  let group: THREE.Group | null = null
  let bars: THREE.Mesh[] = []
  let caps: THREE.Mesh[] = []
  let material: THREE.MeshBasicMaterial | null = null
  let capMaterial: THREE.MeshBasicMaterial | null = null
  let lastCount = 0
  let analyser: AnalyserNode | null = null
  let baselineY = -1.5

  // Smoothing state
  let smoothVals: Float32Array | null = null
  let peakVals: Float32Array | null = null

  // Mapping from bar index to [binStart, binEnd)
  let bandRanges: Array<{ a: number; b: number }> = []
  let lastLayoutW = 0
  let lastLayoutH = 0
  let lastAspect = 0

  function ensureBars(scene: THREE.Scene, count: number) {
    if (!group) { group = new THREE.Group(); scene.add(group) }
    if (count === lastCount && bars.length === count && caps.length === count) return
    // remove old
    const disposeMesh = (m: THREE.Mesh) => { try { (m.geometry as any)?.dispose?.(); (m.material as any)?.dispose?.() } catch {} }
    for (const m of bars) disposeMesh(m)
    for (const m of caps) disposeMesh(m)
    bars = []
    caps = []
    group.clear()
    lastCount = count
  material = new THREE.MeshBasicMaterial({ color: 0x1DB954 })
  capMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    for (let i=0;i<count;i++) {
      const barGeo = new THREE.BoxGeometry(1, 1, 1)
      const bar = new THREE.Mesh(barGeo, material)
      bars.push(bar)
      group.add(bar)
      const capGeo = new THREE.BoxGeometry(1, 0.06, 1)
      const cap = new THREE.Mesh(capGeo, capMaterial)
      caps.push(cap)
      group.add(cap)
    }
    smoothVals = new Float32Array(count)
    peakVals = new Float32Array(count)
    peakVals.fill(0)
  }

  function layoutBars(camera: THREE.Camera, renderer: THREE.WebGLRenderer, count: number) {
    if (!group) return
    const n = count
    // Compute world-space width/height at z=0 for the current camera
    const size = renderer.getSize(new THREE.Vector2())
    let worldH = 6, worldW = 10
    if ((camera as any).isPerspectiveCamera) {
      const pc = camera as THREE.PerspectiveCamera
      const dist = Math.abs(pc.position.z)
      const vFov = (pc.fov * Math.PI) / 180
      worldH = 2 * Math.tan(vFov / 2) * dist
      worldW = worldH * pc.aspect
    } else if ((camera as any).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera
      worldW = Math.abs(oc.right - oc.left)
      worldH = Math.abs(oc.top - oc.bottom)
    } else {
      // Fallback using renderer aspect
      const aspect = size.x / Math.max(1, size.y)
      worldH = 6
      worldW = worldH * aspect
    }
    const usableW = worldW * 0.9
    const gap = usableW * 0.012
    const totalGap = gap * (n - 1)
    const w = Math.max(usableW / (n + (n - 1) * 0.012), (usableW - totalGap) / n)
    const startX = -usableW / 2 + w / 2
  const baseline = -worldH * 0.25
  baselineY = baseline
    for (let i = 0; i < n; i++) {
      const x = startX + i * (w + gap)
      const bar = bars[i]
      bar.position.set(x, baseline, 0)
      bar.scale.set(w, 0.12, 0.5)
      const cap = caps[i]
      cap.position.set(x, baseline + 0.06/2, 0.01)
      cap.scale.set(w * 0.9, 1, 0.5)
    }
    // Center group vertically (we already baked baseline into child positions)
    group.position.set(0, 0, 0)
    lastLayoutW = size.x
    lastLayoutH = size.y
    // store aspect if perspective
    if ((camera as any).isPerspectiveCamera) lastAspect = (camera as THREE.PerspectiveCamera).aspect
  }

  function buildBandMap(count: number, fftSize: number, sampleRate: number) {
    bandRanges = []
    // Frequency per bin: f = binIndex * (sampleRate/2) / fftSize
    const nyquist = sampleRate / 2
    const minF = 50
    const maxF = 16000
    const logMin = Math.log10(minF)
    const logMax = Math.log10(maxF)
    for (let i = 0; i < count; i++) {
      const t0 = i / count
      const t1 = (i + 1) / count
      const f0 = Math.pow(10, logMin + (logMax - logMin) * t0)
      const f1 = Math.pow(10, logMin + (logMax - logMin) * t1)
      const b0 = Math.max(0, Math.min(fftSize - 1, Math.floor((f0 / nyquist) * fftSize)))
      const b1 = Math.max(b0 + 1, Math.min(fftSize, Math.ceil((f1 / nyquist) * fftSize)))
      bandRanges.push({ a: b0, b: b1 })
    }
  }

  // Simple neighbor blur to soften jagged differences
  function blur1D(values: Float32Array) {
    const n = values.length
    if (n < 3) return values
    const tmp = new Float32Array(n)
    for (let i=0;i<n;i++) {
      const v0 = values[Math.max(0, i-1)]
      const v1 = values[i]
      const v2 = values[Math.min(n-1, i+1)]
      tmp[i] = 0.25*v0 + 0.5*v1 + 0.25*v2
    }
    values.set(tmp)
    return values
  }

  return {
    async initialize(ctx) {
      analyser = ctx.analyser
  // Unlit material, lights not required
      const count = 48
      ensureBars(ctx.scene, count)
      layoutBars(ctx.camera, ctx.renderer, count)
      try {
        const fftSize = ctx.analyser.frequencyBinCount
        const sr = (ctx.analyser.context && (ctx.analyser.context as AudioContext).sampleRate) || 44100
        buildBandMap(count, fftSize, sr)
      } catch {}
    },
    renderFrame({ fft, dt, time }) {
      if (!group || bars.length === 0 || !fft || !smoothVals || !peakVals) return
      const n = bars.length
      const minH = 0.12
      const maxH = 2.8

      // Relayout if size or aspect changed (e.g., initial zero size -> real size, or window resize)
      try {
        const renderer = (bars[0] as any)?.material?.constructor?.name ? (group?.children?.[0] as any)?.material?.renderer : null
      } catch {}
      const anyBar = bars[0]
      // Access renderer & camera via bar's parent chain is not straightforward; rely on global THREE state passed indirectly is complex.
      // Instead expect a global resize triggers plugin re-init rarely; as a fallback we can re-run layout using stored group parent metadata.
      // We'll approximate by detecting DOM canvas size via renderer from the first bar's world matrix (not available). Simpler: use window.innerWidth/innerHeight heuristics.
      // Use aspect from window to detect change.
      const aspectNow = window.innerWidth / Math.max(1, window.innerHeight)
      if (Math.abs(aspectNow - lastAspect) > 0.01) {
        // Attempt relayout using heuristic camera dims
        try {
          const root = group?.parent as any
          if (root && root.children) {
            // Find camera in siblings (first PerspectiveCamera)
            const cam = root.children.find((c: any) => c.isPerspectiveCamera)
            const rendererCanvas = (root?.userData?.__renderer as THREE.WebGLRenderer) || null
            if (cam) {
              const fakeRenderer = rendererCanvas || { getSize: () => new THREE.Vector2(window.innerWidth, window.innerHeight) } as any
              layoutBars(cam, fakeRenderer, n)
            }
          }
        } catch {}
      }

      // Aggregate FFT into log-spaced band values 0..1
      const bandVals = new Float32Array(n)
      for (let i=0;i<n;i++) {
        const r = bandRanges[i]
        if (!r) { bandVals[i] = 0; continue }
        let sum = 0; let c = 0
        for (let b=r.a;b<r.b && b<fft.length;b++) { sum += fft[b]; c++ }
        const avg = c > 0 ? (sum / c) / 255 : 0
        // Perceptual curve: emphasize mid-high; gamma
        const shaped = Math.pow(Math.max(0, Math.min(1, avg)), 0.9)
        bandVals[i] = shaped
      }
      // If almost no energy (e.g., no provider and silent analyser), animate a subtle idle wave
      let energySum = 0
      for (let i=0;i<n;i++) energySum += bandVals[i]
      if (energySum < 0.0005) {
        for (let i=0;i<n;i++) {
          const phase = (time ?? 0) * 1.7 + i * 0.35
          bandVals[i] = 0.10 + 0.06 * (0.5 + 0.5 * Math.sin(phase))
        }
      }
      // Light blur to smooth neighbors
      blur1D(bandVals)

      // Attack/Release smoothing
      const attackTau = 0.03   // ~30ms fast rise
      const releaseTau = 0.22  // ~220ms slower fall
      const attAlpha = 1 - Math.exp(-dt / attackTau)
      const relAlpha = 1 - Math.exp(-dt / releaseTau)
      for (let i=0;i<n;i++) {
        const target = bandVals[i]
        const prev = smoothVals[i]
        if (target >= prev) {
          // attack towards target
          smoothVals[i] = prev + (target - prev) * attAlpha
        } else {
          // release towards target (but not below target)
          const dec = (prev - target) * relAlpha
          smoothVals[i] = Math.max(target, prev - dec)
        }
      }

      // Peak caps fall with gravity-like speed, get pushed up by bar
      const peakFall = 0.9 // units/sec in normalized scale
      for (let i=0;i<n;i++) {
        const v = smoothVals[i]
        if (peakVals[i] < v) peakVals[i] = v
        else peakVals[i] = Math.max(0, peakVals[i] - peakFall * dt)
      }

      // Apply to meshes
      for (let i=0;i<n;i++) {
        const h = minH + (maxH - minH) * smoothVals[i]
        const bar = bars[i]
  // Scale about bottom: set scale then position relative to fixed baseline
  bar.scale.y = h
  bar.position.y = baselineY + h / 2
        const cap = caps[i]
  const capY = baselineY + (minH + (maxH - minH) * peakVals[i]) + 0.06
        cap.position.y = capY
      }
    },
    dispose() {
      if (group) {
        group.traverse((o: any) => { if (o.isMesh) { o.geometry?.dispose?.(); (o.material as any)?.dispose?.() } })
      }
      group = null; bars = []; caps = []; material = null; capMaterial = null; lastCount = 0
      analyser = null; smoothVals = null; peakVals = null; bandRanges = []
    }
  }
})()

export default barsPlugin
