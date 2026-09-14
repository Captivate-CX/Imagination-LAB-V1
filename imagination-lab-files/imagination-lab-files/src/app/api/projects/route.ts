import { createProject, listProjects } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return respond(() => listProjects());
}

export async function POST(req: Request) {
  return respond(async () => {
    const form = await req.formData();
    const file = form.get("kv");
    if (!(file instanceof File) || !file.size) throw new Error("Add the key visual image.");
    if (!file.type.startsWith("image/")) throw new Error("The key visual must be an image (JPG, PNG or WebP).");
    const assetIds = JSON.parse(String(form.get("assetIds") || "[]")) as string[];
    return createProject({
      kv: Buffer.from(await file.arrayBuffer()),
      brand: String(form.get("brand") || ""),
      campaign: String(form.get("campaign") || ""),
      assetIds,
    });
  });
}
