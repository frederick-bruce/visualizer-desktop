export type HSL = { h: number; s: number; l: number }

export const Palettes = {
  EmeraldPulse: [
    { h: 150, s: 70, l: 52 },
    { h: 158, s: 68, l: 48 },
    { h: 166, s: 66, l: 46 },
    { h: 172, s: 60, l: 50 },
  ] as HSL[],
  ElectricViolet: [
    { h: 270, s: 80, l: 55 },
    { h: 282, s: 78, l: 52 },
    { h: 292, s: 76, l: 50 },
    { h: 305, s: 70, l: 54 },
  ] as HSL[],
  AmberHeat: [
    { h: 30, s: 85, l: 54 },
    { h: 40, s: 88, l: 56 },
    { h: 28, s: 90, l: 50 },
    { h: 16, s: 80, l: 48 },
  ] as HSL[],
  AquaWave: [
    { h: 190, s: 70, l: 52 },
    { h: 200, s: 68, l: 50 },
    { h: 186, s: 65, l: 48 },
    { h: 174, s: 62, l: 50 },
  ] as HSL[],
  MagentaStorm: [
    { h: 320, s: 78, l: 56 },
    { h: 330, s: 80, l: 54 },
    { h: 340, s: 75, l: 52 },
    { h: 350, s: 70, l: 50 },
  ] as HSL[],
  ClassicWMP: [
    // green -> yellow -> cyan sweep
    { h: 140, s: 80, l: 50 },
    { h: 80, s: 85, l: 55 },
    { h: 60, s: 90, l: 55 },
    { h: 190, s: 70, l: 50 },
  ] as HSL[],
} as const

export type PaletteName = keyof typeof Palettes

export function hslToRgb({ h, s, l }: HSL): [number, number, number] {
  const ss = s/100, ll = l/100
  const c = (1 - Math.abs(2*ll - 1)) * ss
  const x = c * (1 - Math.abs(((h/60) % 2) - 1))
  const m = ll - c/2
  let [r,g,b] = [0,0,0]
  if (h < 60) [r,g,b] = [c,x,0]
  else if (h < 120) [r,g,b] = [x,c,0]
  else if (h < 180) [r,g,b] = [0,c,x]
  else if (h < 240) [r,g,b] = [0,x,c]
  else if (h < 300) [r,g,b] = [x,0,c]
  else [r,g,b] = [c,0,x]
  return [ (r+m), (g+m), (b+m) ]
}

export class ColorCycler {
  private idx = 0
  private t = 0
  private palette: HSL[]
  constructor(palette: HSL[] = Palettes.ClassicWMP) {
    this.palette = palette
  }
  setPalette(p: HSL[]) { this.palette = p; this.idx = 0; this.t = 0 }
  pick(i: number) { return this.palette[i % this.palette.length] }
  // Map band energies to hue drift and saturation boost; on onset push gamma lift
  sample(angle01: number, energy: { low: number; mid: number; high: number; onset?: boolean }): { color: [number,number,number]; boost: number } {
    const base = this.pick(Math.floor(angle01 * this.palette.length))
    const satBoost = 1 + 0.4 * (energy.high*0.6 + energy.mid*0.3 + energy.low*0.1)
    const hueDrift = (energy.mid - energy.low) * 30 // degrees
    const h = (base.h + hueDrift + 360) % 360
    const s = Math.min(100, base.s * satBoost)
    const l = base.l
    let rgb = hslToRgb({ h, s, l })
    const boost = energy.onset ? 0.15 : 0
    if (boost > 0) {
      // gamma lift
      rgb = rgb.map(c => Math.pow(c, 0.85)) as any
    }
    return { color: rgb as [number,number,number], boost }
  }
}

export const AlbumPalette = {
  async extract(_url: string): Promise<HSL[]> {
    // Placeholder hook (no network/IO here). In app, image->canvas->kmeans(5)
    return Palettes.ClassicWMP
  }
}
