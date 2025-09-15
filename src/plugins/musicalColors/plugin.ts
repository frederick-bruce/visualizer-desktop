import * as THREE from 'three'
import { IVisualizationPlugin, VisualizationPluginMeta, VisualizationGraphicsContext, VisualizationAudioFrame, VisualizationPluginModule } from '../../visualization/types'

class MusicalColorsPlugin implements IVisualizationPlugin {
  readonly meta: VisualizationPluginMeta = {
    id: 'musicalColors',
    name: 'Musical Colors',
    version: '0.1.0',
    author: 'Example',
    description: 'Color shifting shapes responding to FFT bands and beats.',
    kind: 'three',
    capabilities: ['beat','fft','waveform']
  }

  private graphics: VisualizationGraphicsContext | null = null
  private group: THREE.Group | null = null
  private materialA!: THREE.MeshStandardMaterial
  private materialB!: THREE.MeshStandardMaterial
  private materialC!: THREE.MeshStandardMaterial
  private beatPulse = 0

  async initialize(graphics: VisualizationGraphicsContext) {
    this.graphics = graphics
    if (graphics.kind !== 'three') throw new Error('MusicalColors requires three kind')

    this.group = new THREE.Group()

    const geoA = new THREE.IcosahedronGeometry(1, 1)
    const geoB = new THREE.TorusKnotGeometry(0.6, 0.18, 128, 16)
    const geoC = new THREE.BoxGeometry(1.2,1.2,1.2)

    this.materialA = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.5 })
    this.materialB = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 })
    this.materialC = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 })

    const mA = new THREE.Mesh(geoA, this.materialA)
    const mB = new THREE.Mesh(geoB, this.materialB)
    const mC = new THREE.Mesh(geoC, this.materialC)

    mA.scale.set(0.9,0.9,0.9)
    mB.scale.set(0.7,0.7,0.7)
    mC.scale.set(0.5,0.5,0.5)

    this.group.add(mA, mB, mC)
    graphics.scene.add(this.group)
  }

  renderFrame(frame: VisualizationAudioFrame) {
    if (!this.graphics || this.graphics.kind !== 'three' || !this.group) return
    const { bands, beat, fft, amplitude, time, dt } = frame

    if (beat) this.beatPulse = 1
    else this.beatPulse *= Math.exp(-dt / 0.25)

    // Color modulation from bands
    const low = bands.low
    const mid = bands.mid
    const high = bands.high

    // Convert to RGB-ish values
    const r = THREE.MathUtils.clamp(low * 1.4 + this.beatPulse * 0.5, 0, 1)
    const g = THREE.MathUtils.clamp(mid * 1.4, 0, 1)
    const b = THREE.MathUtils.clamp(high * 1.4 + this.beatPulse * 0.2, 0, 1)

    const colorA = new THREE.Color(r, g*0.8, b*0.6)
    const colorB = new THREE.Color(r*0.6, g, b)
    const colorC = new THREE.Color(r*0.3 + 0.2, g*0.4 + 0.3, b + 0.1)
    this.materialA.color.copy(colorA)
    this.materialB.color.copy(colorB)
    this.materialC.color.copy(colorC)

    // Rotation & scaling dynamics
    const spin = 0.4 + amplitude * 1.2
    this.group.rotation.y += spin * dt
    this.group.rotation.x += (0.2 + high * 0.6) * dt

    const pulse = 1 + this.beatPulse * 0.3 + low * 0.2
    this.group.scale.setScalar(pulse)

    // Simple camera dolly
    const cam = this.graphics.camera
    cam.position.z = 5 + Math.sin(time * 0.5) * 0.5 + amplitude * 0.8

    this.graphics.renderer.render(this.graphics.scene, cam)
  }

  resize(width: number, height: number, dpr: number) {
    if (this.graphics?.kind === 'three') {
      this.graphics.camera.aspect = width / Math.max(1, height)
      this.graphics.camera.updateProjectionMatrix()
      this.graphics.renderer.setPixelRatio(dpr)
      this.graphics.renderer.setSize(width, height, false)
    }
  }

  shutdown() {
    if (this.graphics?.kind === 'three' && this.group) {
      this.graphics.scene.remove(this.group)
    }
    this.group = null
  }
}

export function createPlugin(): IVisualizationPlugin {
  return new MusicalColorsPlugin()
}

// Provide full meta reference (optional duplication; primary source is instance.meta)
export const meta: VisualizationPluginMeta = {
  id: 'musicalColors',
  name: 'Musical Colors',
  version: '0.1.0',
  kind: 'three',
  author: 'Example',
  description: 'Color shifting shapes responding to FFT bands and beats.',
  capabilities: ['beat','fft','waveform']
}

const moduleExport: VisualizationPluginModule = { createPlugin, meta }
export default moduleExport
