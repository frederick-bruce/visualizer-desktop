import * as THREE from 'three'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class LiquidMesh implements StageLayer {
  id = 'LiquidMesh'
  private mesh: THREE.Mesh | null = null
  private mat: THREE.ShaderMaterial | null = null
  private chromatic = 0.001

  init(stage: ThreeStage) {
    const geom = new THREE.SphereGeometry(1.8, 144, 96)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uAmpL: { value: 0 }, uAmpM: { value: 0 }, uAmpH: { value: 0 }, uChrom: { value: this.chromatic }
      },
      vertexShader: `
        uniform float uTime; uniform float uAmpL; uniform float uAmpM; uniform float uAmpH; varying float vAmp;
        float n3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          vec3 p = position;
          float b = sin(p.x*1.6 + uTime*0.8)*0.5 + 0.5;
          float m = sin(p.y*1.8 + uTime*1.1)*0.5 + 0.5;
          float t = sin(p.z*2.0 + uTime*1.4)*0.5 + 0.5;
          float amp = b*uAmpL + m*uAmpM + t*uAmpH;
          p += normal * amp * 0.5;
          vAmp = amp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAmp; uniform float uChrom;
        vec3 tonemap(vec3 c){ return c/(c+vec3(1.0)); }
        void main(){
          float l = 0.45 + vAmp*0.7;
          vec3 col = vec3(0.2,0.4,1.0) * (0.6 + vAmp*1.4);
          col = tonemap(col);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false
    })
    mat.depthWrite = true
    this.mesh = new THREE.Mesh(geom, mat)
    this.mat = mat
    stage.scene.add(this.mesh)
  }
  setParams(_p: Partial<LayerParams>) {}
  setPerfMode(on: boolean) { /* geometry already high LOD; could reduce segments if needed */ }
  render(frame: StageFrame) {
    if (!this.mesh || !this.mat) return
    this.mat.uniforms.uTime.value = performance.now()*0.001
    this.mat.uniforms.uAmpL.value = frame.bass ?? 0
    this.mat.uniforms.uAmpM.value = frame.mid ?? 0
    this.mat.uniforms.uAmpH.value = frame.treble ?? 0
  }
  dispose() { this.mesh?.geometry.dispose(); this.mat?.dispose() }
}
