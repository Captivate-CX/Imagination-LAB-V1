import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "./storage";
import { forPdf } from "./images";
import { projectTitle, type ProjectState, type Variant } from "./types";

// Page geometry matches the sample tool kit (16:9 slides, 960 x 540 pt).
const W = 960;
const H = 540;
const PURPLE = rgb(57 / 255, 9 / 255, 131 / 255);
const WHITE = rgb(1, 1, 1);

const asset = (...p: string[]) => path.join(process.cwd(), "assets", ...p);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fit(imgW: number, imgH: number, box: Box, align: "center" | "left" = "center") {
  const scale = Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = align === "left" ? box.x : box.x + (box.w - w) / 2;
  return { x, y: box.y + (box.h - h) / 2, width: w, height: h };
}

/** Wraps text into lines no wider than maxWidth. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function londonDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", ...opts }).format(d);
}

async function embedImage(doc: PDFDocument, storagePath: string) {
  const raw = await readFile(storagePath);
  if (!raw) return null;
  const jpg = await forPdf(raw);
  return doc.embedJpg(jpg.data);
}

export async function buildToolkitPdf(state: ProjectState) {
  const { project } = state;
  const [templateBytes, headingBytes, bodyBytes] = await Promise.all([
    fs.readFile(asset("template", "til-template.pdf")),
    fs.readFile(asset("fonts", "Heading.ttf")),
    fs.readFile(asset("fonts", "Poppins-Regular.ttf")),
  ]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const heading = await doc.embedFont(headingBytes, { subset: true });
  const body = await doc.embedFont(bodyBytes, { subset: true });
  const [coverBg, innerBg, closingBg] = await doc.embedPdf(templateBytes, [0, 1, 2]);

  const title = projectTitle(project);
  doc.setTitle(`${title} - Imagination Lab tool kit`);
  doc.setAuthor("Captivate Imagination Lab");
  doc.setCreationDate(new Date());

  const now = new Date();
  let pageNo = 1;

  // 1. Cover
  {
    const page = doc.addPage([W, H]);
    page.drawPage(coverBg, { x: 0, y: 0, width: W, height: H });
    let size = 40;
    let lines = wrap(title, heading, size, 500);
    while (lines.length > 3 && size > 24) {
      size -= 2;
      lines = wrap(title, heading, size, 500);
    }
    const lineHeight = size * 1.1;
    lines.forEach((line, i) => {
      const y = 93 + (lines.length - 1 - i) * lineHeight;
      page.drawText(line, { x: 430, y, size, font: heading, color: WHITE });
    });
    const dateText = `Imaginated on the ${londonDate(now, { day: "2-digit", month: "2-digit", year: "numeric" })}`;
    const dw = body.widthOfTextAtSize(dateText, 10.6);
    page.drawText(dateText, { x: 935.4 - dw, y: 14, size: 10.6, font: body, color: WHITE });
  }

  const innerPage = (label: string) => {
    const page = doc.addPage([W, H]);
    pageNo++;
    page.drawPage(innerBg, { x: 0, y: 0, width: W, height: H });
    page.drawText(label, { x: 22.5, y: 497, size: 28, font: heading, color: PURPLE });
    const num = String(pageNo);
    page.drawText(num, { x: 949.6 - body.widthOfTextAtSize(num, 12), y: 12, size: 12, font: body, color: PURPLE });
    return page;
  };

  // 2. Key visual
  {
    const page = innerPage("Key Visual");
    const img = await embedImage(doc, project.kv.path);
    if (img) page.drawImage(img, fit(img.width, img.height, { x: 22, y: 70, w: 788, h: 364 }, "left"));
  }

  // 3. One page per POSM type
  const skipped: string[] = [];
  for (const a of project.assets) {
    const s = state.assets[a.id];
    const done = (s?.variants ?? []).filter((v): v is Variant => v?.status === "done" && Boolean(v.imagePath));
    const chosen = s?.selection ? done.find((v) => v.n === s.selection!.n) : undefined;

    let toPlace: Variant[] = [];
    if (project.toolkit.layout === "all") {
      // Chosen design sits in the middle, like the sample tool kit.
      const others = done.filter((v) => v !== chosen);
      toPlace = chosen ? [others[0], chosen, ...others.slice(1)].filter(Boolean) : done;
    } else if (chosen) {
      toPlace = [chosen];
    }
    if (!toPlace.length) {
      skipped.push(a.name);
      continue;
    }

    const page = innerPage(a.name);
    await placeImages(doc, page, toPlace);
  }

  // 4. Closing page
  {
    const page = doc.addPage([W, H]);
    page.drawPage(closingBg, { x: 0, y: 0, width: W, height: H });
    const text = `Imaginated ${londonDate(now, { month: "long", year: "numeric" })}`;
    page.drawText(text, { x: 34.7, y: 83, size: 28, font: heading, color: WHITE });
  }

  const data = Buffer.from(await doc.save());
  return { data, pages: doc.getPageCount(), skipped };
}

async function placeImages(doc: PDFDocument, page: PDFPage, variants: Variant[]) {
  const images = (await Promise.all(variants.map((v) => embedImage(doc, v.imagePath!)))).filter(
    (i): i is NonNullable<typeof i> => Boolean(i),
  );
  if (images.length === 1) {
    // Keep clear of the logo in the top-right corner.
    const img = images[0];
    page.drawImage(img, fit(img.width, img.height, { x: 60, y: 30, w: 740, h: 410 }));
    return;
  }
  const area: Box = { x: 40, y: 35, w: 860, h: 380 };
  const gap = 24;
  const colW = (area.w - gap * (images.length - 1)) / images.length;
  images.forEach((img, i) => {
    page.drawImage(img, fit(img.width, img.height, { x: area.x + i * (colW + gap), y: area.y, w: colW, h: area.h }));
  });
}
