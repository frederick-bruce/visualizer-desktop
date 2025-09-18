import * as THREE from 'three'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class SonarRipples implements StageLayer {
  id = 'SonarRipples'
  private mesh: THREE.Mesh | null = null
  private mat: THREE.ShaderMaterial | null = null
  private ripples: { t: number; speed: number }[] = []

  init(stage: ThreeStage) {
    const geom = new THREE.PlaneGeometry(10, 10, 1, 1)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uRip0: { value: new THREE.Vector2(0,0) }, uSpeed: { value: 1 }, uDecay: { value: 0.92 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uSpeed; uniform float uDecay; void main(){ vec2 uv=vUv-0.5; float r=length(uv); float w = sin((r*50. - uTime*uSpeed*10.)); float a = exp(-r*4.) * exp(-fract(uTime)* (1.0-uDecay)*8.0); vec3 col = vec3(0.3,0.6,1.0) * (0.1 + 0.9*abs(w)); gl_FragColor = vec4(col, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })
    this.mesh = new THREE.Mesh(geom, mat)
    this.mat = mat
    this.mesh.rotateX(-Math.PI/2)
    stage.scene.add(this.mesh)
  }

  setParams(p: Partial<LayerParams>) {
    if (typeof p['rippleSpeed'] === 'number') this.mat?.uniforms.uSpeed && (this.mat.uniforms.uSpeed.value = p['rippleSpeed'] as number)
    if (typeof p['decay'] === 'number') this.mat?.uniforms.uDecay && (this.mat.uniforms.uDecay.value = p['decay'] as number)
  }

  render(frame: StageFrame) {
    if (!this.mat) return
    this.mat.uniforms.uTime.value = frame.time
  }
  dispose() { this.mesh?.geometry.dispose(); this.mat?.dispose() }
}
