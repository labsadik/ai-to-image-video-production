const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 6_000_000;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The image could not be decoded.')); };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not create a compressed WebP image.')), 'image/webp', quality);
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) throw new Error('Image must be between 1 byte and 25 MB.');

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the image for upload.');
  context.drawImage(image, 0, 0, width, height);

  const attempts = [
    { quality: 0.78, multiplier: 1 },
    { quality: 0.72, multiplier: 0.9 },
    { quality: 0.66, multiplier: 0.8 },
    { quality: 0.60, multiplier: 0.7 },
  ];

  for (const attempt of attempts) {
    const attemptCanvas = document.createElement('canvas');
    attemptCanvas.width = Math.max(1, Math.round(width * attempt.multiplier));
    attemptCanvas.height = Math.max(1, Math.round(height * attempt.multiplier));
    const attemptContext = attemptCanvas.getContext('2d');
    if (!attemptContext) continue;
    attemptContext.drawImage(canvas, 0, 0, attemptCanvas.width, attemptCanvas.height);
    const blob = await canvasToBlob(attemptCanvas, attempt.quality);
    if (blob.size <= MAX_OUTPUT_BYTES || attempt === attempts[attempts.length - 1]) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'upload'}.webp`, { type: 'image/webp', lastModified: file.lastModified });
    }
  }

  throw new Error('The image could not be compressed for upload.');
}
