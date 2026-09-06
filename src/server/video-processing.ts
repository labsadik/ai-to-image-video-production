import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

function escapeDrawtext(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/,/g, '\\,');
}

async function runFfmpeg(args: string[]) {
  const binary = ffmpegPath;
  if (!binary) throw new Error('FFmpeg binary is unavailable');
  try {
    await execFileAsync(binary, args, { maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String((error as { stderr?: unknown }).stderr ?? '') : '';
    const message = error instanceof Error ? error.message : 'FFmpeg execution failed';
    throw new Error(`FFmpeg failed: ${message}${stderr ? `: ${stderr.slice(-1800)}` : ''}`);
  }
}

export async function processVideoOutput(input: Buffer, options: {
  watermarkText?: string | null;
  quality: 'standard' | 'high_end';
}) {
  const id = randomUUID();
  const dir = await fs.mkdtemp(path.join(tmpdir(), `solamentis-video-${id}-`));
  const inputPath = path.join(dir, 'input.mp4');
  const outputPath = path.join(dir, 'output.mp4');
  try {
    await fs.writeFile(inputPath, input);
    const crf = options.quality === 'high_end' ? '18' : '21';
    const bitrate = options.quality === 'high_end' ? '10M' : '5M';
    const filters = options.watermarkText
      ? `drawtext=text='${escapeDrawtext(options.watermarkText)}':x=w-tw-28:y=h-th-28:fontsize=28:fontcolor=white@0.88:box=1:boxcolor=black@0.32:boxborderw=12`
      : undefined;
    const args = ['-y', '-i', inputPath, ...(filters ? ['-vf', filters] : []), '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', options.quality === 'high_end' ? 'slow' : 'medium', '-crf', crf, '-maxrate', bitrate, '-bufsize', options.quality === 'high_end' ? '20M' : '10M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath];
    await runFfmpeg(args);
    const output = await fs.readFile(outputPath);
    return { buffer: output, mimeType: 'video/mp4', byteSize: output.byteLength };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractVideoFrame(input: Buffer) {
  const id = randomUUID();
  const dir = await fs.mkdtemp(path.join(tmpdir(), `solamentis-video-frame-${id}-`));
  const inputPath = path.join(dir, 'input.mp4');
  const outputPath = path.join(dir, 'frame.jpg');
  try {
    await fs.writeFile(inputPath, input);
    await runFfmpeg(['-y', '-i', inputPath, '-frames:v', '1', '-q:v', '3', outputPath]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
