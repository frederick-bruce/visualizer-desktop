// Preset Manager with typed params, lifecycle, modulators, and crossfade rendering

export type Param = {
  name: string
  min: number
  max: number
  default: number
}

export type ParamValues = Record<string, number>

export type AnalysisLike = {
  rms?: number
  bass?: number
  mid?: number
  treble?: number
  tempoBPM?: number | null
  onset?: boolean
  bands?: number[]
}

export type FrameAPI = {
  time: number
  random(): number
  modulators: {
    lfo(name: string, opts?: { sync?: '1' | '1/2' | '1/4' | '2'; shape?: 'sine' | 'tri' | 'square'; phase?: number }): number
    env(name: 'rms' | 'bass' | 'mid' | 'treble'): number
  }
}

export type PresetContext = { ctx: CanvasRenderingContext2D; width: number; height: number }

export type VisualizationPreset = {
  id: string
  name: string
  params?: Record<string, Param>
  onEnter?: (ctx: PresetContext, params: ParamValues) => void
  onExit?: (ctx: PresetContext) => void
  onFrame: (ctx: PresetContext, analysis: AnalysisLike, api: FrameAPI, params: ParamValues) => void
}

type Registered = {
  def: VisualizationPreset
  values: ParamValues
}

// Simple RNG
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class PresetManager {
  private registry = new Map<string, Registered>()
  private currentId: string | null = null
  private prevId: string | null = null
  private fadeStart = 0
  private fadeDur = 0
  private rng = mulberry32(0xC0FFEE)
  // modulators state
  private envState = { rms: 0, bass: 0, mid: 0, treble: 0 }
  private lfoPhases = new Map<string, number>()
  // offscreen buffers
  private bufA: OffscreenCanvas | HTMLCanvasElement | null = null
  private bufB: OffscreenCanvas | HTMLCanvasElement | null = null
  private ctxA: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null
  private ctxB: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null
  // listeners for UI sync
  private listeners = new Set<() => void>()
  private entered = new Set<string>()

  register(p: VisualizationPreset) {
    const values: ParamValues = {}
    if (p.params) for (const [k, param] of Object.entries(p.params)) values[k] = param.default
    this.registry.set(p.id, { def: p, values })
    if (!this.currentId) this.currentId = p.id
    this.emit()
    return this
  }
  registerMany(list: VisualizationPreset[]) { list.forEach(p => this.register(p)); return this }

  getCurrentId() { return this.currentId }
  has(id: string) { return this.registry.has(id) }

  list() {
    return Array.from(this.registry.values()).map(r => ({
      id: r.def.id,
      name: r.def.name,
      params: r.def.params || {},
      values: { ...r.values }
    }))
  }

  getValues(id = this.currentId) {
    if (!id) return {}
    const r = this.registry.get(id); return r ? { ...r.values } : {}
  }

  setValue(key: string, value: number, id = this.currentId) {
    if (!id) return
    const r = this.registry.get(id); if (!r) return
    r.values[key] = value
    this.emit()
  }

  setValues(values: Partial<ParamValues>, id = this.currentId) {
    if (!id) return
    const r = this.registry.get(id); if (!r) return
    Object.assign(r.values, values)
    this.emit()
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  private emit() { this.listeners.forEach(fn => { try { fn() } catch {} }) }

  randomizeParams(id = this.currentId) {
    if (!id) return
    const reg = this.registry.get(id); if (!reg || !reg.def.params) return
    for (const [k, p] of Object.entries(reg.def.params)) {
      const r = this.rng()
      reg.values[k] = p.min + r * (p.max - p.min)
    }
    this.emit()
  }

  switchTo(id: string, ms: number = 700) {
    if (!this.registry.has(id) || id === this.currentId) return
    this.prevId = this.currentId
    this.currentId = id
    this.fadeStart = performance.now()
    this.fadeDur = Math.max(200, Math.min(2000, ms))
    this.emit()
  }

  private ensureBuffers(w: number, h: number) {
    const create = () => {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(w, h)
        const c2 = new OffscreenCanvas(w, h)
        return { c, c2, ctx: c.getContext('2d')!, ctx2: c2.getContext('2d')! }
      } else {
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const c2 = document.createElement('canvas'); c2.width = w; c2.height = h
        return { c, c2, ctx: c.getContext('2d')!, ctx2: c2.getContext('2d')! }
      }
    }
    if (!this.bufA || (this.bufA as any).width !== w || (this.bufA as any).height !== h) {
      const { c, c2, ctx, ctx2 } = create()
      this.bufA = c; this.bufB = c2; this.ctxA = ctx; this.ctxB = ctx2
    }
  }

  private updateEnvelopes(a: AnalysisLike) {
    const alpha = 0.25
    this.envState.rms = this.envState.rms + alpha * (((a.rms ?? 0) - this.envState.rms))
    this.envState.bass = this.envState.bass + alpha * (((a.bass ?? 0) - this.envState.bass))
    this.envState.mid = this.envState.mid + alpha * (((a.mid ?? 0) - this.envState.mid))
    this.envState.treble = this.envState.treble + alpha * (((a.treble ?? 0) - this.envState.treble))
  }

  private lfo(name: string, time: number, bpm?: number | null, opts?: { sync?: '1' | '1/2' | '1/4' | '2'; shape?: 'sine' | 'tri' | 'square'; phase?: number }) {
    const sync = opts?.sync ?? '1'
    const mult = sync === '2' ? 2 : sync === '1' ? 1 : sync === '1/2' ? 0.5 : 0.25
    const rateHz = bpm ? (bpm / 60) * mult : 1 * mult
    const phase0 = (opts?.phase ?? 0)
    const ph = (time * rateHz + phase0) % 1
    const shape = opts?.shape ?? 'sine'
    if (shape === 'sine') return 0.5 + 0.5 * Math.sin(ph * Math.PI * 2)
    if (shape === 'tri') return ph < 0.5 ? ph * 2 : 2 - ph * 2
    return ph < 0.5 ? 1 : 0 // square
  }

  render(targetCtx: CanvasRenderingContext2D, args: { width: number; height: number; time: number; analysis?: AnalysisLike }) {
    const { width: w, height: h, time } = args
    this.ensureBuffers(w, h)
    const a = (args.analysis || {})
    this.updateEnvelopes(a)
    const bpm = (a.tempoBPM ?? null)
    const api: FrameAPI = {
      time,
      random: () => this.rng(),
      modulators: {
        lfo: (name, opts) => this.lfo(name, time, bpm, opts),
        env: (name) => this.envState[name]
      }
    }
    const cur = this.currentId ? this.registry.get(this.currentId!) : null
    const prv = this.prevId ? this.registry.get(this.prevId!) : null
    const tctxA = this.ctxA!, tctxB = this.ctxB!
    // clear buffers
    tctxA.clearRect(0,0,w,h); tctxB.clearRect(0,0,w,h)
    // draw current
    if (cur) {
      if (cur.def.onEnter && !this.entered.has(cur.def.id) && !prv) {
        cur.def.onEnter({ ctx: tctxA as any, width: w, height: h }, cur.values)
        this.entered.add(cur.def.id)
      }
      cur.def.onFrame({ ctx: tctxA as any, width: w, height: h }, a, api, cur.values)
    }
    let alphaCur = 1, alphaPrev = 0
    if (prv) {
      // draw prev into B
      prv.def.onFrame({ ctx: tctxB as any, width: w, height: h }, a, api, prv.values)
      const now = performance.now()
      const t = Math.min(1, (now - this.fadeStart) / this.fadeDur)
      alphaCur = t
      alphaPrev = 1 - t
      if (t >= 1) {
        // fade done
        this.prevId = null
        prv.def.onExit?.({ ctx: tctxB as any, width: w, height: h })
        if (cur?.def.onEnter) {
          cur.def.onEnter({ ctx: tctxA as any, width: w, height: h }, cur.values)
          this.entered.add(cur.def.id)
        }
      }
    }
    // composite to target
    targetCtx.clearRect(0,0,w,h)
    if (alphaPrev > 0) {
      targetCtx.save(); targetCtx.globalAlpha = alphaPrev; targetCtx.drawImage(this.bufB as any, 0, 0, w, h); targetCtx.restore()
    }
    targetCtx.save(); targetCtx.globalAlpha = alphaCur; targetCtx.drawImage(this.bufA as any, 0, 0, w, h); targetCtx.restore()
  }
}

// --- Sample presets ---
const bars: VisualizationPreset = {
  id: 'bars', name: 'Bars',
  params: { barCount: { name: 'barCount', min: 16, max: 96, default: 48 }, hue: { name: 'hue', min: 0, max: 360, default: 140 } },
  onFrame({ ctx, width, height }, a, api, p) {
    const n = Math.round(p.barCount)
    const lfo = api.modulators.lfo('bars', { sync: '1/2', shape: 'sine' })
    ctx.fillStyle = 'black'; ctx.fillRect(0,0,width,height)
    for (let i=0;i<n;i++) {
      const x = (i + 0.5) * (width / n)
      const env = (a.bands && (a as any).bands[i % ((a as any).bands.length||1)]) || api.modulators.env('rms')
      const h = (env * 0.9 + lfo * 0.1) * height
      ctx.fillStyle = `hsl(${p.hue + i * 2}, 70%, ${40 + 30 * env}%)`
      ctx.fillRect(x - (width/n)*0.35, height - h, (width/n)*0.7, h)
    }
  }
}

const wave: VisualizationPreset = {
  id: 'wave', name: 'Wave',
  params: { thickness: { name: 'thickness', min: 1, max: 6, default: 2 }, hue: { name: 'hue', min: 0, max: 360, default: 200 } },
  onFrame({ ctx, width, height }, a, api, p) {
    ctx.fillStyle = 'black'; ctx.fillRect(0,0,width,height)
    const rows = 3
    for (let r=0;r<rows;r++) {
      const l = api.modulators.lfo('wave'+r, { sync: r===0?'1': r===1?'1/2':'1/4', shape: 'sine', phase: r*0.33 })
      ctx.beginPath()
      for (let x=0;x<width;x++) {
        const t = (x/width)*Math.PI*4 + l*Math.PI*2
        const y = height*0.5 + Math.sin(t) * height*0.2 * (0.7 + 0.6*api.modulators.env('mid'))
        if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      ctx.strokeStyle = `hsla(${p.hue + r*40},80%,60%,${0.5 + 0.5*api.modulators.env('treble')})`
      ctx.lineWidth = p.thickness
      ctx.stroke()
    }
  }
}

const particles: VisualizationPreset = {
  id: 'particles', name: 'Particles',
  params: { count: { name: 'count', min: 50, max: 500, default: 180 } },
  onEnter({ ctx, width, height }, p) {
    // allocate a particle field on ctx as a property
    const anyCtx = ctx as any
    const count = Math.round(p.count)
    const rng = mulberry32(123)
    anyCtx.__particles = new Array(count).fill(0).map(()=>({
      x: rng()*width, y: rng()*height, vx: (rng()-0.5)*0.6, vy: (rng()-0.5)*0.6, life: rng()*1
    }))
  },
  onFrame({ ctx, width, height }, a, api, p) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0,0,width,height)
    const anyCtx = ctx as any; const parts = anyCtx.__particles as any[]
    const boost = 0.5 + api.modulators.env('bass')
    parts.forEach(pt => {
      pt.x += pt.vx * boost; pt.y += pt.vy * boost
      if (pt.x < 0) pt.x += width; if (pt.x > width) pt.x -= width
      if (pt.y < 0) pt.y += height; if (pt.y > height) pt.y -= height
      pt.life += 0.01
      const a = 0.3 + 0.7 * (1 - (pt.life % 1))
      ctx.fillStyle = `hsla(${200 + 80*Math.sin(pt.life*6.28)}, 80%, 60%, ${a})`
      ctx.fillRect(pt.x, pt.y, 2, 2)
    })
  }
}

// New: Nebula Pulse (LiquidMesh bg + Particles fg; stutter bloom on strong onset)
const nebulaPulse: VisualizationPreset = {
  id: 'nebula', name: 'Nebula Pulse',
  params: {
    swirl: { name: 'swirl', min: 0, max: 1, default: 0.6 },
    particleCount: { name: 'particleCount', min: 80, max: 600, default: 220 },
    bloom: { name: 'bloom', min: 0, max: 1, default: 0.35 },
  },
  onEnter({ ctx, width, height }, p) {
    const any = ctx as any
    const rng = mulberry32(321)
    const count = Math.round(p.particleCount)
    any.__nebulaParts = new Array(count).fill(0).map(() => ({
      x: rng()*width, y: rng()*height, a: rng()*Math.PI*2, s: 0.5 + rng()*1.5
    }))
    any.__lastBloom = 0
  },
  onFrame({ ctx, width, height }, a, api, p) {
    // Liquid mesh background via layered sin fields
    const t = api.time
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, 'hsl(260,50%,8%)')
    bg.addColorStop(1, 'hsl(200,50%,6%)')
    ctx.fillStyle = bg; ctx.fillRect(0,0,width,height)
    const cells = 60
    for (let i=0;i<=cells;i++) {
      const y = (i/cells)*height
      const l = 0.35 + 0.15*Math.sin(t*0.4 + i*0.25)
      ctx.fillStyle = `hsla(${200 + 40*Math.sin(i*0.12 + t*0.2)},60%,${(l*100)|0}%,0.15)`
      const wob = Math.sin(i*0.3 + t*0.9) * 12 * (0.5 + api.modulators.env('mid'))
      ctx.fillRect(0, y + wob, width, 3)
    }
    // Particles foreground
    const any = ctx as any; const parts = (any.__nebulaParts ||= [])
    const centerX = width*0.5, centerY = height*0.5
    const swirl = p.swirl
    ctx.globalCompositeOperation = 'lighter'
    parts.forEach((pt: any, idx: number) => {
      const radius = 30 + 220 * api.modulators.env('bass') + (idx%10)
      pt.a += 0.004 * pt.s * (1 + api.modulators.env('treble'))
      const r = radius + 40*Math.sin(pt.a*2 + t*0.6)
      pt.x = centerX + Math.cos(pt.a + swirl*0.8) * r
      pt.y = centerY + Math.sin(pt.a + swirl*0.7) * r
      const apha = 0.5 + 0.5*api.modulators.env('rms')
      ctx.fillStyle = `hsla(${200 + 80*Math.sin(pt.a + t*0.3)},80%,60%,${apha})`
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.8 + 1.2*api.modulators.env('treble'), 0, Math.PI*2); ctx.fill()
    })
    ctx.globalCompositeOperation = 'source-over'
    // Stutter bloom on onset (rate-limited to ~150ms)
    const now = performance.now()
    const onset = (a.onset && (now - ((any.__lastBloom)||0) > 150))
    if (onset) any.__lastBloom = now
    const bloomAmt = onset ? 1 : Math.max(0, 1 - (now - (any.__lastBloom||0))/250)
    if (bloomAmt > 0) {
      const passes = 2 + Math.round(2 * bloomAmt * (p.bloom))
      for (let i=1;i<=passes;i++) {
        const scale = 1 + i*0.02
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.06 * bloomAmt; ctx.filter = `blur(${2*i}px)`
        ctx.drawImage((ctx.canvas as any), (width - width*scale)/2, (height - height*scale)/2, width*scale, height*scale)
        ctx.restore(); ctx.filter = 'none'
      }
    }
  }
}

// New: Astro Bars (Rings only; quantize to 1/2 notes; elastic ease on beat scale)
const astroBars: VisualizationPreset = {
  id: 'astro', name: 'Astro Bars',
  params: {
    rings: { name: 'rings', min: 3, max: 16, default: 8 },
    hue: { name: 'hue', min: 0, max: 360, default: 40 },
  },
  onFrame({ ctx, width, height }, a, api, p) {
    ctx.fillStyle = 'black'; ctx.fillRect(0,0,width,height)
    const cx = width/2, cy = height/2
    const n = Math.round(p.rings)
    const bpm = a.tempoBPM || 120
    const secPerBeat = 60 / bpm
    const beatPhase = (api.time / secPerBeat) % 1
    // Quantize to 1/2 notes
    const q = beatPhase < 0.5 ? 0 : 0.5
    const easeOutElastic = (x: number) => {
      const c4 = (2 * Math.PI) / 3
      return x === 0
        ? 0
        : x === 1
        ? 1
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
    }
    const scaleBeat = easeOutElastic(q)
    for (let i=0;i<n;i++) {
      const f = i/(n-1)
      const radius = 20 + f * Math.min(cx, cy) * 0.9 * (0.9 + 0.2*scaleBeat)
      const strength = (a.bands && a.bands[i % (a.bands.length||1)]) || api.modulators.env('rms')
      ctx.beginPath()
      for (let ang=0; ang<=Math.PI*2 + 0.01; ang+=0.035) {
        const r = radius + Math.sin(ang*4 + api.time*2) * 4 * strength
        const x = cx + Math.cos(ang) * r
        const y = cy + Math.sin(ang) * r
        if (ang===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      ctx.strokeStyle = `hsla(${p.hue + i*10}, 80%, ${40 + 30*strength}%, 0.85)`
      ctx.lineWidth = 1.2 + 1.5*strength
      ctx.stroke()
    }
  }
}

// New: Chromatic Tunnel (Waveform tube over RMS history; tunnel stretches with BPM)
const chromaticTunnel: VisualizationPreset = {
  id: 'tunnel', name: 'Chromatic Tunnel',
  params: {
    history: { name: 'history', min: 50, max: 400, default: 160 },
    hueShift: { name: 'hueShift', min: 0, max: 360, default: 0 },
  },
  onEnter({ ctx, width, height }, p) {
    const any = ctx as any
    any.__hist = new Array(Math.round(p.history)).fill(0)
  },
  onFrame({ ctx, width, height }, a, api, p) {
    const any = ctx as any
    const hist: number[] = (any.__hist ||= new Array(Math.round(p.history)).fill(0))
    // update history with current rms
    hist.push(Math.min(1, Math.max(0, a.rms ?? api.modulators.env('rms'))))
    while (hist.length > Math.round(p.history)) hist.shift()
    ctx.fillStyle = 'hsl(230,40%,6%)'; ctx.fillRect(0,0,width,height)
    const bpm = a.tempoBPM || 120
    const stretch = 0.7 + (bpm/180)*0.6
    const centerX = width/2
    for (let i=0;i<hist.length;i++) {
      const t = i/(hist.length-1)
      const amp = hist[hist.length-1-i]
      const w = (1 - t) * width * 0.9
      const h = (1 - t) * height * 0.9 * (0.8 + 0.4*amp) * stretch
      const hue = (p.hueShift + 300*t + 40*amp) % 360
      ctx.strokeStyle = `hsla(${hue}, 90%, ${30 + 50*(1-t)}%, ${0.15 + 0.55*(1-t)})`
      ctx.lineWidth = 1 + 3*(1-t)
      ctx.beginPath()
      const steps = 64
      for (let s=0;s<=steps;s++) {
        const a1 = (s/steps)*Math.PI*2
        const rx = w*0.5 + Math.sin(a1*3 + api.time*2)*3*amp
        const ry = h*0.5 + Math.cos(a1*2 + api.time*1.5)*3*amp
        const x = centerX + Math.cos(a1) * rx
        const y = height/2 + Math.sin(a1) * ry
        if (s===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      }
      ctx.closePath(); ctx.stroke()
    }
  }
}

export const presets = new PresetManager().registerMany([
  bars, wave, particles,
  nebulaPulse, astroBars, chromaticTunnel
])
