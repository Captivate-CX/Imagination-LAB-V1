import { getLibrary, saveLibrary, validateLibrary } from "@/lib/library";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(() => getLibrary());
}

export async function PUT(req: Request) {
  return respond(async () => {
    const body = (await req.json()) as { library: unknown; note?: string };
    const lib = validateLibrary(body.library);
    return saveLibrary(lib, body.note);
  });
}
