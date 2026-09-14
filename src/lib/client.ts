"use client";

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: usually a platform timeout page.
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ??
      (res.status === 504
        ? "The request timed out. Try again, or lower the image size in Prompt library settings."
        : `Request failed (${res.status}).`);
    throw new Error(msg);
  }
  return data as T;
}

/** URL for a stored file. Reference templates bundled with the app use "builtin:" paths. */
export function fileUrl(path: string, download?: string) {
  const p = path.startsWith("builtin:") ? `builtin/${path.slice(8)}` : path;
  const url = `/api/files/${p.split("/").map(encodeURIComponent).join("/")}`;
  return download ? `${url}?download=${encodeURIComponent(download)}` : url;
}

/**
 * Keeps uploads under Vercel's 4.5 MB request limit: large images are
 * re-encoded as high-quality JPEG with the longest side capped at 3072px.
 */
export async function prepareUpload(file: File): Promise<File> {
  const MAX_BYTES = 4_000_000;
  const MAX_SIDE = 3072;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file couldn't be opened as an image. Use JPG, PNG or WebP.");
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (file.size <= MAX_BYTES && longest <= MAX_SIDE && /image\/(png|jpeg|webp)/.test(file.type)) {
    bitmap.close();
    return file;
  }
  let scale = Math.min(1, MAX_SIDE / longest);
  for (let quality = 0.92; quality >= 0.7; quality -= 0.07) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) {
      bitmap.close();
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    scale *= 0.85;
  }
  bitmap.close();
  throw new Error("That image is too large even after compressing. Try a smaller export.");
}

export function daysLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Runs async jobs with a cap on how many run at once. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    queue.shift()!();
  };
  return function limit<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        job()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
