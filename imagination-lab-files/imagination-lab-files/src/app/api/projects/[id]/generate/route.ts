import { generateVariant } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";
// Image generation can take a minute or two. 300s works on every Vercel plan with Fluid compute.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => {
    const { assetId, n } = (await req.json()) as { assetId: string; n: number };
    return generateVariant(id, assetId, Number(n));
  });
}
