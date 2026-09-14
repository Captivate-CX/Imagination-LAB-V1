import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { defaultLibrary } from "./defaults";
import { listFiles, readFile, readJson, writeJson, deleteFiles } from "./storage";
import type { Library, ReferenceImage } from "./types";
import { ASPECT_RATIOS, IMAGE_SIZES } from "./types";

const CURRENT = "library/current.json";
const HISTORY_PREFIX = "library/history/";
const HISTORY_KEEP = 40;

export async function getLibrary(): Promise<Library> {
  const saved = await readJson<Library>(CURRENT);
  if (!saved) return defaultLibrary();
  // Fill in any settings added in later versions of the app.
  const defaults = defaultLibrary();
  return { ...saved, settings: { ...defaults.settings, ...saved.settings } };
}

export function validateLibrary(input: unknown): Library {
  const lib = input as Library;
  if (!lib || !Array.isArray(lib.assetTypes)) throw new Error("Prompt library is missing POSM types.");
  if (typeof lib.qcPrompt !== "string" || !lib.qcPrompt.trim())
    throw new Error("The quality check prompt can't be empty.");
  const ids = new Set<string>();
  for (const a of lib.assetTypes) {
    if (!a.id || ids.has(a.id)) throw new Error(`POSM type "${a.name}" needs a unique id.`);
    ids.add(a.id);
    if (!a.name?.trim()) throw new Error("Every POSM type needs a name.");
    if (!a.prompt?.trim()) throw new Error(`The ${a.name} prompt can't be empty.`);
    if (!ASPECT_RATIOS.includes(a.aspectRatio)) throw new Error(`${a.name} has an unsupported aspect ratio.`);
    a.references = (a.references ?? []).filter((r: ReferenceImage) => r.path && r.label);
  }
  const s = lib.settings;
  if (!s?.imageModel?.trim() || !s?.qcModel?.trim()) throw new Error("Both model names are required.");
  if (!IMAGE_SIZES.includes(s.imageSize)) s.imageSize = "2K";
  s.variantsPerAsset = Math.min(4, Math.max(2, Math.round(Number(s.variantsPerAsset) || 3)));
  return lib;
}

export async function saveLibrary(next: Library, note?: string): Promise<Library> {
  // The first save also keeps the starting prompts as a version, so they can always be restored.
  const previous = (await readJson<Library>(CURRENT)) ?? defaultLibrary();
  {
    const stamp = previous.updatedAt.replace(/[:.]/g, "-");
    await writeJson(`${HISTORY_PREFIX}${stamp}.json`, previous);
  }
  const saved: Library = { ...next, updatedAt: new Date().toISOString(), note: note?.slice(0, 140) };
  await writeJson(CURRENT, saved);
  await pruneHistory();
  return saved;
}

export async function listHistory() {
  const files = await listFiles(HISTORY_PREFIX);
  files.sort((a, b) => b.path.localeCompare(a.path));
  const items = await Promise.all(
    files.slice(0, HISTORY_KEEP).map(async (f) => {
      const lib = await readJson<Library>(f.path);
      return lib
        ? { path: f.path, updatedAt: lib.updatedAt, note: lib.note ?? "", assetCount: lib.assetTypes.length }
        : null;
    }),
  );
  return items.filter(Boolean);
}

export async function restoreHistory(p: string) {
  if (!p.startsWith(HISTORY_PREFIX)) throw new Error("Unknown version.");
  const lib = await readJson<Library>(p);
  if (!lib) throw new Error("That version no longer exists.");
  return saveLibrary(lib, `Restored version from ${new Date(lib.updatedAt).toLocaleString("en-GB")}`);
}

async function pruneHistory() {
  const files = await listFiles(HISTORY_PREFIX);
  files.sort((a, b) => b.path.localeCompare(a.path));
  await deleteFiles(files.slice(HISTORY_KEEP).map((f) => f.path));
}

/** Loads a reference image, either bundled with the app or uploaded by the team. */
export async function loadReference(ref: ReferenceImage): Promise<{ data: Buffer; mime: string }> {
  if (ref.path.startsWith("builtin:")) {
    const file = ref.path.slice("builtin:".length).replace(/[^a-zA-Z0-9._-]/g, "");
    const data = await fs.readFile(path.join(process.cwd(), "assets", "references", file));
    return { data, mime: mimeFromName(file) };
  }
  const data = await readFile(ref.path);
  if (!data) throw new Error(`Reference image "${ref.label}" is missing. Re-upload it in the prompt library.`);
  return { data, mime: mimeFromName(ref.path) };
}

export function mimeFromName(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
