import { buildToolkit } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(() => buildToolkit(id));
}
