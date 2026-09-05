import sharp from 'sharp';

export interface ImageVariant {
  variant: 'preview' | 'editor' | 'export';
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
}

export interface OptimizeOptions {
  width: number;
  height: number;
  maxBytes: number;
  watermark?: boolean;
}

const encode = (pipeline: sharp.Sharp, maxBytes: number) =>
  pipeline.webp({ quality: maxBytes < 2_500_000 ? 82 : 88, effort: 4 }).toBuffer();

export async function optimizeImage(input: Buffer, options: OptimizeOptions): Promise<ImageVariant[]> {
  const base = sharp(input, { failOn: 'error' }).rotate();
  const exportPipeline = base.clone().resize(options.width, options.height, { fit: 'cover', position: 'centre' });
  let exportBuffer = await encode(exportPipeline, options.maxBytes);

  if (exportBuffer.byteLength > options.maxBytes) {
    const qualitySteps = [76, 68, 60, 52];
    for (const quality of qualitySteps) {
      exportBuffer = await base.clone().resize(options.width, options.height, { fit: 'cover', position: 'centre' }).webp({ quality, effort: 4 }).toBuffer();
      if (exportBuffer.byteLength <= options.maxBytes) break;
    }
  }

  const previewWidth = Math.min(1024, options.width);
  const editorWidth = Math.min(1600, options.width);
  const preview = await base.clone().resize(previewWidth, undefined, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 3 }).toBuffer();
  const editor = await base.clone().resize(editorWidth, undefined, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 3 }).toBuffer();
  const exportMeta = await sharp(exportBuffer).metadata();
  const previewMeta = await sharp(preview).metadata();
  const editorMeta = await sharp(editor).metadata();

  return [
    { variant: 'preview', buffer: preview, mimeType: 'image/webp', width: previewMeta.width ?? previewWidth, height: previewMeta.height ?? 0, byteSize: preview.byteLength },
    { variant: 'editor', buffer: editor, mimeType: 'image/webp', width: editorMeta.width ?? editorWidth, height: editorMeta.height ?? 0, byteSize: editor.byteLength },
    { variant: 'export', buffer: exportBuffer, mimeType: 'image/webp', width: exportMeta.width ?? options.width, height: exportMeta.height ?? options.height, byteSize: exportBuffer.byteLength },
  ];
}
