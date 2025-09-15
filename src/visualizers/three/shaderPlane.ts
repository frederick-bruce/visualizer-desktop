// Standalone shader plane implementation (no dependency on removed ThreeVisualizer base class)
import * as THREE from 'three'
import { BeatFrame, VizSettings } from '../engine'
// @ts-ignore - raw import handled by Vite
import frag from '../shaders/beatPlane.frag.glsl?raw'

export interface ShaderPlaneScene {
  update(frame: BeatFrame, settings: VizSettings, internalDt: number): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}

export function createShaderPlaneScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera): ShaderPlaneScene {
  const geo = new THREE.PlaneGeometry(2,2,1,1)
  const mat = new THREE.ShaderMaterial({
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
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)
  camera.position.set(0,0,1)
  let beatPulse = 0

  function update(frame: BeatFrame, settings: VizSettings, internalDt: number) {
    if (frame.isBeat) beatPulse = 1; else beatPulse *= Math.exp(-internalDt / 0.2)
    const u = mat.uniforms
    u.u_time.value = frame.time
    u.u_bpm.value = frame.bpm
    u.u_energyLow.value = frame.energyLow
    u.u_energyMid.value = frame.energyMid
    u.u_energyHigh.value = frame.energyHigh
    u.u_beat.value = beatPulse
    u.u_colorMode.value = settings.colorMode === 'spotify' ? 0 : settings.colorMode === 'neon' ? 1 : 2
  }

  function resize(w: number, h: number, dpr: number) { mat.uniforms.u_resolution.value.set(w*dpr, h*dpr) }
  function dispose() { geo.dispose(); mat.dispose(); scene.remove(mesh) }
  return { update, resize, dispose }
}
