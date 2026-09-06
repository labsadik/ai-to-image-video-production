import sharp, { type Sharp } from 'sharp';

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

const BACKGROUND = { r: 248, g: 250, b: 252, alpha: 1 };
const encode = (pipeline: Sharp, maxBytes: number) =>
  pipeline.webp({ quality: maxBytes < 2_500_000 ? 82 : 88, effort: 4 }).toBuffer();

function fitCanvas(input: Sharp, width: number, height: number) {
  return input.resize(width, height, {
    fit: 'contain',
    position: 'centre',
    background: BACKGROUND,
  });
}

export async function optimizeImage(input: Buffer, options: OptimizeOptions): Promise<ImageVariant[]> {
  const base = sharp(input, { failOn: 'error' }).rotate();
  let exportBuffer = await encode(fitCanvas(base.clone(), options.width, options.height), options.maxBytes);

  if (exportBuffer.byteLength > options.maxBytes) {
    const qualitySteps = [76, 68, 60, 52];
    for (const quality of qualitySteps) {
      exportBuffer = await fitCanvas(base.clone(), options.width, options.height).webp({ quality, effort: 4 }).toBuffer();
      if (exportBuffer.byteLength <= options.maxBytes) break;
    }
  }

  const previewWidth = Math.min(1024, options.width);
  const editorWidth = Math.min(1600, options.width);
  const previewHeight = Math.max(1, Math.round(previewWidth * options.height / options.width));
  const editorHeight = Math.max(1, Math.round(editorWidth * options.height / options.width));
  const preview = await fitCanvas(base.clone(), previewWidth, previewHeight).webp({ quality: 76, effort: 3 }).toBuffer();
  const editor = await fitCanvas(base.clone(), editorWidth, editorHeight).webp({ quality: 82, effort: 3 }).toBuffer();
  const exportMeta = await sharp(exportBuffer).metadata();
  const previewMeta = await sharp(preview).metadata();
  const editorMeta = await sharp(editor).metadata();

  return [
    { variant: 'preview', buffer: preview, mimeType: 'image/webp', width: previewMeta.width ?? previewWidth, height: previewMeta.height ?? previewHeight, byteSize: preview.byteLength },
    { variant: 'editor', buffer: editor, mimeType: 'image/webp', width: editorMeta.width ?? editorWidth, height: editorMeta.height ?? editorHeight, byteSize: editor.byteLength },
    { variant: 'export', buffer: exportBuffer, mimeType: 'image/webp', width: exportMeta.width ?? options.width, height: exportMeta.height ?? options.height, byteSize: exportBuffer.byteLength },
  ];
}
