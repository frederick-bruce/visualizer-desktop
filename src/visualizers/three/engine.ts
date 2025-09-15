import * as THREE from 'three'

// Simplified Three.js context for the new minimal engine
export interface ThreeContext {
  canvas: HTMLCanvasElement
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  resize(w: number, h: number, dpr: number): void
  render(): void
  dispose(): void
}

export function createThreeContext(): ThreeContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const canvas = renderer.domElement
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0, 0, 6)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(3,5,4)
  scene.add(dir)

  function resize(w: number, h: number, dpr: number) {
    camera.aspect = w / Math.max(1,h)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
  }

  function render() { renderer.render(scene, camera) }

  function dispose() {
    renderer.dispose()
    const parent = canvas.parentElement
    if (parent) parent.removeChild(canvas)
  }

  return { canvas, scene, camera, renderer, resize, render, dispose }
}

