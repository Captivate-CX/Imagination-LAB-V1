import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { ConfigError } from "./storage";
import type { AspectRatio, ImageSize, QcDesign, Severity } from "./types";

export const MOCK_AI = process.env.MOCK_AI === "true" || process.env.MOCK_AI === "1";

function client() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new ConfigError(
      "No Gemini API key. Add GEMINI_API_KEY in Vercel (Settings, Environment Variables) and redeploy.",
    );
  }
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 280_000 } });
}

export interface InputImage {
  label: string;
  mime: string;
  data: Buffer;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const delays = [4000, 12000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const retryable = [429, 500, 502, 503, 504].includes(status);
      if (!retryable || attempt >= delays.length || Date.now() - started > 120_000) throw e;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

function imageParts(images: InputImage[]): Part[] {
  const parts: Part[] = [];
  images.forEach((img, i) => {
    parts.push({ text: `Image ${i + 1}: ${img.label}` });
    parts.push({ inlineData: { mimeType: img.mime, data: img.data.toString("base64") } });
  });
  return parts;
}

export async function generateImage(opts: {
  model: string;
  prompt: string;
  images: InputImage[];
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}): Promise<{ data: Buffer; mime: string; notes: string }> {
  const ai = client();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: opts.model,
      contents: [{ role: "user", parts: [...imageParts(opts.images), { text: opts.prompt }] }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: opts.aspectRatio, imageSize: opts.imageSize },
      },
    }),
  );

  const candidate = res.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  // Gemini image models can return draft "thought" images while reasoning; the final image is the last non-thought one.
  const images = parts.filter(
    (p) => !p.thought && p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"),
  );
  const notes = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("\n")
    .trim();
  const final = images[images.length - 1];
  if (!final?.inlineData?.data) {
    const reason =
      res.promptFeedback?.blockReason ?? candidate?.finishReason ?? "no reason given";
    throw new Error(
      `The model didn't return an image (${reason}).${notes ? ` It said: ${notes.slice(0, 300)}` : ""}`,
    );
  }
  return {
    data: Buffer.from(final.inlineData.data, "base64"),
    mime: final.inlineData.mimeType ?? "image/png",
    notes: notes.slice(0, 4000),
  };
}

const QC_SCHEMA = {
  type: "object",
  properties: {
    winner: { type: "integer", description: "The design number that best translates the Key Visual." },
    verdict: { type: "string", description: "Which design is best and why, in 2-5 sentences." },
    designs: {
      type: "array",
      description: "The issues table: one entry per design.",
      items: {
        type: "object",
        properties: {
          design: { type: "integer" },
          score: { type: "integer", minimum: 0, maximum: 10, description: "Faithfulness to the Key Visual, 0-10." },
          summary: { type: "string", description: "One sentence on this design." },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                issue: { type: "string" },
                severity: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["issue", "severity"],
            },
          },
        },
        required: ["design", "score", "issues"],
      },
    },
  },
  required: ["winner", "verdict", "designs"],
};

const QC_FORMAT_NOTE = `

Answer as JSON using the provided schema: "winner" is the number of the best design, "verdict" is your verdict and why, and "designs" is the issues table with one entry per design (score each design 0-10 for how faithfully it translates the Key Visual; list every issue with a severity of high, medium or low; use an empty list if a design has no issues).`;

export async function runQualityCheck(opts: {
  model: string;
  prompt: string;
  kv: InputImage;
  designs: { n: number; image: InputImage }[];
}): Promise<{ winner: number; verdict: string; designs: QcDesign[] }> {
  const ai = client();
  const images: InputImage[] = [
    { ...opts.kv, label: "The Key Visual (KV)" },
    ...opts.designs.map((d) => ({ ...d.image, label: `Design ${d.n}` })),
  ];
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: opts.model,
      contents: [{ role: "user", parts: [...imageParts(images), { text: opts.prompt + QC_FORMAT_NOTE }] }],
      config: { responseMimeType: "application/json", responseJsonSchema: QC_SCHEMA },
    }),
  );
  const text = res.text ?? "";
  let parsed: { winner?: number; verdict?: string; designs?: QcDesign[] };
  try {
    parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
  } catch {
    throw new Error("The quality check didn't return a readable answer. Try running it again.");
  }
  return normaliseQc(parsed, opts.designs.map((d) => d.n));
}

export function normaliseQc(
  raw: { winner?: number; verdict?: string; designs?: QcDesign[] },
  judged: number[],
) {
  const designs: QcDesign[] = judged.map((n) => {
    const d = raw.designs?.find((x) => Number(x.design) === n);
    return {
      design: n,
      score: Math.max(0, Math.min(10, Math.round(Number(d?.score ?? 0)))),
      summary: d?.summary ?? "",
      issues: (d?.issues ?? []).map((i) => ({
        issue: String(i.issue),
        severity: (["high", "medium", "low"].includes(i.severity) ? i.severity : "medium") as Severity,
      })),
    };
  });
  let winner = Number(raw.winner);
  if (!judged.includes(winner)) {
    // Fall back to the design the verdict names, then to the highest score.
    const named = Number(/design\s*(\d+)/i.exec(String(raw.verdict ?? ""))?.[1]);
    winner = judged.includes(named)
      ? named
      : ([...designs].sort((a, b) => b.score - a.score)[0]?.design ?? judged[0]);
  }
  return { winner, verdict: String(raw.verdict ?? "").trim(), designs };
}

export async function listModels() {
  const ai = client();
  const pager = await ai.models.list({ config: { pageSize: 200 } });
  const out: { id: string; name: string; image: boolean }[] = [];
  for await (const m of pager) {
    const id = (m.name ?? "").replace(/^models\//, "");
    if (!id.startsWith("gemini")) continue;
    if (!(m.supportedActions ?? []).includes("generateContent")) continue;
    out.push({ id, name: m.displayName ?? id, image: /image/i.test(id) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
