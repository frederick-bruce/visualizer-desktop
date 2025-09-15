import * as THREE from 'three'
import { ThreeVisualizer } from './engine'
import { BeatFrame, VizSettings } from '../types'
// @ts-ignore - raw import (Vite will handle) or fallback string if bundler unsupported
import frag from '../shaders/beatPlane.frag.glsl?raw'

class ShaderPlane3D extends ThreeVisualizer {
  private mat!: THREE.ShaderMaterial
  private mesh!: THREE.Mesh
  private beatPulse = 0

  setup(): void {
    if (!this.core) return
    const geo = new THREE.PlaneGeometry(2,2,1,1)
    this.mat = new THREE.ShaderMaterial({
      fragmentShader: frag,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }`,
      uniforms: {
        u_time: { value: 0 },
        u_beat: { value: 0 },
        u_bpm: { value: 120 },
        u_energyLow: { value: 0 },
        u_energyMid: { value: 0 },
        u_energyHigh: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1,1) },
        u_colorMode: { value: 0 }
      }
    })
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.core.scene.add(this.mesh)
    // Camera closer for full screen plane
    this.core.camera.position.set(0,0,1)
  }

  update(frame: BeatFrame, settings: VizSettings): void {
    if (!this.core) return
    if (frame.isBeat) this.beatPulse = 1; else this.beatPulse *= Math.exp(-frame.dt / 0.2)
    const u = this.mat.uniforms
    u.u_time.value = frame.time
    u.u_bpm.value = frame.bpm
    u.u_energyLow.value = frame.energyLow
    u.u_energyMid.value = frame.energyMid
    u.u_energyHigh.value = frame.energyHigh
    u.u_beat.value = this.beatPulse
    u.u_colorMode.value = settings.colorMode === 'spotify' ? 0 : settings.colorMode === 'neon' ? 1 : 2
    this.core.renderer.render(this.core.scene, this.core.camera)
  }

  resize(w: number, h: number, dpr: number): void {
    super.resize(w,h,dpr)
    if (this.mat) this.mat.uniforms.u_resolution.value.set(w*dpr, h*dpr)
  }

  protected teardown(): void {
    this.mat?.dispose(); (this.mesh as any) = null
  }
}

export function createShaderPlane3D(): ShaderPlane3D {
  return new ShaderPlane3D()
}
