import { selectVariant } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => {
    const { assetId, n } = (await req.json()) as { assetId: string; n: number };
    return selectVariant(id, assetId, Number(n));
  });
}
