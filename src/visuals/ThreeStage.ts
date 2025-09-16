import * as THREE from 'three'
<<<<<<< HEAD
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
// FilmPass types vary; use a tiny custom grain shader instead
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js'
=======
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing'
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)

export type StageFrame = {
  time: number
  delta: number
<<<<<<< HEAD
=======
  // analysis features
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
  rms?: number
  bass?: number
  mid?: number
  treble?: number
  centroid?: number
  onset?: boolean
  tempoBPM?: number | null
<<<<<<< HEAD
  beatPhase?: number
  bands?: readonly number[]
=======
  bands?: number[] // 32-band energy optional
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
}

export type LayerParams = Record<string, number | string | boolean>

export interface StageLayer {
  id: string
  init(stage: ThreeStage): void
  render(frame: StageFrame, params: LayerParams, clock: THREE.Clock): void
  setParams?(p: Partial<LayerParams>): void
<<<<<<< HEAD
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
=======
  dispose?(): void
}

export type StageOptions = { postfx?: boolean; dpr?: number; fov?: number; near?: number; far?: number }

export class ThreeStage {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly clock = new THREE.Clock()
  composer: EffectComposer | null = null
  private renderPass: RenderPass | null = null
  private bloomPass: EffectPass | null = null
  private width = 1
  private height = 1
  private layers = new Map<string, { layer: StageLayer; params: LayerParams }>()
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)

  constructor(canvas: HTMLCanvasElement, opts: StageOptions = {}) {
    const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
<<<<<<< HEAD
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
=======

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 60, 1, opts.near ?? 0.1, opts.far ?? 1000)
    this.camera.position.set(0, 0, 8)
    this.camera.lookAt(0, 0, 0)

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.5)
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(3, 5, 4)
    this.scene.add(amb, dir)

    if (opts.postfx !== false) {
      this.composer = new EffectComposer(this.renderer)
      this.renderPass = new RenderPass(this.scene, this.camera)
      const bloom = new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.2, luminanceSmoothing: 0.15 })
      this.bloomPass = new EffectPass(this.camera, bloom)
      this.composer.addPass(this.renderPass)
      this.composer.addPass(this.bloomPass)
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    }
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w))
    this.height = Math.max(1, Math.floor(h))
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
<<<<<<< HEAD
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

=======
    if (this.composer) this.composer.setSize(this.width, this.height)
  }

>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
  registerLayer(id: string, layer: StageLayer, initialParams: LayerParams = {}): StageLayer {
    if (this.layers.has(id)) throw new Error(`Layer '${id}' already registered`)
    layer.id = id
    this.layers.set(id, { layer, params: { ...initialParams } })
    layer.init(this)
<<<<<<< HEAD
    layer.setParams?.(initialParams)
=======
    if (layer.setParams) layer.setParams(initialParams)
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    return layer
  }

  setParams(id: string, p: Partial<LayerParams>) {
<<<<<<< HEAD
    const rec = this.layers.get(id)
    if (!rec) return
    const next: LayerParams = { ...rec.params }
    Object.keys(p).forEach(k => {
      const v = p[k]
      if (v !== undefined) (next as Record<string, number | string | boolean>)[k] = v
    })
=======
    const rec = this.layers.get(id); if (!rec) return
    const next: LayerParams = { ...rec.params }
    for (const k in p) {
      const v = p[k]
      if (v !== undefined) (next as any)[k] = v
    }
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    rec.params = next
    rec.layer.setParams?.(p)
  }

  renderFrame(analysis: Omit<StageFrame, 'time' | 'delta'> = {}) {
    const delta = this.clock.getDelta()
    const time = this.clock.elapsedTime
<<<<<<< HEAD
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

=======
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    const frame: StageFrame = { time, delta, ...analysis }
    for (const { layer, params } of this.layers.values()) {
      layer.render(frame, params, this.clock)
    }
<<<<<<< HEAD

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
=======
    if (this.composer) this.composer.render(delta)
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    else this.renderer.render(this.scene, this.camera)
  }

  dispose() {
<<<<<<< HEAD
    this.layers.forEach(({ layer }) => layer.dispose?.())
=======
    for (const { layer } of this.layers.values()) layer.dispose?.()
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
    this.layers.clear()
    this.composer?.dispose()
    this.renderer.dispose()
  }
}

<<<<<<< HEAD
export default ThreeStage
=======
// --------- Layers ---------

export class SpectrumRings implements StageLayer {
  id = 'SpectrumRings'
  private mesh: THREE.InstancedMesh | null = null
  private count = 64
  private radius = 2.6
  private pop = 0 // decays after onset
  private color = new THREE.Color('hsl(160,70%,55%)')

  init(stage: ThreeStage) {
    const geom = new THREE.BoxGeometry(0.05, 1, 0.2)
    const mat = new THREE.MeshStandardMaterial({ color: this.color, emissive: 0x226644, emissiveIntensity: 0.2 })
    this.mesh = new THREE.InstancedMesh(geom, mat, this.count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    stage.scene.add(this.mesh)
  }

  setParams(p: Partial<LayerParams>) {
    if (typeof p['count'] === 'number') this.count = Math.max(8, Math.min(256, Math.floor(p['count'] as number)))
    if (typeof p['radius'] === 'number') this.radius = p['radius'] as number
    if (typeof p['hue'] === 'number') this.color.setHSL((p['hue'] as number)/360, 0.7, 0.55)
    if (this.mesh) (this.mesh.material as THREE.MeshStandardMaterial).color.copy(this.color)
  }

  render(frame: StageFrame, _params: LayerParams, _clock: THREE.Clock) {
    const mesh = this.mesh; if (!mesh) return
    const bands = frame.bands || []
    if (frame.onset) this.pop = 0.4
    this.pop *= 0.9
    const m = new THREE.Matrix4()
    const scl = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const up = new THREE.Vector3(0,1,0)
    const N = mesh.count
    const r = this.radius * (1 + this.pop*0.2)
    for (let i=0;i<N;i++) {
      const ang = (i / N) * Math.PI * 2
      const amp = bands.length ? (bands[i % bands.length] / 255) : (frame.rms ?? 0)
      const h = 0.3 + amp * 2.2
      pos.set(Math.cos(ang)*r, 0, Math.sin(ang)*r)
      const dir = pos.clone().normalize()
      const rotAxis = new THREE.Vector3().crossVectors(up, dir).normalize()
      const rotAngle = Math.acos(up.dot(dir))
      q.setFromAxisAngle(rotAxis, rotAngle)
      scl.set(1, h, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  dispose() { if (this.mesh) { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose() } }
}

export class LiquidMesh implements StageLayer {
  id = 'LiquidMesh'
  private mesh: THREE.Mesh | null = null
  private mat: THREE.ShaderMaterial | null = null
  private hue = 200
  init(stage: ThreeStage) {
    const geom = new THREE.SphereGeometry(1.6, 96, 64)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.2 },
        uHue: { value: this.hue/360 }
      },
      vertexShader: `
        uniform float uTime; uniform float uAmp; varying float vAmp;
        void main() {
          vec3 p = position;
          float n = sin( (p.x*2.1 + p.y*1.7 + p.z*2.7) + uTime*1.2 ) * 0.5 + 0.5;
          float d = n * uAmp;
          p += normal * d;
          vAmp = d;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }
      `,
      fragmentShader: `
        varying float vAmp; uniform float uHue;
        vec3 hsl2rgb(float h, float s, float l){
          float c=(1.0-abs(2.0*l-1.0))*s; float x=c*(1.0-abs(mod(h*6.0,2.0)-1.0)); float m=l-0.5*c; vec3 rgb;
          if(h<1.0/6.0) rgb=vec3(c,x,0); else if(h<2.0/6.0) rgb=vec3(x,c,0); else if(h<3.0/6.0) rgb=vec3(0,c,0);
          else if(h<4.0/6.0) rgb=vec3(0,c,x); else if(h<5.0/6.0) rgb=vec3(0,x,c); else rgb=vec3(c,0,x);
          return rgb + m;
        }
        void main(){
          float l = 0.45 + vAmp*0.8;
          vec3 col = hsl2rgb(uHue, 0.7, l);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false,
    })
    this.mesh = new THREE.Mesh(geom, mat)
    this.mat = mat
    stage.scene.add(this.mesh)
  }
  setParams(p: Partial<LayerParams>) { if (typeof p['hue'] === 'number') this.hue = p['hue'] as number }
  render(frame: StageFrame) {
    if (!this.mesh || !this.mat) return
    const amp = 0.15 + 0.5 * ((frame.bass ?? 0) * 0.8 + (frame.mid ?? 0) * 0.2)
    this.mat.uniforms.uAmp.value = amp
    this.mat.uniforms.uTime.value = performance.now() * 0.001
    if (frame.onset) this.mat.uniforms.uHue.value = ((this.hue/360) + 0.02) % 1
  }
  dispose() { if (this.mesh) { this.mesh.geometry.dispose(); this.mat?.dispose() } }
}

export class OrbitingParticles implements StageLayer {
  id = 'OrbitingParticles'
  private points: THREE.Points | null = null
  private geom: THREE.BufferGeometry | null = null
  private vel: Float32Array | null = null
  private radius = 3
  init(stage: ThreeStage) {
    const count = 2000
    const positions = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    const rnd = (min: number, max: number) => min + Math.random()*(max-min)
    for (let i=0;i<count;i++) {
      const a = Math.random() * Math.PI * 2
      const r = this.radius * (0.3 + Math.random()*0.7)
      positions[i*3+0] = Math.cos(a) * r
      positions[i*3+1] = rnd(-0.6, 0.6)
      positions[i*3+2] = Math.sin(a) * r
      vel[i] = rnd(0.4, 1.2)
    }
    this.vel = vel
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0x66ccff, size: 0.02, transparent: true, opacity: 0.9 })
    const pts = new THREE.Points(geom, mat)
    stage.scene.add(pts)
    this.points = pts
    this.geom = geom
  }
  render(frame: StageFrame, _params: LayerParams, clock: THREE.Clock) {
    if (!this.points || !this.geom || !this.vel) return
    const pos = this.geom.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const N = this.vel.length
    const omegaBase = 0.2
    const centroid = frame.centroid ?? 0
    const omega = omegaBase + (centroid/8000) * 2.2 // more treble -> faster swirl
    const dt = clock.getDelta()
    for (let i=0;i<N;i++) {
      const x = arr[i*3+0], z = arr[i*3+2]
      const r = Math.hypot(x, z)
      const theta = Math.atan2(z, x) + omega * this.vel[i] * dt
      arr[i*3+0] = Math.cos(theta) * r
      arr[i*3+2] = Math.sin(theta) * r
    }
    pos.needsUpdate = true
  }
  dispose() { this.geom?.dispose(); (this.points?.material as THREE.Material | undefined)?.dispose() }
}

// Convenience factory to quickly stand up a stage with default layers
export function createDefaultThreeStage(canvas: HTMLCanvasElement) {
  const stage = new ThreeStage(canvas, { postfx: true })
  stage.registerLayer('SpectrumRings', new SpectrumRings(), { count: 64, radius: 2.6, hue: 160 })
  stage.registerLayer('LiquidMesh', new LiquidMesh(), { hue: 200 })
  stage.registerLayer('OrbitingParticles', new OrbitingParticles(), {})
  return stage
}
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
