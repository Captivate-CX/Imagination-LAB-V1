import { promises as fs } from "fs";
import nodePath from "path";
import { readFile } from "@/lib/storage";
import { mimeFromName } from "@/lib/library";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Serves stored files to the browser. Files are private in Blob storage, so
 * everything the UI shows comes through here.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { path } = await params;
  const p = path.map(decodeURIComponent).join("/");
  if (p.includes("..")) return new Response("Not found", { status: 404 });

  let data: Buffer | null = null;
  if (p.startsWith("builtin/")) {
    // Reference templates shipped with the app, e.g. the blank FSDU unit.
    const file = p.slice("builtin/".length).replace(/[^a-zA-Z0-9._-]/g, "");
    data = await fs.readFile(nodePath.join(process.cwd(), "assets", "references", file)).catch(() => null);
  } else if (p.startsWith("projects/") || p.startsWith("library/refs/")) {
    data = await readFile(p);
  }
  if (!data) return new Response("Not found", { status: 404 });

  const ext = p.split(".").pop()?.toLowerCase();
  const type = ext === "pdf" ? "application/pdf" : ext === "json" ? "application/json" : mimeFromName(p);
  const download = new URL(req.url).searchParams.get("download");
  const headers: Record<string, string> = {
    "Content-Type": type,
    // File names include a random part, so a stored file never changes.
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  if (download) {
    const safe = download.replace(/[^\w\s.\-()]/g, "").slice(0, 120) || "download";
    headers["Content-Disposition"] = `attachment; filename="${safe}"`;
  }
  return new Response(new Uint8Array(data), { headers });
}
