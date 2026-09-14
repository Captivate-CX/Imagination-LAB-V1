export const ASPECT_RATIOS = [
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "21:9",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/** A file sent to the image model alongside the key visual (e.g. the blank FSDU template). */
export interface ReferenceImage {
  id: string;
  /** The name the prompt uses for this file, e.g. "01. Blank Unit.png". */
  label: string;
  /** "builtin:<file>" for files shipped in /assets/references, otherwise a storage path. */
  path: string;
}

/** One POSM type in the prompt library (Wobbler, FSDU, ...). */
export interface AssetType {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  prompt: string;
  references: ReferenceImage[];
  enabled: boolean;
}

export interface LibrarySettings {
  imageModel: string;
  qcModel: string;
  imageSize: ImageSize;
  variantsPerAsset: number;
}

export interface Library {
  updatedAt: string;
  note?: string;
  assetTypes: AssetType[];
  qcPrompt: string;
  settings: LibrarySettings;
}

export interface ProjectAsset {
  /** Matches AssetType.id in the library. */
  id: string;
  name: string;
  aspectRatio: AspectRatio;
}

export type ToolkitLayout = "chosen" | "all";

export interface Project {
  id: string;
  brand: string;
  campaign: string;
  createdAt: string;
  expiresAt: string;
  kv: { path: string; width: number; height: number; mime: string };
  assets: ProjectAsset[];
  toolkit: {
    layout: ToolkitLayout;
    pdf?: { path: string; builtAt: string; pages: number };
  };
}

export interface Variant {
  n: number;
  status: "done" | "error";
  imagePath?: string;
  width?: number;
  height?: number;
  error?: string;
  /** Any text the image model returned alongside the image. */
  modelNotes?: string;
  model: string;
  promptUpdatedAt: string;
  createdAt: string;
  durationMs: number;
}

export type Severity = "high" | "medium" | "low";

export interface QcDesign {
  design: number;
  score: number;
  summary?: string;
  issues: { issue: string; severity: Severity }[];
}

export interface QcResult {
  status: "done" | "error";
  winner?: number;
  verdict?: string;
  designs?: QcDesign[];
  error?: string;
  model: string;
  /** Which variant numbers were judged. */
  judged: number[];
  createdAt: string;
}

export interface Selection {
  n: number;
  by: "qc" | "user";
  at: string;
}

export interface AssetState {
  variants: (Variant | null)[];
  qc: QcResult | null;
  selection: Selection | null;
}

export interface ProjectState {
  project: Project;
  assets: Record<string, AssetState>;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  kvPath: string;
  assetNames: string[];
  hasPdf: boolean;
}

export function projectTitle(p: { brand: string; campaign: string }) {
  const brand = p.brand.trim();
  const campaign = p.campaign.trim();
  if (brand && campaign) return `${brand} \u201C${campaign}\u201D`;
  return brand || campaign || "Untitled campaign";
}
