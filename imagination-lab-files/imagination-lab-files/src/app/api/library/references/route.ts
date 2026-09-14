import { randomBytes } from "crypto";
import sharp from "sharp";
import { writeFile } from "@/lib/storage";
import { respond } from "@/lib/http";
import type { ReferenceImage } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Uploads a reference template (e.g. a blank display unit drawing) for a POSM type. */
export async function POST(req: Request) {
  return respond(async (): Promise<ReferenceImage> => {
    const form = await req.formData();
    const file = form.get("file");
    const label = String(form.get("label") || "").trim();
    if (!(file instanceof File)) throw new Error("Choose an image file.");
    const input = Buffer.from(await file.arrayBuffer());
    const png = await sharp(input)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const id = randomBytes(4).toString("hex");
    const path = `library/refs/${id}.png`;
    await writeFile(path, png, "image/png");
    return { id, label: label || file.name, path };
  });
}
