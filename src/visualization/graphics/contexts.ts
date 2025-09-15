import * as THREE from 'three'
import { ThreeGraphicsContext, Canvas2DGraphicsContext } from '../types'

// Helper to create a Three.js graphics context
export function createThreeGraphicsContext(): ThreeGraphicsContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0,0,5)
  const amb = new THREE.AmbientLight(0xffffff, 0.4); scene.add(amb)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(3,5,4); scene.add(dir)
  return { kind: 'three', scene, camera, renderer, canvas }
}

export function createCanvas2DGraphicsContext(): Canvas2DGraphicsContext {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  return { kind: 'canvas2d', canvas, ctx }
}
