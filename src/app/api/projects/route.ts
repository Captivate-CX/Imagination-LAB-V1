import { deleteProject, getState, updateProject } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(() => getState(id));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => updateProject(id, await req.json()));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => {
    await deleteProject(id);
    return { ok: true };
  });
}
