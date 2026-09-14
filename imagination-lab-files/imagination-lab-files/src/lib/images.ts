import "server-only";
import sharp from "sharp";
import type { AspectRatio } from "./types";

export async function imageSize(buf: Buffer) {
  const m = await sharp(buf).metadata();
  // Respect EXIF rotation so width/height match what people see.
  const rotated = m.orientation && m.orientation >= 5;
  const width = (rotated ? m.height : m.width) ?? 0;
  const height = (rotated ? m.width : m.height) ?? 0;
  return { width, height, format: m.format };
}

/** Cleans up an uploaded key visual: fixes rotation, caps size, keeps it a format Gemini accepts. */
export async function normalizeKeyVisual(buf: Buffer) {
  const meta = await sharp(buf).metadata();
  const img = sharp(buf).rotate().resize({
    width: 3072,
    height: 3072,
    fit: "inside",
    withoutEnlargement: true,
  });
  const keepPng = meta.format === "png" && buf.length < 6_000_000;
  const data = keepPng
    ? await img.png({ compressionLevel: 8 }).toBuffer()
    : await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  const size = await imageSize(data);
  return {
    data,
    mime: keepPng ? "image/png" : "image/jpeg",
    ext: keepPng ? "png" : "jpg",
    width: size.width,
    height: size.height,
  };
}

/** Smaller JPEG for sending to the quality-check model. */
export async function forModel(buf: Buffer, maxDim = 1536) {
  const data = await sharp(buf)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { data, mime: "image/jpeg" };
}

/** JPEG sized for the tool kit PDF. */
export async function forPdf(buf: Buffer, maxDim = 2200) {
  const out = await sharp(buf)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

export function ratioToNumber(r: AspectRatio) {
  const [w, h] = r.split(":").map(Number);
  return w / h;
}

/**
 * Stand-in image used when MOCK_AI is on, so the whole flow can be tested
 * without spending Gemini credit. Crops the key visual to the POSM shape.
 */
export async function mockImage(kv: Buffer, aspectRatio: AspectRatio, label: string, n: number) {
  const ratio = ratioToNumber(aspectRatio);
  const height = 1024;
  const width = Math.round(height * ratio);
  const hues = [0, 35, -35, 70];
  const base = await sharp(kv)
    .rotate()
    .resize({ width, height, fit: "cover", position: ["centre", "left", "right", "top"][n % 4] as "centre" })
    .modulate({ hue: hues[(n - 1) % hues.length], saturation: 1.05 })
    .toBuffer();
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - 120}" width="${width}" height="120" fill="#390983" opacity="0.85"/>
      <text x="${width / 2}" y="${height - 48}" font-family="sans-serif" font-size="48" font-weight="700"
        fill="#FDCE5C" text-anchor="middle">MOCK ${escapeXml(label)} ${n}</text>
    </svg>`,
  );
  return sharp(base).composite([{ input: svg }]).png().toBuffer();
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
