import type { ImageMetadata } from 'astro';

const projectImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/projects/**/*.{png,jpg,jpeg,webp,avif}',
  { eager: true }
);

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?.*)?$/i;

export function isVideoSrc(src: string): boolean {
  return VIDEO_EXT_RE.test(src.trim());
}

export function getMediaType(src: string): 'image' | 'video' {
  return isVideoSrc(src) ? 'video' : 'image';
}

export function isImageMetadata(
  value: ImageMetadata | string | undefined
): value is ImageMetadata {
  return typeof value === 'object' && value !== null && 'src' in value;
}

export function resolveProjectImage(
  src?: string
): ImageMetadata | string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  let normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith('projects/')) {
    normalized = `src/assets/${normalized}`;
  }
  const globKey = `/${normalized}`;
  const matched = projectImages[globKey];
  if (matched?.default) {
    return matched.default;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
