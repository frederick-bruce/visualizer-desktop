import * as THREE from 'three'
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing'

export type StageFrame = {
  time: number
  delta: number
  // analysis features
  rms?: number
  bass?: number
  mid?: number
  treble?: number
  centroid?: number
  onset?: boolean
  tempoBPM?: number | null
  bands?: number[] // 32-band energy optional
}

export type LayerParams = Record<string, number | string | boolean>

export interface StageLayer {
  id: string
  init(stage: ThreeStage): void
  render(frame: StageFrame, params: LayerParams, clock: THREE.Clock): void
  setParams?(p: Partial<LayerParams>): void
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

  constructor(canvas: HTMLCanvasElement, opts: StageOptions = {}) {
    const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

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
    }
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w))
    this.height = Math.max(1, Math.floor(h))
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    if (this.composer) this.composer.setSize(this.width, this.height)
  }

  registerLayer(id: string, layer: StageLayer, initialParams: LayerParams = {}): StageLayer {
    if (this.layers.has(id)) throw new Error(`Layer '${id}' already registered`)
    layer.id = id
    this.layers.set(id, { layer, params: { ...initialParams } })
    layer.init(this)
    if (layer.setParams) layer.setParams(initialParams)
    return layer
  }

  setParams(id: string, p: Partial<LayerParams>) {
    const rec = this.layers.get(id); if (!rec) return
    const next: LayerParams = { ...rec.params }
    for (const k in p) {
      const v = p[k]
      if (v !== undefined) (next as any)[k] = v
    }
    rec.params = next
    rec.layer.setParams?.(p)
  }

  renderFrame(analysis: Omit<StageFrame, 'time' | 'delta'> = {}) {
    const delta = this.clock.getDelta()
    const time = this.clock.elapsedTime
    const frame: StageFrame = { time, delta, ...analysis }
    for (const { layer, params } of this.layers.values()) {
      layer.render(frame, params, this.clock)
    }
    if (this.composer) this.composer.render(delta)
    else this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    for (const { layer } of this.layers.values()) layer.dispose?.()
    this.layers.clear()
    this.composer?.dispose()
    this.renderer.dispose()
  }
}

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
