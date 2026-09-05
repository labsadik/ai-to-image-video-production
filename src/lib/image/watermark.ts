import sharp from 'sharp';

export async function applyWatermark(input: Buffer, text = 'SOLAMENTIS') {
  const svg = Buffer.from(`<svg width="420" height="96" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(0,0,0,0.30)" rx="18"/><text x="210" y="62" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="white" letter-spacing="5">${text}</text></svg>`);
  const meta = await sharp(input).metadata();
  const width = Math.min(420, meta.width ?? 420);
  const watermark = width === 420 ? svg : await sharp(svg).resize(width).png().toBuffer();
  const margin = Math.max(16, Math.round((meta.width ?? 800) * 0.025));
  return sharp(input).composite([{ input: watermark, gravity: 'southeast' }]).jpeg({ quality: 92 }).toBuffer();
}

void margin;
