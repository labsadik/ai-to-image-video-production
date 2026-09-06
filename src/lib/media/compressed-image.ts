import sharp from 'sharp';

export const MAX_STORAGE_IMAGE_BYTES = 8_000_000;
export const STORAGE_IMAGE_MAX_WIDTH = 1920;
export const STORAGE_IMAGE_MAX_HEIGHT = 1920;
export const STORAGE_IMAGE_QUALITY = 78;

export async function compressImageForStorage(input: Buffer, options?: { maxBytes?: number; maxWidth?: number; maxHeight?: number; quality?: number }) {
  const maxBytes = options?.maxBytes ?? MAX_STORAGE_IMAGE_BYTES;
  const maxWidth = options?.maxWidth ?? STORAGE_IMAGE_MAX_WIDTH;
  const maxHeight = options?.maxHeight ?? STORAGE_IMAGE_MAX_HEIGHT;
  const quality = options?.quality ?? STORAGE_IMAGE_QUALITY;

  const attempts = [
    { width: maxWidth, height: maxHeight, quality },
    { width: 1600, height: 1600, quality: Math.min(74, quality) },
    { width: 1440, height: 1440, quality: 68 },
    { width: 1280, height: 1280, quality: 62 },
  ];

  let lastBuffer: Buffer | null = null;
  for (const attempt of attempts) {
    const buffer = await sharp(input, { failOn: 'error', animated: false })
      .rotate()
      .resize({ width: attempt.width, height: attempt.height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: attempt.quality, effort: 4 })
      .toBuffer();
    lastBuffer = buffer;
    if (buffer.byteLength <= maxBytes) {
      const metadata = await sharp(buffer).metadata();
      return {
        buffer,
        mimeType: 'image/webp' as const,
        byteSize: buffer.byteLength,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        quality: attempt.quality,
      };
    }
  }

  throw new Error(`Image could not be compressed below ${Math.round(maxBytes / 1024 / 1024)} MB (final size ${Math.round((lastBuffer?.byteLength ?? 0) / 1024 / 1024)} MB)`);
}
