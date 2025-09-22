import * as THREE from 'three'
import { VisualizationPlugin } from './types'

// Utility helpers
function bandAverage(fft: Uint8Array, start: number, end: number) {
  let sum = 0; const s = Math.max(0,start), e = Math.min(fft.length,end); for(let i=s;i<e;i++) sum += fft[i]; return sum/Math.max(1,e-s)
}

export const musicalColors: VisualizationPlugin = (() => {
  let root: THREE.Group | null = null
  let shell: THREE.Mesh<THREE.IcosahedronGeometry, THREE.ShaderMaterial> | null = null
  let orbiters: THREE.InstancedMesh | null = null
  let orbitData: Float32Array | null = null
  let hueShift = 0
  const tmpColor = new THREE.Color()

  const vertexShader = /* glsl */`
    uniform float u_time; uniform float u_bass; uniform float u_treb; uniform float u_mid; uniform float u_beat;
    varying float vDist;
    // 3D noise (simple hash-based)
    float hash(vec3 p){ return fract(sin(dot(p,vec3(23.17, 8.33, 113.1)))*43758.5453); }
    float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f); float n=0.0; for(int dx=0;dx<2;dx++) for(int dy=0;dy<2;dy++) for(int dz=0;dz<2;dz++){ vec3 o=vec3(dx,dy,dz); n+=mix(0.0,1.0,hash(i+o))* (1.0-abs(o.x-f.x))* (1.0-abs(o.y-f.y))* (1.0-abs(o.z-f.z)); } return n; }
    void main(){
      float disp = noise(normal*2.5 + u_time*0.6) * (0.35 + u_treb*1.1) + u_bass*0.25;
      vec3 pos = position + normal * disp * (0.6 + u_beat*0.8);
      vDist = disp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
    }
  `
  const fragmentShader = /* glsl */`
    varying float vDist; uniform float u_time; uniform float u_hue; uniform float u_bass; uniform float u_mid; uniform float u_treb; uniform float u_beat;
    vec3 hsl2rgb(vec3 hsl){
      float h=hsl.x, s=hsl.y, l=hsl.z; float c=(1.-abs(2.*l-1.))*s; float hp=mod(h*6.,6.); float x=c*(1.-abs(mod(hp,2.)-1.)); vec3 rgb=hp<1.?vec3(c,x,0.):hp<2.?vec3(x,c,0.):hp<3.?vec3(0.,c,x):hp<4.?vec3(0.,x,c):hp<5.?vec3(x,0.,c):vec3(c,0.,x); float m=l-0.5*c; return rgb+m; }
    void main(){
      float glow = smoothstep(0.0,1.2,vDist*1.5) + u_beat*0.6;
      float hue = u_hue + vDist*0.15 + u_mid*0.05;
      float sat = 0.55 + u_treb*0.45;
      float val = 0.45 + u_bass*0.55 + glow*0.2;
      vec3 col = hsl2rgb(vec3(fract(hue), sat, val));
      col += glow*0.35;
      gl_FragColor = vec4(col,1.0);
    }
  `

  return {
    async initialize(ctx) {
      root = new THREE.Group(); ctx.scene.add(root)
      ctx.camera.position.set(0,0,5)
      // Core shell
      const geo = new THREE.IcosahedronGeometry(1.2, 5)
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 }, u_bass: { value: 0 }, u_mid: { value: 0 }, u_treb: { value: 0 }, u_beat: { value: 0 }, u_hue: { value: 0 }
        },
        vertexShader, fragmentShader,
        transparent: false
      })
      shell = new THREE.Mesh(geo, mat)
      root.add(shell)
      // Orbiting instanced spheres
      const orbCount = 600
      const orbGeo = new THREE.SphereGeometry(0.03, 8, 8)
      const orbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x111111, roughness: 0.4, metalness: 0.2 })
      orbiters = new THREE.InstancedMesh(orbGeo, orbMat, orbCount)
      orbitData = new Float32Array(orbCount * 4)
      for (let i=0;i<orbCount;i++) {
        const r = 1.6 + Math.random()*0.6
        const theta = Math.random()*Math.PI*2
        const speed = 0.4 + Math.random()*0.8
        const tilt = (Math.random()*0.8 - 0.4)
        orbitData.set([r, theta, speed, tilt], i*4)
      }
      root.add(orbiters)
    },
    renderFrame({ fft, dt, time, beat, bass, mid, treb, intensity, beatPhase, barPhase, chorus, chroma, pitchHz, pitchConf }) {
      if (!shell || !shell.material || !orbiters || !orbitData) return
      const mat = shell.material
      // Fallback if extended metrics undefined
      const b = bass ?? (bandAverage(fft, 0, fft.length*0.1|0) / 255)
  const mVal = mid  ?? (bandAverage(fft, fft.length*0.1|0, fft.length*0.4|0) / 255)
  const t = treb ?? (bandAverage(fft, fft.length*0.4|0, fft.length) / 255)
  const inten = intensity ?? (b*0.5 + mVal*0.3 + t*0.2)
      // Melody-aware hue: base drift + chroma-weighted tone angle + subtle pitch wobble
      const chromaHue = Array.isArray(chroma) && chroma.length >= 12
        ? (chroma.reduce((acc, v, i) => acc + v * (i / 12), 0) / Math.max(1e-6, chroma.reduce((a,b)=>a+b,0)))
        : 0
      const pitchWobble = (typeof pitchHz === 'number' && typeof pitchConf === 'number') ? (Math.sin(time * (pitchHz/20)) * 0.005 * Math.min(1, Math.max(0, pitchConf))) : 0
      hueShift += dt * (0.05 + t*0.4 + (chorus?0.2:0)) + chromaHue * 0.02 + pitchWobble
      const uniforms = mat.uniforms as any
      uniforms.u_time.value = time
      uniforms.u_bass.value = b
  uniforms.u_mid.value = mVal
      uniforms.u_treb.value = t
      uniforms.u_beat.value = beat ? 1 : Math.max(0, uniforms.u_beat.value * Math.exp(-dt/0.25))
      uniforms.u_hue.value = hueShift
      // Scale & slight rotation
  const barMod = barPhase !== undefined ? (0.4 + 0.6*Math.sin(barPhase*Math.PI*2)) : 1
      shell.rotation.y += dt * (0.2 + mVal*1.2) * barMod
      shell.rotation.x += dt * (0.1 + t*0.8)
      // Slightly enlarge with high pitch confidence to reflect melodic clarity
      const pitchScale = (typeof pitchConf === 'number') ? (0.05 * Math.min(1, Math.max(0, pitchConf))) : 0
      const targetScale = 1.0 + b*0.5 + (beat?0.25:0) + (chorus?0.15:0) + pitchScale
      shell.scale.lerp(new THREE.Vector3(targetScale,targetScale,targetScale), 1 - Math.exp(-dt/0.25))
      // Update orbiters
  const mat4 = new THREE.Matrix4()
      for (let i=0;i<orbitData.length;i+=4) {
        let r = orbitData[i]
  let ang = orbitData[i+1] + time * orbitData[i+2] * (0.5 + mVal)
        const tilt = orbitData[i+3]
        if (beat) r += b*0.3
        const x = Math.cos(ang)*r
        const y = tilt * 0.6 + Math.sin(ang*2)*0.05
        const z = Math.sin(ang)*r
  mat4.setPosition(x,y,z)
  orbiters.setMatrixAt(i/4, mat4)
        // color shift by index & treble
        const beatFlash = beat ? 0.15 : 0
        const chorusLift = chorus ? 0.2 : 0
        tmpColor.setHSL((hueShift*0.2 + (i/4)/orbiters.count + t*0.3) % 1, 0.6 + t*0.3 + chorusLift*0.2, 0.45 + b*0.4 + beatFlash + chorusLift)
        orbiters.setColorAt(i/4, tmpColor)
      }
      orbiters.instanceMatrix.needsUpdate = true
      if ((orbiters as any).instanceColor) (orbiters as any).instanceColor.needsUpdate = true
    },
    dispose() {
      if (root) {
        root.traverse((o: any) => {
          if (o.isMesh) {
            o.geometry?.dispose?.()
            if (Array.isArray(o.material)) o.material.forEach((mm:any)=>mm.dispose())
            else o.material?.dispose?.()
          }
        })
      }
      root = null; shell = null; orbiters = null; orbitData = null
    }
  }
})()

export default musicalColors
