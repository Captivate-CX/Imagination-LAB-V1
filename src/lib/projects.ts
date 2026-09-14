import "server-only";
import { randomBytes } from "crypto";
import {
  readFile,
  readJson,
  writeFile,
  writeJson,
  deleteFiles,
  deletePrefix,
  listFolders,
  listFiles,
} from "./storage";
import { getLibrary, loadReference } from "./library";
import { MOCK_AI, generateImage, runQualityCheck, normaliseQc, type InputImage } from "./gemini";
import { forModel, imageSize, mockImage, normalizeKeyVisual } from "./images";
import { buildToolkitPdf } from "./pdf";
import {
  projectTitle,
  type AssetState,
  type Library,
  type Project,
  type ProjectState,
  type ProjectSummary,
  type QcResult,
  type Selection,
  type ToolkitLayout,
  type Variant,
} from "./types";

export const RETENTION_DAYS = Math.max(1, Number(process.env.RETENTION_DAYS) || 30);

export class NotFoundError extends Error {}

const rand = (bytes = 5) => randomBytes(bytes).toString("hex");
const base = (id: string) => `projects/${id}/`;
const projectFile = (id: string) => `${base(id)}project.json`;
const assetDir = (id: string, assetId: string) => `${base(id)}assets/${assetId}/`;
const variantFile = (id: string, assetId: string, n: number) => `${assetDir(id, assetId)}v${n}.json`;
const qcFile = (id: string, assetId: string) => `${assetDir(id, assetId)}qc.json`;
const selectionFile = (id: string, assetId: string) => `${assetDir(id, assetId)}selection.json`;

function checkId(id: string) {
  if (!/^[a-z0-9]{6,32}$/.test(id)) throw new NotFoundError("Project not found.");
}
function checkAssetId(assetId: string) {
  if (!/^[a-z0-9-]{1,48}$/.test(assetId)) throw new Error("Unknown POSM type.");
}

export async function getProject(id: string): Promise<Project> {
  checkId(id);
  const p = await readJson<Project>(projectFile(id));
  if (!p) throw new NotFoundError("This project doesn't exist, or it has passed its 30-day limit and was deleted.");
  return p;
}

export async function createProject(input: {
  kv: Buffer;
  brand: string;
  campaign: string;
  assetIds: string[];
}): Promise<Project> {
  const lib = await getLibrary();
  const assets = input.assetIds
    .map((aid) => lib.assetTypes.find((a) => a.id === aid))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ id: a.id, name: a.name, aspectRatio: a.aspectRatio }));
  if (!assets.length) throw new Error("Choose at least one POSM type.");

  const kv = await normalizeKeyVisual(input.kv);
  const id = rand(6);
  const now = new Date();
  const kvPath = `${base(id)}kv-${rand(3)}.${kv.ext}`;
  await writeFile(kvPath, kv.data, kv.mime);

  const project: Project = {
    id,
    brand: input.brand.trim().slice(0, 80),
    campaign: input.campaign.trim().slice(0, 120),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString(),
    kv: { path: kvPath, width: kv.width, height: kv.height, mime: kv.mime },
    assets,
    toolkit: { layout: "chosen" },
  };
  await writeJson(projectFile(id), project);
  return project;
}

export async function updateProject(
  id: string,
  patch: { brand?: string; campaign?: string; layout?: ToolkitLayout; addAssetId?: string; removeAssetId?: string },
) {
  const p = await getProject(id);
  if (typeof patch.brand === "string") p.brand = patch.brand.trim().slice(0, 80);
  if (typeof patch.campaign === "string") p.campaign = patch.campaign.trim().slice(0, 120);
  if (patch.layout === "chosen" || patch.layout === "all") p.toolkit.layout = patch.layout;
  if (patch.addAssetId && !p.assets.some((a) => a.id === patch.addAssetId)) {
    const lib = await getLibrary();
    const a = lib.assetTypes.find((x) => x.id === patch.addAssetId);
    if (!a) throw new Error("That POSM type isn't in the prompt library.");
    p.assets.push({ id: a.id, name: a.name, aspectRatio: a.aspectRatio });
  }
  if (patch.removeAssetId) {
    p.assets = p.assets.filter((a) => a.id !== patch.removeAssetId);
    checkAssetId(patch.removeAssetId);
    await deletePrefix(assetDir(id, patch.removeAssetId));
  }
  await writeJson(projectFile(id), p);
  return p;
}

async function variantCount(lib?: Library) {
  return (lib ?? (await getLibrary())).settings.variantsPerAsset;
}

async function readAssetState(id: string, assetId: string, count: number): Promise<AssetState> {
  const nums = Array.from({ length: count }, (_, i) => i + 1);
  const [variants, qc, selection] = await Promise.all([
    Promise.all(nums.map((n) => readJson<Variant>(variantFile(id, assetId, n)))),
    readJson<QcResult>(qcFile(id, assetId)),
    readJson<Selection>(selectionFile(id, assetId)),
  ]);
  return { variants, qc, selection };
}

export async function getState(id: string): Promise<ProjectState> {
  const project = await getProject(id);
  const count = await variantCount();
  const entries = await Promise.all(
    project.assets.map(async (a) => [a.id, await readAssetState(id, a.id, count)] as const),
  );
  return { project, assets: Object.fromEntries(entries) };
}

export async function deleteProject(id: string) {
  checkId(id);
  await deletePrefix(base(id));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const folders = await listFolders("projects/");
  const now = Date.now();
  const results = await Promise.all(
    folders.map(async (folder) => {
      const id = folder.slice("projects/".length).replace(/\/$/, "");
      const p = await readJson<Project>(`${folder}project.json`);
      if (!p) return null;
      if (new Date(p.expiresAt).getTime() < now) {
        await deletePrefix(folder).catch(() => {});
        return null;
      }
      return {
        id,
        title: projectTitle(p),
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        kvPath: p.kv.path,
        assetNames: p.assets.map((a) => a.name),
        hasPdf: Boolean(p.toolkit.pdf),
      } satisfies ProjectSummary;
    }),
  );
  return results
    .filter((r): r is ProjectSummary => Boolean(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Deletes projects past their retention date, plus half-created folders. Returns how many were removed. */
export async function cleanupExpired() {
  const folders = await listFolders("projects/");
  const now = Date.now();
  let removed = 0;
  for (const folder of folders) {
    const p = await readJson<Project>(`${folder}project.json`);
    let expired = false;
    if (p) expired = new Date(p.expiresAt).getTime() < now;
    else {
      const files = await listFiles(folder);
      const newest = Math.max(0, ...files.map((f) => f.uploadedAt.getTime()));
      expired = now - newest > 86_400_000;
    }
    if (expired) {
      await deletePrefix(folder);
      removed++;
    }
  }
  return removed;
}

async function loadKv(project: Project): Promise<InputImage> {
  const data = await readFile(project.kv.path);
  if (!data) throw new Error("The key visual file is missing.");
  return { label: "Brand Key Visual (KV)", mime: project.kv.mime, data };
}

export async function generateVariant(id: string, assetId: string, n: number): Promise<Variant> {
  checkAssetId(assetId);
  const [project, lib] = await Promise.all([getProject(id), getLibrary()]);
  if (!project.assets.some((a) => a.id === assetId)) throw new Error("That POSM type isn't part of this project.");
  if (!Number.isInteger(n) || n < 1 || n > lib.settings.variantsPerAsset) throw new Error("Unknown design number.");
  const assetType = lib.assetTypes.find((a) => a.id === assetId);
  if (!assetType) throw new Error("This POSM type was removed from the prompt library, so it can't be generated.");

  const started = Date.now();
  const previous = await readJson<Variant>(variantFile(id, assetId, n));
  const model = MOCK_AI ? "mock" : lib.settings.imageModel;
  let variant: Variant;

  try {
    const kv = await loadKv(project);
    let out: { data: Buffer; mime: string; notes: string };
    if (MOCK_AI) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1600));
      out = { data: await mockImage(kv.data, assetType.aspectRatio, assetType.name, n), mime: "image/png", notes: "" };
    } else {
      const refs = await Promise.all(
        assetType.references.map(async (r) => ({ ...(await loadReference(r)), label: `"${r.label}" (reference template)` })),
      );
      out = await generateImage({
        model,
        prompt: assetType.prompt,
        images: [kv, ...refs],
        aspectRatio: assetType.aspectRatio,
        imageSize: lib.settings.imageSize,
      });
    }
    const ext = out.mime === "image/jpeg" ? "jpg" : out.mime === "image/webp" ? "webp" : "png";
    const imagePath = `${assetDir(id, assetId)}v${n}-${rand(4)}.${ext}`;
    await writeFile(imagePath, out.data, out.mime);
    const size = await imageSize(out.data);
    variant = {
      n,
      status: "done",
      imagePath,
      width: size.width,
      height: size.height,
      modelNotes: out.notes || undefined,
      model,
      promptUpdatedAt: lib.updatedAt,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    variant = {
      n,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      model,
      promptUpdatedAt: lib.updatedAt,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }

  await writeJson(variantFile(id, assetId, n), variant);
  if (previous?.imagePath) await deleteFiles([previous.imagePath]).catch(() => {});
  // The old quality check and pick no longer describe what's on screen.
  await deleteFiles([qcFile(id, assetId), selectionFile(id, assetId)]).catch(() => {});
  return variant;
}

function fillPlaceholders(prompt: string, values: Record<string, string>) {
  return prompt.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
}

export async function qualityCheck(id: string, assetId: string) {
  checkAssetId(assetId);
  const [project, lib] = await Promise.all([getProject(id), getLibrary()]);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("That POSM type isn't part of this project.");
  const state = await readAssetState(id, assetId, lib.settings.variantsPerAsset);
  const done = state.variants.filter((v): v is Variant => v?.status === "done" && Boolean(v.imagePath));
  if (!done.length) throw new Error("There are no finished designs to check yet.");

  const model = MOCK_AI ? "mock" : lib.settings.qcModel;
  const judged = done.map((v) => v.n);
  let qc: QcResult;

  if (done.length === 1) {
    qc = {
      status: "done",
      winner: done[0].n,
      verdict: "Only one design finished, so it was chosen without a comparison.",
      designs: [{ design: done[0].n, score: 0, issues: [] }],
      model: "none",
      judged,
      createdAt: new Date().toISOString(),
    };
  } else {
    try {
      let result;
      if (MOCK_AI) {
        await new Promise((r) => setTimeout(r, 900));
        result = normaliseQc(
          {
            winner: judged[Math.floor(Math.random() * judged.length)],
            verdict: "Mock check: this design keeps the logo, headline and packaging closest to the key visual.",
            designs: judged.map((n) => ({
              design: n,
              score: 6 + Math.floor(Math.random() * 4),
              issues: n % 2 ? [{ issue: "Mock issue: product pack slightly oversized", severity: "low" as const }] : [],
            })),
          },
          judged,
        );
      } else {
        const kvRaw = await readFile(project.kv.path);
        if (!kvRaw) throw new Error("The key visual file is missing.");
        const kv = await forModel(kvRaw);
        const designs = await Promise.all(
          done.map(async (v) => {
            const raw = await readFile(v.imagePath!);
            if (!raw) throw new Error(`Design ${v.n} image is missing.`);
            const img = await forModel(raw);
            return { n: v.n, image: { label: `Design ${v.n}`, ...img } };
          }),
        );
        const prompt = fillPlaceholders(lib.qcPrompt, {
          brand: project.brand || "brand",
          campaign: project.campaign || "campaign",
          asset_type: asset.name,
          design_count: String(designs.length),
        });
        result = await runQualityCheck({ model, prompt, kv: { label: "KV", ...kv }, designs });
      }
      qc = { status: "done", ...result, model, judged, createdAt: new Date().toISOString() };
    } catch (e) {
      qc = {
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        model,
        judged,
        createdAt: new Date().toISOString(),
      };
    }
  }

  await writeJson(qcFile(id, assetId), qc);
  let selection = state.selection;
  if (qc.status === "done" && qc.winner && (!selection || selection.by === "qc" || !judged.includes(selection.n))) {
    selection = { n: qc.winner, by: "qc", at: new Date().toISOString() };
    await writeJson(selectionFile(id, assetId), selection);
  }
  return { qc, selection };
}

export async function selectVariant(id: string, assetId: string, n: number) {
  checkAssetId(assetId);
  const v = await readJson<Variant>(variantFile(id, assetId, n));
  if (v?.status !== "done") throw new Error("You can only choose a finished design.");
  const selection: Selection = { n, by: "user", at: new Date().toISOString() };
  await writeJson(selectionFile(id, assetId), selection);
  return selection;
}

export async function buildToolkit(id: string) {
  const state = await getState(id);
  const { project } = state;
  const pdf = await buildToolkitPdf(state);
  const pdfPath = `${base(id)}toolkit-${rand(4)}.pdf`;
  await writeFile(pdfPath, pdf.data, "application/pdf");
  const old = project.toolkit.pdf?.path;
  project.toolkit.pdf = { path: pdfPath, builtAt: new Date().toISOString(), pages: pdf.pages };
  await writeJson(projectFile(id), project);
  if (old) await deleteFiles([old]).catch(() => {});
  return { project, skipped: pdf.skipped };
}
