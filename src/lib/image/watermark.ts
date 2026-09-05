import sharp from 'sharp';

export async function applyWatermark(input: Buffer, text = 'SOLAMENTIS') {
  const meta = await sharp(input).metadata();
  const imageWidth = meta.width ?? 800;
  const width = Math.min(420, imageWidth);
  const margin = Math.max(16, Math.round(imageWidth * 0.025));
  const safeText = text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character);
  const svg = Buffer.from(`<svg width="${width}" height="96" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(0,0,0,0.30)" rx="18"/><text x="50%" y="62" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="white" letter-spacing="5">${safeText}</text></svg>`);

  return sharp(input)
    .composite([{ input: svg, left: Math.max(0, imageWidth - width - margin), top: Math.max(0, (meta.height ?? 96) - 96 - margin) }])
    .webp({ quality: 92, effort: 4 })
    .toBuffer();
}
