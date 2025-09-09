import { getDominantColorFromUrl } from '@/lib/color'

// Spacing scale guidance (not enforced here): 12 / 16 / 24 px

// Radii
export const radius = {
  lg: 'rounded-[16px]',
  xl: 'rounded-[24px]',
} as const

// Elevations (subtle, dark theme friendly)
export const elevations = {
  sm: 'shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
  md: 'shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
} as const

// CSS variable accessors for dynamic accent
export const accentCssVar = 'var(--accent-dynamic, var(--accent))'

export function setAccent(hex?: string | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!hex) {
    root.style.removeProperty('--accent-dynamic')
    return
  }
  root.style.setProperty('--accent-dynamic', hex)
}

export async function deriveAccentFromArt(url?: string | null) {
  if (!url) {
    setAccent(null)
    return null
  }
  try {
    const hex = await getDominantColorFromUrl(url)
    setAccent(hex)
    return hex
  } catch {
    // fall back to default accent
    setAccent(null)
    return null
  }
}

// Small class-name helpers for consistent styling
export function card() {
  return [
    'border border-white/10',
    'bg-white/5',
    'backdrop-blur-sm',
    radius.lg,
    elevations.sm,
  ].join(' ')
}

export function pill(active = false) {
  const base = [
    'px-3', 'py-1.5', 'text-sm', 'rounded-full',
    'border', 'transition-smooth',
  ]
  const on = [
    'bg-[var(--accent-dynamic)]', 'text-black', 'border-black/10',
  ]
  const off = [
    'bg-white/5', 'text-white', 'border-white/10', 'hover:bg-white/10',
  ]
  return [...base, ...(active ? on : off)].join(' ')
}

export function panel() {
  return [
    'border border-white/10',
    'bg-white/5',
    'backdrop-blur-sm',
    radius.xl,
    elevations.md,
  ].join(' ')
}
