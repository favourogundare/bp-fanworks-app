// Avatar builder (MILESTONES §7): composable cartoon avatars via DiceBear's
// open-source avataaars style — "the Reddit look" without commissioning art.
// Everything renders locally (no external API); the result is rasterized to a
// PNG and pushed through the existing uploadAvatar pipeline, so the deliberate
// SVG ban on the public bucket (scripts) stays intact and no schema changes.
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

// Part pickers exposed in the UI. Option lists come from the style's own
// schema so they can never drift from what the library accepts.
export const AVATAR_PARTS = ['top', 'skinColor', 'hairColor', 'clothing', 'eyes', 'mouth'] as const
export type AvatarPart = (typeof AVATAR_PARTS)[number]

const schema: any = (avataaars as any).schema.properties
export function avatarPartOptions(part: AvatarPart): string[] {
  const p = schema[part]
  // Shape parts enumerate under items.enum; color parts only carry their
  // palette as the schema default (free-form hex strings).
  return (p?.items?.enum ?? p?.enum ?? p?.default ?? []) as string[]
}

// Friendly display names for option values. Colors are raw hex in the schema
// and some shape names are in-jokes ("theCaesar"), so those are hand-mapped;
// everything else falls back to a camelCase → sentence-case humanizer.
const OPTION_LABELS: Record<string, string> = {
  // skin tones
  '614335': 'Deep brown',
  'ae5d29': 'Brown',
  'd08b5b': 'Tan',
  'edb98a': 'Light',
  'ffdbb4': 'Pale',
  'fd9841': 'Golden',
  'f8d25c': 'Yellow',
  // hair colors
  'a55728': 'Auburn',
  '2c1b18': 'Black',
  'b58143': 'Blonde',
  'd6b370': 'Golden blonde',
  '724133': 'Brown',
  '4a312c': 'Dark brown',
  'f59797': 'Pastel pink',
  'ecdcbf': 'Platinum',
  'c93305': 'Red',
  'e8e1e1': 'Silver gray',
  // hair / hats
  frida: 'Frida braids',
  froBand: 'Fro with headband',
  miaWallace: 'Mia Wallace bob',
  theCaesar: 'Caesar cut',
  theCaesarAndSidePart: 'Caesar with side part',
  straightAndStrand: 'Straight with strand',
  // clothing
  graphicShirt: 'Graphic tee',
  overall: 'Overalls',
  shirtCrewNeck: 'Crew neck shirt',
  shirtScoopNeck: 'Scoop neck shirt',
  shirtVNeck: 'V-neck shirt',
  // eyes / mouth
  default: 'Normal',
  hearts: 'Heart eyes',
  side: 'Side glance',
  winkWacky: 'Wacky wink',
  xDizzy: 'Dizzy (X eyes)',
  cry: 'Crying',
  screamOpen: 'Screaming',
}

// "shortWaved" → "Short waved", "winterHat02" → "Winter hat 2"
function humanize(value: string): string {
  const words = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1')
    .trim()
    .split(/\s+/)
    .map((w) => (/^\d+$/.test(w) ? String(Number(w)) : w.toLowerCase()))
  const label = words.join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function avatarOptionLabel(value: string): string {
  return OPTION_LABELS[value] ?? humanize(value)
}

// seed drives everything not explicitly picked; '' picks = fully seed-random.
export interface AvatarConfig {
  seed: string
  parts: Partial<Record<AvatarPart, string>>
}

export function buildAvatarSvg(cfg: AvatarConfig): string {
  const options: Record<string, unknown> = { seed: cfg.seed, size: 256 }
  for (const [k, v] of Object.entries(cfg.parts)) {
    if (v) options[k] = [v] // DiceBear takes arrays of allowed values
  }
  return createAvatar(avataaars, options as any).toString()
}

export function avatarPreviewUri(cfg: AvatarConfig): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(buildAvatarSvg(cfg))}`
}

/** Rasterize the avatar to a 256px PNG File for the standard avatar upload. */
export function buildAvatarPng(cfg: AvatarConfig): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.drawImage(img, 0, 0, 256, 256)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Couldn't render the avatar"))
        resolve(new File([blob], 'built-avatar.png', { type: 'image/png' }))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error("Couldn't render the avatar"))
    img.src = avatarPreviewUri(cfg)
  })
}

export function randomAvatarSeed(): string {
  return crypto.randomUUID()
}
