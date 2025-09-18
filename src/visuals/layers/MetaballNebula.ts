import * as THREE from 'three'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class MetaballNebula implements StageLayer {
  id = 'MetaballNebula'
  private mesh: THREE.Mesh | null = null
  private mat: THREE.ShaderMaterial | null = null
  private steps = 64

  init(stage: ThreeStage) {
    const geom = new THREE.PlaneGeometry(8, 8, 1, 1)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDensity: { value: 0.6 }, uNoise: { value: 1.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.-1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uDensity; uniform float uNoise; float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); } float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.-2.*f); float n= mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); return n; } void main(){ vec2 uv=vUv; float t=uTime*0.2; float d=0.0; for(int i=0;i<64;i++){ float a=float(i)/64.0; vec2 p = uv*1.6 + vec2(cos(t+a*6.28), sin(t*1.2+a*6.28))*0.3; d += smoothstep(0.4, 0.0, length(p)); } d = d / 10.0; d += noise(vec3(uv*2.0, t))*0.5*uNoise; vec3 col = vec3(0.2,0.5,1.0)*d*uDensity; gl_FragColor = vec4(col, 0.9); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })
    this.mesh = new THREE.Mesh(geom, mat)
    this.mat = mat
    stage.scene.add(this.mesh)
  }

  setParams(p: Partial<LayerParams>) {
    if (typeof p['density'] === 'number') this.mat && (this.mat.uniforms.uDensity.value = p['density'] as number)
    if (typeof p['noiseScale'] === 'number') this.mat && (this.mat.uniforms.uNoise.value = p['noiseScale'] as number)
  }
  setPerfMode(on: boolean) { this.steps = on ? 32 : 64 }
  render(frame: StageFrame) { if (this.mat) this.mat.uniforms.uTime.value = frame.time }
  dispose() { this.mesh?.geometry.dispose(); this.mat?.dispose() }
}
