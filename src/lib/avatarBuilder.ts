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
