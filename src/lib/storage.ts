import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { put, get, del, list } from "@vercel/blob";

/**
 * All files (key visuals, generated images, PDFs, project data and the prompt
 * library) live in one Vercel Blob store. When no Blob store is connected and
 * we are running locally, files go to ./.data instead so the app can be tried
 * without any cloud setup.
 */

export class ConfigError extends Error {}

const blobConfigured = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
);
const access: "private" | "public" =
  process.env.BLOB_ACCESS === "public" ? "public" : "private";
const LOCAL_ROOT = path.join(process.cwd(), ".data");

function assertStorage() {
  if (!blobConfigured && process.env.VERCEL) {
    throw new ConfigError(
      "File storage isn't connected. In Vercel, open Storage, create a Blob store (Private) and connect it to this project, then redeploy.",
    );
  }
}

function localPath(p: string) {
  const resolved = path.join(LOCAL_ROOT, p);
  if (!resolved.startsWith(LOCAL_ROOT)) throw new Error("Invalid path");
  return resolved;
}

export async function writeFile(
  p: string,
  data: Buffer | string,
  contentType: string,
): Promise<void> {
  assertStorage();
  if (blobConfigured) {
    await put(p, data, {
      access,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return;
  }
  const file = localPath(p);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

/** Returns null when the file doesn't exist. */
export async function readFile(
  p: string,
  opts: { fresh?: boolean } = {},
): Promise<Buffer | null> {
  assertStorage();
  if (blobConfigured) {
    try {
      const res = await get(p, { access, useCache: !opts.fresh });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }
  try {
    return await fs.readFile(localPath(p));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function readJson<T>(p: string): Promise<T | null> {
  const buf = await readFile(p, { fresh: true });
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeJson(p: string, value: unknown) {
  await writeFile(p, JSON.stringify(value, null, 2), "application/json");
}

export interface ListedFile {
  path: string;
  uploadedAt: Date;
  size: number;
}

export async function listFiles(prefix: string): Promise<ListedFile[]> {
  assertStorage();
  if (blobConfigured) {
    const out: ListedFile[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, cursor, limit: 1000 });
      for (const b of res.blobs) {
        out.push({ path: b.pathname, uploadedAt: new Date(b.uploadedAt), size: b.size });
      }
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return out;
  }
  const root = localPath(prefix);
  const out: ListedFile[] = [];
  async function walk(dir: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const st = await fs.stat(full);
        out.push({
          path: path.relative(LOCAL_ROOT, full).split(path.sep).join("/"),
          uploadedAt: st.mtime,
          size: st.size,
        });
      }
    }
  }
  // prefix may be a folder ("projects/") or a partial name
  const base = prefix.endsWith("/") ? root : path.dirname(root);
  await walk(base);
  return out.filter((f) => f.path.startsWith(prefix));
}

/** Immediate child folders of a prefix, e.g. listFolders("projects/") -> ["projects/abc/"]. */
export async function listFolders(prefix: string): Promise<string[]> {
  assertStorage();
  if (blobConfigured) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, cursor, mode: "folded", limit: 1000 });
      out.push(...(res.folders ?? []));
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return out;
  }
  try {
    const entries = await fs.readdir(localPath(prefix), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => `${prefix}${e.name}/`);
  } catch {
    return [];
  }
}

export async function deleteFiles(paths: string[]) {
  if (!paths.length) return;
  assertStorage();
  if (blobConfigured) {
    for (let i = 0; i < paths.length; i += 500) {
      await del(paths.slice(i, i + 500));
    }
    return;
  }
  await Promise.all(paths.map((p) => fs.rm(localPath(p), { force: true })));
}

export async function deletePrefix(prefix: string) {
  const files = await listFiles(prefix);
  await deleteFiles(files.map((f) => f.path));
  if (!blobConfigured) {
    await fs.rm(localPath(prefix), { recursive: true, force: true });
  }
}

function isNotFound(e: unknown) {
  const name = (e as { name?: string })?.name ?? "";
  return name.includes("NotFound");
}

export function storageMode() {
  return blobConfigured ? `vercel-blob (${access})` : "local-folder";
}
