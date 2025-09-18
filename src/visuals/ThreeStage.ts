import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
// FilmPass types vary; use a tiny custom grain shader instead
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js'

export type StageFrame = {
  time: number
  delta: number
  rms?: number
  bass?: number
  mid?: number
  treble?: number
  centroid?: number
  onset?: boolean
  tempoBPM?: number | null
  beatPhase?: number
  bands?: readonly number[]
}

export type LayerParams = Record<string, number | string | boolean>

export interface StageLayer {
  id: string
  init(stage: ThreeStage): void
  render(frame: StageFrame, params: LayerParams, clock: THREE.Clock): void
  setParams?(p: Partial<LayerParams>): void
  setPerfMode?(on: boolean): void
  dispose?(): void
}

export type StageOptions = {
  dpr?: number
  fov?: number
  near?: number
  far?: number
  exposure?: number
  enablePostFX?: boolean
  trails?: boolean
}

export class ThreeStage {
  readonly scene: THREE.Scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly clock: THREE.Clock = new THREE.Clock()

  private composer: EffectComposer | null = null
  private renderPass: RenderPass | null = null
  private fxaaPass: ShaderPass | null = null
  private bloomPass: UnrealBloomPass | null = null
  private vignettePass: ShaderPass | null = null
  private grainPass: ShaderPass | null = null
  private afterimagePass: AfterimagePass | null = null

  private width = 1
  private height = 1
  private layers = new Map<string, { layer: StageLayer; params: LayerParams }>()
  private orbit = { enabled: false, bpmLinked: true, angle: 0 }
  private perfMode = false
  private ftAvg = 0
  private ftTimer = 0

  constructor(canvas: HTMLCanvasElement, opts: StageOptions = {}) {
    const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  this.renderer.toneMapping = THREE.ACESFilmicToneMapping
  this.renderer.toneMappingExposure = opts.exposure ?? 1.0

    const fov = opts.fov ?? 60
    const near = opts.near ?? 0.1
    const far = opts.far ?? 2000
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far)
    this.camera.position.set(0, 0, 8)
    this.camera.lookAt(0, 0, 0)

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.35)
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 5, 6)
    const rim = new THREE.DirectionalLight(0x88aaff, 0.35); rim.position.set(-4, 2, -3)
    this.scene.add(amb, key, rim)

    if (opts.enablePostFX !== false) {
      this.composer = new EffectComposer(this.renderer)
      this.renderPass = new RenderPass(this.scene, this.camera)
      this.composer.addPass(this.renderPass)

      this.fxaaPass = new ShaderPass(FXAAShader)
      this.composer.addPass(this.fxaaPass)

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1,1), 1.0, 0.55, 0.8)
      this.composer.addPass(this.bloomPass)

      this.vignettePass = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, strength: { value: 0.25 }, roundness: { value: 1.15 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float strength; uniform float roundness; void main(){ vec2 uv=vUv*2.-1.; float r = length(uv*vec2(1., roundness)); float v = smoothstep(1., 0.35, r); vec4 col = texture2D(tDiffuse, vUv); col.rgb *= mix(1., v, strength); gl_FragColor = col; }`
      })
      this.composer.addPass(this.vignettePass)

      // Grain
      this.grainPass = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, amount: { value: 0.06 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime; uniform float amount; float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); } void main(){ vec4 col = texture2D(tDiffuse, vUv); float n = rand(vUv + fract(uTime)); col.rgb += (n-0.5)*amount; gl_FragColor = col; }`
      })
      this.composer.addPass(this.grainPass)

      if (opts.trails) {
        this.afterimagePass = new AfterimagePass(0.94)
        this.composer.addPass(this.afterimagePass)
      }
    }
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w))
    this.height = Math.max(1, Math.floor(h))
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    if (this.composer) {
      this.composer.setSize(this.width, this.height)
      const pr = this.renderer.getPixelRatio()
      if (this.fxaaPass) {
        const res = (this.fxaaPass as any).uniforms?.['resolution']?.value as THREE.Vector2 | undefined
        if (res) res.set(1 / (this.width * pr), 1 / (this.height * pr))
      }
      if (this.bloomPass) this.bloomPass.setSize(this.width, this.height)
    }
  }

  setPostFX(opts: { exposure?: number; bloom?: { strength?: number; threshold?: number; radius?: number }; trails?: boolean }) {
    if (opts.exposure != null) this.renderer.toneMappingExposure = opts.exposure
    if (opts.bloom) {
      if (this.bloomPass) {
        if (opts.bloom.strength != null) this.bloomPass.strength = opts.bloom.strength
        if (opts.bloom.threshold != null) this.bloomPass.threshold = opts.bloom.threshold
        if (opts.bloom.radius != null) this.bloomPass.radius = opts.bloom.radius
      }
    }
    if (opts.trails != null) {
      if (opts.trails && !this.afterimagePass && this.composer) {
        this.afterimagePass = new AfterimagePass(0.94)
        this.composer.addPass(this.afterimagePass)
      }
      if (!opts.trails && this.afterimagePass && this.composer) {
        const idx = this.composer.passes.indexOf(this.afterimagePass)
        if (idx >= 0) this.composer.passes.splice(idx, 1)
        this.afterimagePass = null
      }
    }
  }

  setOrbit(enabled: boolean, bpmLinked: boolean = true) { this.orbit = { ...this.orbit, enabled, bpmLinked, angle: this.orbit.angle } }

  setPerfMode(on: boolean) {
    this.perfMode = on
    const scale = on ? 0.75 : 1.0
    const base = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    this.renderer.setPixelRatio(Math.min(2, base * scale))
  if (this.grainPass) this.grainPass.enabled = !on
    this.layers.forEach(({ layer }) => layer.setPerfMode?.(on))
  }

  isPerfMode() { return this.perfMode }

  registerLayer(id: string, layer: StageLayer, initialParams: LayerParams = {}): StageLayer {
    if (this.layers.has(id)) throw new Error(`Layer '${id}' already registered`)
    layer.id = id
    this.layers.set(id, { layer, params: { ...initialParams } })
    layer.init(this)
    layer.setParams?.(initialParams)
    return layer
  }

  setParams(id: string, p: Partial<LayerParams>) {
    const rec = this.layers.get(id)
    if (!rec) return
    const next: LayerParams = { ...rec.params }
    Object.keys(p).forEach(k => {
      const v = p[k]
      if (v !== undefined) (next as Record<string, number | string | boolean>)[k] = v
    })
    rec.params = next
    rec.layer.setParams?.(p)
  }

  renderFrame(analysis: Omit<StageFrame, 'time' | 'delta'> = {}) {
    const delta = this.clock.getDelta()
    const time = this.clock.elapsedTime
    // Auto orbit: slow yaw/pitch; BPM-linked if available
    if (this.orbit.enabled) {
      const bpm = analysis.tempoBPM ?? 120
      const rate = this.orbit.bpmLinked ? (bpm / 60) * 0.05 : 0.04
      this.orbit.angle = (this.orbit.angle + delta * rate) % (Math.PI * 2)
      const r = 8
      this.camera.position.x = Math.cos(this.orbit.angle) * r
      this.camera.position.z = Math.sin(this.orbit.angle) * r
      this.camera.lookAt(0, 0, 0)
    }

    const frame: StageFrame = { time, delta, ...analysis }
    for (const { layer, params } of this.layers.values()) {
      layer.render(frame, params, this.clock)
    }

    // Auto perf-mode: 60 FPS target; switch after sustained 2s over/under threshold
    const ft = delta * 1000
    const alpha = 0.1
    this.ftAvg = (1 - alpha) * this.ftAvg + alpha * ft
    this.ftTimer += delta
    if (this.ftTimer >= 2) {
      if (!this.perfMode && this.ftAvg > 16.6) this.setPerfMode(true)
      else if (this.perfMode && this.ftAvg < 15.0) this.setPerfMode(false)
      this.ftTimer = 0
    }

  if (this.grainPass) (this.grainPass as any).uniforms && ((this.grainPass as any).uniforms.uTime.value = this.clock.elapsedTime)
  if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.layers.forEach(({ layer }) => layer.dispose?.())
    this.layers.clear()
    this.composer?.dispose()
    this.renderer.dispose()
  }
}

export default ThreeStage
