import sharp from 'sharp';

export interface OptimizedImage {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
  byteSize: number;
}

export interface OptimizeOptions {
  width: number;
  height: number;
  maxBytes: number;
}

function targetSize(width: number, height: number) {
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

export async function optimizeImage(input: Buffer, options: OptimizeOptions): Promise<OptimizedImage> {
  const source = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await source.metadata();
  const sourceWidth = metadata.width ?? options.width;
  const sourceHeight = metadata.height ?? options.height;
  const target = targetSize(options.width, options.height);

  // Keep the image's real composition. Never pad and never crop important content.
  // Resize only when the source exceeds the requested canvas bounds, preserving aspect ratio.
  const shouldResize = sourceWidth > target.width || sourceHeight > target.height;
  const pipeline = shouldResize
    ? source.resize(target.width, target.height, { fit: 'inside', withoutEnlargement: true })
    : source;

  const encode = (quality: number) => pipeline.clone().webp({ quality, effort: 5 }).toBuffer();
  let buffer = await encode(options.maxBytes < 2_500_000 ? 88 : 92);

  if (buffer.byteLength > options.maxBytes) {
    for (const quality of [84, 78, 72, 66, 60]) {
      buffer = await encode(quality);
      if (buffer.byteLength <= options.maxBytes) break;
    }
  }

  const finalMetadata = await sharp(buffer).metadata();
  return {
    buffer,
    mimeType: 'image/webp',
    width: finalMetadata.width ?? sourceWidth,
    height: finalMetadata.height ?? sourceHeight,
    byteSize: buffer.byteLength,
  };
}
