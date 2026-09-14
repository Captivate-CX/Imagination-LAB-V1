import { qualityCheck } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => {
    const { assetId } = (await req.json()) as { assetId: string };
    return qualityCheck(id, assetId);
  });
}
