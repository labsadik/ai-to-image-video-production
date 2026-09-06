import sharp from 'sharp';

export const MEDIA_PREVIEW_MAX_WIDTH = 640;
export const MEDIA_PREVIEW_QUALITY = 60;

export async function createMediaPreview(input: Buffer, options?: { maxWidth?: number; quality?: number }) {
  const maxWidth = options?.maxWidth ?? MEDIA_PREVIEW_MAX_WIDTH;
  const quality = options?.quality ?? MEDIA_PREVIEW_QUALITY;
  const preview = await sharp(input, { failOn: 'error', animated: false })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
  const metadata = await sharp(preview).metadata();
  return {
    buffer: preview,
    mimeType: 'image/webp' as const,
    byteSize: preview.byteLength,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}
